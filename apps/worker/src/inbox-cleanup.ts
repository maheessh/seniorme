import { prisma } from "@ccc/db";
import { logger } from "./logger";

const IGNORED_RETENTION_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Ignored jobs are noise a user has already triaged away — keeping that marker forever just
 * grows storage for no benefit, so it's purged a couple hours after being ignored (not
 * immediately, in case of a misclick). This deletes the per-user UserJobStatus row, never the
 * shared Job itself — the underlying posting stays in the catalog for every other user tracking
 * that company. Losing the marker just means the job re-derives to NEW for this user if it
 * surfaces again, same as it would for anyone who never triaged it.
 *
 * The guard against an existing Application mirrors the single-user version's intent: a job can
 * only reach IGNORED via setInboxStatus, which never creates an Application for it, but this
 * makes the query itself refuse to delete anything that somehow has one for this user rather
 * than relying solely on that invariant holding.
 */
export async function cleanupIgnoredJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - IGNORED_RETENTION_MS);
  const stale = await prisma.userJobStatus.findMany({
    where: { status: "IGNORED", updatedAt: { lt: cutoff } },
    select: { id: true, userId: true, jobId: true },
  });

  if (stale.length === 0) return;

  const applied = await prisma.application.findMany({
    where: { OR: stale.map(({ userId, jobId }) => ({ userId, jobId })) },
    select: { userId: true, jobId: true },
  });
  const appliedKeys = new Set(applied.map(({ userId, jobId }) => `${userId}:${jobId}`));

  const toDelete = stale
    .filter(({ userId, jobId }) => !appliedKeys.has(`${userId}:${jobId}`))
    .map(({ id }) => id);

  if (toDelete.length === 0) return;

  const { count } = await prisma.userJobStatus.deleteMany({ where: { id: { in: toDelete } } });
  if (count > 0) {
    logger.info({ count }, "Purged ignored job statuses past retention window");
  }
}
