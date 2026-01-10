import { AppError } from "@shared/error";
import { logger } from "@/lib/logger";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
];

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

type GmailProfile = {
  emailAddress: string;
  historyId?: string;
  messagesTotal?: number;
  threadsTotal?: number;
};

type GmailWatchResponse = {
  historyId?: string;
  expiration?: string;
};

type GmailHistoryResponse = {
  historyId?: string;
  nextPageToken?: string;
  history?: Array<{
    id?: string;
    messages?: Array<{ id: string; threadId?: string }>;
    messagesAdded?: Array<{ message: { id: string; threadId?: string } }>;
  }>;
};

type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: { size?: number; data?: string };
  headers?: Array<{ name: string; value: string }>;
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

type GmailThread = {
  id: string;
  historyId?: string;
  messages?: GmailMessage[];
};

type GmailLabel = {
  id: string;
  name: string;
  type?: string;
};

function buildQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  return new URLSearchParams(entries as Array<[string, string]>).toString();
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.warn("gmail api error", {
      url,
      status: res.status,
      data,
    });
    throw new AppError("BAD_REQUEST", "Gmail API request failed", {
      status: res.status,
    });
  }
  return data as T;
}

export function buildGmailAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
}): string {
  const scope = (params.scopes ?? GMAIL_SCOPES).join(" ");
  const query = buildQuery({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope,
    state: params.state,
  });
  return `${GOOGLE_AUTH_BASE}?${query}`;
}

export async function exchangeGmailCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });
  return fetchJson<TokenResponse>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function refreshGmailAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: "refresh_token",
  });
  return fetchJson<TokenResponse>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function fetchGmailProfile(accessToken: string): Promise<GmailProfile> {
  return fetchJson<GmailProfile>(`${GMAIL_API_BASE}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function startGmailWatch(params: {
  accessToken: string;
  topicName: string;
  labelIds?: string[];
}): Promise<GmailWatchResponse> {
  return fetchJson<GmailWatchResponse>(`${GMAIL_API_BASE}/users/me/watch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topicName: params.topicName,
      labelIds: params.labelIds,
    }),
  });
}

export async function listGmailHistory(params: {
  accessToken: string;
  startHistoryId: string;
  pageToken?: string;
  labelId?: string;
}): Promise<GmailHistoryResponse> {
  const query = buildQuery({
    startHistoryId: params.startHistoryId,
    pageToken: params.pageToken,
    labelId: params.labelId,
    historyTypes: "messageAdded",
  });
  return fetchJson<GmailHistoryResponse>(
    `${GMAIL_API_BASE}/users/me/history?${query}`,
    {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    }
  );
}

export async function fetchGmailMessage(params: {
  accessToken: string;
  messageId: string;
}): Promise<GmailMessage> {
  const query = [
    "format=metadata",
    "metadataHeaders=Subject",
    "metadataHeaders=From",
    "metadataHeaders=To",
    "metadataHeaders=Cc",
    "metadataHeaders=Date",
  ].join("&");
  return fetchJson<GmailMessage>(
    `${GMAIL_API_BASE}/users/me/messages/${params.messageId}?${query}`,
    {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    }
  );
}

export async function fetchGmailMessageFull(params: {
  accessToken: string;
  messageId: string;
}): Promise<GmailMessage> {
  // 本文解析（AI用）。保存はせず、取得して処理したら捨てる想定。
  const query = ["format=full"].join("&");
  return fetchJson<GmailMessage>(
    `${GMAIL_API_BASE}/users/me/messages/${params.messageId}?${query}`,
    {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    }
  );
}

export async function fetchGmailThreadMetadata(params: {
  accessToken: string;
  threadId: string;
}): Promise<GmailThread> {
  const query = [
    "format=metadata",
    "metadataHeaders=Subject",
    "metadataHeaders=From",
    "metadataHeaders=To",
    "metadataHeaders=Cc",
    "metadataHeaders=Date",
  ].join("&");
  return fetchJson<GmailThread>(
    `${GMAIL_API_BASE}/users/me/threads/${params.threadId}?${query}`,
    { headers: { Authorization: `Bearer ${params.accessToken}` } }
  );
}

function decodeBase64Url(input: string): string {
  // Gmail API は base64url 形式
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectBodyText(part: GmailMessagePart | undefined): { plain?: string; html?: string } {
  if (!part) return {};
  let plain: string | undefined;
  let html: string | undefined;

  const mime = (part.mimeType ?? "").toLowerCase();
  const data = part.body?.data;
  if (data) {
    try {
      const decoded = decodeBase64Url(data);
      if (mime.startsWith("text/plain")) plain = (plain ?? "") + "\n" + decoded;
      if (mime.startsWith("text/html")) html = (html ?? "") + "\n" + decoded;
    } catch {
      // ignore decode errors
    }
  }

  for (const child of part.parts ?? []) {
    const nested = collectBodyText(child);
    if (nested.plain) plain = (plain ?? "") + "\n" + nested.plain;
    if (nested.html) html = (html ?? "") + "\n" + nested.html;
  }

  return { plain: plain?.trim() || undefined, html: html?.trim() || undefined };
}

export function extractGmailMessageBodyText(message: GmailMessage): string | undefined {
  const { plain, html } = collectBodyText(message.payload);
  if (plain && plain.trim()) return plain.trim();
  if (html && html.trim()) return stripHtml(html);
  return undefined;
}

export async function modifyGmailLabels(params: {
  accessToken: string;
  messageId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}): Promise<void> {
  await fetchJson(
    `${GMAIL_API_BASE}/users/me/messages/${params.messageId}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addLabelIds: params.addLabelIds,
        removeLabelIds: params.removeLabelIds,
      }),
    }
  );
}

export async function listGmailLabels(accessToken: string): Promise<GmailLabel[]> {
  const res = await fetchJson<{ labels?: GmailLabel[] }>(
    `${GMAIL_API_BASE}/users/me/labels`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return res.labels ?? [];
}

export async function createGmailLabel(params: {
  accessToken: string;
  name: string;
}): Promise<GmailLabel> {
  return fetchJson<GmailLabel>(`${GMAIL_API_BASE}/users/me/labels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
}

export async function updateGmailLabelName(params: {
  accessToken: string;
  labelId: string;
  name: string;
}): Promise<GmailLabel> {
  return fetchJson<GmailLabel>(`${GMAIL_API_BASE}/users/me/labels/${params.labelId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
    }),
  });
}

export function extractGmailMessageHeaders(message: GmailMessage): {
  subject?: string;
  from?: string;
  to?: string;
  cc?: string;
} {
  const headers = message.payload?.headers ?? [];
  const find = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
  return {
    subject: find("Subject"),
    from: find("From"),
    to: find("To"),
    cc: find("Cc"),
  };
}

export function collectHistoryMessageIds(history: GmailHistoryResponse): string[] {
  const ids = new Set<string>();
  for (const item of history.history ?? []) {
    for (const msg of item.messages ?? []) {
      if (msg.id) ids.add(msg.id);
    }
    for (const added of item.messagesAdded ?? []) {
      if (added.message?.id) ids.add(added.message.id);
    }
  }
  return Array.from(ids);
}
