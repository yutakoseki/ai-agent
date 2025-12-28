// ユーザー一覧取得・作成API

import { NextRequest, NextResponse } from "next/server";
import type { CreateUserRequest, UserListResponse } from "@shared/user";
import { AppError } from "@shared/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { listUsers, createUser } from "@/lib/repos/userRepo";

// テナント内ユーザー一覧取得
export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const users = await listUsers(context.session.tenantId);
    const result: UserListResponse = {
      users,
      total: users.length,
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

    // TODO: メールアドレス重複チェック
    // const existing = await db.user.findUnique({ where: { email: body.email } });
    // if (existing) throw new AppError('BAD_REQUEST', 'このメールアドレスは既に使用されています');

    const passwordHash = await hashPassword(body.password);

    const user = await createUser(context.session.tenantId, body, passwordHash);

    return NextResponse.json(user, {
      status: 201,
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/users");
  }
}
