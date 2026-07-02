# 04 — Autenticação e acessos

**Status:** ✅ Implementado  
**Última atualização:** 2026-05-28

## Escopo entregue

- Login por e-mail, login médico, login master
- Cadastro público e fluxo de convite (`/ativar-conta/:token`)
- Esqueci / redefinir senha (`ResetSenhaToken`)
- JWT + refresh (ver `jwt.util.ts`, env `JWT_*`)
- Sessões persistidas (`Sessao`, `SessaoMaster`)
- Middleware `auth.middleware.ts` — validação de token e papel
- Controle fino por **módulo** (`requireModuleAccess`, `acesso-modulo.service.ts`)
- Rate limiting global em `/api`

## Rotas (`/api/auth`)

Arquivo: `backend/src/routes/auth.routes.ts`

- `POST /login` — e-mail/senha (admin)
- `POST /login-medico` — fluxo médico
- `POST /login-master` — master
- Cadastro, refresh, logout, reset (ver controllers em `auth.controller.ts`)

## Frontend

| Arquivo | Função |
|---------|--------|
| `frontend/src/context/AuthContext.tsx` | Estado global de auth |
| `frontend/src/services/auth.service.ts` | Chamadas API |
| `frontend/src/services/api.ts` | Axios + interceptors (token) |
| `frontend/src/components/Layout/ProtectedRoute.tsx` | Rotas autenticadas |
| `frontend/src/pages/Login.tsx` | Tela de login (sem vídeo animado — removido em 2026) |

## Papéis

```prisma
enum UserRole {
  MASTER
  MEDICO
}
```

## Módulos do sistema

Enum `ModuloSistema` + matriz em `AcessoModuloPerfil`.  
Defaults em `backend/src/constants/modulos.const.ts`.

Endpoints admin:

- `GET/PUT /api/admin/acessos-modulos` — matriz MASTER configura o que cada perfil vê

## Segurança

- Senhas: bcrypt (`BCRYPT_ROUNDS`)
- Validação: `express-validator` + `validation.middleware.ts`
- Auditoria de ações sensíveis: `auditoria.service.ts`

## O que não refazer

- Não expor `uploads/` estaticamente — já removido; usar rotas de download autenticadas
- CORS já inclui `sejavivasaude.com.br` e localhost 3000/5173

## Pendências

- [ ] Revisar se `CHECKLIST` de “Fase 2 Autenticação” pode ser arquivado
