import { randomUUID } from "crypto";
import type { XPostBatch, XPostPayload, XPostPosted } from "@shared/x-posts";
import { getItem, putItem, queryGSI2, updateItem } from "@db/tables/x-post-batches";
import type { XPostBatchItem } from "@db/types";

const BATCH_PREFIX = "X_POST_BATCH#";

function sk(batchId: string) {
  return `${BATCH_PREFIX}${batchId}` as const;
}

function safeParsePayload(raw: string): XPostPayload {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.topics)) {
      return parsed as XPostPayload;
    }
  } catch {
    // ignore
  }
  return { date: "", topics: [] };
}

function mapPosted(raw?: XPostBatchItem["posted"]): XPostPosted[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  return raw.map((entry) => ({
    rank: Number(entry.rank ?? 0),
    tweetId: String(entry.tweetId ?? ""),
    postedAt: new Date(entry.postedAt),
  }));
}

function mapBatch(item: XPostBatchItem): XPostBatch {
  const payload = safeParsePayload(item.payloadJson);
  return {
    id: item.id,
    userId: item.userId,
    date: item.date,
    payload,
    posted: mapPosted(item.posted),
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

export async function listXPostBatchesByUser(params: {
  userId: string;
}): Promise<XPostBatch[]> {
  const items = await queryGSI2<XPostBatchItem>(`USER#${params.userId}#X_POST_BATCH`);
  return items.map(mapBatch);
}

export async function getXPostBatchById(params: {
  tenantId: string;
  batchId: string;
}): Promise<XPostBatch | null> {
  const item = await getItem<XPostBatchItem>(params.tenantId, sk(params.batchId));
  return item ? mapBatch(item) : null;
}

export async function createXPostBatch(params: {
  tenantId: string;
  userId: string;
  payload: XPostPayload;
}): Promise<XPostBatch> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const payloadJson = JSON.stringify(params.payload);

  const item: Omit<XPostBatchItem, "PK" | "SK"> = {
    id,
    userId: params.userId,
    date: params.payload.date,
    payloadJson,
    createdAt: now,
    updatedAt: now,
    GSI2PK: `USER#${params.userId}#X_POST_BATCH`,
    GSI2SK: `${now}#${id}`,
  };

  await putItem(params.tenantId, sk(id), item as any);
  return mapBatch({ ...item, PK: `TENANT#${params.tenantId}`, SK: sk(id) });
}

export async function appendXPostBatchPosted(params: {
  tenantId: string;
  batchId: string;
  rank: number;
  tweetId: string;
  postedAt?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const record = {
    rank: params.rank,
    tweetId: params.tweetId,
    postedAt: params.postedAt ?? now,
  };

  await updateItem(
    params.tenantId,
    sk(params.batchId),
    "SET #posted = list_append(if_not_exists(#posted, :empty), :new), updatedAt = :updatedAt",
    {
      ":empty": [],
      ":new": [record],
      ":updatedAt": now,
    },
    { "#posted": "posted" }
  );
}
