// パスワード変更API（ログイン有無どちらでも可：現在パスワードの再入力が必要）

import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { handleError } from "@/lib/middleware/error";
import { consumeRateLimit } from "@/lib/middleware/rateLimit";
import { getSession } from "@/lib/auth/session";
import {
  loginWithCognito,
  setCognitoUserPassword,
  verifyCognitoIdToken,
} from "@/lib/auth/cognito";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { findUserByUserId, updateUserPasswordHash } from "@/lib/repos/userRepo";
import {
  buildRequestContext,
  logRequestEnd,
  logRequestStart,
} from "@/lib/observability";
import { writeAuditLog } from "@/lib/audit";
import { sendPasswordChangedEmail } from "@/lib/notifications/passwordChangeEmails";

export const runtime = "nodejs";

type ChangePasswordRequest = {
  email?: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host");
  if (proto && host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);
  const csrfError = requireCsrf(request, context.traceId);
  if (csrfError) return csrfError;

  logRequestStart(request, context, "POST /api/auth/change-password");
  let response: NextResponse | undefined;
  let actorUserId: string | undefined;
  let actorTenantId: string | undefined;

  try {
    const body: ChangePasswordRequest = await request.json();

    const session = await getSession();
    const email = (session?.email ?? body.email ?? "").trim().toLowerCase();
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    const rateLimitResult = consumeRateLimit({
      key: `auth_change_password:${context.clientIp ?? "unknown"}:${email || "unknown"}`,
      windowMs: 60_000,
      limit: 5,
      traceId: context.traceId,
      label: "auth_change_password",
    });
    if (rateLimitResult.response) {
      response = rateLimitResult.response;
      return response;
    }

    if (!email || !currentPassword || !newPassword || !confirmPassword) {
      throw new AppError(
        "BAD_REQUEST",
        "メールアドレス、現在のパスワード、新しいパスワード、確認用パスワードは必須です"
      );
    }
    if (newPassword !== confirmPassword) {
      throw new AppError("BAD_REQUEST", "新しいパスワードが一致しません");
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      throw new AppError("BAD_REQUEST", "パスワードが要件を満たしていません", {
        errors: passwordCheck.errors,
      });
    }

    // 現在パスワードの確認（Cognito）
    const tokens = await loginWithCognito(email, currentPassword);
    const payload = await verifyCognitoIdToken(tokens.idToken);
    const sub = String(payload.sub ?? "");
    if (!sub) {
      throw new AppError("UNAUTHORIZED", "ユーザー情報が取得できません");
    }

    // DB 上のユーザーが見つからない場合は、Cognito だけ変更してしまうと不整合になるため先に止める
    const user = await findUserByUserId(sub);
    if (!user) {
      throw new AppError("UNAUTHORIZED", "ユーザーが見つかりません");
    }
    actorUserId = user.id;
    actorTenantId = user.tenantId;

    await setCognitoUserPassword(email, newPassword);
    const passwordHash = await hashPassword(newPassword);
    await updateUserPasswordHash(user.tenantId, user.id, passwordHash);

    // 通知メール（失敗しても処理は成功扱い）
    await sendPasswordChangedEmail({ to: user.email, origin: requestOrigin(request) });

    response = NextResponse.json(
      { message: "パスワードを変更しました" },
      { status: 200, headers: { "X-Trace-Id": context.traceId } }
    );

    writeAuditLog({
      action: "auth.password.change",
      result: "success",
      actorUserId,
      tenantId: actorTenantId,
      traceId: context.traceId,
      ip: context.clientIp,
      userAgent: context.userAgent,
      metadata: { path: "/api/auth/change-password", method: "POST" },
    });

    return response;
  } catch (error) {
    response = handleError(error, context.traceId, "POST /api/auth/change-password");

    writeAuditLog({
      action: "auth.password.change",
      result: "failure",
      actorUserId,
      tenantId: actorTenantId,
      traceId: context.traceId,
      ip: context.clientIp,
      userAgent: context.userAgent,
      metadata: { path: "/api/auth/change-password", method: "POST" },
      reason: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "unknown error",
    });

    return response;
  } finally {
    logRequestEnd(context, response?.status ?? 500, "POST /api/auth/change-password", {
      userId: actorUserId,
      tenantId: actorTenantId,
    });
  }
}


