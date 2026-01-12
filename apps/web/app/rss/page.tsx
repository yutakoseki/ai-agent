import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminShell } from "@/app/admin/AdminShell";
import { listSourcesByUser } from "@/lib/repos/rssSourceRepo";
import { listDraftsByUser } from "@/lib/repos/rssDraftRepo";
import { RssClient } from "./RssClient";

export default async function RssPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const sources = await listSourcesByUser({ userId: session.userId });
  const sortedSources = sources.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  const drafts = await listDraftsByUser({ userId: session.userId });
  const sortedDrafts = drafts.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const viewSources = sortedSources.map((source) => ({
    id: source.id,
    url: source.url,
    status: source.status,
    title: source.title,
    lastFetchedAt: source.lastFetchedAt ? source.lastFetchedAt.toISOString() : null,
    nextFetchAt: source.nextFetchAt ? source.nextFetchAt.toISOString() : null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }));

  const viewDrafts = sortedDrafts.map((draft) => ({
    id: draft.id,
    target: draft.target,
    itemTitle: draft.itemTitle,
    itemUrl: draft.itemUrl,
    sourceTitle: draft.sourceTitle,
    title: draft.title,
    text: draft.text,
    createdAt: draft.createdAt.toISOString(),
  }));

  return (
    <AdminShell email={session.email} role={session.role}>
      <RssClient sources={viewSources} drafts={viewDrafts} />
    </AdminShell>
  );
}
