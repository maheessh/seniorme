import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { WeeklyBarChart } from "@/components/charts/weekly-bar-chart";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getAnalyticsData } from "@/lib/server/services/analytics";

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();
  const hasAnyApplications = data.kpis.totalApplications > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Whether the job-search strategy is actually working, not just decorative charts.
        </p>
      </div>

      {!hasAnyApplications ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Analytics fill in once there are applications to measure — head to the Inbox or
          Pipeline to get started.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Applications submitted</CardTitle>
              </CardHeader>
              <CardContent>
                <CardValue>{data.kpis.totalApplications}</CardValue>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Discovered → Applied</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <CardValue>{pct(data.kpis.discoveredToAppliedRate)}</CardValue>
                <ProgressBar value={data.kpis.discoveredToAppliedRate * 100} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Applied → Interview</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <CardValue>{pct(data.kpis.appliedToInterviewRate)}</CardValue>
                <ProgressBar value={data.kpis.appliedToInterviewRate * 100} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Interview → Offer</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <CardValue>{pct(data.kpis.interviewToOfferRate)}</CardValue>
                <ProgressBar value={data.kpis.interviewToOfferRate * 100} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Applications per week (last 12 weeks)</CardTitle>
              </CardHeader>
              <CardContent>
                <WeeklyBarChart data={data.weeklyApplications} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pipeline by stage</CardTitle>
              </CardHeader>
              <CardContent>
                <HorizontalBarChart data={data.stageFunnel} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Most active companies</CardTitle>
              </CardHeader>
              <CardContent>
                <HorizontalBarChart data={data.topCompanies} color="var(--success)" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average time per stage</CardTitle>
              </CardHeader>
              <CardContent>
                {data.stageDurations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Not enough stage history yet — this fills in as applications move through the
                    pipeline over time.
                  </p>
                ) : (
                  <HorizontalBarChart data={data.stageDurations} color="var(--warning)" unit="d" />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Goal completion</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <CardValue>
                  {data.goals.completed}/{data.goals.total}
                </CardValue>
                <ProgressBar value={data.goals.total > 0 ? (data.goals.completed / data.goals.total) * 100 : 0} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Project completion</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <CardValue>
                  {data.projects.completed}/{data.projects.total}
                </CardValue>
                <ProgressBar
                  value={data.projects.total > 0 ? (data.projects.completed / data.projects.total) * 100 : 0}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
