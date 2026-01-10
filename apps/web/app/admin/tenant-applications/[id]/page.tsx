import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTenantApplicationById } from "@/lib/repos/tenantApplicationRepo";
import { TenantApplicationReviewClient } from "./TenantApplicationReviewClient";

export default async function AdminTenantApplicationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "Admin") {
    return (
      <main className="mx-auto max-w-screen-lg px-4 py-10 text-ink">
        <h1 className="text-xl font-semibold">テナント申請（詳細）</h1>
        <p className="mt-2 text-sm text-ink-muted">
          このページには管理者のみアクセスできます。
        </p>
      </main>
    );
  }

  const application = await findTenantApplicationById(params.id);
  if (!application) {
    return (
      <main className="mx-auto max-w-screen-lg px-4 py-10 text-ink">
        <h1 className="text-xl font-semibold">テナント申請（詳細）</h1>
        <p className="mt-2 text-sm text-ink-muted">申請が見つかりません。</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
          Admin Console
        </p>
        <h1 className="text-2xl font-semibold text-ink">テナント申請（詳細）</h1>
        <p className="text-sm text-ink-muted">
          申請内容を確認し、承認/却下できます。
        </p>
      </header>

      <TenantApplicationReviewClient initialApplication={application} />
    </main>
  );
}


