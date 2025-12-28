// テナント詳細取得・更新API

import { NextRequest, NextResponse } from "next/server";
import type { UpdateTenantRequest } from "@shared/tenant";
import { AppError } from "@shared/error";
import { requireAuth, requireRole, requireTenant } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";

// TODO: DB接続後に実装
const MOCK_TENANT = {
  id: "tenant-1",
  name: "サンプルテナント",
  plan: "Pro" as const,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

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

    // TODO: DBからテナント取得
    // const tenant = await db.tenant.findUnique({ where: { id } });
    const tenant = id === MOCK_TENANT.id ? MOCK_TENANT : null;

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
    const { id } = await params;

    // Admin権限チェック
    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const body: UpdateTenantRequest = await request.json();

    // TODO: DBでテナント更新
    // const tenant = await db.tenant.update({
    //   where: { id },
    //   data: body
    // });

    const tenant = {
      ...MOCK_TENANT,
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
