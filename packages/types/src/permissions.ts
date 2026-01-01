import type { UserRole } from "./auth";

// 「どの機能を」「どの範囲で」許可するか
export type PermissionScope = "none" | "own" | "global";

// 追加する権限キーはここに集約する（UI/サーバー/APIで共有）
export type PermissionKey =
  | "tenant.list" // GET /api/tenants
  | "tenant.create" // POST /api/tenants
  | "tenant.read" // GET /api/tenants/:id
  | "tenant.update" // PATCH /api/tenants/:id
  | "tenant.delete" // DELETE /api/tenants/:id
  | "tenantApplication.view" // /admin/tenant-applications
  | "tenantApplication.review" // PATCH /api/tenant-applications/:id
  | "tenantApplication.edit"; // PUT /api/tenant-applications/:id

export type PermissionPolicy = Record<
  Exclude<UserRole, "Admin">,
  Partial<Record<PermissionKey, PermissionScope>>
>;

export type PermissionPolicyResponse = {
  tenantId: string;
  policy: PermissionPolicy;
  updatedAt?: string;
  updatedByUserId?: string;
  version: number;
};


