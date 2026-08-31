"use client";

import type { Notification } from "@ccc/db";
import { NOTIFICATION_TYPE_LABEL } from "@ccc/shared";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteNotificationAction, markNotificationReadAction } from "./actions";

const TYPE_ICON: Record<Notification["type"], LucideIcon> = {
  NEW_MATCHING_JOB: Briefcase,
  DEADLINE_APPROACHING: Calendar,
  FOLLOW_UP_DUE: Clock,
  INTERVIEW_APPROACHING: Calendar,
  GOAL_DEADLINE: Target,
  SCRAPER_FAILING: AlertTriangle,
};

export function NotificationRow({ notification }: { notification: Notification }) {
  const [pending, startTransition] = useTransition();

  const content = (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          notification.isRead ? "bg-muted" : "bg-primary/15",
        )}
      >
        {(() => {
          const Icon = TYPE_ICON[notification.type];
          return <Icon className={cn("h-4 w-4", notification.isRead ? "text-muted-foreground" : "text-primary")} />;
        })()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-sm", notification.isRead ? "text-foreground" : "font-medium text-foreground")}>
            {notification.title}
          </p>
          {!notification.isRead ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
        </div>
        {notification.body ? <p className="text-sm text-muted-foreground">{notification.body}</p> : null}
        <div className="mt-1 flex items-center gap-2">
          <Badge>{NOTIFICATION_TYPE_LABEL[notification.type]}</Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border p-3">
      {notification.linkUrl ? (
        <Link
          href={notification.linkUrl}
          className="min-w-0 flex-1"
          onClick={() => {
            if (!notification.isRead) startTransition(() => void markNotificationReadAction(notification.id));
          }}
        >
          {content}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{content}</div>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        {!notification.isRead ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Mark as read"
            disabled={pending}
            onClick={() => startTransition(() => void markNotificationReadAction(notification.id))}
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dismiss notification"
          disabled={pending}
          onClick={() => startTransition(() => void deleteNotificationAction(notification.id))}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
