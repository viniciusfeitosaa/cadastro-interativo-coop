/**
 * Evita exibir erros técnicos (Node/Prisma/axios) como texto principal da notificação.
 * Usado no painel do sino e alinhado ao interceptor da API.
 */
const TECHNICAL =
  /Cannot read properties|reading ['"]?findMany|\.findMany\b|TypeError:|ReferenceError:|is not a function|PrismaClient|ECONNREFUSED|socket hang up|ETIMEDOUT|__proto__|undefined \(reading/i;

const DEFAULT_FRIENDLY =
  'Não foi possível concluir agora. Atualize a página ou tente de novo em alguns segundos.';

export function sanitizeNotificationBody(text: string): string {
  const t = (text || '').trim();
  if (!t) return DEFAULT_FRIENDLY;
  if (TECHNICAL.test(t)) return DEFAULT_FRIENDLY;
  return t.length > 500 ? `${t.slice(0, 497)}…` : t;
}

export function sanitizeNotificationTitle(title: string | undefined, kind: string): string | undefined {
  if (!title?.trim()) return title;
  const t = title.trim();
  if (TECHNICAL.test(t)) return kind === 'error' ? 'Falha temporária' : title;
  if (t === 'Servidor' || t === 'Server') return 'Algo deu errado';
  return title;
}

/** Para cada linha do painel: título + mensagem amigáveis. */
export function formatNotificationRowForDisplay(row: {
  title?: string;
  message: string;
  kind: string;
}): { title?: string; message: string } {
  const message = sanitizeNotificationBody(row.message);
  const title = sanitizeNotificationTitle(row.title, row.kind);
  return { title, message };
}
