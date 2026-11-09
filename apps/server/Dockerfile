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
# Require the DSA-6613-1 zlib fix from Debian's signed repositories.
RUN apt-get update \
    && apt-get install -y --no-install-recommends zlib1g \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' zlib1g)" ge '1:1.3.dfsg+really1.3.1-1+deb13u1' \
    && rm -rf /var/lib/apt/lists/*

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

# Wait for fleet data hydration before Swarm routes requests to this task.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --start-interval=1s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 5570) + '/health/ready').then(response => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "dist/index.js"]
