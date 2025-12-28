import { randomUUID } from "crypto";
import type { CreateTenantRequest, Tenant } from "@shared/tenant";
import { putItem, queryByPrefix, getItem, queryGSI1 } from "@db/tenant-client";
import type { TenantItem } from "@db/types";

export async function listTenants(): Promise<Tenant[]> {
  const items = await queryGSI1<TenantItem>("TENANT");
  return items.map(mapTenantFromGsi);
}

export async function createTenant(
  input: CreateTenantRequest
): Promise<Tenant> {
  const id = randomUUID();
  const now = new Date().toISOString();

  await putItem(id, `TENANT#${id}`, {
    name: input.name,
    plan: input.plan,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    GSI1PK: "TENANT",
    GSI1SK: now,
  });

  return {
    id,
    name: input.name,
    plan: input.plan,
    enabled: true,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

export async function findTenantById(
  tenantId: string
): Promise<Tenant | null> {
  const item = await getItem<TenantItem>(tenantId, `TENANT#${tenantId}`);
  if (!item) return null;
  return mapTenant(item);
}

function mapTenant(item: TenantItem): Tenant {
  return {
    id: item.SK.replace("TENANT#", ""),
    name: item.name,
    plan: item.plan,
    enabled: item.enabled,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

function mapTenantFromGsi(item: TenantItem): Tenant {
  return mapTenant(item);
}

