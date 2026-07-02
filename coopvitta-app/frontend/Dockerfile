# Build a partir da raiz do repositório (coopvitta-app)
# docker compose: context: . , dockerfile: frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_BASE=/

RUN test -n "$VITE_API_URL" || (echo "Defina VITE_API_URL no .env na raiz (ex.: http://IP:3001/api)" >&2 && exit 1)

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
