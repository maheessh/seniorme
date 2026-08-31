"use client";

import type { ApplicationStage } from "@ccc/db";
import { ALL_STAGES, STAGE_LABEL } from "@ccc/shared";
import { format, formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addNoteAction,
  createContactAction,
  getApplicationDetailAction,
  moveStageAction,
  updateDetailsAction,
  type ActionState,
} from "./actions";
import { StageBadge } from "./stage-badge";

type DetailData = NonNullable<Awaited<ReturnType<typeof getApplicationDetailAction>>>;

function toInputDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "yyyy-MM-dd");
}

export function ApplicationDetailDialog({
  applicationId,
  onClose,
}: {
  applicationId: string | null;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<{ id: string; detail: DetailData } | null>(null);

  const refetch = useCallback((id: string) => {
    void getApplicationDetailAction(id).then((result) => {
      if (result) setLoaded({ id, detail: result });
    });
  }, []);

  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;
    getApplicationDetailAction(applicationId).then((result) => {
      if (!cancelled && result) setLoaded({ id: applicationId, detail: result });
    });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  // Derived at render time rather than a separate synced "loading" state — avoids showing
  // stale data from a previously opened application while the fresh fetch is in flight.
  const data = loaded && loaded.id === applicationId ? loaded.detail : null;

  return (
    <Dialog open={Boolean(applicationId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        {!data ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <ApplicationDetail
            data={data}
            onStageChanged={(stage) =>
              setLoaded((prev) =>
                prev && { ...prev, detail: { ...prev.detail, application: { ...prev.detail.application, stage } } },
              )
            }
            onRefetch={() => refetch(data.application.id)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ApplicationDetail({
  data,
  onStageChanged,
  onRefetch,
}: {
  data: DetailData;
  onStageChanged: (stage: ApplicationStage) => void;
  onRefetch: () => void;
}) {
  const router = useRouter();
  const { application, contacts } = data;
  const { job, company } = application;

  return (
    <div className="flex max-h-[75vh] flex-col gap-5 overflow-y-auto pr-1">
      <DialogHeader>
        <div className="flex items-start gap-3">
          <CompanyLogo logoUrl={company.logoUrl} name={company.name} size={40} />
          <div className="min-w-0 flex-1">
            <DialogTitle>{job.title}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {company.name}
              {job.location ? ` · ${job.location}` : ""}
            </p>
          </div>
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View posting <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-3">
        <StageBadge stage={application.stage} />
        <Select
          value={application.stage}
          onChange={(event) => {
            const stage = event.target.value as ApplicationStage;
            onStageChanged(stage);
            // The Kanban board / table hold their own local copy of application state for
            // drag-and-drop optimism, so a change made here (not via drag) needs a refresh to
            // reach them once this dialog closes.
            void moveStageAction(application.id, stage).then(() => router.refresh());
          }}
          className="w-48"
        >
          {ALL_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABEL[stage]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DetailsForm
          application={application}
          contacts={contacts}
          companyId={company.id}
          onRefetch={onRefetch}
        />
        <HistoryPanel application={application} onRefetch={onRefetch} />
      </div>
    </div>
  );
}

function DetailsForm({
  application,
  contacts,
  companyId,
  onRefetch,
}: {
  application: DetailData["application"];
  contacts: DetailData["contacts"];
  companyId: string;
  onRefetch: () => void;
}) {
  const boundAction = updateDetailsAction.bind(null, application.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, undefined);
  const [addingContact, setAddingContact] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deadline">Deadline</Label>
            <Input id="deadline" name="deadline" type="date" defaultValue={toInputDate(application.deadline)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="followUpDate">Follow up</Label>
            <Input
              id="followUpDate"
              name="followUpDate"
              type="date"
              defaultValue={toInputDate(application.followUpDate)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resumeVersion">Resume version</Label>
          <Input id="resumeVersion" name="resumeVersion" defaultValue={application.resumeVersion ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recruiterContactId">Contact</Label>
          {addingContact ? (
            <NewContactForm
              companyId={companyId}
              onDone={() => {
                setAddingContact(false);
                onRefetch();
              }}
            />
          ) : (
            <div className="flex gap-2">
              <Select
                id="recruiterContactId"
                name="recruiterContactId"
                defaultValue={application.recruiterContactId ?? ""}
                className="flex-1"
              >
                <option value="">No contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                    {contact.role ? ` — ${contact.role}` : ""}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddingContact(true)}>
                New
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coverLetter">Cover letter</Label>
          <Textarea id="coverLetter" name="coverLetter" defaultValue={application.coverLetter ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" defaultValue={application.notes ?? ""} />
        </div>

        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save details"}
        </Button>
      </form>
    </div>
  );
}

function NewContactForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const boundAction = createContactAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <Input name="name" placeholder="Name" required autoFocus />
      <Input name="role" placeholder="Role (optional)" />
      <Input name="email" placeholder="Email (optional)" />
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add contact"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function HistoryPanel({
  application,
  onRefetch,
}: {
  application: DetailData["application"];
  onRefetch: () => void;
}) {
  const boundAction = addNoteAction.bind(null, application.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onRefetch();
    }
  }, [state, onRefetch]);

  return (
    <div className="flex flex-col gap-3">
      <Label>History</Label>
      <div className="flex max-h-52 flex-col gap-2 overflow-y-auto rounded-lg border border-border p-3">
        {application.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          application.events.map((event) => (
            <div key={event.id} className="text-sm">
              <p>
                {event.fromStage && event.fromStage !== event.toStage
                  ? `${STAGE_LABEL[event.fromStage]} → ${STAGE_LABEL[event.toStage]}`
                  : event.note
                    ? "Note"
                    : `Entered ${STAGE_LABEL[event.toStage]}`}
              </p>
              {event.note ? <p className="text-muted-foreground">{event.note}</p> : null}
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(event.occurredAt, { addSuffix: true })}
                {event.scheduledAt ? ` · scheduled ${format(event.scheduledAt, "MMM d, yyyy")}` : ""}
              </p>
            </div>
          ))
        )}
      </div>

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <Textarea name="note" placeholder="Log an update…" required />
        <div className="flex items-center gap-2">
          <Input name="scheduledAt" type="date" className="w-40" title="Scheduled date (optional)" />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Adding…" : "Add note"}
          </Button>
        </div>
        {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
