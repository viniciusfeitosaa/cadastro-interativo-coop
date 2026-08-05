import env from '../../config/env';

export function isGcoopEnabled(): boolean {
  const base = (env.GCOOP_API_BASE_URL || '').trim();
  const user = (env.GCOOP_API_USER || '').trim();
  const pass = env.GCOOP_API_PASSWORD ?? '';
  return Boolean(base && user && pass);
}

export function getGcoopConfig() {
  const baseUrl = (env.GCOOP_API_BASE_URL || '').trim().replace(/\/$/, '');
  const user = (env.GCOOP_API_USER || '').trim();
  const password = env.GCOOP_API_PASSWORD ?? '';
  const timeoutMs = parseInt(env.GCOOP_API_TIMEOUT_MS || env.HTTP_EXTERNAL_TIMEOUT_MS, 10) || 30000;
  return { baseUrl, user, password, timeoutMs };
}

const DEFAULT_GCOOP_AREA_COOPERADO_URL = 'https://coopvitta-area-cooperado.evoluti.net.br';

/** Portal web do cooperado (login Gcoop) — distinto do app COOPVITTA. */
export function getGcoopAreaCooperadoUrl(): string {
  const custom = (env.GCOOP_AREA_COOPERADO_URL || process.env.GCOOP_AREA_COOPERADO_URL || '').trim();
  if (custom) return custom.replace(/\/$/, '');
  return DEFAULT_GCOOP_AREA_COOPERADO_URL;
}
