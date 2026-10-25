# syntax=docker/dockerfile:1.7
# ── Lathe · production image ──────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/lathe.db
RUN groupadd -r lathe && useradd -r -g lathe lathe && mkdir -p /app/data && chown lathe:lathe /app/data
COPY --from=build --chown=lathe:lathe /app/.next/standalone ./
COPY --from=build --chown=lathe:lathe /app/.next/static ./.next/static
COPY --from=build --chown=lathe:lathe /app/public ./public
COPY --from=build --chown=lathe:lathe /app/drizzle ./drizzle
USER lathe
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server.js"]
