import { prisma, type NotificationType } from "@ccc/db";
import { logger } from "../logger";

type NotificationBase = {
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
  entityType?: string;
  entityId?: string;
  /** Stable key for "don't re-notify about the same event" — see schema.prisma comment. */
  dedupeKey?: string;
};

// A notification either has one clear owner already (an application/goal deadline check
// knows exactly whose it is) or is triggered by something company-scoped (a new posting, a
// failing scraper) — those fan out to every user currently tracking that company, each
// deduped independently.
export type NotificationInput = NotificationBase & ({ userId: string } | { companyId: string });

interface NotificationChannel {
  readonly name: string;
  send(input: NotificationInput): Promise<void>;
}

async function resolveTargetUserIds(input: NotificationInput): Promise<string[]> {
  if ("userId" in input) return [input.userId];
  const trackers = await prisma.userCompany.findMany({
    where: { companyId: input.companyId, monitoringEnabled: true },
    select: { userId: true },
  });
  return trackers.map((tracker) => tracker.userId);
}

// The only channel today. Email/push/SMS channels can be added to `CHANNELS` below without
// touching any call site — every trigger already goes through `dispatchNotification`.
const inAppChannel: NotificationChannel = {
  name: "in-app",
  async send(input) {
    const userIds = await resolveTargetUserIds(input);

    for (const userId of userIds) {
      if (input.dedupeKey) {
        const existing = await prisma.notification.findUnique({
          where: { userId_dedupeKey: { userId, dedupeKey: input.dedupeKey } },
        });
        if (existing) continue;
      }
      try {
        await prisma.notification.create({
          data: {
            userId,
            type: input.type,
            title: input.title,
            body: input.body,
            linkUrl: input.linkUrl,
            entityType: input.entityType,
            entityId: input.entityId,
            dedupeKey: input.dedupeKey,
          },
        });
      } catch (error) {
        // Race: two checks resolved the same dedupeKey as "not found" concurrently. The
        // unique constraint on (userId, dedupeKey) already prevented the duplicate row.
        const isDuplicateKey =
          error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
        if (!isDuplicateKey) throw error;
      }
    }
  },
};

const CHANNELS: NotificationChannel[] = [inAppChannel];

export async function dispatchNotification(input: NotificationInput): Promise<void> {
  await Promise.all(
    CHANNELS.map((channel) =>
      channel.send(input).catch((error) => {
        logger.error({ channel: channel.name, error, input }, "Notification channel failed");
      }),
    ),
  );
}
