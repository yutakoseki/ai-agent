export type TenantItem = {
  PK: `TENANT#${string}`;
  SK: `TENANT#${string}`;
  name: string;
  plan: 'Basic' | 'Pro' | 'Enterprise';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserItem = {
  PK: `TENANT#${string}`;
  SK: `USER#${string}`;
  email: string;
  role: 'Admin' | 'Manager' | 'Member';
  name?: string;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
  // indexes (single-table)
  GSI1PK?: 'USER';
  GSI1SK?: string;
  GSI2PK?: `USER#${string}`;
  GSI2SK?: `TENANT#${string}`;
};

export type AuditItem = {
  PK: `TENANT#${string}`;
  SK: `AUDIT#${string}`;
  action: string;
  resource: string;
  actorUserId: string;
  traceId?: string;
  createdAt: string;
};

export type TenantApplicationItem = {
  PK: `TENANT#${string}`;
  SK: `TENANT_APPLICATION#${string}`;
  tenantName: string;
  plan: 'Basic' | 'Pro' | 'Enterprise';
  contactEmail: string;
  contactName?: string;
  note?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  decisionNote?: string;
  decidedAt?: string;
  decidedByUserId?: string;
  createdTenantId?: string;
  createdAt: string;
  updatedAt: string;
  GSI1PK: 'TENANT_APPLICATION';
  GSI1SK: string;
};

export type EmailAccountItem = {
  PK: `TENANT#${string}`;
  SK: `EMAIL_ACCOUNT#${string}`;
  id: string;
  provider: "gmail" | "outlook";
  email: string;
  userId: string;
  status: "active" | "revoked" | "error";
  accessTokenEnc?: string;
  refreshTokenEnc?: string;
  accessTokenExpiresAt?: string;
  scope?: string[];
  labelIds?: Partial<
    Record<
      "action_required" | "information" | "sales" | "notification" | "billing_payment" | "security",
      string
    >
  >;
  watchLabelIds?: string[];
  gmailHistoryId?: string;
  gmailWatchExpiration?: string;
  createdAt: string;
  updatedAt: string;
  GSI1PK?: `EMAIL#${string}`;
  GSI1SK?: string;
  GSI2PK?: `USER#${string}`;
  GSI2SK?: string;
};

export type EmailMessageItem = {
  PK: `TENANT#${string}`;
  SK: `EMAIL_MESSAGE#${string}`;
  id: string;
  provider: "gmail" | "outlook";
  accountId: string;
  messageId: string;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  snippet?: string;
  /**
   * 画面表示用の要点スニペット（箇条書き/改行を含む場合あり）
   * - Gmail APIのsnippet(原文抜粋)は挨拶や署名が混ざりやすいので、本文から要点抽出したものを入れる
   */
  snippetSummary?: string;
  /**
   * 時系列表示用の短い要約（1〜2文程度）
   */
  timelineSummary?: string;
  /**
   * メッセージの方向（受信/送信）
   */
  direction?: "incoming" | "outgoing" | "unknown";
  receivedAt?: string;
  internalDate?: string;
  labelIds?: string[];
  category?: "action_required" | "information" | "sales" | "notification" | "billing_payment" | "security";
  needsAction?: boolean;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
  // indexes (single-table)
  GSI2PK?: string;
  GSI2SK?: string;
};

export type TaskItem = {
  PK: `TENANT#${string}`;
  SK: `TASK#${string}`;
  id: string;
  userId: string;
  accountId?: string;
  category?: "action_required" | "information" | "sales" | "notification" | "billing_payment" | "security";
  from?: string;
  counterparty?: string;
  title: string;
  summary?: string;
  nextAction?: string;
  dueAt?: string;
  status: "open" | "in_progress" | "done" | "archived";
  sourceProvider?: "gmail" | "outlook";
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
};

export type UserEmailAccountSubscriptionItem = {
  PK: `TENANT#${string}`;
  SK: `USER_EMAIL_SUB#USER#${string}#ACCOUNT#${string}`;
  tenantId?: never;
  userId: string;
  accountId: string;
  monitoringEnabled: boolean;
  pushEnabled: boolean;
  role: "owner" | "member";
  createdAt: string;
  updatedAt: string;
  // indexes (single-table)
  GSI2PK?: `USER#${string}#EMAIL_SUB`;
  GSI2SK?: `ACCOUNT#${string}`;
};

export type PushSubscriptionItem = {
  PK: `TENANT#${string}`;
  SK: `PUSH_SUB#${string}`;
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime?: number;
  createdAt: string;
  updatedAt: string;
  GSI2PK?: `USER#${string}#PUSH`;
  GSI2SK?: string;
};

export type RssSourceItem = {
  PK: `TENANT#${string}`;
  SK: `RSS_SOURCE#${string}`;
  id: string;
  userId: string;
  url: string;
  normalizedUrl: string;
  status: "active" | "disabled" | "error";
  title?: string;
  etag?: string;
  lastModified?: string;
  lastFetchedAt?: string;
  nextFetchAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  GSI2PK?: `USER#${string}#RSS_SOURCE`;
  GSI2SK?: string;
};

export type RssItem = {
  PK: `TENANT#${string}`;
  SK: `RSS_ITEM#${string}`;
  id: string;
  sourceId: string;
  userId: string;
  title: string;
  url: string;
  guid?: string;
  fingerprint: string;
  publishedAt?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: number;
  GSI1PK?: `RSS_SOURCE#${string}`;
  GSI1SK?: string;
};

export type RssDraftItem = {
  PK: `TENANT#${string}`;
  SK: `RSS_DRAFT#${string}`;
  id: string;
  userId: string;
  sourceId: string;
  sourceTitle?: string;
  itemId: string;
  itemTitle: string;
  itemUrl: string;
  target: "blog" | "x";
  title?: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: number;
  GSI2PK?: `USER#${string}#RSS_DRAFT`;
  GSI2SK?: string;
};

export type RssUsageItem = {
  PK: `TENANT#${string}`;
  SK: `RSS_USAGE#USER#${string}#DATE#${string}`;
  userId: string;
  date: string;
  summariesUsed: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: number;
};

export type XPostBatchItem = {
  PK: `TENANT#${string}`;
  SK: `X_POST_BATCH#${string}`;
  id: string;
  userId: string;
  date: string;
  payloadJson: string;
  posted?: Array<{
    rank: number;
    tweetId: string;
    postedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  GSI2PK?: `USER#${string}#X_POST_BATCH`;
  GSI2SK?: string;
};

export type XAccountItem = {
  PK: `TENANT#${string}`;
  SK: `X_ACCOUNT#USER#${string}`;
  userId: string;
  status: "pending" | "connected";
  requestToken?: string;
  requestTokenSecretEnc?: string;
  requestTokenExpiresAt?: string;
  accessTokenEnc?: string;
  accessTokenSecretEnc?: string;
  xUserId?: string;
  screenName?: string;
  createdAt: string;
  updatedAt: string;
};
