FROM node:26.13.0-alpine3.24@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
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

EXPOSE 3000
CMD ["pnpm", "exec", "turbo", "dev", "--filter=client", "--env-mode=loose"]
