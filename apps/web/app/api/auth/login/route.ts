// ログインAPI

import { NextRequest, NextResponse } from "next/server";
import type { LoginRequest, LoginResponse } from "@shared/auth";
import { AppError } from "@shared/error";
import { verifyPassword } from "@/lib/auth/password";
import { createAccessToken, createRefreshToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { randomUUID } from "crypto";

// TODO: DB接続後に実装
// 現在はモックデータで動作確認
const MOCK_USER = {
  id: "user-1",
  tenantId: "tenant-1",
  email: "admin@example.com",
  role: "Admin" as const,
  name: "管理者",
  // password: Test1234
  passwordHash: "$2b$12$f1rxQ0wpDLldae4uHS7SduS2uaXkXPoNLjvYQETRfp1cv34XAmBES",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export async function POST(request: NextRequest) {
  const traceId = randomUUID();
  const csrfError = requireCsrf(request, traceId);
  if (csrfError) return csrfError;

  try {
    const body: LoginRequest = await request.json();

    // バリデーション
    if (!body.email || !body.password) {
      throw new AppError("BAD_REQUEST", "メールアドレスとパスワードは必須です");
    }

    // TODO: DBからユーザー取得
    // const user = await db.user.findUnique({ where: { email: body.email } });
    const user = body.email === MOCK_USER.email ? MOCK_USER : null;

    if (!user) {
      throw new AppError(
        "UNAUTHORIZED",
        "メールアドレスまたはパスワードが正しくありません"
      );
    }

    // パスワード検証
    const isValid = await verifyPassword(body.password, user.passwordHash);
    if (!isValid) {
      throw new AppError(
        "UNAUTHORIZED",
        "メールアドレスまたはパスワードが正しくありません"
      );
    }

    // セッション作成
    const session = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15分
    };

    // トークン生成
    const accessToken = await createAccessToken(session);
    const refreshToken = await createRefreshToken(user.id);

    // レスポンス
    const response: LoginResponse = {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15分（秒）
      },
    };

    // Cookieにセッション設定
    const setCookie = setSessionCookie(accessToken, 900);

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Set-Cookie": setCookie,
        "X-Trace-Id": traceId,
      },
    });
  } catch (error) {
    return handleError(error, traceId, "POST /api/auth/login");
  }
}
