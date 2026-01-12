import { sanitizeTitle } from "./parser";

type SummaryInput = {
  title?: string;
  content?: string;
};

type BlogSummary = {
  title: string;
  text: string;
};

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  const cleaned = collapse(text);
  if (!cleaned) return [];
  const parts = cleaned.split(/(?<=[。.!?])\s+/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function uniqueShortSentences(sentences: string[], max: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of sentences) {
    const trimmed = s.replace(/\s+/g, " ").trim();
    if (!trimmed || trimmed.length < 12) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed.length <= 120 ? trimmed : `${trimmed.slice(0, 119)}…`);
    if (result.length >= max) break;
  }
  return result;
}

export function summarizeForBlog(input: SummaryInput): BlogSummary {
  const baseTitle = sanitizeTitle(input.title) ?? "要約";
  const sentences = splitSentences(input.content ?? "");
  const bullets = uniqueShortSentences(sentences, 5);
  const finalBullets = bullets.length >= 3 ? bullets : bullets.concat(
    uniqueShortSentences(splitSentences((input.title ?? "") + " " + (input.content ?? "")), 5)
  ).slice(0, 5);

  const bulletText = (finalBullets.length ? finalBullets : ["要点が取得できませんでした。"])
    .slice(0, 5)
    .map((line) => `- ${line}`)
    .join("\n");

  return {
    title: baseTitle.length <= 60 ? baseTitle : `${baseTitle.slice(0, 59)}…`,
    text: bulletText,
  };
}

export function summarizeForX(input: SummaryInput): string {
  const title = sanitizeTitle(input.title) ?? "";
  const sentences = splitSentences(input.content ?? "");
  const summary = sentences[0] ?? "";

  let text = "";
  if (title && summary && title !== summary) {
    text = `${title}：${summary}`;
  } else {
    text = title || summary || "要点が取得できませんでした。";
  }

  if (text.length > 280) {
    return `${text.slice(0, 279)}…`;
  }

  if (text.length < 140 && sentences.length > 1) {
    const more = sentences[1];
    const combined = `${text} ${more}`;
    return combined.length <= 280 ? combined : `${combined.slice(0, 279)}…`;
  }

  return text;
}
