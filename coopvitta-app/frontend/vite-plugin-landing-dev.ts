import fs from 'fs';
import path from 'path';
import type { Plugin, ViteDevServer } from 'vite';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

function resolveLandingDir(): string | null {
  const candidates = [
    path.resolve(__dirname, 'landing'),
    path.resolve(__dirname, '..', 'landing'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

function resolveLandingFile(landingDir: string, urlPath: string): string | null {
  const clean = decodeURIComponent(urlPath.split('?')[0] || '/');
  const safe = path.normalize(clean).replace(/^(\.\.(\/|\\|$))+/, '');
  const relative = safe === '/' || safe === '' ? 'index.html' : safe.replace(/^\//, '');

  const direct = path.join(landingDir, relative);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

  const withIndex = path.join(landingDir, relative, 'index.html');
  if (fs.existsSync(withIndex) && fs.statSync(withIndex).isFile()) return withIndex;

  if (!path.extname(relative)) {
    const htmlFile = path.join(landingDir, `${relative}.html`);
    if (fs.existsSync(htmlFile) && fs.statSync(htmlFile).isFile()) return htmlFile;
  }

  return null;
}

function shouldDelegateToVite(urlPath: string): boolean {
  return (
    urlPath.startsWith('/app') ||
    urlPath.startsWith('/api') ||
    urlPath.startsWith('/@') ||
    urlPath.startsWith('/__') ||
    urlPath.startsWith('/src') ||
    urlPath.startsWith('/node_modules')
  );
}

function landingDevMiddleware(landingDir: string) {
  return (req: import('http').IncomingMessage, res: import('http').ServerResponse, next: () => void) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const urlPath = (req.url || '/').split('?')[0];
    if (shouldDelegateToVite(urlPath)) return next();

    let filePath = resolveLandingFile(landingDir, urlPath);
    if (!filePath && urlPath === '/AppIcon.png') {
      filePath = resolveLandingFile(landingDir, '/icon-192.png');
    }
    if (!filePath) return next();

    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  };
}

/** Em dev com VITE_APP_BASE=/app/, serve landing/ na raiz (como merge-landing em produção). */
export function landingDevPlugin(): Plugin {
  let landingDir: string | null = null;

  return {
    name: 'vite-landing-dev',
    apply: 'serve',
    enforce: 'pre',
    configResolved(config) {
      const base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      if (base !== '/app/') {
        landingDir = null;
        return;
      }
      landingDir = resolveLandingDir();
      if (!landingDir) {
        console.warn('[landing-dev] Pasta landing/ não encontrada; só SPA em /app/.');
      }
    },
    configureServer(server: ViteDevServer) {
      if (!landingDir) return;
      server.middlewares.use(landingDevMiddleware(landingDir));
      const logUrls = () => {
        const addr = server.httpServer?.address();
        const port =
          typeof addr === 'object' && addr !== null && 'port' in addr ? addr.port : server.config.server.port;
        console.log(`[landing-dev] Landing oficial → http://localhost:${port}/`);
        console.log(`[landing-dev] App React → http://localhost:${port}/app/login`);
      };
      if (server.httpServer?.listening) logUrls();
      else server.httpServer?.once('listening', logUrls);
    },
  };
}
