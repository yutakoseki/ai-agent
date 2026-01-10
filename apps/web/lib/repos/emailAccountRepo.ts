import { randomUUID } from "crypto";
import type { EmailAccount, MailLabelIds } from "@shared/mail";
import { getItem, putItem, queryGSI1, queryGSI2, updateItem } from "@db/tenant-client";
import type { EmailAccountItem } from "@db/types";

const EMAIL_ACCOUNT_PREFIX = "EMAIL_ACCOUNT#";
const EMAIL_GSI_PREFIX = "EMAIL#";

export type EmailAccountLookup = {
  tenantId: string;
  item: EmailAccountItem;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapAccount(item: EmailAccountItem): EmailAccount {
  return {
    id: item.id,
    tenantId: item.PK.replace("TENANT#", ""),
    userId: item.userId,
    provider: item.provider,
    email: item.email,
    status: item.status,
    labelIds: item.labelIds,
    watchLabelIds: item.watchLabelIds,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

export async function getEmailAccountItem(
  tenantId: string,
  accountId: string
): Promise<EmailAccountItem | null> {
  return getItem<EmailAccountItem>(tenantId, `${EMAIL_ACCOUNT_PREFIX}${accountId}`);
}

export async function findEmailAccountByEmailProvider(
  email: string,
  provider: EmailAccountItem["provider"]
): Promise<EmailAccountLookup | null> {
  const normalized = normalizeEmail(email);
  const items = await queryGSI1<EmailAccountItem>(
    `${EMAIL_GSI_PREFIX}${normalized}`,
    `PROVIDER#${provider}#`
  );
  const item = items[0];
  if (!item) return null;
  return {
    tenantId: item.PK.replace("TENANT#", ""),
    item,
  };
}

export async function listEmailAccountsByUser(
  userId: string
): Promise<EmailAccount[]> {
  // GSI2PK が USER#<userId> のレコードは他エンティティ（User等）とも衝突し得るため、
  // EmailAccount のみを GSI2SK プレフィックスで絞り込む。
  const items = await queryGSI2<EmailAccountItem>(`USER#${userId}`, "EMAIL_ACCOUNT#");
  return items.map(mapAccount);
}

export async function upsertEmailAccount(params: {
  tenantId: string;
  userId: string;
  provider: EmailAccountItem["provider"];
  email: string;
  accessTokenEnc?: string;
  refreshTokenEnc?: string;
  accessTokenExpiresAt?: string;
  scope?: string[];
  labelIds?: MailLabelIds;
  watchLabelIds?: string[];
  gmailHistoryId?: string;
  gmailWatchExpiration?: string;
  status?: EmailAccountItem["status"];
  accountId?: string;
}): Promise<EmailAccount> {
  const now = new Date().toISOString();
  const id = params.accountId ?? randomUUID();
  const normalized = normalizeEmail(params.email);
  const sk = `${EMAIL_ACCOUNT_PREFIX}${id}`;

  try {
    await putItem(params.tenantId, sk, {
      id,
      provider: params.provider,
      email: normalized,
      userId: params.userId,
      status: params.status ?? "active",
      accessTokenEnc: params.accessTokenEnc,
      refreshTokenEnc: params.refreshTokenEnc,
      accessTokenExpiresAt: params.accessTokenExpiresAt,
      scope: params.scope,
      labelIds: params.labelIds,
      watchLabelIds: params.watchLabelIds,
      gmailHistoryId: params.gmailHistoryId,
      gmailWatchExpiration: params.gmailWatchExpiration,
      createdAt: now,
      updatedAt: now,
      GSI1PK: `${EMAIL_GSI_PREFIX}${normalized}`,
      GSI1SK: `PROVIDER#${params.provider}#TENANT#${params.tenantId}#ACCOUNT#${id}`,
      GSI2PK: `USER#${params.userId}`,
      GSI2SK: `EMAIL_ACCOUNT#${params.provider}#${normalized}`,
    });
  } catch (error: any) {
    const name = error && typeof error === "object" ? String(error.name) : "";
    if (name !== "ConditionalCheckFailedException") throw error;

    const sets: string[] = [
      "provider = :provider",
      "email = :email",
      "userId = :userId",
      "#status = :status",
      "updatedAt = :updatedAt",
      "GSI1PK = :gsi1pk",
      "GSI1SK = :gsi1sk",
      "GSI2PK = :gsi2pk",
      "GSI2SK = :gsi2sk",
    ];
    const names: Record<string, string> = { "#status": "status" };
    const values: Record<string, unknown> = {
      ":provider": params.provider,
      ":email": normalized,
      ":userId": params.userId,
      ":status": params.status ?? "active",
      ":updatedAt": now,
      ":gsi1pk": `${EMAIL_GSI_PREFIX}${normalized}`,
      ":gsi1sk": `PROVIDER#${params.provider}#TENANT#${params.tenantId}#ACCOUNT#${id}`,
      ":gsi2pk": `USER#${params.userId}`,
      ":gsi2sk": `EMAIL_ACCOUNT#${params.provider}#${normalized}`,
    };

    if (params.accessTokenEnc !== undefined) {
      sets.push("accessTokenEnc = :accessTokenEnc");
      values[":accessTokenEnc"] = params.accessTokenEnc;
    }
    if (params.refreshTokenEnc !== undefined) {
      sets.push("refreshTokenEnc = :refreshTokenEnc");
      values[":refreshTokenEnc"] = params.refreshTokenEnc;
    }
    if (params.accessTokenExpiresAt !== undefined) {
      sets.push("accessTokenExpiresAt = :accessTokenExpiresAt");
      values[":accessTokenExpiresAt"] = params.accessTokenExpiresAt;
    }
    if (params.scope !== undefined) {
      sets.push("#scope = :scope");
      values[":scope"] = params.scope;
      names["#scope"] = "scope";
    }
    if (params.labelIds !== undefined) {
      sets.push("labelIds = :labelIds");
      values[":labelIds"] = params.labelIds;
    }
    if (params.watchLabelIds !== undefined) {
      sets.push("watchLabelIds = :watchLabelIds");
      values[":watchLabelIds"] = params.watchLabelIds;
    }
    if (params.gmailHistoryId !== undefined) {
      sets.push("gmailHistoryId = :gmailHistoryId");
      values[":gmailHistoryId"] = params.gmailHistoryId;
    }
    if (params.gmailWatchExpiration !== undefined) {
      sets.push("gmailWatchExpiration = :gmailWatchExpiration");
      values[":gmailWatchExpiration"] = params.gmailWatchExpiration;
    }

    await updateItem(
      params.tenantId,
      sk,
      `SET ${sets.join(", ")}`,
      values,
      names
    );
  }

  const item = await getEmailAccountItem(params.tenantId, id);
  if (!item) {
    throw new Error("Email account not found after upsert");
  }
  return mapAccount(item);
}

export async function updateEmailAccountSyncState(params: {
  tenantId: string;
  accountId: string;
  accessTokenEnc?: string;
  refreshTokenEnc?: string;
  accessTokenExpiresAt?: string;
  labelIds?: MailLabelIds;
  watchLabelIds?: string[];
  gmailHistoryId?: string;
  gmailWatchExpiration?: string;
  status?: EmailAccountItem["status"];
}): Promise<void> {
  const now = new Date().toISOString();
  const sets: string[] = ["updatedAt = :updatedAt"];
  const values: Record<string, unknown> = {
    ":updatedAt": now,
  };
  const names: Record<string, string> = {};

  if (params.accessTokenEnc !== undefined) {
    sets.push("accessTokenEnc = :accessTokenEnc");
    values[":accessTokenEnc"] = params.accessTokenEnc;
  }
  if (params.refreshTokenEnc !== undefined) {
    sets.push("refreshTokenEnc = :refreshTokenEnc");
    values[":refreshTokenEnc"] = params.refreshTokenEnc;
  }
  if (params.accessTokenExpiresAt !== undefined) {
    sets.push("accessTokenExpiresAt = :accessTokenExpiresAt");
    values[":accessTokenExpiresAt"] = params.accessTokenExpiresAt;
  }
  if (params.labelIds !== undefined) {
    sets.push("labelIds = :labelIds");
    values[":labelIds"] = params.labelIds;
  }
  if (params.watchLabelIds !== undefined) {
    sets.push("watchLabelIds = :watchLabelIds");
    values[":watchLabelIds"] = params.watchLabelIds;
  }
  if (params.gmailHistoryId !== undefined) {
    sets.push("gmailHistoryId = :gmailHistoryId");
    values[":gmailHistoryId"] = params.gmailHistoryId;
  }
  if (params.gmailWatchExpiration !== undefined) {
    sets.push("gmailWatchExpiration = :gmailWatchExpiration");
    values[":gmailWatchExpiration"] = params.gmailWatchExpiration;
  }
  if (params.status !== undefined) {
    sets.push("#status = :status");
    values[":status"] = params.status;
    names["#status"] = "status";
  }

  await updateItem(
    params.tenantId,
    `${EMAIL_ACCOUNT_PREFIX}${params.accountId}`,
    `SET ${sets.join(", ")}`,
    values,
    Object.keys(names).length ? names : undefined
  );
}

export function mapEmailAccount(item: EmailAccountItem): EmailAccount {
  return mapAccount(item);
}
