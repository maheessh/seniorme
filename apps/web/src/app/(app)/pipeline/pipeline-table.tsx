"use client";

import { differenceInDays, format, formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { cn } from "@/lib/utils";
import type { ApplicationWithRelations } from "@/lib/server/services/applications";
import { ApplicationDetailDialog } from "./application-detail-dialog";
import { StageBadge } from "./stage-badge";

/** Postings older than this read as "way too old to bother with" rather than fresh. */
const STALE_POSTING_DAYS = 30;

export function PipelineTable({ applications }: { applications: ApplicationWithRelations[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Position</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 font-medium">Posted</th>
              <th className="px-4 py-2.5 font-medium">Applied</th>
              <th className="px-4 py-2.5 font-medium">Deadline</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => {
              const postedAt = application.job.postedAt;
              const postedStale = postedAt ? differenceInDays(new Date(), postedAt) > STALE_POSTING_DAYS : false;
              return (
                <tr
                  key={application.id}
                  onClick={() => setOpenId(application.id)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <CompanyLogo logoUrl={application.company.logoUrl} name={application.company.name} size={28} />
                      <span className="font-medium">{application.company.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{application.job.title}</td>
                  <td className="px-4 py-2.5">
                    <StageBadge stage={application.stage} />
                  </td>
                  <td className={cn("px-4 py-2.5", postedStale ? "text-warning" : "text-muted-foreground")}>
                    {postedAt ? formatDistanceToNow(postedAt, { addSuffix: true }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {application.appliedAt ? format(application.appliedAt, "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {application.deadline ? format(application.deadline, "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={application.job.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      aria-label="Open posting"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ApplicationDetailDialog applicationId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
