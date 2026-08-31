"use client";

import type { ExtractedJobImport } from "@ccc/scraper";
import { Import } from "lucide-react";
import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CompanyPicker } from "./company-picker";
import { confirmJobImportAction, extractJobUrlAction, type ImportFormState } from "./import-actions";

const SOURCE_LABEL: Record<ExtractedJobImport["source"], string> = {
  "ats-api": "Extracted via the ATS's API — high confidence",
  "json-ld": "Extracted from the page's structured data — high confidence",
  llm: "AI-assisted extraction — please double-check",
  opengraph: "Only basic page metadata was available — please review carefully",
  none: "Automatic extraction didn't find much — fill in the details below",
};

function toDateInput(value: Date | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function toPlainText(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ImportJobDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedJobImport | null>(null);

  const [state, formAction, pending] = useActionState<ImportFormState, FormData>(
    confirmJobImportAction,
    undefined,
  );

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) {
      setOpen(false);
      setUrl("");
      setExtracted(null);
      setFetchError(null);
    }
  }

  async function handleFetch() {
    setFetching(true);
    setFetchError(null);
    const result = await extractJobUrlAction(url);
    setFetching(false);
    if (result.error) {
      setFetchError(result.error);
      return;
    }
    if (result.data) setExtracted(result.data);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setUrl("");
          setExtracted(null);
          setFetchError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Import className="h-4 w-4" /> Import job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import a job from a URL</DialogTitle>
          <DialogDescription>
            Paste a job posting link and we&apos;ll try to pull in the details automatically.
          </DialogDescription>
        </DialogHeader>

        {!extracted ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://jobs.example.com/openings/123"
                autoFocus
              />
              <Button type="button" onClick={handleFetch} disabled={fetching || !url}>
                {fetching ? "Fetching…" : "Fetch"}
              </Button>
            </div>
            {fetchError ? <p className="text-sm text-destructive">{fetchError}</p> : null}
            <button
              type="button"
              className="self-start text-xs text-muted-foreground underline"
              onClick={() =>
                setExtracted({
                  source: "none",
                  url,
                  title: "",
                  companyName: "",
                  companyDomain: null,
                  companyLogoUrl: null,
                  location: null,
                  workMode: "UNKNOWN",
                  employmentType: null,
                  description: null,
                  externalJobId: null,
                  postedAt: null,
                  salaryMin: null,
                  salaryMax: null,
                })
              }
            >
              Skip extraction, enter details manually
            </button>
          </div>
        ) : (
          <form action={formAction} className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
            <input type="hidden" name="url" value={extracted.url} />
            <input type="hidden" name="externalJobId" value={extracted.externalJobId ?? ""} />

            <Badge variant={extracted.source === "none" ? "default" : "primary"}>
              {SOURCE_LABEL[extracted.source]}
            </Badge>
            {extracted.warning ? <p className="text-xs text-muted-foreground">{extracted.warning}</p> : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Job title</Label>
              <Input id="title" name="title" defaultValue={extracted.title ?? ""} required />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyPicker">Company</Label>
              <CompanyPicker defaultName={extracted.companyName} defaultDomain={extracted.companyDomain} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" defaultValue={extracted.location ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workMode">Work mode</Label>
                <Select id="workMode" name="workMode" defaultValue={extracted.workMode}>
                  <option value="UNKNOWN">Unknown</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ONSITE">On-site</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="employmentType">Employment type</Label>
                <Select id="employmentType" name="employmentType" defaultValue={extracted.employmentType ?? ""}>
                  <option value="">Unspecified</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="NEW_GRAD">New grad</option>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="CONTRACT">Contract</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="postedAt">Posted date</Label>
                <Input id="postedAt" name="postedAt" type="date" defaultValue={toDateInput(extracted.postedAt)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="salaryMin">Salary min</Label>
                <Input id="salaryMin" name="salaryMin" type="number" defaultValue={extracted.salaryMin ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="salaryMax">Salary max</Label>
                <Input id="salaryMax" name="salaryMax" type="number" defaultValue={extracted.salaryMax ?? ""} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                className="min-h-32"
                defaultValue={toPlainText(extracted.description)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="addToPipeline"
                name="addToPipeline"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="addToPipeline" className="font-normal">
                Add directly to the pipeline as Applied
              </Label>
            </div>

            {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save job"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setExtracted(null)}>
                Back
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
