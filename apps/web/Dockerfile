FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @ccc/db generate
RUN pnpm --filter @ccc/web build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@ccc/web", "start"]
