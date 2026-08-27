import env from '../../config/env';

const DEFAULT_PARTNER_REGISTRATION_URL =
  'https://onvio.com.br/clientcenter/pt/actions/service-request/partner-registration';
const DEFAULT_AUDIENCE = '409f91f6-dc17-44c8-a5d8-e0a1bafd8b67';
const DEFAULT_REDIRECT_URI = 'https://app.coopvitta.cloud/api/integrations/onvio/callback';

export function getOnvioConfig() {
  const baseUrl = (env.ONVIO_API_BASE_URL || '').trim().replace(/\/$/, '');
  const clientId = (env.ONVIO_CLIENT_ID || '').trim();
  const clientSecret = env.ONVIO_CLIENT_SECRET ?? '';
  const integrationKey = (env.ONVIO_INTEGRATION_KEY || '').trim();
  const authUrl = (env.ONVIO_AUTH_URL || '').trim();
  const tokenUrl = (env.ONVIO_TOKEN_URL || '').trim();
  const audience = (env.ONVIO_AUDIENCE || '').trim() || DEFAULT_AUDIENCE;
  const redirectUri = (env.ONVIO_REDIRECT_URI || '').trim() || DEFAULT_REDIRECT_URI;
  const refreshToken = (env.ONVIO_REFRESH_TOKEN || '').trim();
  const accessToken = (env.ONVIO_ACCESS_TOKEN || '').trim();
  const integrationPath = (env.ONVIO_INTEGRATION_PATH || '/v1/integration').trim();
  const clientInfoPath = (env.ONVIO_CLIENTINFO_PATH || '/v1/clientinfo').trim();
  const partnerCreatePath = (env.ONVIO_PARTNER_CREATE_PATH || '').trim();
  const partnerRegistrationUrl =
    (env.ONVIO_PARTNER_REGISTRATION_URL || '').trim() || DEFAULT_PARTNER_REGISTRATION_URL;
  const timeoutMs = parseInt(env.ONVIO_API_TIMEOUT_MS || env.HTTP_EXTERNAL_TIMEOUT_MS || '30000', 10) || 30000;

  return {
    baseUrl,
    clientId,
    clientSecret,
    integrationKey,
    authUrl,
    tokenUrl,
    audience,
    redirectUri,
    refreshToken,
    accessToken,
    integrationPath,
    clientInfoPath,
    partnerCreatePath,
    partnerRegistrationUrl,
    timeoutMs,
  };
}

/** Credenciais OAuth mínimas para trocar tokens. */
export function isOnvioOauthConfigured(): boolean {
  const c = getOnvioConfig();
  return Boolean(c.clientId && c.clientSecret && c.tokenUrl);
}

/**
 * Sync de partner-registration via API só com path confirmado pelo Onvio
 * (+ OAuth e base URL).
 */
export function isOnvioPartnerCreateConfigured(): boolean {
  const c = getOnvioConfig();
  return Boolean(isOnvioOauthConfigured() && c.baseUrl && c.partnerCreatePath);
}

export function getOnvioStatusPublic() {
  const c = getOnvioConfig();
  return {
    oauthConfigured: isOnvioOauthConfigured(),
    partnerCreateConfigured: isOnvioPartnerCreateConfigured(),
    integrationKeyPresent: Boolean(c.integrationKey),
    apiBaseConfigured: Boolean(c.baseUrl),
    partnerRegistrationUrl: c.partnerRegistrationUrl,
    redirectUri: c.redirectUri,
    message: isOnvioPartnerCreateConfigured()
      ? 'API de criação Onvio configurada.'
      : 'Aguardando OAuth (client_id/secret) e ONVIO_PARTNER_CREATE_PATH confirmado pelo Onvio. Ver docs/ONVIO-INTEGRACAO.md.',
  };
}
