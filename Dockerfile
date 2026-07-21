# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts \
  && DATABASE_URL=postgresql://build:build-password@localhost:5432/build?schema=public npm run postinstall

FROM deps AS builder
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_ENABLE_PUBLIC_DEMO=false
ARG NEXT_PUBLIC_WEBSOCKET_URL=
ENV NODE_ENV=production \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_ENABLE_PUBLIC_DEMO=${NEXT_PUBLIC_ENABLE_PUBLIC_DEMO} \
    NEXT_PUBLIC_WEBSOCKET_URL=${NEXT_PUBLIC_WEBSOCKET_URL} \
    DATABASE_URL=postgresql://build:build-password@localhost:5432/build?schema=public \
    REDIS_URL=redis://:build-redis-password@localhost:6379/0 \
    ADMIN_TOKEN=build-only-token-0000000000000000
COPY . .
RUN npm run build

FROM deps AS production-deps
RUN npm prune --omit=dev

FROM base AS web-runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]

FROM base AS worker-runtime
ENV NODE_ENV=production
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/worker ./worker
COPY --from=builder --chown=node:node /app/lib ./lib
USER node
EXPOSE 9101 9102 3002
CMD ["node", "node_modules/tsx/dist/cli.mjs", "worker/ingestWorker.ts"]

FROM deps AS migrate
ENV NODE_ENV=production
USER node
CMD ["npm", "run", "db:migrate"]

# Un build sin --target debe producir la aplicación web, no el job de migración.
FROM web-runtime AS production
