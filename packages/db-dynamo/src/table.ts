export const BASE_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "aiagent-dev";

export type TableKind =
  | "main"
  | "tenants"
  | "users"
  | "tenant_applications"
  | "permission_policies"
  | "user_preferences"
  | "email_accounts"
  | "email_messages"
  | "tasks"
  | "user_email_subscriptions"
  | "push_subscriptions"
  | "announcements"
  | "notices"
  | "rss_sources"
  | "rss_items"
  | "rss_drafts"
  | "rss_usage";

/**
 * マルチテーブル移行用のテーブル名解決。
 * - 役割ごとのテーブル（`${BASE}-${kind}`）。`main` は従来互換のため BASE を返す。
 */
export function getTableName(kind: TableKind): string {
  if (kind === "main") return BASE_TABLE_NAME;
  return `${BASE_TABLE_NAME}-${kind}`;
}

// backward compatibility: 既存コードが参照しているため残す
export const TABLE_NAME = BASE_TABLE_NAME;

export const GSI1_NAME = "GSI1";
export const GSI2_NAME = "GSI2";



