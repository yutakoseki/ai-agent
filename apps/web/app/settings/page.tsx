import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminShell } from "@/app/admin/AdminShell";
import { getUserPreferences } from "@/lib/repos/userPreferencesRepo";
import { SettingsClient } from "./settingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const prefs = await getUserPreferences({ tenantId: session.tenantId, userId: session.userId });
  const taskVisibleCategories =
    prefs?.taskVisibleCategories ?? ["action_required"];
  const rssGenerationTargets = prefs?.rssGenerationTargets ?? ["x"];

  return (
    <AdminShell email={session.email} role={session.role}>
      <SettingsClient
        initialTaskVisibleCategories={taskVisibleCategories}
        initialRssTargets={rssGenerationTargets}
      />
    </AdminShell>
  );
}

