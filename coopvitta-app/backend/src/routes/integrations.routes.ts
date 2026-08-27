import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { exchangeOnvioAuthorizationCode, buildOnvioAuthorizeUrl } from '../services/onvio/onvio.oauth';
import { getOnvioConfig } from '../services/onvio/onvio.config';

const router = Router();

function tokensFilePath(): string {
  return path.resolve(process.cwd(), '.onvio-oauth-tokens.json');
}

/**
 * Callback OAuth Onvio (redirect_uri).
 * Troca `code` por tokens e grava refresh em ficheiro local (não versionar).
 */
router.get('/onvio/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const error = typeof req.query.error === 'string' ? req.query.error : '';
  if (error) {
    return res.status(400).type('html').send(`<!doctype html><html><body>
      <h1>Onvio OAuth — erro</h1>
      <p>${error}</p>
      <p>${String(req.query.error_description || '')}</p>
    </body></html>`);
  }
  if (!code) {
    const authorizeUrl = buildOnvioAuthorizeUrl('coopvitta');
    return res.status(400).type('html').send(`<!doctype html><html><body>
      <h1>Onvio OAuth</h1>
      <p>Query <code>code</code> ausente.</p>
      ${authorizeUrl ? `<p><a href="${authorizeUrl}">Iniciar autorização</a></p>` : '<p>Configure ONVIO_AUTH_URL e ONVIO_CLIENT_ID.</p>'}
    </body></html>`);
  }

  try {
    const tokens = await exchangeOnvioAuthorizationCode(code);
    const c = getOnvioConfig();
    const file = tokensFilePath();
    if (tokens.refresh_token || tokens.access_token) {
      fs.writeFileSync(
        file,
        JSON.stringify(
          {
            savedAt: new Date().toISOString(),
            expires_in: tokens.expires_in,
            has_refresh_token: Boolean(tokens.refresh_token),
            refresh_token: tokens.refresh_token || null,
            access_token: tokens.access_token,
          },
          null,
          2
        ),
        { mode: 0o600 }
      );
    }
    return res.status(200).type('html').send(`<!doctype html><html><body>
      <h1>Onvio OAuth — sucesso</h1>
      <p>Tokens gravados em ficheiro local no servidor (permissão 600).</p>
      <p>No servidor, copie <code>refresh_token</code> para <code>ONVIO_REFRESH_TOKEN</code> no <code>.env</code> e apague o ficheiro.</p>
      <p>Redirect: ${c.redirectUri}</p>
      <p>Spike: <code>node backend/scripts/onvio-spike-auth.mjs</code></p>
    </body></html>`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro OAuth';
    return res.status(502).type('html').send(`<!doctype html><html><body>
      <h1>Onvio OAuth — falha na troca do code</h1>
      <p>${message}</p>
    </body></html>`);
  }
});

export default router;
