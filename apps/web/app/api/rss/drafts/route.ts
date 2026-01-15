import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { listDraftsByUser } from "@/lib/repos/rssDraftRepo";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const target = request.nextUrl.searchParams.get("target");
    const drafts = await listDraftsByUser({ userId: context.session.userId });
    const filtered =
      target && (target === "x" || target === "blog")
        ? drafts.filter((draft) => draft.target === target)
        : drafts;

    const sorted = filtered.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    return NextResponse.json(
      { drafts: sorted, total: sorted.length },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/rss/drafts");
  }
}
