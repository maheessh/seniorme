"use client";

import type { Company, EmploymentType } from "@ccc/db";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchCompaniesAction } from "./import-actions";

// Matches the literal enum-derived text already shown on each row's badge (inbox-row.tsx does
// `employmentType.replace("_", " ")`, no title-casing) — same label wherever it appears.
const EMPLOYMENT_TYPES: EmploymentType[] = ["INTERNSHIP", "NEW_GRAD", "FULL_TIME", "CONTRACT"];

export function InboxFilters({
  status,
  initialCompanies,
  initialTypes,
}: {
  status: string;
  initialCompanies: Company[];
  initialTypes: EmploymentType[];
}) {
  const router = useRouter();
  const [companies, setCompanies] = useState(initialCompanies);
  const [types, setTypes] = useState(initialTypes);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function navigate(nextCompanies: Company[], nextTypes: EmploymentType[]) {
    const params = new URLSearchParams({ status });
    if (nextCompanies.length > 0) params.set("companies", nextCompanies.map((c) => c.id).join(","));
    if (nextTypes.length > 0) params.set("types", nextTypes.join(","));
    router.push(`/inbox?${params.toString()}`);
  }

  function search(value: string) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void searchCompaniesAction(value).then(setMatches);
    }, 200);
  }

  const selectedCompanyIds = new Set(companies.map((c) => c.id));

  function toggleCompany(company: Company) {
    const next = selectedCompanyIds.has(company.id)
      ? companies.filter((c) => c.id !== company.id)
      : [...companies, company];
    setCompanies(next);
    // Clears the search text after a pick — otherwise it's still sitting there (matching the
    // company just added) the next time the user wants to search for a different one.
    setQuery("");
    void searchCompaniesAction("").then(setMatches);
    navigate(next, types);
  }

  function removeCompany(companyId: string) {
    const next = companies.filter((c) => c.id !== companyId);
    setCompanies(next);
    navigate(next, types);
  }

  function toggleType(type: EmploymentType) {
    const next = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
    setTypes(next);
    navigate(companies, next);
  }

  function clearAll() {
    setCompanies([]);
    setTypes([]);
    setQuery("");
    setMatches([]);
    navigate([], []);
  }

  const hasFilters = companies.length > 0 || types.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {companies.map((company) => (
          <span
            key={company.id}
            className="flex items-center gap-1 rounded-full border border-border bg-muted py-0.5 pr-1 pl-1.5 text-xs"
          >
            <CompanyLogo logoUrl={company.logoUrl} name={company.name} size={14} />
            {company.name}
            <button
              type="button"
              aria-label={`Remove ${company.name} filter`}
              onClick={() => removeCompany(company.id)}
              className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-border hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <div className="relative">
          <Input
            value={query}
            onChange={(event) => {
              search(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              if (matches.length === 0) void searchCompaniesAction("").then(setMatches);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={companies.length > 0 ? "Add company…" : "Filter by company…"}
            className="h-8 w-48 text-sm"
          />
          {open && matches.length > 0 ? (
            <div className="absolute z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {matches.map((company) => {
                const isSelected = selectedCompanyIds.has(company.id);
                return (
                  <button
                    key={company.id}
                    type="button"
                    // Keeps focus on the input (skipping the button's default mousedown-focus)
                    // so blur doesn't close this before the click registers — needed here more
                    // than in a single-select picker, since checking several in a row shouldn't
                    // require re-opening the dropdown between each one.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggleCompany(company)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {isSelected ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <CompanyLogo logoUrl={company.logoUrl} name={company.name} size={18} />
                    <span className="truncate">{company.name}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {EMPLOYMENT_TYPES.map((type) => {
          const isSelected = types.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggleType(type)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                isSelected
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {type.replace("_", " ")}
            </button>
          );
        })}
      </div>

      {hasFilters ? (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
