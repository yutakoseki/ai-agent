import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-[100svh] bg-secondary text-ink">{children}</body>
    </html>
  );
}

