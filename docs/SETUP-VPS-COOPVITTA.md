# Setup completo da VPS COOPVITTA

Guia técnico passo a passo para montar **toda a infraestrutura** da COOPVITTA em um servidor dedicado, separado da VPS da Viva Saúde.

| Item | Valor |
|------|-------|
| **Repositório deste guia** | [cadastro-interativo-coop](https://github.com/viniciusfeitosaa/cadastro-interativo-coop) |
| **App principal (fork)** | [gymapp](https://github.com/viniciusfeitosaa/gymapp) → renomear/adaptar como `coopvitta-app` |
| **Formulário de pré-cadastro** | Este repositório (`cadastro-interativo-coop`) |
| **Assinaturas digitais** | [DocuSeal](https://www.docuseal.com/) (self-hosted) |
| **VPS Viva Saúde** | Permanece só com AppVS + infra atual — **não** duplicar stacks na mesma máquina |

---

## Índice

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Requisitos da VPS](#2-requisitos-da-vps)
3. [Preparação inicial do servidor](#3-preparação-inicial-do-servidor)
4. [Estrutura de diretórios](#4-estrutura-de-diretórios)
5. [Rede Docker compartilhada](#5-rede-docker-compartilhada)
6. [Infra base: Nginx Proxy Manager + Maddy](#6-infra-base-nginx-proxy-manager--maddy)
7. [Fork do gymapp → coopvitta-app](#7-fork-do-gymapp--coopvitta-app)
8. [Adaptar o gymapp para NPM (sem Caddy na porta 80)](#8-adaptar-o-gymapp-para-npm-sem-caddy-na-porta-80)
9. [Cadastro interativo (este projeto)](#9-cadastro-interativo-este-projeto)
10. [DocuSeal](#10-docuseal)
11. [DNS e domínios](#11-dns-e-domínios)
12. [Configurar hosts no NPM + SSL](#12-configurar-hosts-no-npm--ssl)
13. [Variáveis de ambiente (referência)](#13-variáveis-de-ambiente-referência)
14. [Ordem de deploy (primeira vez)](#14-ordem-de-deploy-primeira-vez)
15. [Backups e manutenção](#15-backups-e-manutenção)
16. [Deploy contínuo (atualizações)](#16-deploy-contínuo-atualizações)
17. [O que remover da VPS Viva Saúde](#17-o-que-remover-da-vps-viva-saúde)
18. [Checklist de validação](#18-checklist-de-validação)
19. [Troubleshooting](#19-troubleshooting)
20. [Estimativa de recursos](#20-estimativa-de-recursos)

---

## 1. Visão geral da arquitetura

```
                         Internet
                             │
                    ┌────────▼────────┐
                    │  DNS (A records) │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │   Nginx Proxy Manager       │
              │   :80 / :443 / painel :81   │
              │   (rede: proxy-network)     │
              └──────────────┬──────────────┘
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼─────┐      ┌──────▼──────┐     ┌─────▼──────┐
    │ coopvitta│      │  cadastro-  │     │  DocuSeal  │
    │   -app   │      │ interativo  │     │  (app +    │
    │          │      │    -coop    │     │  sidekiq + │
    │ front    │      │  :3080      │     │  postgres) │
    │ :8082    │      └─────────────┘     └────────────┘
    │ back     │
    │ :3001    │
    │ postgres │
    │ (interno)│
    └────┬─────┘
         │
    ┌────▼─────┐
    │  Maddy   │  SMTP :587 (e-mails transacionais)
    │ (interno)│
    └──────────┘
```

### Serviços e portas internas (host)

| Serviço | Container | Porta no host | Domínio sugerido |
|---------|-----------|---------------|------------------|
| NPM (proxy + SSL) | `nginx-proxy-manager` | 80, 443, 81 | — |
| Maddy (SMTP) | `maddy` | 25, 587, 465 | `mail.coopvitta.com.br` |
| App COOPVITTA — frontend | `coopvitta-frontend` | `8082` | `app.coopvitta.com.br` |
| App COOPVITTA — backend | `coopvitta-backend` | `3001` | `api.coopvitta.com.br` ou `/api` |
| App COOPVITTA — Postgres | `coopvitta-postgres` | **não publicar** | — |
| Cadastro interativo | `cadastro-interativo-coop` | `3080` | `cadastro.coopvitta.com.br` |
| DocuSeal | `docuseal-app` | interno (via NPM) | `assinaturas.coopvitta.com.br` |
| DocuSeal Sidekiq | `docuseal-sidekiq` | — (rede do app) | — |
| DocuSeal Postgres | `docuseal-postgres` | **não publicar** | — |

> **Importante:** Postgres **nunca** deve ter porta publicada na internet. Apenas containers na rede interna acessam o banco.

### Por que fork do gymapp?

O repositório [gymapp](https://github.com/viniciusfeitosaa/gymapp) já traz:

- `docker-compose.prod.yml` com Postgres, backend Node/Prisma, frontend React/Vite
- Scripts `make setup`, `make backup`, `make update`
- Integração SMTP via Maddy
- Health checks e volumes persistentes

Na VPS COOPVITTA você fará um **fork**, renomeará para `coopvitta-app` e adaptará branding, domínios e regras de negócio. A **referência funcional** para módulos médicos (escalas, plantões, contratos, relatórios) continua sendo o AppVS na VPS Viva Saúde — porte módulo a módulo conforme a COOPVITTA precisar.

---

## 2. Requisitos da VPS

### Mínimo recomendado

| Recurso | Mínimo | Ideal |
|---------|--------|-------|
| RAM | 8 GB | 16 GB |
| vCPU | 2 | 4 |
| Disco | 80 GB SSD | 160 GB SSD |
| SO | Ubuntu 22.04 ou 24.04 LTS | — |
| Swap | 2 GB (criar manualmente) | 4 GB |

### Por que não cabe na VPS da Viva Saúde?

Na VPS atual (8 GB, 2 vCPUs, sem swap) já rodam AppVS + DocuSeal + NPM + Maddy + cadastro. Duplicar a stack inteira ≈ **consumo × 2** e não deixa margem para picos (Sidekiq, relatórios, deploys).

---

## 3. Preparação inicial do servidor

Conecte via SSH como root ou usuário com sudo:

```bash
ssh usuario@IP_DA_VPS_COOP
```

### 3.1 Atualizar sistema e utilitários

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git ufw fail2ban htop unzip
```

### 3.2 Criar usuário de deploy (recomendado)

```bash
sudo adduser coopdeploy
sudo usermod -aG sudo coopdeploy
sudo usermod -aG docker coopdeploy   # após instalar Docker
```

Use esse usuário para clonar repositórios e rodar `docker compose`.

### 3.3 Instalar Docker Engine + Compose plugin

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
# Faça logout/login para o grupo docker valer
```

Verifique:

```bash
docker --version
docker compose version
```

### 3.4 Swap (obrigatório em VPS de 8 GB)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### 3.5 Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 81/tcp    # painel NPM — restrinja por IP depois se possível
# SMTP: só se for receber e-mail externo na VPS
sudo ufw allow 587/tcp
sudo ufw enable
sudo ufw status
```

> **Não abra** portas `3001`, `3080`, `8082`, `5432` publicamente. O NPM faz o proxy.

### 3.6 Diretório base

```bash
sudo mkdir -p /opt/coopvitta
sudo chown -R $USER:$USER /opt/coopvitta
cd /opt/coopvitta
```

---

## 4. Estrutura de diretórios

Layout final sugerido:

```
/opt/coopvitta/
├── infra/                          # NPM + Maddy
│   ├── docker-compose.yml
│   ├── maddy/
│   │   └── certs/                  # PEM do Let's Encrypt (sync do NPM)
│   └── nginx-proxy-manager/
│       ├── data/
│       └── letsencrypt/
├── coopvitta-app/                  # fork do gymapp
│   ├── .env
│   ├── docker-compose.prod.yml     # adaptado (sem Caddy na :80)
│   ├── backend/
│   ├── frontend/
│   └── backups/
├── cadastro-interativo-coop/       # este repositório
│   ├── .env
│   └── docker-compose.yml
└── docuseal/
    ├── .env
    ├── docker-compose.yml
    ├── docuseal_data/
    └── pg_data/
```

---

## 5. Rede Docker compartilhada

Todos os serviços expostos via NPM devem estar na mesma rede externa:

```bash
docker network create proxy-network
```

Verifique:

```bash
docker network ls | grep proxy-network
```

---

## 6. Infra base: Nginx Proxy Manager + Maddy

### 6.1 Clonar estrutura de infra

Na VPS Viva Saúde a infra está em `~/Desktop/docker/`. Na VPS COOP, crie equivalente:

```bash
cd /opt/coopvitta
mkdir -p infra/nginx-proxy-manager/{data,letsencrypt}
mkdir -p infra/maddy/certs
```

Crie `/opt/coopvitta/infra/docker-compose.yml`:

```yaml
services:
  maddy:
    image: foxcpp/maddy:0.7
    container_name: maddy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 80M
    environment:
      MADDY_HOSTNAME: ${MADDY_HOSTNAME:-mail.coopvitta.com.br}
      MADDY_DOMAIN: ${MADDY_DOMAIN:-coopvitta.com.br}
    volumes:
      - maddydata:/data
      - ./maddy/certs:/data/tls:ro
    ports:
      - "25:25"
      - "587:587"
      - "465:465"
    networks:
      - default
      - proxy-network

  nginx-proxy-manager:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 384M
    ports:
      - "80:80"
      - "81:81"
      - "443:443"
    volumes:
      - ./nginx-proxy-manager/data:/data
      - ./nginx-proxy-manager/letsencrypt:/etc/letsencrypt
    networks:
      - default
      - proxy-network

networks:
  proxy-network:
    external: true

volumes:
  maddydata:
```

Crie `/opt/coopvitta/infra/.env`:

```env
MADDY_HOSTNAME=mail.coopvitta.com.br
MADDY_DOMAIN=coopvitta.com.br
```

Suba:

```bash
cd /opt/coopvitta/infra
docker compose up -d
```

Painel NPM: `http://IP_DA_VPS:81`

- Login inicial padrão: `admin@example.com` / `changeme`
- **Altere a senha imediatamente**

### 6.2 Certificados TLS para o Maddy

O Maddy precisa dos mesmos PEM emitidos pelo Let's Encrypt (via NPM). Após criar o proxy host com SSL para `mail.coopvitta.com.br`, copie/sincronize os certificados para `infra/maddy/certs/` (fullchain + privkey em arquivos reais, não symlinks quebrados dentro do container).

Padrão usado na VPS Viva Saúde: script `sync-maddy-certs.sh` que lê de `nginx-proxy-manager/letsencrypt/live/...` e grava em `maddy/certs/`.

---

## 7. Fork do gymapp → coopvitta-app

### 7.1 Criar o fork no GitHub

1. Acesse https://github.com/viniciusfeitosaa/gymapp
2. **Fork** → nome sugerido: `coopvitta-app` (organização ou conta COOPVITTA)
3. Ou clone e crie repositório novo:

```bash
cd /opt/coopvitta
git clone https://github.com/viniciusfeitosaa/gymapp.git coopvitta-app
cd coopvitta-app
git remote rename origin upstream
git remote add origin https://github.com/SUA_ORG/coopvitta-app.git
```

### 7.2 Primeiro setup na VPS

```bash
cd /opt/coopvitta/coopvitta-app
cp .env.example .env
```

Gere segredos:

```bash
openssl rand -hex 64    # JWT_SECRET
openssl rand -base64 32 # POSTGRES_PASSWORD
openssl rand -base64 16 # MADDY_SMTP_PASS / SMTP_PASS
```

Edite `.env` (ver [seção 13](#13-variáveis-de-ambiente-referência)).

### 7.3 Build e migrations

```bash
# Primeira subida (após adaptar compose — seção 8)
docker compose -f docker-compose.prod.yml up -d --build

# Migrations Prisma (dentro do container backend)
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Seed inicial se existir
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

### 7.4 Customizações COOPVITTA no código

| Área | O que alterar |
|------|---------------|
| Branding | Logo, cores, textos no `frontend/` |
| Domínios | `.env`, `FRONTEND_URL`, `VITE_*` |
| Modelos Prisma | Adaptar de Personal/Student para perfis COOPVITTA |
| E-mail | Remetente `noreply@coopvitta.com.br` |
| Módulos médicos | Portar do AppVS conforme necessidade (escalas, contratos, etc.) |

---

## 8. Adaptar o gymapp para NPM (sem Caddy na porta 80)

O `docker-compose.prod.yml` original do gymapp sobe **Caddy na porta 80**, o que conflita com o NPM. Na VPS COOPVITTA:

1. **Remova** (ou coloque em `profiles: [local]`) os serviços `caddy` e `cloudflared`
2. **Publique** frontend e backend em portas internas do host
3. **Conecte** ambos à `proxy-network`

Exemplo de override: crie `docker-compose.vps.yml`:

```yaml
# Uso: docker compose -f docker-compose.prod.yml -f docker-compose.vps.yml up -d --build

services:
  caddy:
    profiles: ["disabled"]

  cloudflared:
    profiles: ["disabled"]

  postgres:
    container_name: coopvitta-postgres
    networks:
      - coopvitta-internal

  backend:
    container_name: coopvitta-backend
    ports:
      - "3001:3001"
    networks:
      - coopvitta-internal
      - proxy-network

  frontend:
    container_name: coopvitta-frontend
    ports:
      - "8082:80"
    networks:
      - coopvitta-internal
      - proxy-network

networks:
  coopvitta-internal:
    name: coopvitta-internal
  proxy-network:
    external: true
```

Comando de produção:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.vps.yml up -d --build
```

### Roteamento no NPM

**Opção A — subdomínios (recomendado):**

| Host | Forward |
|------|---------|
| `app.coopvitta.com.br` | `http://coopvitta-frontend:80` ou `http://127.0.0.1:8082` |
| `api.coopvitta.com.br` | `http://coopvitta-backend:3001` ou `http://127.0.0.1:3001` |

No `.env` do app:

```env
FRONTEND_URL=https://app.coopvitta.com.br
VITE_API_URL=https://api.coopvitta.com.br
ALLOWED_ORIGINS=https://app.coopvitta.com.br
```

**Opção B — mesmo domínio com `/api`:**

Configure custom locations no NPM ou um nginx intermediário. A opção A é mais simples de manter.

---

## 9. Cadastro interativo (este projeto)

### 9.1 Clonar

```bash
cd /opt/coopvitta
git clone https://github.com/viniciusfeitosaa/cadastro-interativo-coop.git
cd cadastro-interativo-coop
```

### 9.2 Configurar `.env`

```bash
cp .env.example .env
chmod 600 .env
```

```env
PORT=3080
ADMIN_PASSWORD=<senha-forte-admin>
JWT_SECRET=<openssl rand -hex 64>

# Cloudflare R2 (uploads fora da VPS — recomendado)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=coopvitta-cadastros
R2_KEY_PREFIX=cadastros
R2_PUBLIC_BASE_URL=https://pub-XXXX.r2.dev

MAX_UPLOAD_BYTES=10485760
```

### 9.3 Criar bucket R2 (Cloudflare)

1. Dashboard Cloudflare → R2 → Create bucket
2. API Tokens → R2 → Read/Write no bucket
3. (Opcional) Public access / custom domain para `R2_PUBLIC_BASE_URL`
4. Preencha as variáveis no `.env`

Sem R2, o serviço sobe mas `/health` retorna `storageConfigured: false` e uploads falham.

### 9.4 Subir container

```bash
docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1:3080/health | jq .
```

### 9.5 NPM

| Host | Forward | SSL |
|------|---------|-----|
| `cadastro.coopvitta.com.br` | `http://127.0.0.1:3080` | Let's Encrypt |

URLs:

- Formulário: `https://cadastro.coopvitta.com.br`
- Admin: `https://cadastro.coopvitta.com.br/admin/login`

### 9.6 Dados persistentes

O volume `cadastro_data` guarda `server/data/cadastros.json`. Arquivos ficam no R2 quando configurado.

Backup do JSON:

```bash
docker cp cadastro-interativo-coop:/app/server/data/cadastros.json \
  ~/backups/cadastros-$(date +%Y%m%d).json
```

---

## 10. DocuSeal

### 10.1 Estrutura

```bash
cd /opt/coopvitta
mkdir -p docuseal
cd docuseal
```

Crie `docker-compose.yml` (baseado na stack validada na VPS Viva Saúde):

```yaml
x-docuseal-env: &docuseal-env
  FORCE_SSL: ${DOCUSEAL_HOST}
  WEB_CONCURRENCY: ${DOCUSEAL_WEB_CONCURRENCY:-1}
  DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@docuseal-postgres:5432/docuseal
  SMTP_ADDRESS: ${SMTP_ADDRESS}
  SMTP_PORT: ${SMTP_PORT:-587}
  SMTP_DOMAIN: ${SMTP_DOMAIN}
  SMTP_USERNAME: ${SMTP_USERNAME}
  SMTP_PASSWORD: ${SMTP_PASSWORD}
  SMTP_FROM: ${SMTP_FROM}
  SMTP_AUTHENTICATION: ${SMTP_AUTHENTICATION:-plain}
  SMTP_ENABLE_STARTTLS: ${SMTP_ENABLE_STARTTLS:-true}
  SMTP_SSL_VERIFY: ${SMTP_SSL_VERIFY:-false}

services:
  docuseal-app:
    container_name: docuseal-app
    image: docuseal/docuseal:latest
    restart: unless-stopped
    depends_on:
      docuseal-postgres:
        condition: service_healthy
    environment:
      <<: *docuseal-env
    volumes:
      - ./docuseal_data:/data/docuseal
    networks:
      - proxy-network
      - docuseal-internal
    deploy:
      resources:
        limits:
          memory: 400M

  docuseal-sidekiq:
    container_name: docuseal-sidekiq
    image: docuseal/docuseal:latest
    restart: unless-stopped
    depends_on:
      - docuseal-app
    network_mode: service:docuseal-app
    environment:
      <<: *docuseal-env
    volumes:
      - ./docuseal_data:/data/docuseal
    working_dir: /app
    command: ['bundle', 'exec', 'sidekiq', '-C', 'config/sidekiq.yml']
    deploy:
      resources:
        limits:
          memory: 256M

  docuseal-postgres:
    container_name: docuseal-postgres
    image: postgres:18
    restart: unless-stopped
    command:
      - postgres
      - -c
      - shared_buffers=96MB
      - -c
      - max_connections=40
      - -c
      - work_mem=4MB
      - -c
      - effective_cache_size=256MB
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: docuseal
    volumes:
      - ./pg_data:/var/lib/postgresql/18/docker
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - docuseal-internal
    deploy:
      resources:
        limits:
          memory: 256M

networks:
  proxy-network:
    external: true
  docuseal-internal:
    driver: bridge
```

### 10.2 `.env` do DocuSeal

```bash
cp .env.example .env   # crie o example abaixo se não existir
chmod 600 .env
```

```env
DOCUSEAL_HOST=https://assinaturas.coopvitta.com.br
POSTGRES_PASSWORD=<openssl rand -base64 32>

SMTP_ADDRESS=maddy
SMTP_PORT=587
SMTP_DOMAIN=mail.coopvitta.com.br
SMTP_USERNAME=noreply@coopvitta.com.br
SMTP_PASSWORD=<mesma senha SMTP do Maddy>
SMTP_FROM=COOPVITTA <noreply@coopvitta.com.br>
SMTP_AUTHENTICATION=plain
SMTP_ENABLE_STARTTLS=true
SMTP_SSL_VERIFY=false
```

> O hostname `maddy` resolve porque o container DocuSeal está na `proxy-network` junto com o Maddy.

### 10.3 Subir

```bash
docker compose up -d
docker compose ps
docker stats --no-stream docuseal-app docuseal-sidekiq docuseal-postgres
```

### 10.4 NPM

| Host | Forward | Websockets |
|------|---------|------------|
| `assinaturas.coopvitta.com.br` | `http://docuseal-app:3000` | Ativar no NPM |

No painel DocuSeal, configure a URL pública igual a `DOCUSEAL_HOST`.

### 10.5 Primeiro acesso

1. Acesse `https://assinaturas.coopvitta.com.br`
2. Crie o usuário administrador
3. Teste envio de convite de assinatura (valida SMTP + Sidekiq)

---

## 11. DNS e domínios

No registrador (Registro.br, Cloudflare, etc.), aponte para o **IP da VPS COOP**:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `@` ou `coopvitta.com.br` | `IP_VPS_COOP` |
| A | `www` | `IP_VPS_COOP` |
| A | `app` | `IP_VPS_COOP` |
| A | `api` | `IP_VPS_COOP` |
| A | `cadastro` | `IP_VPS_COOP` |
| A | `assinaturas` | `IP_VPS_COOP` |
| A | `mail` | `IP_VPS_COOP` |

Aguarde propagação (minutos a algumas horas) antes de emitir SSL no NPM.

### SPF / DKIM (e-mail)

Configure registros DNS para o domínio de envio (`coopvitta.com.br`) conforme documentação do Maddy/relay. Se a operadora bloquear porta 25, use relay SMTP (Brevo, SendGrid, etc.) no Maddy.

---

## 12. Configurar hosts no NPM + SSL

Para **cada** domínio:

1. NPM → **Hosts** → **Proxy Hosts** → **Add Proxy Host**
2. **Domain Names:** ex. `cadastro.coopvitta.com.br`
3. **Forward Hostname / IP:** `127.0.0.1` ou nome do container na `proxy-network`
4. **Forward Port:** porta interna (3080, 8082, 3001, 3000)
5. **Block Common Exploits:** ON
6. Aba **SSL:** Request a new SSL Certificate → Force SSL → HTTP/2

Repita para:

- `app.coopvitta.com.br` → 8082
- `api.coopvitta.com.br` → 3001
- `cadastro.coopvitta.com.br` → 3080
- `assinaturas.coopvitta.com.br` → 3000 (DocuSeal)
- `mail.coopvitta.com.br` → (conforme config Maddy)

---

## 13. Variáveis de ambiente (referência)

### coopvitta-app (`/opt/coopvitta/coopvitta-app/.env`)

```env
# Domínio
FRONTEND_URL=https://app.coopvitta.com.br
VITE_API_URL=https://api.coopvitta.com.br
VITE_APP_URL=https://app.coopvitta.com.br

# Postgres
POSTGRES_USER=coopvitta
POSTGRES_PASSWORD=<forte>
POSTGRES_DB=coopvitta

# Backend
NODE_ENV=production
JWT_SECRET=<forte>
APP_TIMEZONE=America/Sao_Paulo

# SMTP (Maddy na infra)
SMTP_HOST=maddy
SMTP_PORT=587
SMTP_USER=noreply@coopvitta.com.br
SMTP_PASS=<forte>
SMTP_FROM=noreply@coopvitta.com.br
MADDY_SMTP_PASS=<forte>

# Desabilitar tunnel Cloudflare na VPS com IP público
USE_CLOUDFLARE_TUNNEL=0
```

### cadastro-interativo-coop

Ver [seção 9.2](#92-configurar-env).

### docuseal

Ver [seção 10.2](#102-env-do-docuseal).

---

## 14. Ordem de deploy (primeira vez)

Execute nesta ordem:

```bash
# 1. Rede
docker network create proxy-network

# 2. Infra (NPM + Maddy)
cd /opt/coopvitta/infra && docker compose up -d

# 3. Configurar DNS (seção 11) — pode fazer em paralelo

# 4. App principal
cd /opt/coopvitta/coopvitta-app
docker compose -f docker-compose.prod.yml -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 5. Cadastro
cd /opt/coopvitta/cadastro-interativo-coop
docker compose up -d --build

# 6. DocuSeal
cd /opt/coopvitta/docuseal
docker compose up -d

# 7. NPM — criar todos os proxy hosts + SSL (seção 12)

# 8. Sync certs Maddy (se usar TLS no SMTP)

# 9. Testes (seção 18)
```

---

## 15. Backups e manutenção

### 15.1 Postgres do app (`coopvitta-app`)

Use o script do gymapp:

```bash
cd /opt/coopvitta/coopvitta-app
make backup
# ou: ./scripts/backup-db.sh
```

Agende cron diário:

```cron
0 3 * * * cd /opt/coopvitta/coopvitta-app && ./scripts/backup-db.sh >> /var/log/coopvitta-backup.log 2>&1
```

### 15.2 Postgres do DocuSeal

```bash
#!/bin/bash
# /opt/coopvitta/scripts/backup-docuseal.sh
set -euo pipefail
source /opt/coopvitta/docuseal/.env
STAMP=$(date +%Y%m%d-%H%M%S)
OUT=~/backups/docuseal-${STAMP}.dump
mkdir -p ~/backups
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" docuseal-postgres \
  pg_dump -U postgres -d docuseal -Fc -f /tmp/b.dump
docker cp docuseal-postgres:/tmp/b.dump "$OUT"
docker exec docuseal-postgres rm -f /tmp/b.dump
echo "Backup: $OUT"
```

### 15.3 Cadastros JSON + R2

- JSON: `docker cp` periódico (seção 9.6)
- R2: versionamento/lifecycle no bucket Cloudflare

### 15.4 Copiar backups para fora da VPS

Use `rclone`, S3, outro servidor ou máquina local — **nunca** deixe só na VPS.

### 15.5 Atualizações de sistema

```bash
sudo apt update && sudo apt upgrade -y
docker system prune -f   # cuidado: não use -a sem revisar
```

---

## 16. Deploy contínuo (atualizações)

### App principal

```bash
cd /opt/coopvitta/coopvitta-app
git fetch origin main
git reset --hard origin/main
docker compose -f docker-compose.prod.yml -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Cadastro interativo

```bash
cd /opt/coopvitta/cadastro-interativo-coop
git pull origin main
docker compose up -d --build
```

### DocuSeal

```bash
cd /opt/coopvitta/docuseal
docker compose pull
docker compose up -d
```

---

## 17. O que remover da VPS Viva Saúde

Após validar tudo na VPS COOP:

| Item | Ação na VPS Viva Saúde |
|------|------------------------|
| `cadastro-interativo-coop` | `docker compose down` e remover do NPM |
| DNS `cadastro.*` apontando para IP Viva Saúde | Atualizar para IP COOP |
| DocuSeal COOP (se existir cópia) | Manter só o da Viva Saúde se for exclusivo Viva Saúde |
| Dados de cadastro | Exportar antes de desligar (`cadastros.json` + R2) |

**Manter na VPS Viva Saúde:** AppVS, DocuSeal Viva Saúde (se aplicável), NPM, Maddy, domínios `sejavivasaude.com.br` / `vivasaude.cloud`.

---

## 18. Checklist de validação

### Infra

- [ ] `docker ps` — todos os containers `Up` (healthy quando aplicável)
- [ ] `free -h` — RAM disponível > 1,5 GB em idle
- [ ] UFW ativo; portas sensíveis fechadas
- [ ] Swap ativo

### NPM + SSL

- [ ] Todos os domínios abrem em HTTPS sem aviso
- [ ] HTTP redireciona para HTTPS

### coopvitta-app

- [ ] `curl -s https://api.coopvitta.com.br/health` → 200
- [ ] Login / fluxo principal funciona
- [ ] E-mail de teste (reset senha) chega

### cadastro-interativo-coop

- [ ] `curl -s https://cadastro.coopvitta.com.br/health` → `storageConfigured: true`
- [ ] Envio de formulário teste com upload
- [ ] Login admin e listagem de cadastros

### DocuSeal

- [ ] Painel admin acessível
- [ ] Criar template + enviar para assinatura
- [ ] E-mail de convite recebido (Sidekiq processando)
- [ ] Assinatura concluída e PDF gerado

---

## 19. Troubleshooting

### Container reinicia / OOM (sem memória)

```bash
dmesg | tail -20          # ver kills por OOM
docker stats --no-stream
```

Solução: aumentar RAM da VPS, adicionar swap, ou reduzir `memory` limits do DocuSeal.

### NPM — 502 Bad Gateway

- Container alvo está rodando? `docker ps`
- Porta correta no proxy host?
- App na `proxy-network`? `docker network inspect proxy-network`

### CORS no app

Confirme `FRONTEND_URL` e `ALLOWED_ORIGINS` / `CORS_ORIGINS` com o domínio HTTPS exato.

### DocuSeal — e-mails não saem

```bash
docker logs docuseal-sidekiq --tail 100
docker logs maddy --tail 50
```

Verifique `SMTP_ADDRESS=maddy`, credenciais e se Sidekiq está `Up`.

### Cadastro — upload falha

```bash
curl -s http://127.0.0.1:3080/health
```

Se `storageConfigured: false`, revise credenciais R2.

### SSL não emite no NPM

- DNS propagado? `dig +short cadastro.coopvitta.com.br`
- Porta 80 acessível da internet?
- Domínio aponta para o IP **desta** VPS (não o da Viva Saúde)

---

## 20. Estimativa de recursos

| Stack | RAM em uso (idle) | Limite Docker |
|-------|-------------------|---------------|
| NPM + Maddy | ~150 MB | ~464 MB |
| coopvitta-app (3 containers) | ~150–400 MB | ~2 GB |
| cadastro-interativo-coop | ~20 MB | 256 MB |
| DocuSeal (3 containers) | ~500 MB | ~912 MB |
| SO + margem | ~500 MB | — |
| **Total estimado** | **~1,3–1,6 GB** | **~3,6 GB limits** |

Em picos (build, PDF, filas Sidekiq): planeje **8 GB RAM + 2 GB swap** como mínimo realista.

---

## Referências

- [gymapp — HOMELAB_SETUP.md](https://github.com/viniciusfeitosaa/gymapp/blob/main/HOMELAB_SETUP.md)
- [gymapp — docker-compose.prod.yml](https://github.com/viniciusfeitosaa/gymapp/blob/main/docker-compose.prod.yml)
- [cadastro-interativo-coop — README](../README.md)
- [DocuSeal — Docker](https://www.docuseal.com/docs/install/docker)
- [Nginx Proxy Manager](https://nginxproxymanager.com/)

---

*Documento mantido em `docs/SETUP-VPS-COOPVITTA.md`. Atualize este arquivo quando a infra evoluir.*
