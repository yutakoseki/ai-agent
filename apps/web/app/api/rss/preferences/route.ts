import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import type { RssGenerationTarget } from "@shared/rss";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { getUserPreferences, upsertUserPreferences } from "@/lib/repos/userPreferencesRepo";

export const runtime = "nodejs";

const ALLOWED: RssGenerationTarget[] = ["blog", "x"];
const MAX_TEXT_LENGTH = 200;
const MAX_FORMAT_LENGTH = 500;

function normalizeOptionalText(
  input: unknown,
  label: string,
  maxLength = MAX_TEXT_LENGTH
): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") {
    throw new AppError("BAD_REQUEST", `${label} は文字列で指定してください`);
  }
  const trimmed = input.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new AppError("BAD_REQUEST", `${label} は${maxLength}文字以内で入力してください`);
  }
  return trimmed;
}

function normalizeOptionalMultiline(
  input: unknown,
  label: string,
  maxLength: number
): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") {
    throw new AppError("BAD_REQUEST", `${label} は文字列で指定してください`);
  }
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const joined = lines.join("\n").trim();
  if (!joined) return null;
  if (joined.length > maxLength) {
    throw new AppError("BAD_REQUEST", `${label} は${maxLength}文字以内で入力してください`);
  }
  return joined;
}

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const prefs = await getUserPreferences({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
    });
    const targets =
      prefs?.rssGenerationTargets && prefs.rssGenerationTargets.length
        ? prefs.rssGenerationTargets
        : ["x"];
    return NextResponse.json(
      {
        generationTargets: targets,
        writerRole: prefs?.rssWriterRole ?? "",
        targetPersona: prefs?.rssTargetPersona ?? "",
        postTone: prefs?.rssPostTone ?? "",
        postFormat: prefs?.rssPostFormat ?? "",
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/rss/preferences");
  }
}

export async function PATCH(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const body = await request.json().catch(() => ({}));
    const raw = body?.generationTargets;
    if (!Array.isArray(raw)) {
      throw new AppError("BAD_REQUEST", "generationTargets は配列で指定してください");
    }
    const targets = raw
      .map((v: any) => String(v))
      .filter((v: string) => (ALLOWED as string[]).includes(v)) as RssGenerationTarget[];
    if (targets.length === 0) {
      throw new AppError("BAD_REQUEST", "少なくとも1つの出力先を選択してください");
    }

    const hasWriterRole = Object.prototype.hasOwnProperty.call(body ?? {}, "writerRole");
    const hasTargetPersona = Object.prototype.hasOwnProperty.call(body ?? {}, "targetPersona");
    const hasPostTone = Object.prototype.hasOwnProperty.call(body ?? {}, "postTone");
    const hasPostFormat = Object.prototype.hasOwnProperty.call(body ?? {}, "postFormat");
    const writerRole = hasWriterRole ? normalizeOptionalText(body?.writerRole, "ロール") : undefined;
    const targetPersona = hasTargetPersona
      ? normalizeOptionalText(body?.targetPersona, "ペルソナ")
      : undefined;
    const postTone = hasPostTone
      ? normalizeOptionalText(body?.postTone, "ポストのテイスト")
      : undefined;
    const postFormat = hasPostFormat
      ? normalizeOptionalMultiline(body?.postFormat, "出力フォーマット", MAX_FORMAT_LENGTH)
      : undefined;

    const saved = await upsertUserPreferences({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
      rssGenerationTargets: targets,
      rssWriterRole: writerRole,
      rssTargetPersona: targetPersona,
      rssPostTone: postTone,
      rssPostFormat: postFormat,
    });

    return NextResponse.json(
      {
        generationTargets: saved.rssGenerationTargets ?? ["x"],
        writerRole: saved.rssWriterRole ?? "",
        targetPersona: saved.rssTargetPersona ?? "",
        postTone: saved.rssPostTone ?? "",
        postFormat: saved.rssPostFormat ?? "",
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "PATCH /api/rss/preferences");
  }
}
