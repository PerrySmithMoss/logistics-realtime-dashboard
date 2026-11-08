ARG NODE_IMAGE=node:26.13.0-trixie-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072
FROM ${NODE_IMAGE} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@10.34.9

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

FROM ${NODE_IMAGE} AS runner
# Run the built server without the package installers used by the build.
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

COPY --from=builder /prod/server/ ./
USER node
EXPOSE 5570

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5570/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
