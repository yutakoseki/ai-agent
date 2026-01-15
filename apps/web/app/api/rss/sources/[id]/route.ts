import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { findSourceById, updateSource, deleteSource } from "@/lib/repos/rssSourceRepo";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const { id } = await params;
    const source = await findSourceById({
      tenantId: context.session.tenantId,
      sourceId: id,
    });
    if (!source) throw new AppError("NOT_FOUND", "RSSが見つかりません");
    if (source.userId !== context.session.userId) {
      throw new AppError("FORBIDDEN", "このRSSを更新する権限がありません");
    }

    const body = await request.json().catch(() => ({}));
    const status = body?.status ? String(body.status) : undefined;
    if (status && !["active", "disabled"].includes(status)) {
      throw new AppError("BAD_REQUEST", "status が不正です");
    }

    await updateSource({
      tenantId: context.session.tenantId,
      sourceId: id,
      status: status as any,
    });

    const updated = await findSourceById({
      tenantId: context.session.tenantId,
      sourceId: id,
    });

    return NextResponse.json(updated, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "PATCH /api/rss/sources/[id]");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const { id } = await params;
    const source = await findSourceById({
      tenantId: context.session.tenantId,
      sourceId: id,
    });
    if (!source) throw new AppError("NOT_FOUND", "RSSが見つかりません");
    if (source.userId !== context.session.userId) {
      throw new AppError("FORBIDDEN", "このRSSを削除する権限がありません");
    }

    await deleteSource({ tenantId: context.session.tenantId, sourceId: id });

    return NextResponse.json(
      { ok: true },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "DELETE /api/rss/sources/[id]");
  }
}
