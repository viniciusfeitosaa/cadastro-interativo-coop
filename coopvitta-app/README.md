# 🏥 Viva Saúde - Sistema Profissional

Sistema completo para médicos com autenticação via CPF e CRM, dashboard personalizado e arquitetura segura.

## 📋 Sobre o Projeto

Aplicação profissional desenvolvida para médicos, com foco em segurança, conformidade com LGPD e arquitetura escalável.

### Características Principais

- ✅ Autenticação segura (CPF + CRM)
- ✅ Dashboard personalizado
- ✅ Arquitetura Docker
- ✅ Banco de dados externo (PostgreSQL)
- ✅ Conformidade LGPD
- ✅ Deploy em VPS

## 🏗️ Arquitetura

```
┌─────────────┐
│   Nginx     │ (Reverse Proxy + SSL)
└──────┬──────┘
       │
   ┌───┴───┬──────────────┐
   │       │              │
┌──▼──┐ ┌──▼──┐    ┌──────▼──────┐
│Front│ │Back │    │  PostgreSQL │
│end  │ │end  │    │  (EXTERNO)  │
└─────┘ └─────┘    └─────────────┘
```

## 🚀 Tecnologias

### Frontend
- React / Next.js
- TypeScript
- Tailwind CSS
- React Query
- React Router

### Backend
- Node.js
- Express / NestJS
- TypeScript
- Prisma ORM
- JWT Authentication

### Infraestrutura
- Docker & Docker Compose
- Nginx
- PostgreSQL (externo)
- VPS

## 📁 Estrutura do Projeto

```
app-medico/
├── frontend/          # Aplicação React/Next.js
├── backend/           # API Node.js
├── docker/            # Configurações Docker
├── PLANO_PROJETO.md   # Plano detalhado
└── GUIA_IMPLEMENTACAO.md # Guia passo a passo
```

## 🔐 Segurança

- Criptografia de dados sensíveis
- JWT com refresh tokens
- Rate limiting
- Validação rigorosa de inputs
- Logs de auditoria
- Conformidade LGPD

## 📚 Documentação

- **[`contexto/`](./contexto/)** — Harness IA + **vault Obsidian** (anotações por etapa; ver `contexto/SETUP-OBSIDIAN.md`)
- `scripts/setup-obsidian-vault.ps1` — abrir/configurar Obsidian no Windows
- `rodar-cofre-memoria.ps1` — COFRE - MEMORIA → `memoria total\Viva-Saude` → `contexto/`
- `rodar-memoria-total.ps1` — mesmo fluxo (pede caminho do vault)
- [`AGENTS.md`](./AGENTS.md) — Instruções para agentes de IA
- [PLANO_PROJETO.md](./PLANO_PROJETO.md) - Plano completo do projeto (histórico)
- [GUIA_IMPLEMENTACAO.md](./GUIA_IMPLEMENTACAO.md) - Guia de implementação passo a passo (histórico)

## 🛠️ Desenvolvimento

### Pré-requisitos

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (na VPS)

### Instalação

```bash
# Clone o repositório
git clone <repo-url>
cd app-medico

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Inicie os containers
docker-compose up -d
```

## 📝 Status do Projeto

O status detalhado e por módulo está em **[`contexto/15-estado-atual-e-pendencias.md`](./contexto/15-estado-atual-e-pendencias.md)**.

Resumo: sistema em operação (auth, escalas, ponto, vagas, documentos, relatórios, mobile, deploy). Pendência principal: módulo **Atendimentos** (placeholder no frontend).

## 📄 Licença

[Definir licença]

## 👥 Contribuição

[Instruções de contribuição]

---

**Desenvolvido com foco em segurança e profissionalismo** 🏥
