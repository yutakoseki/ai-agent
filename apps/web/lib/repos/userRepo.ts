import { randomUUID } from "crypto";
import type { CreateUserRequest, User } from "@shared/user";
import { putItem, queryByPrefix, getItem } from "@db/tenant-client";
import type { UserItem } from "@db/types";

export async function listUsers(tenantId: string): Promise<User[]> {
  const items = await queryByPrefix<UserItem>(tenantId, "USER#");
  return items.map(mapUser);
}

export async function createUser(
  tenantId: string,
  input: CreateUserRequest,
  passwordHash: string
): Promise<User> {
  const id = randomUUID();
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

