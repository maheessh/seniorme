# Senior Me — Architecture & Implementation Plan

Status: **Planning only — no application code has been written yet.** This document is the
output of the architecture phase. Implementation begins after you review and approve this.

> **Update (post-Phase-10):** the app was rebranded from "Career Command Center" to "Senior Me,"
> and the single-user login described below was removed entirely — this only ever runs locally
> for one person, so there was nothing for it to authenticate against. See §10 for the current
> state. The rest of this document is left as the original planning record.
>
> **Update (multi-tenant pivot):** that "no auth needed" premise no longer holds — the app is
> being turned into a real multi-user product. Auth.js v5 is back (Google + GitHub OAuth, JWT
> sessions, no passwords stored this time), and the schema now splits into a **shared catalog**
> (`Company`, `CareerSource`, `ScrapeRun`, `Job` — the same scraped data for every user) and a
> **per-user overlay** (`UserCompany` for tracking/priority/notes/scrape-scope filters,
> `UserJobStatus` for triage state; `Application`/`Contact`/`Project`/`Goal` now belong to one
> user directly). Every route under `(app)/` requires a session again. The single-user
> descriptions below (§1, §7's schema, §10) are historical — see the README's "Multi-tenant data
> model" section for the current shape.

Decisions already made with you:
- **Design inspiration**: [cluely.com](https://cluely.com) — soft gradient hero backgrounds, a serif
  display headline paired with a clean sans-serif UI typeface, glassy dark "live" panels with
  macOS-style window chrome, pill-shaped glossy CTA buttons, generous whitespace, minimal top nav.
  We are borrowing the *visual language* (gradients, serif/sans pairing, glass cards, pill buttons,
  motion restraint), not any content, copy, or code — this is a data-dense dashboard, not a
  marketing site, so the language will be adapted for density and legibility (see §11).
- **Deployment**: local-only for now (Docker Compose), architected so it can move to
  Railway/Fly/Render later with minimal change.
- **Stack**: Next.js (App Router) + TypeScript full stack.
- **Auth**: single-user email/password auth with hashed credentials and sessions. *(Removed
  post-Phase-10 — see the update note above.)*

---

## 1. Product Requirements Summary

A single-user "career operating system" covering seven functional domains that must feel like
one connected product, not seven separate CRUD screens:

1. **Discovery** — companies you target, their career pages, and automated monitoring of those
   pages for new postings.
2. **Triage** — a fast inbox to react to newly discovered jobs (interested / save / apply / ignore).
3. **Pipeline** — a full application tracker from "discovered" through offer/rejection, with
   history, documents, contacts, and deadlines.
4. **Import** — paste any job URL and get a structured record, with graceful manual fallback.
5. **Projects** — senior-year project tracking with tasks/milestones and progress.
6. **Goals** — flexible personal goal tracking with progress and milestones.
7. **Insight** — a dashboard and analytics layer that answers "is my job search actually working?"

Cross-cutting requirements: activity timeline, in-app notifications (extensible to email later),
search/filter at scale (hundreds–thousands of jobs), dark/light mode, and production-grade
engineering (migrations, tests, error handling, security, observability) even though there's one
user.

## 2. Existing Codebase Analysis

The working directory is currently **empty** — there is
no existing application to extend. The "existing site" you referenced (cluely.com) is a third-party
marketing site used purely as **visual/style inspiration** (see the design note above); it is not a
codebase we own or can extend, and none of its content will be reused. Net effect: we're building
green-field, which is simpler — no legacy schema or framework constraints to work around.

## 3. Proposed System Architecture

```
                                   ┌─────────────────────────┐
                                   │        Browser           │
                                   │  Next.js App Router UI   │
                                   └────────────┬─────────────┘
                                                │ HTTPS (local: http://localhost)
                     ┌──────────────────────────▼───────────────────────────┐
                     │                  Next.js "web" process                │
                     │  • React Server Components + Server Actions           │
                     │  • Route Handlers (/api/*) for REST-ish endpoints     │
                     │  • Auth.js (session/credentials)                      │
                     │  • Service layer (lib/server/services/*)  ───────┐    │
                     └───────────────────────────┬───────────────────────┤   │
                                                  │                      │   │
                     ┌────────────────────────────▼──────┐  ┌────────────▼───▼──┐
                     │           Postgres (Prisma)        │  │   Redis (BullMQ)  │
                     │  users, companies, jobs, apps, ...  │  │  queues + repeat  │
                     └────────────────────────────▲────────┘  │  schedules        │
                                                  │            └─────────┬─────────┘
                     ┌────────────────────────────┴──────────────────────▼─────────┐
                     │                     "worker" process (Node)                  │
                     │  Scheduler tick → enqueue per-CareerSource jobs (24h default) │
                     │  Job consumer → Adapter registry → fetch → parse → normalize  │
                     │  → dedup → write to Postgres via same service layer           │
                     │  → ScrapeRun record → Notification on new jobs / failures     │
                     └───────────────────────────┬───────────────────────────────────┘
                                                  │ outbound HTTP (rate-limited, SSRF-guarded)
                                     ┌────────────▼─────────────┐
                                     │ Greenhouse / Lever / Ashby │
                                     │ / SmartRecruiters / Workday│
                                     │ / generic HTML career pages│
                                     └────────────────────────────┘
```

Key architectural decision: **the web process and the worker process are separate from day one**,
even though everything runs on one machine via Docker Compose. This is the single most important
choice for avoiding a painful rewrite later — Next.js route handlers are not a safe place to run
a 24h-cron/long-poll scraper (no guaranteed long-running process, hostile to serverless deploys).
A standalone worker means the exact same code can later run on Railway/Fly as an always-on
service, or the web half alone can move to Vercel, without re-architecting the scraping system.

Both processes share one codebase (a small monorepo, not a rewrite-in-two-languages split) via a
shared `packages/` (or `src/server/`) layer: Prisma client, Zod schemas, the service layer, and the
adapter registry are imported by both `apps/web` and `apps/worker`.

## 4. Recommended Technology Stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One language across UI, API, services, worker, and scrapers — matches "strong typing" and "clean folder structure" goals, and Zod schemas can be shared between form validation, API validation, and scraper output validation. |
| Web framework | Next.js 15 (App Router) | Server Components give fast, data-dense pages without a hand-rolled API for every read; Server Actions remove boilerplate for mutations; one framework covers routing, SSR, and API routes. |
| Database | PostgreSQL | Relational integrity (foreign keys, unique constraints) matters here — dedup, pipeline stages, and analytics are all relational queries. `pg_trgm` gives us fuzzy-match dedup for free. |
| ORM / migrations | Prisma | Type-safe queries matching the TS-everywhere choice, first-class migration tooling, easy seed scripts — directly satisfies the "migrations, seed data" requirement. |
| Queue / scheduler | BullMQ + Redis | Real retry/backoff/repeatable-job semantics instead of a hand-rolled `setInterval` cron (which cannot survive a crash or dedupe overlapping runs). Battle-tested, small footprint, works identically local or deployed. |
| Scraping (structured) | Native `fetch` against ATS public APIs (Greenhouse, Lever, Ashby, SmartRecruiters, Workday CXS) | Stable JSON responses, no HTML fragility, respects the "prefer public APIs over scraping" requirement directly. |
| Scraping (fallback) | Cheerio (HTML parsing) + `schema.org JobPosting` JSON-LD extraction | Most modern career sites embed JobPosting structured data even when custom-built; parsing that is far more stable than scraping visual DOM. |
| Scraping (last resort) | Playwright (headless Chromium) | Only for JS-rendered custom career pages with no API and no JSON-LD. Used sparingly — heavier, slower, more fragile — and always behind the same robots.txt/rate-limit checks. |
| Auth | Auth.js (NextAuth) v5, Credentials provider | Single user, so no need for a hosted auth SaaS; Auth.js gives secure session handling, CSRF protection, and hashed-password storage (via `bcrypt`) without hand-rolling session logic. |
| Validation | Zod | Shared schemas across forms, Server Actions, route handlers, and scraper-output normalization — one source of truth for "what does a valid Job look like." |
| Styling / components | Tailwind CSS + shadcn/ui | Utility CSS matches the "fast, minimal, polished" goal; shadcn/ui gives accessible, ownable component primitives (not a black-box design system) to build the Cluely-inspired look on top of. |
| Charts | Tremor (built on Recharts) | Purpose-built for dashboard KPIs/charts, integrates cleanly with Tailwind, avoids hand-rolling chart primitives. |
| Kanban drag-and-drop | dnd-kit | Accessible, well-maintained, works with React Server/Client Component split. |
| Motion | Framer Motion (used sparingly) | Matches the Cluely-style restrained motion (hover states, panel transitions) without overusing animation. |
| Command palette | `cmdk` | Keyboard-friendly navigation (⌘K), matches the Linear-inspired UX goal. |
| Logging | Pino | Structured JSON logs from both web and worker processes, cheap to pipe to a file or log service later. |
| Testing | Vitest (unit/integration), Playwright Test (E2E), MSW/nock (HTTP mocking for scraper tests) | Vitest is fast and TS-native; Playwright is already a dependency for scraping, so reusing it for E2E avoids a second browser-automation dependency. |
| Containerization | Docker Compose (web, worker, postgres, redis) | One-command local environment; identical service topology maps directly onto Railway/Fly later. |
| Logo retrieval | Clearbit Logo API / Google `s2/favicons` by domain, with local caching | Public, no-auth, domain-based logo lookup — matches "automatically retrieve the company logo using its domain" without requiring uploads. |
| LLM-assisted extraction fallback | Claude API (Haiku-tier) as a **last-resort** structured-extraction step | When a career page has no API, no JSON-LD, and an inconsistent DOM, a small LLM call to extract `{title, location, description}` from cleaned page text is far more robust than brittle CSS selectors. Used only as a fallback tier, with the raw text cached so extraction is auditable. |

## 5. Database Schema

Represented as Prisma-style models (final `schema.prisma` will match this closely).

```prisma
enum Priority        { LOW MEDIUM HIGH }
enum EmploymentType  { INTERNSHIP NEW_GRAD FULL_TIME CONTRACT }
enum WorkMode        { REMOTE HYBRID ONSITE UNKNOWN }
enum SourceType       { GREENHOUSE LEVER ASHBY ICIMS SMARTRECRUITERS WORKDAY CUSTOM_JSONLD CUSTOM_HTML }
enum ScrapeStatus     { SUCCESS PARTIAL_SUCCESS FAILURE }
enum InboxStatus      { NEW SAVED APPLIED IGNORED }
enum ApplicationStage {
  SAVED PREPARING APPLIED OA RECRUITER_SCREEN
  INTERVIEW FINAL_INTERVIEW OFFER REJECTED WITHDRAWN CLOSED
}
enum ProjectStatus  { IDEA PLANNING BUILDING TESTING COMPLETED }
enum GoalCategory   { PROJECT CODING_PRACTICE APPLICATIONS INTERVIEW_PREP LEARNING RESUME COURSEWORK OTHER }
enum GoalStatus      { NOT_STARTED IN_PROGRESS COMPLETED ABANDONED }
enum NotificationType {
  NEW_MATCHING_JOB DEADLINE_APPROACHING FOLLOW_UP_DUE
  INTERVIEW_APPROACHING GOAL_DEADLINE SCRAPER_FAILING
}

model Company {
  id                String    @id @default(cuid())
  name              String
  domain            String?              // used to derive logo + dedupe companies
  logoUrl           String?
  website           String?
  location          String?
  industry          String?
  priority          Priority  @default(MEDIUM)
  notes             String?
  rolesOfInterest   String[]             // scrape filter: keep a posting only if its title contains one of these
  targetLocationKeywords String[] @default([])  // scrape filter: keep only if location contains one of these
  maxPostingAgeDays Int?                 // scrape filter: drop postings older than this (unknown age is never dropped)
  monitoringEnabled Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  careerSources CareerSource[]
  jobs          Job[]
  applications  Application[]
  contacts      Contact[]

  @@unique([domain])
}

model CareerSource {
  id                String       @id @default(cuid())
  companyId         String
  company           Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  url               String
  sourceType        SourceType   @default(CUSTOM_HTML)
  checkFrequencyMin Int          @default(1440)   // 24h in minutes; overridable per source
  isActive          Boolean      @default(true)
  lastCheckedAt     DateTime?
  lastSuccessAt     DateTime?
  consecutiveFailures Int        @default(0)
  lastError         String?

  scrapeRuns ScrapeRun[]
  jobs       Job[]

  @@unique([companyId, url])
}

model ScrapeRun {
  id             String        @id @default(cuid())
  careerSourceId String
  careerSource   CareerSource  @relation(fields: [careerSourceId], references: [id], onDelete: Cascade)
  startedAt      DateTime      @default(now())
  finishedAt     DateTime?
  status         ScrapeStatus
  jobsFound      Int           @default(0)
  jobsNew        Int           @default(0)
  errorMessage   String?
  triggeredBy    String        // "scheduler" | "manual"

  @@index([careerSourceId, startedAt])
}

model Job {
  id              String        @id @default(cuid())
  companyId       String
  company         Company       @relation(fields: [companyId], references: [id])
  careerSourceId  String?
  careerSource    CareerSource? @relation(fields: [careerSourceId], references: [id])

  title           String
  location        String?
  workMode        WorkMode      @default(UNKNOWN)
  employmentType  EmploymentType?
  url             String
  canonicalUrlHash String       // sha256 of normalized URL — primary dedup key
  externalJobId   String?       // ID from the ATS, when available — strongest dedup key
  descriptionRaw  String?
  descriptionHash String?       // detects content changes on an existing posting
  salaryMin       Int?
  salaryMax       Int?
  postedAt        DateTime?
  discoveredAt    DateTime      @default(now())
  inboxStatus     InboxStatus   @default(NEW)
  isRemoved       Boolean       @default(false)  // posting disappeared from the source on a later check

  application Application?
  activity    ActivityEvent[]

  @@unique([companyId, externalJobId])
  @@unique([canonicalUrlHash])
  @@index([companyId, inboxStatus])
  @@index([discoveredAt])
}

model Application {
  id                String            @id @default(cuid())
  jobId             String            @unique
  job               Job               @relation(fields: [jobId], references: [id])
  companyId         String
  company           Company           @relation(fields: [companyId], references: [id])

  stage             ApplicationStage  @default(SAVED)
  appliedAt         DateTime?
  deadline          DateTime?
  followUpDate      DateTime?
  resumeVersion     String?
  coverLetter       String?
  recruiterContactId String?
  contact           Contact?          @relation(fields: [recruiterContactId], references: [id])
  notes             String?
  descriptionSnapshot String?         // frozen copy of the JD at apply-time, in case it's edited/removed later

  events   ApplicationEvent[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([stage])
  @@index([deadline])
}

model ApplicationEvent {
  id            String            @id @default(cuid())
  applicationId String
  application   Application       @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  fromStage     ApplicationStage?
  toStage       ApplicationStage
  note          String?
  occurredAt    DateTime          @default(now())

  @@index([applicationId, occurredAt])
}

model Contact {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  name      String
  role      String?
  email     String?
  linkedInUrl String?
  notes     String?

  applications Application[]
}

model Project {
  id              String         @id @default(cuid())
  name            String
  description     String?
  repoUrl         String?
  demoUrl         String?
  technologies    String[]
  status          ProjectStatus  @default(IDEA)
  priority        Priority       @default(MEDIUM)
  startDate       DateTime?
  targetDate      DateTime?
  progressPercent Int            @default(0)
  notes           String?

  tasks ProjectTask[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ProjectTask {
  id         String    @id @default(cuid())
  projectId  String
  project    Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title      String
  isDone     Boolean   @default(false)
  dueDate    DateTime?
  order      Int       @default(0)
}

model Goal {
  id              String      @id @default(cuid())
  title           String
  category        GoalCategory
  targetValue     Int?                 // e.g. 100 (applications), null for non-numeric goals
  currentValue    Int         @default(0)
  deadline        DateTime?
  priority        Priority    @default(MEDIUM)
  status          GoalStatus  @default(NOT_STARTED)
  notes           String?

  milestones GoalMilestone[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model GoalMilestone {
  id      String   @id @default(cuid())
  goalId  String
  goal    Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  title   String
  isDone  Boolean  @default(false)
  dueDate DateTime?
}

model ActivityEvent {
  id        String   @id @default(cuid())
  type      String   // "job_discovered" | "application_stage_changed" | "goal_completed" | ...
  entityType String  // "job" | "application" | "company" | "project" | "goal"
  entityId  String
  jobId     String?
  job       Job?     @relation(fields: [jobId], references: [id])
  summary   String
  metadata  Json?
  occurredAt DateTime @default(now())

  @@index([occurredAt])
  @@index([entityType, entityId])
}

model Notification {
  id        String            @id @default(cuid())
  type      NotificationType
  title     String
  body      String?
  linkUrl   String?
  isRead    Boolean           @default(false)
  createdAt DateTime          @default(now())

  @@index([isRead, createdAt])
}
```

**Indexing/constraint notes**

- `Job.canonicalUrlHash` is unique — the URL-normalization dedup key (strip UTM/query tracking
  params, lowercase host, resolve to canonical when a `<link rel=canonical>` exists).
- `Job` unique on `(companyId, externalJobId)` when the source ATS gives a stable ID — this is the
  strongest dedup signal and is preferred over the URL hash when available.
- `pg_trgm` extension + a trigram index on `Job.title` (scoped per company) powers a fuzzy-match
  pass for the harder case: same role reposted with a new external ID and a slightly different URL.
- `Application.jobId` is unique — one application per job (re-applying is modeled as a new
  `ApplicationEvent`/note, not a duplicate row), matching the "moves into pipeline" mental model.
- Every list a user will filter at scale (`Job.inboxStatus`, `Application.stage`, dates) is indexed.

## 6. API Design

Two layers, both calling into the same `lib/server/services/*` functions (no duplicated business
logic between UI mutations and HTTP endpoints):

- **Server Actions** — used directly by forms/components for mutations that only the web UI needs
  (creating/editing companies, projects, goals, moving a card on the Kanban board, marking an inbox
  item). Colocated with the routes that use them.
- **Route Handlers (`/app/api/**`)** — used where a stable HTTP contract is useful: the worker
  process calling back into shared logic isn't needed (it uses the service layer directly, in-process),
  but route handlers are still the right shape for anything triggered by a client-side fetch that
  needs REST semantics (pagination, filtering query params) or that we may want to call from outside
  the browser later (a future mobile client, an email-parsing webhook, etc.).

| Method & Path | Purpose |
|---|---|
| `GET/POST /api/companies` | List (filter/search/paginate) & create companies |
| `GET/PATCH/DELETE /api/companies/:id` | Read/update/delete a company |
| `POST /api/companies/:id/logo/refresh` | Re-fetch logo from domain |
| `GET/POST /api/companies/:id/career-sources` | List/add career page sources for a company |
| `POST /api/career-sources/:id/trigger` | Manually enqueue an immediate scrape (rate-limited) |
| `GET /api/jobs` | List jobs with filters: company, status, location, date range, employment type, work mode, search |
| `GET /api/jobs/:id` | Job detail |
| `PATCH /api/jobs/:id/inbox-status` | Move a job through the inbox (interested/saved/not interested/ignored/apply) |
| `POST /api/jobs/import` | Paste-a-URL import → runs extraction pipeline → returns a draft record |
| `GET/POST /api/applications` | List pipeline (filterable by stage) & create (usually via "apply" from a Job) |
| `GET/PATCH /api/applications/:id` | Read/update an application |
| `POST /api/applications/:id/events` | Log a stage change or note (drives `ApplicationEvent` + `ActivityEvent`) |
| `GET/POST /api/projects`, `/api/projects/:id`, `/api/projects/:id/tasks` | Project + task CRUD |
| `GET/POST /api/goals`, `/api/goals/:id`, `/api/goals/:id/milestones` | Goal + milestone CRUD |
| `GET /api/activity` | Paginated activity timeline, filterable by entity type/date |
| `GET/PATCH /api/notifications` | List + mark read |
| `GET /api/analytics/overview` | Dashboard KPI numbers |
| `GET /api/analytics/funnel` | Stage-conversion funnel (discovered→applied→interview→offer) |
| `GET /api/analytics/timeline` | Applications-over-time series |
| `GET /api/analytics/stage-duration` | Average time spent per pipeline stage |

All inputs validated with Zod at the boundary; all list endpoints support cursor pagination from
day one (explicitly required by "remain easy to use... hundreds/thousands of jobs").

## 7. Background-Job & Scheduler Architecture

```
Scheduler (BullMQ repeatable job, runs in worker process)
   │  every N minutes: for each active CareerSource where
   │  now - lastCheckedAt >= checkFrequencyMin (default 1440 = 24h)
   ▼
Enqueue `scrape-career-source` job (jobId = careerSourceId → BullMQ dedupes in-flight duplicates)
   ▼
Worker consumer (concurrency-limited per host, e.g. max 2 concurrent jobs per domain)
   ├─ Resolve adapter (by CareerSource.sourceType, auto-detected on creation — see §8)
   ├─ robots.txt check (cached per-domain, re-checked periodically)
   ├─ Fetch with timeout (10s) + retry (BullMQ: 3 attempts, exponential backoff, jitter)
   ├─ Parse → list of RawJobPosting
   ├─ Normalize (title/location/salary/date formats → common shape)
   ├─ Dedup against DB (externalJobId → canonicalUrlHash → trigram fuzzy match, in that order)
   ├─ Insert new Job rows; mark previously-seen jobs no longer present as `isRemoved`
   ├─ Write ScrapeRun (status, counts, error if any)
   ├─ Update CareerSource.lastCheckedAt/lastSuccessAt/consecutiveFailures
   └─ On success with new jobs → ActivityEvent + Notification(NEW_MATCHING_JOB)
      On failure → consecutiveFailures++; if >= 5 → Notification(SCRAPER_FAILING) (deduped, not spammy)
```

Reliability guarantees:
- **A failed scrape never crashes the app** — the worker wraps every job body in try/catch,
  BullMQ itself isolates job failures, and the web process never depends on the worker being up
  (it just reads whatever's already in Postgres).
- **Retries** are BullMQ's built-in exponential backoff (e.g. 1m → 5m → 25m across 3 attempts)
  before a run is marked `FAILURE`.
- **Idempotency / scheduler-runs-twice** — BullMQ repeatable jobs plus a stable job ID
  (`careerSourceId` + time bucket) prevent duplicate enqueues; the dedup layer at write-time is a
  second line of defense so even a genuine double-run can't create duplicate `Job` rows (the unique
  constraints in §5 make duplicate inserts fail safely, and the service layer treats that as "already
  known," not an error).
- **Manual trigger** from the UI calls the same enqueue path with `triggeredBy: "manual"`, subject to
  a minimum-interval guard (e.g. can't manually re-trigger the same source more than once every
  5 minutes) so the UI can't be used to hammer a target site.
- **Observability**: every run is a row in `ScrapeRun` — the UI surfaces last-checked time,
  last-success time, and recent failures per company directly (§11), not buried in logs.

## 8. Career-Page Scraping Architecture

Adapter pattern, resolved in priority order — **structured/stable sources first, brittle scraping
last**:

```ts
interface CareerSiteAdapter {
  readonly type: SourceType
  matches(url: string): boolean            // e.g. hostname is boards.greenhouse.io
  fetchPostings(source: CareerSource): Promise<RawJobPosting[]>
}
```

1. **Greenhouse** — `https://boards-api.greenhouse.io/v1/boards/{token}/jobs` (public JSON API).
2. **Lever** — `https://api.lever.co/v0/postings/{company}?mode=json` (public JSON API).
3. **Ashby** — `https://api.ashbyhq.com/posting-api/job-board/{org}` (public JSON API).
4. **SmartRecruiters** — `https://api.smartrecruiters.com/v1/companies/{company}/postings` (public API).
5. **Workday** — many tenants expose a JSON CXS endpoint (`/wday/cxs/{tenant}/{site}/jobs`); adapter
   attempts this first and falls back to tier 6 if the tenant doesn't expose it.
6. **Generic JSON-LD** *(implemented)* — fetch the listing page's HTML, look for every
   `<script type="application/ld+json">` block with `@type: JobPosting` (schema.org) — very
   common even on custom-built career pages (done for Google for Jobs SEO), and far more stable
   than CSS-selector scraping since it's meant to be machine-read. Verified against Waymo's
   Clinch-powered careers page and a synthetic multi-posting fixture.
7. **Generic HTML heuristics (Cheerio)** *(implemented)* — looks for repeated same-hostname
   links matching a job-URL shape (`/jobs/…`, `/careers/…`, etc.), filters obvious nav/footer
   noise, and requires at least 3 distinct matches before trusting the result — a page with 1–2
   stray matches is treated as noise, not a listing. Results land in `sourceType: CUSTOM_HTML`,
   distinct from `CUSTOM_JSONLD`, so lower-confidence data is visibly labeled as such. Verified
   against the same Waymo page (30 real postings, zero false positives from its JS asset
   references or self-referential search/filter links) and a synthetic false-positive check.
8. **Playwright (headless)** *(implemented)* — last resort, only tried when tiers 6–7 find
   nothing because the page renders its listings with JavaScript and the server sends an empty
   shell (e.g. a Paycom ATS board verified during implementation — OKC Thunder's career page).
   Loads the page in real headless Chromium and re-runs the same JSON-LD/HTML-link extraction
   against the rendered DOM. Every sub-request the page makes is checked against the same SSRF
   guard as `safeFetch`, since a real browser will fetch whatever the page tells it to. Doesn't
   drive JS-only pagination (clicking a "next page" control) — it only captures what's visible on
   initial render, so its results are always marked incomplete (`AdapterFetchResult.complete:
   false`) and never used for removal-detection, only for discovering/refreshing postings. Needs
   a real Chromium binary at runtime (`npx playwright install chromium` locally); the worker's
   Docker runner image moved from `node:22-alpine` to a Debian base with Chromium installed
   selectively (`playwright install --with-deps chromium`), since Playwright's bundled Chromium
   isn't supported on Alpine's musl libc — verified by building and running that image against a
   real board (see DEPLOYMENT.md).

**Scrape-scope filtering (`Company.rolesOfInterest` / `targetLocationKeywords` /
`maxPostingAgeDays`):** a large company's board can run into the thousands of postings, most of
them irrelevant to any one search (verified live against Amazon's board — a bare, unfiltered
search returned postings ranging from warehouse technicians to ML research roles). Applied once
per scrape, after dedup but before `upsertJobPosting`, in `filterByCompanyPreferences`
(`apps/worker/src/scrape-processor.ts`) — title/location are simple case-insensitive substring
matches (OR-combined within each filter, AND-combined across the three), and an unset filter
(empty array / null) never excludes anything. Deliberately lives on the `Company`, not the
`CareerSource`, since it expresses "what I care about here" regardless of which specific board a
posting came from. Two judgment calls worth being explicit about: a posting with no location data
is *excluded* when a location filter is active (can't confirm a match, and the whole point is
narrowing a large board down — letting everything through by default would defeat that for
exactly the generic-HTML-tier sites most likely to need it), while a posting with no post date is
*never* excluded by the age filter (unknown age isn't evidence it's stale). Only affects what gets
stored going forward — never touches removal-detection, which still runs against the full,
unfiltered listing (a posting the filter excludes was simply never stored, not "removed" from a
source it's still genuinely listed on).

**Politeness note:** `Crawl-delay` in a site's `robots.txt`, when present, now overrides the
default 1s per-host minimum spacing (capped at 30s) — discovered as a real gap while testing
against a site that explicitly requests a 5s delay.

**On adding a CareerSource**, the system probes tiers 1–4 by pattern-matching the URL/hostname
(e.g. `*.greenhouse.io`, `jobs.lever.co/*`) before falling through to 5–8, and stores the resolved
`sourceType` so subsequent scheduled runs skip straight to the right adapter instead of re-probing.

**Politeness & legality boundaries (hard constraints, not configurable per source):**
- `robots.txt` is fetched and cached per domain; disallowed paths are never fetched.
- A realistic but honest `User-Agent` identifying the bot and its purpose.
- Per-host concurrency cap and minimum request spacing (token-bucket limiter), independent of how
  many CareerSources share that host.
- No login walls are ever crossed, no CAPTCHA is ever attempted, no anti-bot fingerprint evasion.
  If a page is behind such a barrier, the run is marked `FAILURE` with a clear reason and surfaced
  to you — the answer is "you may need to check this one manually," never "bypass it."
- Adding new adapters is additive (new file implementing the interface + registering it) — no
  changes needed elsewhere, satisfying the "modular, more adapters later" requirement.

**SSRF protection** applies to every user-supplied URL (career page URLs, job-import URLs): scheme
restricted to `http(s)`, DNS-resolved and checked against private/loopback/link-local/metadata
(`169.254.169.254`) ranges before connecting, redirects re-validated at each hop (not just the
initial URL), response size and time capped.

## 9. Deduplication Strategy

Layered, most-confident-first:

1. **External ID match** — `(companyId, externalJobId)` unique constraint. Strongest signal; used
   whenever the source API provides a stable ID (Greenhouse/Lever/Ashby/SmartRecruiters all do).
2. **Canonical URL hash** — normalize URL (lowercase host, strip tracking query params like
   `utm_*`/`gh_src`, follow `<link rel="canonical">` if present, strip trailing slash) → SHA-256 →
   unique constraint. Catches the same posting re-fetched without a stable external ID.
3. **Fuzzy match (trigram similarity on title, scoped to the same company + similar location)** —
   catches the "reposted with a new ID and a slightly reworded title" case that IDs/URLs miss
   entirely. This tier does **not** auto-merge — it flags the new row as `possibleDuplicateOf: <jobId>`
   for a one-click confirm/reject in the Inbox, because silent fuzzy-merging risks hiding a real
   new opening.
4. **Content hash** (`descriptionHash`) on an already-matched job detects "same job, description
   changed" — recorded as an `ActivityEvent` ("job description updated") rather than a new job.
5. **Removal detection** — a posting present in a previous run but absent from the current one is
   marked `isRemoved = true` (not deleted — you may still be mid-application for it), which the
   dashboard and pipeline both surface ("this listing has been taken down").

## 10. Security Considerations

- **Auth**: none — this later became a purely local, single-person tool with no exposed network
  surface, so login/sessions/CSRF were removed entirely rather than kept as unused complexity
  (Auth.js, the `User` model, and the login page all deleted; see the update note in §1).
- **Validation**: Zod schemas at every Server Action and route handler boundary; Prisma parameterizes
  all queries (no raw SQL string interpolation).
- **Secrets**: `.env` (git-ignored) for `DATABASE_URL`, Redis URL, Claude API key (for the
  extraction fallback); `.env.example` committed with placeholder keys; a CI/pre-commit
  secret-scan (e.g. `gitleaks`) is worth adding once this is under version control.
- **SSRF**: as described in §8, applied uniformly to career-source URLs and job-import URLs.
- **Rate limiting**: outbound (per-host scraping) as described above.
- **Input sanitization**: scraped/imported HTML descriptions are sanitized (e.g. `sanitize-html`)
  before storage/render to prevent stored XSS from a malicious/compromised career page.
- **Error handling**: no stack traces or internal errors ever reach the client response body;
  structured logs (Pino) capture full detail server-side, client sees a safe generic message plus
  a correlation ID.
- **Database constraints** as the last line of defense for dedup/integrity (§5), not just
  application-level checks.

## 11. UI Information Architecture

Left sidebar navigation (collapsible), persistent across the app:

`Dashboard · Inbox · Pipeline · Companies · Projects · Goals · Analytics · Notifications`

- **Dashboard** — KPI tile row (companies tracked, jobs discovered, new today, saved, applied,
  interviewing, offers, rejections) in glass-card tiles with subtle gradient accents (Cluely-style),
  upcoming-deadlines list, goal/project progress rings, recent activity feed, and a "needs attention"
  panel (stale applications, failing scrapers, jobs closing soon).
- **Inbox** — single-item or dense-list "swipe"-style triage (keyboard shortcuts: `j`/`k` to move,
  `a` apply, `s` save, `x` not-interested) — optimized for speed, per your explicit requirement.
- **Pipeline** — Kanban by default (columns = `ApplicationStage`), with a dense-table view toggle
  for when you have many applications and want to scan/filter/sort instead of scroll columns;
  card click opens a detail drawer (notes, contacts, events, documents) without full navigation.
- **Companies** — card grid (logo, priority, monitoring status, last-checked) with table/filter/search
  toggle, matching your spec directly.
- **Projects / Goals** — progress-forward cards (progress bar/ring, status pill, next milestone).
- **Analytics** — the charts from §12, grouped by question ("is my funnel healthy?", "am I keeping
  pace with goals?").
- **Command palette (⌘K)** — jump to any entity, trigger "add company," "import job URL," or
  "trigger scrape" without leaving keyboard.
- **States**: every list has a designed empty state (not a blank div), skeleton loading states
  (not spinners) for data-dense views, and inline error states with retry — matches the "premium"
  requirement directly.
- **Theming**: CSS-variable-based tokens so dark/light mode is a variable swap, not two parallel
  style systems; the Cluely-style gradient hero treatment carries into the dashboard header banner
  in light mode, with a glass/dark-panel treatment for the same header in dark mode.

## 12. Testing Strategy

| Layer | Tool | Focus |
|---|---|---|
| Unit | Vitest | Normalizers, dedup logic (all 5 tiers), URL canonicalization, stage-transition rules, analytics aggregation math |
| Integration | Vitest + a real Postgres test container | Prisma queries, unique-constraint behavior, service-layer functions end-to-end against the DB |
| Adapter/parser | Vitest + fixture files (recorded real API/HTML responses) + MSW to mock HTTP | Each adapter tested against a "happy path" fixture and a "malformed/changed format" fixture |
| API | Vitest calling route handlers directly (or Supertest against a test server) | Auth boundaries, validation errors, pagination correctness |
| E2E | Playwright Test | Landing page → add company → manual scrape trigger → job appears in inbox → move to application → drag across Kanban stages → create project/goal and update progress → job-link import happy path and manual-fallback path → Inbox company/employment-type filters → Inbox bulk-select and bulk-ignore |

Explicit edge cases from your spec, mapped to concrete tests:
- Duplicate jobs across runs → adapter test asserts second run with identical fixture yields
  `jobsNew: 0`.
- Changed job URL, same external ID → dedup test asserts it updates in place, not a new row.
- Removed job → adapter test with a shrinking fixture set asserts `isRemoved` flips.
- Career page temporarily unavailable → mocked network timeout/5xx asserts `ScrapeRun.status =
  FAILURE`, `consecutiveFailures` increments, and the app keeps serving normally.
- Invalid/malicious URL (import or career source) → SSRF-guard unit tests (private IP, non-http
  scheme, redirect-to-internal).
- Missing metadata (no salary/location/date) → normalizer test asserts nulls are handled, not thrown.
- Network failure mid-scrape → BullMQ retry/backoff test.
- Job page format changes → adapter given an intentionally-mutated fixture asserts graceful
  partial-extraction (`confidence: low`) rather than a crash.
- Scheduler runs twice → concurrency test asserts the BullMQ job-ID dedupe plus DB unique
  constraints prevent duplicate `Job` rows even under a forced double-enqueue.
- Scraper returns duplicate records within one run → dedup-within-batch unit test before DB writes.

We will not claim "bug-free" — the README will document known limitations (e.g., custom career
sites without JSON-LD are best-effort) and how to report/handle a broken adapter.

## 13. Deployment Architecture

**Now (local):** `docker-compose.yml` with four services — `postgres`, `redis`, `web` (Next.js,
port 3000), `worker` (Node, no exposed port). `.env` holds connection strings/secrets. A single
`docker compose up` gets the full stack running, matching "local development instructions."

**Later (optional cloud move), for reference now so nothing built precludes it:**
- `web` → Vercel *or* stays on the same host as `worker` (Vercel doesn't run long-lived processes,
  so if `web` moves to Vercel, `worker` needs to live elsewhere — Railway/Fly/a small VPS — talking
  to the same managed Postgres/Redis).
- `worker` → Railway/Fly/Render as an always-on service (this is exactly why it was built as a
  standalone process from day one).
- Managed Postgres (Neon/Railway/RDS) + managed Redis (Upstash/Railway).
- Structured logs already in place (Pino) plug into any log drain the host provides.

## 14. Step-by-Step Implementation Roadmap

- **Phase 0 — Foundation**: repo scaffold (Next.js + TS + Tailwind + shadcn/ui), Docker Compose
  (postgres/redis), Prisma schema + first migration + seed script, Auth.js single-user login,
  base app shell/layout/design tokens (light+dark).
- **Phase 1 — Companies**: CRUD, domain-based logo fetch, card grid + table/filter/search, empty/
  loading/error states.
- **Phase 2 — Scraping core**: adapter interface + Greenhouse/Lever/Ashby adapters (most
  standardized, highest value first), BullMQ scheduler + worker process, `ScrapeRun` tracking,
  manual "refresh" trigger in the Company UI.
- **Phase 3 — Discovery Inbox**: dedup pipeline (all tiers), fast triage UI with keyboard shortcuts,
  activity logging.
- **Phase 4 — Application Pipeline**: Kanban + table views, stage-change events/history, contacts,
  notes, deadlines, resume/cover-letter fields.
- **Phase 5 — Job Link Import**: JSON-LD/OG extraction, adapter reuse for known ATS URLs, Claude-
  assisted fallback extraction, manual-completion UI for failures.
- **Phase 6 — Projects & Goals**: CRUD, tasks/milestones, progress visualizations.
- **Phase 7 — Analytics**: funnel, time series, stage-duration, per-company activity.
- **Phase 8 — Notifications**: in-app notification center + triggers (new jobs, deadlines,
  follow-ups, repeated scrape failures), architected with a channel abstraction so email/push can
  be added later without a redesign.
- **Phase 9 — Hardening**: full test-suite build-out against the edge cases in §12, accessibility
  pass, command palette, performance pass on large datasets (pagination/virtualization).
- **Phase 10 — Docs & optional deploy**: README (setup, architecture summary, known limitations),
  deployment instructions for the cloud path in §13.

## Technically Difficult Parts & Failure Points (flagged up front)

1. **Career-site diversity** — Workday tenants and fully custom sites are inherently inconsistent;
   mitigated by the tiered adapter fallback (§8) and by treating low-confidence extraction as
   "needs your review," never as silent bad data.
2. **Dedup correctness** — no fully automatic scheme catches every repost/rename; the fuzzy tier is
   deliberately surfaced for human confirmation rather than auto-merged, trading a little manual
   effort for zero silent data loss.
3. **SSRF via user-supplied URLs** — two separate entry points (career sources, job import) both
   accept arbitrary user URLs; both must go through the same hardened fetch wrapper — this will be
   built once as a shared utility, not reimplemented per feature.
4. **Politeness at scale** — as the number of tracked companies grows, naive per-source scheduling
   could burst-request many hosts at once; mitigated with jitter on the 24h schedule and global/
   per-host concurrency caps in the worker.
5. **Keeping web/worker split honest** — it's tempting to "just call the scraper from a Server
   Action" for convenience; this must be resisted so the worker stays a real standalone process,
   preserving the deployment flexibility that's the whole point of the split.
6. **JS-rendered custom pages** — Playwright is heavy; it is deliberately the last-resort tier, and
   its failures should degrade to "flagged for manual review," not retried aggressively.

---

**Next step**: your review/approval of this plan. Anything you want changed — schema fields,
stack choices, phase ordering — is cheapest to adjust now, before Phase 0 starts.
