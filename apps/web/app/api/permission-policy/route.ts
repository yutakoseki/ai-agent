import { NextRequest, NextResponse } from "next/server";
import type { PermissionPolicy } from "@shared/permissions";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import {
  getPermissionPolicy,
  setPermissionPolicy,
} from "@/lib/repos/permissionPolicyRepo";

export const runtime = "nodejs";

// 現在のテナントの権限ポリシーを取得
export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const policy = await getPermissionPolicy(context.session.tenantId);
    return NextResponse.json(policy, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/permission-policy");
  }
}

// 現在のテナントの権限ポリシーを更新（Adminのみ）
export async function PATCH(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const body: { policy?: PermissionPolicy } = await request.json();
    const next = await setPermissionPolicy({
      tenantId: context.session.tenantId,
      actorUserId: context.session.userId,
      policy: body.policy ?? { Manager: {}, Member: {} },
    });

    return NextResponse.json(next, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "PATCH /api/permission-policy");
  }
}


