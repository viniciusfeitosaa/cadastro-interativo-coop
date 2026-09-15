import type { GcoopDadosIniciais, GcoopDomainItem } from '../../types/gcoop.types';
import { fetchGcoopCidades, fetchGcoopDadosIniciais } from './gcoop.client';

const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedDados: GcoopDadosIniciais | null = null;
let cachedAt = 0;
const cidadesCache = new Map<string, { at: number; items: GcoopDomainItem[] }>();

export function normalizeGcoopLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getGcoopItemId(item: GcoopDomainItem): number | null {
  const raw = item.ID ?? item.Id ?? item.id;
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function getGcoopItemLabel(item: GcoopDomainItem): string {
  const candidates = [item.Descricao, item.Nome, item.Sigla, item.UF, item.Abreviacao];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

export function findGcoopItemIdByLabel(list: GcoopDomainItem[] | undefined, search: string): number | null {
  if (!list?.length || !search?.trim()) return null;
  const n = normalizeGcoopLabel(search);
  let partial: number | null = null;

  for (const item of list) {
    const label = normalizeGcoopLabel(getGcoopItemLabel(item));
    if (!label) continue;
    const id = getGcoopItemId(item);
    if (id == null || id === 0) continue;
    if (label === n) return id;
    if (!partial && (label.includes(n) || n.includes(label))) partial = id;
  }
  return partial;
}

/**
 * Resolve órgão expedidor do RG para o ID Gcoop.
 * Aceita aliases comuns (texto livre legado) e cai em SSP se não houver match.
 */
export function resolveGcoopOrgaoExpedidorId(
  list: GcoopDomainItem[] | undefined,
  search: string
): number | null {
  const raw = (search || '').trim();
  if (!raw) {
    return findGcoopItemIdByLabel(list, 'SSP');
  }

  const direct = findGcoopItemIdByLabel(list, raw);
  if (direct != null) return direct;

  const n = normalizeGcoopLabel(raw);
  const aliases: Array<{ match: RegExp; label: string }> = [
    { match: /\bssp\b|secretaria de seguranca/, label: 'SSP' },
    { match: /\bsds\b|defesa social/, label: 'SDS' },
    { match: /\bifp\b|cihpb|instituto de identificacao/, label: 'IFP' },
    { match: /\bdetran\b|\bcnt\b/, label: 'CNT' },
    { match: /\bdic\b/, label: 'DIC' },
    { match: /\bitep\b/, label: 'ITEP' },
    { match: /\bimlc\b/, label: 'IMLC' },
    { match: /\boab\b/, label: 'OAB' },
    { match: /\bcrm\b/, label: 'CRM' },
    { match: /\bcrea\b/, label: 'CREA' },
    { match: /\bpolicia civil\b|\bpc\b|\bdgpc\b/, label: 'SSP' },
  ];

  for (const a of aliases) {
    if (a.match.test(n)) {
      const id = findGcoopItemIdByLabel(list, a.label);
      if (id != null) return id;
    }
  }

  // Fallback seguro: maioria dos RGs brasileiros é SSP — evita sync travado por typo.
  const ssp = findGcoopItemIdByLabel(list, 'SSP');
  if (ssp != null) {
    console.warn('[gcoop] órgão expedidor não mapeado, usando SSP:', raw);
  }
  return ssp;
}

export function findGcoopRacaCorFallbackId(list: GcoopDomainItem[] | undefined): number | null {
  if (!list?.length) return null;
  const patterns = ['nao declarado', 'nao informado', 'sem declaracao', 'ignorado'];
  for (const item of list) {
    const label = normalizeGcoopLabel(getGcoopItemLabel(item));
    if (patterns.some((p) => label.includes(p))) {
      const id = getGcoopItemId(item);
      if (id != null) return id;
    }
  }
  const first = getGcoopItemId(list[0]);
  return first;
}

/** Gcoop usa sigla UF (ex.: "CE") em `ListaUF[].ID` e em `Cidades?_idUF=`. */
export function findGcoopUfSigla(list: GcoopDomainItem[] | undefined, uf: string): string | null {
  if (!uf?.trim()) return null;
  const sigla = uf.trim().toUpperCase().slice(0, 2);
  if (!list?.length) return sigla.length === 2 ? sigla : null;

  for (const item of list) {
    const idRaw = item.ID ?? item.Id ?? item.id;
    if (idRaw != null && String(idRaw).trim().toUpperCase() === sigla) return sigla;
    const itemUf = (item.UF || item.Sigla || item.Abreviacao || '').toString().trim().toUpperCase();
    if (itemUf === sigla) return sigla;
  }
  return sigla.length === 2 ? sigla : null;
}

export function findGcoopDocumentoId(
  list: GcoopDomainItem[] | undefined,
  keywords: string[]
): number | null {
  if (!list?.length) return null;
  const normalizedKeywords = keywords.map((k) => normalizeGcoopLabel(k));

  for (const item of list) {
    const label = normalizeGcoopLabel(getGcoopItemLabel(item));
    if (!label) continue;
    if (normalizedKeywords.every((k) => label.includes(k))) {
      const id = getGcoopItemId(item);
      if (id != null) return id;
    }
  }
  return null;
}

export async function getGcoopDadosIniciaisCached(force = false): Promise<GcoopDadosIniciais> {
  const now = Date.now();
  if (!force && cachedDados && now - cachedAt < CACHE_TTL_MS) {
    return cachedDados;
  }
  const data = await fetchGcoopDadosIniciais();
  cachedDados = data;
  cachedAt = now;
  return data;
}

export async function getGcoopCidadesCached(ufSigla: string): Promise<GcoopDomainItem[]> {
  const key = ufSigla.trim().toUpperCase().slice(0, 2);
  const now = Date.now();
  const hit = cidadesCache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.items;
  const items = await fetchGcoopCidades(key);
  cidadesCache.set(key, { at: now, items });
  return items;
}

export function findGcoopCidadeId(
  cidades: GcoopDomainItem[] | undefined,
  nomeCidade: string
): number | null {
  return findGcoopItemIdByLabel(cidades, nomeCidade);
}

/** Labels do wizard → rótulos exibidos no select (para match nas listas Gcoop). */
export const WIZARD_LABEL_MAP: Record<string, string> = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  outro: 'Outro',
  'prefiro-nao-informar': 'Prefiro não informar',
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
  'uniao-estavel': 'União estável',
  'comunhao-parcial': 'Comunhão parcial de bens',
  'comunhao-universal': 'Comunhão universal de bens',
  'separacao-total': 'Separação total de bens',
  'participacao-final': 'Participação final nos aquestos',
  'fundamental-incompleto': 'Fundamental incompleto',
  'fundamental-completo': 'Fundamental completo',
  'medio-incompleto': 'Médio incompleto',
  'medio-completo': 'Médio completo',
  'superior-incompleto': 'Superior incompleto',
  'superior-completo': 'Superior completo',
  'pos-graduacao': 'Pós-graduação',
  mestrado: 'Mestrado',
  doutorado: 'Doutorado',
  coren: 'COREN',
  crm: 'CRM',
  crefito: 'CREFITO',
  crn: 'CRN',
  crf: 'CRF',
  crp: 'CRP',
  crfa: 'CRFa',
  cress: 'CRESS',
  cro: 'CRO',
  crbm: 'CRBM',
  crbio: 'CRBIO',
  crefono: 'CREFONO',
};

export function wizardValueToLabel(field: string, value: unknown): string {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (field === 'tipoSanguineo') return s;
  return WIZARD_LABEL_MAP[s] || s;
}
