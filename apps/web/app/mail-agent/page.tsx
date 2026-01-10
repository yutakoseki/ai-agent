import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminShell } from "@/app/admin/AdminShell";
import { MailAgentClient } from "./MailAgentClient";

export default async function MailAgentPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AdminShell email={session.email} role={session.role}>
      <MailAgentClient />
    </AdminShell>
  );
}


