// ユーザー一覧取得・作成API

import { NextRequest, NextResponse } from "next/server";
import type { CreateUserRequest, UserListResponse } from "@types/user";
import { AppError } from "@types/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { randomUUID } from "crypto";

// TODO: DB接続後に実装
const MOCK_USERS = [
  {
    id: "user-1",
    email: "admin@example.com",
    role: "Admin" as const,
    name: "管理者",
    createdAt: new Date(),
  },
];

// テナント内ユーザー一覧取得
export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    // TODO: DBから自テナントのユーザー一覧取得
    // const users = await db.user.findMany({
    //   where: { tenantId: context.session.tenantId }
    // });

    const result: UserListResponse = {
      users: MOCK_USERS,
      total: MOCK_USERS.length,
    };

    return NextResponse.json(result, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId);
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

    const userId = randomUUID();
    const passwordHash = await hashPassword(body.password);

    // TODO: DBにユーザー作成
    // const user = await db.user.create({
    //   data: {
    //     id: userId,
    //     tenantId: context.session.tenantId,
    //     email: body.email,
    //     passwordHash,
    //     role: body.role,
    //     name: body.name
    //   }
    // });

    const user = {
      id: userId,
      tenantId: context.session.tenantId,
      email: body.email,
      role: body.role,
      name: body.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json(user, {
      status: 201,
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId);
  }
}
