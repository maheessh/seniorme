# Deployment

This app is built and used locally (see the root `README.md`). This document covers the
optional cloud path described in `ARCHITECTURE.md` §13, for when/if that's ever needed — nothing
in the app's design precludes it, and the `web`/`worker` process split exists specifically so
`worker` can run as a long-lived service independent of `web`'s hosting choice.

**What's actually verified here vs. what's standard guidance:** the containerized path (Docker
images for `web` and `worker`, built and run end-to-end via `docker compose --profile full up`
against the real database) was built, run, and fixed until it worked — see "What was actually
broken" below. The specific instructions for Vercel/Railway/Neon/Upstash are standard,
well-documented patterns for this stack, but weren't run against real accounts on those platforms
(this environment doesn't have them) — treat that part as a correct starting point to verify
against the platforms' current UI, not as something proven to work exactly as written.

> **Note:** the app's login (Auth.js, single-user credentials) was removed after this
> verification pass — it's a purely local, single-person tool with no exposed surface, so there
> was nothing left for a login to protect. Bug #6 below (the `trustHost` fix) no longer applies
> since Auth.js itself is gone; it's kept here as part of the historical build record. The
> `NEXTAUTH_*`/`APP_USER_*` env vars and the "sign in" verification step referenced further down
> are likewise gone — see the updated env var table and "Verify" section.

## What was actually broken

Both `Dockerfile`s existed before this pass but had never been built successfully — the
`docker-compose.yml` `full` profile that uses them is explicitly opt-in and wasn't part of the
day-to-day dev loop. Building and running them for the first time surfaced six real bugs, all
fixed as part of this work:

1. **Missing workspace package in the Docker build context.** Both Dockerfiles copied
   `packages/db` and `packages/shared`'s `package.json` into the `deps` stage but not
   `packages/scraper`'s, even though both `apps/web` and `apps/worker` depend on it. pnpm's
   `install --frozen-lockfile` failed once the full source tree revealed the extra workspace
   member. Fixed by adding the missing `COPY`.
2. **No `.dockerignore`.** `COPY . .` in the build stage was copying the *host's* `node_modules`
   (built for macOS/ARM) into the Linux image, corrupting the `deps` stage's correctly-installed
   modules and triggering a `pnpm` interactive-confirmation prompt that fails non-interactively.
   Added one, excluding `node_modules`, `.next`, `.git`, `.env*`, and test artifacts.
3. **`prisma generate` needs *some* `DATABASE_URL`.** `prisma.config.ts` throws if the env var
   isn't resolvable at all, even though `generate` never connects to a database — it only reads
   the schema. The real value is deliberately not baked into the image (secrets belong in the
   runtime environment, not an image layer). Fixed with a syntactically-valid placeholder,
   scoped to the build stage only via Docker's per-stage `ENV`.
4. **The worker's `start` script assumed a local `.env` file.** `node --env-file=../../.env
   dist/index.js` crashes immediately in a container, where `.env` correctly doesn't exist (see
   `.dockerignore` above) — production env vars come from the hosting platform, not a checked-in
   dotenv file. Fixed by dropping `--env-file` from the production `start` script (kept on `dev`,
   where a local `.env` is the whole point).
5. **The worker's compiled output couldn't resolve its own dependencies at runtime.** `tsc`
   compiles `apps/worker`'s own source correctly (with the explicit `.js` extensions Node's
   strict ESM resolution requires), but `packages/db`/`packages/shared`/`packages/scraper` are
   consumed as raw, uncompiled TypeScript — fine under `tsx` (which resolves extensionless
   imports like a bundler does) or Next.js's own bundler, but not under plain `node`, which
   enforces explicit-extension ESM resolution and failed on `packages/db`'s
   `export * from "./generated/client"`. Fixed by running the worker in production via `tsx`
   against its source too (`node --import tsx src/index.ts`), the same engine already proven
   throughout local dev, rather than auditing extensionless imports across three packages.
   `tsc` still runs in the Docker build as a type-check gate — it just isn't what executes.
6. **Auth.js rejects every request in production without `trustHost`.** Dev mode auto-trusts the
   request's `Host` header; production doesn't, and throws `UntrustedHost` on every single
   request without an explicit opt-in. This is the standard, correct setting for a self-hosted,
   single-tenant app (not something that would be safe to set blindly for a service routing
   arbitrary external hosts). Added `trustHost: true` to the shared auth config.

> **Update:** the worker's `Dockerfile` later changed again — its `runner` stage moved from
> `node:22-alpine` to a Debian base to support the scraper's headless-Chromium fallback tier
> (`packages/scraper/src/adapters/headless.ts`), since Playwright's bundled Chromium isn't
> supported on Alpine's musl libc. First landed on Microsoft's official Playwright image
> (`mcr.microsoft.com/playwright:*-noble`), which works but bundles Chromium *and* Firefox *and*
> WebKit — ~1.5GB of browsers, only a third of it ever used, and baked into that image's own
> layers where a later `rm -rf` doesn't actually shrink the shipped image (deleting a file in a
> later Docker layer only hides it from the final filesystem view — the layer underneath that
> added it, and its size, are still part of what gets pushed/pulled). Switched to
> `node:22-bookworm-slim` with `playwright install --with-deps chromium` instead — installs only
> Chromium and its own OS-level dependencies, nothing else — which took the image from 5.06GB to
> 3.44GB. Also pins/caches the exact pnpm version at build time (`corepack prepare pnpm@X
> --activate`, matching the `packageManager` field in the root `package.json`) in both
> Dockerfiles — without it, corepack fetches pnpm from the npm registry lazily on first `pnpm`
> invocation, which for the `runner` stage meant the *container's first startup*, not the build;
> a real reliability gap for a deployed container that's both easy to hit and easy to avoid.
> Verified the same way as the rest of this document: built both images, ran a real
> headless-Chromium fetch against a live JS-rendered career page inside the worker container, and
> booted both containers' actual `start` commands end-to-end (worker connecting to Postgres/Redis
> and registering its scheduler; web serving a real HTTP 200) rather than just checking that the
> build step exits zero.

A seventh, unrelated issue surfaced by the same testing pass: the worker's `tsc` build was also
compiling `*.test.ts` files into `dist/`, which Vitest then discovered and ran *in addition to*
the real `src/*.test.ts` files — and the compiled copies hit the same extension-resolution
failure as #5. Fixed by excluding test files from the `tsc` build and scoping Vitest's test
discovery to `src/` explicitly.

## Local: full containerized stack

Useful for testing the actual production build/boot path without leaving your machine — this is
the exact path verified above.

```bash
docker compose --profile full up -d --build
```

This builds both images fresh and starts all four services (`postgres`, `redis`, `web`, `worker`)
against the same `ccc` database `pnpm dev:web`/`pnpm dev:worker` use locally — real data, not a
separate fixture set. `web` binds to `localhost:3000`, so stop `pnpm dev:web` first if it's
running (only one process can hold that port). Tear down with `docker compose --profile full
down` (this only removes the `web`/`worker` containers — `postgres`/`redis` and their data
volumes are untouched, since those are shared with day-to-day dev).

## Cloud: Vercel (web) + Railway/Fly (worker) + managed Postgres/Redis

The natural split given the architecture: `web` is a standard Next.js app (Vercel's home turf);
`worker` is a long-lived process (which is exactly why it was built as its own standalone
process from day one — Vercel doesn't run those). Both need access to the *same* Postgres and
Redis, so provision those first.

### 1. Managed Postgres

Any managed Postgres works (Neon, Railway, RDS, ...) as long as it's reachable from both hosts
below. After creating it:

```bash
# The fuzzy-duplicate detection (Job title similarity) needs this extension — the app's own
# migrations create it if missing, but some managed providers restrict extension creation to a
# superuser step done once via their dashboard/CLI. Check your provider's docs if `migrate
# deploy` below fails specifically on this.
# CREATE EXTENSION IF NOT EXISTS "pg_trgm";

DATABASE_URL="<your production connection string>" pnpm --filter @ccc/db exec prisma migrate deploy
```

Run once, from your local machine, before the app is live. `migrate deploy` (not `migrate dev`)
is the non-interactive command meant for this — it applies pending migrations without prompting
or generating new ones.

### 2. Managed Redis

Any managed Redis works (Upstash, Railway, ...) — BullMQ just needs a `REDIS_URL` it can reach
from the worker. Vercel's serverless functions are stateless and don't run the worker, so `web`
only needs Redis to *enqueue* scrape jobs (Company/Career-source actions), not to consume them.

### 3. Environment variables (both `web` and `worker` need these)

| Variable | Production value |
|---|---|
| `DATABASE_URL` | The managed Postgres connection string from step 1 |
| `REDIS_URL` | The managed Redis connection string from step 2 |
| `ANTHROPIC_API_KEY` | Optional — enables the LLM-assisted job-link-import fallback tier — **web only** |

`worker` only needs `DATABASE_URL` and `REDIS_URL`.

### 4. `web` on Vercel

- Import the repo, set the project's **Root Directory** to `apps/web` (Vercel's pnpm-workspace
  detection installs the full monorepo regardless of root directory, but builds run from there).
- Prisma's client has to exist before `next build` runs, which a plain `next build` won't do on
  its own in a monorepo — override the **Build Command** to
  `cd ../.. && pnpm --filter @ccc/db generate && cd apps/web && next build` (adjust if Vercel's
  UI resolves relative paths differently than expected; verify against a real deploy).
- Set the environment variables from the table above (Production environment).
- Framework preset: Next.js (auto-detected).

### 5. `worker` on Railway/Fly/Render

All three support deploying directly from a Dockerfile, which `apps/worker/Dockerfile` already
is (and is now verified to actually build and run — see above). Point the service at the repo
root with `apps/worker/Dockerfile` as the Dockerfile path (the build needs the whole monorepo as
its context, not just `apps/worker/`, since it's a pnpm workspace). Set `DATABASE_URL` and
`REDIS_URL` from the table above. No port needs to be exposed — the worker doesn't serve HTTP
traffic, it only consumes the BullMQ queue and runs the 5-minute scheduler tick.

### 6. Verify

Load the deployed `web` URL and confirm the landing page and dashboard render with real data,
then add a company with a career-page URL and use "Scrape now" — if `worker` picks up the job
and a `ScrapeRun` row appears (Company detail → career sources panel shows a check timestamp),
the whole path is wired up correctly.
