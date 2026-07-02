import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import env from './config/env';
import { buildHelmetMiddleware } from './config/helmet.config';
import { isShuttingDown } from './config/shutdown';
import { globalApiLimiter } from './middleware/rate-limit.middleware';
import { requestTimeoutMiddleware } from './middleware/request-timeout.middleware';
import { sanitizeBodyMiddleware } from './middleware/sanitize.middleware';
import { safeLogger } from './utils/safe-logger';

// Importar rotas
import authRoutes from './routes/auth.routes';
import medicoRoutes from './routes/medico.routes';
import adminRoutes from './routes/admin.routes';
import pontoRoutes from './routes/ponto.routes';
import leadsRoutes from './routes/leads.routes';
import blogRoutes from './routes/blog.routes';

// Criar aplicação Express
const app: Express = express();

// Necessário atrás do proxy do Render (evita erro do express-rate-limit com X-Forwarded-For)
app.set('trust proxy', 1);

// Middleware de segurança
app.use(buildHelmetMiddleware());

// Desligamento gracioso: rejeita novas requisições durante SIGTERM
app.use((_req: Request, res: Response, next: NextFunction) => {
  if (isShuttingDown()) {
    res.setHeader('Connection', 'close');
    return res.status(503).json({
      success: false,
      error: 'Servidor em manutenção. Tente novamente em instantes.',
    });
  }
  return next();
});

// CORS – origem de produção sempre permitida; demais vêm do env (trim para evitar espaços)
const originsFromEnv = [
  ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean) : []),
  ...(env.FRONTEND_URL ? [env.FRONTEND_URL.trim()] : []),
];
const allowedOriginsSet = new Set([
  'https://app.coopvitta.cloud',
  'https://coopvitta.cloud',
  'http://localhost:3000',
  'http://localhost:5173',
  ...originsFromEnv,
]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOriginsSet.has(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting global (Redis se REDIS_URL; senão memória)
const rateWindowMs = parseInt(env.RATE_LIMIT_WINDOW_MS, 10) || 900000;
const rateMax = Math.max(100, parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10) || 500);
app.use('/api', globalApiLimiter(rateWindowMs, rateMax));

// Timeout HTTP + sanitização de body JSON
app.use(requestTimeoutMiddleware(parseInt(env.HTTP_REQUEST_TIMEOUT_MS, 10) || 30000));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeBodyMiddleware);
// Arquivos em uploads/ não são mais servidos publicamente (ver rotas autenticadas em medico/ponto/admin).

// Observabilidade básica (tempo por request) — habilite com REQUEST_LOG_MS=200 (exemplo).
const REQUEST_LOG_MS = parseInt(process.env.REQUEST_LOG_MS || '', 10);
if (Number.isFinite(REQUEST_LOG_MS) && REQUEST_LOG_MS > 0) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      if (ms >= REQUEST_LOG_MS) {
        console.log(`[HTTP] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
      }
    });
    next();
  });
}

// Garantir que respostas JSON sejam enviadas em UTF-8 (evita mojibake na exibição)
app.use((_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = function (this: Response, body: unknown) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson(body);
  };
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/medico', medicoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ponto', pontoRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/blog', blogRoutes);

// Rota raiz
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'API App Médico',
    version: '1.0.0',
    status: 'running',
  });
});

// Middleware de erro 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
  });
});

// Middleware de tratamento de erros — nunca expõe stack trace em produção
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  safeLogger.error('Erro não tratado:', err);

  const isTimeout = /timeout/i.test(err.message);
  const isCircuitOpen = /indisponível/i.test(err.message);

  if (isCircuitOpen) {
    return res.status(503).json({
      success: false,
      error: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
    });
  }

  return res.status(isTimeout ? 503 : 500).json({
    success: false,
    error: isTimeout
      ? 'Operação excedeu o tempo limite.'
      : 'Erro interno do servidor',
    message: env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Função para inicializar a aplicação (não espera o banco – conexão em background no server.ts)
export function createApp(): Express {
  return app;
}

export default app;
