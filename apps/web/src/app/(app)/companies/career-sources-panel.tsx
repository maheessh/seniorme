"use client";

import type { CareerSource } from "@ccc/db";
import { RadioTower } from "lucide-react";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addCareerSourceAction, type CareerSourceFormState } from "./career-sources-actions";
import { CareerSourceRow } from "./career-source-row";

export function CareerSourcesPanel({
  companyId,
  companyName,
  sources,
  trigger,
}: {
  companyId: string;
  companyName: string;
  sources: CareerSource[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const addAction = addCareerSourceAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState<CareerSourceFormState, FormData>(addAction, undefined);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Career pages</DialogTitle>
          <DialogDescription>
            {companyName} — checked automatically every 24h once added. Greenhouse, Lever, and
            Ashby boards are supported; other sites will show a clear error until an adapter
            exists for them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {sources.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
              <RadioTower className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No career pages added yet.</p>
            </div>
          ) : (
            sources.map((source) => <CareerSourceRow key={source.id} source={source} />)
          )}
        </div>

        <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex gap-2">
            <Input
              name="url"
              placeholder="https://boards.greenhouse.io/company"
              className="flex-1"
              required
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add"}
            </Button>
          </div>
          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
