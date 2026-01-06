import type { ReactNode } from "react";
import clsx from "clsx";

type Props = {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  title?: ReactNode;
  actions?: ReactNode;
};

export function Card({ children, className, padded = true, title, actions }: Props) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-surface bg-surface shadow-panel",
        className
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-surface px-4 py-3">
          <div className="text-sm font-semibold text-ink">{title}</div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      )}
      <div className={clsx(padded && "p-4")}>{children}</div>
    </div>
  );
}



