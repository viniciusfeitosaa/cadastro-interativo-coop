/**
 * Integração opcional com DocuSeal.
 *
 * Caso habitual (instância própria, ex. https://assinaturas.xxx.cloud):
 * - DOCUSEAL_URL = URL público do DocuSeal (sem /api no fim)
 * - DOCUSEAL_API_KEY = token (Definições → API)
 * A app usa automaticamente `${DOCUSEAL_URL}/api` como base REST e DOCUSEAL_URL para links /s/...
 *
 * Alternativa explícita: DOCUSEAL_API_BASE_URL + DOCUSEAL_API_TOKEN (cloud SaaS ou URL custom).
 * DOCUSEAL_WEB_BASE_URL (opcional) força a origem dos links de assinatura.
 *
 * Convite (POST /admin/medicos/:id/invite): DOCUSEAL_REQUIRED_TEMPLATES + DOCUSEAL_SECOND_SUBMITTER_EMAIL, etc.
 */
import { buildDocusealInviteEmailBody } from '../utils/email-branding.util';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

const DOCUSEAL_DEFAULT_WEB = 'https://docuseal.com';

/** Base URL da API REST (sem barra final). Self-hosted: DOCUSEAL_URL + "/api". SaaS docuseal.com → api.docuseal.com. */
function resolveDocusealApiBase(): string {
  const explicit = process.env.DOCUSEAL_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const hostUrl = process.env.DOCUSEAL_URL?.trim();
  if (!hostUrl) return '';
  const base = hostUrl.replace(/\/$/, '');
  if (/\/api$/i.test(base)) return base;

  try {
    const u = new URL(base);
    const h = u.hostname.toLowerCase();
    if (h === 'api.docuseal.com' || h === 'api.docuseal.eu') return base;
    if (h === 'docuseal.com' || h === 'www.docuseal.com' || h === 'app.docuseal.com') {
      return 'https://api.docuseal.com';
    }
    if (h.endsWith('.docuseal.eu') && !h.startsWith('api.')) {
      return 'https://api.docuseal.eu';
    }
  } catch {
    /* ignore */
  }

  return `${base}/api`;
}

function resolveDocusealToken(): string {
  return (
    process.env.DOCUSEAL_API_TOKEN?.trim() ||
    process.env.DOCUSEAL_API_KEY?.trim() ||
    ''
  );
}

/** Origem pública dos formulários (links /s/...). */
function resolveDocusealWebBase(apiBase: string): string {
  const w = process.env.DOCUSEAL_WEB_BASE_URL?.trim();
  if (w) return w.replace(/\/$/, '');

  const hostUrl = process.env.DOCUSEAL_URL?.trim();
  if (hostUrl) {
    const base = hostUrl.replace(/\/$/, '');
    if (/\/api$/i.test(base)) {
      const stripped = base.replace(/\/api$/i, '');
      return stripped.length > 0 ? stripped : DOCUSEAL_DEFAULT_WEB;
    }
    return base;
  }

  if (apiBase && /\/api$/i.test(apiBase)) {
    const stripped = apiBase.replace(/\/api$/i, '');
    return stripped.length > 0 ? stripped : DOCUSEAL_DEFAULT_WEB;
  }
  return DOCUSEAL_DEFAULT_WEB;
}

/**
 * Alinha com a normalização usada pelo DocuSeal ao gravar e-mails (ex.: @gmail → @gmail.com).
 * Ver `Submissions.normalize_email` no código-fonte DocuSeal.
 */
export function normalizarEmailDocuseal(email: string | null | undefined): string | null {
  let t = (email || '').trim().toLowerCase();
  if (t.length === 0) return null;
  t = t.replace(/@gmail?$/i, '@gmail.com');
  return t;
}

function submitterPrecisaAssinar(status: string | undefined | null): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  return s !== 'completed' && s !== 'declined' && s !== 'expired';
}

/** Lê o primeiro campo definido (suporta respostas snake_case ou camelCase). */
function readKey(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

function numId(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function temTimestampPreenchido(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

/** Prioriza `completed_at` / `declined_at` — a API pode omitir ou desalinhar `status`. */
function submitterAindaDeveAssinar(s: Record<string, unknown>): boolean {
  if (temTimestampPreenchido(readKey(s, 'completed_at', 'completedAt'))) return false;
  if (temTimestampPreenchido(readKey(s, 'declined_at', 'declinedAt'))) return false;
  const status = readKey(s, 'status', 'Status');
  return submitterPrecisaAssinar(typeof status === 'string' ? status : null);
}

function parsePaginationNext(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.length > 0) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function urlAssinaturaSubmitter(sub: Record<string, unknown>, webBase: string): string | null {
  const embedRaw = readKey(sub, 'embed_src', 'embedSrc');
  const embed = typeof embedRaw === 'string' ? embedRaw.trim() : '';
  if (embed) return embed;
  const slugRaw = readKey(sub, 'slug', 'Slug');
  const slug = typeof slugRaw === 'string' ? slugRaw.trim() : '';
  if (!slug) return null;
  const base = webBase.replace(/\/$/, '');
  return `${base}/s/${slug}`;
}

type Credenciais = { ok: false } | { ok: true; apiBase: string; token: string; webBase: string };

function credenciaisDocuseal(): Credenciais {
  const apiBase = resolveDocusealApiBase();
  const token = resolveDocusealToken();
  const webBase = resolveDocusealWebBase(apiBase);
  if (!apiBase || !token) return { ok: false };
  return { ok: true, apiBase, token, webBase };
}

const DOCUSEAL_SUBMISSIONS_PAGE_LIMIT = 100;

type FetchSubmissionsOpts = {
  q?: string;
  /** Se definido, envia ?status=. Omitir = não filtrar por estado na API (filtramos por signatário no código). */
  status?: string;
};

async function fetchSubmissionsPaginated(
  apiBase: string,
  token: string,
  opts: FetchSubmissionsOpts = {}
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let after: number | undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);

  try {
    for (let page = 0; page < 40; page++) {
      const qs = new URLSearchParams({ limit: String(DOCUSEAL_SUBMISSIONS_PAGE_LIMIT) });
      if (opts.status != null && opts.status !== '') qs.set('status', opts.status);
      if (after !== undefined) qs.set('after', String(after));
      if (opts.q != null && opts.q.length > 0) qs.set('q', opts.q);

      const resp = await fetchWithTimeout(`${apiBase}/submissions?${qs}`, {
        method: 'GET',
        headers: { 'X-Auth-Token': token },
        signal: ctrl.signal,
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`DocuSeal HTTP ${resp.status}${txt ? ` — ${txt.slice(0, 200)}` : ''}`);
      }

      const json = (await resp.json()) as Record<string, unknown>;
      let batch: unknown[] = [];
      if (Array.isArray(json.data)) batch = json.data as unknown[];
      else if (Array.isArray(json.submissions)) batch = json.submissions as unknown[];
      if (batch.length === 0) break;

      for (const row of batch) {
        if (row && typeof row === 'object') all.push(row as Record<string, unknown>);
      }

      const pag = json.pagination && typeof json.pagination === 'object' ? (json.pagination as { next?: unknown }) : undefined;
      const nextFromApi = parsePaginationNext(pag?.next);
      let afterNext: number | undefined;

      if (nextFromApi !== undefined && nextFromApi !== after) {
        afterNext = nextFromApi;
      } else if (batch.length === DOCUSEAL_SUBMISSIONS_PAGE_LIMIT) {
        let minId = Infinity;
        for (const row of batch) {
          if (!row || typeof row !== 'object') continue;
          const rid = numId(readKey(row as Record<string, unknown>, 'id', 'Id'));
          if (rid != null && rid < minId) minId = rid;
        }
        if (minId !== Infinity && minId !== after) afterNext = minId;
      }

      if (afterNext === undefined) break;
      after = afterNext;
    }
  } finally {
    clearTimeout(timer);
  }

  return all;
}

async function fetchTodasSubmissionsPendentes(
  apiBase: string,
  token: string,
  q?: string
): Promise<Record<string, unknown>[]> {
  return fetchSubmissionsPaginated(apiBase, token, { q, status: 'pending' });
}

export type DocusealSubPendente = {
  submitterId: number | null;
  name: string | null;
  email: string | null;
  status: string | null;
  signUrl: string | null;
};

export type DocusealPendenteItem = {
  submissionId: number;
  submissionSlug: string | null;
  templateName: string | null;
  createdAt: string | null;
  submittersPendentes: DocusealSubPendente[];
};

function parseSubmissionRow(r: Record<string, unknown>, webBase: string, opts: { fallbackSemSubmitter: boolean }): DocusealPendenteItem | null {
  const submissionId = numId(readKey(r, 'id', 'Id'));
  if (submissionId == null) return null;

  const slugRaw = readKey(r, 'slug', 'Slug');
  const submissionSlug = typeof slugRaw === 'string' ? slugRaw : null;
  const createdRaw = readKey(r, 'created_at', 'createdAt');
  const createdAt = typeof createdRaw === 'string' ? createdRaw : null;
  const tplRaw = readKey(r, 'template', 'Template');
  const tpl = tplRaw && typeof tplRaw === 'object' ? (tplRaw as Record<string, unknown>) : null;
  const nameRaw = tpl ? readKey(tpl, 'name', 'Name') : undefined;
  const templateName = typeof nameRaw === 'string' ? nameRaw : null;

  const submittersRaw = readKey(r, 'submitters', 'Submitters');
  const submittersArr = Array.isArray(submittersRaw) ? submittersRaw : [];
  const submittersPendentes: DocusealSubPendente[] = submittersArr
    .map((su) => {
      if (!su || typeof su !== 'object') return null;
      const s = su as Record<string, unknown>;
      if (!submitterAindaDeveAssinar(s)) return null;
      const sid = numId(readKey(s, 'id', 'Id'));
      const submitterId = sid != null && Number.isFinite(sid) ? sid : null;
      const statusRaw = readKey(s, 'status', 'Status');
      const status = typeof statusRaw === 'string' ? statusRaw : null;
      const nameSub = readKey(s, 'name', 'Name');
      const emailSub = readKey(s, 'email', 'Email');
      return {
        submitterId,
        name: typeof nameSub === 'string' ? nameSub : null,
        email: typeof emailSub === 'string' ? emailSub : null,
        status,
        signUrl: urlAssinaturaSubmitter(s, webBase),
      };
    })
    .filter((x): x is DocusealSubPendente => x != null);

  if (submittersPendentes.length === 0 && opts.fallbackSemSubmitter) {
    const st = readKey(r, 'status', 'Status');
    submittersPendentes.push({
      submitterId: null,
      name: null,
      email: null,
      status: typeof st === 'string' ? st : 'pending',
      signUrl: null,
    });
  }

  if (submittersPendentes.length === 0) return null;

  return {
    submissionId,
    submissionSlug,
    templateName,
    createdAt,
    submittersPendentes,
  };
}

export type DocusealPendenteResultado = {
  configured: boolean;
  error: string | null;
  items: DocusealPendenteItem[];
};

export async function listDocusealPendentesAssinaturaService(): Promise<DocusealPendenteResultado> {
  const c = credenciaisDocuseal();
  if (!c.ok) {
    return { configured: false, error: null, items: [] };
  }

  try {
    const raw = await fetchTodasSubmissionsPendentes(c.apiBase, c.token);
    const items: DocusealPendenteItem[] = [];
    for (const row of raw) {
      const parsed = parseSubmissionRow(row, c.webBase, { fallbackSemSubmitter: true });
      if (parsed) items.push(parsed);
    }
    return { configured: true, error: null, items };
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Tempo esgotado ao contactar DocuSeal.' : e?.message || 'Falha na ligação ao DocuSeal.';
    return { configured: true, error: String(msg), items: [] };
  }
}

export type DocusealDocPendenteProf = {
  /** Pode ser null se a listagem da API não trouxer `id` do signatário (ainda há `signUrl` para assinar). */
  submitterId: number | null;
  submissionId: number;
  templateName: string | null;
  createdAt: string | null;
  name: string | null;
  email: string | null;
  status: string | null;
  signUrl: string | null;
};

function linhaSubmissionArquivada(row: Record<string, unknown>): boolean {
  return temTimestampPreenchido(readKey(row, 'archived_at', 'archivedAt'));
}

/**
 * Por e-mail: signatários que ainda não concluíram (não usa ?status=pending na API — evita falsos “tudo OK”).
 */
function extrairDocsPendentesParaEmailNorm(
  row: Record<string, unknown>,
  emailNorm: string,
  webBase: string
): DocusealDocPendenteProf[] {
  if (linhaSubmissionArquivada(row)) return [];
  const submissionId = numId(readKey(row, 'id', 'Id'));
  if (submissionId == null) return [];

  const createdRaw = readKey(row, 'created_at', 'createdAt');
  const createdAt = typeof createdRaw === 'string' ? createdRaw : null;
  const tplRaw = readKey(row, 'template', 'Template');
  const tpl = tplRaw && typeof tplRaw === 'object' ? (tplRaw as Record<string, unknown>) : null;
  const nameRaw = tpl ? readKey(tpl, 'name', 'Name') : undefined;
  const templateName = typeof nameRaw === 'string' ? nameRaw : null;

  const submittersRaw = readKey(row, 'submitters', 'Submitters');
  const submittersArr = Array.isArray(submittersRaw) ? submittersRaw : [];
  const out: DocusealDocPendenteProf[] = [];

  for (const su of submittersArr) {
    if (!su || typeof su !== 'object') continue;
    const s = su as Record<string, unknown>;
    const emailSub = readKey(s, 'email', 'Email');
    const em = normalizarEmailDocuseal(typeof emailSub === 'string' ? emailSub : null);
    if (em !== emailNorm) continue;
    if (!submitterAindaDeveAssinar(s)) continue;

    const sid = numId(readKey(s, 'id', 'Id'));
    const statusRaw = readKey(s, 'status', 'Status');
    const nameSub = readKey(s, 'name', 'Name');
    out.push({
      submitterId: sid != null && sid > 0 ? sid : null,
      submissionId,
      templateName,
      createdAt,
      name: typeof nameSub === 'string' ? nameSub : null,
      email: typeof emailSub === 'string' ? emailSub : null,
      status: typeof statusRaw === 'string' ? statusRaw : null,
      signUrl: urlAssinaturaSubmitter(s, webBase),
    });
  }
  return out;
}

/** Contagens alinhadas ao painel por médico (DOCUSEAL_REQUIRED_TEMPLATES), para a coluna da listagem. */
export type DocusealResumoAcaoPorEmail = {
  faltaEnviar: number;
  /** Pedido já enviado; o profissional (este e-mail) ainda não assinou. */
  pendenteAssinaturaMedico: number;
  aguardaSegundaParte: number;
};

export type DocusealResumoPorEmailsResultado = {
  configured: boolean;
  error: string | null;
  byEmail: Record<string, DocusealDocPendenteProf[]>;
  /** Por e-mail normalizado; só quando há modelos em DOCUSEAL_REQUIRED_TEMPLATES. */
  acoesPorEmail: Record<string, DocusealResumoAcaoPorEmail>;
};

/**
 * Agrupa documentos pendentes no DocuSeal pelos e-mails dos profissionais desta página.
 * Estratégia em duas camadas (como quando funcionava de forma fiável):
 * 1) Todas as submissões `?status=pending` (paginado) — cruza com os e-mails da página.
 * 2) Por e-mail: `?q=<e-mail>` sem filtro de estado na API — filtra no código quem ainda não assinou.
 * Assim cobre-se self-hosted com pesquisa `q` falhável e cloud/SaaS com muitos pedidos.
 */
export async function docusealResumoPorEmailsService(emails: string[]): Promise<DocusealResumoPorEmailsResultado> {
  const c = credenciaisDocuseal();
  if (!c.ok) {
    return { configured: false, error: null, byEmail: {}, acoesPorEmail: {} };
  }

  const normSet = new Set<string>();
  for (const e of emails) {
    const n = normalizarEmailDocuseal(e);
    if (n) normSet.add(n);
  }

  const requiredTemplates = parseRequiredTemplates();
  const temPainelPorTemplates = requiredTemplates.length > 0;

  const byEmail: Record<string, DocusealDocPendenteProf[]> = {};
  const acoesPorEmail: Record<string, DocusealResumoAcaoPorEmail> = {};
  const seenKeys: Record<string, Set<string>> = {};
  for (const n of normSet) {
    byEmail[n] = [];
    seenKeys[n] = new Set<string>();
    if (temPainelPorTemplates) {
      acoesPorEmail[n] = { faltaEnviar: 0, pendenteAssinaturaMedico: 0, aguardaSegundaParte: 0 };
    }
  }

  const appendProfDoc = (emailNorm: string, doc: DocusealDocPendenteProf) => {
    const k =
      doc.submitterId != null && doc.submitterId > 0
        ? `${doc.submissionId}-${doc.submitterId}`
        : `${doc.submissionId}-u-${doc.signUrl || 'na'}`;
    const s = seenKeys[emailNorm];
    if (s.has(k)) return;
    s.add(k);
    byEmail[emailNorm].push(doc);
  };

  const mergePendingGlobalParaNormSet = (raw: Record<string, unknown>[]) => {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      for (const emailNorm of normSet) {
        for (const doc of extrairDocsPendentesParaEmailNorm(r, emailNorm, c.webBase)) {
          appendProfDoc(emailNorm, doc);
        }
      }
    }
  };

  try {
    const rawPendingGlobal = await fetchTodasSubmissionsPendentes(c.apiBase, c.token);
    mergePendingGlobalParaNormSet(rawPendingGlobal);

    const lista = [...normSet];
    let cursor = 0;
    const conc = Math.min(5, Math.max(1, lista.length));

    const worker = async () => {
      let wi: number;
      while ((wi = cursor++) < lista.length) {
        const emailNorm = lista[wi];
        const raw = await fetchSubmissionsPaginated(c.apiBase, c.token, { q: emailNorm });
        if (temPainelPorTemplates) {
          const docs = documentosPainelFromRaw(raw, emailNorm, c.webBase, requiredTemplates);
          acoesPorEmail[emailNorm] = contarEstadosPainelDocumentos(docs);
        }
        for (const row of raw) {
          if (!row || typeof row !== 'object') continue;
          for (const doc of extrairDocsPendentesParaEmailNorm(row as Record<string, unknown>, emailNorm, c.webBase)) {
            appendProfDoc(emailNorm, doc);
          }
        }
      }
    };

    await Promise.all(Array.from({ length: conc }, () => worker()));

    return { configured: true, error: null, byEmail, acoesPorEmail };
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Tempo esgotado ao contactar DocuSeal.' : e?.message || 'Falha na ligação ao DocuSeal.';
    return { configured: true, error: String(msg), byEmail: {}, acoesPorEmail: {} };
  }
}

export async function docusealResendEmailSubmitterService(submitterId: number): Promise<void> {
  const c = credenciaisDocuseal();
  if (!c.ok) {
    throw { statusCode: 503, message: 'DocuSeal não está configurado no servidor.' };
  }
  if (!Number.isFinite(submitterId) || submitterId <= 0) {
    throw { statusCode: 400, message: 'submitterId inválido' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await fetchWithTimeout(`${c.apiBase}/submitters/${submitterId}`, {
      method: 'PUT',
      headers: {
        'X-Auth-Token': c.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ send_email: true }),
      signal: ctrl.signal,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw {
        statusCode: resp.status >= 400 && resp.status < 600 ? resp.status : 502,
        message: `DocuSeal: ${resp.status}${txt ? ` — ${txt.slice(0, 200)}` : ''}`,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Modelos obrigatórios no DocuSeal (JSON no env). */
export type DocusealRequiredTemplate = {
  id: number;
  name: string;
  /** Papel do primeiro signatário (médico/cooperado); deve coincidir com o template no DocuSeal. */
  role?: string;
  /** Papel da segunda parte (cooperativa); omitir se `singleSubmitter`. */
  secondRole?: string;
  /** Só o cooperado assina (template com um signatário). */
  singleSubmitter?: boolean;
};

/** 2FA por e-mail antes de abrir o documento (assinatura avançada — Lei 14.063/2020). Default: ativo. */
function docusealRequireEmail2fa(): boolean {
  const v = (process.env.DOCUSEAL_REQUIRE_EMAIL_2FA ?? 'true').trim().toLowerCase();
  return !(v === 'false' || v === '0' || v === 'no');
}

function docuseal2faFlags(): { require_email_2fa?: true } {
  return docusealRequireEmail2fa() ? { require_email_2fa: true } : {};
}

export function parseRequiredTemplates(): DocusealRequiredTemplate[] {
  const raw = process.env.DOCUSEAL_REQUIRED_TEMPLATES?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: DocusealRequiredTemplate[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const id = Number(o.id);
      const name = typeof o.name === 'string' ? o.name : '';
      if (!Number.isFinite(id) || id <= 0 || !name.trim()) continue;
      const roleRaw = o.role;
      const secondRoleRaw = o.secondRole;
      const tpl: DocusealRequiredTemplate = { id, name: name.trim() };
      if (typeof roleRaw === 'string' && roleRaw.trim()) tpl.role = roleRaw.trim();
      if (typeof secondRoleRaw === 'string' && secondRoleRaw.trim()) tpl.secondRole = secondRoleRaw.trim();
      if (o.singleSubmitter === true) tpl.singleSubmitter = true;
      out.push(tpl);
    }
    return out;
  } catch {
    return [];
  }
}

type DocusealInviteCfg =
  | { ok: false }
  | {
      ok: true;
      apiBase: string;
      token: string;
      templates: DocusealRequiredTemplate[];
      firstRole: string;
      secondRole: string;
      secondName: string;
      secondEmail: string;
      replyTo: string | undefined;
    };

function docusealInviteConfig(): DocusealInviteCfg {
  const c = credenciaisDocuseal();
  if (!c.ok) return { ok: false };
  const templates = parseRequiredTemplates();
  if (templates.length === 0) return { ok: false };

  const firstRole = process.env.DOCUSEAL_FIRST_SUBMITTER_ROLE?.trim() || 'Primeira Parte';
  const secondRole = process.env.DOCUSEAL_SECOND_SUBMITTER_ROLE?.trim() || 'Segunda Parte';
  const secondName =
    process.env.DOCUSEAL_SECOND_SUBMITTER_NAME?.trim() ||
    process.env.ORG_DISPLAY_NAME?.trim() ||
    'COOPVITTA';
  const secondEmail = normalizarEmailDocuseal(process.env.DOCUSEAL_SECOND_SUBMITTER_EMAIL);
  if (!secondEmail) return { ok: false };

  const replyRaw = process.env.DOCUSEAL_REPLY_TO?.trim();
  const replyTo = replyRaw && replyRaw.includes('@') ? replyRaw : undefined;

  return {
    ok: true,
    apiBase: c.apiBase,
    token: c.token,
    templates,
    firstRole,
    secondRole,
    secondName,
    secondEmail,
    replyTo,
  };
}

export type DocusealInviteSubmissionsResult = {
  /** Houve tentativa (templates + API + segunda parte configurados). */
  attempted: boolean;
  /** Submissões criadas com sucesso. */
  created: number;
  errors: string[];
};

export type DocusealCriarSubmissoesOpcoes = {
  /** Se definido, só estes template_id (têm de estar em DOCUSEAL_REQUIRED_TEMPLATES). */
  onlyTemplateIds?: number[];
};

function buildSubmittersForTemplate(
  tpl: DocusealRequiredTemplate,
  cfg: Extract<DocusealInviteCfg, { ok: true }>,
  medico: { nomeCompleto: string; email: string },
  emailMed: string
): Array<Record<string, unknown>> {
  const twoFa = docuseal2faFlags();
  const first = {
    role: tpl.role || cfg.firstRole,
    name: medico.nomeCompleto.trim(),
    email: emailMed,
    ...twoFa,
  };

  if (tpl.singleSubmitter) return [first];

  return [
    first,
    {
      role: tpl.secondRole || cfg.secondRole,
      name: cfg.secondName,
      email: cfg.secondEmail,
      ...twoFa,
    },
  ];
}

function findMedicoSubmitterRecord(row: Record<string, unknown>, emailNorm: string): Record<string, unknown> | null {
  const submittersRaw = readKey(row, 'submitters', 'Submitters');
  const arr = Array.isArray(submittersRaw) ? submittersRaw : [];
  for (const su of arr) {
    if (!su || typeof su !== 'object') continue;
    const s = su as Record<string, unknown>;
    const em = normalizarEmailDocuseal(typeof readKey(s, 'email', 'Email') === 'string' ? (readKey(s, 'email', 'Email') as string) : null);
    if (em === emailNorm) return s;
  }
  return null;
}

function submissionTemplateIdFromRow(row: Record<string, unknown>): number | null {
  const tplRaw = readKey(row, 'template', 'Template');
  if (!tplRaw || typeof tplRaw !== 'object') return null;
  return numId(readKey(tplRaw as Record<string, unknown>, 'id', 'Id'));
}

function classificarEstadoDocParaMedico(
  row: Record<string, unknown>,
  emailNorm: string,
  webBase: string
): {
  status: 'pendente_medico' | 'pendente_outros' | 'concluido';
  submissionId: number;
  submitterId: number | null;
  signUrl: string | null;
  signerStatus: string | null;
} {
  const submissionId = numId(readKey(row, 'id', 'Id'));
  if (submissionId == null) {
    return {
      status: 'pendente_medico',
      submissionId: -1,
      submitterId: null,
      signUrl: null,
      signerStatus: null,
    };
  }

  const medicoSub = findMedicoSubmitterRecord(row, emailNorm);
  const submittersRaw = readKey(row, 'submitters', 'Submitters');
  const arr = Array.isArray(submittersRaw) ? submittersRaw : [];

  let outrosPendentes = false;
  for (const su of arr) {
    if (!su || typeof su !== 'object') continue;
    const s = su as Record<string, unknown>;
    const em = normalizarEmailDocuseal(typeof readKey(s, 'email', 'Email') === 'string' ? (readKey(s, 'email', 'Email') as string) : null);
    if (em === emailNorm) continue;
    if (submitterAindaDeveAssinar(s)) outrosPendentes = true;
  }

  const stMed = medicoSub ? readKey(medicoSub, 'status', 'Status') : null;
  const signerStatus = typeof stMed === 'string' ? stMed : null;
  const sidMed = medicoSub ? numId(readKey(medicoSub, 'id', 'Id')) : null;

  if (!medicoSub) {
    return {
      status: outrosPendentes ? 'pendente_outros' : 'concluido',
      submissionId,
      submitterId: null,
      signUrl: null,
      signerStatus: null,
    };
  }

  if (submitterAindaDeveAssinar(medicoSub)) {
    return {
      status: 'pendente_medico',
      submissionId,
      submitterId: sidMed,
      signUrl: urlAssinaturaSubmitter(medicoSub, webBase),
      signerStatus,
    };
  }

  if (outrosPendentes) {
    return {
      status: 'pendente_outros',
      submissionId,
      submitterId: sidMed,
      signUrl: null,
      signerStatus,
    };
  }

  return {
    status: 'concluido',
    submissionId,
    submitterId: sidMed,
    signUrl: null,
    signerStatus,
  };
}

/** Estado de cada modelo obrigatório para um médico (enviar / assinar pela app). */
export type DocusealDocPainelStatus = 'nao_enviado' | 'pendente_medico' | 'pendente_outros' | 'concluido';

export type DocusealDocumentoPainelItem = {
  templateId: number;
  templateName: string;
  status: DocusealDocPainelStatus;
  submissionId: number | null;
  submitterId: number | null;
  signUrl: string | null;
  signerStatus: string | null;
};

/**
 * Monta a lista de modelos obrigatórios e estados a partir de submissões já obtidas (ex.: ?q=email).
 * Usado pelo painel do médico e pelo resumo da tabela para não duplicar chamadas à API.
 */
function documentosPainelFromRaw(
  raw: Record<string, unknown>[],
  emailNorm: string,
  webBase: string,
  requiredTemplates: DocusealRequiredTemplate[]
): DocusealDocumentoPainelItem[] {
  if (requiredTemplates.length === 0) return [];
  const requiredIds = new Set(requiredTemplates.map((t) => t.id));
  const latestByTemplate = new Map<number, { row: Record<string, unknown>; sid: number }>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (linhaSubmissionArquivada(r)) continue;
    const tid = submissionTemplateIdFromRow(r);
    if (tid == null || !requiredIds.has(tid)) continue;
    if (!findMedicoSubmitterRecord(r, emailNorm)) continue;
    const sid = numId(readKey(r, 'id', 'Id'));
    if (sid == null) continue;
    const prev = latestByTemplate.get(tid);
    if (!prev || sid > prev.sid) latestByTemplate.set(tid, { row: r, sid });
  }

  return requiredTemplates.map((tpl) => {
    const hit = latestByTemplate.get(tpl.id);
    if (!hit) {
      return {
        templateId: tpl.id,
        templateName: tpl.name,
        status: 'nao_enviado' as const,
        submissionId: null,
        submitterId: null,
        signUrl: null,
        signerStatus: null,
      };
    }
    const cl = classificarEstadoDocParaMedico(hit.row, emailNorm, webBase);
    const status: DocusealDocPainelStatus =
      cl.status === 'pendente_medico'
        ? 'pendente_medico'
        : cl.status === 'pendente_outros'
          ? 'pendente_outros'
          : 'concluido';
    return {
      templateId: tpl.id,
      templateName: tpl.name,
      status,
      submissionId: cl.submissionId > 0 ? cl.submissionId : null,
      submitterId: cl.submitterId,
      signUrl: cl.signUrl,
      signerStatus: cl.signerStatus,
    };
  });
}

function contarEstadosPainelDocumentos(docs: DocusealDocumentoPainelItem[]): {
  faltaEnviar: number;
  pendenteAssinaturaMedico: number;
  aguardaSegundaParte: number;
} {
  let faltaEnviar = 0;
  let pendenteAssinaturaMedico = 0;
  let aguardaSegundaParte = 0;
  for (const d of docs) {
    if (d.status === 'nao_enviado') faltaEnviar += 1;
    else if (d.status === 'pendente_medico') pendenteAssinaturaMedico += 1;
    else if (d.status === 'pendente_outros') aguardaSegundaParte += 1;
  }
  return { faltaEnviar, pendenteAssinaturaMedico, aguardaSegundaParte };
}

export type DocusealDocumentosPainelResultado = {
  configured: boolean;
  /** Permite POST / enviar (templates + segunda parte no env). */
  inviteFlowOk: boolean;
  error: string | null;
  documentos: DocusealDocumentoPainelItem[];
};

/**
 * Lista documentos configurados em DOCUSEAL_REQUIRED_TEMPLATES e o estado real no DocuSeal para este e-mail,
 * para o master decidir o que ainda falta **enviar** ou o que está **pendente de assinatura**.
 */
export async function docusealDocumentosPainelPorMedicoService(
  email: string,
  _nomeCompleto: string
): Promise<DocusealDocumentosPainelResultado> {
  const c = credenciaisDocuseal();
  if (!c.ok) {
    return { configured: false, inviteFlowOk: false, error: null, documentos: [] };
  }

  const cfg = docusealInviteConfig();
  const emailNorm = normalizarEmailDocuseal(email);
  if (!emailNorm) {
    return { configured: true, inviteFlowOk: cfg.ok, error: 'Médico sem e-mail.', documentos: [] };
  }

  const requiredTemplates = cfg.ok ? cfg.templates : parseRequiredTemplates();
  if (requiredTemplates.length === 0) {
    return {
      configured: true,
      inviteFlowOk: cfg.ok,
      error: cfg.ok
        ? null
        : 'Não há documentos de assinatura configurados no servidor (lista de modelos DocuSeal + segunda parte).',
      documentos: [],
    };
  }

  try {
    const raw = await fetchSubmissionsPaginated(c.apiBase, c.token, { q: emailNorm });
    const documentos = documentosPainelFromRaw(raw, emailNorm, c.webBase, requiredTemplates);

    return {
      configured: true,
      inviteFlowOk: cfg.ok,
      error: cfg.ok
        ? null
        : 'Fluxo de envio incompleto: configure no servidor o e-mail da segunda parte e os papéis (DocuSeal).',
      documentos,
    };
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Tempo esgotado ao contactar DocuSeal.' : e?.message || 'Falha na ligação ao DocuSeal.';
    return { configured: true, inviteFlowOk: cfg.ok, error: String(msg), documentos: [] };
  }
}

/**
 * Cria no DocuSeal uma submissão por modelo em DOCUSEAL_REQUIRED_TEMPLATES (dois signatários: médico + segunda parte).
 * Não falha o convite da app se o DocuSeal responder erro — devolve `errors` para auditoria/UI.
 */
export async function createDocusealSubmissionsForMedicoInvite(
  medico: {
    nomeCompleto: string;
    email: string;
  },
  opts?: DocusealCriarSubmissoesOpcoes
): Promise<DocusealInviteSubmissionsResult> {
  const cfg = docusealInviteConfig();
  if (!cfg.ok) {
    return { attempted: false, created: 0, errors: [] };
  }

  const orgName =
    process.env.ORG_DISPLAY_NAME?.trim() || process.env.DOCUSEAL_SECOND_SUBMITTER_NAME?.trim() || 'COOPVITTA';
  const subject =
    process.env.DOCUSEAL_INVITE_SUBJECT?.trim() ||
    `${orgName} — documento para assinatura eletrónica (verificação por e-mail)`;
  const customBody = process.env.DOCUSEAL_INVITE_BODY?.trim();
  const body = customBody ? customBody.replace(/\\n/g, '\n') : buildDocusealInviteEmailBody('first');

  const errors: string[] = [];
  let created = 0;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);

  const emailMed = normalizarEmailDocuseal(medico.email);
  if (!emailMed) {
    clearTimeout(timer);
    return { attempted: true, created: 0, errors: ['E-mail do médico inválido para DocuSeal.'] };
  }

  const only = opts?.onlyTemplateIds?.filter((id) => Number.isFinite(id) && id > 0) ?? null;

  try {
    for (const tpl of cfg.templates) {
      if (only != null && only.length > 0 && !only.includes(tpl.id)) continue;

      const submitters = buildSubmittersForTemplate(tpl, cfg, medico, emailMed);

      const payload: Record<string, unknown> = {
        template_id: tpl.id,
        send_email: true,
        order: 'preserved',
        submitters,
        message: { subject, body },
      };
      if (cfg.replyTo) payload.reply_to = cfg.replyTo;

      const resp = await fetchWithTimeout(`${cfg.apiBase}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': cfg.token,
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        let errMsg = txt.slice(0, 280);
        try {
          const j = JSON.parse(txt) as { error?: string };
          if (typeof j.error === 'string') errMsg = j.error;
        } catch {
          /* manter txt */
        }
        errors.push(`Template ${tpl.id} (${tpl.name}): HTTP ${resp.status} — ${errMsg}`);
        continue;
      }
      created += 1;
    }
  } catch (e: any) {
    errors.push(
      e?.name === 'AbortError' ? 'Tempo esgotado ao contactar DocuSeal.' : String(e?.message || e)
    );
  } finally {
    clearTimeout(timer);
  }

  return { attempted: true, created, errors };
}
