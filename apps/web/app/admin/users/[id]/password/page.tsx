import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { findUserByUserId } from '@/lib/repos/userRepo';
import { PasswordResetClient } from './PasswordResetClient';

export default async function AdminUserPasswordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  // UIはAdmin導線の想定なので、表示時点で弾く（API側でもAdminチェックあり）
  if (session.role !== 'Admin') redirect('/admin/roles');

  const { id } = await params;
  const user = await findUserByUserId(id);
  if (!user) {
    return (
      <main className="mx-auto max-w-screen-lg px-4 py-10 text-ink">
        <h1 className="text-xl font-semibold">パスワード再設定</h1>
        <p className="mt-2 text-sm text-ink-muted">ユーザーが見つかりません。</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Admin Console</p>
        <h1 className="text-2xl font-semibold text-ink">パスワード再設定</h1>
        <p className="text-sm text-ink-muted">ユーザーのパスワードを再設定します。</p>
      </header>

      <PasswordResetClient user={user} />
    </main>
  );
}


