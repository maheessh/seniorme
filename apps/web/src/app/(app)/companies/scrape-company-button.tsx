"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { triggerCompanyScrapeAction } from "./career-sources-actions";

export function ScrapeCompanyButton({ companyId, hasSources }: { companyId: string; hasSources: boolean }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Scrape now"
        disabled={pending || !hasSources}
        onClick={() => {
          setFeedback(null);
          startTransition(async () => {
            const result = await triggerCompanyScrapeAction(companyId);
            setFeedback(
              result.error ? { text: result.error, isError: true } : { text: result.message ?? "", isError: false },
            );
            setTimeout(() => setFeedback(null), 4000);
          });
        }}
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      </Button>
      {feedback ? (
        <div
          className={`absolute top-full right-0 z-10 mt-1 w-56 rounded-md border border-border bg-card p-2 text-xs shadow-md ${
            feedback.isError ? "text-destructive" : "text-card-foreground"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}
    </div>
  );
}
