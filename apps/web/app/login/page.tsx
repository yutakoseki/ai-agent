"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";

const bodyFont = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

const headingFont = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
});

type Status = "idle" | "loading" | "success" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  const statusClass = useMemo(() => {
    if (status === "success") {
      return "border-primary/40 bg-primary/10 text-primary";
    }
    if (status === "error") {
      return "border-accent/40 bg-accent/10 text-accent";
    }
    return "border-ink/10 bg-secondary text-ink-soft";
  }, [status]);

  const isBusy = status === "loading";
  const isDisabled = isBusy || !email || !password;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);
    setTraceId(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      const responseTraceId = response.headers.get("X-Trace-Id");
      setTraceId(data?.traceId || responseTraceId);

      if (!response.ok) {
        setStatus("error");
        setMessage(
          data?.message || "ログインに失敗しました。入力内容を確認してください。"
        );
        return;
      }

      setStatus("success");
      setMessage("ログインに成功しました。セッションが作成されました。");
    } catch {
      setStatus("error");
      setMessage("通信に失敗しました。ネットワークを確認してください。");
    }
  }

  return (
    <main
      className={[
        "min-h-[100svh] bg-secondary bg-auth-shell font-body text-ink",
        bodyFont.variable,
        headingFont.variable,
      ].join(" ")}
    >
      <div className="mx-auto flex min-h-[100svh] w-full max-w-xl flex-col justify-center gap-8 px-6 py-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-sm font-semibold text-primary">
              AI
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                AI Agent
              </p>
              <p className="text-lg font-semibold">コンソール</p>
            </div>
          </div>
          <span className="rounded-full border border-ink/20 px-3 py-1 text-xs text-ink-soft">
            Cognito 認証
          </span>
        </header>

        <section className="rounded-3xl border border-ink/10 bg-surface p-8 shadow-panel">
          <div className="flex items-center gap-2 text-xs tracking-[0.2em] text-ink-soft">
            <span className="h-2 w-2 rounded-full bg-primary" />
            サインイン
          </div>
          <h1 className="mt-4 font-heading text-[clamp(24px,3vw,32px)]">
            サインイン
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            管理コンソールへアクセスするにはログインしてください。
          </p>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <label className="text-xs font-semibold" htmlFor="email">
                メールアドレス
              </label>
              <input
                id="email"
                className="h-11 rounded-xl border border-ink/15 bg-surface-raised px-3 text-[15px] text-ink outline-none transition placeholder:text-ink-soft focus:border-primary focus:ring-4 focus:ring-primary/30"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold" htmlFor="password">
                パスワード
              </label>
              <input
                id="password"
                className="h-11 rounded-xl border border-ink/15 bg-surface-raised px-3 text-[15px] text-ink outline-none transition placeholder:text-ink-soft focus:border-primary focus:ring-4 focus:ring-primary/30"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="********"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <button
              className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-secondary transition hover:bg-primary-light active:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isDisabled}
            >
              {isBusy ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <div
            className={`mt-5 min-h-[44px] rounded-xl border px-3 py-2 text-sm leading-relaxed ${statusClass}`}
            role="status"
            aria-live="polite"
          >
            {message ?? "メールアドレスとパスワードを入力してください。"}
            {traceId ? (
              <span className="mt-1 block text-xs text-ink-soft">
                トレースID: {traceId}
              </span>
            ) : null}
          </div>
        </section>

        <footer className="text-xs text-ink-soft">
          ログインできない場合は管理者に連絡してください。
        </footer>
      </div>
    </main>
  );
}
