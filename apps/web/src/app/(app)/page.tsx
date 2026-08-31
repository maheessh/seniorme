import { prisma } from "@ccc/db";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";

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
          Companies, career-page monitoring, and the application pipeline will populate this
          dashboard as they come online over the next phases.
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
              <p className="text-sm text-muted-foreground">
                No deadlines yet — these will appear once applications are tracked (Phase 4).
              </p>
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
    </div>
  );
}
