// エラーハンドリングユーティリティ

import { NextResponse } from "next/server";
import { AppError, type ApiError } from "@types/error";

export function handleError(error: unknown, traceId?: string): NextResponse {
  console.error("[API Error]", { error, traceId });

  if (error instanceof AppError) {
    const apiError: ApiError = {
      code: error.code,
      message: error.message,
      details: error.details,
      traceId,
    };

    const statusCode = getStatusCode(error.code);
    return NextResponse.json(apiError, { status: statusCode });
  }

  // 予期しないエラー
  const apiError: ApiError = {
    code: "INTERNAL_ERROR",
    message: "内部エラーが発生しました",
    traceId,
  };

  return NextResponse.json(apiError, { status: 500 });
}

function getStatusCode(code: ApiError["code"]): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
    case "TENANT_MISMATCH":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "BAD_REQUEST":
      return 400;
    case "QUOTA_EXCEEDED":
    case "RATE_LIMIT_EXCEEDED":
      return 429;
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}
