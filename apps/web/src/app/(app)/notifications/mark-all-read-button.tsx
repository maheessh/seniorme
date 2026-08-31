"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "./actions";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      onClick={() => startTransition(() => void markAllNotificationsReadAction())}
    >
      {pending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
