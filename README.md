# Career Command Center

A personal career, project, and job-application command center. See [ARCHITECTURE.md](ARCHITECTURE.md)
for the full system design, database schema, and phased implementation roadmap this project follows.

**Status:** Phases 0–8 complete. Auth, database, base app shell, the web/worker process
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
end-to-end. Phase 9 (hardening) is in progress — a global command palette (`⌘K`/`Ctrl+K`,
search-to-jump across every page), keyboard-operable Kanban drag-and-drop, a WCAG-AA color
contrast pass, and a growing test suite (117 tests: unit tests for the scraper package,
integration tests against a real database for the worker's dedup/notification/cleanup logic —
see "Running tests"). See `ARCHITECTURE.md` §14 for the full roadmap (an accessibility audit
beyond the fixes already made, E2E tests, and deployment docs remain).

## Stack

- **Web**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Database**: PostgreSQL via Prisma (driver adapter: `@prisma/adapter-pg`)
- **Auth**: Auth.js v5, single-user credentials login (JWT sessions)
- **Worker**: standalone Node process running a BullMQ scheduler + queue consumer — kept
  separate from the web process from day one so career-page monitoring never depends on a
  serverless-friendly request lifecycle
- **Queue**: Redis via BullMQ (scheduler tick every 5 min; each CareerSource is re-checked
  once its own `checkFrequencyMin` — 24h by default — has elapsed)
- **Scraping**: `packages/scraper` — adapter registry (Greenhouse, Lever, Ashby, iCIMS today,
  plus generic JSON-LD/HTML-heuristic fallback tiers with `rel="next"` pagination for custom
  sites), an SSRF-safe fetch wrapper (blocks private/loopback/link-local targets, even through
  redirects), robots.txt compliance, and per-host rate limiting
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

# 2. Copy the env template and fill in real values
cp .env.example .env
# Generate NEXTAUTH_SECRET with: openssl rand -base64 32
# Set APP_USER_EMAIL / APP_USER_PASSWORD to the one account this app will ever have

# 3. Start Postgres + Redis
pnpm docker:up

# 4. Generate the Prisma client, run the first migration, and seed your user
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Run the app (each in its own terminal)
pnpm dev:web      # http://localhost:3000
pnpm dev:worker   # runs the scheduler + scrape queue consumer
```

Sign in with the `APP_USER_EMAIL` / `APP_USER_PASSWORD` you set in `.env`. From the Companies
page, add a company with a career page URL, then use the refresh icon directly on its
card/row ("scrape now") to trigger an immediate scrape of every active source it has — or
open "Manage career pages" to refresh a single source, or just wait, since the scheduler
checks every 5 minutes for any source whose 24h interval has elapsed. Manual triggers are
throttled to once per 5 minutes per source.

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

## Monorepo layout

```
apps/
  web/       Next.js app — UI, auth, dashboard, companies, career-page management
  worker/    BullMQ scheduler + queue consumer for career-page monitoring
packages/
  db/        Prisma schema, migrations, seed script, shared PrismaClient instance
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

- Companies (Phase 1) through notifications (Phase 8) all have full functionality. Phase 9
  (hardening) is in progress. `packages/scraper` has an 86-test Vitest unit suite covering
  URL/content normalization, ATS-type detection, both JSON-LD extraction paths, the generic
  HTML-link heuristic (including its "not enough real matches" and "self-referential/off-host
  link" guard rails), `rel="next"` pagination, the iCIMS adapter's parsing, and the SSRF guard's
  IP-blocking logic — writing that last suite caught two real bugs (IPv6-literal blocking was
  silently unreachable due to how `URL.hostname` brackets IPv6 addresses, and an IPv4-mapped IPv6
  address in its URL-normalized hex form slipped past the private-IP check), both fixed and now
  regression-tested. `apps/worker` has a 31-test integration suite against a real Postgres test
  database covering the dedup/upsert edge cases from `ARCHITECTURE.md` §12 (duplicate postings
  across runs, a changed URL with the same external ID, a removed-then-relisted job, missing
  metadata, fuzzy-duplicate flagging), the ignored-job auto-purge, and notification dedup
  (including "scheduler tick fires twice" not double-notifying). A command palette
  (`apps/web/src/components/command-palette.tsx`) is mounted globally — `⌘K`/`Ctrl+K` from
  anywhere, type to filter, arrow keys + Enter or click to jump to a page. The Kanban board's
  drag-and-drop is now keyboard-operable (dnd-kit's `KeyboardSensor`: Tab to a card, Space to
  pick up, arrows to move between columns, Space to drop, Escape to cancel), with screen-reader
  announcements naming the actual job/stage rather than raw IDs. An accessibility pass over the
  light-mode color tokens found `--destructive`/`--success`/`--warning` all fell short of WCAG
  AA's 4.5:1 contrast for normal text in at least one real usage (as low as 2.4:1 for warning
  text inside its own badge) — all three darkened to clear 4.5:1 in both plain-text and
  badge-tinted contexts; dark mode already passed. This wasn't an exhaustive accessibility audit
  (E2E tests and a broader a11y pass remain); deployment docs (Phase 10) also remain.
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
- Career-page monitoring supports Greenhouse, Lever, and Ashby directly, plus generic
  JSON-LD/HTML-heuristic fallback tiers for custom sites (verified against a real production
  site — 30/30 postings extracted correctly, zero false positives). Pages that render their
  job listings entirely client-side with no server-rendered content at all (no headless-browser
  tier yet) are the one remaining gap, and fail with a clear, specific message rather than a
  generic error.
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
