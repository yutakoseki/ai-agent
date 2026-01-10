// ユーザーのパスワード再設定（Admin専用）

import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { requireCsrf } from "@/lib/middleware/csrf";
import { handleError } from "@/lib/middleware/error";
import { setCognitoUserPassword } from "@/lib/auth/cognito";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { findUserByUserId, updateUserPasswordHash } from "@/lib/repos/userRepo";
import { sendPasswordResetByAdminEmail } from "@/lib/notifications/passwordChangeEmails";

export const runtime = "nodejs";

type ResetPasswordRequest = {
  newPassword: string;
  confirmPassword: string;
};

function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host");
  if (proto && host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const { id } = await params;
    const body: ResetPasswordRequest = await request.json();
    const newPassword = body?.newPassword ?? "";
    const confirmPassword = body?.confirmPassword ?? "";

    if (!newPassword || !confirmPassword) {
      throw new AppError("BAD_REQUEST", "新しいパスワードと確認用パスワードは必須です");
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

    const user = await findUserByUserId(id);
    if (!user) {
      throw new AppError("NOT_FOUND", "ユーザーが見つかりません");
    }

    await setCognitoUserPassword(user.email, newPassword);
    const passwordHash = await hashPassword(newPassword);
    await updateUserPasswordHash(user.tenantId, user.id, passwordHash);

    // 通知メール（失敗しても処理は成功扱い）
    await sendPasswordResetByAdminEmail({ to: user.email, origin: requestOrigin(request) });

    return NextResponse.json(
      { message: "パスワードを再設定しました" },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/users/:id/password");
  }
}


