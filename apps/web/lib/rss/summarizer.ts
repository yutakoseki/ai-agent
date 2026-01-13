import { logger } from "@/lib/logger";
import { sanitizeTitle } from "./parser";

type SummaryInput = {
  title?: string;
  content?: string;
  url?: string;
  sourceTitle?: string;
  role?: string;
  persona?: string;
  postTone?: string;
  postFormat?: string;
  traceId?: string;
};

type BlogSummary = {
  title: string;
  text: string;
};

type AiInput = {
  title: string;
  content: string;
  url?: string;
  sourceTitle?: string;
  article?: string;
};

const MAX_RSS_CONTENT = 3000;
const MAX_ARTICLE_CONTENT = 6000;
const MAX_BLOG_TITLE = 60;
const MAX_BLOG_TEXT = 360;
const MIN_BLOG_TEXT = 240;
const MAX_X_LENGTH = 280;
const MAX_POST_TONE = 200;
const MAX_POST_FORMAT = 500;
const ARTICLE_FETCH_TIMEOUT_MS = 6000;
const DEFAULT_ROLE = "テック業界のニュース解説者";
const DEFAULT_PERSONA = "新規事業・プロダクト戦略に関心のあるビジネスパーソン";
const DEFAULT_POST_TONE = "わかりやすく簡潔で、実務に役立つ語り口";
const DEFAULT_POST_FORMAT = "2〜3文で、結論→理由→示唆の順にまとめる";

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function decodeEntities(input: string): string {
  const replaced = input
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");

  return replaced.replace(/&#(x?)([0-9a-f]+);/gi, (_m, hexFlag, num) => {
    const code = parseInt(num, hexFlag ? 16 : 10);
    if (!Number.isFinite(code)) return "";
    return String.fromCodePoint(code);
  });
}

function stripHtml(input: string): string {
  const withoutScripts = input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

function isLikelyHtmlUrl(url: string): boolean {
  const lowered = url.toLowerCase();
  if (lowered.startsWith("mailto:") || lowered.startsWith("javascript:")) return false;
  return !/\.(pdf|png|jpe?g|gif|webp|svg|mp4|mp3|zip|xlsx?|pptx?)($|\?)/.test(
    lowered
  );
}

async function fetchArticleText(
  url: string | undefined,
  traceId?: string
): Promise<string | null> {
  if (!url) return null;
  const target = url.trim();
  if (!target || !/^https?:\/\//i.test(target) || !isLikelyHtmlUrl(target)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(target, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RSSSummarizer/1.0)",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.debug("rss article fetch failed", {
        traceId,
        url: target,
        status: res.status,
      });
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      return null;
    }
    const html = await res.text();
    const cleaned = stripHtml(html);
    if (!cleaned) return null;
    return truncateText(cleaned, MAX_ARTICLE_CONTENT);
  } catch (error) {
    logger.debug("rss article fetch error", { traceId, url: target, error });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function splitSentences(text: string): string[] {
  const cleaned = collapse(text);
  if (!cleaned) return [];
  const parts = cleaned.split(/(?<=[。.!?])\s+/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function composeSummaryText(sentences: string[], maxLength: number): string {
  let text = "";
  for (const sentence of sentences) {
    const trimmed = sentence.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    const next = text ? `${text} ${trimmed}` : trimmed;
    if (next.length > maxLength) break;
    text = next;
  }
  if (!text && sentences.length > 0) {
    return truncateText(sentences[0], maxLength);
  }
  return truncateText(text, maxLength);
}

function normalizePromptText(
  value: string | undefined,
  fallback: string,
  maxLength = 200
): string {
  const trimmed = collapse(value ?? "");
  if (!trimmed) return fallback;
  return trimmed.length <= maxLength ? trimmed : truncateText(trimmed, maxLength);
}

function normalizePromptMultiline(
  value: string | undefined,
  fallback: string,
  maxLength = 200
): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const joined = lines.join("\n").trim();
  if (!joined) return fallback;
  return joined.length <= maxLength ? joined : truncateText(joined, maxLength);
}

function buildPersonaContext(input: SummaryInput): { role: string; persona: string } {
  return {
    role: normalizePromptText(input.role, DEFAULT_ROLE),
    persona: normalizePromptText(input.persona, DEFAULT_PERSONA),
  };
}

function buildPostStyleContext(input: SummaryInput): { postTone: string; postFormat: string } {
  return {
    postTone: normalizePromptText(input.postTone, DEFAULT_POST_TONE, MAX_POST_TONE),
    postFormat: normalizePromptMultiline(
      input.postFormat,
      DEFAULT_POST_FORMAT,
      MAX_POST_FORMAT
    ),
  };
}

function buildAiInput(input: SummaryInput, articleText?: string): AiInput {
  const title = sanitizeTitle(input.title) ?? "";
  const content = collapse(input.content ?? "");
  const url = collapse(input.url ?? "");
  const sourceTitle = collapse(input.sourceTitle ?? "");
  const payload: AiInput = {
    title: truncateText(title, 200),
    content: truncateText(content, MAX_RSS_CONTENT),
  };
  if (url) payload.url = truncateText(url, 500);
  if (sourceTitle) payload.sourceTitle = truncateText(sourceTitle, 200);
  if (articleText) payload.article = truncateText(collapse(articleText), MAX_ARTICLE_CONTENT);
  return payload;
}

function shouldUseAI(input: SummaryInput): boolean {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return false;
  const raw = `${input.title ?? ""} ${input.content ?? ""} ${input.url ?? ""}`.trim();
  if (!raw) return false;
  return true;
}

function parseJsonLoose(input: string): any {
  const cleaned = input
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function supportsTemperature(model: string): boolean {
  return !model.toLowerCase().startsWith("gpt-5");
}

async function callOpenAIJson(params: {
  system: string;
  user: string;
  traceId?: string;
  label: string;
}): Promise<any | null> {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || "gpt-5.2-nano";
  const temperature = supportsTemperature(model) ? 0.2 : undefined;
  const startedAt = Date.now();

  try {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    };
    if (temperature !== undefined) body.temperature = temperature;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data?.error ?? {};
      logger.warn("openai rss summarize failed", {
        traceId: params.traceId,
        status: res.status,
        durationMs: Date.now() - startedAt,
        model,
        label: params.label,
        code: err?.code ?? null,
        type: err?.type ?? null,
        message: err?.message ?? null,
      });
      return null;
    }

    const content = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      logger.warn("openai rss summarize empty", {
        traceId: params.traceId,
        durationMs: Date.now() - startedAt,
        model,
        label: params.label,
      });
      return null;
    }

    try {
      return parseJsonLoose(content);
    } catch (error) {
      logger.warn("openai rss summarize json parse failed", {
        traceId: params.traceId,
        error,
        label: params.label,
        content: content.slice(0, 500),
      });
      return null;
    }
  } catch (error) {
    logger.warn("openai rss summarize request error", {
      traceId: params.traceId,
      error,
      label: params.label,
    });
    return null;
  }
}

function normalizeAiTitle(raw: unknown, fallback: string): string {
  const title = String(raw ?? "").replace(/\s+/g, " ").trim();
  const value = title || fallback;
  if (!value) return "要約";
  return value.length <= MAX_BLOG_TITLE
    ? value
    : `${value.slice(0, MAX_BLOG_TITLE - 1)}…`;
}

function normalizeAiText(raw: unknown, maxLength: number): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const normalized = lines.join("\n").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? truncateText(normalized, maxLength) : normalized;
}

function normalizeAiBlogText(raw: unknown): string {
  const text = normalizeAiText(raw, MAX_BLOG_TEXT);
  if (!text) return "";
  if (text.length < MIN_BLOG_TEXT) return "";
  return text;
}

function normalizeAiXText(raw: unknown): string {
  return normalizeAiText(raw, MAX_X_LENGTH);
}

function normalizeAiBool(raw: unknown): boolean | null {
  if (typeof raw === "boolean") return raw;
  const value = String(raw ?? "").trim().toLowerCase();
  if (["true", "yes", "1"].includes(value)) return true;
  if (["false", "no", "0"].includes(value)) return false;
  return null;
}

function normalizeAiReason(raw: unknown): string | undefined {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length <= 60 ? text : truncateText(text, 60);
}

function summarizeForBlogLocal(input: SummaryInput): BlogSummary {
  const baseTitle = sanitizeTitle(input.title) ?? "要約";
  const sentences = splitSentences(input.content ?? "");
  let text = composeSummaryText(sentences, MAX_BLOG_TEXT);
  if (text.length < MIN_BLOG_TEXT) {
    const merged = splitSentences((input.title ?? "") + " " + (input.content ?? ""));
    const expanded = composeSummaryText(merged, MAX_BLOG_TEXT);
    if (expanded.length > text.length) text = expanded;
  }
  if (!text) text = "要点が取得できませんでした。";

  return {
    title:
      baseTitle.length <= MAX_BLOG_TITLE
        ? baseTitle
        : `${baseTitle.slice(0, MAX_BLOG_TITLE - 1)}…`,
    text,
  };
}

function summarizeForXLocal(input: SummaryInput, blog?: BlogSummary): string {
  if (blog?.text) {
    const blogText = normalizeAiText(blog.text, MAX_X_LENGTH);
    if (blogText) return blogText;
  }

  const title = sanitizeTitle(input.title) ?? "";
  const sentences = splitSentences(input.content ?? "");
  const summary = sentences[0] ?? "";

  let text = "";
  if (title && summary && title !== summary) {
    text = `${title}：${summary}`;
  } else {
    text = title || summary || "要点が取得できませんでした。";
  }

  if (text.length > MAX_X_LENGTH) {
    return truncateText(text, MAX_X_LENGTH);
  }

  if (text.length < 140 && sentences.length > 1) {
    const more = sentences[1];
    const combined = `${text} ${more}`;
    return combined.length <= MAX_X_LENGTH
      ? combined
      : truncateText(combined, MAX_X_LENGTH);
  }

  return text;
}

async function summarizeForBlogAI(
  input: SummaryInput
): Promise<BlogSummary | null> {
  const articleText = await fetchArticleText(input.url, input.traceId);
  const payload = buildAiInput(input, articleText ?? undefined);
  if (!payload.title && !payload.content && !payload.article) return null;
  const persona = buildPersonaContext(input);

  const system = [
    `あなたは${persona.role}です。`,
    `読者は「${persona.persona}」です。`,
    "RSS記事と参考情報の事実を踏まえ、解釈や示唆を含む日本語のブログ下書きを作成してください。",
    "事実と推測は区別し、推測は「〜と考えられる」などで明示します。",
    "必ず日本語で、JSONのみを返してください。",
  ].join("\n");

  const user = [
    "次の記事から、読者にとって有益な情報だけを選び、300文字前後のブログ下書きを作成してください。",
    "出力JSONスキーマ:",
    "{",
    '  "title": string,',
    '  "text": string',
    "}",
    "制約:",
    "- title: 60文字以内、日本語、ペルソナが興味を持つ言い回し",
    "- text: 260〜360文字、日本語、2〜4文",
    "- 1文目: 事実の要約",
    "- 2〜4文目: 解釈/示唆/判断軸（推測は明示）",
    "- article がある場合は本文から補足し、本文に無い事項は推測扱いで明示",
    "- 翻訳だけの出力は禁止。必ず解釈や意味づけを含める",
    "- 原文が英語でも必ず日本語に翻訳して要約する",
    "- 入力に無い具体的な数値や固有名詞は追加しない",
    "- URLやハッシュタグは入れない",
    "前提:",
    `- role: ${persona.role}`,
    `- persona: ${persona.persona}`,
    "入力:",
    JSON.stringify(payload),
  ].join("\n");

  const parsed = await callOpenAIJson({
    system,
    user,
    traceId: input.traceId,
    label: "blog",
  });
  if (!parsed) return null;

  const fallbackTitle = sanitizeTitle(input.title) ?? "要約";
  const title = normalizeAiTitle(parsed?.title, fallbackTitle);
  const text = normalizeAiBlogText(parsed?.text);
  if (!text) return null;

  return {
    title,
    text,
  };
}

async function summarizeForXAI(
  input: SummaryInput,
  blog: BlogSummary
): Promise<string | null> {
  if (!blog?.text) return null;
  const persona = buildPersonaContext(input);
  const style = buildPostStyleContext(input);

  const system = [
    `あなたは${persona.role}です。`,
    `読者は「${persona.persona}」です。`,
    "ブログ下書きをもとに、解釈や示唆を含むX向け投稿文を作成してください。",
    "事実と推測は区別し、推測は「〜と考える」などで明示します。",
    "必ず日本語で、JSONのみを返してください。",
  ].join("\n");

  const user = [
    "次のブログ下書きをX向けにまとめてください。",
    "出力JSONスキーマ:",
    "{",
    '  "text": string',
    "}",
    "制約:",
    "- 日本語で140〜280文字程度",
    "- 1文目: 事実の要約",
    "- 2文目以降: 役割視点の解釈/示唆（主観は明示）",
    "- ペルソナにとっての意味/判断軸/リスク/機会を入れる",
    "- 可能であれば身近な例えを1つだけ入れる（無理なら不要）",
    "- 翻訳だけの出力は禁止。必ず解釈や意味づけを含める",
    "- ブログ下書きに無い事実は追加しない",
    "- postFormat が指定されていればその構成に従う",
    "- URLやハッシュタグは入れない",
    "前提:",
    `- role: ${persona.role}`,
    `- persona: ${persona.persona}`,
    `- postTone: ${style.postTone}`,
    `- postFormat: ${style.postFormat}`,
    "入力:",
    JSON.stringify({ blogTitle: blog.title, blogText: blog.text }),
  ].join("\n");

  const parsed = await callOpenAIJson({
    system,
    user,
    traceId: input.traceId,
    label: "x",
  });
  if (!parsed) return null;

  const text = normalizeAiXText(parsed?.text);
  if (!text) return null;
  return text;
}

export async function shouldGenerateRssDraft(
  input: SummaryInput
): Promise<{ keep: boolean; reason?: string }> {
  if (!shouldUseAI(input)) return { keep: true };
  const base = buildAiInput(input);
  if (!base.title && !base.content) return { keep: true };
  const persona = buildPersonaContext(input);

  const system = [
    `あなたは${persona.role}です。`,
    `読者は「${persona.persona}」です。`,
    "RSS記事が読者にとって有益かどうかを判断してください。",
    "必ず日本語で、JSONのみを返してください。",
  ].join("\n");

  const user = [
    "次の記事を評価し、投稿に使うべきかを判断してください。",
    "出力JSONスキーマ:",
    "{",
    '  "keep": boolean,',
    '  "reason": string',
    "}",
    "判断基準:",
    "- keep=true は「読者の意思決定・リスク・機会に具体的な影響がある情報」",
    "- 宣伝・一般論・読者に関係が薄い場合は keep=false",
    "- 判断に迷う場合は keep=false",
    "- reasonは30文字以内",
    "前提:",
    `- role: ${persona.role}`,
    `- persona: ${persona.persona}`,
    "入力:",
    JSON.stringify({ title: base.title, content: base.content }),
  ].join("\n");

  const parsed = await callOpenAIJson({
    system,
    user,
    traceId: input.traceId,
    label: "curation",
  });
  if (!parsed) return { keep: true };

  const keep = normalizeAiBool(parsed?.keep);
  const reason = normalizeAiReason(parsed?.reason);
  if (keep === null) return { keep: true };
  return { keep, reason };
}

export async function summarizeForBlog(
  input: SummaryInput
): Promise<BlogSummary> {
  const local = summarizeForBlogLocal(input);
  if (!shouldUseAI(input)) return local;
  const ai = await summarizeForBlogAI(input);
  return ai ?? local;
}

export async function summarizeForX(
  input: SummaryInput & { blog?: BlogSummary }
): Promise<string> {
  const blog = input.blog ?? (await summarizeForBlog(input));
  const local = summarizeForXLocal(input, blog);
  if (!shouldUseAI(input)) return local;
  const ai = await summarizeForXAI(input, blog);
  return ai ?? local;
}
