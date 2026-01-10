import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import type { MailCategory } from "@shared/mail";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { getUserPreferences, upsertUserPreferences } from "@/lib/repos/userPreferencesRepo";

export const runtime = "nodejs";

const ALL: MailCategory[] = ["action_required"];

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const prefs = await getUserPreferences({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
    });
    return NextResponse.json(
      {
        taskVisibleCategories: prefs?.taskVisibleCategories ?? ALL,
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/user/preferences");
  }
}

export async function PATCH(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const body = await request.json().catch(() => ({}));
    const catsRaw = body?.taskVisibleCategories;
    if (!Array.isArray(catsRaw)) {
      throw new AppError("BAD_REQUEST", "taskVisibleCategories は配列で指定してください");
    }
    const cats = catsRaw
      .map((v: any) => String(v))
      .filter((v: string) => (ALL as string[]).includes(v)) as MailCategory[];
    if (cats.length === 0) {
      throw new AppError("BAD_REQUEST", "少なくとも1つのカテゴリを選択してください");
    }

    const saved = await upsertUserPreferences({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
      taskVisibleCategories: cats,
    });

    return NextResponse.json(
      { taskVisibleCategories: saved.taskVisibleCategories ?? ALL },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "PATCH /api/user/preferences");
  }
}


