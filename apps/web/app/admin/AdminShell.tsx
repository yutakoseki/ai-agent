'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IconInbox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-7h14l2 7v7H3v-7z"
      />
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13h6l1 2h4l1-2h6"
      />
    </svg>
  );
}

function IconShield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"
      />
    </svg>
  );
}

function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-6v-6H10v6H4a1 1 0 0 1-1-1V10.5z"
      />
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell(props: {
  children: React.ReactNode;
  email: string;
  role: string;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [expanded, setExpanded] = useState(false); // デフォルト: アイコンのみ
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems: NavItem[] = useMemo(
    () => [
      {
        href: "/admin/tenant-applications",
        label: "テナント申請",
        icon: <IconInbox className="h-5 w-5" aria-hidden="true" />,
      },
      {
        href: "/admin/roles",
        label: "権限管理",
        icon: <IconShield className="h-5 w-5" aria-hidden="true" />,
      },
      {
        href: "/",
        label: "ホーム",
        icon: <IconHome className="h-5 w-5" aria-hidden="true" />,
      },
    ],
    []
  );

  const sidebarWidth = expanded ? "w-60" : "w-16";
  const contentPadding = expanded ? "pl-60" : "pl-16";

  async function logout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      // cookie削除はサーバー側で行う。成功/失敗に関わらずログイン画面へ。
      router.replace("/login");
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-[100svh] bg-secondary text-ink">
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 border-r border-ink/10 bg-surface/90 shadow-panel",
          "transition-[width] duration-200 ease-out",
          sidebarWidth
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-3">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl border border-ink/10 bg-surface-raised/70 text-ink hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={expanded ? "サイドバーを折りたたむ" : "サイドバーを展開"}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              <IconMenu className="h-5 w-5" aria-hidden="true" />
            </button>

            {expanded ? (
              <div className="ml-3 min-w-0">
                <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">
                  Admin
                </p>
                <p className="truncate text-sm font-semibold">管理コンソール</p>
              </div>
            ) : null}
          </div>

          <nav className="flex-1 px-2 py-2">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                        "transition-colors",
                        active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-ink/10 bg-surface-raised/60 text-ink hover:bg-surface-raised"
                      )}
                      title={!expanded ? item.label : undefined}
                    >
                      <span className="grid h-6 w-6 place-items-center">
                        {item.icon}
                      </span>
                      {expanded ? (
                        <span className="min-w-0 truncate">{item.label}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-ink/10 p-2">
            <button
              type="button"
              className={clsx(
                "mb-2 flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                "transition-colors",
                "border-ink/10 bg-surface-raised/60 text-ink hover:bg-surface-raised",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
              onClick={logout}
              disabled={isLoggingOut}
              aria-label="ログアウト"
              title={!expanded ? "ログアウト" : undefined}
            >
              <span className="grid h-6 w-6 place-items-center" aria-hidden="true">
                ⇦
              </span>
              {expanded ? <span className="min-w-0 truncate">ログアウト</span> : null}
            </button>

            <div
              className={clsx(
                "rounded-xl border border-ink/10 bg-surface-raised/60 px-3 py-2 text-xs text-ink-soft",
                !expanded && "text-center"
              )}
              title={!expanded ? `${props.email} / ${props.role}` : undefined}
            >
              {expanded ? (
                <>
                  <div className="truncate">ログイン: {props.email}</div>
                  <div className="truncate">Role: {props.role}</div>
                </>
              ) : (
                <span className="font-semibold">AI</span>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className={clsx("transition-[padding] duration-200 ease-out", contentPadding)}>
        <div className="px-4 py-6 md:px-6 lg:px-8">{props.children}</div>
      </div>
    </div>
  );
}


