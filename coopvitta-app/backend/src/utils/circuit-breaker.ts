import env from '../config/env';

type BreakerState = 'closed' | 'open' | 'half-open';

const THRESHOLD = Math.max(3, parseInt(env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5', 10));
const RESET_MS = Math.max(10_000, parseInt(env.CIRCUIT_BREAKER_RESET_MS || '60000', 10));

class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private state: BreakerState = 'closed';

  constructor(private readonly name: string) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt >= RESET_MS) {
        this.state = 'half-open';
      } else {
        throw new Error(`Serviço externo indisponível (${this.name}). Tente novamente em instantes.`);
      }
    }

    try {
      const result = await fn();
      this.failures = 0;
      if (this.state === 'half-open') this.state = 'closed';
      return result;
    } catch (err) {
      this.failures += 1;
      if (this.failures >= THRESHOLD) {
        this.state = 'open';
        this.openedAt = Date.now();
      }
      throw err;
    }
  }
}

const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(key: string): CircuitBreaker {
  const normalized = key.toLowerCase();
  let breaker = registry.get(normalized);
  if (!breaker) {
    breaker = new CircuitBreaker(normalized);
    registry.set(normalized, breaker);
  }
  return breaker;
}

export function circuitKeyFromUrl(input: string | URL): string {
  try {
    const url = typeof input === 'string' ? new URL(input) : input;
    return url.hostname;
  } catch {
    return 'unknown';
  }
}
