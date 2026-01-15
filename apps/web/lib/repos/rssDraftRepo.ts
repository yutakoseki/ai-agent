import { randomUUID } from "crypto";
import type { RssDraft } from "@shared/rss";
import { putItem, queryGSI2 } from "@db/tables/rss-drafts";
import type { RssDraftItem } from "@db/types";

const DRAFT_PREFIX = "RSS_DRAFT#";

function sk(draftId: string) {
  return `${DRAFT_PREFIX}${draftId}` as const;
}

function mapDraft(item: RssDraftItem): RssDraft {
  return {
    id: item.id,
    userId: item.userId,
    sourceId: item.sourceId,
    sourceTitle: item.sourceTitle,
    itemId: item.itemId,
    itemTitle: item.itemTitle,
    itemUrl: item.itemUrl,
    target: item.target,
    title: item.title,
    text: item.text,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

export async function listDraftsByUser(params: {
  userId: string;
}): Promise<RssDraft[]> {
  const items = await queryGSI2<RssDraftItem>(`USER#${params.userId}#RSS_DRAFT`);
  return items.map(mapDraft);
}

export async function createDraft(params: {
  tenantId: string;
  userId: string;
  sourceId: string;
  sourceTitle?: string;
  itemId: string;
  itemTitle: string;
  itemUrl: string;
  target: RssDraftItem["target"];
  title?: string;
  text: string;
  expiresAt?: number;
}): Promise<RssDraft> {
  const id = randomUUID();
  const now = new Date().toISOString();

  const item: Omit<RssDraftItem, "PK" | "SK"> = {
    id,
    userId: params.userId,
    sourceId: params.sourceId,
    sourceTitle: params.sourceTitle,
    itemId: params.itemId,
    itemTitle: params.itemTitle,
    itemUrl: params.itemUrl,
    target: params.target,
    title: params.title,
    text: params.text,
    createdAt: now,
    updatedAt: now,
    expiresAt: params.expiresAt,
    GSI2PK: `USER#${params.userId}#RSS_DRAFT`,
    GSI2SK: `${now}#${id}`,
  };

  await putItem(params.tenantId, sk(id), item as any);

  return mapDraft({ ...item, PK: `TENANT#${params.tenantId}`, SK: sk(id) });
}
