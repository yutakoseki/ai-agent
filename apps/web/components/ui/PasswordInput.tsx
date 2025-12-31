'use client';

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import clsx from "clsx";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  error?: string;
  label?: string;
};

function IconEye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z"
      />
      <circle cx="12" cy="12" r="3" strokeWidth="2" />
    </svg>
  );
}

function IconEyeOff(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18"
      />
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.6 10.6a2.9 2.9 0 0 0 4.1 4.1"
      />
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.9 5.1A10.5 10.5 0 0 1 12 5c6 0 9.5 7 9.5 7a17.1 17.1 0 0 1-2.1 3.2"
      />
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.6 6.6C4.2 8.4 2.5 12 2.5 12s3.5 7 9.5 7c1 0 1.9-.2 2.7-.4"
      />
    </svg>
  );
}

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { className, error, label, id, ...props },
  ref
) {
  const [visible, setVisible] = useState(false);
  const inputId = id || props.name;

  return (
    <label className="flex flex-col gap-1 text-sm text-ink" htmlFor={inputId}>
      {label ? <span className="font-medium">{label}</span> : null}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          className={clsx(
            "h-10 w-full rounded-md border border-surface bg-secondary px-3 pr-10 text-ink placeholder:text-ink-soft",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            error && "border-accent text-ink",
            className
          )}
          {...props}
        />
        <button
          type="button"
          className={clsx(
            "absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-transparent p-1.5",
            "text-ink-soft hover:bg-surface-raised/60 hover:text-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
          onClick={() => setVisible((v) => !v)}
          disabled={props.disabled}
          aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
          aria-pressed={visible}
        >
          {visible ? (
            <IconEyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <IconEye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error ? <span className="text-xs text-accent">{error}</span> : null}
    </label>
  );
});


