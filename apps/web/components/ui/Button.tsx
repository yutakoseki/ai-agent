import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "ghost" | "secondary";
type ButtonSize = "md" | "sm";

type Props = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary disabled:opacity-60 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-secondary hover:bg-primary-light active:bg-primary-dark",
  ghost:
    "bg-transparent text-ink hover:bg-surface active:bg-surface-raised border border-surface",
  secondary:
    "bg-surface text-ink hover:bg-surface-raised border border-surface active:border-primary",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-sm",
  sm: "h-9 px-3 text-sm",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  className,
  ...props
}: Props) {
  return (
    <button
      className={clsx(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {icon ? <span className="grid place-items-center">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

