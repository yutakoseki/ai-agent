// ログインAPI

import { NextRequest, NextResponse } from "next/server";
import type { LoginRequest, LoginResponse } from "@shared/auth";
import { AppError } from "@shared/error";
import { createAccessToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { loginWithCognito, verifyCognitoIdToken } from "@/lib/auth/cognito";
import { findUserByUserId } from "@/lib/repos/userRepo";
import { randomUUID } from "crypto";

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

    const cognitoTokens = await loginWithCognito(body.email, body.password);
    const idToken = cognitoTokens.idToken;
    const payload = await verifyCognitoIdToken(idToken);
    const userId = payload.sub;
    if (!userId) {
      throw new AppError("UNAUTHORIZED", "ユーザー情報が取得できません");
    }

    const user = await findUserByUserId(userId);
    if (!user) {
      throw new AppError("UNAUTHORIZED", "ユーザーが見つかりません");
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
    const refreshToken = cognitoTokens.refreshToken;
    if (!refreshToken) {
      throw new AppError("INTERNAL_ERROR", "リフレッシュトークンが取得できません");
    }

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
