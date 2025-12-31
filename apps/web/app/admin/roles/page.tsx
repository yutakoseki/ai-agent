import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listAllUsers, listUsers } from "@/lib/repos/userRepo";
import { RoleManagerClient } from "./RoleManagerClient";
import { TenantPermissionsMatrix } from "./TenantPermissionsMatrix";

export default async function AdminRolesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.role === "Admin";
  const users = isAdmin ? await listAllUsers() : await listUsers(session.tenantId);

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
          Admin Console
        </p>
        <h1 className="text-2xl font-semibold text-ink">権限管理</h1>
        <p className="text-sm text-ink-muted">
          {isAdmin
            ? "全テナントのユーザーを確認・変更できます。"
            : "自テナントのユーザーを確認できます。"}
        </p>
      </header>

      <RoleManagerClient
        initialUsers={users}
        selfId={session.userId}
        canEdit={isAdmin}
        showTenantId={isAdmin}
      />

      <div className="mt-10">
        <TenantPermissionsMatrix canEdit={isAdmin} />
      </div>
    </main>
  );
}

