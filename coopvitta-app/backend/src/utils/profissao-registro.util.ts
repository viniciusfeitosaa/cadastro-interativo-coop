import { normalizeCRM, validateCRM } from './validation.util';

/**
 * Profissões em que não exigimos número de conselho (certificação / outro enquadramento).
 * Mantém-se curto; acrescente aqui se a lista pública mudar.
 */
export const PROFISSOES_SEM_REGISTRO_OBRIGATORIO = new Set<string>(['Instrumentador Cirúrgico', 'Perfusionista']);

export function profissaoExigeRegistroConselho(profissao: string): boolean {
  const p = (profissao || '').trim();
  if (!p) return false;
  return !PROFISSOES_SEM_REGISTRO_OBRIGATORIO.has(p);
}

/**
 * Normaliza registro genérico (COREN, CRP, CRN, etc.) para armazenar em `medicos.crm`.
 */
export function normalizeRegistroGenerico(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, ' ').toUpperCase();
  const cleaned = t.replace(/[^A-Z0-9\-/.\s]/g, '').trim();
  if (cleaned.length < 4 || cleaned.length > 60) return null;
  return cleaned;
}

/**
 * Valor canônico do registro profissional conforme a profissão (coluna `crm` no banco).
 */
export function normalizeRegistroConselhoParaProfissao(
  profissao: string,
  raw: string | undefined | null
): string | null {
  if (raw === undefined || raw === null) return null;
  const r = raw.trim();
  if (!r) return null;
  const p = profissao.trim();

  if (p === 'Médico') {
    const n = normalizeCRM(r);
    return n && validateCRM(n) ? n : null;
  }

  if (p === 'Cirurgião-Dentista') {
    const n = normalizeCRM(r);
    if (n && validateCRM(n)) return n;
    return normalizeRegistroGenerico(r);
  }

  if (!profissaoExigeRegistroConselho(p)) {
    return r ? normalizeRegistroGenerico(r) : null;
  }

  return normalizeRegistroGenerico(r);
}

/** Resolve registro para persistir; lança 400 se obrigatório e inválido/ausente. */
export function resolveRegistroConselhoParaCadastro(profissao: string, raw: string | undefined | null): string | null {
  const p = profissao.trim();
  if (!profissaoExigeRegistroConselho(p)) {
    const opt = normalizeRegistroConselhoParaProfissao(p, raw);
    return opt;
  }
  const n = normalizeRegistroConselhoParaProfissao(p, raw);
  if (!n) {
    if (p === 'Médico') {
      throw { statusCode: 400, message: 'CRM inválido ou ausente. Use o formato número-UF (ex.: 12345-CE).' };
    }
    throw {
      statusCode: 400,
      message:
        'Registro no conselho inválido ou ausente. Informe o número conforme seu conselho (mín. 4 caracteres, letras e números).',
    };
  }
  return n;
}
