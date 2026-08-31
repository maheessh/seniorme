import { prisma, type ApplicationStage } from "@ccc/db";
import { ALL_STAGES, STAGE_LABEL } from "@ccc/shared";

const DAY_MS = 86_400_000;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function computeWeeklyApplications(weeks: number) {
  const since = startOfWeek(new Date(Date.now() - (weeks - 1) * 7 * DAY_MS));
  const applications = await prisma.application.findMany({
    where: { appliedAt: { gte: since } },
    select: { appliedAt: true },
  });

  const buckets = new Map<string, number>();
  const ordered: { key: string; label: string }[] = [];
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(since.getTime() + i * 7 * DAY_MS);
    const key = weekStart.toISOString().slice(0, 10);
    buckets.set(key, 0);
    ordered.push({ key, label: formatWeekLabel(weekStart) });
  }

  for (const application of applications) {
    if (!application.appliedAt) continue;
    const key = startOfWeek(application.appliedAt).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return ordered.map(({ key, label }) => ({ label, value: buckets.get(key) ?? 0 }));
}

async function computeAverageStageDuration() {
  const events = await prisma.applicationEvent.findMany({
    orderBy: [{ applicationId: "asc" }, { occurredAt: "asc" }],
    select: { applicationId: true, toStage: true, occurredAt: true },
  });

  const byApplication = new Map<string, typeof events>();
  for (const event of events) {
    const list = byApplication.get(event.applicationId);
    if (list) list.push(event);
    else byApplication.set(event.applicationId, [event]);
  }

  const durationsByStage = new Map<ApplicationStage, number[]>();
  for (const list of byApplication.values()) {
    for (let i = 0; i < list.length - 1; i++) {
      const days = (list[i + 1].occurredAt.getTime() - list[i].occurredAt.getTime()) / DAY_MS;
      if (days <= 0) continue;
      const stage = list[i].toStage;
      const arr = durationsByStage.get(stage);
      if (arr) arr.push(days);
      else durationsByStage.set(stage, [days]);
    }
  }

  return ALL_STAGES.map((stage) => {
    const durations = durationsByStage.get(stage) ?? [];
    const avgDays = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    return { label: STAGE_LABEL[stage], value: Math.round(avgDays * 10) / 10, sampleSize: durations.length };
  }).filter((row) => row.sampleSize > 0);
}

async function computeTopCompanies(limit: number) {
  const grouped = await prisma.job.groupBy({
    by: ["companyId"],
    _count: { _all: true },
    orderBy: { _count: { companyId: "desc" } },
    take: limit,
  });
  const companies = await prisma.company.findMany({
    where: { id: { in: grouped.map((g) => g.companyId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(companies.map((c) => [c.id, c.name]));
  return grouped.map((g) => ({ label: nameById.get(g.companyId) ?? "Unknown", value: g._count._all }));
}

async function computeStageFunnel() {
  const grouped = await prisma.application.groupBy({ by: ["stage"], _count: { _all: true } });
  const countByStage = new Map(grouped.map((g) => [g.stage, g._count._all]));
  return ALL_STAGES.map((stage) => ({ label: STAGE_LABEL[stage], value: countByStage.get(stage) ?? 0 })).filter(
    (row) => row.value > 0,
  );
}

export async function getAnalyticsData() {
  const interviewOrLaterStages: ApplicationStage[] = ["OA", "RECRUITER_SCREEN", "INTERVIEW", "FINAL_INTERVIEW", "OFFER"];

  const [
    totalJobs,
    totalApplications,
    interviewOrLaterCount,
    offerCount,
    rejectedCount,
    totalGoals,
    completedGoals,
    totalProjects,
    completedProjects,
    weeklyApplications,
    stageFunnel,
    topCompanies,
    stageDurations,
  ] = await Promise.all([
    prisma.job.count(),
    prisma.application.count(),
    prisma.application.count({ where: { stage: { in: interviewOrLaterStages } } }),
    prisma.application.count({ where: { stage: "OFFER" } }),
    prisma.application.count({ where: { stage: "REJECTED" } }),
    prisma.goal.count(),
    prisma.goal.count({ where: { status: "COMPLETED" } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: "COMPLETED" } }),
    computeWeeklyApplications(12),
    computeStageFunnel(),
    computeTopCompanies(8),
    computeAverageStageDuration(),
  ]);

  return {
    kpis: {
      totalJobs,
      totalApplications,
      discoveredToAppliedRate: totalJobs > 0 ? totalApplications / totalJobs : 0,
      appliedToInterviewRate: totalApplications > 0 ? interviewOrLaterCount / totalApplications : 0,
      interviewToOfferRate: interviewOrLaterCount > 0 ? offerCount / interviewOrLaterCount : 0,
      rejectedCount,
    },
    weeklyApplications,
    stageFunnel,
    topCompanies,
    stageDurations,
    goals: { total: totalGoals, completed: completedGoals },
    projects: { total: totalProjects, completed: completedProjects },
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalyticsData>>;
