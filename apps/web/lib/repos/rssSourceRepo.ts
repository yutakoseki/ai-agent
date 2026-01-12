import { randomUUID } from "crypto";
import type { RssSource } from "@shared/rss";
import { getItem, putItem, queryByPrefix, queryGSI2, updateItem, deleteItem } from "@db/tables/rss-sources";
import type { RssSourceItem } from "@db/types";
import { normalizeUrl } from "@/lib/rss/normalize";

const SOURCE_PREFIX = "RSS_SOURCE#";

function mapSource(item: RssSourceItem): RssSource {
  return {
    id: item.id,
    userId: item.userId,
    url: item.url,
    status: item.status,
    title: item.title,
    lastFetchedAt: item.lastFetchedAt ? new Date(item.lastFetchedAt) : undefined,
    nextFetchAt: item.nextFetchAt ? new Date(item.nextFetchAt) : undefined,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

function sk(sourceId: string) {
  return `${SOURCE_PREFIX}${sourceId}` as const;
}

export async function listSourcesByUser(params: {
  userId: string;
}): Promise<RssSource[]> {
  const items = await queryGSI2<RssSourceItem>(`USER#${params.userId}#RSS_SOURCE`);
  return items.map(mapSource);
}

export async function listSourcesByTenant(params: {
  tenantId: string;
}): Promise<RssSourceItem[]> {
  return queryByPrefix<RssSourceItem>(params.tenantId, SOURCE_PREFIX);
}

export async function findSourceById(params: {
  tenantId: string;
  sourceId: string;
}): Promise<RssSource | null> {
  const item = await getItem<RssSourceItem>(params.tenantId, sk(params.sourceId));
  return item ? mapSource(item) : null;
}

export async function createSource(params: {
  tenantId: string;
  userId: string;
  url: string;
  nextFetchAt?: Date;
}): Promise<RssSource> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const normalizedUrl = normalizeUrl(params.url);
  const nextFetchAt = (params.nextFetchAt ?? new Date()).toISOString();

  const item: Omit<RssSourceItem, "PK" | "SK"> = {
    id,
    userId: params.userId,
    url: params.url,
    normalizedUrl,
    status: "active",
    nextFetchAt,
    createdAt: now,
    updatedAt: now,
    GSI2PK: `USER#${params.userId}#RSS_SOURCE`,
    GSI2SK: `${now}#${id}`,
  };

  await putItem(params.tenantId, sk(id), item as any);

  return mapSource({ ...item, PK: `TENANT#${params.tenantId}`, SK: sk(id) });
}

export async function updateSource(params: {
  tenantId: string;
  sourceId: string;
  status?: RssSourceItem["status"];
  title?: string | null;
  etag?: string | null;
  lastModified?: string | null;
  lastFetchedAt?: string | null;
  nextFetchAt?: string | null;
  lastError?: string | null;
}): Promise<void> {
  const sets: string[] = ["updatedAt = :updatedAt"];
  const values: Record<string, unknown> = { ":updatedAt": new Date().toISOString() };
  const names: Record<string, string> = {};

  if (params.status !== undefined) {
    sets.push("#status = :status");
    values[":status"] = params.status;
    names["#status"] = "status";
  }
  if (params.title !== undefined) {
    sets.push("title = :title");
    values[":title"] = params.title ?? null;
  }
  if (params.etag !== undefined) {
    sets.push("etag = :etag");
    values[":etag"] = params.etag ?? null;
  }
  if (params.lastModified !== undefined) {
    sets.push("lastModified = :lastModified");
    values[":lastModified"] = params.lastModified ?? null;
  }
  if (params.lastFetchedAt !== undefined) {
    sets.push("lastFetchedAt = :lastFetchedAt");
    values[":lastFetchedAt"] = params.lastFetchedAt ?? null;
  }
  if (params.nextFetchAt !== undefined) {
    sets.push("nextFetchAt = :nextFetchAt");
    values[":nextFetchAt"] = params.nextFetchAt ?? null;
  }
  if (params.lastError !== undefined) {
    sets.push("lastError = :lastError");
    values[":lastError"] = params.lastError ?? null;
  }

  await updateItem(
    params.tenantId,
    sk(params.sourceId),
    `SET ${sets.join(", ")}`,
    values,
    Object.keys(names).length ? names : undefined
  );
}

export async function deleteSource(params: {
  tenantId: string;
  sourceId: string;
}): Promise<void> {
  await deleteItem(params.tenantId, sk(params.sourceId));
}

export function normalizeSourceUrl(url: string): string {
  return normalizeUrl(url);
}
