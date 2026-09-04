FROM node:22-alpine AS base
RUN corepack enable
RUN corepack prepare pnpm@11.22.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/scraper/package.json packages/scraper/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# `prisma generate` only reads the schema to emit client code — it never connects — but
# prisma.config.ts's env("DATABASE_URL") throws if the var isn't resolvable at all, and the
# real value is deliberately not baked into the image (see runner stage below). A syntactically
# valid placeholder, scoped to this build stage only, satisfies that without it leaking into the
# final image or its layers.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter @ccc/db generate
# `build`'s tsc output isn't what actually runs (see `start` below) — this step exists purely as
# a build-time type-check gate, failing the image build on a type error rather than shipping one.
RUN pnpm --filter @ccc/worker build

# Career-page monitoring's headless-browser fallback tier (packages/scraper/src/adapters/
# headless.ts) needs a real Chromium binary at runtime. Playwright's bundled Chromium isn't
# supported on Alpine (musl libc), so the runner needs a Debian/Ubuntu base. Rather than
# Microsoft's official Playwright image (which bundles Chromium *and* Firefox *and* WebKit —
# ~1.5GB of browsers, most of it unused, and baked into that image's own layers where a later
# `rm -rf` can't shrink it back out: deleting a file in a later Docker layer only hides it, it
# doesn't remove it from the layers underneath), install only what's actually used: Chromium
# itself, plus its own OS-level dependencies via `--with-deps` (equivalent to what the official
# image's build does, minus the other two browsers).
FROM node:22-bookworm-slim AS runner
RUN corepack enable
# See the equivalent step in apps/web/Dockerfile's base stage — pins/caches pnpm at build time
# rather than leaving the container's first startup to fetch it from the npm registry. This
# stage is a fresh base (not built FROM the `base` stage above), so it needs its own copy.
RUN corepack prepare pnpm@11.22.0 --activate
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
RUN npx --prefix packages/scraper playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
CMD ["pnpm", "--filter", "@ccc/worker", "start"]
