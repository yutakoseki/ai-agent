import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { getEmailAccountItem, updateEmailAccountSyncState } from "@/lib/repos/emailAccountRepo";
import { decryptSecret, encryptSecret } from "@/lib/mail/tokenVault";
import { refreshGmailAccessToken, fetchGmailMessageFull, extractGmailMessageBodyText } from "@/lib/mail/gmail";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type ChatRequest = {
  accountId: string;
  messageId: string;
  question: string;
};

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

export async function POST(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const body: ChatRequest = await request.json().catch(() => ({}));
    const accountId = String(body?.accountId ?? "").trim();
    const messageId = String(body?.messageId ?? "").trim();
    const question = String(body?.question ?? "").trim();

    if (!accountId || !messageId || !question) {
      throw new AppError("BAD_REQUEST", "accountId/messageId/question は必須です");
    }

    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) throw new AppError("BAD_REQUEST", "OPENAI_API_KEY が未設定です");
    const model = process.env.OPENAI_MODEL || "gpt-5.2";

    const { accessToken, account } = await getAccessTokenForGmailAccount({
      tenantId: context.session.tenantId,
      accountId,
    });
    if (account.userId !== context.session.userId) {
      throw new AppError("FORBIDDEN", "この受信箱にアクセスできません");
    }

    const full = await fetchGmailMessageFull({ accessToken, messageId });
    const bodyText = extractGmailMessageBodyText(full) ?? "";

    const prompt = [
      "あなたはメール対応を支援するアシスタントです。",
      "ユーザーの質問に対して、メール本文の内容を根拠に、簡潔に答えてください。",
      "不明な点は推測せず、追加で確認すべき情報を質問してください。",
    ].join("\n");

    const input = JSON.stringify({
      mailbox: account.email,
      messageId,
      bodyText: bodyText.slice(0, 12000),
      question,
    });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: input },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.warn("openai chat failed", { status: res.status, data });
      throw new AppError("BAD_REQUEST", "AIの呼び出しに失敗しました");
    }
    const answer = String(data?.choices?.[0]?.message?.content ?? "").trim();

    return NextResponse.json(
      { answer },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/mail/chat");
  }
}


