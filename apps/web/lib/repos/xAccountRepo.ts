import { getItem, putItem, updateItem } from "@db/tables/x-accounts";
import type { XAccountItem } from "@db/types";

const ACCOUNT_PREFIX = "X_ACCOUNT#USER#";

function sk(userId: string) {
  return `${ACCOUNT_PREFIX}${userId}` as const;
}

export type XAccount = {
  tenantId: string;
  userId: string;
  status: "pending" | "connected";
  requestToken?: string;
  requestTokenSecretEnc?: string;
  requestTokenExpiresAt?: string;
  accessTokenEnc?: string;
  accessTokenSecretEnc?: string;
  xUserId?: string;
  screenName?: string;
  createdAt: Date;
  updatedAt: Date;
};

function mapAccount(item: XAccountItem): XAccount {
  return {
    tenantId: item.PK.replace("TENANT#", ""),
    userId: item.userId,
    status: item.status,
    requestToken: item.requestToken,
    requestTokenSecretEnc: item.requestTokenSecretEnc,
    requestTokenExpiresAt: item.requestTokenExpiresAt,
    accessTokenEnc: item.accessTokenEnc,
    accessTokenSecretEnc: item.accessTokenSecretEnc,
    xUserId: item.xUserId,
    screenName: item.screenName,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

export async function getXAccountByUser(params: {
  tenantId: string;
  userId: string;
}): Promise<XAccount | null> {
  const item = await getItem<XAccountItem>(params.tenantId, sk(params.userId));
  return item ? mapAccount(item) : null;
}

export async function saveXAuthRequest(params: {
  tenantId: string;
  userId: string;
  requestToken: string;
  requestTokenSecretEnc: string;
  requestTokenExpiresAt?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const item: Omit<XAccountItem, "PK" | "SK"> = {
    userId: params.userId,
    status: "pending",
    requestToken: params.requestToken,
    requestTokenSecretEnc: params.requestTokenSecretEnc,
    requestTokenExpiresAt: params.requestTokenExpiresAt,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putItem(params.tenantId, sk(params.userId), item as any);
  } catch (error: any) {
    const name = error && typeof error === "object" ? String(error.name) : "";
    if (name !== "ConditionalCheckFailedException") throw error;

    await updateItem(
      params.tenantId,
      sk(params.userId),
      "SET #status = :status, requestToken = :requestToken, requestTokenSecretEnc = :requestTokenSecretEnc, requestTokenExpiresAt = :requestTokenExpiresAt, updatedAt = :updatedAt",
      {
        ":status": "pending",
        ":requestToken": params.requestToken,
        ":requestTokenSecretEnc": params.requestTokenSecretEnc,
        ":requestTokenExpiresAt": params.requestTokenExpiresAt ?? null,
        ":updatedAt": now,
      },
      { "#status": "status" }
    );
  }
}

export async function saveXAccessToken(params: {
  tenantId: string;
  userId: string;
  accessTokenEnc: string;
  accessTokenSecretEnc: string;
  xUserId?: string;
  screenName?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const item: Omit<XAccountItem, "PK" | "SK"> = {
    userId: params.userId,
    status: "connected",
    accessTokenEnc: params.accessTokenEnc,
    accessTokenSecretEnc: params.accessTokenSecretEnc,
    xUserId: params.xUserId,
    screenName: params.screenName,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putItem(params.tenantId, sk(params.userId), item as any);
  } catch (error: any) {
    const name = error && typeof error === "object" ? String(error.name) : "";
    if (name !== "ConditionalCheckFailedException") throw error;

    await updateItem(
      params.tenantId,
      sk(params.userId),
      "SET #status = :status, accessTokenEnc = :accessTokenEnc, accessTokenSecretEnc = :accessTokenSecretEnc, xUserId = :xUserId, screenName = :screenName, updatedAt = :updatedAt REMOVE requestToken, requestTokenSecretEnc, requestTokenExpiresAt",
      {
        ":status": "connected",
        ":accessTokenEnc": params.accessTokenEnc,
        ":accessTokenSecretEnc": params.accessTokenSecretEnc,
        ":xUserId": params.xUserId ?? null,
        ":screenName": params.screenName ?? null,
        ":updatedAt": now,
      },
      { "#status": "status" }
    );
  }
}
