import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  label?: string;
};

export function Input({ className, error, label, id, ...props }: Props) {
  const inputId = id || props.name;
  return (
    <label className="flex flex-col gap-1 text-sm text-ink" htmlFor={inputId}>
      {label ? <span className="font-medium">{label}</span> : null}
      <input
        id={inputId}
        className={clsx(
          "h-10 rounded-md border border-surface bg-secondary px-3 text-ink placeholder:text-ink-soft",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          error && "border-accent text-ink",
          className
        )}
        {...props}
      />
      {error ? <span className="text-xs text-accent">{error}</span> : null}
    </label>
  );
}

