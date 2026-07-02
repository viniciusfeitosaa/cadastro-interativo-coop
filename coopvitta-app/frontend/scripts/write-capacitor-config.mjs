/**
 * Gera capacitor.config.json a partir de .env / .env.local (evita capacitor.config.ts
 * com "type": "module", que quebra o parser do @capacitor/cli).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raiz do pacote `frontend/` (pai de `scripts/`). */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(rel) {
  const p = resolve(root, rel);
  if (!existsSync(p)) return;
  const content = readFileSync(p, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

let serverUrlRaw = (process.env.CAPACITOR_SERVER_URL || '').trim();
// Importante: o teu host faz 301 de /app (HTTPS) -> /app/ (HTTP). Para evitar cair em HTTP
// dentro do WebView (ERR_CLEARTEXT_NOT_PERMITTED), garantimos /app/ com HTTPS.
let serverUrl = serverUrlRaw;
if (serverUrl.endsWith('/app')) serverUrl = `${serverUrl}/`;

const config = {
  appId: 'com.vivasaude.appvs',
  appName: 'COOPVITTA',
  webDir: 'dist',
  // iOS: força o WKWebView a respeitar a Safe Area (notch / Dynamic Island)
  // sem depender exclusivamente de CSS env(safe-area-inset-*), que pode vir 0 em alguns cenários.
  ios: {
    contentInset: 'always',
  },
};

if (serverUrl) {
  // allowNavigation evita que o WebView delegue a navegação pro Chrome
  // quando a URL é remota (server.url).
  config.server = {
    url: serverUrl,
    cleartext: false,
    allowNavigation: ['sejavivasaude.com.br', '*.sejavivasaude.com.br'],
  };
}

const out = resolve(root, 'capacitor.config.json');
writeFileSync(out, JSON.stringify(config, null, 2) + '\n', 'utf8');
console.log('[write-capacitor-config] escrito', out, serverUrl ? `(server.url=${serverUrl})` : '(sem server.url)');
