import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminShell } from "@/app/admin/AdminShell";
import { listNotices } from "@/lib/repos/noticeRepo";
import { HomeClient } from "./HomeClient";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canEdit = session.role === "Admin";
  const notices = await listNotices();

  return (
    <AdminShell email={session.email} role={session.role}>
      <HomeClient notices={notices} canEdit={canEdit} />
    </AdminShell>
  );
}

