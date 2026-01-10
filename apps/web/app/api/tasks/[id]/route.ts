import { NextRequest, NextResponse } from "next/server";
import type { TaskUpdateRequest } from "@shared/mail";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { updateTask } from "@/lib/repos/taskRepo";

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

    const body: TaskUpdateRequest = await request.json().catch(() => ({}));
    if (body?.status && !["open", "in_progress", "done", "archived"].includes(body.status)) {
      throw new AppError("BAD_REQUEST", "ステータスが不正です");
    }

    if (body?.dueAt && Number.isNaN(new Date(body.dueAt).getTime())) {
      throw new AppError("BAD_REQUEST", "期限の形式が不正です");
    }
    const dueAt =
      body?.dueAt === null
        ? null
        : body?.dueAt
          ? new Date(body.dueAt).toISOString()
          : undefined;

    const task = await updateTask({
      tenantId: context.session.tenantId,
      taskId: id,
      title: body?.title,
      summary: body?.summary,
      nextAction: body?.nextAction,
      dueAt,
      status: body?.status,
    });

    return NextResponse.json(task, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "PATCH /api/tasks/:id");
  }
}
