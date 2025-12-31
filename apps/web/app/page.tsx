export default function Page() {
  return (
    <main className="mx-auto max-w-screen-md px-4 py-12 text-ink">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
          AI Agent Platform
        </p>
        <h1 className="text-2xl font-semibold">AI Agent Platform</h1>
        <p className="text-sm text-ink-muted">
          初期セットアップ中です。まずはテナント申請、または管理者ログインから開始します。
        </p>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <a
          className="rounded-lg border border-ink/10 bg-surface/90 px-4 py-4 shadow-panel hover:bg-surface-raised/80"
          href="/tenant/apply"
        >
          <div className="text-sm font-semibold">テナント申請</div>
          <div className="mt-1 text-sm text-ink-muted">
            新規テナントの作成依頼を送信します。
          </div>
        </a>

        <a
          className="rounded-lg border border-ink/10 bg-surface/90 px-4 py-4 shadow-panel hover:bg-surface-raised/80"
          href="/login"
        >
          <div className="text-sm font-semibold">ログイン</div>
          <div className="mt-1 text-sm text-ink-muted">
            管理画面/機能にアクセスします。
          </div>
        </a>
      </section>
    </main>
  );
}

