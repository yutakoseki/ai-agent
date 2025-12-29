import { randomUUID } from "crypto";
import type { CreateUserRequest, User } from "@shared/user";
import {
  putItem,
  queryByPrefix,
  getItem,
  queryGSI2,
  updateItem,
} from "@db/tenant-client";
import type { UserItem } from "@db/types";

export async function listUsers(tenantId: string): Promise<User[]> {
  const items = await queryByPrefix<UserItem>(tenantId, "USER#");
  return items.map(mapUser);
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

export async function updateUser(
  tenantId: string,
  userId: string,
  input: Partial<Pick<User, "email" | "role" | "name">>
): Promise<User> {
  const sets: string[] = [];
  const values: Record<string, unknown> = {};

  if (input.email !== undefined) {
    sets.push("email = :email");
    values[":email"] = input.email;
  }

  if (input.role !== undefined) {
    sets.push("role = :role");
    values[":role"] = input.role;
  }

  if (input.name !== undefined) {
    sets.push("name = :name");
    values[":name"] = input.name;
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
    values
  );

  const updated = await getItem<UserItem>(tenantId, `USER#${userId}`);
  if (!updated) {
    throw new Error("User not found after update");
  }
  return mapUser(updated);
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
