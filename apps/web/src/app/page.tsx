import {
  ArrowRight,
  BarChart3,
  Inbox,
  Kanban,
  Radar,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// No metadata export here — the root layout's default title ("Senior Me") already applies
// cleanly; setting one here would run through the parent's "%s · Senior Me" template and
// produce "Senior Me · Senior Me".

const FEATURES = [
  {
    icon: Radar,
    title: "Career-page monitoring",
    body: "Point it at any company's careers page — Greenhouse, Lever, Ashby, or a custom board — and it checks for new roles on a schedule so you never miss a posting.",
  },
  {
    icon: Inbox,
    title: "Triage in seconds",
    body: "New roles land in one inbox. Save, apply, or ignore with a keystroke. Duplicate re-posts are flagged automatically so you're not reading the same job twice.",
  },
  {
    icon: Kanban,
    title: "An application pipeline",
    body: "Every application on one board, from saved through offer. Drag between stages, track deadlines and follow-ups, and keep recruiter contacts where they belong.",
  },
  {
    icon: Target,
    title: "Projects & goals",
    body: "Senior year isn't just applications. Track portfolio projects and personal goals with checklists and progress, alongside the job search.",
  },
  {
    icon: BarChart3,
    title: "Analytics that matter",
    body: "Conversion rates, applications per week, time-in-stage — real numbers from your own pipeline, so you can tell what's working and what isn't.",
  },
  {
    icon: Sparkles,
    title: "Yours alone",
    body: "Your companies, your triage, your pipeline — private to your account. Sign in with Google or GitHub; there's nothing else to set up.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Add the companies you want",
    body: "Drop in a careers-page URL. We detect the board type and start watching it.",
  },
  {
    n: "2",
    title: "Triage new roles as they appear",
    body: "Postings show up in your inbox. Keep the ones worth pursuing, skip the rest.",
  },
  {
    n: "3",
    title: "Run your whole search from one board",
    body: "Move applications through stages, hit your goals, and see the numbers add up.",
  },
];

function Logo() {
  return (
    <Link href="/" className="font-display text-xl tracking-tight">
      Senior&nbsp;Me
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-in">Get started</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="landing-hero">
          <div className="mx-auto w-full max-w-6xl px-6 py-24 text-center sm:py-32">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              A calmer way to run your job search
            </span>
            <h1 className="font-display mx-auto mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight sm:text-6xl">
              Your senior-year job search, all in one place.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              Senior Me watches the career pages you care about, files new roles into a fast
              inbox, and tracks every application from saved to offer — so you can spend your
              energy applying, not refreshing tabs.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/sign-in">
                  Get started free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Sign in with Google or GitHub — free, no credit card.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              Everything the search needs, nothing it doesn&apos;t.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Six focused tools that work as one product — not seven disconnected tabs.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex flex-col">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-border bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
                Up and running in three steps.
              </h2>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
              {STEPS.map(({ n, title, body }) => (
                <div key={n} className="rounded-2xl border border-border bg-card p-7">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-sm text-primary-foreground">
                    {n}
                  </div>
                  <h3 className="mt-5 text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="hero-surface flex flex-col items-center rounded-3xl px-8 py-16 text-center">
            <h2 className="font-display max-w-2xl text-3xl leading-tight tracking-tight sm:text-4xl">
              Start running your search like it&apos;s one job, not fifty.
            </h2>
            <p className="mt-4 max-w-lg text-sm opacity-80">
              Add your first company in under a minute. Everything else follows from there.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/sign-in">
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Logo />
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Senior Me. Your personal career command center.
          </p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
