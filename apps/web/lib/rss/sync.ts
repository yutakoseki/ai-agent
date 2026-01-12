import { fetchFeed } from "./fetch";
import { summarizeForBlog, summarizeForX } from "./summarizer";
import { sanitizeTitle } from "./parser";
import { normalizeUrl } from "./normalize";
import { listSourcesByTenant, updateSource } from "@/lib/repos/rssSourceRepo";
import { listItemsBySource, createItem, deleteItemById } from "@/lib/repos/rssItemRepo";
import { createDraft } from "@/lib/repos/rssDraftRepo";
import { getUserPreferences } from "@/lib/repos/userPreferencesRepo";
import { tryConsumeDailyQuota } from "@/lib/repos/rssUsageRepo";
import { listTenants } from "@/lib/repos/tenantRepo";
import { getRssPlanLimits, type RssPlanLimits } from "./plan";
import type { RssGenerationTarget } from "@shared/rss";
import type { RssSourceItem } from "@db/types";

const FETCH_INTERVAL_HOURS = 6;
const MAX_ITEMS_PER_SOURCE = 5;
const ITEMS_TTL_DAYS = 180;
const DRAFTS_TTL_DAYS = 90;

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildExpiresAt(days: number): number {
  const seconds = Math.floor(Date.now() / 1000);
  return seconds + days * 24 * 60 * 60;
}

function buildFingerprint(params: {
  guid?: string;
  link?: string;
  title?: string;
  publishedAt?: string;
}): string {
  if (params.guid) return `guid:${params.guid}`;
  if (params.link) {
    try {
      return `link:${normalizeUrl(params.link)}`;
    } catch {
      return `link:${params.link}`;
    }
  }
  const title = params.title ?? "";
  const publishedAt = params.publishedAt ?? "";
  return `title:${title}|${publishedAt}`;
}

function sortByPublishedDesc<T extends { publishedAt?: string; createdAt?: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const aParsed = a.publishedAt
      ? Date.parse(a.publishedAt)
      : a.createdAt
        ? Date.parse(a.createdAt)
        : 0;
    const bParsed = b.publishedAt
      ? Date.parse(b.publishedAt)
      : b.createdAt
        ? Date.parse(b.createdAt)
        : 0;
    const aTime = Number.isNaN(aParsed) ? 0 : aParsed;
    const bTime = Number.isNaN(bParsed) ? 0 : bParsed;
    return bTime - aTime;
  });
}

async function syncSource(params: {
  tenantId: string;
  source: RssSourceItem;
  limits: RssPlanLimits;
  traceId?: string;
}): Promise<{ newItems: number; draftsCreated: number; draftsSkipped: number }> {
  const now = new Date();
  const nextFetchAt = addHours(now, FETCH_INTERVAL_HOURS).toISOString();

  try {
    const result = await fetchFeed({
      url: params.source.url,
      etag: params.source.etag,
      lastModified: params.source.lastModified,
    });

    if (result.status === "not_modified") {
      await updateSource({
        tenantId: params.tenantId,
        sourceId: params.source.id,
        lastFetchedAt: now.toISOString(),
        nextFetchAt,
        etag: result.etag ?? params.source.etag ?? null,
        lastModified: result.lastModified ?? params.source.lastModified ?? null,
        lastError: null,
      });
      return { newItems: 0, draftsCreated: 0, draftsSkipped: 0 };
    }

    const feedTitle = sanitizeTitle(result.feed.title);
    await updateSource({
      tenantId: params.tenantId,
      sourceId: params.source.id,
      lastFetchedAt: now.toISOString(),
      nextFetchAt,
      etag: result.etag ?? null,
      lastModified: result.lastModified ?? null,
      title: feedTitle ?? null,
      lastError: null,
    });

    const existing = await listItemsBySource({ sourceId: params.source.id });
    const existingFingerprints = new Set(existing.map((item) => item.fingerprint));

    const candidates = sortByPublishedDesc(result.feed.items)
      .filter((item) => item.title && (item.link || item.guid))
      .slice(0, MAX_ITEMS_PER_SOURCE);

    const newItems: Array<{ itemId: string; title: string; link: string; content?: string }> = [];
    for (const item of candidates) {
      const fingerprint = buildFingerprint({
        guid: item.guid,
        link: item.link,
        title: item.title,
        publishedAt: item.publishedAt,
      });
      if (existingFingerprints.has(fingerprint)) continue;

      const saved = await createItem({
        tenantId: params.tenantId,
        sourceId: params.source.id,
        userId: params.source.userId,
        title: item.title,
        url: item.link ?? params.source.url,
        guid: item.guid,
        fingerprint,
        publishedAt: item.publishedAt,
        content: item.content,
        expiresAt: buildExpiresAt(ITEMS_TTL_DAYS),
      });
      existingFingerprints.add(fingerprint);
      newItems.push({
        itemId: saved.id,
        title: saved.title,
        link: saved.url,
        content: item.content,
      });
    }

    if (newItems.length) {
      const allItems = sortByPublishedDesc(await listItemsBySource({ sourceId: params.source.id }));
      const overflow = allItems.slice(MAX_ITEMS_PER_SOURCE);
      for (const item of overflow) {
        await deleteItemById({ tenantId: params.tenantId, itemId: item.id });
      }
    }

    if (!newItems.length) {
      return { newItems: 0, draftsCreated: 0, draftsSkipped: 0 };
    }

    const prefs = await getUserPreferences({
      tenantId: params.tenantId,
      userId: params.source.userId,
    });
    const targets: RssGenerationTarget[] =
      prefs?.rssGenerationTargets && prefs.rssGenerationTargets.length
        ? prefs.rssGenerationTargets
        : ["x"];

    const dateKey = toUtcDateKey(now);

    let draftsCreated = 0;
    let draftsSkipped = 0;

    for (const item of newItems) {
      const content = item.content;
      for (const target of targets) {
        const allowed = await tryConsumeDailyQuota({
          tenantId: params.tenantId,
          userId: params.source.userId,
          date: dateKey,
          amount: 1,
          max: params.limits.maxSummariesPerDay,
        });
        if (!allowed.ok) {
          draftsSkipped += 1;
          continue;
        }

        if (target === "blog") {
          const blog = summarizeForBlog({ title: item.title, content });
          await createDraft({
            tenantId: params.tenantId,
            userId: params.source.userId,
            sourceId: params.source.id,
            sourceTitle: feedTitle ?? params.source.title,
            itemId: item.itemId,
            itemTitle: item.title,
            itemUrl: item.link,
            target: "blog",
            title: blog.title,
            text: blog.text,
            expiresAt: buildExpiresAt(DRAFTS_TTL_DAYS),
          });
        } else {
          const text = summarizeForX({ title: item.title, content });
          await createDraft({
            tenantId: params.tenantId,
            userId: params.source.userId,
            sourceId: params.source.id,
            sourceTitle: feedTitle ?? params.source.title,
            itemId: item.itemId,
            itemTitle: item.title,
            itemUrl: item.link,
            target: "x",
            text,
            expiresAt: buildExpiresAt(DRAFTS_TTL_DAYS),
          });
        }
        draftsCreated += 1;
      }
    }

    return { newItems: newItems.length, draftsCreated, draftsSkipped };
  } catch (error: any) {
    await updateSource({
      tenantId: params.tenantId,
      sourceId: params.source.id,
      lastFetchedAt: now.toISOString(),
      nextFetchAt,
      lastError: error instanceof Error ? error.message : "fetch error",
    });
    return { newItems: 0, draftsCreated: 0, draftsSkipped: 0 };
  }
}

export async function runRssScheduler(params: {
  maxSources: number;
  traceId?: string;
}): Promise<{
  processedSources: number;
  newItems: number;
  draftsCreated: number;
  draftsSkipped: number;
}> {
  const tenants = await listTenants();
  let processedSources = 0;
  let newItems = 0;
  let draftsCreated = 0;
  let draftsSkipped = 0;

  for (const tenant of tenants.filter((t) => t.enabled)) {
    if (processedSources >= params.maxSources) break;
    const limits = getRssPlanLimits(tenant.plan);

    const sources = await listSourcesByTenant({ tenantId: tenant.id });
    const due = sources.filter((source) => {
      if (source.status === "disabled") return false;
      if (!source.nextFetchAt) return true;
      return new Date(source.nextFetchAt) <= new Date();
    });
    const sorted = due.sort((a, b) => {
      const aTime = a.nextFetchAt ? Date.parse(a.nextFetchAt) : 0;
      const bTime = b.nextFetchAt ? Date.parse(b.nextFetchAt) : 0;
      return aTime - bTime;
    });

    for (const source of sorted) {
      if (processedSources >= params.maxSources) break;
      const result = await syncSource({
        tenantId: tenant.id,
        source,
        limits,
        traceId: params.traceId,
      });
      processedSources += 1;
      newItems += result.newItems;
      draftsCreated += result.draftsCreated;
      draftsSkipped += result.draftsSkipped;
    }
  }

  return { processedSources, newItems, draftsCreated, draftsSkipped };
}
