import { createHash } from 'crypto';
import {
  FormularioCampoTipo,
  FormularioIdentificacaoModo,
  FormularioRespostaStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/database';
import { fileExistsSafe, resolveStoredFileToAbsolute, toStoredUploadPath } from '../utils/upload-path.util';

const SAMU_SLUG = 'samu-prova';

const SAMU_CAMPOS: Array<{
  chave: string;
  label: string;
  tipo: FormularioCampoTipo;
  ordem: number;
  opcoesJson?: Prisma.InputJsonValue;
  validacaoJson?: Prisma.InputJsonValue;
}> = [
  { chave: 'nomeCompleto', label: 'Nome completo', tipo: FormularioCampoTipo.TEXTO, ordem: 1 },
  { chave: 'telefone', label: 'Telefone para contato', tipo: FormularioCampoTipo.TELEFONE, ordem: 2 },
  {
    chave: 'profissao',
    label: 'Profissão',
    tipo: FormularioCampoTipo.ESCOLHA_UNICA,
    ordem: 3,
    opcoesJson: ['Técnico', 'Condutor'],
  },
  {
    chave: 'curriculo',
    label: 'Currículo (PDF)',
    tipo: FormularioCampoTipo.FICHEIRO,
    ordem: 4,
    validacaoJson: { accept: ['application/pdf'], maxBytes: 15 * 1024 * 1024 },
  },
];

const SAMU_TITULO = 'Inscrição / pré-seleção — SAMU Fortaleza (cadastro reserva)';
const SAMU_DESCRICAO =
  'Preencha os dados abaixo para inscrição na pré-seleção da prova do SAMU Fortaleza. Anexe o currículo em PDF.';

export async function ensureSamuFormulario(tenantId: string) {
  const existing = await prisma.formulario.findUnique({
    where: { tenantId_slug: { tenantId, slug: SAMU_SLUG } },
    include: { campos: { orderBy: { ordem: 'asc' } } },
  });
  if (existing) {
    if (existing.descricao !== SAMU_DESCRICAO || existing.titulo !== SAMU_TITULO) {
      return prisma.formulario.update({
        where: { id: existing.id },
        data: { titulo: SAMU_TITULO, descricao: SAMU_DESCRICAO },
        include: { campos: { orderBy: { ordem: 'asc' } } },
      });
    }
    return existing;
  }

  return prisma.formulario.create({
    data: {
      tenantId,
      titulo: SAMU_TITULO,
      descricao: SAMU_DESCRICAO,
      slug: SAMU_SLUG,
      publico: true,
      ativo: true,
      identificacaoModo: FormularioIdentificacaoModo.LEVE,
      campos: {
        create: SAMU_CAMPOS.map((c) => ({
          chave: c.chave,
          label: c.label,
          tipo: c.tipo,
          obrigatorio: true,
          ordem: c.ordem,
          opcoesJson: c.opcoesJson ?? undefined,
          validacaoJson: c.validacaoJson ?? undefined,
        })),
      },
    },
    include: { campos: { orderBy: { ordem: 'asc' } } },
  });
}

function hashIp(ip: string | undefined): string | null {
  if (!ip?.trim()) return null;
  return createHash('sha256').update(ip.trim()).digest('hex').slice(0, 64);
}

export async function getFormularioPublicoBySlug(slug: string) {
  const slugNorm = slug.trim().toLowerCase();
  let form = await prisma.formulario.findFirst({
    where: { slug: slugNorm, publico: true },
    include: { campos: { orderBy: { ordem: 'asc' } } },
  });
  if (!form && slugNorm === SAMU_SLUG) {
    const tenants = await prisma.tenant.findMany({ where: { ativo: true }, select: { id: true } });
    for (const t of tenants) {
      await ensureSamuFormulario(t.id);
    }
    form = await prisma.formulario.findFirst({
      where: { slug: slugNorm, publico: true },
      include: { campos: { orderBy: { ordem: 'asc' } } },
    });
  }
  if (!form || !form.ativo) {
    throw { statusCode: 404, message: 'Formulário não encontrado ou indisponível' };
  }
  return {
    slug: form.slug,
    titulo: form.titulo,
    descricao: form.descricao,
    identificacaoModo: form.identificacaoModo,
    campos: form.campos.map((c) => ({
      chave: c.chave,
      label: c.label,
      tipo: c.tipo,
      obrigatorio: c.obrigatorio,
      ordem: c.ordem,
      opcoes: c.opcoesJson ?? null,
      validacao: c.validacaoJson ?? null,
    })),
  };
}

export async function submitFormularioPublico(
  slug: string,
  fields: Record<string, string>,
  file: Express.Multer.File | undefined,
  meta: { ip?: string; userAgent?: string }
) {
  const form = await prisma.formulario.findFirst({
    where: { slug: slug.trim().toLowerCase(), publico: true },
    include: { campos: { orderBy: { ordem: 'asc' } } },
  });
  if (!form || !form.ativo) {
    throw { statusCode: 404, message: 'Formulário não encontrado ou indisponível' };
  }

  const nome = (fields.nomeCompleto || '').trim();
  const telefone = (fields.telefone || '').trim();
  if (nome.length < 3) throw { statusCode: 400, message: 'Informe o nome completo' };
  if (telefone.replace(/\D/g, '').length < 10) {
    throw { statusCode: 400, message: 'Informe um telefone válido' };
  }

  const valoresCreate: Prisma.FormularioRespostaValorCreateWithoutRespostaInput[] = [];

  for (const campo of form.campos) {
    if (campo.tipo === FormularioCampoTipo.FICHEIRO) {
      if (campo.obrigatorio && !file) {
        throw { statusCode: 400, message: `${campo.label} é obrigatório` };
      }
      if (file) {
        const mime = (file.mimetype || '').toLowerCase();
        if (mime !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
          throw { statusCode: 400, message: 'O currículo deve ser um PDF' };
        }
        valoresCreate.push({
          campo: { connect: { id: campo.id } },
          nomeArquivo: file.originalname || 'curriculo.pdf',
          caminhoArquivo: toStoredUploadPath(file.path),
          mimeType: file.mimetype || 'application/pdf',
          tamanhoBytes: file.size,
        });
      }
      continue;
    }

    const raw = (fields[campo.chave] || '').trim();
    if (campo.obrigatorio && !raw) {
      throw { statusCode: 400, message: `${campo.label} é obrigatório` };
    }
    if (campo.tipo === FormularioCampoTipo.ESCOLHA_UNICA && raw) {
      const opcoes = Array.isArray(campo.opcoesJson)
        ? (campo.opcoesJson as unknown[]).map((o) => String(o))
        : [];
      if (opcoes.length && !opcoes.includes(raw)) {
        throw { statusCode: 400, message: `Opção inválida em ${campo.label}` };
      }
    }
    valoresCreate.push({
      campo: { connect: { id: campo.id } },
      valorTexto: raw || null,
    });
  }

  await prisma.formularioResposta.create({
    data: {
      tenantId: form.tenantId,
      formularioId: form.id,
      status: FormularioRespostaStatus.NOVA,
      remetenteNome: nome.slice(0, 255),
      remetenteTelefone: telefone.slice(0, 40),
      ipHash: hashIp(meta.ip),
      userAgent: meta.userAgent?.slice(0, 500) || null,
      valores: { create: valoresCreate },
    },
  });

  return { ok: true as const };
}

export async function listFormulariosService(tenantId: string) {
  await ensureSamuFormulario(tenantId);
  return prisma.formulario.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      titulo: true,
      slug: true,
      descricao: true,
      ativo: true,
      publico: true,
      identificacaoModo: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { respostas: true } },
    },
  });
}

export async function getFormularioAdminService(tenantId: string, formularioId: string) {
  await ensureSamuFormulario(tenantId);
  const form = await prisma.formulario.findFirst({
    where: { id: formularioId, tenantId },
    include: {
      campos: { orderBy: { ordem: 'asc' } },
      _count: { select: { respostas: true } },
    },
  });
  if (!form) throw { statusCode: 404, message: 'Formulário não encontrado' };
  return form;
}

export async function patchFormularioService(
  tenantId: string,
  formularioId: string,
  data: { ativo?: boolean; descricao?: string | null }
) {
  const form = await prisma.formulario.findFirst({
    where: { id: formularioId, tenantId },
    select: { id: true },
  });
  if (!form) throw { statusCode: 404, message: 'Formulário não encontrado' };
  return prisma.formulario.update({
    where: { id: form.id },
    data: {
      ativo: typeof data.ativo === 'boolean' ? data.ativo : undefined,
      descricao: data.descricao === undefined ? undefined : data.descricao,
    },
  });
}

export async function listRespostasService(
  tenantId: string,
  formularioId: string,
  filters?: { status?: FormularioRespostaStatus; q?: string }
) {
  const form = await prisma.formulario.findFirst({
    where: { id: formularioId, tenantId },
    select: { id: true },
  });
  if (!form) throw { statusCode: 404, message: 'Formulário não encontrado' };

  const q = filters?.q?.trim();
  return prisma.formularioResposta.findMany({
    where: {
      formularioId: form.id,
      tenantId,
      status: filters?.status,
      ...(q
        ? {
            OR: [
              { remetenteNome: { contains: q, mode: 'insensitive' } },
              { remetenteTelefone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      valores: {
        include: { campo: { select: { id: true, chave: true, label: true, tipo: true } } },
      },
    },
  });
}

export async function getRespostaService(tenantId: string, formularioId: string, respostaId: string) {
  const r = await prisma.formularioResposta.findFirst({
    where: { id: respostaId, formularioId, tenantId },
    include: {
      valores: {
        include: { campo: { select: { id: true, chave: true, label: true, tipo: true } } },
      },
      formulario: { select: { id: true, titulo: true, slug: true } },
    },
  });
  if (!r) throw { statusCode: 404, message: 'Resposta não encontrada' };
  return r;
}

export async function patchRespostaStatusService(
  tenantId: string,
  formularioId: string,
  respostaId: string,
  status: FormularioRespostaStatus
) {
  if (!Object.values(FormularioRespostaStatus).includes(status)) {
    throw { statusCode: 400, message: 'Status inválido' };
  }
  const r = await prisma.formularioResposta.findFirst({
    where: { id: respostaId, formularioId, tenantId },
    select: { id: true },
  });
  if (!r) throw { statusCode: 404, message: 'Resposta não encontrada' };
  return prisma.formularioResposta.update({
    where: { id: r.id },
    data: { status },
  });
}

export async function getRespostaFicheiroDownloadService(
  tenantId: string,
  formularioId: string,
  respostaId: string,
  campoId: string
) {
  const valor = await prisma.formularioRespostaValor.findFirst({
    where: {
      campoId,
      respostaId,
      resposta: { id: respostaId, formularioId, tenantId },
    },
  });
  if (!valor?.caminhoArquivo) {
    throw { statusCode: 404, message: 'Ficheiro não encontrado' };
  }
  const full = resolveStoredFileToAbsolute(valor.caminhoArquivo);
  if (!fileExistsSafe(full)) {
    throw { statusCode: 404, message: 'Arquivo não encontrado no servidor' };
  }
  return {
    path: full,
    nomeArquivo: valor.nomeArquivo || 'curriculo.pdf',
    mimeType: valor.mimeType || 'application/pdf',
  };
}
