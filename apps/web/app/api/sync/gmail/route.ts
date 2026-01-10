import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { listEmailAccountsByUser } from "@/lib/repos/emailAccountRepo";
import { syncGmailAccount } from "@/lib/mail/sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const body = await request.json().catch(() => ({}));
    const accountId = body?.accountId ? String(body.accountId) : undefined;
    const parsedMax = body?.maxMessages ? Number(body.maxMessages) : undefined;
    const maxMessages = parsedMax && Number.isFinite(parsedMax) ? parsedMax : undefined;

    const accounts = await listEmailAccountsByUser(context.session.userId);
    const gmailAccounts = accounts.filter((acc) => acc.provider === "gmail");
    const target = accountId
      ? gmailAccounts.filter((acc) => acc.id === accountId)
      : gmailAccounts;

    if (!target.length) {
      throw new AppError("NOT_FOUND", "同期対象が見つかりません");
    }

    const results = [];
    for (const account of target) {
      const result = await syncGmailAccount({
        tenantId: context.session.tenantId,
        accountId: account.id,
        maxMessages,
      });
      results.push({ accountId: account.id, ...result });
    }

    return NextResponse.json(
      { ok: true, results },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/sync/gmail");
  }
}
