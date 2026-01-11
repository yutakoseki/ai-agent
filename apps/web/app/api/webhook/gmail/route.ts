import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { handleError } from '@/lib/middleware/error';
import {
  findEmailAccountByEmailProvider,
  updateEmailAccountSyncState,
} from '@/lib/repos/emailAccountRepo';
import { syncGmailAccount } from '@/lib/mail/sync';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

type PubSubPushBody = {
  message?: {
    data?: string;
    messageId?: string;
  };
};

export async function POST(request: NextRequest) {
  const traceId = randomUUID();
  try {
    const token = process.env.GMAIL_WEBHOOK_TOKEN;
    if (token) {
      const header = request.headers.get('x-webhook-token');
      if (header !== token) {
        logger.warn('gmail webhook: unauthorized', { traceId });
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    }

    const body: PubSubPushBody = await request.json().catch(() => ({}));
    const data = body.message?.data;
    if (!data) {
      return NextResponse.json({ ok: true });
    }

    const decoded = Buffer.from(data, 'base64').toString('utf8');
    const payload = JSON.parse(decoded) as { emailAddress?: string; historyId?: string };
    if (!payload.emailAddress) {
      return NextResponse.json({ ok: true });
    }

    const lookup = await findEmailAccountByEmailProvider(payload.emailAddress, 'gmail');
    if (!lookup) {
      logger.warn('gmail webhook: account not found', {
        traceId,
        email: payload.emailAddress,
      });
      return NextResponse.json({ ok: true });
    }

    logger.info('gmail webhook: received', {
      traceId,
      email: payload.emailAddress,
      historyId: payload.historyId,
      tenantId: lookup.tenantId,
      accountId: lookup.item.id,
      messageId: body.message?.messageId,
    });

    if (!lookup.item.gmailHistoryId && payload.historyId) {
      await updateEmailAccountSyncState({
        tenantId: lookup.tenantId,
        accountId: lookup.item.id,
        gmailHistoryId: String(payload.historyId),
      });
    }

    const result = await syncGmailAccount({
      tenantId: lookup.tenantId,
      accountId: lookup.item.id,
      traceId,
    });

    logger.info('gmail webhook: sync done', {
      traceId,
      email: payload.emailAddress,
      tenantId: lookup.tenantId,
      accountId: lookup.item.id,
      processed: result.processed,
      skipped: result.skipped,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error, undefined, 'POST /api/webhook/gmail');
  }
}
