// お知らせ 更新/削除 API（テナント単位）

import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@shared/error';
import { requireAuth, requireRole } from '@/lib/middleware/auth';
import { handleError } from '@/lib/middleware/error';
import { requireCsrf } from '@/lib/middleware/csrf';
import { deleteNotice, updateNotice } from '@/lib/repos/noticeRepo';

export const runtime = 'nodejs';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const roleError = requireRole(context.session, ['Admin'], context.traceId);
    if (roleError) return roleError;

    const { id } = await params;
    if (!id) throw new AppError('BAD_REQUEST', 'idが不正です');

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title ?? '').trim();
    const noticeBody = String(body?.body ?? '');

    if (!title) throw new AppError('BAD_REQUEST', 'タイトルは必須です');
    if (title.length > 120)
      throw new AppError('BAD_REQUEST', 'タイトルが長すぎます（最大120文字）');
    if (noticeBody.length > 10_000)
      throw new AppError('BAD_REQUEST', '本文が長すぎます（最大10,000文字）');

    const saved = await updateNotice({
      id,
      title,
      body: noticeBody,
      actorUserId: context.session.userId,
    });

    return NextResponse.json(saved, { headers: { 'X-Trace-Id': context.traceId } });
  } catch (error) {
    return handleError(error, context.traceId, 'PUT /api/notices/:id');
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

    const roleError = requireRole(context.session, ['Admin'], context.traceId);
    if (roleError) return roleError;

    const { id } = await params;
    if (!id) throw new AppError('BAD_REQUEST', 'idが不正です');

    await deleteNotice({ id });

    return NextResponse.json({ ok: true }, { headers: { 'X-Trace-Id': context.traceId } });
  } catch (error) {
    return handleError(error, context.traceId, 'DELETE /api/notices/:id');
  }
}
