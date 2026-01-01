// ユーザーのテナント移動（Admin専用）

import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@shared/error';
import { requireAuth, requireRole } from '@/lib/middleware/auth';
import { handleError } from '@/lib/middleware/error';
import { requireCsrf } from '@/lib/middleware/csrf';
import { findTenantById } from '@/lib/repos/tenantRepo';
import { findUserByUserId, moveUserToTenant } from '@/lib/repos/userRepo';

export const runtime = 'nodejs';

type MoveUserTenantRequest = {
  tenantId: string;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const roleError = requireRole(context.session, ['Admin'], context.traceId);
    if (roleError) return roleError;

    const { id } = await params;
    const body: MoveUserTenantRequest = await request.json();
    const destTenantId = (body?.tenantId ?? '').trim();
    if (!destTenantId) {
      throw new AppError('BAD_REQUEST', '移行先テナントID（tenantId）は必須です');
    }

    const current = await findUserByUserId(id);
    if (!current) {
      throw new AppError('NOT_FOUND', 'ユーザーが見つかりません');
    }
    if (current.tenantId === destTenantId) {
      return NextResponse.json(current, { headers: { 'X-Trace-Id': context.traceId } });
    }

    const destTenant = await findTenantById(destTenantId);
    if (!destTenant) {
      throw new AppError('NOT_FOUND', '移行先テナントが見つかりません');
    }
    if (!destTenant.enabled) {
      throw new AppError('BAD_REQUEST', '移行先テナントが無効です');
    }

    const moved = await moveUserToTenant(id, destTenantId);

    return NextResponse.json(moved, { headers: { 'X-Trace-Id': context.traceId } });
  } catch (error) {
    return handleError(error, context.traceId, 'POST /api/users/:id/move');
  }
}

