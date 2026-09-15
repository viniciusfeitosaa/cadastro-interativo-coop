import { getRedisClient } from '../config/redis';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';
import { getOrgDisplayName } from '../utils/email-branding.util';

type EvolutionWebhookPayload = {
  event?: string;
  instance?: string;
  data?: any;
};

type MenuOption = 'administrativo' | 'financeiro' | 'duvidas';

type MenuState =
  | { state: 'awaiting_cooperado'; updatedAt: number }
  | { state: 'awaiting_area'; updatedAt: number }
  | { state: 'awaiting_cadastro'; updatedAt: number }
  | { state: 'awaiting_duvida'; updatedAt: number }
  | { state: 'routed'; option: MenuOption; updatedAt: number; botHintSent?: boolean }
  /** Atendimento humano: robô fica mudo até *menu* (usuário) ou *retomar* (equipe). */
  | { state: 'paused'; updatedAt: number; option?: MenuOption; botHintSent?: boolean }
  | { state: 'closed'; updatedAt: number };

const CADASTRO_URL = 'https://app.coopvitta.cloud/cadastro';
const TZ = 'America/Fortaleza';
const BUSINESS_WEEKDAYS = new Set([1, 2, 3, 4, 5]); // Mon–Fri
const BUSINESS_START_MIN = 8 * 60; // 08:00
const BUSINESS_END_MIN = 17 * 60; // 17:00
const BOT_OUTGOING_TTL_SEC = 20;
const PAUSED_TTL_SEC = 7 * 24 * 3600;

const AREA_ACK: Record<MenuOption, string> = {
  administrativo: 'Você selecionou Administrativo.',
  financeiro: 'Você selecionou Financeiro.',
  duvidas: 'Você selecionou Dúvidas.',
};

const WAIT_TEXT =
  'Em breve você será atendido(a) por nossa equipe. Aguarde um instante, por favor.';

const PAUSED_HINT_TEXT =
  'Esta conversa está com nossa equipe agora. Para falar com o assistente automático, digite *menu*.';

function hasEvolutionConfig(): boolean {
  const e = process.env;
  return !!(e.EVOLUTION_API_URL && e.EVOLUTION_API_KEY && e.EVOLUTION_INSTANCE);
}

/** Instantes locais em America/Fortaleza (CE). */
function getFortalezaParts(date = new Date()): {
  weekday: number;
  hour: number;
  minute: number;
  totalMinutes: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekdayName = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
  let hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  if (hour === 24) hour = 0;

  return {
    weekday: weekdayMap[weekdayName] ?? 1,
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  };
}

function greetingForNow(date = new Date()): string {
  const { hour } = getFortalezaParts(date);
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function isWithinBusinessHours(date = new Date()): boolean {
  const { weekday, totalMinutes } = getFortalezaParts(date);
  if (!BUSINESS_WEEKDAYS.has(weekday)) return false;
  return totalMinutes >= BUSINESS_START_MIN && totalMinutes < BUSINESS_END_MIN;
}

function welcomeInHoursText(): string {
  return `*CoopVitta* — ${greetingForNow()}! 👋

Seja bem-vindo(a) ao atendimento da CoopVitta.

*Horário de atendimento*
Segunda a sexta, das 08:00 às 17:00.

Você já é cooperado(a)?

1️⃣ Sim
2️⃣ Não

_Responda com 1 ou 2._
_Digite *menu* para recomeçar • *sair* para encerrar_`;
}

function welcomeOutOfHoursText(): string {
  return `*CoopVitta* — ${greetingForNow()}! 👋

Recebemos sua mensagem. No momento estamos fora do horário de atendimento.

*Horário de atendimento*
Segunda a sexta, das 08:00 às 17:00.

Assim que o expediente começar, nossa equipe retoma o atendimento.
Se quiser, digite *menu* no próximo dia útil para iniciar o atendimento.`;
}

function areaMenuText(): string {
  return `Perfeito! Para facilitar, escolha o assunto digitando o número:

1️⃣ Administrativo
2️⃣ Financeiro
3️⃣ Dúvidas

_Responda com 1, 2 ou 3._
_Digite *menu* para recomeçar • *sair* para encerrar_`;
}

function cadastroChoiceText(): string {
  return `Entendi. Você gostaria de se cadastrar para se tornar cooperado(a)?

1️⃣ Sim
2️⃣ Não

_Responda com 1 ou 2._
_Digite *menu* para recomeçar • *sair* para encerrar_`;
}

function cadastroLinkText(): string {
  return `Ótimo! Você pode iniciar seu cadastro por este link:

${CADASTRO_URL}

*Importante:* após concluir o cadastro, volte a entrar em contato por este WhatsApp para recebermos e enviarmos os *termos para assinatura*.

Qualquer dúvida, digite *menu* para falar conosco.`;
}

function duvidaPromptText(): string {
  return `Tudo bem. Você tem alguma dúvida?

Se quiser, descreva sua dúvida nesta conversa.
Em breve você será atendido(a) pela nossa equipe.

_Digite *menu* para recomeçar • *sair* para encerrar_`;
}

function normalizeToEvolutionNumber(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Exibe telefone BR de forma legível. */
function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return `+${d}`;
}

function waMeLink(digits: string): string {
  return `https://wa.me/${digits.replace(/\D/g, '')}`;
}

function extractIncomingText(messageData: any): string {
  const msg = messageData?.message ?? messageData;
  const conv = msg?.conversation ?? msg?.conversationText;
  if (typeof conv === 'string') return conv;

  const ext = msg?.extendedTextMessage?.text;
  if (typeof ext === 'string') return ext;

  const buttons = msg?.buttonsResponseMessage?.selectedDisplayText;
  if (typeof buttons === 'string') return buttons;

  const list = msg?.listResponseMessage?.title;
  if (typeof list === 'string') return list;

  // Alguns payloads SEND_MESSAGE trazem o texto na raiz
  if (typeof messageData?.text === 'string') return messageData.text;
  if (typeof messageData?.body === 'string') return messageData.body;

  return '';
}

/** Normaliza comando da equipe: "pausar", "*pausar*", "/pausar", etc. */
function normalizeStaffCommand(text: string): 'pausar' | 'retomar' | null {
  const t = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/^[*#/\s]+|[*#/\s]+$/g, '');
  if (t === 'pausar' || t === 'pause' || t === 'stop') return 'pausar';
  if (t === 'retomar' || t === 'resume' || t === 'ligar') return 'retomar';
  return null;
}

/** Evolution pode mandar data único, array, ou { messages: [...] }. */
function unwrapMessageData(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages)) return data.messages;
  if (data.key || data.message || data.pushName) return [data];
  return [data];
}

function extractPushName(data: any): string | null {
  const name =
    data?.pushName ||
    data?.pushname ||
    data?.sender?.pushName ||
    data?.message?.pushName ||
    null;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return null;
}

/** Aceita "1", "1️⃣", "sim" / "2", "não" — não casa "21". */
function normalizeYesNo(text: string): 'sim' | 'nao' | null {
  const t = text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!t) return null;
  if (t === '1' || t === '1️⃣' || t === 'sim' || t === 's' || t === 'yes') return 'sim';
  if (t === '2' || t === '2️⃣' || t === 'nao' || t === 'n' || t === 'no') return 'nao';
  return null;
}

function normalizeAreaOption(text: string): MenuOption | null {
  const t = text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!t) return null;

  if (t === '1' || t === '1️⃣' || t === 'administrativo' || t === 'admin') return 'administrativo';
  if (t === '2' || t === '2️⃣' || t === 'financeiro' || t === 'finance') return 'financeiro';
  if (t === '3' || t === '3️⃣' || t === 'duvidas' || t === 'duvida') return 'duvidas';

  if (t.startsWith('admin')) return 'administrativo';
  if (t.startsWith('finance')) return 'financeiro';
  if (t.startsWith('duv')) return 'duvidas';

  return null;
}

function menuKeyForNumber(numberDigits: string) {
  return `evo_menu:${numberDigits}`;
}

function botOutgoingKey(numberDigits: string) {
  return `evo_bot_out:${numberDigits}`;
}

async function markBotOutgoing(numberDigits: string) {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.set(botOutgoingKey(numberDigits), '1', 'EX', BOT_OUTGOING_TTL_SEC);
}

async function wasBotOutgoing(numberDigits: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  const v = await redis.get(botOutgoingKey(numberDigits));
  return Boolean(v);
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
  await markBotOutgoing(number);

  const encodedInstance = encodeURIComponent(instance);
  const res = await fetchWithTimeout(`${baseUrl}/message/sendText/${encodedInstance}`, {
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

/** Apaga mensagem "para todos" (ex.: comando pausar/retomar da equipe). */
async function deleteMessageForEveryone(key: {
  id?: string;
  remoteJid?: string;
  fromMe?: boolean;
}): Promise<boolean> {
  if (!hasEvolutionConfig()) return false;
  if (!key?.id || !key?.remoteJid) return false;

  const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const instance = process.env.EVOLUTION_INSTANCE!;
  const apiKey = process.env.EVOLUTION_API_KEY!;
  const encodedInstance = encodeURIComponent(instance);

  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/chat/deleteMessageForEveryone/${encodedInstance}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          id: key.id,
          remoteJid: key.remoteJid,
          fromMe: key.fromMe !== false,
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[whatsapp-menu] falha ao apagar mensagem:', res.status, errText.slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[whatsapp-menu] erro ao apagar mensagem:', err);
    return false;
  }
}

async function notifyStaff(
  option: MenuOption,
  userNumberDigits: string,
  userText: string,
  pushName: string | null
) {
  const adminTo = normalizeToEvolutionNumber(process.env.WHATSAPP_MENU_ADMIN_NUMBER);
  const financeTo = normalizeToEvolutionNumber(process.env.WHATSAPP_MENU_FINANCE_NUMBER);
  const doubtsTo = normalizeToEvolutionNumber(process.env.WHATSAPP_MENU_DUDAS_NUMBER);

  const dest =
    option === 'administrativo' ? adminTo : option === 'financeiro' ? financeTo : doubtsTo;
  if (!dest) return;

  const nome = pushName || '(nome não informado no WhatsApp)';
  const telefone = formatPhoneDisplay(userNumberDigits);
  const link = waMeLink(userNumberDigits);

  const atendimentoResumo =
    `*Novo atendimento — ${option}*\n` +
    `${getOrgDisplayName()}\n\n` +
    `*Quem enviou:* ${nome}\n` +
    `*Telefone:* ${telefone}\n` +
    `*Abrir conversa:* ${link}\n` +
    `*Mensagem:* ${userText || '(sem texto)'}\n\n` +
    `_O robô pausou nesta conversa. Para religar: equipe digita *retomar* (apagado em seguida) ou o usuário digita *menu*._`;

  await sendEvolutionText(dest, atendimentoResumo);
}

function isTargetInstance(payloadInstance: string | undefined): boolean {
  const configured = (process.env.EVOLUTION_INSTANCE || '').trim();
  if (!configured) return true;
  const incoming = (payloadInstance || '').trim();
  if (!incoming) return true;
  return incoming.toLowerCase() === configured.toLowerCase();
}

async function startConversation(senderDigits: string, now: number) {
  if (!isWithinBusinessHours()) {
    await sendEvolutionText(senderDigits, welcomeOutOfHoursText());
    await setMenuState(senderDigits, { state: 'closed', updatedAt: now }, 60 * 60);
    return;
  }
  await sendEvolutionText(senderDigits, welcomeInHoursText());
  await setMenuState(senderDigits, { state: 'awaiting_cooperado', updatedAt: now }, 60 * 60);
}

async function pauseForHuman(contactDigits: string, now: number, option?: MenuOption) {
  const prev = await getMenuState(contactDigits);
  const opt =
    option ??
    (prev && (prev.state === 'routed' || prev.state === 'paused') ? prev.option : undefined);

  // Já pausado: só renova TTL e preserva a dica — não reenvia.
  if (prev?.state === 'paused') {
    await setMenuState(
      contactDigits,
      {
        state: 'paused',
        updatedAt: now,
        option: opt,
        botHintSent: Boolean(prev.botHintSent),
      },
      PAUSED_TTL_SEC
    );
    return;
  }

  // Marca a dica antes de enviar, para o eco do webhook não disparar de novo.
  await setMenuState(
    contactDigits,
    { state: 'paused', updatedAt: now, option: opt, botHintSent: true },
    PAUSED_TTL_SEC
  );
  await sendEvolutionText(contactDigits, PAUSED_HINT_TEXT);
}

/**
 * Mensagens enviadas pela conta Lais (fromMe):
 * - Se for eco do próprio robô → ignora (exceto comandos pausar/retomar)
 * - Se a equipe digitar *pausar* → pausa e apaga o comando
 * - Se a equipe digitar *retomar* → libera o menu e apaga o comando
 * - Qualquer outra mensagem humana → pausa silenciosa
 */
async function handleOutgoingFromUs(data: any, now: number): Promise<void> {
  const remoteJid: string | undefined = data?.key?.remoteJid ?? data?.remoteJid ?? undefined;
  if (!remoteJid || remoteJid.endsWith('@g.us')) return;

  const contactDigits = normalizeToEvolutionNumber(remoteJid);
  if (!contactDigits) return;

  const text = extractIncomingText(data);
  const cmd = normalizeStaffCommand(text);

  // Comandos da equipe sempre processam — mesmo logo após resposta do robô.
  if (cmd === 'retomar') {
    console.info('[whatsapp-menu] retomar', contactDigits);
    await deleteMessageForEveryone({
      id: typeof data?.key?.id === 'string' ? data.key.id : undefined,
      remoteJid,
      fromMe: true,
    });
    await startConversation(contactDigits, now);
    return;
  }

  if (cmd === 'pausar') {
    console.info('[whatsapp-menu] pausar', contactDigits);
    await pauseForHuman(contactDigits, now);
    await deleteMessageForEveryone({
      id: typeof data?.key?.id === 'string' ? data.key.id : undefined,
      remoteJid,
      fromMe: true,
    });
    return;
  }

  if (await wasBotOutgoing(contactDigits)) {
    return;
  }

  // Eco da própria dica de pausa (ou texto idêntico do robô): não trata como equipe.
  const normalizedOut = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const hintNorm = PAUSED_HINT_TEXT.toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (normalizedOut && normalizedOut === hintNorm) {
    return;
  }

  // Sem texto (eco/status): ignora. Com texto humano: pausa atendimento.
  if (!text.trim()) return;

  console.info('[whatsapp-menu] pausa automática (msg equipe)', contactDigits);
  await pauseForHuman(contactDigits, now);
}

export async function handleEvolutionMessagesUpsert(payload: unknown): Promise<void> {
  const p = payload as EvolutionWebhookPayload;
  const event = (p.event || '').toLowerCase().replace(/_/g, '.');

  // messages.upsert | send.message | messages.update (só processamos upsert/send com conteúdo)
  const isUpsert = event.includes('messages') && event.includes('upsert');
  const isSend = event.includes('send') && event.includes('message');
  if (event && !isUpsert && !isSend) {
    return;
  }

  if (!isTargetInstance(p.instance)) {
    return;
  }

  const items = unwrapMessageData(p.data);
  const now = Date.now();

  for (const data of items) {
    const fromMe = Boolean(data?.key?.fromMe ?? data?.fromMe);

    if (fromMe || isSend) {
      // SEND_MESSAGE costuma ser saída da instância
      await handleOutgoingFromUs(
        fromMe
          ? data
          : {
              ...data,
              key: data?.key ?? {
                remoteJid: data?.remoteJid ?? data?.number,
                fromMe: true,
                id: data?.id ?? data?.key?.id,
              },
            },
        now
      );
      continue;
    }

    const remoteJid: string | undefined = data?.key?.remoteJid ?? undefined;
    if (remoteJid && remoteJid.endsWith('@g.us')) continue;

    const senderDigits = normalizeToEvolutionNumber(remoteJid);
    if (!senderDigits) continue;

    const text = extractIncomingText(data);
    const lower = text.trim().toLowerCase();
    const pushName = extractPushName(data);
    const state = await getMenuState(senderDigits);

    // Usuário pode sempre pedir o menu (reativa o robô).
    if (lower === 'menu') {
      await startConversation(senderDigits, now);
      continue;
    }

    if (lower === 'sair') {
      await sendEvolutionText(senderDigits, 'Conversa encerrada. Se precisar, digite *menu*.');
      await setMenuState(senderDigits, { state: 'closed', updatedAt: now }, 60 * 60);
      continue;
    }

    // Pausado: silêncio total (a dica já foi enviada uma vez em pauseForHuman).
    if (state?.state === 'paused') {
      continue;
    }

    // Encaminhado à equipe: no máximo uma dica se o cliente escrever de novo.
    if (state?.state === 'routed') {
      if (lower && !state.botHintSent) {
        await sendEvolutionText(senderDigits, PAUSED_HINT_TEXT);
        await setMenuState(
          senderDigits,
          { ...state, botHintSent: true, updatedAt: now },
          PAUSED_TTL_SEC
        );
      }
      continue;
    }

    if (!state || state.state === 'closed') {
      await startConversation(senderDigits, now);
      continue;
    }

    if (state.state === 'awaiting_cooperado') {
      const yn = normalizeYesNo(lower);
      if (!yn) {
        await sendEvolutionText(
          senderDigits,
          'Por favor, responda com *1* (Sim, já sou cooperado) ou *2* (Não).'
        );
        continue;
      }
      if (yn === 'sim') {
        await sendEvolutionText(senderDigits, areaMenuText());
        await setMenuState(senderDigits, { state: 'awaiting_area', updatedAt: now }, 60 * 60);
        continue;
      }
      await sendEvolutionText(senderDigits, cadastroChoiceText());
      await setMenuState(senderDigits, { state: 'awaiting_cadastro', updatedAt: now }, 60 * 60);
      continue;
    }

    if (state.state === 'awaiting_area') {
      const opt = normalizeAreaOption(lower);
      if (!opt) {
        await sendEvolutionText(
          senderDigits,
          'Opção inválida. Por favor, responda apenas com *1*, *2* ou *3*.'
        );
        continue;
      }
      await sendEvolutionText(senderDigits, `${AREA_ACK[opt]}\n\n${WAIT_TEXT}`);
      await setMenuState(senderDigits, { state: 'routed', option: opt, updatedAt: now }, PAUSED_TTL_SEC);
      await notifyStaff(opt, senderDigits, text, pushName);
      continue;
    }

    if (state.state === 'awaiting_cadastro') {
      const yn = normalizeYesNo(lower);
      if (!yn) {
        await sendEvolutionText(
          senderDigits,
          'Por favor, responda com *1* (Sim, quero me cadastrar) ou *2* (Não).'
        );
        continue;
      }
      if (yn === 'sim') {
        await sendEvolutionText(senderDigits, cadastroLinkText());
        await setMenuState(senderDigits, { state: 'closed', updatedAt: now }, 60 * 60);
        continue;
      }
      await sendEvolutionText(senderDigits, duvidaPromptText());
      await setMenuState(senderDigits, { state: 'awaiting_duvida', updatedAt: now }, 60 * 60);
      continue;
    }

    if (state.state === 'awaiting_duvida') {
      if (lower) {
        await sendEvolutionText(senderDigits, WAIT_TEXT);
        await setMenuState(
          senderDigits,
          { state: 'routed', option: 'duvidas', updatedAt: now },
          PAUSED_TTL_SEC
        );
        await notifyStaff('duvidas', senderDigits, text, pushName);
      }
    }
  }
}
