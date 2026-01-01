import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listTenantApplications } from "@/lib/repos/tenantApplicationRepo";
import { TenantApplicationManagerClient } from "./TenantApplicationManagerClient";

export default async function AdminTenantApplicationsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "Admin") {
    return (
      <main className="mx-auto max-w-screen-lg px-4 py-10 text-ink">
        <h1 className="text-xl font-semibold">テナント申請</h1>
        <p className="mt-2 text-sm text-ink-muted">
          このページには管理者のみアクセスできます。
        </p>
      </main>
    );
  }

  const applications = await listTenantApplications();

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
          Admin Console
        </p>
        <h1 className="text-2xl font-semibold text-ink">テナント申請</h1>
        <p className="text-sm text-ink-muted">
          申請の一覧を確認し、承認/却下できます。
        </p>
      </header>

      <TenantApplicationManagerClient initialApplications={applications} />
    </main>
  );
}


