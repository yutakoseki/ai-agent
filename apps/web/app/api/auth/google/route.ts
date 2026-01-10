import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@shared/error';
import { requireAuth } from '@/lib/middleware/auth';
import { handleError } from '@/lib/middleware/error';
import {
  buildGmailAuthUrl,
  exchangeGmailCode,
  fetchGmailProfile,
  startGmailWatch,
} from '@/lib/mail/gmail';
import { createOAuthState, verifyOAuthState } from '@/lib/mail/oauthState';
import { encryptSecret } from '@/lib/mail/tokenVault';
import { findEmailAccountByEmailProvider, upsertEmailAccount } from '@/lib/repos/emailAccountRepo';
import { upsertUserEmailSubscription } from '@/lib/repos/userEmailSubscriptionRepo';
import type { MailCategory } from '@shared/mail';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// ラベルは同期時に必要になったカテゴリだけ遅延作成する（OAuth時に全作成しない）
// ここでは labelIds はセットしない（=必要になったときに追加される）
const _KEEP_MAILCATEGORY_IMPORT_FOR_TYPECHECK: MailCategory | null = null;

function normalizeGmailWatchExpiration(input: string | undefined): string | undefined {
  if (!input) return undefined;
  // Gmail API は expiration を Unix epoch ms の文字列で返すことがある
  if (/^\d+$/.test(input)) {
    const ms = Number(input);
    if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString();
  }
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return input;
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const stateParam = request.nextUrl.searchParams.get('state');

    if (!code) {
      const { context, response } = await requireAuth(request);
      if (response) return response;

      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const redirectUri =
        process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/google`;
      if (!clientId) {
        throw new AppError('INTERNAL_ERROR', 'Google client ID is missing');
      }

      const redirectParam = request.nextUrl.searchParams.get('redirect') ?? undefined;
      const redirect = redirectParam && redirectParam.startsWith('/') ? redirectParam : undefined;
      const state = await createOAuthState({
        tenantId: context.session.tenantId,
        userId: context.session.userId,
        provider: 'gmail',
        redirect,
      });

      const authUrl = buildGmailAuthUrl({
        clientId,
        redirectUri,
        state,
      });
      return NextResponse.redirect(authUrl);
    }

    if (!stateParam) {
      throw new AppError('BAD_REQUEST', 'stateが不正です');
    }

    const state = await verifyOAuthState(stateParam);
    if (!state || state.provider !== 'gmail') {
      throw new AppError('BAD_REQUEST', 'stateが不正です');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/google`;
    if (!clientId || !clientSecret) {
      throw new AppError('INTERNAL_ERROR', 'Google OAuth credentials are missing');
    }

    const token = await exchangeGmailCode({
      clientId,
      clientSecret,
      redirectUri,
      code,
    });
    if (!token.access_token) {
      throw new AppError('BAD_REQUEST', 'アクセストークンの取得に失敗しました');
    }

    const profile = await fetchGmailProfile(token.access_token);
    if (!profile.emailAddress) {
      throw new AppError('BAD_REQUEST', 'メールアドレスを取得できませんでした');
    }

    const existing = await findEmailAccountByEmailProvider(profile.emailAddress, 'gmail');
    if (existing && existing.tenantId !== state.tenantId) {
      throw new AppError('FORBIDDEN', '別テナントで既に使用されているアカウントです');
    }

    // NOTE: ラベルは同期時に必要なカテゴリのみ作成する

    let watchHistoryId: string | undefined = profile.historyId;
    let watchExpiration: string | undefined;
    const topicName = process.env.GMAIL_PUBSUB_TOPIC || '';
    const watchLabelIds = process.env.GMAIL_WATCH_LABEL_IDS
      ? process.env.GMAIL_WATCH_LABEL_IDS.split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : ['INBOX', 'SENT'];

    if (topicName) {
      const watch = await startGmailWatch({
        accessToken: token.access_token,
        topicName,
        labelIds: watchLabelIds,
      });
      watchHistoryId = watch.historyId ?? watchHistoryId;
      watchExpiration = normalizeGmailWatchExpiration(watch.expiration);
    }

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : undefined;

    const account = await upsertEmailAccount({
      tenantId: state.tenantId,
      userId: state.userId,
      provider: 'gmail',
      email: profile.emailAddress,
      accountId: existing?.item?.id,
      accessTokenEnc: encryptSecret(token.access_token),
      refreshTokenEnc: token.refresh_token
        ? encryptSecret(token.refresh_token)
        : existing?.item.refreshTokenEnc,
      accessTokenExpiresAt: expiresAt,
      scope: token.scope ? token.scope.split(' ') : undefined,
      watchLabelIds,
      gmailHistoryId: watchHistoryId,
      gmailWatchExpiration: watchExpiration,
      status: 'active',
    });

    // SaaS（個人の複数受信箱）: 受信箱の購読（監視/通知）をユーザー単位で保持
    // ※ 共有受信箱は後で。MVPでは接続した本人を owner として購読を作る。
    await upsertUserEmailSubscription({
      tenantId: state.tenantId,
      userId: state.userId,
      accountId: account.id,
      monitoringEnabled: true,
      pushEnabled: true,
      role: 'owner',
    });

    const redirectPath = state.redirect ?? '/tasks';
    return NextResponse.redirect(`${request.nextUrl.origin}${redirectPath}`);
  } catch (error) {
    return handleError(error, undefined, 'GET /api/auth/google');
  }
}
