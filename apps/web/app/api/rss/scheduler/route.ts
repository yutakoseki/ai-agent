import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { handleError } from "@/lib/middleware/error";
import { runRssScheduler } from "@/lib/rss/sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const traceId = randomUUID();
  try {
    const token = process.env.RSS_SCHEDULER_TOKEN;
    if (token) {
      const header = request.headers.get("x-scheduler-token");
      if (header !== token) {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const parsedMax = body?.maxSources ? Number(body.maxSources) : undefined;
    const maxSources =
      parsedMax && Number.isFinite(parsedMax) ? Math.max(1, parsedMax) : 200;

    const result = await runRssScheduler({ maxSources, traceId });
    return NextResponse.json({ ok: true, ...result }, { headers: { "X-Trace-Id": traceId } });
  } catch (error) {
    return handleError(error, traceId, "POST /api/rss/scheduler");
  }
}
