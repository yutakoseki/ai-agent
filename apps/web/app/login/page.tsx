'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Noto_Sans_JP, Zen_Kaku_Gothic_New } from 'next/font/google';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  const isDisabled = isBusy || !email || !password;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');
    setMessage(null);
    setTraceId(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      const responseTraceId = response.headers.get('X-Trace-Id');
      setTraceId(data?.traceId || responseTraceId);

      if (!response.ok) {
        setStatus('error');
        setMessage(data?.message || 'ログインに失敗しました。入力内容を確認してください。');
        return;
      }

      setStatus('success');
      setMessage('ログインに成功しました。セッションが作成されました。');
      const role = data?.user?.role;
      const destination = role === 'Admin' ? '/admin/roles' : '/';
      router.replace(destination);
    } catch {
      setStatus('error');
      setMessage('通信に失敗しました。ネットワークを確認してください。');
    }
  }

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
              AI Agent Platform
            </h1>
          </div>
        </section>

        <div className="grid gap-4">
          <Card className="rounded-3xl border-ink/10 bg-surface/90 shadow-panel" padded={false}>
            <div className="p-8">
              <div className="mb-6 space-y-2">
                <h2 className="text-xl font-heading font-semibold">サインイン</h2>
                <p className="text-sm text-ink-muted">
                  メールアドレスとパスワードを入力してください。
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
                <Input
                  name="password"
                  label="パスワード"
                  type="password"
                  autoComplete="current-password"
                  placeholder="********"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 rounded-xl border-ink/10 bg-surface-raised/80"
                  required
                />

                <Button
                  className="h-11 w-full rounded-xl shadow-brand"
                  type="submit"
                  disabled={isDisabled}
                >
                  {isBusy ? 'ログイン中...' : 'ログイン'}
                </Button>
              </form>

              <div
                className={`mt-5 min-h-[44px] rounded-xl border px-3 py-2 text-sm leading-relaxed ${statusClass}`}
                role="status"
                aria-live="polite"
              >
                {message ?? 'ログイン情報を入力してください。'}
                {traceId ? (
                  <span className="mt-1 block text-xs text-ink-soft">トレースID: {traceId}</span>
                ) : null}
              </div>
            </div>
          </Card>

          <p className="text-center text-xs text-ink-soft md:text-left">
            ログインできない場合は管理者に連絡してください。
          </p>
        </div>
      </div>
    </main>
  );
}
