import { prisma } from "@ccc/db";
import { logger } from "./logger";

const IGNORED_RETENTION_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Ignored jobs are noise the user has already triaged away — keeping them forever just grows
 * storage for no benefit, so they're purged a couple hours after being ignored (not
 * immediately, in case of a misclick). `application: null` is a defensive guard: a job can only
 * reach IGNORED via setInboxStatus, which never creates an Application for it, but this makes
 * the query itself refuse to delete anything that somehow has one rather than relying solely on
 * that invariant holding.
 */
export async function cleanupIgnoredJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - IGNORED_RETENTION_MS);
  const { count } = await prisma.job.deleteMany({
    where: { inboxStatus: "IGNORED", updatedAt: { lt: cutoff }, application: null },
  });
  if (count > 0) {
    logger.info({ count }, "Purged ignored jobs past retention window");
  }
}
