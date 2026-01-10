import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { getTaskById } from "@/lib/repos/taskRepo";
import { getEmailMessageItem } from "@/lib/repos/emailMessageRepo";
import { getEmailAccountItem, updateEmailAccountSyncState } from "@/lib/repos/emailAccountRepo";
import { decryptSecret, encryptSecret } from "@/lib/mail/tokenVault";
import { refreshGmailAccessToken, fetchGmailMessageFull, extractGmailMessageBodyText } from "@/lib/mail/gmail";

export const runtime = "nodejs";

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return true;
  return Date.now() >= new Date(expiresAt).getTime() - 60_000;
}

async function getAccessTokenForGmailAccount(params: { tenantId: string; accountId: string }) {
  const account = await getEmailAccountItem(params.tenantId, params.accountId);
  if (!account) throw new AppError("NOT_FOUND", "受信箱が見つかりません");
  if (account.provider !== "gmail") throw new AppError("BAD_REQUEST", "Gmail以外は未対応です");

  let accessTokenEnc = account.accessTokenEnc;
  let accessToken = accessTokenEnc ? decryptSecret(accessTokenEnc) : "";
  let accessTokenExpiresAt = account.accessTokenExpiresAt;
  let refreshTokenEnc = account.refreshTokenEnc;

  if (!accessToken || isExpired(accessTokenExpiresAt)) {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) {
      throw new AppError("INTERNAL_ERROR", "Google OAuth credentials are missing");
    }
    const refreshToken = refreshTokenEnc ? decryptSecret(refreshTokenEnc) : "";
    if (!refreshToken) throw new AppError("BAD_REQUEST", "Refresh token is missing");

    const refreshed = await refreshGmailAccessToken({ clientId, clientSecret, refreshToken });
    if (!refreshed.access_token) {
      throw new AppError("BAD_REQUEST", "アクセストークンの更新に失敗しました");
    }
    accessToken = refreshed.access_token;
    accessTokenEnc = encryptSecret(refreshed.access_token);
    accessTokenExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      : undefined;
    if (refreshed.refresh_token) refreshTokenEnc = encryptSecret(refreshed.refresh_token);

    await updateEmailAccountSyncState({
      tenantId: params.tenantId,
      accountId: params.accountId,
      accessTokenEnc,
      refreshTokenEnc,
      accessTokenExpiresAt,
    });
  }

  return { accessToken, account };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;
    const messageKey = request.nextUrl.searchParams.get("messageKey");
    if (!id || !messageKey) throw new AppError("BAD_REQUEST", "id/messageKeyが不正です");

    const task = await getTaskById(context.session.tenantId, id);
    if (!task) throw new AppError("NOT_FOUND", "タスクが見つかりません");
    if (task.userId !== context.session.userId) {
      throw new AppError("FORBIDDEN", "このタスクを表示する権限がありません");
    }

    const stored = await getEmailMessageItem(context.session.tenantId, messageKey);
    if (!stored) throw new AppError("NOT_FOUND", "メールが見つかりません");
    if (stored.taskId !== task.id) {
      throw new AppError("FORBIDDEN", "このメールを表示する権限がありません");
    }

    if (stored.provider !== "gmail") throw new AppError("BAD_REQUEST", "Gmail以外は未対応です");
    const { accessToken } = await getAccessTokenForGmailAccount({
      tenantId: context.session.tenantId,
      accountId: stored.accountId,
    });
    const full = await fetchGmailMessageFull({ accessToken, messageId: stored.messageId });
    const mailBodyText = extractGmailMessageBodyText(full) ?? null;

    return NextResponse.json(
      {
        emailMessage: {
          provider: stored.provider,
          accountId: stored.accountId,
          messageId: stored.messageId,
          threadId: stored.threadId ?? null,
          subject: stored.subject ?? null,
          from: stored.from ?? null,
          to: stored.to ?? null,
          cc: stored.cc ?? null,
          snippet: stored.snippet ?? null,
          receivedAt: stored.receivedAt ?? null,
        },
        mailBodyText,
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/tasks/:id/message");
  }
}


