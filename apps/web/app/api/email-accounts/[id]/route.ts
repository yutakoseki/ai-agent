import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { getEmailAccountItem } from "@/lib/repos/emailAccountRepo";
import { getUserEmailSubscription, upsertUserEmailSubscription } from "@/lib/repos/userEmailSubscriptionRepo";

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

    const { id } = await params;
    if (!id) throw new AppError("BAD_REQUEST", "idが不正です");

    const account = await getEmailAccountItem(context.session.tenantId, id);
    if (!account) throw new AppError("NOT_FOUND", "受信箱が見つかりません");
    if (account.userId !== context.session.userId) {
      throw new AppError("FORBIDDEN", "権限がありません");
    }

    const body = await request.json().catch(() => ({}));
    const monitoringEnabled =
      body?.monitoringEnabled === undefined ? undefined : Boolean(body.monitoringEnabled);
    const pushEnabled = body?.pushEnabled === undefined ? undefined : Boolean(body.pushEnabled);

    if (monitoringEnabled === undefined && pushEnabled === undefined) {
      throw new AppError("BAD_REQUEST", "更新内容がありません");
    }

    const existing = await getUserEmailSubscription({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
      accountId: id,
    });

    const updated = await upsertUserEmailSubscription({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
      accountId: id,
      monitoringEnabled: monitoringEnabled ?? (existing ? existing.monitoringEnabled : true),
      pushEnabled: pushEnabled ?? (existing ? existing.pushEnabled : true),
      role: "owner",
    });

    return NextResponse.json(
      {
        accountId: id,
        monitoringEnabled: updated.monitoringEnabled,
        pushEnabled: updated.pushEnabled,
        updatedAt: updated.updatedAt.toISOString(),
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "PATCH /api/email-accounts/:id");
  }
}


