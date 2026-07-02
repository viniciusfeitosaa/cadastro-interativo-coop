const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'senhaHash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'cpf',
  'cartao',
  'card',
  'cvv',
  'secret',
  'apiKey',
  'api_key',
]);

const PATTERNS: RegExp[] = [
  /Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi,
  /(password|senha|token|secret|api[_-]?key)\s*[:=]\s*["']?[^\s"',}]+/gi,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  /\b\d{11}\b/g,
];

function scrubString(value: string): string {
  let out = value;
  for (const re of PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

/** Remove PII e credenciais de objetos antes de logar ou persistir em auditoria. */
export function scrubSensitiveData<T>(input: T, depth = 0): T {
  if (depth > 8) return input;
  if (input == null || typeof input !== 'object') {
    if (typeof input === 'string') return scrubString(input) as T;
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => scrubSensitiveData(item, depth + 1)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      out[key] = scrubString(value);
    } else {
      out[key] = scrubSensitiveData(value, depth + 1);
    }
  }
  return out as T;
}
