// トークンリフレッシュAPI

import { NextRequest, NextResponse } from "next/server";
import type { RefreshTokenRequest } from "@types/auth";
import { AppError } from "@types/error";
import { verifyRefreshToken, createAccessToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { handleError } from "@/lib/middleware/error";
import { randomUUID } from "crypto";

// TODO: DB接続後に実装
const MOCK_USER = {
  id: "user-1",
  tenantId: "tenant-1",
  email: "admin@example.com",
  role: "Admin" as const,
};

export async function POST(request: NextRequest) {
  const traceId = randomUUID();

  try {
    const body: RefreshTokenRequest = await request.json();

    if (!body.refreshToken) {
      throw new AppError("BAD_REQUEST", "リフレッシュトークンは必須です");
    }

    // リフレッシュトークン検証
    const userId = await verifyRefreshToken(body.refreshToken);
    if (!userId) {
      throw new AppError("UNAUTHORIZED", "リフレッシュトークンが無効です");
    }

    // TODO: DBからユーザー取得
    // const user = await db.user.findUnique({ where: { id: userId } });
    const user = userId === MOCK_USER.id ? MOCK_USER : null;

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
    return handleError(error, traceId);
  }
}
