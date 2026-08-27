import { getOnvioConfig, isOnvioOauthConfigured } from './onvio.config';

export type OnvioTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`;
}

async function postToken(body: URLSearchParams): Promise<OnvioTokenResponse> {
  const c = getOnvioConfig();
  if (!c.tokenUrl || !c.clientId || !c.clientSecret) {
    throw Object.assign(new Error('Onvio OAuth não configurado (ONVIO_CLIENT_ID/SECRET/TOKEN_URL)'), {
      statusCode: 503,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);
  try {
    const res = await fetch(c.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(c.clientId, c.clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    let json: OnvioTokenResponse & { error?: string; error_description?: string };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw Object.assign(new Error(`Onvio token: resposta inválida HTTP ${res.status}`), {
        statusCode: 502,
      });
    }
    if (!res.ok || !json.access_token) {
      const detail = json.error_description || json.error || text.slice(0, 500);
      throw Object.assign(new Error(`Onvio token HTTP ${res.status}: ${detail}`), { statusCode: 502 });
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export async function exchangeOnvioAuthorizationCode(code: string): Promise<OnvioTokenResponse> {
  const c = getOnvioConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: c.redirectUri,
  });
  return postToken(body);
}

export async function refreshOnvioAccessToken(refreshToken?: string): Promise<OnvioTokenResponse> {
  const c = getOnvioConfig();
  const token = (refreshToken || c.refreshToken || '').trim();
  if (!token) {
    throw Object.assign(
      new Error('ONVIO_REFRESH_TOKEN ausente — complete o fluxo OAuth e grave o refresh token no .env'),
      { statusCode: 503 }
    );
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: token,
  });
  return postToken(body);
}

/** Preferência: refresh → access token estático de env (spike). */
export async function resolveOnvioAccessToken(): Promise<string> {
  const c = getOnvioConfig();
  if (c.refreshToken && isOnvioOauthConfigured()) {
    const tokens = await refreshOnvioAccessToken(c.refreshToken);
    return tokens.access_token;
  }
  if (c.accessToken) return c.accessToken;
  throw Object.assign(
    new Error(
      'Sem access token Onvio. Configure ONVIO_REFRESH_TOKEN (após OAuth) ou ONVIO_ACCESS_TOKEN para spike.'
    ),
    { statusCode: 503 }
  );
}

export function buildOnvioAuthorizeUrl(state?: string): string | null {
  const c = getOnvioConfig();
  if (!c.authUrl || !c.clientId) return null;
  const u = new URL(c.authUrl);
  u.searchParams.set('client_id', c.clientId);
  u.searchParams.set('redirect_uri', c.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('audience', c.audience);
  u.searchParams.set('scope', 'openid profile email offline_access');
  if (state) u.searchParams.set('state', state);
  return u.toString();
}
