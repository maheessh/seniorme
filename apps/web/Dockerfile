FROM node:22-alpine AS base
RUN corepack enable
# Pins and caches the exact pnpm version package.json's `packageManager` field specifies, at
# build time — without this, corepack lazily fetches it from the npm registry on first `pnpm`
# invocation, which for the `runner` stage means the *container's first startup*, not the build.
# That's a real-world reliability gap for a deployed container (a cold start now depends on the
# npm registry being reachable) for a fetch that's both deterministic and small enough to just
# bake in.
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
# final image or its layers. `next build` also needs it (every Server Component module
# constructs the Prisma client at import time, even though none of this app's routes are
# statically pre-rendered at build time, so it's never actually queried during the build).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime"
RUN pnpm --filter @ccc/db generate
RUN pnpm --filter @ccc/web build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@ccc/web", "start"]
