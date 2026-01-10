import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { queryByPrefix } from "@db/tenant-client";
import type { EmailAccountItem } from "@db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const forbidden = requireRole(context.session, ["Admin"], context.traceId);
    if (forbidden) return forbidden;

    const tenantId = context.session.tenantId;
    const items = await queryByPrefix<EmailAccountItem>(tenantId, "EMAIL_ACCOUNT#");

    return NextResponse.json(
      {
        tenantId,
        count: items.length,
        accounts: items.map((a) => ({
          id: a.id,
          email: a.email,
          provider: a.provider,
          userId: a.userId,
          status: a.status,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error instanceof AppError ? error : error, context.traceId, "GET /api/debug/email-accounts");
  }
}


