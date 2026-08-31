import type { InboxStatus } from "@ccc/db";
import { countInboxJobs, INBOX_STATUSES, listInboxJobs } from "@/lib/server/services/inbox";
import { ImportJobDialog } from "./import-job-dialog";
import { InboxList } from "./inbox-list";
import { StatusTabs } from "./status-tabs";

function parseStatus(value: string | undefined): InboxStatus {
  return value && (INBOX_STATUSES as string[]).includes(value) ? (value as InboxStatus) : "NEW";
}

const EMPTY_LABEL: Record<InboxStatus, string> = {
  NEW: "No newly discovered jobs right now — check back after the next career-page scan, or trigger a manual refresh from Companies.",
  INTERESTED: "Nothing marked interested yet.",
  SAVED: "Nothing saved for later yet.",
  APPLIED: "No applications started from the inbox yet.",
  NOT_INTERESTED: "Nothing marked not interested yet.",
  IGNORED: "Nothing ignored yet.",
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);

  const [counts, jobs] = await Promise.all([countInboxJobs(), listInboxJobs(status)]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Triage discovered jobs fast — click a row or press{" "}
            <kbd className="rounded border border-border px-1 text-xs">j</kbd>/
            <kbd className="rounded border border-border px-1 text-xs">k</kbd> to move,{" "}
            <kbd className="rounded border border-border px-1 text-xs">i</kbd> interested,{" "}
            <kbd className="rounded border border-border px-1 text-xs">s</kbd> save,{" "}
            <kbd className="rounded border border-border px-1 text-xs">a</kbd> apply,{" "}
            <kbd className="rounded border border-border px-1 text-xs">x</kbd> not interested,{" "}
            <kbd className="rounded border border-border px-1 text-xs">g</kbd> ignore,{" "}
            <kbd className="rounded border border-border px-1 text-xs">Enter</kbd> expand.
          </p>
        </div>
        <ImportJobDialog />
      </div>

      <StatusTabs active={status} counts={counts} />

      <InboxList key={status} jobs={jobs} emptyLabel={EMPTY_LABEL[status]} />
    </div>
  );
}
