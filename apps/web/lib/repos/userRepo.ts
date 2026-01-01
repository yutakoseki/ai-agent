import { randomUUID } from "crypto";
import type { CreateUserRequest, User } from "@shared/user";
import {
  putItem,
  queryByPrefix,
  queryByPrefixPage,
  getItem,
  queryGSI1,
  queryGSI1Page,
  queryGSI2,
  transactWrite,
  updateItem,
  deleteItem,
} from "@db/tenant-client";
import type { UserItem } from "@db/types";
import { AppError } from "@shared/error";

export async function listUsers(tenantId: string): Promise<User[]> {
  const items = await queryByPrefix<UserItem>(tenantId, "USER#");
  return items.map(mapUser);
}

export async function listAllUsers(): Promise<User[]> {
  // NOTE: GSI1PK="USER" で全テナントのユーザーを横断取得
  const items = await queryGSI1<UserItem>("USER");
  return items.map(mapUser);
}

export async function listUsersPage(
  tenantId: string,
  opts: { limit: number; cursor?: string }
): Promise<{ users: User[]; nextCursor?: string }> {
  const page = await queryByPrefixPage<UserItem>(tenantId, "USER#", opts);
  return { users: page.items.map(mapUser), nextCursor: page.nextCursor };
}

export async function listAllUsersPage(opts: {
  limit: number;
  cursor?: string;
}): Promise<{ users: User[]; nextCursor?: string }> {
  const page = await queryGSI1Page<UserItem>("USER", opts);
  return { users: page.items.map(mapUser), nextCursor: page.nextCursor };
}

function normalizeQuery(q: string | undefined | null): string {
  return (q ?? "").trim().toLowerCase();
}

function matchesUserQuery(user: UserItem, q: string): boolean {
  if (!q) return true;
  const name = (user.name ?? "").toLowerCase();
  const email = (user.email ?? "").toLowerCase();
  return name.includes(q) || email.includes(q);
}

/**
 * ページングしながら検索（name/email 部分一致）を行う。
 * - q が空なら通常のページング一覧
 * - q がある場合は「DB全体（対象スコープ全体）」を順に走査して一致を集める
 */
export async function searchUsersPage(opts: {
  tenantId?: string; // 指定時: テナント内検索 / 未指定: 全テナント検索（GSI1）
  q?: string;
  limit: number;
  cursor?: string;
}): Promise<{ users: User[]; nextCursor?: string }> {
  const limit = Math.max(1, Math.min(opts.limit, 20));
  const q = normalizeQuery(opts.q);

  // q が空なら、普通に1ページ返すだけ（高速）
  if (!q) {
    if (opts.tenantId) return listUsersPage(opts.tenantId, { limit, cursor: opts.cursor });
    return listAllUsersPage({ limit, cursor: opts.cursor });
  }

  const users: User[] = [];
  let cursor = opts.cursor;

  while (users.length < limit) {
    const remaining = limit - users.length;

    const page = opts.tenantId
      ? await queryByPrefixPage<UserItem>(opts.tenantId, "USER#", {
          limit: remaining,
          cursor,
        })
      : await queryGSI1Page<UserItem>("USER", { limit: remaining, cursor });

    for (const item of page.items) {
      if (matchesUserQuery(item, q)) {
        users.push(mapUser(item));
      }
    }

    cursor = page.nextCursor;
    if (!cursor) break;
  }

  return { users, nextCursor: cursor };
}

export async function createUser(
  tenantId: string,
  input: CreateUserRequest,
  passwordHash: string,
  userId?: string
): Promise<User> {
  const id = userId ?? randomUUID();
  const now = new Date().toISOString();

  await putItem(tenantId, `USER#${id}`, {
    email: input.email,
    role: input.role,
    name: input.name,
    passwordHash,
    createdAt: now,
    updatedAt: now,
    GSI1PK: "USER",
    GSI1SK: now,
    GSI2PK: `USER#${id}`,
    GSI2SK: `TENANT#${tenantId}`,
  });

  return {
    id,
    tenantId,
    email: input.email,
    role: input.role,
    name: input.name,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

export async function findUser(
  tenantId: string,
  userId: string
): Promise<User | null> {
  const item = await getItem<UserItem>(tenantId, `USER#${userId}`);
  if (!item) return null;
  return mapUser(item);
}

export async function findUserByUserId(
  userId: string
): Promise<User | null> {
  const items = await queryGSI2<UserItem>(`USER#${userId}`);
  if (items.length === 0) return null;
  return mapUser(items[0]);
}

export async function moveUserToTenant(
  userId: string,
  destTenantId: string
): Promise<User> {
  const items = await queryGSI2<UserItem>(`USER#${userId}`);
  if (items.length === 0) {
    throw new Error("User not found");
  }

  const current = items[0];
  const srcTenantId = current.PK.replace("TENANT#", "");
  if (srcTenantId === destTenantId) {
    return mapUser(current);
  }

  const now = new Date().toISOString();
  const sk = `USER#${userId}` as const;

  const nextItem: UserItem = {
    PK: `TENANT#${destTenantId}`,
    SK: sk,
    email: current.email,
    role: current.role,
    name: current.name,
    passwordHash: current.passwordHash,
    createdAt: current.createdAt,
    updatedAt: now,
    GSI1PK: "USER",
    GSI1SK: current.GSI1SK ?? current.createdAt,
    GSI2PK: `USER#${userId}`,
    GSI2SK: `TENANT#${destTenantId}`,
  };

  await transactWrite([
    {
      Put: {
        Item: nextItem,
        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      },
    },
    {
      Delete: {
        Key: { PK: `TENANT#${srcTenantId}`, SK: sk },
        ConditionExpression:
          "attribute_exists(PK) AND attribute_exists(SK)",
      },
    },
  ]);

  return mapUser(nextItem);
}

export async function updateUser(
  tenantId: string,
  userId: string,
  input: Partial<Pick<User, "email" | "role" | "name">>
): Promise<User> {
  const sets: string[] = [];
  const values: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  if (input.email !== undefined) {
    sets.push("email = :email");
    values[":email"] = input.email;
  }

  if (input.role !== undefined) {
    // DynamoDB reserved keyword 対策
    sets.push("#role = :role");
    values[":role"] = input.role;
    names["#role"] = "role";
  }

  if (input.name !== undefined) {
    // DynamoDB reserved keyword 対策（name も予約語）
    sets.push("#name = :name");
    values[":name"] = input.name;
    names["#name"] = "name";
  }

  const now = new Date().toISOString();
  sets.push("updatedAt = :updatedAt");
  values[":updatedAt"] = now;

  if (sets.length === 1) {
    const current = await getItem<UserItem>(tenantId, `USER#${userId}`);
    if (!current) {
      throw new Error("User not found");
    }
    return mapUser(current);
  }

  await updateItem(
    tenantId,
    `USER#${userId}`,
    `SET ${sets.join(", ")}`,
    values,
    Object.keys(names).length ? names : undefined
  );

  const updated = await getItem<UserItem>(tenantId, `USER#${userId}`);
  if (!updated) {
    throw new Error("User not found after update");
  }
  return mapUser(updated);
}

export async function updateUserPasswordHash(
  tenantId: string,
  userId: string,
  passwordHash: string
): Promise<void> {
  const now = new Date().toISOString();
  await updateItem(
    tenantId,
    `USER#${userId}`,
    "SET passwordHash = :passwordHash, updatedAt = :updatedAt",
    {
      ":passwordHash": passwordHash,
      ":updatedAt": now,
    }
  );
}

export async function deleteUser(tenantId: string, userId: string): Promise<void> {
  try {
    await deleteItem(tenantId, `USER#${userId}`);
  } catch (error) {
    // ConditionExpression により、存在しない場合は ConditionalCheckFailedException になり得る
    if (error && typeof error === "object" && "name" in error) {
      const name = String((error as { name?: string }).name);
      if (name === "ConditionalCheckFailedException") {
        throw new AppError("NOT_FOUND", "ユーザーが見つかりません");
      }
    }
    throw error;
  }
}

function mapUser(item: UserItem): User {
  return {
    id: item.SK.replace("USER#", ""),
    tenantId: item.PK.replace("TENANT#", ""),
    email: item.email,
    role: item.role,
    name: item.name,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}
