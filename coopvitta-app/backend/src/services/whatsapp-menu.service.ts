import { getRedisClient } from '../config/redis';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';
import { getOrgDisplayName } from '../utils/email-branding.util';

type EvolutionWebhookPayload = {
  event?: string;
  instance?: string;
  data?: any;
};

type MenuState =
  | { state: 'awaiting_option'; updatedAt: number }
  | { state: 'routed'; option: 'administrativo' | 'financeiro' | 'duvidas'; updatedAt: number }
  | { state: 'closed'; updatedAt: number };

const MENU_TEXT = `*Coop Vitta* — Olá! 👋

*🕐 Horário de atendimento*
Segunda a quinta: 8h às 12h e 13h às 18h
Sexta: 8h às 12h e 13h às 17h
(pausa para almoço das 12h às 13h)

Escolha o assunto digitando o número:

1️⃣ Administrativo
2️⃣ Financeiro
3️⃣ Dúvidas

_Responda com 1, 2 ou 3._
_Digite *menu* para ver as opções • *sair* para encerrar_`;

const INVALID_OPTION_TEXT =
  'Opção inválida. Por favor, responda apenas com 1, 2 ou 3.';

const ROUTED_ACK: Record<'administrativo' | 'financeiro' | 'duvidas', string> = {
  administrativo: 'Você selecionou Administrativo.',
  financeiro: 'Você selecionou Financeiro.',
  duvidas: 'Você selecionou Dúvidas.',
};

const ROUTED_WAIT_TEXT =
  'Em breve você será atendido(a) por nossa equipe. Aguarde um instante, por favor.';

function hasEvolutionConfig(): boolean {
  const e = process.env;
  return !!(e.EVOLUTION_API_URL && e.EVOLUTION_API_KEY && e.EVOLUTION_INSTANCE);
}

function normalizeToEvolutionNumber(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  // We expect BR numbers (or already full E.164 without "+").
  if (digits.length < 10) return null;
  // If missing country code, assume 55.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function extractIncomingText(messageData: any): string {
  // Evolution typically uses message.conversation for plain text.
  const conv = messageData?.message?.conversation ?? messageData?.message?.conversationText;
  if (typeof conv === 'string') return conv;

  // Fallbacks for extended messages.
  const ext = messageData?.message?.extendedTextMessage?.text;
  if (typeof ext === 'string') return ext;

  return '';
}

function normalizeOption(text: string): 'administrativo' | 'financeiro' | 'duvidas' | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  // Accept "1", "1️⃣", "administrativo", etc.
  if (t === '1' || t.includes('1')) return 'administrativo';
  if (t === '2' || t.includes('2')) return 'financeiro';
  if (t === '3' || t.includes('3')) return 'duvidas';

  if (t.includes('admin')) return 'administrativo';
  if (t.includes('finance')) return 'financeiro';
  if (t.includes('duv') || t.includes('dúv') || t.includes('duvidas') || t.includes('dúvidas')) return 'duvidas';

  return null;
}

function menuKeyForNumber(numberDigits: string) {
  return `evo_menu:${numberDigits}`;
}

async function getMenuState(numberDigits: string): Promise<MenuState | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  const raw = await redis.get(menuKeyForNumber(numberDigits));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MenuState;
  } catch {
    return null;
  }
}

async function setMenuState(numberDigits: string, state: MenuState, ttlSeconds: number) {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.set(menuKeyForNumber(numberDigits), JSON.stringify(state), 'EX', ttlSeconds);
}

async function sendEvolutionText(toNumberDigits: string, text: string) {
  if (!hasEvolutionConfig()) return;
  const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const instance = process.env.EVOLUTION_INSTANCE!;
  const apiKey = process.env.EVOLUTION_API_KEY!;

  const number = toNumberDigits.replace(/^\++/, '');
  const res = await fetchWithTimeout(`${baseUrl}/message/sendText/${instance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({ number, text }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Evolution sendText ${res.status}: ${errText}`);
  }
}

async function notifyStaff(option: 'administrativo' | 'financeiro' | 'duvidas', userNumberDigits: string, userText: string) {
  // Encaminhamento opcional: só acontece se números estiverem configurados no .env do backend.
  // Números esperam dígitos (pode incluir + e espaços).
  const adminTo = normalizeToEvolutionNumber(process.env.WHATSAPP_MENU_ADMIN_NUMBER);
  const financeTo = normalizeToEvolutionNumber(process.env.WHATSAPP_MENU_FINANCE_NUMBER);
  const doubtsTo = normalizeToEvolutionNumber(process.env.WHATSAPP_MENU_DUDAS_NUMBER);

  const dest =
    option === 'administrativo' ? adminTo : option === 'financeiro' ? financeTo : option === 'duvidas' ? doubtsTo : null;
  if (!dest) return;

  const atendimentoResumo = `*Novo atendimento ${option}* — ${getOrgDisplayName()}\n\nUsuário: ${userNumberDigits}\nMensagem: ${userText || '(sem texto)'}\n`;

  await sendEvolutionText(dest, atendimentoResumo);
}

export async function handleEvolutionMessagesUpsert(payload: unknown): Promise<void> {
  const p = payload as EvolutionWebhookPayload;
  const event = (p.event || '').toLowerCase();

  // We only care about MESSAGES_UPSERT.
  if (event && !event.includes('messages') && !event.includes('upsert')) {
    return;
  }

  const data = p.data ?? {};
  const fromMe = Boolean(data?.key?.fromMe);
  if (fromMe) return;

  // sender number may be in remoteJid or sender
  const remoteJid: string | undefined = data?.key?.remoteJid ?? p.data?.sender ?? undefined;
  const senderDigits = normalizeToEvolutionNumber(remoteJid);
  if (!senderDigits) return;

  const text = extractIncomingText(p);
  const lower = text.trim().toLowerCase();

  const state = await getMenuState(senderDigits);
  const now = Date.now();

  // Commands always supported.
  if (lower === 'menu') {
    await sendEvolutionText(senderDigits, MENU_TEXT);
    await setMenuState(senderDigits, { state: 'awaiting_option', updatedAt: now }, 60 * 60);
    return;
  }

  if (lower === 'sair') {
    await sendEvolutionText(senderDigits, 'Conversa encerrada. Se precisar, digite *menu*.');
    await setMenuState(senderDigits, { state: 'closed', updatedAt: now }, 60 * 60);
    return;
  }

  // If user has no state yet, treat as first contact: send menu.
  if (!state || state.state !== 'awaiting_option' && state.state !== 'routed') {
    await sendEvolutionText(senderDigits, MENU_TEXT);
    await setMenuState(senderDigits, { state: 'awaiting_option', updatedAt: now }, 60 * 60);
    // Also process the first message if it's already an option (optional but helpful).
    const opt = normalizeOption(lower);
    if (opt) {
      await sendEvolutionText(senderDigits, ROUTED_ACK[opt] + '\n\n' + ROUTED_WAIT_TEXT);
      await setMenuState(senderDigits, { state: 'routed', option: opt, updatedAt: now }, 7 * 24 * 3600);
      await notifyStaff(opt, senderDigits, text);
    }
    return;
  }

  if (state.state === 'awaiting_option') {
    const opt = normalizeOption(lower);
    if (!opt) {
      await sendEvolutionText(senderDigits, INVALID_OPTION_TEXT);
      return;
    }

    await sendEvolutionText(senderDigits, ROUTED_ACK[opt] + '\n\n' + ROUTED_WAIT_TEXT);
    await setMenuState(senderDigits, { state: 'routed', option: opt, updatedAt: now }, 7 * 24 * 3600);
    await notifyStaff(opt, senderDigits, text);
    return;
  }

  // routed: just acknowledge. (Opcional: poderíamos encaminhar mensagens seguintes também.)
  const currentOpt = state.state === 'routed' ? state.option : null;
  if (currentOpt && lower) {
    await sendEvolutionText(senderDigits, `Mensagem recebida. Em breve você será atendido(a) para *${currentOpt}*.`);
  }
}

