/**
 * Com VITE_APP_BASE=/app/: move o SPA para dist/app/ e, se existir ../landing,
 * copia a landing para a raiz de dist (site em /, app em /app/).
 * Com VITE_APP_BASE=/ (padrão): não mexe — ficheiros ficam na raiz de dist (Docker, domínio dedicado).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const distDir = path.join(__dirname, '..', 'dist');

/** Docker: landing em frontend/landing; monorepo local: ../landing */
function resolveLandingDir() {
  const candidates = [
    path.join(__dirname, '..', 'landing'),
    path.join(__dirname, '..', '..', 'landing'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const landingDir = resolveLandingDir();

const rawBase = process.env.VITE_APP_BASE || '/';
const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
const useAppSubpath = normalizedBase === '/app/';

function moveSpaIntoAppFolder() {
  const appDir = path.join(distDir, 'app');
  fs.mkdirSync(appDir, { recursive: true });
  const indexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    fs.renameSync(indexHtml, path.join(appDir, 'index.html'));
  }
  const distAssets = path.join(distDir, 'assets');
  if (fs.existsSync(distAssets)) {
    fs.renameSync(distAssets, path.join(appDir, 'assets'));
  }
}

function copyPublicAssetsToApp() {
  const appDir = path.join(distDir, 'app');
  for (const name of [
    'favicon-32.png',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'AppIcon.png',
    'manifest.webmanifest',
    'coopvitta-icon.png',
  ]) {
    const src = path.join(distDir, name);
    const dest = path.join(appDir, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  }
}

if (!useAppSubpath) {
  console.log('merge-landing: VITE_APP_BASE na raiz; nada a fazer.');
  process.exit(0);
}

moveSpaIntoAppFolder();
copyPublicAssetsToApp();

if (process.env.SKIP_LANDING_MERGE === '1') {
  console.log('merge-landing: SKIP_LANDING_MERGE=1 — SPA em /app/; raiz sem landing.');
  process.exit(0);
}

if (!landingDir) {
  console.warn('merge-landing: pasta landing/ não encontrada; só SPA em /app/ (raiz sem site estático).');
  process.exit(0);
}

const copy = (src, dest) => {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copy(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
};

for (const name of fs.readdirSync(landingDir)) {
  const src = path.join(landingDir, name);
  const dest = path.join(distDir, name);
  if (name === 'README.md') continue;
  copy(src, dest);
}

console.log('merge-landing: landing na raiz; app em /app/');
