import type { InboxStatus } from "@ccc/db";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { Archive, Bookmark, CheckCircle2, ExternalLink, X } from "lucide-react";
import { forwardRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/company-logo";
import { cn } from "@/lib/utils";
import type { InboxJob } from "@/lib/server/services/inbox";

/** Postings older than this read as "way too old to bother with" rather than fresh. */
const STALE_POSTING_DAYS = 30;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const WORK_MODE_LABEL: Record<string, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "On-site",
  UNKNOWN: "",
};

export const InboxRow = forwardRef<
  HTMLDivElement,
  {
    job: InboxJob;
    focused: boolean;
    expanded: boolean;
    onFocus: () => void;
    onToggleExpand: () => void;
    onAct: (status: InboxStatus) => void;
    onDismissDuplicate: () => void;
  }
>(function InboxRow({ job, focused, expanded, onFocus, onToggleExpand, onAct, onDismissDuplicate }, ref) {
  const postedStale = job.postedAt ? differenceInDays(new Date(), job.postedAt) > STALE_POSTING_DAYS : false;

  return (
    <div
      ref={ref}
      onClick={onFocus}
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-4 transition-colors cursor-pointer",
        focused ? "border-primary bg-muted/50" : "border-border hover:bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CompanyLogo logoUrl={job.company.logoUrl} name={job.company.name} size={36} />
          <div className="min-w-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onFocus();
                onToggleExpand();
              }}
              className="truncate text-left font-medium leading-tight hover:underline"
            >
              {job.title}
            </button>
            <p className="text-xs text-muted-foreground">
              {job.company.name}
              {job.location ? ` · ${job.location}` : ""}
              {job.isRemoved ? " · no longer listed" : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {job.workMode !== "UNKNOWN" ? <Badge>{WORK_MODE_LABEL[job.workMode]}</Badge> : null}
              {job.employmentType ? <Badge>{job.employmentType.replace("_", " ")}</Badge> : null}
              {job.postedAt ? (
                <span className={cn("text-xs", postedStale ? "text-warning" : "text-muted-foreground")}>
                  posted {formatDistanceToNow(job.postedAt, { addSuffix: true })}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                discovered {formatDistanceToNow(job.discoveredAt, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(event) => event.stopPropagation()}
        >
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            aria-label="Open posting"
            className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <Button type="button" variant="ghost" size="icon" aria-label="Save for later" onClick={() => onAct("SAVED")}>
            <Bookmark className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Apply" onClick={() => onAct("APPLIED")}>
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Ignore" onClick={() => onAct("IGNORED")}>
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {job.possibleDuplicateOf ? (
        <div
          className="flex items-center justify-between gap-2 rounded-lg bg-warning/10 px-3 py-1.5 text-xs text-warning"
          onClick={(event) => event.stopPropagation()}
        >
          <span>Possibly a repost of &ldquo;{job.possibleDuplicateOf.title}&rdquo;</span>
          <button type="button" onClick={onDismissDuplicate} className="inline-flex items-center gap-0.5 underline">
            <X className="h-3 w-3" /> not a duplicate
          </button>
        </div>
      ) : null}

      {expanded && job.descriptionRaw ? (
        <p
          className="max-h-64 overflow-y-auto whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"
          onClick={(event) => event.stopPropagation()}
        >
          {stripHtml(job.descriptionRaw)}
        </p>
      ) : null}
    </div>
  );
});
