'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@shared/auth';
import type { User } from '@shared/user';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';

type Status = 'idle' | 'loading' | 'success' | 'error';

type Props = {
  initialUser: User;
  session: { userId: string; role: UserRole; tenantId: string };
};

const allRoles: UserRole[] = ['Admin', 'Manager', 'Member'];

export function UserDetailClient({ initialUser, session }: Props) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [editName, setEditName] = useState(user.name ?? '');
  const [editEmail, setEditEmail] = useState(user.email);
  const [editRole, setEditRole] = useState<UserRole>(user.role);
  const [moveTenantId, setMoveTenantId] = useState('');

  const isBusy = status === 'loading';
  const isAdmin = session.role === 'Admin';
  const canDelete = session.role === 'Admin' || session.role === 'Manager';
  const isSelf = session.userId === user.id;

  const canEditRole = isAdmin; // role変更はAdminのみ
  const canEditProfile = isAdmin || isSelf; // name/email は Admin か本人のみ（必要ならManagerも拡張）

  const statusClass = useMemo(() => {
    if (status === 'success') return 'border-primary/40 bg-primary/10 text-primary';
    if (status === 'error') return 'border-accent/40 bg-accent/10 text-accent';
    return 'border-ink/10 bg-surface-raised/80 text-ink-soft';
  }, [status]);

  const hasChanges =
    editName !== (user.name ?? '') || editEmail !== user.email || editRole !== user.role;

  async function save() {
    setStatus('loading');
    setMessage(null);
    setTraceId(null);

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: canEditProfile ? editName : undefined,
          email: canEditProfile ? editEmail : undefined,
          role: canEditRole ? editRole : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      setTraceId(data?.traceId || res.headers.get('X-Trace-Id'));

      if (!res.ok) {
        setStatus('error');
        setMessage(data?.message ?? '更新に失敗しました');
        return;
      }

      setUser(data);
      setEditName(data.name ?? '');
      setEditEmail(data.email);
      setEditRole(data.role);
      setStatus('success');
      setMessage('更新しました');
    } catch {
      setStatus('error');
      setMessage('通信に失敗しました');
    }
  }

  async function moveTenant() {
    setStatus('loading');
    setMessage(null);
    setTraceId(null);

    try {
      const res = await fetch(`/api/users/${user.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId: moveTenantId }),
      });

      const data = await res.json().catch(() => ({}));
      setTraceId(data?.traceId || res.headers.get('X-Trace-Id'));

      if (!res.ok) {
        setStatus('error');
        setMessage(data?.message ?? 'テナント移動に失敗しました');
        return;
      }

      setUser(data);
      setEditName(data.name ?? '');
      setEditEmail(data.email);
      setEditRole(data.role);
      setMoveTenantId('');
      setStatus('success');
      setMessage('テナントを移動しました');
    } catch {
      setStatus('error');
      setMessage('通信に失敗しました');
    }
  }

  async function removeUser() {
    if (isSelf) {
      setStatus('error');
      setMessage('自分自身を削除することはできません');
      return;
    }
    setDeleteOpen(true);
  }

  async function confirmRemoveUser() {
    setStatus('loading');
    setMessage(null);
    setTraceId(null);

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      setTraceId(data?.traceId || res.headers.get('X-Trace-Id'));

      if (!res.ok) {
        setStatus('error');
        setMessage(data?.message ?? '削除に失敗しました');
        return;
      }

      setStatus('success');
      setMessage('ユーザーを削除しました');
      router.push('/admin/roles');
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('通信に失敗しました');
    } finally {
      setDeleteOpen(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Dialog
        open={deleteOpen}
        title="ユーザー削除の確認"
        onClose={() => {
          if (!isBusy) setDeleteOpen(false);
        }}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={() => setDeleteOpen(false)}
          >
            閉じる
          </Button>
        }
      >
        <div className="space-y-4 text-sm text-ink">
          <p className="text-ink-muted">
            この操作は取り消せません。削除するとログインできなくなります。
          </p>
          <dl className="grid gap-2 rounded-lg border border-ink/10 bg-secondary/40 p-3">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">対象</dt>
              <dd className="font-mono text-xs">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">ユーザーID</dt>
              <dd className="font-mono text-xs">{user.id}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={() => setDeleteOpen(false)}
            >
              キャンセル
            </Button>
            <Button type="button" variant="danger" disabled={isBusy} onClick={confirmRemoveUser}>
              {isBusy ? '削除中...' : '削除する'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Card title="ユーザー情報" className="border border-ink/10 bg-surface/90">
        <dl className="grid gap-3 text-sm text-ink">
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">ユーザーID</dt>
            <dd className="font-mono text-xs">{user.id}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">テナントID</dt>
            <dd className="font-mono text-xs">{user.tenantId}</dd>
          </div>
        </dl>

        <div className="mt-4 grid gap-3">
          <Input
            label="名前"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            disabled={isBusy || !canEditProfile}
            placeholder="（未設定）"
          />
          <Input
            label="メール"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            disabled={isBusy || !canEditProfile}
          />

          <label className="flex flex-col gap-1 text-sm text-ink">
            <span className="font-medium">役割</span>
            <select
              className="h-10 rounded-md border border-surface bg-secondary px-3 text-ink disabled:opacity-60 disabled:cursor-not-allowed"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              disabled={isBusy || !canEditRole}
            >
              {allRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {!canEditRole ? (
              <span className="text-xs text-ink-soft">役割変更はAdminのみ可能です。</span>
            ) : null}
          </label>
        </div>
      </Card>

      <Card title="操作" className="border border-ink/10 bg-surface/90">
        <div className="space-y-3">
          <Button
            type="button"
            variant="primary"
            className="w-full"
            disabled={!hasChanges || isBusy || (!canEditRole && !canEditProfile)}
            onClick={save}
          >
            {isBusy ? '更新中...' : '更新'}
          </Button>

          {canDelete ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="danger"
                className="w-full"
                disabled={isBusy || isSelf}
                onClick={removeUser}
              >
                {isBusy ? '処理中...' : '削除'}
              </Button>
              {isSelf ? (
                <p className="mt-1 text-xs text-ink-soft">自分自身は削除できません。</p>
              ) : null}
            </div>
          ) : null}

          <div className={`rounded-lg border px-4 py-3 text-sm ${statusClass}`}>
            <p>{message ?? '変更して「更新」を押してください。'}</p>
            {traceId ? <p className="mt-1 text-xs opacity-90">traceId: {traceId}</p> : null}
          </div>
        </div>
      </Card>

      {isAdmin ? (
        <Card
          title="テナント移動（Admin）"
          className="border border-ink/10 bg-surface/90 lg:col-span-2"
        >
          <div className="grid gap-3">
            <p className="text-sm text-ink-muted">
              ユーザーを別テナントに移動します（DB上で作り直し＋旧データ削除）。
            </p>
            <Input
              label="移行先テナントID"
              value={moveTenantId}
              onChange={(e) => setMoveTenantId(e.target.value)}
              disabled={isBusy}
              placeholder="tenant-xxxx"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={isBusy || !moveTenantId.trim() || moveTenantId.trim() === user.tenantId}
                onClick={moveTenant}
              >
                {isBusy ? '移動中...' : '移動'}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </section>
  );
}
