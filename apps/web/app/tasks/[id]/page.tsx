import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminShell } from "@/app/admin/AdminShell";
import { getTaskById } from "@/lib/repos/taskRepo";
import { AppError } from "@shared/error";
import { handleError } from "@/lib/middleware/error";
import { TaskDetailClient } from "./TaskDetailClient";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  if (!id) {
    // 画面側なので最低限
    redirect("/tasks");
  }

  try {
    const task = await getTaskById(session.tenantId, id);
    if (!task) redirect("/tasks");
    if (task.userId !== session.userId) {
      throw new AppError("FORBIDDEN", "このタスクを表示する権限がありません");
    }

    const viewTask = {
      ...task,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      dueAt: task.dueAt ? task.dueAt.toISOString() : undefined,
    };

    return (
      <AdminShell email={session.email} role={session.role}>
        <TaskDetailClient task={viewTask} />
      </AdminShell>
    );
  } catch (error) {
    // UI上は簡易エラーにする
    const res = handleError(error, undefined, "GET /tasks/:id");
    const data = await res.json().catch(() => ({}));
    return (
      <AdminShell email={session.email} role={session.role}>
        <div className="mx-auto max-w-screen-lg">
          <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-accent">
            {String(data?.message ?? "読み込みに失敗しました。")}
          </div>
        </div>
      </AdminShell>
    );
  }
}


