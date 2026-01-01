import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

type RateLimitKey = string;

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  key: RateLimitKey;
  windowMs: number;
  limit: number;
  traceId?: string;
  label?: string;
}

export interface RateLimitResult {
  response?: NextResponse;
  remaining: number;
  resetAt: number;
}

// シンプルなインメモリ実装（開発/PoC向け）。本番ではRedis等へ差し替え前提。
const buckets = new Map<RateLimitKey, Bucket>();

export function consumeRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = getOrInitBucket(options.key, options.windowMs, now);

  bucket.count += 1;

  const remaining = Math.max(0, options.limit - bucket.count);

  if (bucket.count > options.limit) {
    const retryAfterSec = Math.max(
      0,
      Math.ceil((bucket.resetAt - now) / 1000)
    );

    logger.warn("rate limit exceeded", {
      traceId: options.traceId,
      label: options.label,
      key: options.key,
      limit: options.limit,
      windowMs: options.windowMs,
    });

    const response = NextResponse.json(
      {
        code: "RATE_LIMIT_EXCEEDED",
        message: "しばらく待ってから再度お試しください",
        traceId: options.traceId,
      },
      {
        status: 429,
        headers: {
          "Retry-After": `${retryAfterSec}`,
          "X-RateLimit-Limit": `${options.limit}`,
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": `${options.windowMs}`,
        },
      }
    );

    return {
      response,
      remaining: 0,
      resetAt: bucket.resetAt,
    };
  }

  buckets.set(options.key, bucket);

  return {
    remaining,
    resetAt: bucket.resetAt,
  };
}

function getOrInitBucket(
  key: RateLimitKey,
  windowMs: number,
  now: number
): Bucket {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const nextBucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, nextBucket);
    return nextBucket;
  }
  return bucket;
}


