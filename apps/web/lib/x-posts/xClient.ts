import { createHmac, randomBytes } from "crypto";
import { AppError } from "@shared/error";
import { logger } from "@/lib/logger";

const API_BASE = "https://api.twitter.com/2/tweets";

function percentEncode(input: string): string {
  return encodeURIComponent(input)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function createNonce(): string {
  return randomBytes(16).toString("hex");
}

function buildSignature(params: Record<string, string>, method: string, baseUrl: string, key: string) {
  const sorted = Object.entries(params).sort(([aKey, aVal], [bKey, bVal]) => {
    if (aKey === bKey) return aVal.localeCompare(bVal);
    return aKey.localeCompare(bKey);
  });
  const parameterString = sorted
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");
  const baseString = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(parameterString),
  ].join("&");
  return createHmac("sha1", key).update(baseString).digest("base64");
}

function buildOAuthHeader(params: Record<string, string>): string {
  const header = Object.entries(params)
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(", ");
  return `OAuth ${header}`;
}

function getXCredentials() {
  const consumerKey = process.env.X_API_KEY || "";
  const consumerSecret = process.env.X_API_SECRET || "";
  const accessToken = process.env.X_ACCESS_TOKEN || "";
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET || "";

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    throw new AppError("BAD_REQUEST", "X API の認証情報が未設定です");
  }

  return { consumerKey, consumerSecret, accessToken, accessTokenSecret };
}

export async function postTweet(params: {
  text: string;
  traceId?: string;
  replyToTweetId?: string;
}): Promise<{ id: string; text: string }> {
  const { consumerKey, consumerSecret, accessToken, accessTokenSecret } = getXCredentials();
  const text = String(params.text ?? "").trim();
  if (!text) {
    throw new AppError("BAD_REQUEST", "投稿本文が空です");
  }

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: createNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = buildSignature(oauthParams, "POST", API_BASE, signingKey);
  const authHeader = buildOAuthHeader({ ...oauthParams, oauth_signature: signature });

  const body: Record<string, unknown> = { text };
  if (params.replyToTweetId) {
    body.reply = { in_reply_to_tweet_id: params.replyToTweetId };
  }

  const startedAt = Date.now();
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.warn("x post failed", {
      traceId: params.traceId,
      status: res.status,
      durationMs: Date.now() - startedAt,
      message: data?.detail ?? data?.title ?? data?.error ?? null,
    });
    throw new AppError("BAD_REQUEST", "Xへの投稿に失敗しました");
  }

  const id = String(data?.data?.id ?? "").trim();
  const postedText = String(data?.data?.text ?? text).trim();
  if (!id) {
    throw new AppError("BAD_REQUEST", "Xの投稿IDが取得できませんでした");
  }
  return { id, text: postedText };
}
