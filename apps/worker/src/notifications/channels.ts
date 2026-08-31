import { prisma, type NotificationType } from "@ccc/db";
import { logger } from "../logger";

export type NotificationInput = {
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
  entityType?: string;
  entityId?: string;
  /** Stable key for "don't re-notify about the same event" — see schema.prisma comment. */
  dedupeKey?: string;
};

interface NotificationChannel {
  readonly name: string;
  send(input: NotificationInput): Promise<void>;
}

// The only channel today. Email/push/SMS channels can be added to `CHANNELS` below without
// touching any call site — every trigger already goes through `dispatchNotification`.
const inAppChannel: NotificationChannel = {
  name: "in-app",
  async send(input) {
    if (input.dedupeKey) {
      const existing = await prisma.notification.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return;
    }
    try {
      await prisma.notification.create({
        data: {
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
      // Race: two checks resolved the same dedupeKey as "not found" concurrently. The unique
      // constraint on dedupeKey already prevented the duplicate row — nothing else to do.
      const isDuplicateKey =
        error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
      if (!isDuplicateKey) throw error;
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
