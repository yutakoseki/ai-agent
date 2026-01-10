import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function expectedOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host");
  if (proto && host) {
    return `${proto}://${host}`;
  }
  return request.nextUrl.origin;
}

export function requireCsrf(
  request: NextRequest,
  traceId?: string
): NextResponse | null {
  if (SAFE_METHODS.has(request.method)) return null;

  const expected = expectedOrigin(request);
  const origin = request.headers.get("origin");
  if (origin && origin === expected) return null;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin === expected) return null;
    } catch {
      // ignore invalid referer
    }
  }

  return NextResponse.json(
    {
      code: "FORBIDDEN",
      message: "不正なリクエストです",
      traceId,
    },
    { status: 403 }
  );
}
