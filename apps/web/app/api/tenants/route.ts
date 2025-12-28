// テナント一覧取得・作成API

import { NextRequest, NextResponse } from "next/server";
import type { CreateTenantRequest, TenantListResponse } from "@shared/tenant";
import { AppError } from "@shared/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { hashPassword } from "@/lib/auth/password";
import { listTenants, createTenant } from "@/lib/repos/tenantRepo";
import { createUser } from "@/lib/repos/userRepo";

// テナント一覧取得（Admin専用）
export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    // Admin権限チェック
    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const tenants = await listTenants();
    const result: TenantListResponse = {
      tenants,
      total: tenants.length,
      page: 1,
      pageSize: tenants.length,
    };

    return NextResponse.json(result, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/tenants");
  }
}

// テナント作成（Admin専用）
export async function POST(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    // Admin権限チェック
    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const body: CreateTenantRequest = await request.json();

    // バリデーション
    if (!body.name || !body.plan || !body.adminEmail || !body.adminPassword) {
      throw new AppError("BAD_REQUEST", "必須項目が不足しています");
    }

    const passwordHash = await hashPassword(body.adminPassword);

    const tenant = await createTenant(body);
    await createUser(tenant.id, {
      email: body.adminEmail,
      password: body.adminPassword,
      role: "Admin",
      name: "Admin",
    }, passwordHash);

    return NextResponse.json(tenant, {
      status: 201,
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/tenants");
  }
}
