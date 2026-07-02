import type { Request, Response, NextFunction } from 'express';

const DEFAULT_MS = Math.max(
  1000,
  parseInt(process.env.HTTP_REQUEST_TIMEOUT_MS || '30000', 10)
);

/** Encerra requisições HTTP que excedem o tempo (evita threads presas). */
export function requestTimeoutMiddleware(timeoutMs = DEFAULT_MS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished || res.headersSent) return;
      finished = true;
      res.status(503).json({
        success: false,
        error: 'Tempo de resposta esgotado. Tente novamente.',
      });
      res.end();
    }, timeoutMs);

    res.on('finish', () => {
      finished = true;
      clearTimeout(timer);
    });
    res.on('close', () => {
      finished = true;
      clearTimeout(timer);
    });

    req.setTimeout(timeoutMs);
    res.setTimeout(timeoutMs);
    next();
  };
}
