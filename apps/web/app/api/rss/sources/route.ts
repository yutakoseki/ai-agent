import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import {
  listSourcesByUser,
  createSource,
  normalizeSourceUrl,
} from "@/lib/repos/rssSourceRepo";
import { findTenantById } from "@/lib/repos/tenantRepo";
import { getRssPlanLimits } from "@/lib/rss/plan";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const sources = await listSourcesByUser({ userId: context.session.userId });
    const sorted = sources.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    return NextResponse.json(
      { sources: sorted, total: sorted.length },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/rss/sources");
  }
}

export async function POST(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const body = await request.json().catch(() => ({}));
    const url = String(body?.url ?? "").trim();
    if (!url) throw new AppError("BAD_REQUEST", "URLは必須です");

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new AppError("BAD_REQUEST", "URLの形式が不正です");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new AppError("BAD_REQUEST", "URLはhttp/httpsのみ対応しています");
    }

    const tenant = await findTenantById(context.session.tenantId);
    const limits = getRssPlanLimits(tenant?.plan ?? "Basic");

    const sources = await listSourcesByUser({ userId: context.session.userId });
    if (sources.length >= limits.maxSources) {
      throw new AppError("QUOTA_EXCEEDED", "RSS登録数の上限に達しています", {
        maxSources: limits.maxSources,
      });
    }

    const normalized = normalizeSourceUrl(url);
    const exists = sources.some(
      (source) => normalizeSourceUrl(source.url) === normalized
    );
    if (exists) {
      throw new AppError("BAD_REQUEST", "同じURLが既に登録されています");
    }

    const created = await createSource({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
      url,
    });

    return NextResponse.json(created, {
      status: 201,
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/rss/sources");
  }
}
