import { AppError } from "@shared/error";
import { logger } from "@/lib/logger";
import { buildOAuthHeader, buildSignature, createNonce, percentEncode } from "./oauth1";

const REQUEST_TOKEN_URL = "https://api.twitter.com/oauth/request_token";
const ACCESS_TOKEN_URL = "https://api.twitter.com/oauth/access_token";
const AUTHORIZE_URL = "https://api.twitter.com/oauth/authorize";

function getXAppCredentials() {
  const consumerKey = process.env.X_API_KEY || "";
  const consumerSecret = process.env.X_API_SECRET || "";
  if (!consumerKey || !consumerSecret) {
    throw new AppError("BAD_REQUEST", "X API の認証情報が未設定です");
  }
  return { consumerKey, consumerSecret };
}

function parseFormEncoded(payload: string): Record<string, string> {
  const params = new URLSearchParams(payload);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

export async function requestXRequestToken(params: {
  callbackUrl: string;
  traceId?: string;
}): Promise<{ oauthToken: string; oauthTokenSecret: string }> {
  const { consumerKey, consumerSecret } = getXAppCredentials();
  const oauthParams: Record<string, string> = {
    oauth_callback: params.callbackUrl,
    oauth_consumer_key: consumerKey,
    oauth_nonce: createNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };

  const signingKey = `${percentEncode(consumerSecret)}&`;
  const signature = buildSignature(oauthParams, "POST", REQUEST_TOKEN_URL, signingKey);
  const authHeader = buildOAuthHeader({ ...oauthParams, oauth_signature: signature });

  const startedAt = Date.now();
  const res = await fetch(REQUEST_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: authHeader },
  });
  const text = await res.text();
  if (!res.ok) {
    logger.warn("x oauth request token failed", {
      traceId: params.traceId,
      status: res.status,
      durationMs: Date.now() - startedAt,
      body: text.slice(0, 500),
    });
    throw new AppError("BAD_REQUEST", "Xの認証開始に失敗しました");
  }

  const parsed = parseFormEncoded(text);
  if (parsed.oauth_callback_confirmed !== "true") {
    throw new AppError("BAD_REQUEST", "Xの認証開始に失敗しました");
  }
  if (!parsed.oauth_token || !parsed.oauth_token_secret) {
    throw new AppError("BAD_REQUEST", "Xの認証トークンが取得できませんでした");
  }
  return { oauthToken: parsed.oauth_token, oauthTokenSecret: parsed.oauth_token_secret };
}

export function buildXAuthorizeUrl(oauthToken: string): string {
  return `${AUTHORIZE_URL}?oauth_token=${encodeURIComponent(oauthToken)}`;
}

export async function exchangeXAccessToken(params: {
  oauthToken: string;
  oauthVerifier: string;
  requestTokenSecret: string;
  traceId?: string;
}): Promise<{
  accessToken: string;
  accessTokenSecret: string;
  userId?: string;
  screenName?: string;
}> {
  const { consumerKey, consumerSecret } = getXAppCredentials();
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_token: params.oauthToken,
    oauth_verifier: params.oauthVerifier,
    oauth_nonce: createNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(
    params.requestTokenSecret
  )}`;
  const signature = buildSignature(oauthParams, "POST", ACCESS_TOKEN_URL, signingKey);
  const authHeader = buildOAuthHeader({ ...oauthParams, oauth_signature: signature });

  const startedAt = Date.now();
  const res = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: authHeader },
  });
  const text = await res.text();
  if (!res.ok) {
    logger.warn("x oauth access token failed", {
      traceId: params.traceId,
      status: res.status,
      durationMs: Date.now() - startedAt,
      body: text.slice(0, 500),
    });
    throw new AppError("BAD_REQUEST", "Xの認証に失敗しました");
  }

  const parsed = parseFormEncoded(text);
  if (!parsed.oauth_token || !parsed.oauth_token_secret) {
    throw new AppError("BAD_REQUEST", "Xのアクセストークンが取得できませんでした");
  }
  return {
    accessToken: parsed.oauth_token,
    accessTokenSecret: parsed.oauth_token_secret,
    userId: parsed.user_id,
    screenName: parsed.screen_name,
  };
}
