'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@shared/user';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PasswordChecklist } from '@/components/ui/PasswordChecklist';
import { PasswordInput } from '@/components/ui/PasswordInput';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function PasswordResetClient({ user }: { user: User }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  const isBusy = status === 'loading';
  const passwordOk = useMemo(() => {
    const p = newPassword;
    return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);
  }, [newPassword]);
  const isDisabled =
    isBusy ||
    !newPassword ||
    !confirmPassword ||
    !passwordOk ||
    newPassword !== confirmPassword;

  const statusClass = useMemo(() => {
    if (status === 'success') return 'border-primary/40 bg-primary/10 text-primary';
    if (status === 'error') return 'border-accent/40 bg-accent/10 text-accent';
    return 'border-ink/10 bg-surface-raised/80 text-ink-soft';
  }, [status]);

  async function submit() {
    setStatus('loading');
    setMessage(null);
    setTraceId(null);

    try {
      const res = await fetch(`/api/users/${user.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await res.json().catch(() => ({}));
      setTraceId(data?.traceId || res.headers.get('X-Trace-Id'));

      if (!res.ok) {
        setStatus('error');
        setMessage(data?.message ?? 'パスワード再設定に失敗しました');
        return;
      }

      setStatus('success');
      setMessage(data?.message ?? 'パスワードを再設定しました（通知メールを送信しました）');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setStatus('error');
      setMessage('通信に失敗しました');
    }
  }

  return (
    <section className="grid gap-4">
      <Card title="対象ユーザー" className="border border-ink/10 bg-surface/90">
        <dl className="grid gap-3 text-sm text-ink">
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">ユーザーID</dt>
            <dd className="font-mono text-xs">{user.id}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">メール</dt>
            <dd className="text-sm">{user.email}</dd>
          </div>
        </dl>
      </Card>

      <Card title="パスワード再設定（Admin）" className="border border-ink/10 bg-surface/90">
        <div className="grid gap-3">
          <p className="text-sm text-ink-muted">
            パスワードを再設定すると、ユーザーへ通知メールが送信されます。
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <PasswordInput
              label="新しいパスワード"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isBusy}
              placeholder="********"
            />
            <PasswordInput
              label="新しいパスワード（確認）"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isBusy}
              placeholder="********"
            />
          </div>

          <PasswordChecklist password={newPassword} confirmPassword={confirmPassword} />

          <div className="flex flex-col gap-3 md:flex-row md:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={() => router.push(`/admin/users/${user.id}`)}
            >
              戻る
            </Button>
            <Button type="button" variant="primary" disabled={isDisabled} onClick={submit}>
              {isBusy ? '再設定中...' : 'パスワードを再設定'}
            </Button>
          </div>

          <div
            className={`rounded-lg border px-4 py-3 text-sm ${statusClass}`}
            role="status"
            aria-live="polite"
          >
            <p>{message ?? '新しいパスワードを入力して実行してください。'}</p>
            {traceId ? <p className="mt-1 text-xs opacity-90">traceId: {traceId}</p> : null}
          </div>
        </div>
      </Card>
    </section>
  );
}


