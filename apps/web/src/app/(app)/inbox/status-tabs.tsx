import type { InboxStatus } from "@ccc/db";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { INBOX_STATUSES, type InboxCounts } from "@/lib/server/services/inbox";

const LABELS: Record<InboxStatus, string> = {
  NEW: "New",
  SAVED: "Saved",
  APPLIED: "Applied",
  IGNORED: "Ignored",
};

export function StatusTabs({
  active,
  counts,
  companies,
  types,
}: {
  active: InboxStatus;
  counts: InboxCounts;
  companies?: string;
  types?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {INBOX_STATUSES.map((status) => {
        const params = new URLSearchParams({ status });
        if (companies) params.set("companies", companies);
        if (types) params.set("types", types);
        return (
          <Link
            key={status}
            href={`/inbox?${params.toString()}`}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active === status
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {LABELS[status]}
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
              {counts[status]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
