import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { createXPostBatch } from "@/lib/repos/xPostBatchRepo";
import { generateXPostPayload } from "@/lib/x-posts/generator";
import { toViewBatch } from "@/lib/x-posts/serializer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const payload = await generateXPostPayload({ traceId: context.traceId });
    const batch = await createXPostBatch({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
      payload,
    });

    return NextResponse.json(
      { batch: toViewBatch(batch) },
      { status: 201, headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/x-posts/generate");
  }
}
