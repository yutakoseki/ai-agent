import { getItem, putItem, queryGSI2, updateItem } from "@db/tenant-client";
import type { EmailMessageItem } from "@db/types";

const EMAIL_MESSAGE_PREFIX = "EMAIL_MESSAGE#";

export function buildEmailMessageId(
  provider: EmailMessageItem["provider"],
  messageId: string
): string {
  return `${provider}#${messageId}`;
}

export async function getEmailMessageItem(
  tenantId: string,
  messageKey: string
): Promise<EmailMessageItem | null> {
  return getItem<EmailMessageItem>(tenantId, `${EMAIL_MESSAGE_PREFIX}${messageKey}`);
}

export async function createEmailMessageIfNotExists(
  tenantId: string,
  item: Omit<EmailMessageItem, "PK" | "SK">
): Promise<boolean> {
  try {
    await putItem(tenantId, `${EMAIL_MESSAGE_PREFIX}${item.id}`, item as any);
    return true;
  } catch (error: any) {
    const name = error && typeof error === "object" ? String(error.name) : "";
    if (name === "ConditionalCheckFailedException") {
      return false;
    }
    throw error;
  }
}

export async function updateEmailMessageTaskLink(params: {
  tenantId: string;
  messageKey: string;
  taskId: string;
  timelineSummary?: string;
  direction?: "incoming" | "outgoing" | "unknown";
  receivedAt?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const sets: string[] = ["taskId = :taskId", "updatedAt = :updatedAt"];
  const values: Record<string, unknown> = {
    ":taskId": params.taskId,
    ":updatedAt": now,
  };

  // タイムライン取得用（taskId で逆引き）
  sets.push("GSI2PK = :gsi2pk");
  values[":gsi2pk"] = `TASK#${params.taskId}#EMAIL_MSG`;
  // receivedAt が無い場合でも並び順を安定させる
  const sk = `${(params.receivedAt ?? now) as string}#${params.messageKey}`;
  sets.push("GSI2SK = :gsi2sk");
  values[":gsi2sk"] = sk;

  if (params.timelineSummary !== undefined) {
    sets.push("timelineSummary = :timelineSummary");
    values[":timelineSummary"] = params.timelineSummary || null;
  }
  if (params.direction !== undefined) {
    sets.push("direction = :direction");
    values[":direction"] = params.direction;
  }

  await updateItem(
    params.tenantId,
    `${EMAIL_MESSAGE_PREFIX}${params.messageKey}`,
    `SET ${sets.join(", ")}`,
    values
  );
}

export async function listEmailMessagesByTaskId(params: {
  taskId: string;
}): Promise<EmailMessageItem[]> {
  return queryGSI2<EmailMessageItem>(`TASK#${params.taskId}#EMAIL_MSG`);
}

