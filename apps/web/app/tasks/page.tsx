import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminShell } from "@/app/admin/AdminShell";
import { listTasks } from "@/lib/repos/taskRepo";
import { listEmailAccountsByUser } from "@/lib/repos/emailAccountRepo";
import { TasksClient } from "./TasksClient";
import { getUserPreferences } from "@/lib/repos/userPreferencesRepo";

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const tasks = await listTasks({
    tenantId: session.tenantId,
    userId: session.userId,
  });

  const accounts = await listEmailAccountsByUser(session.userId);
  const accountEmailById = Object.fromEntries(accounts.map((a) => [a.id, a.email]));

  const prefs = await getUserPreferences({ tenantId: session.tenantId, userId: session.userId });
  const initialTaskVisibleCategories =
    prefs?.taskVisibleCategories ?? ["action_required"];

  const viewTasks = tasks.map((task) => ({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    dueAt: task.dueAt ? task.dueAt.toISOString() : undefined,
  }));

  return (
    <AdminShell email={session.email} role={session.role}>
      <TasksClient
        tasks={viewTasks}
        accountEmailById={accountEmailById}
        initialTaskVisibleCategories={initialTaskVisibleCategories}
      />
    </AdminShell>
  );
}
