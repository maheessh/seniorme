"use client";

import type { Company } from "@ccc/db";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
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
import { createCompanyAction, updateCompanyAction, type CompanyFormState } from "./actions";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function CompanyFormDialog({ company, trigger }: { company?: Company; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const action = company ? updateCompanyAction.bind(null, company.id) : createCompanyAction;
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(action, undefined);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setOpen(false);
  }

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{company ? "Edit company" : "Add company"}</DialogTitle>
          <DialogDescription>
            {company
              ? "Update how you're tracking this company."
              : "Track a company you're targeting for your job search."}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={company?.name} required />
              <FieldError messages={state?.fieldErrors?.name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                name="domain"
                placeholder="stripe.com"
                defaultValue={company?.domain ?? ""}
              />
              <FieldError messages={state?.fieldErrors?.domain} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                placeholder="https://stripe.com"
                defaultValue={company?.website ?? ""}
              />
              <FieldError messages={state?.fieldErrors?.website} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" defaultValue={company?.location ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" defaultValue={company?.industry ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" name="priority" defaultValue={company?.priority ?? "MEDIUM"}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="monitoringEnabled"
                name="monitoringEnabled"
                type="checkbox"
                defaultChecked={company?.monitoringEnabled ?? true}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="monitoringEnabled" className="font-normal">
                Enable career-page monitoring
              </Label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rolesOfInterest">Roles of interest</Label>
            <Input
              id="rolesOfInterest"
              name="rolesOfInterest"
              placeholder="Software Engineer, Data Scientist, Product Manager"
              defaultValue={company?.rolesOfInterest.join(", ")}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. A newly-discovered posting is only kept if its title contains at
              least one of these — leave blank to keep everything. Useful at a company with a
              huge board (Amazon, Google, ...) where most postings aren&apos;t relevant to you.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="targetLocationKeywords">Target locations</Label>
              <Input
                id="targetLocationKeywords"
                name="targetLocationKeywords"
                placeholder="Seattle, Remote, New York"
                defaultValue={company?.targetLocationKeywords.join(", ")}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. Only keeps postings whose location matches one of these — blank
                keeps every location.
              </p>
              <FieldError messages={state?.fieldErrors?.targetLocationKeywords} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxPostingAgeDays">Max posting age (days)</Label>
              <Input
                id="maxPostingAgeDays"
                name="maxPostingAgeDays"
                type="number"
                min={1}
                placeholder="e.g. 30"
                defaultValue={company?.maxPostingAgeDays ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Skip postings older than this — blank keeps every age.
              </p>
              <FieldError messages={state?.fieldErrors?.maxPostingAgeDays} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={company?.notes ?? ""} />
          </div>

          {state?.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={pending} className="mt-1">
            {pending ? "Saving…" : company ? "Save changes" : "Add company"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
