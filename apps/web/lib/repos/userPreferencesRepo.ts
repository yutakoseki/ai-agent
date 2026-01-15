import type { MailCategory } from "@shared/mail";
import type { RssGenerationTarget } from "@shared/rss";
import { getItem, putItem, updateItem } from "@db/tables/user-preferences";

export type UserPreferences = {
  tenantId: string;
  userId: string;
  taskVisibleCategories?: MailCategory[];
  rssGenerationTargets?: RssGenerationTarget[];
  rssWriterRole?: string;
  rssTargetPersona?: string;
  rssPostTone?: string;
  rssPostFormat?: string;
  createdAt: Date;
  updatedAt: Date;
};

type UserPreferencesItem = {
  PK: `TENANT#${string}`;
  SK: `USER_PREFS#USER#${string}`;
  userId: string;
  taskVisibleCategories?: MailCategory[];
  rssGenerationTargets?: RssGenerationTarget[];
  rssWriterRole?: string | null;
  rssTargetPersona?: string | null;
  rssPostTone?: string | null;
  rssPostFormat?: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapPrefs(item: UserPreferencesItem): UserPreferences {
  return {
    tenantId: item.PK.replace("TENANT#", ""),
    userId: item.userId,
    taskVisibleCategories: item.taskVisibleCategories,
    rssGenerationTargets: item.rssGenerationTargets,
    rssWriterRole: item.rssWriterRole ?? undefined,
    rssTargetPersona: item.rssTargetPersona ?? undefined,
    rssPostTone: item.rssPostTone ?? undefined,
    rssPostFormat: item.rssPostFormat ?? undefined,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

function sk(userId: string) {
  return `USER_PREFS#USER#${userId}` as const;
}

export async function getUserPreferences(params: {
  tenantId: string;
  userId: string;
}): Promise<UserPreferences | null> {
  const item = await getItem<UserPreferencesItem>(params.tenantId, sk(params.userId));
  return item ? mapPrefs(item) : null;
}

export async function upsertUserPreferences(params: {
  tenantId: string;
  userId: string;
  taskVisibleCategories?: MailCategory[] | null;
  rssGenerationTargets?: RssGenerationTarget[] | null;
  rssWriterRole?: string | null;
  rssTargetPersona?: string | null;
  rssPostTone?: string | null;
  rssPostFormat?: string | null;
}): Promise<UserPreferences> {
  const now = new Date().toISOString();
  const key = sk(params.userId);

  const item: Omit<UserPreferencesItem, "PK" | "SK"> = {
    userId: params.userId,
    taskVisibleCategories: params.taskVisibleCategories ?? undefined,
    rssGenerationTargets: params.rssGenerationTargets ?? undefined,
    rssWriterRole: params.rssWriterRole ?? undefined,
    rssTargetPersona: params.rssTargetPersona ?? undefined,
    rssPostTone: params.rssPostTone ?? undefined,
    rssPostFormat: params.rssPostFormat ?? undefined,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putItem(params.tenantId, key, item as any);
  } catch (error: any) {
    const name = error && typeof error === "object" ? String(error.name) : "";
    if (name !== "ConditionalCheckFailedException") throw error;

    const sets: string[] = ["updatedAt = :updatedAt"];
    const values: Record<string, unknown> = { ":updatedAt": now };

    if (params.taskVisibleCategories !== undefined) {
      sets.push("taskVisibleCategories = :cats");
      values[":cats"] = params.taskVisibleCategories ?? null;
    }
    if (params.rssGenerationTargets !== undefined) {
      sets.push("rssGenerationTargets = :rssTargets");
      values[":rssTargets"] = params.rssGenerationTargets ?? null;
    }
    if (params.rssWriterRole !== undefined) {
      sets.push("rssWriterRole = :rssWriterRole");
      values[":rssWriterRole"] = params.rssWriterRole ?? null;
    }
    if (params.rssTargetPersona !== undefined) {
      sets.push("rssTargetPersona = :rssTargetPersona");
      values[":rssTargetPersona"] = params.rssTargetPersona ?? null;
    }
    if (params.rssPostTone !== undefined) {
      sets.push("rssPostTone = :rssPostTone");
      values[":rssPostTone"] = params.rssPostTone ?? null;
    }
    if (params.rssPostFormat !== undefined) {
      sets.push("rssPostFormat = :rssPostFormat");
      values[":rssPostFormat"] = params.rssPostFormat ?? null;
    }

    await updateItem(params.tenantId, key, `SET ${sets.join(", ")}`, values);
  }

  const saved = await getItem<UserPreferencesItem>(params.tenantId, key);
  if (!saved) throw new Error("UserPreferences not found after upsert");
  return mapPrefs(saved);
}
