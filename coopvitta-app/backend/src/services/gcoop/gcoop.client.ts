import type { GcoopDadosIniciais, GcoopDomainItem, GcoopPreCadastroPayload } from '../../types/gcoop.types';
import { getGcoopConfig } from './gcoop.config';

export class GcoopApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body?: unknown,
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'GcoopApiError';
  }
}

function buildAuthHeader(user: string, password: string): string {
  const token = Buffer.from(`${user}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

async function gcoopFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { baseUrl, user, password, timeoutMs: defaultTimeout } = getGcoopConfig();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutMs = init?.timeoutMs ?? defaultTimeout;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: buildAuthHeader(user, password),
        ...(init?.headers || {}),
      },
    });

    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!res.ok) {
      const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
      let msg = `Gcoop HTTP ${res.status}`;
      if (typeof body === 'string' && body.trim()) {
        msg = body.trim().replace(/^"|"$/g, '');
      } else if (typeof body === 'object' && body) {
        const b = body as {
          Message?: unknown;
          message?: unknown;
          sucesso?: boolean;
          erros?: Array<{ propriedade?: string; erros?: string[] }>;
        };
        if (Array.isArray(b.erros) && b.erros.length) {
          msg = b.erros
            .map((e) => {
              const prop = e.propriedade ? `${e.propriedade}: ` : '';
              const details = Array.isArray(e.erros) ? e.erros.join('; ') : '';
              return `${prop}${details}`.trim();
            })
            .filter(Boolean)
            .join(' | ');
        } else if (b.Message != null) {
          msg = String(b.Message);
        } else if (b.message != null) {
          msg = String(b.message);
        }
      }
      throw new GcoopApiError(msg || `Gcoop HTTP ${res.status}`, res.status, body, retryable);
    }

    return body as T;
  } catch (err) {
    if (err instanceof GcoopApiError) throw err;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    throw new GcoopApiError(
      isAbort ? 'Timeout ao contactar o Gcoop' : 'Falha de rede ao contactar o Gcoop',
      isAbort ? 408 : 0,
      undefined,
      true
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchGcoopDadosIniciais(): Promise<GcoopDadosIniciais> {
  return gcoopFetch<GcoopDadosIniciais>('/Api/ImportPreCadastro/PreCadastro/DadosIniciais');
}

export async function fetchGcoopCidades(ufSigla: string): Promise<GcoopDomainItem[]> {
  const data = await gcoopFetch<GcoopDomainItem[] | { Message?: string }>(
    `/Api/ImportPreCadastro/PreCadastro/Cidades?_idUF=${encodeURIComponent(ufSigla.trim().toUpperCase().slice(0, 2))}`
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchGcoopPreCadastro(cpf: string): Promise<unknown> {
  const digits = cpf.replace(/\D/g, '');
  return gcoopFetch<unknown>(
    `/Api/ImportPreCadastro/PreCadastro/GetPreCadastro?_cpf=${encodeURIComponent(digits)}`
  );
}

/**
 * Converte Buffer → string JSON `[b0,b1,...]` (Collection<byte> .NET)
 * sem criar number[] intermediário (economia de memória ~8x vs Array.from).
 */
function bufferToJsonByteArray(buf: Buffer): string {
  const out = Buffer.allocUnsafe(buf.length * 4 + 2);
  let o = 0;
  out[o++] = 91; // [
  for (let i = 0; i < buf.length; i++) {
    if (i) out[o++] = 44; // ,
    const b = buf[i]!;
    if (b >= 100) {
      out[o++] = 48 + ((b / 100) | 0);
      out[o++] = 48 + (((b % 100) / 10) | 0);
      out[o++] = 48 + (b % 10);
    } else if (b >= 10) {
      out[o++] = 48 + ((b / 10) | 0);
      out[o++] = 48 + (b % 10);
    } else {
      out[o++] = 48 + b;
    }
  }
  out[o++] = 93; // ]
  return out.subarray(0, o).toString('latin1');
}

const DOC_FLAT_KEYS = ['CNH', 'ComprovanteEndereco', 'CarteiraConselho'] as const;

/** Serializa o payload Gcoop; Buffers de documento viram arrays JSON de bytes. */
export function serializeGcoopPreCadastroPayload(payload: GcoopPreCadastroPayload): string {
  const docs: Partial<Record<(typeof DOC_FLAT_KEYS)[number], Buffer>> = {};
  const rest: Record<string, unknown> = { ...payload };

  for (const key of DOC_FLAT_KEYS) {
    const val = rest[key];
    delete rest[key];
    if (Buffer.isBuffer(val) && val.length > 0) {
      docs[key] = val;
    }
  }

  let body = JSON.stringify(rest);
  if (body.endsWith('}')) {
    body = body.slice(0, -1);
    for (const key of DOC_FLAT_KEYS) {
      const buf = docs[key];
      if (!buf) continue;
      body += `,"${key}":${bufferToJsonByteArray(buf)}`;
    }
    body += '}';
  }
  return body;
}

export async function postGcoopPreCadastro(payload: GcoopPreCadastroPayload): Promise<unknown> {
  // Documentos grandes (dezenas de MB em JSON) precisam de timeout maior que o GET.
  return gcoopFetch<unknown>('/Api/ImportPreCadastro/PreCadastro/Post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: serializeGcoopPreCadastroPayload(payload),
    timeoutMs: Math.max(getGcoopConfig().timeoutMs, 120_000),
  });
}