import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { queryByPrefix } from "@db/tables/email-accounts";
import type { EmailAccountItem } from "@db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeDate(input?: string) {
  if (!input) return null;
  // Gmail watch expiration は「Unix epoch ms の文字列」で返ることがある
  if (/^\d+$/.test(input)) {
    const ms = Number(input);
    if (Number.isFinite(ms) && ms > 0) {
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(_req: NextRequest) {
  const { context, response } = await requireAuth(_req);
  if (response) return response;

  try {
    const forbidden = requireRole(context.session, ["Admin"], context.traceId);
    if (forbidden) return forbidden;

    const now = new Date();
    const tenantId = context.session.tenantId;
    const items = await queryByPrefix<EmailAccountItem>(tenantId, "EMAIL_ACCOUNT#");

    return NextResponse.json(
      {
        tenantId,
        now: now.toISOString(),
        env: {
          GMAIL_PUBSUB_TOPIC: { present: !!process.env.GMAIL_PUBSUB_TOPIC },
          GMAIL_WEBHOOK_TOKEN: { present: !!process.env.GMAIL_WEBHOOK_TOKEN },
          GOOGLE_CLIENT_ID: { present: !!process.env.GOOGLE_CLIENT_ID },
        },
        emailAccounts: items
          .filter((i) => i.provider === "gmail")
          .map((i) => {
            const exp = safeDate(i.gmailWatchExpiration);
            const expInSec = exp ? Math.floor((exp.getTime() - now.getTime()) / 1000) : null;
            return {
              id: i.id,
              email: i.email,
              userId: i.userId,
              status: i.status,
              gmailHistoryIdPresent: !!i.gmailHistoryId,
              gmailWatchExpiration: i.gmailWatchExpiration ?? null,
              watchExpiresInSec: expInSec,
            };
          }),
        hint: {
          note:
            "自動振り分けは Gmail watch(Pub/Sub) → /api/webhook/gmail が届くことが前提。GMAIL_PUBSUB_TOPIC が未設定だと watch を開始しない。",
        },
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/debug/gmail-watch");
  }
}


