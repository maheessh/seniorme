import type { EmploymentType, InboxStatus } from "@ccc/db";
import type { Metadata } from "next";
import { getCompaniesByIds } from "@/lib/server/services/companies";
import { countInboxJobs, INBOX_STATUSES, listInboxJobs } from "@/lib/server/services/inbox";
import { ImportJobDialog } from "./import-job-dialog";
import { InboxFilters } from "./inbox-filters";
import { InboxList } from "./inbox-list";
import { StatusTabs } from "./status-tabs";

export const metadata: Metadata = { title: "Inbox" };

const EMPLOYMENT_TYPES: EmploymentType[] = ["INTERNSHIP", "NEW_GRAD", "FULL_TIME", "CONTRACT"];

function parseStatus(value: string | undefined): InboxStatus {
  return value && (INBOX_STATUSES as string[]).includes(value) ? (value as InboxStatus) : "NEW";
}

function parseCsv(value: string | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

function parseEmploymentTypes(value: string | undefined): EmploymentType[] {
  const requested = new Set(parseCsv(value));
  return EMPLOYMENT_TYPES.filter((type) => requested.has(type));
}

const EMPTY_LABEL: Record<InboxStatus, string> = {
  NEW: "No newly discovered jobs right now — check back after the next career-page scan, or trigger a manual refresh from Companies.",
  SAVED: "Nothing saved for later yet.",
  APPLIED: "No applications started from the inbox yet.",
  IGNORED: "Nothing ignored yet — ignored jobs are cleared out automatically after a couple of hours.",
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; companies?: string; types?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const companyIds = parseCsv(params.companies);
  const employmentTypes = parseEmploymentTypes(params.types);

  const [counts, jobs, selectedCompanies] = await Promise.all([
    countInboxJobs(),
    listInboxJobs(status, { companyIds, employmentTypes }),
    getCompaniesByIds(companyIds),
  ]);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Triage discovered jobs fast — click a row or press{" "}
            <kbd className="rounded border border-border px-1 text-xs">j</kbd>/
            <kbd className="rounded border border-border px-1 text-xs">k</kbd> to move,{" "}
            <kbd className="rounded border border-border px-1 text-xs">s</kbd> save,{" "}
            <kbd className="rounded border border-border px-1 text-xs">a</kbd> apply,{" "}
            <kbd className="rounded border border-border px-1 text-xs">g</kbd> ignore,{" "}
            <kbd className="rounded border border-border px-1 text-xs">Enter</kbd> expand.
          </p>
        </div>
        <ImportJobDialog />
      </div>

      <StatusTabs active={status} counts={counts} companies={params.companies} types={params.types} />

      <InboxFilters status={status} initialCompanies={selectedCompanies} initialTypes={employmentTypes} />

      <div className="min-h-0 flex-1">
        <InboxList
          key={`${status}:${companyIds.join(",")}:${employmentTypes.join(",")}`}
          jobs={jobs}
          emptyLabel={EMPTY_LABEL[status]}
        />
      </div>
    </div>
  );
}
