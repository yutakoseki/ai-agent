'use client';

import { useMemo } from "react";
import clsx from "clsx";

type Item = { key: string; label: string; ok: boolean };

function buildItems(password: string, confirmPassword?: string): Item[] {
  const items: Item[] = [
    { key: "len", label: "8文字以上", ok: password.length >= 8 },
    { key: "upper", label: "大文字を含む", ok: /[A-Z]/.test(password) },
    { key: "lower", label: "小文字を含む", ok: /[a-z]/.test(password) },
    { key: "digit", label: "数字を含む", ok: /[0-9]/.test(password) },
  ];
  if (typeof confirmPassword !== "undefined") {
    items.push({
      key: "match",
      label: "確認用パスワードと一致",
      ok: password.length > 0 && password === confirmPassword,
    });
  }
  return items;
}

export function PasswordChecklist(props: {
  password: string;
  confirmPassword?: string;
  className?: string;
}) {
  const items = useMemo(
    () => buildItems(props.password, props.confirmPassword),
    [props.password, props.confirmPassword]
  );
  const ok = items.every((i) => i.ok);

  return (
    <div
      className={clsx(
        "rounded-xl border border-ink/10 bg-surface-raised/60 px-3 py-2 text-sm",
        props.className
      )}
      aria-label="パスワード要件"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ink-soft">パスワード要件</span>
        <span
          className={clsx(
            "text-xs font-semibold",
            ok ? "text-primary" : "text-ink-soft"
          )}
          aria-live="polite"
        >
          {ok ? "OK" : "未達"}
        </span>
      </div>
      <ul className="mt-2 grid gap-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <span
              className={clsx(
                "grid h-5 w-5 place-items-center rounded-full border text-xs font-semibold",
                item.ok
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-ink/10 bg-secondary/40 text-ink-soft"
              )}
              aria-hidden="true"
            >
              {item.ok ? "✓" : "–"}
            </span>
            <span className={clsx(item.ok ? "text-ink" : "text-ink-muted")}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}


