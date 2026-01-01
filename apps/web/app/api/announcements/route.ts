// アナウンス掲示板 API（テナント単位）

import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import {
  getAnnouncementBoard,
  upsertAnnouncementBoard,
} from "@/lib/repos/announcementRepo";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const item = await getAnnouncementBoard(context.session.tenantId);
    return NextResponse.json(
      {
        markdown: item?.markdown ?? "",
        updatedAt: item?.updatedAt ?? null,
        updatedByUserId: item?.updatedByUserId ?? null,
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/announcements");
  }
}

export async function PUT(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const body = await request.json().catch(() => ({}));
    const markdown = String(body?.markdown ?? "");

    if (markdown.length > 10_000) {
      throw new AppError("BAD_REQUEST", "本文が長すぎます（最大10,000文字）");
    }

    const saved = await upsertAnnouncementBoard({
      tenantId: context.session.tenantId,
      markdown,
      updatedByUserId: context.session.userId,
    });

    return NextResponse.json(
      {
        markdown: saved.markdown,
        updatedAt: saved.updatedAt,
        updatedByUserId: saved.updatedByUserId,
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "PUT /api/announcements");
  }
}


