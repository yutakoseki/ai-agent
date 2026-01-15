import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@shared/error";
import type { XPostPayload, XPostSourceType, XPostTopic } from "@shared/x-posts";
import { logger } from "@/lib/logger";

const PROMPT_FILENAME = "Xポストシステムプロンプト.md";

async function resolvePromptPath(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), PROMPT_FILENAME),
    path.resolve(process.cwd(), "..", "..", PROMPT_FILENAME),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return candidates[0];
}

function formatDateJst(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

async function loadPrompt(): Promise<string> {
  try {
    const promptPath = await resolvePromptPath();
    const raw = await readFile(promptPath, "utf8");
    return raw.trim();
  } catch (error) {
    logger.warn("x-post prompt read failed", { error, filename: PROMPT_FILENAME });
    throw new AppError("BAD_REQUEST", "システムプロンプトが読み込めません");
  }
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

function normalizeUrl(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const md = text.match(/\((https?:\/\/[^)]+)\)/);
  if (md?.[1]) return md[1].trim();
  const angle = text.match(/<(https?:\/\/[^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  return text.replace(/\s+/g, "");
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeImportance(raw: unknown): XPostTopic["importance"] {
  const value = normalizeString(raw);
  if (value === "High" || value === "Medium" || value === "Low") return value;
  return "Medium";
}

function normalizeSourceType(raw: unknown): XPostSourceType {
  const value = normalizeString(raw);
  if (value === "Official" || value === "Community" || value === "TechMedia" || value === "X") {
    return value;
  }
  return "Official";
}

function normalizeUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeUrl).filter(Boolean);
  }
  const text = normalizeUrl(raw);
  return text ? [text] : [];
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeString).filter(Boolean);
  }
  const text = normalizeString(raw);
  return text ? [text] : [];
}

function normalizeTopic(raw: any, fallbackRank: number): XPostTopic {
  const rankRaw = Number(raw?.rank);
  const rank = Number.isFinite(rankRaw) ? rankRaw : fallbackRank;
  const postTypeCode = normalizeString(raw?.post_type_code ?? raw?.postTypeCode);
  const postTypeName = normalizeString(raw?.post_type_name ?? raw?.postTypeName);

  return {
    rank,
    importance: normalizeImportance(raw?.importance),
    title: normalizeString(raw?.title),
    summary: normalizeString(raw?.summary),
    postTypeCode,
    postTypeName,
    publishedDate: normalizeString(raw?.published_date ?? raw?.publishedDate),
    urls: normalizeUrls(raw?.urls),
    tags: normalizeTags(raw?.tags),
    image: normalizeUrl(raw?.image),
    sourceType: normalizeSourceType(raw?.source_type ?? raw?.sourceType),
  };
}

function normalizePayload(raw: any, fallbackDate: string): XPostPayload {
  const date = normalizeString(raw?.date) || fallbackDate;
  const topicsRaw = Array.isArray(raw?.topics) ? raw.topics : [];
  const topics: XPostTopic[] = topicsRaw.map((topic: any, index: number) =>
    normalizeTopic(topic, index + 1)
  );
  topics.sort((a, b) => a.rank - b.rank);
  return {
    date,
    topics: topics.slice(0, 5),
  };
}

export async function generateXPostPayload(params: {
  traceId?: string;
}): Promise<XPostPayload> {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new AppError("BAD_REQUEST", "OPENAI_API_KEY が未設定です");
  }
  const model = process.env.OPENAI_MODEL || "gpt-5.2-nano";
  const temperature = supportsTemperature(model) ? 0.2 : undefined;
  const date = formatDateJst();

  const prompt = await loadPrompt();
  const user = [
    `現在日時: ${date} JST`,
    "今日の最新トピックを出力してください。",
  ].join("\n");

  const startedAt = Date.now();
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: user },
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
    logger.warn("openai x-post generate failed", {
      traceId: params.traceId,
      status: res.status,
      durationMs: Date.now() - startedAt,
      model,
      code: err?.code ?? null,
      type: err?.type ?? null,
      message: err?.message ?? null,
    });
    throw new AppError("BAD_REQUEST", "AIの呼び出しに失敗しました");
  }

  const content = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!content) {
    logger.warn("openai x-post generate empty", {
      traceId: params.traceId,
      durationMs: Date.now() - startedAt,
      model,
    });
    throw new AppError("BAD_REQUEST", "AIの出力が空でした");
  }

  try {
    const parsed = parseJsonLoose(content);
    return normalizePayload(parsed, date);
  } catch (error) {
    logger.warn("openai x-post generate parse failed", {
      traceId: params.traceId,
      error,
      content: content.slice(0, 500),
    });
    throw new AppError("BAD_REQUEST", "AIの出力が不正なJSONでした");
  }
}
