import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminShell } from "@/app/admin/AdminShell";
import { listSourcesByUser } from "@/lib/repos/rssSourceRepo";
import { listDraftsByUser } from "@/lib/repos/rssDraftRepo";
import { getUserPreferences } from "@/lib/repos/userPreferencesRepo";
import { listXPostBatchesByUser } from "@/lib/repos/xPostBatchRepo";
import { toViewBatch } from "@/lib/x-posts/serializer";
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
  const batches = await listXPostBatchesByUser({ userId: session.userId });
  const sortedBatches = batches.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  const prefs = await getUserPreferences({
    tenantId: session.tenantId,
    userId: session.userId,
  });
  const rssGenerationTargets = prefs?.rssGenerationTargets ?? ["x"];
  const rssWriterRole = prefs?.rssWriterRole ?? "";
  const rssTargetPersona = prefs?.rssTargetPersona ?? "";
  const rssPostTone = prefs?.rssPostTone ?? "";
  const rssPostFormat = prefs?.rssPostFormat ?? "";

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
  const viewBatches = sortedBatches.map(toViewBatch);

  return (
    <AdminShell email={session.email} role={session.role}>
      <RssClient
        sources={viewSources}
        drafts={viewDrafts}
        initialRssTargets={rssGenerationTargets}
        initialRssWriterRole={rssWriterRole}
        initialRssTargetPersona={rssTargetPersona}
        initialRssPostTone={rssPostTone}
        initialRssPostFormat={rssPostFormat}
        initialXPostBatches={viewBatches}
      />
    </AdminShell>
  );
}
