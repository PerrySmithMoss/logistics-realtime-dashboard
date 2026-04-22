FROM node:24.14-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@10.33.0

FROM base AS development

WORKDIR /app
COPY . .
RUN pnpm install

CMD ["pnpm", "--filter", "server", "dev"]

FROM base AS pruner
WORKDIR /app

RUN pnpm add -g turbo@2.9.6

COPY . .

RUN turbo prune server --docker

FROM base AS builder
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .

RUN pnpm turbo build --filter=server
RUN pnpm deploy --filter server --prod --legacy /prod/server

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

COPY --from=builder /prod/server/ ./
USER node
EXPOSE 5570

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5570/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
