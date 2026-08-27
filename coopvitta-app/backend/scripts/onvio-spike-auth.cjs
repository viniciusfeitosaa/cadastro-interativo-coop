#!/usr/bin/env node
/**
 * Spike Onvio BR — valida env OAuth e, se possível, chama IntegrationResource / ClientInfoResource.
 *
 * Uso (na VPS ou local com .env):
 *   node scripts/onvio-spike-auth.mjs
 *
 * Sem client_id/secret o script encerra com código 2 (pré-requisito do plano).
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const rootEnv = path.resolve(__dirname, '../../../.env');
const backendEnv = path.resolve(__dirname, '../.env');
const optEnv = '/opt/coopvitta/coopvitta-app/.env';
loadEnvFile(optEnv);
loadEnvFile(rootEnv);
loadEnvFile(backendEnv);

function present(name) {
  return Boolean((process.env[name] || '').trim());
}

async function main() {
  console.log('[onvio-spike] Verificando configuração...');
  const checks = {
    ONVIO_CLIENT_ID: present('ONVIO_CLIENT_ID'),
    ONVIO_CLIENT_SECRET: present('ONVIO_CLIENT_SECRET'),
    ONVIO_TOKEN_URL: present('ONVIO_TOKEN_URL'),
    ONVIO_AUTH_URL: present('ONVIO_AUTH_URL'),
    ONVIO_API_BASE_URL: present('ONVIO_API_BASE_URL'),
    ONVIO_INTEGRATION_KEY: present('ONVIO_INTEGRATION_KEY'),
    ONVIO_REFRESH_TOKEN: present('ONVIO_REFRESH_TOKEN'),
    ONVIO_ACCESS_TOKEN: present('ONVIO_ACCESS_TOKEN'),
    ONVIO_PARTNER_CREATE_PATH: present('ONVIO_PARTNER_CREATE_PATH'),
  };
  for (const [k, ok] of Object.entries(checks)) {
    console.log(`  ${ok ? 'OK' : '--'} ${k}`);
  }

  if (!checks.ONVIO_CLIENT_ID || !checks.ONVIO_CLIENT_SECRET) {
    console.log('');
    console.log(
      '[onvio-spike] BLOQUEADO: sem OAuth (client_id/client_secret). Envie o e-mail em docs/ONVIO-PEDIDO-CREDENCIAIS.md.'
    );
    process.exit(2);
  }

  if (!checks.ONVIO_TOKEN_URL) {
    console.log('[onvio-spike] BLOQUEADO: falta ONVIO_TOKEN_URL (informada pelo Onvio).');
    process.exit(2);
  }

  if (!checks.ONVIO_REFRESH_TOKEN && !checks.ONVIO_ACCESS_TOKEN) {
    console.log(
      '[onvio-spike] OAuth parcial: falta ONVIO_REFRESH_TOKEN ou ONVIO_ACCESS_TOKEN para chamar a API.'
    );
    console.log('  1) Abra ONVIO_AUTH_URL com client_id + redirect_uri');
    console.log('  2) Troque o code por tokens (grant authorization_code)');
    console.log('  3) Grave ONVIO_REFRESH_TOKEN no .env e rode de novo');
    process.exit(2);
  }

  if (!checks.ONVIO_API_BASE_URL) {
    console.log('[onvio-spike] Falta ONVIO_API_BASE_URL para IntegrationResource/ClientInfoResource.');
    process.exit(2);
  }

  // Carrega cliente compilado se existir; senão usa fetch inline
  let accessToken = (process.env.ONVIO_ACCESS_TOKEN || '').trim();
  if ((process.env.ONVIO_REFRESH_TOKEN || '').trim()) {
    const tokenUrl = process.env.ONVIO_TOKEN_URL.trim();
    const basic = Buffer.from(
      `${process.env.ONVIO_CLIENT_ID.trim()}:${process.env.ONVIO_CLIENT_SECRET}`,
      'utf8'
    ).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.ONVIO_REFRESH_TOKEN.trim(),
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) {
      console.error('[onvio-spike] Falha no refresh_token:', res.status, json);
      process.exit(1);
    }
    accessToken = json.access_token;
    console.log('[onvio-spike] access_token obtido via refresh_token');
  } else {
    console.log('[onvio-spike] usando ONVIO_ACCESS_TOKEN do env');
  }

  const base = process.env.ONVIO_API_BASE_URL.replace(/\/$/, '');
  const integrationPath = (process.env.ONVIO_INTEGRATION_PATH || '/v1/integration').trim();
  const clientInfoPath = (process.env.ONVIO_CLIENTINFO_PATH || '/v1/clientinfo').trim();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };
  if ((process.env.ONVIO_INTEGRATION_KEY || '').trim()) {
    headers['x-integration-key'] = process.env.ONVIO_INTEGRATION_KEY.trim();
  }

  for (const [label, p] of [
    ['IntegrationResource', integrationPath],
    ['ClientInfoResource', clientInfoPath],
  ]) {
    const url = `${base}${p.startsWith('/') ? p : `/${p}`}`;
    console.log(`[onvio-spike] GET ${url}`);
    const res = await fetch(url, { headers });
    const text = await res.text();
    console.log(`  HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  if (!checks.ONVIO_PARTNER_CREATE_PATH) {
    console.log(
      '[onvio-spike] Auth/API básica ok (se 2xx acima). Partner-registration ainda sem path — sync de criação permanece desligado.'
    );
  }

  console.log('[onvio-spike] concluído');
}

main().catch((err) => {
  console.error('[onvio-spike] erro', err);
  process.exit(1);
});
