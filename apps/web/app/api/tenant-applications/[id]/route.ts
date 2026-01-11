// テナント申請の承認/却下（Admin専用）

import { NextRequest, NextResponse } from 'next/server';
import type {
  ReviewTenantApplicationRequest,
  UpdateTenantApplicationRequest,
} from '@shared/tenantApplication';
import { AppError } from '@shared/error';
import { requireAuth, requireRole } from '@/lib/middleware/auth';
import { handleError } from '@/lib/middleware/error';
import { requireCsrf } from '@/lib/middleware/csrf';
import { createTenant } from '@/lib/repos/tenantRepo';
import {
  findTenantApplicationById,
  reviewTenantApplication,
  updateTenantApplication,
} from '@/lib/repos/tenantApplicationRepo';
import { writeAuditLog } from '@/lib/audit';
import { randomBytes } from 'crypto';
import { createCognitoUser, deleteCognitoUser } from '@/lib/auth/cognito';
import { hashPassword } from '@/lib/auth/password';
import { createUser } from '@/lib/repos/userRepo';
import {
  sendTenantApplicationApprovedEmail,
  sendTenantApplicationRejectedEmail,
} from '@/lib/notifications/tenantApplicationDecisionEmails';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

function generateInitialPassword(): string {
  // Cognitoの一般的なパスワード要件（大文字/小文字/数字）を満たす強めの初期パスワード
  const buf = randomBytes(18).toString('base64url'); // URL安全
  return `Aa1${buf}`; // 先頭で要件を確実に満たす
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const roleError = requireRole(context.session, ['Admin'], context.traceId);
    if (roleError) return roleError;

    const { id } = await params;
    const body: ReviewTenantApplicationRequest = await request.json();

    if (!body?.decision || !['approve', 'reject'].includes(body.decision)) {
      throw new AppError('BAD_REQUEST', 'decision は approve または reject を指定してください');
    }
    if (body.decision === 'reject') {
      const note = (body.decisionNote ?? '').trim();
      if (!note) {
        throw new AppError('BAD_REQUEST', '却下理由（decisionNote）は必須です');
      }
    }

    const current = await findTenantApplicationById(id);
    if (!current) {
      throw new AppError('NOT_FOUND', 'テナント申請が見つかりません');
    }

    let createdTenantId: string | undefined;
    let initialPassword: string | undefined;
    let createdUserSub: string | undefined;
    if (body.decision === 'approve') {
      const tenant = await createTenant({
        name: current.tenantName,
        plan: current.plan,
      });
      createdTenantId = tenant.id;

      // 申請者のアカウント（Manager）を自動作成
      initialPassword = generateInitialPassword();
      const displayName = current.contactName || 'Manager';
      const cognitoUser = await createCognitoUser(
        current.contactEmail,
        initialPassword,
        displayName
      );
      createdUserSub = cognitoUser.sub;

      try {
        const passwordHash = await hashPassword(initialPassword);
        await createUser(
          createdTenantId,
          {
            email: current.contactEmail,
            password: initialPassword,
            role: 'Manager',
            name: displayName,
          },
          passwordHash,
          createdUserSub
        );
      } catch (error) {
        // best-effort cleanup: Cognitoユーザーを削除
        try {
          await deleteCognitoUser(current.contactEmail);
        } catch {
          // ignore
        }
        throw error;
      }
    }

    const updated = await reviewTenantApplication({
      id,
      decision: body.decision,
      decisionNote: body.decisionNote?.trim() || undefined,
      decidedByUserId: context.session.userId,
      createdTenantId,
    });

    // 申請者への結果メール（best-effort）
    try {
      const origin = request.nextUrl.origin;
      if (body.decision === 'reject') {
        await sendTenantApplicationRejectedEmail({
          application: updated,
          decisionNote: (body.decisionNote ?? '').trim(),
          origin,
        });
      } else if (body.decision === 'approve' && createdTenantId && initialPassword) {
        await sendTenantApplicationApprovedEmail({
          application: updated,
          tenantId: createdTenantId,
          loginEmail: current.contactEmail,
          password: initialPassword,
          decisionNote: body.decisionNote?.trim() || undefined,
          origin,
        });
      }
    } catch (error) {
      logger.warn('tenantApplication decision email unexpected failure', {
        traceId: context.traceId,
        applicationId: id,
        error,
      });
    }

    writeAuditLog({
      action: 'tenantApplication.review',
      result: 'success',
      actorUserId: context.session.userId,
      tenantId: context.session.tenantId,
      traceId: context.traceId,
      target: { applicationId: id, decision: body.decision, createdTenantId },
      metadata: { path: '/api/tenant-applications/:id', method: 'PATCH' },
    });

    return NextResponse.json(updated, {
      headers: { 'X-Trace-Id': context.traceId },
    });
  } catch (error) {
    writeAuditLog({
      action: 'tenantApplication.review',
      result: 'failure',
      actorUserId: context.session.userId,
      tenantId: context.session.tenantId,
      traceId: context.traceId,
      metadata: { path: '/api/tenant-applications/:id', method: 'PATCH' },
      reason: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'unknown error',
    });

    return handleError(error, context.traceId, 'PATCH /api/tenant-applications/:id');
  }
}

// 申請内容の編集（Admin専用 / Pendingのみ）
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const roleError = requireRole(context.session, ['Admin'], context.traceId);
    if (roleError) return roleError;

    const { id } = await params;
    const body: UpdateTenantApplicationRequest = await request.json();

    const trimmed: UpdateTenantApplicationRequest = {
      tenantName: body.tenantName?.trim(),
      plan: body.plan,
      contactEmail: body.contactEmail?.trim(),
      contactName: body.contactName?.trim(),
      note: body.note?.trim(),
    };

    // 空文字は「未設定」に寄せる（note/contactNameなど）
    if (trimmed.contactName === '') trimmed.contactName = undefined;
    if (trimmed.note === '') trimmed.note = undefined;

    // tenantName/contactEmailは空にできない
    if (trimmed.tenantName !== undefined && trimmed.tenantName.length === 0) {
      throw new AppError('BAD_REQUEST', 'テナント名は空にできません');
    }
    if (trimmed.contactEmail !== undefined && trimmed.contactEmail.length === 0) {
      throw new AppError('BAD_REQUEST', '連絡先メールは空にできません');
    }

    const updated = await updateTenantApplication({ id, input: trimmed });

    writeAuditLog({
      action: 'tenantApplication.update',
      result: 'success',
      actorUserId: context.session.userId,
      tenantId: context.session.tenantId,
      traceId: context.traceId,
      target: { applicationId: id },
      metadata: { path: '/api/tenant-applications/:id', method: 'PUT' },
    });

    return NextResponse.json(updated, { headers: { 'X-Trace-Id': context.traceId } });
  } catch (error) {
    writeAuditLog({
      action: 'tenantApplication.update',
      result: 'failure',
      actorUserId: context.session.userId,
      tenantId: context.session.tenantId,
      traceId: context.traceId,
      metadata: { path: '/api/tenant-applications/:id', method: 'PUT' },
      reason: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return handleError(error, context.traceId, 'PUT /api/tenant-applications/:id');
  }
}