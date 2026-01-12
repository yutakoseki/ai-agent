import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import type { RssGenerationTarget } from "@shared/rss";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { getUserPreferences, upsertUserPreferences } from "@/lib/repos/userPreferencesRepo";

export const runtime = "nodejs";

const ALLOWED: RssGenerationTarget[] = ["blog", "x"];

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const prefs = await getUserPreferences({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
    });
    const targets =
      prefs?.rssGenerationTargets && prefs.rssGenerationTargets.length
        ? prefs.rssGenerationTargets
        : ["x"];
    return NextResponse.json(
      { generationTargets: targets },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/rss/preferences");
  }
}

export async function PATCH(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const body = await request.json().catch(() => ({}));
    const raw = body?.generationTargets;
    if (!Array.isArray(raw)) {
      throw new AppError("BAD_REQUEST", "generationTargets は配列で指定してください");
    }
    const targets = raw
      .map((v: any) => String(v))
      .filter((v: string) => (ALLOWED as string[]).includes(v)) as RssGenerationTarget[];
    if (targets.length === 0) {
      throw new AppError("BAD_REQUEST", "少なくとも1つの出力先を選択してください");
    }

    const saved = await upsertUserPreferences({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
      rssGenerationTargets: targets,
    });

    return NextResponse.json(
      { generationTargets: saved.rssGenerationTargets ?? ["x"] },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "PATCH /api/rss/preferences");
  }
}
