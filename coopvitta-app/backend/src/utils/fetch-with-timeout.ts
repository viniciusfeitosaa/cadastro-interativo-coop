import { circuitKeyFromUrl, getCircuitBreaker } from './circuit-breaker';

const DEFAULT_MS = Math.max(
  1000,
  parseInt(process.env.HTTP_EXTERNAL_TIMEOUT_MS || '10000', 10)
);

/** fetch com timeout + circuit breaker por host externo. */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_MS
): Promise<Response> {
  const breaker = getCircuitBreaker(circuitKeyFromUrl(input));

  return breaker.execute(async () => {
    const usesExternalSignal = Boolean(init.signal);
    const controller = new AbortController();
    const timer = usesExternalSignal
      ? undefined
      : setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, {
        ...init,
        signal: init.signal ?? controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Requisição externa excedeu ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  });
}
