import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { listEmailAccountsByUser } from "@/lib/repos/emailAccountRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const accounts = await listEmailAccountsByUser(context.session.userId);
    return NextResponse.json(
      {
        session: {
          userId: context.session.userId,
          tenantId: context.session.tenantId,
          email: context.session.email,
          role: context.session.role,
          expiresAt: context.session.expiresAt.toISOString(),
        },
        emailAccounts: {
          count: accounts.length,
          ids: accounts.map((a) => a.id),
        },
        hint: {
          note:
            "受信箱が見えない場合は、userId/tenantIdが前回と同じか、前回の連携が500で保存されていないかを確認してください。",
          requestedUrl: request.nextUrl.pathname,
        },
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/debug/session");
  }
}


