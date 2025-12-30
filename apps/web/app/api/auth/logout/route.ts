// ログアウトAPI

import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const traceId = randomUUID();
  const csrfError = requireCsrf(request, traceId);
  if (csrfError) return csrfError;

  try {
    // TODO: リフレッシュトークンの無効化処理

    const clearCookie = clearSessionCookie();

    return NextResponse.json(
      { message: "ログアウトしました" },
      {
        status: 200,
        headers: {
          "Set-Cookie": clearCookie,
          "X-Trace-Id": traceId,
        },
      }
    );
  } catch (error) {
    return handleError(error, traceId, "POST /api/auth/logout");
  }
}
