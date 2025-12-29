// テナント詳細取得・更新API

import { NextRequest, NextResponse } from "next/server";
import type { UpdateTenantRequest } from "@shared/tenant";
import { AppError } from "@shared/error";
import { requireAuth, requireRole, requireTenant } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { findTenantById } from "@/lib/repos/tenantRepo";

// テナント詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;

    // 自テナントまたはAdmin権限チェック
    if (context.session.role !== "Admin") {
      const tenantError = requireTenant(context.session, id, context.traceId);
      if (tenantError) return tenantError;
    }

    const tenant = await findTenantById(id);

    if (!tenant) {
      throw new AppError("NOT_FOUND", "テナントが見つかりません");
    }

    return NextResponse.json(tenant, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/tenants/:id");
  }
}

// テナント更新（Admin専用）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const { id } = await params;

    // Admin権限チェック
    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const body: UpdateTenantRequest = await request.json();

    const existing = await findTenantById(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "テナントが見つかりません");
    }

    const tenant = {
      ...existing,
      ...body,
      updatedAt: new Date(),
    };

    return NextResponse.json(tenant, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "PATCH /api/tenants/:id");
  }
}

// テナント削除（Admin専用）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const { id } = await params;

    // Admin権限チェック
    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    // TODO: DBでテナント削除（論理削除推奨）
    // await db.tenant.update({
    //   where: { id },
    //   data: { enabled: false }
    // });

    return NextResponse.json(
      { message: "テナントを無効化しました" },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "DELETE /api/tenants/:id");
  }
}
