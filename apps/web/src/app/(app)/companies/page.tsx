import { Building2, Plus } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { listCompanies } from "@/lib/server/services/companies";
import { CompaniesToolbar } from "./companies-toolbar";

export const metadata: Metadata = { title: "Companies" };
import { CompanyCard } from "./company-card";
import { CompanyFormDialog } from "./company-form-dialog";
import { CompanyTable } from "./company-table";

type Priority = "LOW" | "MEDIUM" | "HIGH";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; priority?: string; view?: string }>;
}) {
  const params = await searchParams;
  const priority =
    params.priority === "LOW" || params.priority === "MEDIUM" || params.priority === "HIGH"
      ? (params.priority as Priority)
      : undefined;

  const companies = await listCompanies({ search: params.search, priority });
  const hasAnyCompanies = companies.length > 0 || Boolean(params.search || priority);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl">Companies</h1>
        <p className="text-sm text-muted-foreground">
          Track the companies you&apos;re targeting and enable career-page monitoring.
        </p>
      </div>

      {hasAnyCompanies ? (
        <>
          <CompaniesToolbar />
          {companies.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No companies match your filters.
            </p>
          ) : params.view === "table" ? (
            <CompanyTable companies={companies} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add the companies you're targeting to start tracking their career pages and roles you're interested in."
          action={
            <CompanyFormDialog
              trigger={
                <Button type="button">
                  <Plus className="h-4 w-4" /> Add your first company
                </Button>
              }
            />
          }
        />
      )}
    </div>
  );
}
