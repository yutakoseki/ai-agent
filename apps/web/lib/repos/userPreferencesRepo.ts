import type { MailCategory } from "@shared/mail";
import { getItem, putItem, updateItem } from "@db/tables/user-preferences";

export type UserPreferences = {
  tenantId: string;
  userId: string;
  taskVisibleCategories?: MailCategory[];
  createdAt: Date;
  updatedAt: Date;
};

type UserPreferencesItem = {
  PK: `TENANT#${string}`;
  SK: `USER_PREFS#USER#${string}`;
  userId: string;
  taskVisibleCategories?: MailCategory[];
  createdAt: string;
  updatedAt: string;
};

function mapPrefs(item: UserPreferencesItem): UserPreferences {
  return {
    tenantId: item.PK.replace("TENANT#", ""),
    userId: item.userId,
    taskVisibleCategories: item.taskVisibleCategories,
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
}): Promise<UserPreferences> {
  const now = new Date().toISOString();
  const key = sk(params.userId);

  const item: Omit<UserPreferencesItem, "PK" | "SK"> = {
    userId: params.userId,
    taskVisibleCategories: params.taskVisibleCategories ?? undefined,
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

    await updateItem(params.tenantId, key, `SET ${sets.join(", ")}`, values);
  }

  const saved = await getItem<UserPreferencesItem>(params.tenantId, key);
  if (!saved) throw new Error("UserPreferences not found after upsert");
  return mapPrefs(saved);
}


