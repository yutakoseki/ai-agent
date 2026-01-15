import { parseFeed, type ParsedFeed } from "./parser";

export type FetchFeedResult =
  | { status: "not_modified"; etag?: string | null; lastModified?: string | null }
  | { status: "ok"; feed: ParsedFeed; etag?: string | null; lastModified?: string | null };

export async function fetchFeed(params: {
  url: string;
  etag?: string | null;
  lastModified?: string | null;
}): Promise<FetchFeedResult> {
  const headers: Record<string, string> = {};
  if (params.etag) headers["If-None-Match"] = params.etag;
  if (params.lastModified) headers["If-Modified-Since"] = params.lastModified;

  const res = await fetch(params.url, {
    method: "GET",
    headers,
    redirect: "follow",
  });

  if (res.status === 304) {
    return {
      status: "not_modified",
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
    };
  }

  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status}`);
  }

  const text = await res.text();
  const feed = parseFeed(text);

  return {
    status: "ok",
    feed,
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
  };
}
