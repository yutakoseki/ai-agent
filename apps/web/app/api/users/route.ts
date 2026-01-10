// ユーザー一覧取得・作成API

import { NextRequest, NextResponse } from "next/server";
import type { CreateUserRequest, UserListResponse } from "@shared/user";
import { AppError } from "@shared/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { createCognitoUser, deleteCognitoUser } from "@/lib/auth/cognito";
import { createUser, searchUsersPage } from "@/lib/repos/userRepo";
import { sendUserCreatedEmail } from "@/lib/notifications/userCreatedEmails";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host");
  if (proto && host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

// ユーザー一覧取得（20件ページング + 検索 + Adminのみテナント絞り込み）
export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const tenantIdParam = url.searchParams.get("tenantId") ?? undefined;
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(
      20,
      Math.max(1, Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 20)
    );

    const effectiveTenantId =
      context.session.role === "Admin" ? tenantIdParam : context.session.tenantId;

    const { users, nextCursor } = await searchUsersPage({
      tenantId: effectiveTenantId,
      q,
      limit,
      cursor,
    });
    const result: UserListResponse = {
      users,
      total: users.length, // ページング時は「このレスポンス内の件数」
      nextCursor,
    };

    return NextResponse.json(result, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/users");
  }
}

// ユーザー作成（Admin/Manager専用）
export async function POST(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    // Admin/Manager権限チェック
    const roleError = requireRole(
      context.session,
      ["Admin", "Manager"],
      context.traceId
    );
    if (roleError) return roleError;

    const body: CreateUserRequest = await request.json();

    // バリデーション
    if (!body.email || !body.password || !body.role) {
      throw new AppError("BAD_REQUEST", "必須項目が不足しています");
    }

    // パスワード強度チェック
    const passwordCheck = validatePasswordStrength(body.password);
    if (!passwordCheck.valid) {
      throw new AppError("BAD_REQUEST", "パスワードが要件を満たしていません", {
        errors: passwordCheck.errors,
      });
    }

    // Managerは自分より上位の役割を作成できない
    if (context.session.role === "Manager" && body.role === "Admin") {
      throw new AppError("FORBIDDEN", "Admin役割のユーザーは作成できません");
    }

    // Adminのみ: 作成先テナントを任意指定できる
    const requestedTenantId = (body?.tenantId ?? "").trim();
    const effectiveTenantId =
      context.session.role === "Admin" && requestedTenantId
        ? requestedTenantId
        : context.session.tenantId;

    // Manager/Member はテナント指定での作成は禁止（テナント分離の明確化）
    if (
      context.session.role !== "Admin" &&
      requestedTenantId &&
      requestedTenantId !== context.session.tenantId
    ) {
      throw new AppError("FORBIDDEN", "他テナントにユーザーを作成することはできません");
    }

    // TODO: メールアドレス重複チェック
    // const existing = await db.user.findUnique({ where: { email: body.email } });
    // if (existing) throw new AppError('BAD_REQUEST', 'このメールアドレスは既に使用されています');

    const cognitoUser = await createCognitoUser(
      body.email,
      body.password,
      body.name
    );

    try {
      const passwordHash = await hashPassword(body.password);
      const user = await createUser(
        effectiveTenantId,
        body,
        passwordHash,
        cognitoUser.sub
      );

      // ログイン情報通知メール（best-effort: 失敗しても作成は成功扱い）
      try {
        await sendUserCreatedEmail({
          to: body.email,
          origin: requestOrigin(request),
          tenantId: effectiveTenantId,
          loginEmail: body.email,
          password: body.password,
          createdByRole: context.session.role,
        });
      } catch (error) {
        logger.warn("user created email unexpected failure", {
          traceId: context.traceId,
          to: body.email,
          tenantId: effectiveTenantId,
          error,
        });
      }

      return NextResponse.json(user, {
        status: 201,
        headers: { "X-Trace-Id": context.traceId },
      });
    } catch (error) {
      try {
        await deleteCognitoUser(body.email);
      } catch {
        // best-effort cleanup
      }
      throw error;
    }
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/users");
  }
}
