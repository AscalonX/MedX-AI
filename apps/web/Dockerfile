# Build from the REPO ROOT: docker build -f apps/web/Dockerfile .
# Uses explicit source copies: app-local .dockerignore does not filter root context.
FROM node:22-alpine AS dependencies
WORKDIR /app/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
COPY packages/shared /app/packages/shared
RUN npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules
COPY packages/shared ./packages/shared
COPY data/cases ./data/cases
COPY apps/web/app ./apps/web/app
COPY apps/web/components ./apps/web/components
COPY apps/web/lib ./apps/web/lib
COPY apps/web/public ./apps/web/public
COPY apps/web/package.json apps/web/package-lock.json apps/web/tsconfig.json apps/web/next-env.d.ts apps/web/next.config.ts apps/web/postcss.config.mjs apps/web/eslint.config.mjs ./apps/web/
WORKDIR /app/apps/web
# Lint runs in CI/dev; skip here so a lint nit never blocks the image (type check still runs).
RUN npx next build --turbopack --no-lint

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
RUN mkdir -p /app/apps/web/.data && chown -R nextjs:nodejs /app/apps/web/.data
ENV MEDX_STORE_PATH=/app/apps/web/.data/store.json
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
