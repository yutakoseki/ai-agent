import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminShell } from "./AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AdminShell email={session.email} role={session.role}>
      {children}
    </AdminShell>
  );
}


