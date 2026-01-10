import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { listEmailAccountsByUser } from "@/lib/repos/emailAccountRepo";
import { listUserEmailSubscriptions } from "@/lib/repos/userEmailSubscriptionRepo";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const accounts = await listEmailAccountsByUser(context.session.userId);
    const subs = await listUserEmailSubscriptions({ userId: context.session.userId });
    const byAccountId = new Map(subs.map((s) => [s.accountId, s]));

    const result = accounts.map((acc) => {
      const sub = byAccountId.get(acc.id);
      return {
        id: acc.id,
        provider: acc.provider,
        email: acc.email,
        status: acc.status,
        createdAt: acc.createdAt.toISOString(),
        updatedAt: acc.updatedAt.toISOString(),
        monitoringEnabled: sub ? sub.monitoringEnabled : true,
        pushEnabled: sub ? sub.pushEnabled : true,
      };
    });

    return NextResponse.json(
      { accounts: result },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/email-accounts");
  }
}


