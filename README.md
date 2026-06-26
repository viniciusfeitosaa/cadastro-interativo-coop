# COOPVITTA — Cadastro Interativo

Formulário multi-etapas de pré-cadastro + painel admin para visualizar inscrições.

## Infraestrutura VPS COOPVITTA

Guia completo para montar o servidor dedicado (fork do [AppVS](https://github.com/viniciusfeitosaa/AppVS), DocuSeal, NPM, Maddy, este cadastro e DNS):

**[docs/SETUP-VPS-COOPVITTA.md](./docs/SETUP-VPS-COOPVITTA.md)**

## Estrutura

```
web/      → Frontend React (formulário + admin)
server/   → API Node.js (salva cadastros e arquivos)
```

## Como rodar

**Terminal 1 — API:**
```bash
cd server
npm install
copy .env.example .env   # Windows
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd web
npm install
npm run dev
```

| URL | Descrição |
|-----|-----------|
| http://localhost:5173 | Formulário de cadastro |
| http://localhost:5173/admin | Painel admin |
| http://localhost:5173/admin/login | Login admin |

## Acesso admin

Senha padrão: `coopvitta2024` (altere em `server/.env`)

```env
ADMIN_PASSWORD=sua-senha-segura
JWT_SECRET=chave-secreta-longa
PORT=3001
```

## O que o admin faz

- Lista todos os cadastros recebidos
- Busca por nome, e-mail ou CPF
- Visualiza todos os dados preenchidos por etapa
- Baixa documentos anexados (RG, CV, diplomas, etc.)

## Integração com seu site

Adicione um botão no site apontando para o formulário:

```html
<a href="https://seu-dominio.com/cadastro">Quero me cadastrar</a>
```

## Dados armazenados

- Cadastros: `server/data/cadastros.json`
- Arquivos: `server/uploads/`
