FROM node:22-alpine AS base
RUN corepack enable
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

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
CMD ["pnpm", "--filter", "@ccc/worker", "start"]
