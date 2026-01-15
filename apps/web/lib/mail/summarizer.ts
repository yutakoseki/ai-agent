export type TaskDraft = {
  title: string;
  summary?: string;
  nextAction?: string;
  dueAt?: string;
};

function truncate(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function buildTaskDraft(params: {
  subject?: string;
  snippet?: string;
}): TaskDraft {
  const title = truncate(params.subject, 80) || truncate(params.snippet, 80) || "要対応メール";
  const summary = truncate(params.snippet, 160);
  return {
    title,
    summary,
    nextAction: "内容を確認し、必要な返信・処理を行う",
  };
}

