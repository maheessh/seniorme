import type { SupportRequestStatus } from "@ccc/db";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS: { key: SupportRequestStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "RESOLVED", label: "Resolved" },
];

export function StatusTabs({
  active,
  counts,
}: {
  active?: SupportRequestStatus;
  counts: Record<SupportRequestStatus, number>;
}) {
  const total = counts.OPEN + counts.IN_PROGRESS + counts.RESOLVED;

  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {TABS.map(({ key, label }) => {
        const isActive = key === "ALL" ? !active : active === key;
        const count = key === "ALL" ? total : counts[key];
        const href = key === "ALL" ? "/admin/scraper-requests" : `/admin/scraper-requests?status=${key}`;
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{count}</span>
          </Link>
        );
      })}
    </div>
  );
}
