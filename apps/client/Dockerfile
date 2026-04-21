FROM node:24.14-alpine
RUN npm install -g pnpm@10.33.0
WORKDIR /app

COPY . .
RUN pnpm install

EXPOSE 3000
CMD ["pnpm", "--filter", "client", "dev"]