# Savastano Advisory — production Docker image
# Multi-stage build: install → build → slim runtime

# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
RUN npm ci --ignore-scripts

# --- Stage 2: Build ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN npm run build -w @savastano-advisory/web

# --- Stage 3: Runtime ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /data/uploads && \
    chown -R nextjs:nodejs /data

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Copy public folder (if exists)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
# Copy project.yaml (needed by findRepoRoot fallback; also used by verifiers)
COPY --from=builder --chown=nextjs:nodejs /app/project.yaml ./project.yaml

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
