FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
RUN npm install -g pnpm@10.33.0
WORKDIR /app

COPY . .
RUN pnpm install

EXPOSE 3000
CMD ["pnpm", "--filter", "client", "dev"]