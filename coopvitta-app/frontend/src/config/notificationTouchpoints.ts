/**
 * Mapa de onde o app pode (ou deve) informar o usuário sobre atividades e avisos.
 *
 * **Já coberto pelo interceptor HTTP** (`services/api.ts`):
 * - Sucesso: mutações (POST/PUT/PATCH/DELETE) cujo JSON traga `message` e `success !== false`.
 * - Erro: falha de rede (sem response) ou status HTTP >= 500.
 * - Excluído de toast de erro: rotas de login; erros de ponto abaixo de 500 (ficam na própria tela).
 *
 * **Bons candidatos a `notify()` manual** (`lib/notificationEmitter`):
 * - Logout por inatividade — aviso antes de sair (requer UX na tela de login ou modal).
 * - Ações apenas no cliente (ex.: “Link copiado”) se existirem.
 * - WebSocket / SSE no futuro (alertas em tempo real).
 *
 * **Telas com alta densidade de ações** (mensagens costumam vir do backend):
 * - `PontoEletronico` — check-in, checkout, sem foto.
 * - `Dashboard` — troca de plantão.
 * - `Perfil` / `MeusDocumentos` — upload e envio de documentos.
 * - `Escalas`, `ContratosAtivos`, `ValoresPlantao`, `ValoresPonto`, `EnvioDocumentos`, `Medicos` — CRUD admin.
 *
 * **Notificações persistidas (profissional)** — tabela `notificacoes_medico`, API `GET/PATCH/POST /medico/notificacoes`:
 * - Vínculo à equipe ou subgrupo; nova escala no contrato (médicos das equipes do contrato); equipe vinculada à escala.
 *
 * **Evitar duplicar**: não chamar `notify()` no mesmo fluxo em que a API já devolve `message`
 * (o interceptor já registra).
 */
export {};
