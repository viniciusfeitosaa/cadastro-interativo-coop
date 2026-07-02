# Dockerfile na raiz para Render (build context = raiz do repo)
# Build do backend Viva Saúde
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY backend/package*.json backend/tsconfig.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL para o Prisma schema engine (Alpine usa OpenSSL 3)
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Donar /app ao nodejs para prisma migrate deploy poder escrever em node_modules
RUN chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["./docker-entrypoint.sh"]
