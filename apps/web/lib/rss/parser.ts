type ParsedFeedItem = {
  title: string;
  link?: string;
  guid?: string;
  publishedAt?: string;
  content?: string;
};

export type ParsedFeed = {
  title?: string;
  items: ParsedFeedItem[];
};

const MAX_CONTENT_LENGTH = 4000;

function stripCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
}

function decodeEntities(input: string): string {
  const replaced = input
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'");

  return replaced.replace(/&#(x?)([0-9a-f]+);/gi, (_m, hexFlag, num) => {
    const code = parseInt(num, hexFlag ? 16 : 10);
    if (!Number.isFinite(code)) return "";
    return String.fromCodePoint(code);
  });
}

function stripHtml(input: string): string {
  const withoutTags = input.replace(/<[^>]+>/g, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
}

function cleanText(input?: string): string | undefined {
  if (!input) return undefined;
  const noCdata = stripCdata(input);
  const decoded = decodeEntities(noCdata);
  const stripped = stripHtml(decoded);
  const trimmed = stripped.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= MAX_CONTENT_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_CONTENT_LENGTH);
}

function escapeTag(tag: string): string {
  return tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTagContent(block: string, tag: string): string | undefined {
  const escaped = escapeTag(tag);
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const match = re.exec(block);
  if (!match) return undefined;
  return match[1]?.trim();
}

function extractFirstTag(block: string, tags: string[]): string | undefined {
  for (const tag of tags) {
    const found = extractTagContent(block, tag);
    if (found) return found;
  }
  return undefined;
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z0-9:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(tag))) {
    const key = match[1];
    const value = match[3] ?? match[4] ?? "";
    attrs[key] = value;
  }
  return attrs;
}

function toIsoDate(input?: string): string | undefined {
  if (!input) return undefined;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function parseRssItems(xml: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(xml))) {
    const block = match[1];
    const title = cleanText(extractTagContent(block, "title") || "") || "";
    if (!title) continue;
    const link = cleanText(extractTagContent(block, "link"));
    const guid = cleanText(extractTagContent(block, "guid"));
    const publishedRaw = extractFirstTag(block, ["pubDate", "dc:date", "published"]);
    const publishedAt = toIsoDate(publishedRaw);
    const contentRaw = extractFirstTag(block, ["content:encoded", "description", "summary"]);
    const content = cleanText(contentRaw);
    items.push({ title, link, guid, publishedAt, content });
  }
  return items;
}

function parseAtomItems(xml: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const re = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(xml))) {
    const block = match[1];
    const title = cleanText(extractTagContent(block, "title") || "") || "";
    if (!title) continue;

    const linkTags = [...block.matchAll(/<link\b[^>]*>/gi)];
    let link: string | undefined;
    for (const tag of linkTags) {
      const attrs = parseAttributes(tag[0]);
      if (!attrs.href) continue;
      const rel = attrs.rel?.toLowerCase();
      if (!rel || rel === "alternate") {
        link = attrs.href;
        break;
      }
    }

    const guid = cleanText(extractTagContent(block, "id"));
    const publishedRaw = extractFirstTag(block, ["published", "updated"]);
    const publishedAt = toIsoDate(publishedRaw);
    const contentRaw = extractFirstTag(block, ["content", "summary"]);
    const content = cleanText(contentRaw);

    items.push({ title, link, guid, publishedAt, content });
  }
  return items;
}

export function parseFeed(xml: string): ParsedFeed {
  const cleaned = stripCdata(xml);
  const isAtom =
    /<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(cleaned) ||
    /<feed\b[^>]*>/i.test(cleaned);
  const isRss = /<rss\b[^>]*>/i.test(cleaned) || /<channel\b[^>]*>/i.test(cleaned);

  if (isAtom) {
    const title = cleanText(extractTagContent(cleaned, "title"));
    return { title, items: parseAtomItems(cleaned) };
  }
  if (isRss) {
    const channelMatch = /<channel\b[^>]*>([\s\S]*?)<\/channel>/i.exec(cleaned);
    const channel = channelMatch ? channelMatch[1] : cleaned;
    const title = cleanText(extractTagContent(channel, "title"));
    return { title, items: parseRssItems(channel) };
  }

  return { items: [] };
}

export function sanitizeTitle(input?: string): string | undefined {
  if (!input) return undefined;
  const cleaned = cleanText(input);
  if (!cleaned) return undefined;
  return cleaned.length <= 120 ? cleaned : `${cleaned.slice(0, 119)}…`;
}
