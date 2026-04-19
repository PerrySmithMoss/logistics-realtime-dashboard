FROM node:24.14-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json

RUN pnpm install --filter server... --frozen-lockfile

COPY apps/server ./apps/server

RUN pnpm --filter server build

FROM base AS runner

ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json

RUN pnpm install --filter server --prod --frozen-lockfile --ignore-scripts

COPY --from=builder /app/apps/server/dist ./apps/server/dist

WORKDIR /app/apps/server

USER node

EXPOSE 5500

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5500/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
