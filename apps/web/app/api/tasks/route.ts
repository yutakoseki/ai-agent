import { NextRequest, NextResponse } from "next/server";
import type { TaskCreateRequest, TaskStatus, TaskListResponse } from "@shared/mail";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { createTask, listTasks } from "@/lib/repos/taskRepo";
import { sendTaskPush } from "@/lib/push/webPush";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const statusParam = request.nextUrl.searchParams.get("status");
    const status =
      statusParam && ["open", "in_progress", "done", "archived"].includes(statusParam)
        ? (statusParam as TaskStatus)
        : null;

    const tasks = await listTasks({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
    });

    const filtered = status ? tasks.filter((t) => t.status === status) : tasks;
    const result: TaskListResponse = {
      tasks: filtered,
      total: filtered.length,
    };

    return NextResponse.json(result, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "GET /api/tasks");
  }
}

export async function POST(request: NextRequest) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const body: TaskCreateRequest = await request.json().catch(() => ({}));
    const title = String(body?.title ?? "").trim();

    if (!title) throw new AppError("BAD_REQUEST", "タイトルは必須です");
    if (title.length > 200) throw new AppError("BAD_REQUEST", "タイトルが長すぎます");

    const dueAt = body?.dueAt ? new Date(body.dueAt) : undefined;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      throw new AppError("BAD_REQUEST", "期限の形式が不正です");
    }

    const task = await createTask({
      tenantId: context.session.tenantId,
      userId: context.session.userId,
      title,
      summary: body?.summary,
      nextAction: body?.nextAction,
      dueAt: dueAt ? dueAt.toISOString() : undefined,
      sourceProvider: body?.sourceProvider,
      sourceMessageId: body?.sourceMessageId,
    });
    await sendTaskPush({ userId: context.session.userId, task });

    return NextResponse.json(task, {
      status: 201,
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "POST /api/tasks");
  }
}
