import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { sendTaskPush } from "@/lib/push/webPush";
import { listPushSubscriptionsByUser } from "@/lib/repos/pushSubscriptionRepo";
import { AppError } from "@shared/error";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const publicKey = process.env.VAPID_PUBLIC_KEY || "";
    const privateKey = process.env.VAPID_PRIVATE_KEY || "";
    if (!publicKey || !privateKey) {
      throw new AppError("BAD_REQUEST", "サーバー側のVAPIDキーが未設定です（VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY）");
    }
    const subs = await listPushSubscriptionsByUser({ userId: context.session.userId });
    if (!subs.length) {
      throw new AppError("BAD_REQUEST", "このユーザーのPush購読が未登録です（先に『通知を有効化』してください）");
    }

    await sendTaskPush({
      userId: context.session.userId,
      task: {
        id: "test",
        tenantId: context.session.tenantId,
        userId: context.session.userId,
        title: "テスト通知",
        summary: "Push通知の動作確認です。",
        nextAction: "通知が表示されることを確認してください。",
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      { ok: true, subscriptions: subs.length },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/push/test");
  }
}


