# Dockerfile para Backend
FROM node:18-alpine AS base

# Instalar dependências apenas quando necessário
FROM base AS deps
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependências
RUN npm ci

# Build da aplicação
FROM base AS builder
WORKDIR /app

# Copiar dependências instaladas
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build do TypeScript
RUN npm run build

# Produção - imagem final
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# OpenSSL 3 (Alpine ≥3.17); forçar engine Prisma compatível (evita carregar *-musl.so com libssl 1.1)
RUN apk add --no-cache openssl
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copiar arquivos necessários
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Copiar script de entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

RUN mkdir -p /app/uploads/medicos /app/uploads/documentos-enviados \
  && chown -R nodejs:nodejs /app/uploads

# Prisma (migrate deploy em runtime) precisa de escrever em node_modules/@prisma; sem isto migrações falham como user nodejs.
RUN chown -R nodejs:nodejs /app

# Mudar para usuário não-root
USER nodejs

# Expor porta (Render usa a variável PORT)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Usar entrypoint para executar migrações antes de iniciar
ENTRYPOINT ["./docker-entrypoint.sh"]
