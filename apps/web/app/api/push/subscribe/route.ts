import { NextRequest, NextResponse } from "next/server";
import type { PushSubscriptionRequest } from "@shared/mail";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { upsertPushSubscription } from "@/lib/repos/pushSubscriptionRepo";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const body: PushSubscriptionRequest = await request.json().catch(() => ({}));
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      throw new AppError("BAD_REQUEST", "購読情報が不正です");
    }

    const saved = await upsertPushSubscription({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      expirationTime: body.expirationTime ?? undefined,
    });

    return NextResponse.json(saved, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/push/subscribe");
  }
}
