import { prisma } from "@ccc/db";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";

export const metadata: Metadata = { title: "Dashboard" };

async function getDashboardData() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    companyCount,
    jobCount,
    newJobsToday,
    jobsSaved,
    applicationCount,
    interviewCount,
    offerCount,
    rejectedCount,
    upcomingDeadlines,
    recentActivity,
    activeProjects,
    activeGoals,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.job.count(),
    prisma.job.count({ where: { discoveredAt: { gte: startOfToday } } }),
    prisma.job.count({ where: { inboxStatus: "SAVED" } }),
    prisma.application.count(),
    prisma.application.count({
      where: { stage: { in: ["OA", "RECRUITER_SCREEN", "INTERVIEW", "FINAL_INTERVIEW"] } },
    }),
    prisma.application.count({ where: { stage: "OFFER" } }),
    prisma.application.count({ where: { stage: "REJECTED" } }),
    prisma.application.findMany({
      where: { deadline: { gte: startOfToday } },
      orderBy: { deadline: "asc" },
      take: 5,
      include: { company: true, job: true },
    }),
    prisma.activityEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 8 }),
    prisma.project.findMany({
      where: { status: { not: "COMPLETED" } },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 5,
    }),
    prisma.goal.findMany({
      where: { status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 5,
    }),
  ]);

  return {
    companyCount,
    jobCount,
    newJobsToday,
    jobsSaved,
    applicationCount,
    interviewCount,
    offerCount,
    rejectedCount,
    upcomingDeadlines,
    recentActivity,
    activeProjects,
    activeGoals,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  const tiles = [
    { label: "Companies tracked", value: data.companyCount },
    { label: "Jobs discovered", value: data.jobCount },
    { label: "New today", value: data.newJobsToday },
    { label: "Saved", value: data.jobsSaved },
    { label: "Applications submitted", value: data.applicationCount },
    { label: "Interviewing", value: data.interviewCount },
    { label: "Offers", value: data.offerCount },
    { label: "Rejections", value: data.rejectedCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="hero-surface rounded-2xl p-8">
        <p className="text-sm opacity-70">Welcome back</p>
        <h1 className="font-display mt-1 text-3xl">Here&apos;s where things stand.</h1>
        <p className="mt-2 max-w-xl text-sm opacity-70">
          Companies, career-page monitoring, the pipeline, and your senior-year projects and
          goals, all in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardTitle>{tile.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue>{tile.value}</CardValue>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deadlines coming up.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.upcomingDeadlines.map((application) => (
                  <li key={application.id} className="flex justify-between text-sm">
                    <span>
                      {application.company.name} — {application.job.title}
                    </span>
                    <span className="text-muted-foreground">
                      {application.deadline?.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing tracked yet — activity will show up here as companies, jobs, and
                applications are added.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.recentActivity.map((event) => (
                  <li key={event.id} className="text-sm">
                    {event.summary}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project progress</CardTitle>
          </CardHeader>
          <CardContent>
            {data.activeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active projects right now.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.activeProjects.map((project) => (
                  <li key={project.id} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span>{project.name}</span>
                      <span className="text-muted-foreground">{project.progressPercent}%</span>
                    </div>
                    <ProgressBar value={project.progressPercent} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Goal progress</CardTitle>
          </CardHeader>
          <CardContent>
            {data.activeGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active goals right now.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.activeGoals.map((goal) => {
                  const hasTarget = goal.targetValue != null && goal.targetValue > 0;
                  const percent = hasTarget ? Math.min(100, (goal.currentValue / goal.targetValue!) * 100) : 0;
                  return (
                    <li key={goal.id} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span>{goal.title}</span>
                        <span className="text-muted-foreground">
                          {hasTarget ? `${goal.currentValue}/${goal.targetValue}` : ""}
                        </span>
                      </div>
                      {hasTarget ? <ProgressBar value={percent} /> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
