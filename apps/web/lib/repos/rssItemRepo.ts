import { randomUUID } from "crypto";
import { putItem, queryGSI1, deleteItem } from "@db/tables/rss-items";
import type { RssItem } from "@db/types";

const ITEM_PREFIX = "RSS_ITEM#";
const SOURCE_PREFIX = "RSS_SOURCE#";

function sk(itemId: string) {
  return `${ITEM_PREFIX}${itemId}` as const;
}

export async function listItemsBySource(params: {
  sourceId: string;
}): Promise<RssItem[]> {
  return queryGSI1<RssItem>(`${SOURCE_PREFIX}${params.sourceId}`);
}

export async function createItem(params: {
  tenantId: string;
  sourceId: string;
  userId: string;
  title: string;
  url: string;
  guid?: string;
  fingerprint: string;
  publishedAt?: string;
  content?: string;
  expiresAt?: number;
}): Promise<RssItem> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const sortBase = params.publishedAt ?? now;

  const item: Omit<RssItem, "PK" | "SK"> = {
    id,
    sourceId: params.sourceId,
    userId: params.userId,
    title: params.title,
    url: params.url,
    guid: params.guid,
    fingerprint: params.fingerprint,
    publishedAt: params.publishedAt,
    content: params.content,
    createdAt: now,
    updatedAt: now,
    expiresAt: params.expiresAt,
    GSI1PK: `${SOURCE_PREFIX}${params.sourceId}`,
    GSI1SK: `${sortBase}#${id}`,
  };

  await putItem(params.tenantId, sk(id), item as any);

  return { ...item, PK: `TENANT#${params.tenantId}`, SK: sk(id) };
}

export async function deleteItemById(params: {
  tenantId: string;
  itemId: string;
}): Promise<void> {
  await deleteItem(params.tenantId, sk(params.itemId));
}
