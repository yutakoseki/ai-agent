export type EmailProvider = 'gmail' | 'outlook';

export type MailCategory =
  | 'action_required'
  | 'information'
  | 'sales'
  | 'notification'
  | 'billing_payment'
  | 'security';

export type MailLabelIds = Partial<Record<MailCategory, string>>;

export interface EmailAccount {
  id: string;
  tenantId: string;
  userId: string;
  provider: EmailProvider;
  email: string;
  status: 'active' | 'revoked' | 'error';
  labelIds?: MailLabelIds;
  watchLabelIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MailMessage {
  id: string;
  tenantId: string;
  accountId: string;
  provider: EmailProvider;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string[];
  snippet?: string;
  receivedAt?: Date;
  category?: MailCategory;
  needsAction?: boolean;
  taskId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'archived';

export interface Task {
  id: string;
  tenantId: string;
  userId: string;
  /**
   * このタスクがどの受信箱（EmailAccount）由来か。
   * - 複数受信箱を扱う場合のフィルタ/表示/通知制御に使う
   * - 既存データ互換のため optional
   */
  accountId?: string;
  /**
   * どのカテゴリ（ラベル）に分類されたか。既存データ互換のため optional。
   */
  category?: MailCategory;
  /**
   * 差出人（メールヘッダの From）。既存データ互換のため optional。
   */
  from?: string;
  /**
   * UI表示用の「相手」（スレッド内で固定したい表示名）。
   * - 返信メールのFromが自分になるケースでも、ここを表示に使う。
   * - 既存データ互換のため optional
   */
  counterparty?: string;
  title: string;
  summary?: string;
  nextAction?: string;
  dueAt?: Date;
  status: TaskStatus;
  sourceProvider?: EmailProvider;
  sourceMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserEmailAccountSubscription {
  tenantId: string;
  userId: string;
  accountId: string;
  monitoringEnabled: boolean;
  pushEnabled: boolean;
  role: 'owner' | 'member';
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskCreateRequest {
  title: string;
  summary?: string;
  nextAction?: string;
  dueAt?: string;
  sourceProvider?: EmailProvider;
  sourceMessageId?: string;
}

export interface TaskUpdateRequest {
  title?: string;
  summary?: string;
  nextAction?: string;
  dueAt?: string | null;
  status?: TaskStatus;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
}

export interface PushSubscriptionRequest {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}
