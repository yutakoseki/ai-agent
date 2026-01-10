import { NextResponse } from "next/server";
import type { Session } from "@shared/auth";
import type { PermissionKey, PermissionScope } from "@shared/permissions";
import { getPermissionPolicy } from "@/lib/repos/permissionPolicyRepo";
import { requireTenant } from "@/lib/middleware/auth";

export async function getPermissionScope(params: {
  session: Session;
  key: PermissionKey;
}): Promise<PermissionScope> {
  // Adminは常に許可（ロックアウト防止）
  if (params.session.role === "Admin") return "global";

  const policy = await getPermissionPolicy(params.session.tenantId);
  const rolePolicy = policy.policy[params.session.role];
  const scope = rolePolicy?.[params.key];
  if (scope === "none" || scope === "own" || scope === "global") return scope;
  return "none";
}

export async function requirePermission(params: {
  session: Session;
  key: PermissionKey;
  traceId: string;
  resourceTenantId?: string;
}): Promise<
  | { ok: true; scope: PermissionScope }
  | { ok: false; response: NextResponse }
> {
  const scope = await getPermissionScope({
    session: params.session,
    key: params.key,
  });

  if (scope === "none") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "この操作を実行する権限がありません",
          details: { permission: params.key, role: params.session.role },
          traceId: params.traceId,
        },
        { status: 403 }
      ),
    };
  }

  // own の場合はテナント一致チェック（resourceTenantId が分かるときのみ）
  if (scope === "own" && params.resourceTenantId) {
    const tenantError = requireTenant(
      params.session,
      params.resourceTenantId,
      params.traceId
    );
    if (tenantError) {
      return { ok: false, response: tenantError };
    }
  }

  return { ok: true, scope };
}


