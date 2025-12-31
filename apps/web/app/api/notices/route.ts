// お知らせ API（テナント単位）

import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { createNotice, listNotices } from "@/lib/repos/noticeRepo";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const items = await listNotices();
    return NextResponse.json(
      { notices: items },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/notices");
  }
}

export async function POST(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title ?? "").trim();
    const noticeBody = String(body?.body ?? "");

    if (!title) throw new AppError("BAD_REQUEST", "タイトルは必須です");
    if (title.length > 120)
      throw new AppError("BAD_REQUEST", "タイトルが長すぎます（最大120文字）");
    if (noticeBody.length > 10_000)
      throw new AppError("BAD_REQUEST", "本文が長すぎます（最大10,000文字）");

    const saved = await createNotice({
      title,
      body: noticeBody,
      actorUserId: context.session.userId,
    });

    return NextResponse.json(saved, {
      status: 201,
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/notices");
  }
}


