# Career Command Center

A personal career, project, and job-application command center. See [ARCHITECTURE.md](ARCHITECTURE.md)
for the full system design, database schema, and phased implementation roadmap this project follows.

**Status:** Phases 0–5 complete. Auth, database, base app shell, the web/worker process
split, the company tracker, career-page monitoring (Greenhouse/Lever/Ashby adapters, BullMQ
scheduler + worker, manual refresh, SSRF/robots.txt-safe fetching), the job discovery inbox
(keyboard-driven triage, fuzzy-duplicate flagging, activity logging), the application pipeline
(drag-and-drop Kanban + table views, stage history, contacts, deadlines, notes), and job-link
import (tiered extraction — ATS API reuse, JSON-LD, Claude-assisted, OpenGraph — with company
dedup and a manual-entry fallback) are all working end-to-end. Career-page monitoring also
covers custom (non-ATS) career sites via generic JSON-LD/HTML-heuristic fallback tiers, and
now honors a site's `Crawl-delay` from robots.txt. Remaining feature phases (projects/goals,
analytics, notifications) build on top of this incrementally — see `ARCHITECTURE.md` §14 for
the roadmap.

## Stack

- **Web**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Database**: PostgreSQL via Prisma (driver adapter: `@prisma/adapter-pg`)
- **Auth**: Auth.js v5, single-user credentials login (JWT sessions)
- **Worker**: standalone Node process running a BullMQ scheduler + queue consumer — kept
  separate from the web process from day one so career-page monitoring never depends on a
  serverless-friendly request lifecycle
- **Queue**: Redis via BullMQ (scheduler tick every 5 min; each CareerSource is re-checked
  once its own `checkFrequencyMin` — 24h by default — has elapsed)
- **Scraping**: `packages/scraper` — adapter registry (Greenhouse, Lever, Ashby today), an
  SSRF-safe fetch wrapper (blocks private/loopback/link-local targets, even through
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
page, add a company with a Greenhouse/Lever/Ashby career page URL and use "Refresh now" to
trigger an immediate scrape, or just wait — the scheduler checks every 5 minutes for any
source whose 24h interval has elapsed.

## Environment variables

All defined once in the root `.env` (not per-app — see `apps/web/next.config.ts` and each
package's scripts, which load it explicitly). See `.env.example` for the full list.

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
| `docker compose --profile full up` | Run the full 4-service topology (web+worker+postgres+redis) in containers, matching the eventual deployment shape |

## Known limitations

- Companies (Phase 1), career-page monitoring (Phase 2), the discovery inbox (Phase 3), the
  application pipeline (Phase 4), and job-link import (Phase 5) all have full functionality;
  projects and goals do not yet — those pages are intentionally simple placeholders that name
  the phase they arrive in.
- Job-link import's Claude-assisted extraction tier only runs when `ANTHROPIC_API_KEY` is set
  in `.env` — without it, extraction still works via the ATS-API/JSON-LD/OpenGraph tiers, just
  with a weaker fallback for sites that use none of those (verified end-to-end against a
  robots.txt-blocked LinkedIn URL, which correctly degrades to manual entry).
- Pipeline "interview dates" live on the relevant `ApplicationEvent` (via its optional
  `scheduledAt`) rather than a single field on `Application` — a role can have several
  scheduled rounds (OA, screen, interview, final) over its lifetime, so the date belongs to
  the specific stage transition it's attached to, not the application as a whole.
- Only Greenhouse, Lever, and Ashby career sites are supported so far. Other URLs are saved
  and clearly flagged as "no adapter available yet" rather than silently failing or faking data.
- Company logos are derived automatically from the domain (via DuckDuckGo's icon service) at
  create/update time — there's no manual upload path, by design.
- Fuzzy-duplicate detection (pg_trgm title similarity) flags a possible repost for review in
  the Inbox but never auto-merges — dismissing the flag just clears it, it doesn't teach the
  matcher anything.
- No automated test suite yet — the test strategy is defined in `ARCHITECTURE.md` §12; the
  scraper/dedup/failure-path/fuzzy-match logic has been manually verified end-to-end against
  live boards during development (see commit history) but isn't covered by CI-run tests yet.
