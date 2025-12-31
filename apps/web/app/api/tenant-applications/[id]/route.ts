// テナント申請の承認/却下（Admin専用）

import { NextRequest, NextResponse } from "next/server";
import type { ReviewTenantApplicationRequest } from "@shared/tenantApplication";
import { AppError } from "@shared/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { createTenant } from "@/lib/repos/tenantRepo";
import {
  findTenantApplicationById,
  reviewTenantApplication,
} from "@/lib/repos/tenantApplicationRepo";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const roleError = requireRole(context.session, ["Admin"], context.traceId);
    if (roleError) return roleError;

    const { id } = await params;
    const body: ReviewTenantApplicationRequest = await request.json();

    if (!body?.decision || !["approve", "reject"].includes(body.decision)) {
      throw new AppError("BAD_REQUEST", "decision は approve または reject を指定してください");
    }

    const current = await findTenantApplicationById(id);
    if (!current) {
      throw new AppError("NOT_FOUND", "テナント申請が見つかりません");
    }

    let createdTenantId: string | undefined;
    if (body.decision === "approve") {
      const tenant = await createTenant({
        name: current.tenantName,
        plan: current.plan,
      });
      createdTenantId = tenant.id;
    }

    const updated = await reviewTenantApplication({
      id,
      decision: body.decision,
      decisionNote: body.decisionNote,
      decidedByUserId: context.session.userId,
      createdTenantId,
    });

    writeAuditLog({
      action: "tenantApplication.review",
      result: "success",
      actorUserId: context.session.userId,
      tenantId: context.session.tenantId,
      traceId: context.traceId,
      target: { applicationId: id, decision: body.decision, createdTenantId },
      metadata: { path: "/api/tenant-applications/:id", method: "PATCH" },
    });

    return NextResponse.json(updated, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    writeAuditLog({
      action: "tenantApplication.review",
      result: "failure",
      actorUserId: context.session.userId,
      tenantId: context.session.tenantId,
      traceId: context.traceId,
      metadata: { path: "/api/tenant-applications/:id", method: "PATCH" },
      reason: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "unknown error",
    });

    return handleError(error, context.traceId, "PATCH /api/tenant-applications/:id");
  }
}


