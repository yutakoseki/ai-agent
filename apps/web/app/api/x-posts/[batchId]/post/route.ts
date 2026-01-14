import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { getXPostBatchById, appendXPostBatchPosted } from "@/lib/repos/xPostBatchRepo";
import { postTweet } from "@/lib/x-posts/xClient";

export const runtime = "nodejs";

type PostRequest = {
  rank: number;
};

export async function POST(request: NextRequest, contextParams: { params: { batchId: string } }) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const batchId = String(contextParams.params.batchId ?? "").trim();
    if (!batchId) throw new AppError("BAD_REQUEST", "batchId は必須です");

    const body: PostRequest = await request.json().catch(() => ({}));
    const rankRaw = Number(body?.rank);
    if (!Number.isFinite(rankRaw) || rankRaw <= 0) {
      throw new AppError("BAD_REQUEST", "rank は正の数値で指定してください");
    }

    const batch = await getXPostBatchById({
      tenantId: context.session.tenantId,
      batchId,
    });
    if (!batch) throw new AppError("NOT_FOUND", "バッチが見つかりません");
    if (batch.userId !== context.session.userId) {
      throw new AppError("FORBIDDEN", "このバッチにアクセスできません");
    }

    const topic = batch.payload.topics.find((item) => item.rank === rankRaw);
    if (!topic) throw new AppError("NOT_FOUND", "該当トピックが見つかりません");
    if (batch.posted?.some((entry) => entry.rank === rankRaw)) {
      throw new AppError("BAD_REQUEST", "既に投稿済みです");
    }

    const posted = await postTweet({ text: topic.summary, traceId: context.traceId });
    await appendXPostBatchPosted({
      tenantId: context.session.tenantId,
      batchId,
      rank: rankRaw,
      tweetId: posted.id,
    });

    return NextResponse.json(
      {
        tweetId: posted.id,
        tweetUrl: `https://x.com/i/web/status/${posted.id}`,
      },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/x-posts/[batchId]/post");
  }
}
