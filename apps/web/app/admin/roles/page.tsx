import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { searchUsersPage } from "@/lib/repos/userRepo";
import { RoleManagerClient } from "./RoleManagerClient";
import { TenantPermissionsMatrix } from "./TenantPermissionsMatrix";
import type { UserRole } from "@shared/auth";

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.role === "Admin";
  const qParam = typeof searchParams?.q === "string" ? searchParams.q : undefined;
  const tenantIdParam =
    typeof searchParams?.tenantId === "string" ? searchParams.tenantId : undefined;
  const effectiveTenantId = isAdmin ? tenantIdParam : session.tenantId;

  const { users, nextCursor } = await searchUsersPage({
    tenantId: effectiveTenantId,
    q: qParam,
    limit: 20,
  });

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
        initialNextCursor={nextCursor}
        selfId={session.userId}
        canEdit={isAdmin}
        showTenantId={isAdmin}
        sessionRole={session.role as UserRole}
        sessionTenantId={session.tenantId}
      />

      {isAdmin ? (
        <div className="mt-10">
          <TenantPermissionsMatrix canEdit />
        </div>
      ) : null}
    </main>
  );
}

