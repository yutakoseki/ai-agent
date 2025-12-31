'use client';

import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@shared/auth";
import type { User } from "@shared/user";
import type { TenantListResponse } from "@shared/tenant";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";
import { PasswordInput } from "@/components/ui/PasswordInput";

type Props = {
  initialUsers: User[];
  initialNextCursor?: string;
  selfId: string;
  canEdit: boolean;
  showTenantId?: boolean;
  sessionRole: UserRole;
  sessionTenantId: string;
};

const allRoles: UserRole[] = ["Admin", "Manager", "Member"];

export function RoleManagerClient({
  initialUsers,
  initialNextCursor,
  selfId,
  canEdit,
  showTenantId = false,
  sessionRole,
  sessionTenantId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState(initialUsers);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialNextCursor);
  const [cursorStack, setCursorStack] = useState<string[]>([""]); // ページ開始カーソルの履歴（前へ対応）
  const [loadingList, setLoadingList] = useState(false);

  const [pendingRole, setPendingRole] = useState<Record<string, UserRole>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState(() => searchParams?.get("q") ?? "");
  const [tenantIdFilter, setTenantIdFilter] = useState(
    () => searchParams?.get("tenantId") ?? ""
  );

  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);

  // --- create user ---
  const canCreateUser = sessionRole === "Admin" || sessionRole === "Manager";
  const [createTenantId, setCreateTenantId] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>(() =>
    sessionRole === "Manager" ? "Member" : "Member"
  );
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const createPasswordOk = useMemo(() => {
    const p = createPassword;
    return (
      p.length >= 8 &&
      /[A-Z]/.test(p) &&
      /[a-z]/.test(p) &&
      /[0-9]/.test(p)
    );
  }, [createPassword]);

  const rows = useMemo(
    () =>
      users.map((user) => {
        const originalRole = user.role;
        const nextRole = pendingRole[user.id] ?? originalRole;
        const isSelf = user.id === selfId;
        const disabled = !canEdit;
        return { ...user, isSelf, originalRole, nextRole, disabled };
      }),
    [users, pendingRole, selfId, canEdit]
  );

  function syncUrl(next: { q?: string; tenantId?: string }) {
    if (!pathname) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    if (typeof next.q !== "undefined") {
      const v = next.q.trim();
      if (v) params.set("q", v);
      else params.delete("q");
    }

    if (typeof next.tenantId !== "undefined") {
      const v = next.tenantId.trim();
      if (v) params.set("tenantId", v);
      else params.delete("tenantId");
    }

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  async function loadPage(
    cursor: string,
    overrides?: { q?: string; tenantId?: string }
  ) {
    setLoadingList(true);
    setMessage(null);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      const q = (overrides?.q ?? query).trim();
      const tenantId = (overrides?.tenantId ?? tenantIdFilter).trim();
      if (q) params.set("q", q);
      if (showTenantId && tenantId) params.set("tenantId", tenantId);
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/users?${params.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "一覧の取得に失敗しました");
        return;
      }
      setUsers(json?.users ?? []);
      setNextCursor(json?.nextCursor ?? undefined);
    } catch (e) {
      console.error(e);
      setError("通信に失敗しました");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    // Adminのみ: テナント一覧を取得してセレクトに出す
    if (!showTenantId) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/tenants", { method: "GET", credentials: "include" });
        const json: TenantListResponse = await res.json();
        if (!res.ok) return;
        if (!mounted) return;
        const nextTenants = (json.tenants ?? []).map((t) => ({ id: t.id, name: t.name }));
        setTenants(nextTenants);

        // Adminの作成先テナントの初期値: フィルタ or 先頭
        const preferred = (tenantIdFilter || nextTenants[0]?.id || "").trim();
        setCreateTenantId((prev) => (prev ? prev : preferred));
      } catch {
        // best-effort
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showTenantId, tenantIdFilter]);

  // Managerは自テナント固定
  useEffect(() => {
    if (sessionRole !== "Manager") return;
    setCreateTenantId(sessionTenantId);
  }, [sessionRole, sessionTenantId]);

  async function createUser() {
    if (!canCreateUser) return;
    if (creating) return;
    setCreating(true);
    setCreateMessage(null);
    setCreateError(null);

    try {
      const payload: Record<string, unknown> = {
        email: createEmail.trim(),
        password: createPassword,
        role: createRole,
        name: createName.trim() || undefined,
      };

      if (sessionRole === "Admin") {
        const tid = (createTenantId || "").trim();
        if (tid) payload.tenantId = tid;
      }

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(json?.message ?? "ユーザー作成に失敗しました");
        return;
      }

      setCreateMessage("ユーザーを作成しました");
      setCreatePassword("");
      // 作成後は1ページ目を再取得（フィルタ/検索は維持）
      setCursorStack([""]);
      await loadPage("", {});
    } catch (e) {
      console.error(e);
      setCreateError("通信に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  async function updateRole(userId: string, nextRole: UserRole) {
    setBusyId(userId);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: nextRole }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message ?? "更新に失敗しました");
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: nextRole, updatedAt: new Date() } : u
        )
      );
      setPendingRole((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      setMessage("役割を更新しました");
    } catch (e) {
      console.error(e);
      setError("通信に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4">
      {canCreateUser ? (
        <Card className="border border-ink/10 bg-surface/90 shadow-panel">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">新規ユーザー作成</h2>
              <p className="text-sm text-ink-muted">
                {sessionRole === "Admin"
                  ? "作成先テナントを選択してユーザーを作成できます。"
                  : "自テナント配下にユーザーを作成できます。"}
              </p>
              {sessionRole !== "Admin" ? (
                <p className="mt-1 text-xs text-ink-soft">
                  テナント: <span className="font-mono">{sessionTenantId}</span>
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {sessionRole === "Admin" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">
                    作成先テナント
                  </label>
                  <select
                    className="w-full rounded-lg border border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm"
                    value={createTenantId}
                    onChange={(e) => setCreateTenantId(e.target.value)}
                    disabled={creating}
                  >
                    <option value="">（未選択）</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}（{t.id}）
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">役割</label>
                <select
                  className="w-full rounded-lg border border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm"
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as UserRole)}
                  disabled={creating}
                >
                  <option value="Member">Member</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin" disabled={sessionRole !== "Admin"}>
                    Admin
                  </option>
                </select>
                {sessionRole !== "Admin" ? (
                  <p className="mt-1 text-xs text-ink-soft">
                    ※ Admin の作成は管理者のみ可能です
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">メール</label>
                <input
                  className="w-full rounded-lg border border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="例: user@example.com"
                  autoComplete="email"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">名前（任意）</label>
                <input
                  className="w-full rounded-lg border border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="例: 田中 太郎"
                  autoComplete="name"
                  disabled={creating}
                />
              </div>

              <div className="md:col-span-2">
                <PasswordInput
                  label="初期パスワード"
                  className="h-10 rounded-lg border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="要件を満たす強いパスワード"
                  autoComplete="new-password"
                  disabled={creating}
                />
                <div className="mt-2">
                  <PasswordChecklist password={createPassword} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-ink-soft">
                {sessionRole === "Admin" && tenantIdFilter && createTenantId && createTenantId !== tenantIdFilter ? (
                  <span>
                    ※ 現在の絞り込み（<span className="font-mono">{tenantIdFilter}</span>）と作成先が異なるため、
                    一覧に表示されない場合があります
                  </span>
                ) : (
                  <span>作成後は一覧を自動で更新します。</span>
                )}
              </div>
              <Button
                size="sm"
                variant="primary"
                disabled={
                  creating ||
                  !createEmail.trim() ||
                  !createPasswordOk ||
                  !createRole ||
                  (sessionRole === "Admin" && !createTenantId.trim())
                }
                onClick={createUser}
              >
                {creating ? "作成中..." : "作成"}
              </Button>
            </div>

            <div className="min-h-[28px] text-sm">
              {createMessage ? <p className="text-primary">{createMessage}</p> : null}
              {createError ? <p className="text-accent">{createError}</p> : null}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">権限管理</h2>
          <p className="text-sm text-ink-muted">
            {canEdit
              ? "全テナントのユーザーの役割を確認・変更できます。"
              : "自テナントのユーザーを確認できます（変更はAdminのみ）。"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-sm">
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              名前 / メールで検索
            </label>
            <input
              className="w-full rounded-lg border border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm"
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                syncUrl({ q: next });
                // フィルタ変更は1ページ目へ
                setCursorStack([""]);
                loadPage("", { q: next });
              }}
              placeholder="例: 田中 / tanaka@example.com"
            />
          </div>

          {showTenantId ? (
            <div className="w-full sm:max-w-xs">
              <label className="mb-1 block text-xs font-medium text-ink-soft">
                テナントで絞り込み
              </label>
              <select
                className="w-full rounded-lg border border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm"
                value={tenantIdFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setTenantIdFilter(next);
                  syncUrl({ tenantId: next });
                  setCursorStack([""]);
                  loadPage("", { tenantId: next });
                }}
              >
                <option value="">すべて</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}（{t.id}）
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {(query || tenantIdFilter) && (
            <div className="sm:pb-[1px]">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setTenantIdFilter("");
                  syncUrl({ q: "", tenantId: "" });
                  setCursorStack([""]);
                  loadPage("", { q: "", tenantId: "" });
                }}
              >
                クリア
              </Button>
            </div>
          )}
        </div>

        <div className="text-xs text-ink-soft">
          表示: {rows.length}（最大20件/ページ）
        </div>
      </div>

      <Card className="overflow-hidden border border-ink/10 bg-surface/90 shadow-panel">
        <div className="divide-y divide-ink/10">
          <div
            className={[
              "grid items-center bg-secondary/40 px-4 py-3 text-sm font-medium text-ink-soft",
              showTenantId
                ? "grid-cols-[1.2fr_1.4fr_1.4fr_1fr_0.8fr]"
                : "grid-cols-[1.4fr_1.4fr_1fr_0.8fr]",
            ].join(" ")}
          >
            <span>名前</span>
            {showTenantId ? <span>テナント</span> : null}
            <span>メール</span>
            <span>役割</span>
            <span className="text-right">操作</span>
          </div>

          {rows.map((user) => (
            <div
              key={user.id}
              className={[
                "grid items-center px-4 py-3 text-sm text-ink",
                showTenantId
                  ? "grid-cols-[1.2fr_1.4fr_1.4fr_1fr_0.8fr]"
                  : "grid-cols-[1.4fr_1.4fr_1fr_0.8fr]",
              ].join(" ")}
            >
              <Link
                href={`/admin/users/${user.id}`}
                className={[
                  "rounded-xl px-2 py-2 hover:bg-surface-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  showTenantId
                    ? "col-span-3 grid grid-cols-[1.2fr_1.4fr_1.4fr] items-center"
                    : "col-span-2 grid grid-cols-[1.4fr_1.4fr] items-center",
                ].join(" ")}
                title="詳細を開く"
              >
                <div className="truncate font-medium">
                  {user.name ?? "（未設定）"}
                </div>
                {showTenantId ? (
                  <div className="truncate font-mono text-xs text-ink-soft">
                    {user.tenantId}
                  </div>
                ) : null}
                <div className="truncate text-ink-soft">{user.email}</div>
              </Link>

              <div className="flex items-center gap-2">
                <select
                  className="w-full rounded-lg border border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-ink/5"
                  value={user.nextRole}
                  onChange={(event) =>
                    setPendingRole((prev) => ({
                      ...prev,
                      [user.id]: event.target.value as UserRole,
                    }))
                  }
                  disabled={user.disabled || busyId === user.id}
                >
                  {allRoles
                    .map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                </select>
                {user.isSelf ? (
                  <span className="text-xs text-ink-soft">自分</span>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={
                    user.disabled ||
                    busyId === user.id ||
                    user.nextRole === user.originalRole
                  }
                  onClick={() =>
                    updateRole(user.id, user.nextRole)
                  }
                >
                  {busyId === user.id ? "更新中..." : "更新"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={loadingList || cursorStack.length <= 1}
          onClick={() => {
            setCursorStack((prev) => {
              if (prev.length <= 1) return prev;
              const next = prev.slice(0, -1);
              // 1つ前のページ開始カーソルで再取得
              const cursor = next[next.length - 1] ?? "";
              loadPage(cursor);
              return next;
            });
          }}
        >
          前へ
        </Button>

        <div className="text-xs text-ink-soft">
          {loadingList ? "読み込み中..." : null}
        </div>

        <Button
          size="sm"
          variant="secondary"
          disabled={loadingList || !nextCursor}
          onClick={() => {
            if (!nextCursor) return;
            const startCursor = nextCursor;
            setCursorStack((prev) => [...prev, startCursor]);
            loadPage(startCursor);
          }}
        >
          次へ
        </Button>
      </div>

      <div className="min-h-[28px] text-sm">
        {message ? <p className="text-primary">{message}</p> : null}
        {error ? <p className="text-accent">{error}</p> : null}
      </div>
    </section>
  );
}
