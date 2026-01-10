// テナント申請API（公開: 申請POST / 管理者: 一覧GET）

import { NextRequest, NextResponse } from "next/server";
import type {
  CreateTenantApplicationRequest,
  TenantApplicationListResponse,
} from "@shared/tenantApplication";
import { AppError } from "@shared/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { consumeRateLimit } from "@/lib/middleware/rateLimit";
import {
  buildRequestContext,
  logRequestEnd,
  logRequestStart,
} from "@/lib/observability";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import {
  createTenantApplication,
  listTenantApplications,
} from "@/lib/repos/tenantApplicationRepo";
import { sendTenantApplicationEmails } from "@/lib/notifications/tenantApplicationEmails";

export const runtime = "nodejs";

// 申請（公開）
export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);
  const csrfError = requireCsrf(request, context.traceId);
  if (csrfError) return csrfError;

  logRequestStart(request, context, "POST /api/tenant-applications");
  let response: NextResponse | undefined;

  try {
    const body: CreateTenantApplicationRequest = await request.json();

    const rateLimitResult = consumeRateLimit({
      key: `tenant_application:${context.clientIp ?? "unknown"}:${
        body.contactEmail?.toLowerCase?.() ?? "unknown"
      }`,
      windowMs: 60_000,
      limit: 3,
      traceId: context.traceId,
      label: "tenant_application",
    });
    if (rateLimitResult.response) {
      response = rateLimitResult.response;
      return response;
    }

    if (!body.tenantName || !body.plan || !body.contactEmail) {
      throw new AppError("BAD_REQUEST", "必須項目が不足しています");
    }

    const application = await createTenantApplication({
      tenantName: body.tenantName,
      plan: body.plan,
      contactEmail: body.contactEmail,
      contactName: body.contactName,
      note: body.note,
    });

    // 受付メール（best-effort）
    try {
      await sendTenantApplicationEmails({
        application,
        origin: request.nextUrl.origin,
      });
    } catch (error) {
      logger.warn("tenantApplication email unexpected failure", {
        traceId: context.traceId,
        applicationId: application.id,
        error,
      });
    }

    response = NextResponse.json(application, {
      status: 201,
      headers: { "X-Trace-Id": context.traceId },
    });

    writeAuditLog({
      action: "tenantApplication.submit",
      result: "success",
      traceId: context.traceId,
      ip: context.clientIp,
      userAgent: context.userAgent,
      target: { tenantName: body.tenantName, contactEmail: body.contactEmail },
      metadata: { path: "/api/tenant-applications", method: "POST" },
    });

    return response;
  } catch (error) {
    response = handleError(error, context.traceId, "POST /api/tenant-applications");
    writeAuditLog({
      action: "tenantApplication.submit",
      result: "failure",
      traceId: context.traceId,
      ip: context.clientIp,
      userAgent: context.userAgent,
      metadata: { path: "/api/tenant-applications", method: "POST" },
      reason: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "unknown error",
    });
    return response;
  } finally {
    logRequestEnd(context, response?.status ?? 500, "POST /api/tenant-applications");
  }
}

// 一覧（Admin専用）
export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const applications = await listTenantApplications();
    const result: TenantApplicationListResponse = {
      applications,
      total: applications.length,
    };

    return NextResponse.json(result, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/tenant-applications");
  }
}


