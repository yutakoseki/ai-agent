import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";

export interface RequestContext {
  traceId: string;
  requestId: string;
  clientIp?: string;
  userAgent?: string | null;
  startedAt: number;
}

export function buildRequestContext(request: NextRequest): RequestContext {
  const requestId =
    request.headers.get("x-request-id") ??
    request.headers.get("x-amzn-trace-id") ??
    randomUUID();

  return {
    traceId: randomUUID(),
    requestId,
    clientIp: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    startedAt: Date.now(),
  };
}

export function logRequestStart(
  request: NextRequest,
  context: RequestContext,
  label?: string
): void {
  logger.info("api request start", {
    traceId: context.traceId,
    requestId: context.requestId,
    method: request.method,
    path: request.nextUrl?.pathname ?? "unknown",
    clientIp: context.clientIp,
    userAgent: context.userAgent,
    label,
  });
}

export function logRequestEnd(
  context: RequestContext,
  status: number,
  label?: string,
  extra?: Record<string, unknown>
): void {
  logger.info("api request end", {
    traceId: context.traceId,
    requestId: context.requestId,
    status,
    durationMs: Date.now() - context.startedAt,
    label,
    ...extra,
  });
}

export function getClientIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  // Next.js の dev 環境用フォールバック
  return request.ip;
}



