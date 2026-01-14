import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { listXPostBatchesByUser } from "@/lib/repos/xPostBatchRepo";
import { toViewBatch } from "@/lib/x-posts/serializer";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 10;
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 10;

    const batches = await listXPostBatchesByUser({ userId: context.session.userId });
    const sorted = batches.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const sliced = sorted.slice(0, safeLimit);

    return NextResponse.json(
      { batches: sliced.map(toViewBatch), total: sorted.length },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/x-posts");
  }
}
