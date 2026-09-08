import type { SupportRequestStatus } from "@ccc/db";
import { LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { requireAdmin } from "@/lib/server/auth-helpers";
import {
  countSupportRequestsByStatus,
  listSupportRequests,
} from "@/lib/server/services/support-requests";
import { StatusTabs } from "./status-tabs";
import { RequestRow } from "./request-row";

export const metadata: Metadata = { title: "Scraper requests" };

const STATUSES: SupportRequestStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

function parseStatus(value: string | undefined): SupportRequestStatus | undefined {
  return value && (STATUSES as string[]).includes(value) ? (value as SupportRequestStatus) : undefined;
}

export default async function ScraperRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = parseStatus(params.status);

  const [requests, counts] = await Promise.all([
    listSupportRequests({ status }),
    countSupportRequestsByStatus(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl">Scraper requests</h1>
        <p className="text-sm text-muted-foreground">
          Companies whose boards our scrapers can&apos;t handle yet, sent in by users. Build support,
          then mark resolved — the requester gets notified automatically.
        </p>
      </div>

      <StatusTabs active={status} counts={counts} />

      {requests.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Nothing here"
          description={
            status
              ? "No requests with this status."
              : "No scraper-support requests yet. They'll show up here when users send them from the Companies page."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((request) => (
            <RequestRow key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
