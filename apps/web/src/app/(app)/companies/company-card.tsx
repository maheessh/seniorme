import type { Company } from "@ccc/db";
import { Pencil, RadioTower } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyFormDialog } from "./company-form-dialog";
import { DeleteCompanyButton } from "./delete-company-button";

const PRIORITY_VARIANT = { LOW: "default", MEDIUM: "primary", HIGH: "warning" } as const;

export function CompanyCard({ company }: { company: Company }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <CompanyLogo logoUrl={company.logoUrl} name={company.name} />
          <div>
            <p className="font-medium leading-tight">{company.name}</p>
            <p className="text-xs text-muted-foreground">
              {[company.location, company.industry].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
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
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={PRIORITY_VARIANT[company.priority]}>{company.priority}</Badge>
        {company.monitoringEnabled ? (
          <Badge variant="success">
            <RadioTower className="h-3 w-3" /> Monitoring on
          </Badge>
        ) : (
          <Badge>Monitoring off</Badge>
        )}
      </div>

      {company.rolesOfInterest.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {company.rolesOfInterest.map((role) => (
            <Badge key={role} variant="default">
              {role}
            </Badge>
          ))}
        </div>
      ) : null}

      {company.notes ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{company.notes}</p>
      ) : null}
    </Card>
  );
}
