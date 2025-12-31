import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findUser, findUserByUserId } from "@/lib/repos/userRepo";
import { UserDetailClient } from "./userDetailClient";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const isAdmin = session.role === "Admin";
  const user = isAdmin
    ? await findUserByUserId(id)
    : await findUser(session.tenantId, id);

  if (!user) {
    return (
      <main className="mx-auto max-w-screen-lg px-4 py-10 text-ink">
        <h1 className="text-xl font-semibold">ユーザー詳細</h1>
        <p className="mt-2 text-sm text-ink-muted">
          ユーザーが見つかりません。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
          Admin Console
        </p>
        <h1 className="text-2xl font-semibold text-ink">ユーザー詳細</h1>
        <p className="text-sm text-ink-muted">
          ユーザー情報を確認・編集できます。
        </p>
      </header>

      <UserDetailClient
        initialUser={user}
        session={{ userId: session.userId, role: session.role, tenantId: session.tenantId }}
      />
    </main>
  );
}


