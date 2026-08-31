# Career Command Center

A personal career, project, and job-application command center. See [ARCHITECTURE.md](ARCHITECTURE.md)
for the full system design, database schema, and phased implementation roadmap this project follows.

**Status:** Phase 0 (foundation) and Phase 1 (companies) complete. Auth, database, base app
shell, and the web/worker process split are in place, and the company tracker (CRUD,
domain-based logo lookup, card/table views, search/filter) is fully working end-to-end.
Remaining feature phases (career-page monitoring, inbox, pipeline, etc.) build on top of this
incrementally — see `ARCHITECTURE.md` §14 for the roadmap.

## Stack

- **Web**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Database**: PostgreSQL via Prisma (driver adapter: `@prisma/adapter-pg`)
- **Auth**: Auth.js v5, single-user credentials login (JWT sessions)
- **Worker**: standalone Node process (BullMQ scheduler/queue land in Phase 2) — kept
  separate from the web process from day one so career-page monitoring never depends on a
  serverless-friendly request lifecycle
- **Queue**: Redis (via BullMQ, starting Phase 2)
- **Monorepo**: pnpm workspaces (`apps/web`, `apps/worker`, `packages/db`, `packages/shared`)

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

# 5. Run the app
pnpm dev:web      # http://localhost:3000
pnpm dev:worker   # in a separate terminal — currently just proves DB/Redis connectivity
```

Sign in with the `APP_USER_EMAIL` / `APP_USER_PASSWORD` you set in `.env`.

## Environment variables

All defined once in the root `.env` (not per-app — see `apps/web/next.config.ts` and each
package's scripts, which load it explicitly). See `.env.example` for the full list.

## Monorepo layout

```
apps/
  web/       Next.js app — UI, auth, dashboard, (eventually) all feature pages
  worker/    Standalone Node process for scheduled/background work (Phase 2+)
packages/
  db/        Prisma schema, migrations, seed script, shared PrismaClient instance
  shared/    Zod schemas and types shared between web and worker
```

## Common commands

| Command | What it does |
|---|---|
| `pnpm dev:web` / `pnpm dev:worker` | Run each process locally with hot reload |
| `pnpm db:migrate` | Create/apply a Prisma migration (`prisma migrate dev`) |
| `pnpm db:studio` | Open Prisma Studio against the local database |
| `pnpm build` | Production build of both apps |
| `pnpm lint` | Lint all workspaces |
| `docker compose --profile full up` | Run the full 4-service topology (web+worker+postgres+redis) in containers, matching the eventual deployment shape |

## Known limitations

- Companies (Phase 1) have full CRUD; jobs, applications, projects, and goals do not yet —
  those pages are intentionally simple placeholders that name the phase they arrive in.
- Company logos are derived automatically from the domain (via DuckDuckGo's icon service) at
  create/update time — there's no manual upload path, by design.
- The worker process only verifies Postgres/Redis connectivity — the BullMQ scheduler and
  scraping adapters land in Phase 2.
- No automated tests yet — the test strategy is defined in `ARCHITECTURE.md` §12 and gets
  built out starting Phase 2 alongside the first adapters.
