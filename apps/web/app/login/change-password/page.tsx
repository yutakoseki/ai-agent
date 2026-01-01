'use client';

import type { FormEvent } from 'react';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Noto_Sans_JP, Zen_Kaku_Gothic_New } from 'next/font/google';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PasswordChecklist } from '@/components/ui/PasswordChecklist';
import { PasswordInput } from '@/components/ui/PasswordInput';

const bodyFont = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-body',
});

const headingFont = Zen_Kaku_Gothic_New({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-heading',
});

type Status = 'idle' | 'loading' | 'success' | 'error';

function ChangePasswordFormFallback() {
  return (
    <Card className="rounded-3xl border-ink/10 bg-surface/90 shadow-panel" padded={false}>
      <div className="p-8">
        <div className="mb-6 space-y-2">
          <h2 className="text-xl font-heading font-semibold">入力</h2>
          <p className="text-sm text-ink-muted">読み込み中...</p>
        </div>
        <div className="h-44 rounded-2xl border border-ink/10 bg-surface-raised/60" />
      </div>
    </Card>
  );
}

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = (searchParams?.get('email') ?? '').trim();

  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  const statusClass = useMemo(() => {
    if (status === 'success') {
      return 'border-primary/40 bg-primary/10 text-primary';
    }
    if (status === 'error') {
      return 'border-accent/40 bg-accent/10 text-accent';
    }
    return 'border-ink/10 bg-surface-raised/80 text-ink-soft';
  }, [status]);

  const isBusy = status === 'loading';
  const passwordOk = useMemo(() => {
    const p = newPassword;
    return (
      p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p)
    );
  }, [newPassword]);
  const isDisabled =
    isBusy ||
    !email ||
    !currentPassword ||
    !newPassword ||
    !confirmPassword ||
    !passwordOk ||
    newPassword !== confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');
    setMessage(null);
    setTraceId(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      const responseTraceId = response.headers.get('X-Trace-Id');
      setTraceId(data?.traceId || responseTraceId);

      if (!response.ok) {
        setStatus('error');
        setMessage(
          data?.message || 'パスワード変更に失敗しました。入力内容を確認してください。'
        );
        return;
      }

      setStatus('success');
      setMessage(data?.message || 'パスワードを変更しました。');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setStatus('error');
      setMessage('通信に失敗しました。ネットワークを確認してください。');
    }
  }

  return (
    <Card className="rounded-3xl border-ink/10 bg-surface/90 shadow-panel" padded={false}>
      <div className="p-8">
        <div className="mb-6 space-y-2">
          <h2 className="text-xl font-heading font-semibold">入力</h2>
          <p className="text-sm text-ink-muted">
            メールアドレス、現在のパスワード、新しいパスワードを入力してください。
          </p>
        </div>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <Input
            name="email"
            label="メールアドレス"
            type="email"
            autoComplete="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 rounded-xl border-ink/10 bg-surface-raised/80"
            required
          />
          <PasswordInput
            name="currentPassword"
            label="現在のパスワード"
            autoComplete="current-password"
            placeholder="********"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="h-11 rounded-xl border-ink/10 bg-surface-raised/80"
            required
          />
          <PasswordInput
            name="newPassword"
            label="新しいパスワード"
            autoComplete="new-password"
            placeholder="********"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="h-11 rounded-xl border-ink/10 bg-surface-raised/80"
            required
          />
          <PasswordChecklist password={newPassword} confirmPassword={confirmPassword} />
          <PasswordInput
            name="confirmPassword"
            label="新しいパスワード（確認）"
            autoComplete="new-password"
            placeholder="********"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-11 rounded-xl border-ink/10 bg-surface-raised/80"
            required
          />

          <div className="grid gap-3">
            <Button
              className="h-11 w-full rounded-xl shadow-brand"
              type="submit"
              disabled={isDisabled}
            >
              {isBusy ? '変更中...' : 'パスワードを変更'}
            </Button>
            <Button
              className="h-11 w-full rounded-xl"
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={() => router.push('/login')}
            >
              ログイン画面へ戻る
            </Button>
          </div>
        </form>

        <div
          className={`mt-5 min-h-[44px] rounded-xl border px-3 py-2 text-sm leading-relaxed ${statusClass}`}
          role="status"
          aria-live="polite"
        >
          {message ?? '入力して「パスワードを変更」を押してください。'}
          {traceId ? (
            <span className="mt-1 block text-xs text-ink-soft">トレースID: {traceId}</span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export default function ChangePasswordPage() {
  return (
    <main
      className={[
        'relative min-h-[100svh] bg-secondary bg-auth-shell font-body text-ink',
        bodyFont.variable,
        headingFont.variable,
      ].join(' ')}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-35 [background-size:24px_24px]"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid min-h-[100svh] w-full max-w-screen-lg items-center gap-10 px-4 py-12 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:px-6 lg:px-8">
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/40 bg-primary/10 text-sm font-semibold text-primary">
              AI
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-ink-soft">AI Agent</p>
              <p className="text-lg font-semibold">コンソール</p>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-heading text-[clamp(28px,4vw,42px)] font-semibold leading-tight">
              パスワード変更
            </h1>
            <p className="text-sm text-ink-muted">
              現在のパスワードを確認して、新しいパスワードへ変更します。
            </p>
          </div>
        </section>

        <div className="grid gap-4">
          <Suspense fallback={<ChangePasswordFormFallback />}>
            <ChangePasswordForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
