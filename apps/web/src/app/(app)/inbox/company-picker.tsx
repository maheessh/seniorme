"use client";

import type { Company } from "@ccc/db";
import { useEffect, useRef, useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { Input } from "@/components/ui/input";
import { searchCompaniesAction } from "./import-actions";

export function CompanyPicker({
  defaultName,
  defaultDomain,
}: {
  defaultName?: string | null;
  defaultDomain?: string | null;
}) {
  const [query, setQuery] = useState(defaultName ?? "");
  const [matches, setMatches] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Company | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The backend already dedupes by domain on save, but searching on mount lets the picker
  // tell the user up front — "using existing company" — instead of only finding out after
  // submitting that their "new" company was actually reused.
  useEffect(() => {
    if (!defaultName) return;
    void searchCompaniesAction(defaultName).then((results) => {
      setMatches(results);
      const exact = results.find((company) => company.name.toLowerCase() === defaultName.toLowerCase());
      if (exact) setSelected(exact);
    });
    // Only run for the extracted default this dialog opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(value: string) {
    setQuery(value);
    setSelected(null);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void searchCompaniesAction(value).then(setMatches);
    }, 200);
  }

  return (
    <div className="relative">
      <Input
        id="companyPicker"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Company name"
        required
      />
      <input type="hidden" name="companyId" value={selected?.id ?? ""} />
      <input type="hidden" name="newCompanyName" value={selected ? "" : query} />
      <input type="hidden" name="newCompanyDomain" value={selected ? "" : (defaultDomain ?? "")} />

      {open && !selected && matches.length > 0 ? (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {matches.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => {
                setSelected(company);
                setQuery(company.name);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <CompanyLogo logoUrl={company.logoUrl} name={company.name} size={20} />
              {company.name}
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-1 text-xs text-muted-foreground">
        {selected ? "Using existing company" : query ? "Will create a new company" : ""}
      </p>
    </div>
  );
}
