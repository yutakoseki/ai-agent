import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { findUser, findUserByUserId } from '@/lib/repos/userRepo';
import { UserDetailClient } from './userDetailClient';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;

  const isAdmin = session.role === 'Admin';
  const user = isAdmin ? await findUserByUserId(id) : await findUser(session.tenantId, id);

  if (!user) {
    return (
      <main className="mx-auto max-w-screen-lg px-4 py-10 text-ink">
        <h1 className="text-xl font-semibold">ユーザー詳細</h1>
        <p className="mt-2 text-sm text-ink-muted">ユーザーが見つかりません。</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-10">
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Admin Console</p>
          <h1 className="text-2xl font-semibold text-ink">ユーザー詳細</h1>
          <p className="text-sm text-ink-muted">ユーザー情報を確認・編集できます。</p>
        </div>

        {isAdmin ? (
          <div className="flex justify-end">
            <Link
              href={`/admin/users/${user.id}/password`}
              className={[
                'inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary',
                'bg-surface text-ink hover:bg-surface-raised border border-surface active:border-primary',
                'h-10 px-4 text-sm',
              ].join(' ')}
            >
              パスワード再設定
            </Link>
          </div>
        ) : null}
      </header>

      <UserDetailClient
        initialUser={user}
        session={{ userId: session.userId, role: session.role, tenantId: session.tenantId }}
      />
    </main>
  );
}
