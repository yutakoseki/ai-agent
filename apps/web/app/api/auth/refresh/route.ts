// トークンリフレッシュAPI

import { NextRequest, NextResponse } from "next/server";
import type { RefreshTokenRequest } from "@shared/auth";
import { AppError } from "@shared/error";
import { createAccessToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { refreshWithCognito, verifyCognitoIdToken } from "@/lib/auth/cognito";
import { findUserByUserId } from "@/lib/repos/userRepo";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const traceId = randomUUID();
  const csrfError = requireCsrf(request, traceId);
  if (csrfError) return csrfError;

  try {
    const body: RefreshTokenRequest = await request.json();

    if (!body.refreshToken) {
      throw new AppError("BAD_REQUEST", "リフレッシュトークンは必須です");
    }

    const cognitoTokens = await refreshWithCognito(
      body.refreshToken,
      body.email
    );
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

    // 新しいアクセストークン生成
    const session = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    const accessToken = await createAccessToken(session);
    const setCookie = setSessionCookie(accessToken, 900);

    return NextResponse.json(
      {
        accessToken,
        expiresIn: 900,
      },
      {
        status: 200,
        headers: {
          "Set-Cookie": setCookie,
          "X-Trace-Id": traceId,
        },
      }
    );
  } catch (error) {
    return handleError(error, traceId, "POST /api/auth/refresh");
  }
}
