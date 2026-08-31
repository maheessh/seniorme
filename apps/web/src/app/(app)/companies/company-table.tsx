import { Pencil, RadioTower } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/company-logo";
import type { CompanyWithSources } from "@/lib/server/services/companies";
import { CareerSourcesPanel } from "./career-sources-panel";
import { CompanyFormDialog } from "./company-form-dialog";
import { DeleteCompanyButton } from "./delete-company-button";

const PRIORITY_VARIANT = { LOW: "default", MEDIUM: "primary", HIGH: "warning" } as const;

export function CompanyTable({ companies }: { companies: CompanyWithSources[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Company</th>
            <th className="px-4 py-2.5 font-medium">Location</th>
            <th className="px-4 py-2.5 font-medium">Industry</th>
            <th className="px-4 py-2.5 font-medium">Priority</th>
            <th className="px-4 py-2.5 font-medium">Monitoring</th>
            <th className="px-4 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <CompanyLogo logoUrl={company.logoUrl} name={company.name} size={28} />
                  <span className="font-medium">{company.name}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{company.location ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{company.industry ?? "—"}</td>
              <td className="px-4 py-2.5">
                <Badge variant={PRIORITY_VARIANT[company.priority]}>{company.priority}</Badge>
              </td>
              <td className="px-4 py-2.5">
                {company.monitoringEnabled ? <Badge variant="success">On</Badge> : <Badge>Off</Badge>}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-0.5">
                  <CareerSourcesPanel
                    companyId={company.id}
                    companyName={company.name}
                    sources={company.careerSources}
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Manage career pages for ${company.name}`}
                      >
                        <RadioTower className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <CompanyFormDialog
                    company={company}
                    trigger={
                      <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${company.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <DeleteCompanyButton id={company.id} name={company.name} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
