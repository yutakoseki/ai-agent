// テナント一覧取得・作成API

import { NextRequest, NextResponse } from "next/server";
import type { CreateTenantRequest, TenantListResponse } from "@shared/tenant";
import { AppError } from "@shared/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { hashPassword } from "@/lib/auth/password";
import { randomUUID } from "crypto";

// TODO: DB接続後に実装
const MOCK_TENANTS = [
  {
    id: "tenant-1",
    name: "サンプルテナント",
    plan: "Pro" as const,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// テナント一覧取得（Admin専用）
export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    // Admin権限チェック
    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    // TODO: DBからテナント一覧取得
    // const tenants = await db.tenant.findMany();

    const result: TenantListResponse = {
      tenants: MOCK_TENANTS,
      total: MOCK_TENANTS.length,
      page: 1,
      pageSize: 10,
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
    // Admin権限チェック
    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const body: CreateTenantRequest = await request.json();

    // バリデーション
    if (!body.name || !body.plan || !body.adminEmail || !body.adminPassword) {
      throw new AppError("BAD_REQUEST", "必須項目が不足しています");
    }

    // TODO: DBにテナント作成
    const tenantId = randomUUID();
    const userId = randomUUID();
    const passwordHash = await hashPassword(body.adminPassword);

    // const tenant = await db.tenant.create({
    //   data: {
    //     id: tenantId,
    //     name: body.name,
    //     plan: body.plan,
    //     enabled: true
    //   }
    // });

    // const user = await db.user.create({
    //   data: {
    //     id: userId,
    //     tenantId,
    //     email: body.adminEmail,
    //     passwordHash,
    //     role: 'Admin'
    //   }
    // });

    const tenant = {
      id: tenantId,
      name: body.name,
      plan: body.plan,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json(tenant, {
      status: 201,
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/tenants");
  }
}
