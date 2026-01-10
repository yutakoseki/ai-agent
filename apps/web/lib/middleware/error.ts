// エラーハンドリングユーティリティ

import { NextResponse } from "next/server";
import "@/lib/next-runtime-workaround";
import { AppError, type ApiError } from "@shared/error";
import { logger } from "@/lib/logger";

export function handleError(
  error: unknown,
  traceId?: string,
  label?: string
): NextResponse {
  logApiError(error, traceId, label);

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

function logApiError(
  error: unknown,
  traceId?: string,
  label?: string
): void {
  const context: Record<string, unknown> = {};
  if (label) {
    context.label = label;
  }
  if (traceId) {
    context.traceId = traceId;
  }

  if (error instanceof AppError) {
    const payload: Record<string, unknown> = {
      ...context,
      code: error.code,
      message: error.message,
    };
    if (error.details !== undefined) {
      payload.details = error.details;
    }

    logger.warn("API expected error", payload);
    return;
  }

  if (error instanceof Error) {
    logger.error("API unexpected error", {
      ...context,
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  logger.error("API unexpected error", { ...context, error });
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
