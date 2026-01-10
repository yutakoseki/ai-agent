import { createHash } from "crypto";
import { getItem, putItem, queryGSI2, updateItem } from "@db/tenant-client";
import type { PushSubscriptionItem } from "@db/types";

const PUSH_PREFIX = "PUSH_SUB#";

function buildSubscriptionId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

export async function upsertPushSubscription(params: {
  tenantId: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime?: number | null;
}): Promise<PushSubscriptionItem> {
  const now = new Date().toISOString();
  const id = buildSubscriptionId(params.endpoint);
  const sk = `${PUSH_PREFIX}${id}`;

  const item: Omit<PushSubscriptionItem, "PK" | "SK"> = {
    id,
    userId: params.userId,
    endpoint: params.endpoint,
    p256dh: params.p256dh,
    auth: params.auth,
    expirationTime: params.expirationTime ?? undefined,
    createdAt: now,
    updatedAt: now,
    GSI2PK: `USER#${params.userId}#PUSH`,
    GSI2SK: `${now}#${id}`,
  };

  try {
    await putItem(params.tenantId, sk, item as any);
  } catch (error: any) {
    const name = error && typeof error === "object" ? String(error.name) : "";
    if (name !== "ConditionalCheckFailedException") throw error;
    // DynamoDB予約語回避: auth
    await updateItem(
      params.tenantId,
      sk,
      "SET endpoint = :endpoint, p256dh = :p256dh, #auth = :auth, expirationTime = :expirationTime, updatedAt = :updatedAt, GSI2PK = :gsi2pk, GSI2SK = :gsi2sk",
      {
        ":endpoint": params.endpoint,
        ":p256dh": params.p256dh,
        ":auth": params.auth,
        ":expirationTime": params.expirationTime ?? null,
        ":updatedAt": now,
        ":gsi2pk": `USER#${params.userId}#PUSH`,
        ":gsi2sk": `${now}#${id}`,
      },
      { "#auth": "auth" }
    );
  }

  const saved = await getItem<PushSubscriptionItem>(params.tenantId, sk);
  if (!saved) {
    throw new Error("Push subscription not found after upsert");
  }
  return saved;
}

export async function listPushSubscriptionsByUser(params: {
  userId: string;
}): Promise<PushSubscriptionItem[]> {
  return queryGSI2<PushSubscriptionItem>(`USER#${params.userId}#PUSH`);
}
