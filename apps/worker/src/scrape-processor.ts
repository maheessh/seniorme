import { Prisma, prisma } from "@ccc/db";
import {
  fetchGenericBoardWithPagination,
  hashContent,
  hashUrl,
  isAllowedByRobots,
  resolveAdapter,
  type RawJobPosting,
} from "@ccc/scraper";
import { logger } from "./logger";
import { dispatchNotification } from "./notifications/channels";

const CONSECUTIVE_FAILURE_NOTIFY_THRESHOLD = 5;

export async function processScrapeSource(
  careerSourceId: string,
  triggeredBy: "scheduler" | "manual",
): Promise<void> {
  const source = await prisma.careerSource.findUnique({
    where: { id: careerSourceId },
    include: { company: true },
  });
  if (!source) {
    logger.warn({ careerSourceId }, "CareerSource no longer exists, skipping");
    return;
  }

  const startedAt = new Date();
  let jobsFound = 0;
  let jobsNew = 0;
  let errorMessage: string | null = null;
  let resolvedType = source.sourceType;

  try {
    const allowed = await isAllowedByRobots(source.url);
    if (!allowed) {
      throw new Error("Fetching this URL is disallowed by the site's robots.txt");
    }

    let postings: RawJobPosting[];

    const adapter = resolveAdapter(source.url);
    if (adapter) {
      resolvedType = adapter.type;
      ({ postings } = await adapter.fetchPostings(source.url));
    } else {
      // No known-ATS adapter matches this URL — fall back to generic tiers: JSON-LD embedded
      // on the listing page, then a conservative HTML-link heuristic, following `rel="next"`
      // pagination across pages so multi-page boards (common — e.g. ~30 postings/page) aren't
      // silently truncated to just the first page.
      const generic = await fetchGenericBoardWithPagination(source.url);
      if (!generic) {
        throw new Error(
          "Couldn't find any job postings on this page. Greenhouse, Lever, and Ashby boards " +
            "are supported directly; other sites need either schema.org JobPosting data or a " +
            "clear list of job links in the page's HTML — this page may render its listings " +
            "with JavaScript, which isn't supported yet.",
        );
      }
      resolvedType = generic.resolvedType;
      postings = generic.postings;
    }

    jobsFound = postings.length;

    const seen = new Set<string>();
    const deduped = postings.filter((posting) =>
      seen.has(posting.externalJobId) ? false : Boolean(seen.add(posting.externalJobId)),
    );

    for (const posting of deduped) {
      jobsNew += await upsertJobPosting(source.id, source.companyId, source.company.name, posting);
    }

    await prisma.job.updateMany({
      where: {
        careerSourceId: source.id,
        isRemoved: false,
        externalJobId: { notIn: deduped.map((posting) => posting.externalJobId) },
      },
      data: { isRemoved: true },
    });

    if (jobsNew > 0) {
      await dispatchNotification({
        type: "NEW_MATCHING_JOB",
        title: `${jobsNew} new job${jobsNew === 1 ? "" : "s"} at ${source.company.name}`,
        body: `Found ${jobsNew} new posting${jobsNew === 1 ? "" : "s"} while checking ${source.url}.`,
        linkUrl: "/inbox",
        entityType: "careerSource",
        entityId: source.id,
        dedupeKey: `new-jobs:${source.id}:${startedAt.toISOString()}`,
      });
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const consecutiveFailures = errorMessage ? source.consecutiveFailures + 1 : 0;

  await prisma.$transaction([
    prisma.careerSource.update({
      where: { id: source.id },
      data: {
        sourceType: resolvedType,
        lastCheckedAt: startedAt,
        lastSuccessAt: errorMessage ? source.lastSuccessAt : startedAt,
        consecutiveFailures,
        lastError: errorMessage,
      },
    }),
    prisma.scrapeRun.create({
      data: {
        careerSourceId: source.id,
        startedAt,
        finishedAt: new Date(),
        status: errorMessage ? "FAILURE" : "SUCCESS",
        jobsFound,
        jobsNew,
        errorMessage,
        triggeredBy,
      },
    }),
  ]);

  if (errorMessage && consecutiveFailures === CONSECUTIVE_FAILURE_NOTIFY_THRESHOLD) {
    await dispatchNotification({
      type: "SCRAPER_FAILING",
      title: `Career-page monitoring failing for ${source.company.name}`,
      body: `${consecutiveFailures} consecutive failed checks. Last error: ${errorMessage}`,
      linkUrl: "/companies",
      entityType: "careerSource",
      entityId: source.id,
      dedupeKey: `scraper-failing:${source.id}:${consecutiveFailures}`,
    });
  }

  if (errorMessage) {
    logger.error({ careerSourceId, error: errorMessage }, "Scrape failed");
  } else {
    logger.info({ careerSourceId, jobsFound, jobsNew }, "Scrape completed");
  }
}

/** Returns 1 if a new Job row was created, 0 if it matched an existing one. */
export async function upsertJobPosting(
  careerSourceId: string,
  companyId: string,
  companyName: string,
  posting: RawJobPosting,
): Promise<number> {
  const canonicalHash = hashUrl(posting.url);
  const contentHash = posting.description ? hashContent(posting.description) : null;

  const existing = await prisma.job.findFirst({
    where: {
      OR: [{ companyId, externalJobId: posting.externalJobId }, { canonicalUrlHash: canonicalHash }],
    },
  });

  if (existing) {
    const descriptionChanged = Boolean(contentHash) && contentHash !== existing.descriptionHash;
    const titleChanged = posting.title !== existing.title;
    const locationChanged = posting.location !== existing.location;
    const postedAtChanged =
      posting.postedAt !== null &&
      (!existing.postedAt || posting.postedAt.getTime() !== existing.postedAt.getTime());
    const urlChanged = posting.url !== existing.url;
    // Keeps the "still listed" check below (externalJobId notIn [this scrape's ids]) from
    // wrongly flagging a job as removed just because an adapter's id scheme changed (e.g. the
    // generic HTML heuristic's hash-of-url ids vs a real ATS's numeric ids) — the job matched
    // via canonicalUrlHash, so it's still there, but its stored id needs to move with it.
    const externalJobIdChanged = posting.externalJobId !== existing.externalJobId;

    const safeFields = {
      isRemoved: false,
      ...(descriptionChanged ? { descriptionRaw: posting.description, descriptionHash: contentHash } : {}),
      ...(titleChanged ? { title: posting.title } : {}),
      ...(locationChanged ? { location: posting.location } : {}),
      ...(postedAtChanged ? { postedAt: posting.postedAt } : {}),
    };
    // externalJobId and canonicalUrlHash are both unique — a changed value can (rarely) collide
    // with a different existing job at update time. Everything else above is safe to always
    // apply, so a collision on either of these should still let the rest of the refresh through
    // rather than losing it — see the P2002 fallback below.
    const uniqueFields = {
      ...(externalJobIdChanged ? { externalJobId: posting.externalJobId } : {}),
      ...(urlChanged ? { url: posting.url, canonicalUrlHash: canonicalHash } : {}),
    };

    if (Object.keys(safeFields).length > 1 || Object.keys(uniqueFields).length > 0 || existing.isRemoved) {
      try {
        await prisma.job.update({ where: { id: existing.id }, data: { ...safeFields, ...uniqueFields } });
      } catch (error) {
        if (Object.keys(uniqueFields).length > 0 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          await prisma.job.update({ where: { id: existing.id }, data: safeFields });
        } else {
          throw error;
        }
      }
      if (descriptionChanged || titleChanged) {
        await prisma.activityEvent.create({
          data: {
            type: "job_updated",
            entityType: "job",
            entityId: existing.id,
            jobId: existing.id,
            summary: `Job details updated: ${posting.title} at ${companyName}`,
          },
        });
      }
    }
    return 0;
  }

  try {
    const created = await prisma.job.create({
      data: {
        companyId,
        careerSourceId,
        title: posting.title,
        location: posting.location,
        workMode: posting.workMode,
        employmentType: posting.employmentType,
        url: posting.url,
        canonicalUrlHash: canonicalHash,
        externalJobId: posting.externalJobId,
        descriptionRaw: posting.description,
        descriptionHash: contentHash,
        postedAt: posting.postedAt,
      },
    });

    await prisma.activityEvent.create({
      data: {
        type: "job_discovered",
        entityType: "job",
        entityId: created.id,
        jobId: created.id,
        summary: `New job discovered: ${created.title} at ${companyName}`,
      },
    });

    await flagPossibleDuplicate(created.id, companyId, posting.title);

    return 1;
  } catch (error) {
    // Rare race: another run inserted the same canonicalUrlHash between our findFirst and
    // create. Treat as "already known" rather than a hard failure.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return 0;
    }
    throw error;
  }
}

const DUPLICATE_TITLE_SIMILARITY_THRESHOLD = 0.55;

/**
 * Fuzzy-dedup tier: the same role can get reposted with a new external ID and URL (the ID/hash
 * tiers won't catch that). Rather than auto-merging — which risks silently hiding a genuinely
 * new opening — this just flags the closest match at the same company for human review in the
 * Inbox (Phase 3).
 */
async function flagPossibleDuplicate(jobId: string, companyId: string, title: string): Promise<void> {
  const [match] = await prisma.$queryRaw<{ id: string; sim: number }[]>`
    SELECT id, similarity(title, ${title}) AS sim
    FROM "Job"
    WHERE "companyId" = ${companyId} AND id != ${jobId} AND "possibleDuplicateOfId" IS NULL
    ORDER BY sim DESC
    LIMIT 1
  `;
  if (match && match.sim >= DUPLICATE_TITLE_SIMILARITY_THRESHOLD) {
    await prisma.job.update({ where: { id: jobId }, data: { possibleDuplicateOfId: match.id } });
  }
}
