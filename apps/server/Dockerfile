ARG NODE_IMAGE=node:26.13.0-trixie-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072
ARG RUNTIME_IMAGE=node:26.13.0-alpine3.24@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
FROM ${NODE_IMAGE} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@12.18.0

FROM ${RUNTIME_IMAGE} AS development
RUN apk add --no-cache 'zlib>=1.4-r0' \
    && npm install -g pnpm@12.18.0 \
    && rm -rf /usr/local/lib/node_modules/npm /opt/yarn-* \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app

RUN chown node:node /app
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/client/package.json ./apps/client/
COPY --chown=node:node apps/server/package.json ./apps/server/
COPY --chown=node:node packages/common/package.json ./packages/common/
USER node
RUN pnpm install --frozen-lockfile
COPY --chown=node:node . .

CMD ["pnpm", "exec", "turbo", "dev", "--filter=server", "--env-mode=loose"]

FROM base AS pruner
WORKDIR /app

RUN npm install -g turbo@2.11.10

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

FROM ${RUNTIME_IMAGE} AS runner

# Require Alpine's patched zlib from the signed stable repositories.
# Run the built server without the package installers used by the build.
RUN apk add --no-cache 'zlib>=1.4-r0' \
    && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

COPY --from=builder /prod/server/ ./
USER node
EXPOSE 5570

# Wait for fleet data hydration before Swarm routes requests to this task.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --start-interval=1s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 5570) + '/health/ready').then(response => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "dist/index.js"]
