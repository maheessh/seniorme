# Senior Me

A personal career, project, and job-application command center. See [ARCHITECTURE.md](ARCHITECTURE.md)
for the full system design, database schema, and phased implementation roadmap this project
follows, and [DEPLOYMENT.md](DEPLOYMENT.md) for the optional cloud deployment path.

**Status:** Phases 0–8 complete. Database, base app shell, the web/worker process
split, the company tracker (with a one-click "scrape now" that refreshes every active career
page for a company directly from its card/row), career-page monitoring (Greenhouse/Lever/Ashby
adapters plus generic JSON-LD/HTML-heuristic fallback tiers for custom sites, BullMQ scheduler
+ worker, manual refresh, SSRF/robots.txt-safe fetching including `Crawl-delay`), the job
discovery inbox (keyboard-driven triage, fuzzy-duplicate flagging, activity logging), the
application pipeline (drag-and-drop Kanban + table views, stage history, contacts, deadlines,
notes), job-link import (tiered extraction with company dedup and a manual-entry fallback),
projects/goals (task/milestone checklists, quick-increment progress, dashboard widgets),
analytics (funnel conversion rates, applications-per-week trend, pipeline-by-stage and
most-active-companies breakdowns, average time per stage, goal/project completion — all
computed from real Prisma aggregations, no dummy data), and notifications (in-app notification
center with an unread badge in the sidebar; triggers for new matching jobs, approaching
application deadlines, due follow-ups, upcoming interviews, goal deadlines, and repeated
scraper failures, all dedup-aware so the same event never re-notifies) are all working
end-to-end. **Phases 9 and 10 are also complete** — see [DEPLOYMENT.md](DEPLOYMENT.md) for the
optional cloud path, including six real bugs in the (previously never-built) Docker images that
were found and fixed by actually building and running them end-to-end rather than just writing
the deployment steps against untested Dockerfiles. Phase 9 added a
global command palette (`⌘K`/`Ctrl+K`, search-to-jump across every page), keyboard-operable
Kanban drag-and-drop, a WCAG-AA color contrast pass, a virtualized Inbox list (career-page
pagination means the New tab routinely holds 100+ jobs — only the rows near the viewport are
ever mounted), a per-page browser tab title on every route, a skip-to-content link, and a
117-test unit/integration suite plus a 9-scenario Playwright E2E suite covering the flows in
`ARCHITECTURE.md` §12 (see "Running tests"). All ten phases from `ARCHITECTURE.md` §14 are done.

This app has no login and no `User` model — it's a single-person, local-only tool, and there
was never anyone else it needed to authenticate against. The root `/` route is a simple landing
page that links straight into `/dashboard`; every other route lives under `(app)` with the full
sidebar/topbar chrome and no gate in front of it.

## Stack

- **Web**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Database**: PostgreSQL via Prisma (driver adapter: `@prisma/adapter-pg`)
- **Worker**: standalone Node process running a BullMQ scheduler + queue consumer — kept
  separate from the web process from day one so career-page monitoring never depends on a
  serverless-friendly request lifecycle
- **Queue**: Redis via BullMQ (scheduler tick every 5 min; each CareerSource is re-checked
  once its own `checkFrequencyMin` — 24h by default — has elapsed)
- **Scraping**: `packages/scraper` — adapter registry (Greenhouse, Lever, Ashby, iCIMS today,
  plus generic JSON-LD/HTML-heuristic fallback tiers with `rel="next"` pagination for custom
  sites, and a headless-Chromium tier as the last resort for JS-rendered pages), an SSRF-safe
  fetch wrapper (blocks private/loopback/link-local targets, even through redirects — enforced
  per-request inside the headless tier too, since a real browser fetches whatever the page tells
  it to), robots.txt compliance, and per-host rate limiting
- **Monorepo**: pnpm workspaces (`apps/web`, `apps/worker`, `packages/db`, `packages/shared`,
  `packages/scraper`)

## Prerequisites

- Node.js 20+ (developed against Node 26)
- pnpm
- Docker Desktop (for local Postgres + Redis)

## Local setup

```bash
# 1. Install dependencies
pnpm install

# 2. Install the Chromium binary for the scraper's headless-browser fallback tier (one-time)
pnpm --filter @ccc/scraper exec playwright install chromium

# 3. Copy the env template and fill in real values
cp .env.example .env

# 4. Start Postgres + Redis
pnpm docker:up

# 5. Generate the Prisma client and run the first migration
pnpm db:generate
pnpm db:migrate

# 6. Run the app (each in its own terminal)
pnpm dev:web      # http://localhost:3000
pnpm dev:worker   # runs the scheduler + scrape queue consumer
```

Open `http://localhost:3000` and hit Enter on the landing page to reach the dashboard — there's
no login. From the Companies page, add a company with a career page URL, then use the refresh
icon directly on its card/row ("scrape now") to trigger an immediate scrape of every active
source it has — or open "Manage career pages" to refresh a single source, or just wait, since
the scheduler checks every 5 minutes for any source whose 24h interval has elapsed. Manual
triggers are throttled to once per 5 minutes per source.

## Environment variables

All defined once in the root `.env` (not per-app — see `apps/web/next.config.ts` and each
package's scripts, which load it explicitly). See `.env.example` for the full list.

## Running tests

`packages/scraper`'s suite is pure unit tests — `pnpm test` runs it with no setup. `apps/worker`
also has integration tests that hit a real Postgres database (`upsertJobPosting`'s dedup/update
behavior, the ignored-job cleanup, and notification-check dedup all need real unique-constraint
and query behavior to mean anything) — they run against a dedicated `ccc_test` database, never
your real `ccc` one. One-time setup:

```bash
docker compose exec postgres psql -U ccc -d ccc -c "CREATE DATABASE ccc_test OWNER ccc;"
DATABASE_URL="postgresql://ccc:ccc@localhost:5432/ccc_test?schema=public" pnpm --filter @ccc/db exec prisma migrate deploy
```

Then `pnpm test` (or `pnpm --filter @ccc/worker test`) runs everything — `apps/worker/src/test-setup.ts`
points the tests at `ccc_test` regardless of what's in `.env`, and each test file truncates its
tables between tests via `apps/worker/src/test-helpers.ts`.

### E2E tests (Playwright)

`apps/web/e2e` covers the flows in `ARCHITECTURE.md` §12: the landing page → add a company →
add a career source → trigger a scrape, a discovered job moving from Inbox through triage into
the Pipeline, dragging a card across Kanban columns (verified to actually persist server-side,
not just in optimistic client state), creating a project/goal and updating progress, and
job-link import's manual-fallback path. Uses the same `ccc_test` database as the worker's
integration tests (set that up first, per above) — a `global-setup.ts` script reseeds it with
fixture data before any spec runs (there's no login to establish, so that's all setup needs to
do). Runs the real app via `next dev` on a dedicated port (3100) so it doesn't collide with a
`pnpm dev:web` you already have running —
Next.js's dev server refuses to start a second instance for the same project directory, so if
you hit "Another next dev server is already running," that's `pnpm dev:web`, not a real
conflict; stop it first (E2E doesn't need it, and the two use different databases anyway).

Deliberately doesn't depend on live external sites: postings are seeded directly into the test
database (this app's own UI/data-flow is what's being tested, not scraper reliability against a
real career page — that's `packages/scraper`'s job), and the job-import fallback test points at
`127.0.0.1`, which the SSRF guard blocks before any real request goes out, making that failure
path deterministic instead of depending on some external site actually being unreachable.

```bash
pnpm --filter @ccc/web test:e2e
```

## Monorepo layout

```
apps/
  web/       Next.js app — UI, dashboard, companies, career-page management
  worker/    BullMQ scheduler + queue consumer for career-page monitoring
packages/
  db/        Prisma schema, migrations, shared PrismaClient instance
  shared/    Zod schemas, types, and queue constants shared between web and worker
  scraper/   ATS adapters (Greenhouse/Lever/Ashby), SSRF-safe fetch, robots.txt checks
```

## Common commands

| Command | What it does |
|---|---|
| `pnpm dev:web` / `pnpm dev:worker` | Run each process locally with hot reload |
| `pnpm db:migrate` | Create/apply a Prisma migration (`prisma migrate dev`) |
| `pnpm db:studio` | Open Prisma Studio against the local database |
| `pnpm build` | Production build of db client, web, and worker |
| `pnpm lint` | Lint all workspaces |
| `pnpm test` | Run all test suites (`packages/scraper` unit tests, `apps/worker` integration tests — see "Running tests") |
| `docker compose --profile full up` | Run the full 4-service topology (web+worker+postgres+redis) in containers, matching the eventual deployment shape |

## Known limitations

- All ten phases from `ARCHITECTURE.md` §14 are complete. Test coverage: `packages/scraper` has an
  86-test Vitest unit suite (URL/content normalization, ATS-type detection, both JSON-LD
  extraction paths, the generic HTML-link heuristic's guard rails, `rel="next"` pagination, the
  iCIMS adapter, and the SSRF guard's IP-blocking — writing that last suite caught two real bugs,
  both fixed: IPv6-literal blocking was silently unreachable due to how `URL.hostname` brackets
  IPv6 addresses, and an IPv4-mapped IPv6 address in its URL-normalized hex form slipped past the
  private-IP check). `apps/worker` has a 31-test integration suite against a real Postgres test
  database (the dedup/upsert edge cases from `ARCHITECTURE.md` §12, the ignored-job auto-purge,
  notification dedup). `apps/web` has a 9-scenario Playwright E2E suite covering §12's listed
  flows end-to-end against the real running app. A command palette (`⌘K`/`Ctrl+K` from anywhere,
  type to filter, arrow keys + Enter or click to jump) is mounted globally. The Kanban board's
  drag-and-drop is keyboard-operable (dnd-kit's `KeyboardSensor`: Tab to a card, Space to pick
  up, arrows to move between columns, Space to drop, Escape to cancel), with screen-reader
  announcements naming the actual job/stage rather than raw IDs. The Inbox list is virtualized
  (`@tanstack/react-virtual`) — with career-page pagination now pulling in a full board per
  company, the New tab routinely holds 100+ jobs, and only the rows near the viewport are
  mounted regardless of list length. Every route has its own browser-tab title, and there's a
  skip-to-content link for keyboard users. An accessibility pass over the light-mode color
  tokens found `--destructive`/`--success`/`--warning` all fell short of WCAG AA's 4.5:1 contrast
  for normal text in at least one real usage (as low as 2.4:1 for warning text inside its own
  badge) — all three darkened to clear 4.5:1 in both plain-text and badge-tinted contexts; dark
  mode already passed. This was a targeted pass on the issues found, not an exhaustive WCAG audit
  (e.g. no screen-reader testing pass, no `prefers-reduced-motion` review) — a candidate for
  further work post-Phase-10 if it matters more than shipping.
- "Scrape now" always re-fetches a source's full listing — none of the supported ATS/HTML
  sources expose a "changes since" endpoint, so there's no partial/incremental fetch mode to
  configure. What it does skip is redundant *work*: postings that already exist (by canonical
  URL or external ID) are matched and left alone rather than re-created, and now also have their
  title/location/posted-date refreshed if they changed (not just the description) — see
  `upsertJobPosting` in `apps/worker/src/scrape-processor.ts`.
- The Inbox has three actions — Save, Apply, Ignore — not five: "Interested" folded into Saved
  and "Not interested" folded into Ignored, since both pairs meant the same thing in practice.
  Pipeline's `INTERESTED` stage was renamed to `SAVED` to match, and the `DISCOVERED` stage was
  removed entirely (an Application is only ever created once you hit Apply, so it never actually
  reached that stage). Ignored jobs are purged automatically ~2 hours after being ignored to
  keep the table from growing unbounded — see `apps/worker/src/inbox-cleanup.ts`. One
  consequence: if an ignored-and-purged job gets re-scraped later (e.g. it's still live on the
  career page), it reappears as a new discovery rather than staying suppressed.
- Generic (non-ATS) career pages that paginate are now followed via `rel="next"` up to 25 pages
  — verified against a live 12-page board (90 postings collected across 3 real pages before a
  transient bot-throttle from repeated manual testing interrupted the run; the mechanism itself
  is confirmed correct, not synthetic). A later page failing outright no longer discards
  postings already found on earlier pages.
- Job-link import's Claude-assisted extraction tier only runs when `ANTHROPIC_API_KEY` is set
  in `.env` — without it, extraction still works via the ATS-API/JSON-LD/OpenGraph tiers, just
  with a weaker fallback for sites that use none of those (verified end-to-end against a
  robots.txt-blocked LinkedIn URL, which correctly degrades to manual entry).
- Pipeline "interview dates" live on the relevant `ApplicationEvent` (via its optional
  `scheduledAt`) rather than a single field on `Application` — a role can have several
  scheduled rounds (OA, screen, interview, final) over its lifetime, so the date belongs to
  the specific stage transition it's attached to, not the application as a whole.
- Career-page monitoring supports Greenhouse, Lever, iCIMS, and Ashby directly, plus generic
  JSON-LD/HTML-heuristic fallback tiers for custom sites (verified against a real production
  site — 30/30 postings extracted correctly, zero false positives). Pages that render their job
  listings entirely client-side, with no server-rendered content and no public API, fall back to
  a headless-Chromium tier (verified against a real Paycom ATS board) — the one thing it doesn't
  do is drive JS-only pagination (clicking a "next page" control), so it only ever discovers/
  refreshes postings visible on the initial render and never marks existing ones as removed for
  that source (see `packages/scraper/src/adapters/headless.ts`). The same tier also covers a
  static fetch getting blocked outright (a plain `fetch` hitting a 403/bot-check that a real
  browser sails through, verified against a live Cloudflare-fronted careers page) — one fallback
  tier for both failure modes, rather than new per-site code each time a new platform blocks the
  plain fetch. Needs a real Chromium binary at runtime — run `npx playwright install chromium`
  once (`pnpm --filter @ccc/scraper exec playwright install chromium` from the repo root) before
  `pnpm dev:worker` will hit this tier successfully; the worker's Docker image already bundles it.
- Company logos are derived automatically from the domain (via DuckDuckGo's icon service) at
  create/update time — there's no manual upload path, by design.
- Fuzzy-duplicate detection (pg_trgm title similarity) flags a possible repost for review in
  the Inbox but never auto-merges — dismissing the flag just clears it, it doesn't teach the
  matcher anything.
- Automated coverage is unit-level only so far (`packages/scraper`, see above) — the full test
  strategy across all five layers is defined in `ARCHITECTURE.md` §12. The web/worker
  service-layer logic (dedup upserts, stage transitions, notification dedup) and the fuzzy-match
  tier have been manually verified end-to-end against live boards during development (see commit
  history) but aren't covered by CI-run tests yet.
