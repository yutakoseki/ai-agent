// テナント関連の型定義

export type PlanType = "Basic" | "Pro" | "Enterprise";

export interface Tenant {
  id: string;
  name: string;
  plan: PlanType;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantRequest {
  name: string;
  plan: PlanType;
  adminEmail: string;
  adminPassword: string;
}

export interface UpdateTenantRequest {
  name?: string;
  plan?: PlanType;
  enabled?: boolean;
}

export interface TenantListResponse {
  tenants: Tenant[];
  total: number;
  page: number;
  pageSize: number;
}
