import { getOnvioConfig } from './onvio.config';
import { resolveOnvioAccessToken } from './onvio.oauth';

function joinUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${p}`;
}

async function onvioFetch(
  path: string,
  init: RequestInit & { accessToken?: string } = {}
): Promise<{ status: number; body: unknown; raw: string }> {
  const c = getOnvioConfig();
  if (!c.baseUrl) {
    throw Object.assign(new Error('ONVIO_API_BASE_URL não configurada'), { statusCode: 503 });
  }
  const accessToken = init.accessToken || (await resolveOnvioAccessToken());
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (c.integrationKey) {
    headers['x-integration-key'] = c.integrationKey;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);
  try {
    const { accessToken: _a, ...rest } = init;
    const res = await fetch(joinUrl(c.baseUrl, path), {
      ...rest,
      headers,
      signal: controller.signal,
    });
    const raw = await res.text();
    let body: unknown = raw;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
    return { status: res.status, body, raw };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOnvioIntegrationInfo() {
  const c = getOnvioConfig();
  return onvioFetch(c.integrationPath, { method: 'GET' });
}

export async function fetchOnvioClientInfo() {
  const c = getOnvioConfig();
  return onvioFetch(c.clientInfoPath, { method: 'GET' });
}

export async function postOnvioPartnerRegistration(payload: Record<string, unknown>) {
  const c = getOnvioConfig();
  if (!c.partnerCreatePath) {
    throw Object.assign(
      new Error(
        'ONVIO_PARTNER_CREATE_PATH ausente — endpoint de partner-registration ainda não confirmado pelo Onvio'
      ),
      { statusCode: 503 }
    );
  }
  return onvioFetch(c.partnerCreatePath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
