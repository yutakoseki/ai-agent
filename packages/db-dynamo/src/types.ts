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
