import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listUsers } from "@/lib/repos/userRepo";
import { RoleManagerClient } from "./RoleManagerClient";

export default async function AdminRolesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "Admin") {
    return (
      <main className="mx-auto max-w-screen-lg px-4 py-10 text-ink">
        <h1 className="text-xl font-semibold">権限管理</h1>
        <p className="mt-2 text-sm text-ink-muted">
          このページには管理者のみアクセスできます。
        </p>
      </main>
    );
  }

  const users = await listUsers(session.tenantId);

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
          Admin Console
        </p>
        <h1 className="text-2xl font-semibold text-ink">権限管理</h1>
        <p className="text-sm text-ink-muted">
          テナント内の Manager / Member の役割を確認・変更できます。
        </p>
      </header>

      <RoleManagerClient initialUsers={users} selfId={session.userId} />
    </main>
  );
}

