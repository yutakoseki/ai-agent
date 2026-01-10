import type { ReactNode } from "react";
import { useEffect } from "react";
import { Card } from "./Card";

type Props = {
  open: boolean;
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
};

export function Dialog({ open, title, children, actions, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-secondary/70 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card
        title={title}
        actions={actions}
        className="w-full max-w-lg border border-ink/10 bg-surface"
      >
        {children}
      </Card>
    </div>
  );
}


