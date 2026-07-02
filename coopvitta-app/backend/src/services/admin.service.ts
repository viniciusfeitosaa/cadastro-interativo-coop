import { prisma } from '../config/database';
import { hashPassword } from '../utils/password.util';
import { validateCPF } from '../utils/validation.util';
import {
  normalizeRegistroConselhoParaProfissao,
  profissaoExigeRegistroConselho,
  resolveRegistroConselhoParaCadastro,
} from '../utils/profissao-registro.util';
import { fileExistsSafe, resolveStoredFileToAbsolute } from '../utils/upload-path.util';
import { getFrontendAppBaseUrl } from '../utils/email-branding.util';
import { createAuditLog } from './auditoria.service';
import {
  ensureTiposLegadoMigrados,
  resolveGradeIdParaContrato,
} from './tipo-plantao.service';
import { resolverHorasTurnoSnapshotParaGrade } from './repasse-registro-ponto.service';
import {
  duracaoPlantaoHorasUtc,
  instanteDentroDaJanelaPlantaoUtc,
  scheduleFromLegacyGradeId,
  scheduleFromTipoRow,
} from '../utils/plantao-horario';
import { isMissingDatabaseColumnError } from '../utils/prisma-column-error';
import {
  createDocusealSubmissionsForMedicoInvite,
  docusealDocumentosPainelPorMedicoService,
} from './docuseal.service';
import crypto from 'crypto';
import { Prisma, StatusCadastroMedico } from '@prisma/client';

interface ListMedicosParams {
  tenantId: string;
  page?: number;
  limit?: number;
  search?: string;
  ativo?: boolean;
}

interface CreateMedicoInput {
  tenantId: string;
  masterId: string;
  nomeCompleto: string;
  cpf: string;
  profissao?: string | null;
  crm?: string | null;
  email?: string | null;
  especialidades?: string[] | null;
  vinculo?: string | null;
  telefone?: string | null;
  senha?: string;
}

interface UpdateMedicoInput {
  tenantId: string;
  masterId: string;
  medicoId: string;
  nomeCompleto?: string;
  cpf?: string;
  crm?: string;
  email?: string | null;
  especialidades?: string[] | null;
  vinculo?: string | null;
  telefone?: string | null;
}

interface ListContratosAtivosParams {
  tenantId: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface CreateContratoAtivoInput {
  tenantId: string;
  masterId: string;
  nome: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  ativo?: boolean;
  usaEscala?: boolean;
  usaPonto?: boolean;
  permiteTrocaPlantao?: boolean;
}

interface UpdateContratoAtivoInput {
  tenantId: string;
  masterId: string;
  contratoId: string;
  nome?: string;
  descricao?: string | null;
  dataInicio?: string;
  dataFim?: string | null;
  ativo?: boolean;
  usaEscala?: boolean;
  usaPonto?: boolean;
  permiteTrocaPlantao?: boolean;
}

interface ListEscalasParams {
  tenantId: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface CreateEscalaInput {
  tenantId: string;
  masterId: string;
  contratoAtivoId: string;
  nome: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim: string;
  ativo?: boolean;
}

interface UpdateEscalaInput {
  tenantId: string;
  masterId: string;
  escalaId: string;
  contratoAtivoId?: string;
  nome?: string;
  descricao?: string | null;
  dataInicio?: string;
  dataFim?: string;
  ativo?: boolean;
}

interface AlocarMedicoEscalaInput {
  tenantId: string;
  masterId: string;
  escalaId: string;
  medicoId: string;
  cargo?: string | null;
  valorHora?: number | null;
}

export async function listMedicosService(params: ListMedicosParams) {
  const page = Math.max(params.page || 1, 1);
  const limit = Math.min(Math.max(params.limit || 10, 1), 2000);
  const skip = (page - 1) * limit;
  const search = params.search?.trim();

  const cpfSearch = search?.replace(/\D/g, '');
  const searchFilters = search
    ? [
        { nomeCompleto: { contains: search, mode: 'insensitive' as const } },
        { crm: { contains: search, mode: 'insensitive' as const } },
        ...(cpfSearch
          ? [{ cpf: { contains: cpfSearch, mode: 'insensitive' as const } }]
          : []),
      ]
    : [];

  const where: Prisma.MedicoWhereInput = {
    tenantId: params.tenantId,
    statusCadastro: { not: StatusCadastroMedico.PENDENTE_ANALISE },
    ...(searchFilters.length ? { OR: searchFilters } : {}),
    ...(params.ativo !== undefined ? { ativo: params.ativo } : {}),
  };

  // Sequencial (evita 2 queries paralelas competindo por 1 conexão no pooler Supabase Session)
  const total = await prisma.medico.count({ where });
  const items = await prisma.medico.findMany({
    where,
    select: {
      id: true,
      nomeCompleto: true,
      cpf: true,
      profissao: true,
      crm: true,
      email: true,
      especialidades: true,
      vinculo: true,
      telefone: true,
      ativo: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { nomeCompleto: 'asc' },
    skip,
    take: limit,
  });

  const medicoIds = items.map((m) => m.id);
  const equipeLinks =
    medicoIds.length === 0
      ? []
      : await prisma.equipeMedico.findMany({
          where: { tenantId: params.tenantId, medicoId: { in: medicoIds } },
          select: {
            medicoId: true,
            equipe: {
              select: {
                id: true,
                nome: true,
                ativo: true,
                subgrupo: { select: { id: true, nome: true } },
              },
            },
          },
        });

  const equipesPorMedico = new Map<
    string,
    { id: string; nome: string; ativo: boolean; subgrupo: { id: string; nome: string } | null }[]
  >();
  for (const row of equipeLinks) {
    const e = row.equipe;
    if (!e) continue;
    const list = equipesPorMedico.get(row.medicoId) ?? [];
    list.push({
      id: e.id,
      nome: e.nome,
      ativo: e.ativo,
      subgrupo: e.subgrupo ? { id: e.subgrupo.id, nome: e.subgrupo.nome } : null,
    });
    equipesPorMedico.set(row.medicoId, list);
  }

  const itemsComEquipes = items.map((m) => {
    const eq = [...(equipesPorMedico.get(m.id) ?? [])].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    );
    return { ...m, equipes: eq };
  });

  return {
    items: itemsComEquipes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createMedicoService(input: CreateMedicoInput) {
  const cpf = input.cpf.replace(/\D/g, '');
  const email = input.email?.trim().toLowerCase() || null;
  const profissao = (input.profissao || 'Médico').trim();
  const isMedico = profissao === 'Médico';

  const crm = resolveRegistroConselhoParaCadastro(profissao, input.crm ?? null);

  if (!validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido' };
  }

  const [existingByCpf, existingByCrm] = await Promise.all([
    prisma.medico.findFirst({ where: { tenantId: input.tenantId, cpf } }),
    crm !== null
      ? prisma.medico.findFirst({ where: { tenantId: input.tenantId, crm: crm as string } })
      : Promise.resolve(null),
  ]);

  if (existingByCpf) {
    throw { statusCode: 409, message: 'Já existe médico com este CPF' };
  }

  if (existingByCrm) {
    throw { statusCode: 409, message: 'Já existe cadastro com este número de registro profissional' };
  }

  if (email) {
    const existingByEmail = await prisma.medico.findFirst({
      where: { tenantId: input.tenantId, email },
    });
    if (existingByEmail) {
      throw { statusCode: 409, message: 'Já existe médico com este e-mail' };
    }
  }

  const senhaPlain = input.senha?.trim() || crypto.randomBytes(24).toString('base64url');
  const senhaHash = await hashPassword(senhaPlain);

  const medico = await prisma.medico.create({
    data: {
      tenantId: input.tenantId,
      nomeCompleto: input.nomeCompleto.trim(),
      cpf,
      profissao,
      crm,
      email,
      especialidades: (input.especialidades && input.especialidades.length > 0)
        ? input.especialidades.map((e) => (e || '').trim()).filter(Boolean)
        : (isMedico ? ['Clínica Médica'] : []),
      vinculo: input.vinculo?.trim() || null,
      telefone: input.telefone?.trim() || null,
      senhaHash,
      ativo: true,
      statusCadastro: StatusCadastroMedico.ATIVO,
    },
  });

  await createAuditLog({
    acao: 'CRIAR_MEDICO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { medicoId: medico.id, cpf: medico.cpf, crm: medico.crm },
  });

  return medico;
}

export async function updateMedicoService(input: UpdateMedicoInput) {
  const medico = await prisma.medico.findFirst({
    where: { id: input.medicoId, tenantId: input.tenantId },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  const cpf = input.cpf ? input.cpf.replace(/\D/g, '') : undefined;
  const email = input.email === undefined ? undefined : input.email?.trim().toLowerCase() || null;

  let crm: string | null | undefined = undefined;
  if (input.crm !== undefined) {
    const prof = (medico.profissao || 'Médico').trim();
    const trimmed = String(input.crm ?? '').trim();
    if (!trimmed) {
      if (profissaoExigeRegistroConselho(prof)) {
        throw { statusCode: 400, message: 'Registro no conselho é obrigatório para esta profissão' };
      }
      crm = null;
    } else {
      const n = normalizeRegistroConselhoParaProfissao(prof, trimmed);
      if (!n) {
        throw {
          statusCode: 400,
          message: prof === 'Médico' ? 'CRM inválido' : 'Registro no conselho inválido',
        };
      }
      crm = n;
    }
  }

  if (cpf && !validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido' };
  }

  if (cpf && cpf !== medico.cpf) {
    const existingByCpf = await prisma.medico.findFirst({
      where: { tenantId: input.tenantId, cpf, NOT: { id: medico.id } },
    });
    if (existingByCpf) {
      throw { statusCode: 409, message: 'Já existe médico com este CPF' };
    }
  }

  if (crm && crm !== medico.crm) {
    const existingByCrm = await prisma.medico.findFirst({
      where: { tenantId: input.tenantId, crm, NOT: { id: medico.id } },
    });
    if (existingByCrm) {
      throw { statusCode: 409, message: 'Já existe cadastro com este número de registro profissional' };
    }
  }

  if (email !== undefined && email !== medico.email && email !== null) {
    const existingByEmail = await prisma.medico.findFirst({
      where: { tenantId: input.tenantId, email, NOT: { id: medico.id } },
    });
    if (existingByEmail) {
      throw { statusCode: 409, message: 'Já existe médico com este e-mail' };
    }
  }

  const updated = await prisma.medico.update({
    where: { id: medico.id },
    data: {
      nomeCompleto: input.nomeCompleto?.trim() || undefined,
      cpf,
      crm,
      email,
      especialidades: input.especialidades === undefined ? undefined : (input.especialidades?.length ? input.especialidades.map((e) => (e || '').trim()).filter(Boolean) : []),
      vinculo: input.vinculo === undefined ? undefined : input.vinculo?.trim() || null,
      telefone: input.telefone === undefined ? undefined : input.telefone?.trim() || null,
    },
  });

  await createAuditLog({
    acao: 'ATUALIZAR_MEDICO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { medicoId: updated.id },
  });

  return updated;
}

export async function inviteMedicoService(
  tenantId: string,
  masterId: string,
  medicoId: string
) {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: { id: true, email: true, nomeCompleto: true },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  if (!medico.email) {
    throw { statusCode: 400, message: 'Médico sem e-mail cadastrado para envio de convite' };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

  await prisma.$transaction(async (tx: any) => {
    await tx.medico.update({
      where: { id: medico.id },
      data: {
        inviteTokenHash: tokenHash,
        inviteExpiresAt: expiresAt,
        inviteAcceptedAt: null,
      },
    });

    await createAuditLog(
      {
        acao: 'CONVIDAR_MEDICO',
        tenantId,
        masterId,
        medicoId: medico.id,
        detalhes: {
          email: medico.email,
          expiresAt: expiresAt.toISOString(),
        },
      },
      tx
    );
  });

  const inviteUrl = `${getFrontendAppBaseUrl()}/ativar-conta/${rawToken}`;

  const docuseal = await createDocusealSubmissionsForMedicoInvite({
    nomeCompleto: medico.nomeCompleto,
    email: medico.email,
  });

  return {
    medicoId: medico.id,
    nomeCompleto: medico.nomeCompleto,
    email: medico.email,
    inviteUrl,
    expiresAt,
    token: rawToken,
    docuseal,
  };
}

/** DocuSeal: estado por modelo obrigatório (enviar / assinar) para o modal na lista de médicos. */
export async function getMedicoDocusealDocumentosService(tenantId: string, medicoId: string) {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: { email: true, nomeCompleto: true },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  return docusealDocumentosPainelPorMedicoService(medico.email || '', medico.nomeCompleto);
}

/** DocuSeal: criar e enviar um modelo (POST API) a partir da app. */
export async function enviarDocusealTemplateMedicoService(
  tenantId: string,
  masterId: string,
  medicoId: string,
  templateId: number
) {
  if (!Number.isFinite(templateId) || templateId <= 0) {
    throw { statusCode: 400, message: 'templateId inválido' };
  }

  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: { id: true, email: true, nomeCompleto: true },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  if (!medico.email) {
    throw { statusCode: 400, message: 'Médico sem e-mail cadastrado' };
  }

  const result = await createDocusealSubmissionsForMedicoInvite(
    { nomeCompleto: medico.nomeCompleto, email: medico.email },
    { onlyTemplateIds: [templateId] }
  );

  if (!result.attempted) {
    throw {
      statusCode: 503,
      message: 'DocuSeal não configurado no servidor (templates e segunda parte).',
    };
  }

  await createAuditLog({
    acao: 'DOCUSEAL_ENVIAR_TEMPLATE',
    tenantId,
    masterId,
    medicoId: medico.id,
    detalhes: { templateId, created: result.created, errors: result.errors },
  });

  return result;
}

export async function toggleMedicoAtivoService(
  tenantId: string,
  masterId: string,
  medicoId: string,
  ativo: boolean
) {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  const updated = await prisma.medico.update({
    where: { id: medico.id },
    data: { ativo },
  });

  await createAuditLog({
    acao: ativo ? 'ATIVAR_MEDICO' : 'INATIVAR_MEDICO',
    tenantId,
    masterId,
    detalhes: { medicoId: updated.id, ativo },
  });

  return updated;
}

export async function listContratosAtivosService(params: ListContratosAtivosParams) {
  const page = Math.max(params.page || 1, 1);
  const limit = Math.min(Math.max(params.limit || 10, 1), 100);
  const skip = (page - 1) * limit;
  const search = params.search?.trim();

  const where = {
    tenantId: params.tenantId,
    ...(search
      ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' as const } },
            { descricao: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const total = await prisma.contratoAtivo.count({ where });
  const items = await prisma.contratoAtivo.findMany({
    where,
    orderBy: [{ ativo: 'desc' }, { dataInicio: 'desc' }],
    skip,
    take: limit,
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createContratoAtivoService(input: CreateContratoAtivoInput) {
  if (!input.nome?.trim()) {
    throw { statusCode: 400, message: 'Nome do contrato é obrigatório' };
  }

  if (!input.dataInicio) {
    throw { statusCode: 400, message: 'Data de início é obrigatória' };
  }

  /** Colunas legadas no contrato: mantidas como true; estilo de produção é por subgrupo. */
  const contrato = await prisma.contratoAtivo.create({
    data: {
      tenantId: input.tenantId,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      dataInicio: new Date(input.dataInicio),
      dataFim: input.dataFim ? new Date(input.dataFim) : null,
      ativo: input.ativo ?? true,
      usaEscala: true,
      usaPonto: true,
      permiteTrocaPlantao: input.permiteTrocaPlantao ?? false,
    },
  });

  await createAuditLog({
    acao: 'CRIAR_CONTRATO_ATIVO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { contratoId: contrato.id, nome: contrato.nome },
  });

  return contrato;
}

export async function updateContratoAtivoService(input: UpdateContratoAtivoInput) {
  const contrato = await prisma.contratoAtivo.findFirst({
    where: { id: input.contratoId, tenantId: input.tenantId },
  });

  if (!contrato) {
    throw { statusCode: 404, message: 'Contrato não encontrado' };
  }

  const updated = await prisma.contratoAtivo.update({
    where: { id: contrato.id },
    data: {
      nome: input.nome?.trim() || undefined,
      descricao: input.descricao === undefined ? undefined : input.descricao?.trim() || null,
      dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
      dataFim: input.dataFim === undefined ? undefined : input.dataFim ? new Date(input.dataFim) : null,
      ativo: input.ativo,
      permiteTrocaPlantao: input.permiteTrocaPlantao,
    },
  });

  await createAuditLog({
    acao: 'ATUALIZAR_CONTRATO_ATIVO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { contratoId: updated.id, nome: updated.nome },
  });

  return updated;
}

export async function deleteContratoAtivoService(
  tenantId: string,
  masterId: string,
  contratoId: string
) {
  const contrato = await prisma.contratoAtivo.findFirst({
    where: { id: contratoId, tenantId },
  });

  if (!contrato) {
    throw { statusCode: 404, message: 'Contrato não encontrado' };
  }

  await prisma.contratoAtivo.delete({
    where: { id: contrato.id },
  });

  await createAuditLog({
    acao: 'EXCLUIR_CONTRATO_ATIVO',
    tenantId,
    masterId,
    detalhes: { contratoId: contrato.id, nome: contrato.nome },
  });
}

// --- Associação Contrato ↔ Subgrupo e Equipe ---

export async function listContratoSubgruposService(tenantId: string, contratoAtivoId: string) {
  await prisma.contratoAtivo.findFirstOrThrow({
    where: { id: contratoAtivoId, tenantId },
  });
  if (typeof (prisma as any).contratoSubgrupo?.findMany !== 'function') {
    return [];
  }
  try {
    return await prisma.contratoSubgrupo.findMany({
      where: { tenantId, contratoAtivoId },
      include: { subgrupo: { select: { id: true, nome: true, ativo: true, usaEscala: true, usaPonto: true } } },
      orderBy: { subgrupo: { nome: 'asc' } },
    });
  } catch (e: any) {
    if (e?.code === 'P2021' || e?.message?.includes('contrato_subgrupos') || e?.message?.includes('ContratoSubgrupo')) {
      return [];
    }
    throw e;
  }
}

export async function addContratoSubgrupoService(
  tenantId: string,
  masterId: string,
  contratoAtivoId: string,
  subgrupoId: string
) {
  await prisma.contratoAtivo.findFirstOrThrow({
    where: { id: contratoAtivoId, tenantId },
  });
  await prisma.subgrupo.findFirstOrThrow({
    where: { id: subgrupoId, tenantId },
  });
  const row = await prisma.contratoSubgrupo.upsert({
    where: {
      tenantId_contratoAtivoId_subgrupoId: { tenantId, contratoAtivoId, subgrupoId },
    },
    create: { tenantId, contratoAtivoId, subgrupoId },
    update: {},
    include: { subgrupo: { select: { id: true, nome: true } } },
  });
  await createAuditLog({
    acao: 'CONTRATO_ASSOCIAR_SUBGRUPO',
    tenantId,
    masterId,
    detalhes: { contratoAtivoId, subgrupoId },
  });
  return row;
}

export async function removeContratoSubgrupoService(
  tenantId: string,
  masterId: string,
  contratoAtivoId: string,
  subgrupoId: string
) {
  const link = await prisma.contratoSubgrupo.findFirst({
    where: { tenantId, contratoAtivoId, subgrupoId },
  });
  if (!link) throw { statusCode: 404, message: 'Associação não encontrada' };
  await prisma.contratoSubgrupo.delete({ where: { id: link.id } });
  await createAuditLog({
    acao: 'CONTRATO_DESASSOCIAR_SUBGRUPO',
    tenantId,
    masterId,
    detalhes: { contratoAtivoId, subgrupoId },
  });
}

export async function listContratoEquipesService(tenantId: string, contratoAtivoId: string) {
  await prisma.contratoAtivo.findFirstOrThrow({
    where: { id: contratoAtivoId, tenantId },
  });
  if (typeof (prisma as any).contratoEquipe?.findMany !== 'function') {
    return [];
  }
  try {
    return await prisma.contratoEquipe.findMany({
      where: { tenantId, contratoAtivoId },
      include: {
        equipe: {
          select: { id: true, nome: true, ativo: true, subgrupoId: true, subgrupo: { select: { id: true, nome: true } } },
        },
      },
      orderBy: { equipe: { nome: 'asc' } },
    });
  } catch (e: any) {
    if (e?.code === 'P2021' || e?.message?.includes('contrato_equipes') || e?.message?.includes('ContratoEquipe')) {
      return [];
    }
    throw e;
  }
}

export async function addContratoEquipeService(
  tenantId: string,
  masterId: string,
  contratoAtivoId: string,
  equipeId: string
) {
  await prisma.contratoAtivo.findFirstOrThrow({
    where: { id: contratoAtivoId, tenantId },
  });
  await prisma.equipe.findFirstOrThrow({
    where: { id: equipeId, tenantId },
  });
  const row = await prisma.contratoEquipe.upsert({
    where: {
      tenantId_contratoAtivoId_equipeId: { tenantId, contratoAtivoId, equipeId },
    },
    create: { tenantId, contratoAtivoId, equipeId },
    update: {},
    include: { equipe: { select: { id: true, nome: true, subgrupo: { select: { nome: true } } } } },
  });
  await createAuditLog({
    acao: 'CONTRATO_ASSOCIAR_EQUIPE',
    tenantId,
    masterId,
    detalhes: { contratoAtivoId, equipeId },
  });
  return row;
}

export async function removeContratoEquipeService(
  tenantId: string,
  masterId: string,
  contratoAtivoId: string,
  equipeId: string
) {
  const link = await prisma.contratoEquipe.findFirst({
    where: { tenantId, contratoAtivoId, equipeId },
  });
  if (!link) throw { statusCode: 404, message: 'Associação não encontrada' };
  await prisma.contratoEquipe.delete({ where: { id: link.id } });
  await createAuditLog({
    acao: 'CONTRATO_DESASSOCIAR_EQUIPE',
    tenantId,
    masterId,
    detalhes: { contratoAtivoId, equipeId },
  });
}

export async function listEscalasService(params: ListEscalasParams) {
  const page = Math.max(params.page || 1, 1);
  const limit = Math.min(Math.max(params.limit || 10, 1), 100);
  const skip = (page - 1) * limit;
  const search = params.search?.trim();

  const where = {
    tenantId: params.tenantId,
    ...(search
      ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' as const } },
            { descricao: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const total = await prisma.escala.count({ where });
  const items = await prisma.escala.findMany({
    where,
    include: {
      contratoAtivo: {
        select: { id: true, nome: true, ativo: true },
      },
      _count: {
        select: { alocacoes: true },
      },
    },
    orderBy: [{ ativo: 'desc' }, { dataInicio: 'desc' }],
    skip,
    take: limit,
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createEscalaService(input: CreateEscalaInput) {
  if (!input.nome?.trim()) {
    throw { statusCode: 400, message: 'Nome da escala é obrigatório' };
  }

  if (!input.contratoAtivoId) {
    throw { statusCode: 400, message: 'Contrato ativo é obrigatório' };
  }

  const contrato = await prisma.contratoAtivo.findFirst({
    where: { id: input.contratoAtivoId, tenantId: input.tenantId },
  });

  if (!contrato) {
    throw { statusCode: 404, message: 'Contrato ativo não encontrado' };
  }

  const escala = await prisma.$transaction(async (tx: any) => {
    const created = await tx.escala.create({
      data: {
        tenantId: input.tenantId,
        contratoAtivoId: input.contratoAtivoId,
        nome: input.nome.trim(),
        descricao: input.descricao?.trim() || null,
        dataInicio: new Date(input.dataInicio),
        dataFim: new Date(input.dataFim),
        ativo: input.ativo ?? true,
      },
    });

    await createAuditLog(
      {
        acao: 'CRIAR_ESCALA',
        tenantId: input.tenantId,
        masterId: input.masterId,
        detalhes: { escalaId: created.id, nome: created.nome },
      },
      tx
    );

    return created;
  });

  const { notificarMedicosNovaEscala } = await import('./notificacao-medico.service');
  await notificarMedicosNovaEscala(
    input.tenantId,
    escala.contratoAtivoId,
    { id: escala.id, nome: escala.nome },
    contrato.nome
  );

  return escala;
}

export async function updateEscalaService(input: UpdateEscalaInput) {
  const escala = await prisma.escala.findFirst({
    where: { id: input.escalaId, tenantId: input.tenantId },
  });

  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada' };
  }

  if (input.contratoAtivoId) {
    const contrato = await prisma.contratoAtivo.findFirst({
      where: { id: input.contratoAtivoId, tenantId: input.tenantId },
    });
    if (!contrato) {
      throw { statusCode: 404, message: 'Contrato ativo não encontrado' };
    }
  }

  return prisma.$transaction(async (tx: any) => {
    const updated = await tx.escala.update({
      where: { id: escala.id },
      data: {
        contratoAtivoId: input.contratoAtivoId || undefined,
        nome: input.nome?.trim() || undefined,
        descricao: input.descricao === undefined ? undefined : input.descricao?.trim() || null,
        dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
        dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        ativo: input.ativo,
      },
    });

    await createAuditLog(
      {
        acao: 'ATUALIZAR_ESCALA',
        tenantId: input.tenantId,
        masterId: input.masterId,
        detalhes: { escalaId: updated.id, nome: updated.nome },
      },
      tx
    );

    return updated;
  });
}

export async function deleteEscalaService(tenantId: string, masterId: string, escalaId: string) {
  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId },
  });

  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada' };
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.escala.delete({ where: { id: escala.id } });

    await createAuditLog(
      {
        acao: 'EXCLUIR_ESCALA',
        tenantId,
        masterId,
        detalhes: { escalaId: escala.id, nome: escala.nome },
      },
      tx
    );
  });
}

export async function listEscalaMedicosService(tenantId: string, escalaId: string) {
  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId },
  });

  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada' };
  }

  return prisma.escalaMedico.findMany({
    where: { tenantId, escalaId },
    include: {
      medico: {
        select: {
          id: true,
          nomeCompleto: true,
          crm: true,
          email: true,
          especialidades: true,
          vinculo: true,
          ativo: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function alocarMedicoEscalaService(input: AlocarMedicoEscalaInput) {
  const cargo = input.cargo?.trim() || null;
  const valorHora = input.valorHora != null ? Number(input.valorHora) : null;

  return prisma.$transaction(async (tx: any) => {
    const [escala, medico] = await Promise.all([
      tx.escala.findFirst({
        where: { id: input.escalaId, tenantId: input.tenantId, ativo: true },
      }),
      tx.medico.findFirst({
        where: { id: input.medicoId, tenantId: input.tenantId, ativo: true },
      }),
    ]);

    if (!escala) {
      throw { statusCode: 404, message: 'Escala não encontrada ou inativa' };
    }
    if (!medico) {
      throw { statusCode: 404, message: 'Médico não encontrado ou inativo' };
    }

    const alocacao = await tx.escalaMedico.upsert({
      where: {
        tenantId_escalaId_medicoId: {
          tenantId: input.tenantId,
          escalaId: input.escalaId,
          medicoId: input.medicoId,
        },
      },
      update: {
        cargo,
        valorHora,
        ativo: true,
      },
      create: {
        tenantId: input.tenantId,
        escalaId: input.escalaId,
        medicoId: input.medicoId,
        cargo,
        valorHora,
        ativo: true,
      },
    });

    await createAuditLog(
      {
        acao: 'ALOCAR_MEDICO_ESCALA',
        tenantId: input.tenantId,
        masterId: input.masterId,
        medicoId: input.medicoId,
        detalhes: { escalaId: input.escalaId, alocacaoId: alocacao.id },
      },
      tx
    );

    return alocacao;
  });
}

export async function removerMedicoEscalaService(
  tenantId: string,
  masterId: string,
  escalaId: string,
  medicoId: string
) {
  return prisma.$transaction(async (tx: any) => {
    const alocacao = await tx.escalaMedico.findFirst({
      where: { tenantId, escalaId, medicoId },
    });

    if (!alocacao) {
      throw { statusCode: 404, message: 'Alocação não encontrada' };
    }

    await tx.escalaMedico.delete({ where: { id: alocacao.id } });

    await createAuditLog(
      {
        acao: 'REMOVER_MEDICO_ESCALA',
        tenantId,
        masterId,
        medicoId,
        detalhes: { escalaId },
      },
      tx
    );
  });
}

export async function listRegistrosPontoAdminService(
  tenantId: string,
  filters: {
    escalaId?: string;
    medicoId?: string;
    contratoAtivoId?: string;
    subgrupoId?: string;
    equipeId?: string;
    dataInicio?: string;
    dataFim?: string;
  }
) {
  let medicoIdsFilter: string[] | undefined;

  if (filters.equipeId) {
    const rows = await prisma.equipeMedico.findMany({
      where: { tenantId, equipeId: filters.equipeId },
      select: { medicoId: true },
    });
    medicoIdsFilter = rows.map((r) => r.medicoId);
    if (medicoIdsFilter.length === 0) medicoIdsFilter = [''];
  } else if (filters.contratoAtivoId) {
    let equipeIds: string[] = (
      await prisma.contratoEquipe.findMany({
        where: { tenantId, contratoAtivoId: filters.contratoAtivoId },
        select: { equipeId: true },
      })
    ).map((e) => e.equipeId);

    if (filters.subgrupoId && equipeIds.length > 0) {
      const equipesDoSubgrupo = await prisma.equipe.findMany({
        where: { id: { in: equipeIds }, subgrupoId: filters.subgrupoId },
        select: { id: true },
      });
      equipeIds = equipesDoSubgrupo.map((e) => e.id);
    }

    if (equipeIds.length === 0) {
      medicoIdsFilter = [''];
    } else {
      const rows = await prisma.equipeMedico.findMany({
        where: { tenantId, equipeId: { in: equipeIds } },
        select: { medicoId: true },
      });
      medicoIdsFilter = [...new Set(rows.map((r) => r.medicoId))];
      if (medicoIdsFilter.length === 0) medicoIdsFilter = [''];
    }
  }

  const where: any = {
    tenantId,
    ...(filters.escalaId ? { escalaId: filters.escalaId } : {}),
    ...(filters.medicoId ? { medicoId: filters.medicoId } : {}),
    ...(medicoIdsFilter !== undefined ? { medicoId: { in: medicoIdsFilter } } : {}),
    ...(filters.dataInicio || filters.dataFim
      ? {
          checkInAt: {
            ...(filters.dataInicio ? { gte: new Date(filters.dataInicio) } : {}),
            ...(filters.dataFim ? { lte: new Date(filters.dataFim) } : {}),
          },
        }
      : {}),
  };

  const registroSelectSemCongelado = {
    id: true,
    tenantId: true,
    escalaId: true,
    medicoId: true,
    checkInAt: true,
    checkOutAt: true,
    origem: true,
    observacao: true,
    duracaoMinutos: true,
    checkInAtrasado: true,
    minutosAtrasoCheckin: true,
    fotoCheckinCaminho: true,
    motivoCheckinSemFoto: true,
    createdAt: true,
    updatedAt: true,
    medico: {
      select: { id: true, nomeCompleto: true, crm: true, email: true },
    },
    escala: {
      select: { id: true, nome: true, dataInicio: true, dataFim: true },
    },
  } as const;

  let registros: any[];
  try {
    registros = await prisma.registroPonto.findMany({
      where,
      select: { ...registroSelectSemCongelado, repasseValorCongelado: true } as any,
      orderBy: { checkInAt: 'desc' },
    });
  } catch (e: any) {
    if (
      isMissingDatabaseColumnError(e, 'repasse_valor_congelado') ||
      isMissingDatabaseColumnError(e, 'checkin_atrasado') ||
      isMissingDatabaseColumnError(e, 'minutos_atraso_checkin')
    ) {
      registros = await prisma.registroPonto.findMany({
        where,
        select: {
          id: true,
          tenantId: true,
          escalaId: true,
          medicoId: true,
          checkInAt: true,
          checkOutAt: true,
          origem: true,
          observacao: true,
          duracaoMinutos: true,
          fotoCheckinCaminho: true,
          motivoCheckinSemFoto: true,
          createdAt: true,
          updatedAt: true,
          medico: {
            select: { id: true, nomeCompleto: true, crm: true, email: true },
          },
          escala: {
            select: { id: true, nome: true, dataInicio: true, dataFim: true },
          },
        },
        orderBy: { checkInAt: 'desc' },
      });
    } else {
      throw e;
    }
  }

  const escalaIdsParaBuscar = [
    ...new Set(
      registros
        .filter((r) => r.escalaId != null && (!r.escala || !r.escala.nome))
        .map((r) => r.escalaId!)
    ),
  ];
  let escalaNomePorId: Record<string, string> = {};
  if (escalaIdsParaBuscar.length > 0) {
    const escalas = await prisma.escala.findMany({
      where: { id: { in: escalaIdsParaBuscar }, tenantId },
      select: { id: true, nome: true },
    });
    escalaNomePorId = Object.fromEntries(escalas.map((e) => [e.id, e.nome]));
  }
  const registrosComEscalaNome = registros.map((r) => {
    if (!r.escalaId) return r;
    const nomeExistente = r.escala?.nome?.trim();
    if (nomeExistente) return r;
    const nome = escalaNomePorId[r.escalaId];
    if (!nome) return r;
    return {
      ...r,
      escala: {
        id: r.escalaId,
        nome,
        dataInicio: (r.escala as any)?.dataInicio ?? null,
        dataFim: (r.escala as any)?.dataFim ?? null,
      },
    };
  });

  const medicoIdsSemEscala = [
    ...new Set(
      registrosComEscalaNome.filter((r) => r.escalaId == null).map((r) => r.medicoId)
    )
  ];
  const valorHoraPorMedico: Record<string, number> = {};
  const valorHoraCobrancaPorMedico: Record<string, number> = {};
  const valorHoraPorRegistroPontoId: Record<string, number> = {};
  const valorHoraCobrancaPorRegistroPontoId: Record<string, number> = {};

  const diaKeyFromDate = (d: Date): 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom' => {
    // JS: 0=dom,1=seg,...6=sab
    switch (d.getDay()) {
      case 1:
        return 'seg';
      case 2:
        return 'ter';
      case 3:
        return 'qua';
      case 4:
        return 'qui';
      case 5:
        return 'sex';
      case 6:
        return 'sab';
      default:
        return 'dom';
    }
  };

  for (const medicoId of medicoIdsSemEscala) {
    const equipeIds = await prisma.equipeMedico
      .findMany({
        where: { tenantId, medicoId },
        select: { equipeId: true },
      })
      .then((rows) => rows.map((r) => r.equipeId));

    if (equipeIds.length === 0) continue;

    let config: {
      valorHora: unknown;
      valorHoraCobranca: unknown;
      valorHoraPorDia?: unknown;
      valorHoraCobrancaPorDia?: unknown;
    } | null;
    try {
      config = await prisma.configPontoEletronico.findFirst({
        where: {
          tenantId,
          equipeId: { in: equipeIds },
          OR: [
            { valorHora: { not: null } },
            { valorHoraCobranca: { not: null } },
            { valorHoraPorDia: { not: Prisma.DbNull } },
            { valorHoraCobrancaPorDia: { not: Prisma.DbNull } },
          ],
        },
        select: {
          valorHora: true,
          valorHoraCobranca: true,
          valorHoraPorDia: true,
          valorHoraCobrancaPorDia: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    } catch (e) {
      // DB sem colunas JSON ainda (migração não aplicada) → mesmo comportamento de antes (só globais).
      if (
        isMissingDatabaseColumnError(e, 'valor_hora_por_dia') ||
        isMissingDatabaseColumnError(e, 'valor_hora_cobranca_por_dia')
      ) {
        config = await prisma.configPontoEletronico.findFirst({
          where: {
            tenantId,
            equipeId: { in: equipeIds },
            OR: [{ valorHora: { not: null } }, { valorHoraCobranca: { not: null } }],
          },
          select: { valorHora: true, valorHoraCobranca: true },
          orderBy: { createdAt: 'asc' },
        });
      } else {
        throw e;
      }
    }

    if (config?.valorHora != null) {
      valorHoraPorMedico[medicoId] = Number(config.valorHora);
    }
    if (config?.valorHoraCobranca != null) {
      valorHoraCobrancaPorMedico[medicoId] = Number(config.valorHoraCobranca);
    }

    // Valores por dia da semana (ponto sem escala): resolve por registro.
    const registrosDoMedicoSemEscala = (registrosComEscalaNome as any[]).filter(
      (r) => r.medicoId === medicoId && r.escalaId == null
    ) as Array<{ id: string; checkInAt: Date | string | null }>;
    for (const r of registrosDoMedicoSemEscala) {
      const dt = r.checkInAt ? (r.checkInAt instanceof Date ? r.checkInAt : new Date(r.checkInAt)) : null;
      if (!dt || Number.isNaN(dt.getTime())) continue;
      const dk = diaKeyFromDate(dt);
      const vhDia = (config?.valorHoraPorDia as any)?.[dk];
      const vhCobDia = (config?.valorHoraCobrancaPorDia as any)?.[dk];
      const vhResolved = vhDia != null ? Number(vhDia) : config?.valorHora != null ? Number(config.valorHora) : null;
      const vhCobResolved =
        vhCobDia != null ? Number(vhCobDia) : config?.valorHoraCobranca != null ? Number(config.valorHoraCobranca) : null;
      if (vhResolved != null && Number.isFinite(vhResolved) && vhResolved >= 0) {
        valorHoraPorRegistroPontoId[r.id] = vhResolved;
      }
      if (vhCobResolved != null && Number.isFinite(vhCobResolved) && vhCobResolved >= 0) {
        valorHoraCobrancaPorRegistroPontoId[r.id] = vhCobResolved;
      }
    }
  }

  const paresMedicoEscala = [...new Set(
    registrosComEscalaNome
      .filter((r) => r.escalaId != null && r.medicoId != null)
      .map((r) => `${r.medicoId}::${r.escalaId}`)
  )];
  const valorHoraPorMedicoEscala: Record<string, number> = {};
  if (paresMedicoEscala.length > 0) {
    const medicoIds = [...new Set(paresMedicoEscala.map((k) => k.split('::')[0]))];
    const escalaIds = [...new Set(paresMedicoEscala.map((k) => k.split('::')[1]))];
    const alocacoes = await prisma.escalaMedico.findMany({
      where: { tenantId, medicoId: { in: medicoIds }, escalaId: { in: escalaIds } },
      select: { medicoId: true, escalaId: true, valorHora: true },
    });
    for (const aloc of alocacoes) {
      if (aloc.valorHora != null) {
        valorHoraPorMedicoEscala[`${aloc.medicoId}::${aloc.escalaId}`] = Number(aloc.valorHora);
      }
    }
  }

  const registrosComFotoDisponivel = registrosComEscalaNome.map((r: any) => {
    const stored = typeof r.fotoCheckinCaminho === 'string' ? r.fotoCheckinCaminho.trim() : '';
    if (!stored) return r;
    try {
      const abs = resolveStoredFileToAbsolute(stored);
      if (fileExistsSafe(abs)) return r;
    } catch {
      // caminho inválido → tratar como indisponível
    }
    return { ...r, fotoCheckinCaminho: null };
  });

  const escalaIdsNosRegistros = [
    ...new Set(registrosComFotoDisponivel.map((r: any) => r.escalaId).filter(Boolean)),
  ] as string[];

  const plantoesValorHoraPorEscalaDataGrade: Record<string, number> = {};
  if (escalaIdsNosRegistros.length > 0 && (filters.dataInicio || filters.dataFim)) {
    const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : undefined;
    const dataFim = filters.dataFim ? new Date(filters.dataFim) : undefined;
    const wherePlantao: any = { tenantId, escalaId: { in: escalaIdsNosRegistros } };
    if (dataInicio || dataFim) {
      wherePlantao.data = {};
      if (dataInicio) wherePlantao.data.gte = dataInicio;
      if (dataFim) wherePlantao.data.lte = dataFim;
    }
    const plantaoSelectSemSnapshot = {
      escalaId: true,
      medicoId: true,
      data: true,
      gradeId: true,
      valorHora: true,
    } as const;
    type PlantaoRelatorioRow = {
      escalaId: string;
      medicoId: string;
      data: Date;
      gradeId: string;
      valorHora: unknown;
      horasTurnoSnapshot?: unknown;
    };
    let plantoes: PlantaoRelatorioRow[];
    try {
      plantoes = (await prisma.escalaPlantao.findMany({
        where: wherePlantao,
        select: { ...plantaoSelectSemSnapshot, horasTurnoSnapshot: true } as any,
      })) as unknown as PlantaoRelatorioRow[];
    } catch (e: any) {
      if (isMissingDatabaseColumnError(e, 'horas_turno_snapshot')) {
        plantoes = (await prisma.escalaPlantao.findMany({
          where: wherePlantao,
          select: { ...plantaoSelectSemSnapshot },
        })) as unknown as PlantaoRelatorioRow[];
      } else {
        throw e;
      }
    }
    for (const p of plantoes) {
      if (p.valorHora == null) continue;
      const dateStr = p.data.toISOString().slice(0, 10);
      const gradeKey = String(p.gradeId ?? '').toLowerCase();
      plantoesValorHoraPorEscalaDataGrade[`${p.escalaId}::${dateStr}::${gradeKey}`] = Number(p.valorHora);
    }

    const escalasDosRegistros = await prisma.escala.findMany({
      where: { id: { in: escalaIdsNosRegistros }, tenantId },
      select: { id: true, contratoAtivoId: true },
    });
    const contratoIdsRelatorio = [
      ...new Set(escalasDosRegistros.map((e) => e.contratoAtivoId).filter(Boolean)),
    ] as string[];
    const todosTiposDosContratos =
      contratoIdsRelatorio.length > 0
        ? await prisma.tipoPlantao.findMany({
            where: { tenantId, contratoAtivoId: { in: contratoIdsRelatorio } },
            select: { id: true, horaInicio: true, horaFim: true, cruzaMeiaNoite: true },
          })
        : [];

    const tipoScheduleByGradeId = new Map(
      todosTiposDosContratos.map((t) => [t.id, scheduleFromTipoRow(t)] as const)
    );

    const horasTurnoPorGradeId: Record<string, number> = { mt: 12, sn: 12 };
    for (const t of todosTiposDosContratos) {
      const sch = scheduleFromTipoRow(t);
      horasTurnoPorGradeId[String(t.id).toLowerCase()] =
        Math.round(duracaoPlantaoHorasUtc(sch) * 10000) / 10000;
    }

    const scheduleForPlantaoGrade = (gradeId: string) => {
      const fromTipo = tipoScheduleByGradeId.get(gradeId);
      if (fromTipo) return fromTipo;
      return scheduleFromLegacyGradeId(gradeId);
    };

    const inferLegacyGradeFromCheckIn = (d: Date): 'mt' | 'sn' => {
      const h = d.getHours();
      return h >= 7 && h < 19 ? 'mt' : 'sn';
    };

    /** Horas previstas do turno (por registro), para dividir valor total do plantão no relatório. */
    const horasTurnoPorRegistroPontoId: Record<string, number> = {};

    const valorPlantao12hPorRegistroPontoId: Record<string, number> = {};
    /**
     * Grade do plantão cuja janela horária contém o check-in (UUID do tipo ou mt/sn legado).
     * Permite faturamento via cadastro "Valores" quando o plantão não tem valorHora, e convive
     * com escalas antigas (2 turnos) e novas (N turnos) sem misturar chaves.
     */
    const gradeIdPlantaoPorRegistroPontoId: Record<string, string> = {};
    for (const r of registrosComFotoDisponivel as { id: string; escalaId: string | null; medicoId: string; checkInAt: Date }[]) {
      if (!r.escalaId || !r.medicoId || !r.checkInAt) continue;
      const checkInAt = r.checkInAt instanceof Date ? r.checkInAt : new Date(r.checkInAt);
      const candidates = plantoes.filter((p) => p.escalaId === r.escalaId && p.medicoId === r.medicoId);
      if (candidates.length === 0) continue;

      const matches = candidates.filter((p) =>
        instanteDentroDaJanelaPlantaoUtc(checkInAt, p.data, scheduleForPlantaoGrade(p.gradeId))
      );

      let chosen: (typeof plantoes)[number] | null = null;
      if (matches.length === 1) {
        chosen = matches[0];
      } else if (matches.length > 1) {
        // Várias janelas cobrem o mesmo instante (ex.: 07–12 dentro de 07–19): usa o turno mais curto
        // para não aplicar valor/duração do slot errado ao histórico.
        chosen = [...matches].sort((a, b) => {
          const da = duracaoPlantaoHorasUtc(scheduleForPlantaoGrade(a.gradeId));
          const db = duracaoPlantaoHorasUtc(scheduleForPlantaoGrade(b.gradeId));
          if (da !== db) return da - db;
          return a.gradeId.localeCompare(b.gradeId);
        })[0];
      } else if (candidates.length === 1) {
        chosen = candidates[0];
      } else {
        const leg = inferLegacyGradeFromCheckIn(checkInAt);
        const legacyHits = candidates.filter((p) => String(p.gradeId).toLowerCase() === leg);
        chosen = legacyHits.length === 1 ? legacyHits[0] : null;
      }

      if (chosen) {
        gradeIdPlantaoPorRegistroPontoId[r.id] = chosen.gradeId;
        const gk = String(chosen.gradeId).toLowerCase();
        const snapH =
          chosen.horasTurnoSnapshot != null ? Number(chosen.horasTurnoSnapshot) : NaN;
        const h =
          Number.isFinite(snapH) && snapH > 0
            ? snapH
            : horasTurnoPorGradeId[gk] ??
              Math.round(duracaoPlantaoHorasUtc(scheduleForPlantaoGrade(chosen.gradeId)) * 10000) / 10000;
        if (h > 0) {
          horasTurnoPorRegistroPontoId[r.id] = h;
        }
        if (chosen.valorHora != null) {
          valorPlantao12hPorRegistroPontoId[r.id] = Number(chosen.valorHora);
        }
      }
    }

    return {
      data: registrosComFotoDisponivel,
      valorHoraPorMedico,
      valorHoraCobrancaPorMedico,
      valorHoraPorRegistroPontoId,
      valorHoraCobrancaPorRegistroPontoId,
      valorHoraPorMedicoEscala,
      plantoesValorHoraPorEscalaDataGrade,
      valorPlantao12hPorRegistroPontoId,
      gradeIdPlantaoPorRegistroPontoId,
      horasTurnoPorRegistroPontoId,
      horasTurnoPorGradeId,
    };
  }

  return {
    data: registrosComFotoDisponivel,
    valorHoraPorMedico,
    valorHoraCobrancaPorMedico,
    valorHoraPorRegistroPontoId,
    valorHoraCobrancaPorRegistroPontoId,
    valorHoraPorMedicoEscala,
    plantoesValorHoraPorEscalaDataGrade,
    valorPlantao12hPorRegistroPontoId: {} as Record<string, number>,
    gradeIdPlantaoPorRegistroPontoId: {} as Record<string, string>,
    horasTurnoPorRegistroPontoId: {} as Record<string, number>,
    horasTurnoPorGradeId: {} as Record<string, number>,
  };
}

export async function listEscalaPlantoesService(
  tenantId: string,
  escalaId: string,
  filters: { dataInicio?: string; dataFim?: string }
) {
  const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : undefined;
  const dataFim = filters.dataFim ? new Date(filters.dataFim) : undefined;

  const where: any = {
    tenantId,
    escalaId,
  };
  if (dataInicio || dataFim) {
    where.data = {};
    if (dataInicio) where.data.gte = dataInicio;
    if (dataFim) where.data.lte = dataFim;
  }

  return prisma.escalaPlantao.findMany({
    where,
    include: {
      medico: {
        select: { id: true, nomeCompleto: true, crm: true, email: true, telefone: true },
      },
    },
    orderBy: [{ data: 'asc' }, { gradeId: 'asc' }, { medicoId: 'asc' }],
  });
}

/** Lista plantões de escalas que incluem a equipe, no período informado. */
export async function listEquipePlantoesService(
  tenantId: string,
  equipeId: string,
  filters: { dataInicio?: string; dataFim?: string; modo?: 'fixa' | 'dinamica' }
) {
  const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : undefined;
  const dataFim = filters.dataFim ? new Date(filters.dataFim) : undefined;

  const escalaEquipes = await prisma.escalaEquipe.findMany({
    where: { tenantId, equipeId },
    select: { escalaId: true },
  });
  const escalaIds = escalaEquipes.map((e) => e.escalaId);
  if (escalaIds.length === 0) {
    return [];
  }

  const where: any = {
    tenantId,
    escalaId: { in: escalaIds },
  };
  if (dataInicio || dataFim) {
    where.data = {};
    if (dataInicio) where.data.gte = dataInicio;
    if (dataFim) where.data.lte = dataFim;
  }

  const plantoes = await prisma.escalaPlantao.findMany({
    where,
    include: {
      medico: {
        select: { id: true, nomeCompleto: true, crm: true, email: true, telefone: true },
      },
    },
    orderBy: [{ data: 'asc' }, { gradeId: 'asc' }, { medicoId: 'asc' }],
  });

  if (plantoes.length === 0) return [];

  // "Dinâmica" = médico atualmente no plantão (pós-trocas aceitas).
  if (filters.modo !== 'fixa') {
    return plantoes;
  }

  // "Fixa" = médico originalmente definido pelo master.
  // Se houve troca aceita, usamos o solicitante da primeira troca aceita desse plantão
  // (origem da cadeia de trocas). Sem troca aceita, cai no médico atual.
  const plantaoIds = plantoes.map((p) => p.id);
  const trocasAceitas = await prisma.solicitacaoTrocaPlantao.findMany({
    where: {
      tenantId,
      escalaPlantaoId: { in: plantaoIds },
      status: 'ACEITA',
    },
    select: {
      escalaPlantaoId: true,
      medicoSolicitanteId: true,
      respondidaEm: true,
      createdAt: true,
    },
    orderBy: [{ respondidaEm: 'asc' }, { createdAt: 'asc' }],
  });

  const medicoFixoPorPlantaoId = new Map<string, string>();
  for (const t of trocasAceitas) {
    if (!medicoFixoPorPlantaoId.has(t.escalaPlantaoId)) {
      medicoFixoPorPlantaoId.set(t.escalaPlantaoId, t.medicoSolicitanteId);
    }
  }

  const medicoIdsFixos = [...new Set(plantoes.map((p) => medicoFixoPorPlantaoId.get(p.id) ?? p.medicoId))];
  const medicosFixos = await prisma.medico.findMany({
    where: { tenantId, id: { in: medicoIdsFixos } },
    select: { id: true, nomeCompleto: true, crm: true, email: true, telefone: true },
  });
  const medicoById = new Map(medicosFixos.map((m) => [m.id, m]));

  return plantoes.map((p) => {
    const medicoFixoId = medicoFixoPorPlantaoId.get(p.id) ?? p.medicoId;
    return {
      ...p,
      medicoId: medicoFixoId,
      medico: medicoById.get(medicoFixoId) ?? p.medico,
    };
  });
}

/** Lista escalas que incluem a equipe (via EscalaEquipe). */
export async function listEquipeEscalasService(tenantId: string, equipeId: string) {
  const escalaEquipes = await prisma.escalaEquipe.findMany({
    where: { tenantId, equipeId },
    select: { escalaId: true },
  });
  const escalaIds = escalaEquipes.map((e) => e.escalaId);
  if (escalaIds.length === 0) return [];
  return prisma.escala.findMany({
    where: { id: { in: escalaIds }, tenantId },
    orderBy: [{ dataInicio: 'desc' }],
    include: {
      contratoAtivo: { select: { id: true, nome: true, ativo: true } },
    },
  });
}

const TROCA_PLANTAO_STATUS_HISTORICO = ['ACEITA', 'RECUSADA'] as const;

/** Solicitações de troca já respondidas vinculadas a plantões desta escala (auditoria no painel master). */
export async function listHistoricoTrocasPlantaoEscalaService(tenantId: string, escalaId: string) {
  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId },
    select: { id: true },
  });
  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada' };
  }

  const rows = await prisma.solicitacaoTrocaPlantao.findMany({
    where: {
      tenantId,
      status: { in: [...TROCA_PLANTAO_STATUS_HISTORICO] },
      plantao: { escalaId, tenantId },
    },
    orderBy: [{ respondidaEm: 'desc' }, { createdAt: 'desc' }],
    include: {
      solicitante: { select: { id: true, nomeCompleto: true, crm: true } },
      destino: { select: { id: true, nomeCompleto: true, crm: true } },
      plantao: { select: { id: true, data: true, gradeId: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    tipoSolicitacao: String((r as { tipoSolicitacao?: string }).tipoSolicitacao ?? 'PERMUTA').toUpperCase(),
    respondidaEm: (r.respondidaEm ?? r.createdAt).toISOString(),
    createdAt: r.createdAt.toISOString(),
    plantaoId: r.plantao.id,
    dataPlantao: r.plantao.data.toISOString().slice(0, 10),
    gradeId: r.plantao.gradeId,
    solicitante: {
      id: r.solicitante.id,
      nomeCompleto: r.solicitante.nomeCompleto,
      crm: r.solicitante.crm,
    },
    destino: r.destino
      ? {
          id: r.destino.id,
          nomeCompleto: r.destino.nomeCompleto,
          crm: r.destino.crm,
        }
      : null,
  }));
}

export async function createEscalaPlantaoService(input: {
  tenantId: string;
  masterId: string;
  escalaId: string;
  data: string;
  gradeId: string;
  medicoId: string;
  valorHora?: number | null;
}) {
  const dataDate = new Date(input.data);
  if (isNaN(dataDate.getTime())) {
    throw { statusCode: 400, message: 'Data inválida' };
  }
  const [escala, medico] = await Promise.all([
    prisma.escala.findFirst({
      // Permitir atribuir plantões também em escalas em rascunho (ativo=false)
      where: { id: input.escalaId, tenantId: input.tenantId },
    }),
    prisma.medico.findFirst({
      where: { id: input.medicoId, tenantId: input.tenantId, ativo: true },
    }),
  ]);

  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada ou inativa' };
  }
  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado ou inativo' };
  }

  const gradeId = await resolveGradeIdParaContrato(input.tenantId, escala.contratoAtivoId, input.gradeId);

  const valorHora = input.valorHora != null ? Number(input.valorHora) : null;
  const horasTurnoSnapshot = await resolverHorasTurnoSnapshotParaGrade(
    input.tenantId,
    escala.contratoAtivoId,
    gradeId
  );

  const snapshotFields =
    horasTurnoSnapshot != null ? { horasTurnoSnapshot } : ({} as { horasTurnoSnapshot?: number });

  const runPlantaoTx = async (includeSnapshot: boolean) => {
    const snap = includeSnapshot ? snapshotFields : {};
    return prisma.$transaction(async (tx: any) => {
      await tx.escalaMedico.upsert({
        where: {
          tenantId_escalaId_medicoId: {
            tenantId: input.tenantId,
            escalaId: input.escalaId,
            medicoId: input.medicoId,
          },
        },
        update: { ativo: true },
        create: {
          tenantId: input.tenantId,
          escalaId: input.escalaId,
          medicoId: input.medicoId,
          ativo: true,
        },
      });

      const medicoInclude = {
        medico: {
          select: { id: true, nomeCompleto: true, crm: true, email: true, telefone: true },
        },
      };

      const existingPlantao = await tx.escalaPlantao.findFirst({
        where: {
          tenantId: input.tenantId,
          escalaId: input.escalaId,
          data: dataDate,
          gradeId,
          medicoId: input.medicoId,
        },
        include: medicoInclude,
      });

      const plantao = existingPlantao
        ? await tx.escalaPlantao.update({
            where: { id: existingPlantao.id },
            data: { valorHora, ...snap },
            include: medicoInclude,
          })
        : await tx.escalaPlantao.create({
            data: {
              tenantId: input.tenantId,
              escalaId: input.escalaId,
              data: dataDate,
              gradeId,
              medicoId: input.medicoId,
              valorHora,
              ...snap,
            },
            include: medicoInclude,
          });

      await createAuditLog(
        {
          acao: 'CRIAR_ESCALA_PLANTAO',
          tenantId: input.tenantId,
          masterId: input.masterId,
          medicoId: input.medicoId,
          detalhes: { escalaId: input.escalaId, data: input.data, gradeId, plantaoId: plantao.id },
        },
        tx
      );

      return plantao;
    });
  };

  try {
    return await runPlantaoTx(true);
  } catch (e) {
    if (isMissingDatabaseColumnError(e, 'horas_turno_snapshot')) {
      return await runPlantaoTx(false);
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw {
        statusCode: 409,
        message:
          'Conflito ao gravar plantão: já existe registro para este dia e turno. Se você precisa de mais de um médico no mesmo slot, rode no backend: npx prisma migrate deploy (migração escala_plantao_multi_medico_slot).',
      };
    }
    throw e;
  }
}

function parseMesYYYYMM(mes: string): { y: number; m: number } {
  const m = mes.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) throw { statusCode: 400, message: 'Formato de mês inválido (use YYYY-MM)' };
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) throw { statusCode: 400, message: 'Mês inválido' };
  return { y, m: mo };
}

function ymdUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Replica plantões do mês de origem para o mesmo dia civil no mês de destino (ajusta último dia se necessário). */
export async function replicarEscalaPlantoesMesService(input: {
  tenantId: string;
  masterId: string;
  escalaId: string;
  mesOrigem: string;
  mesDestino: string;
}): Promise<{
  criados: number;
  ignoradosJaExistia: number;
  ignoradosForaPeriodo: number;
  erros: number;
  totalOrigem: number;
}> {
  const orig = parseMesYYYYMM(input.mesOrigem);
  const dest = parseMesYYYYMM(input.mesDestino);
  if (input.mesOrigem.trim() === input.mesDestino.trim()) {
    throw { statusCode: 400, message: 'O mês de destino deve ser diferente do mês de origem' };
  }

  const escala = await prisma.escala.findFirst({
    where: { id: input.escalaId, tenantId: input.tenantId },
  });
  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada' };
  }

  const escalaInicio = ymdUTC(escala.dataInicio);
  const escalaFim = ymdUTC(escala.dataFim);

  const inicioOrig = new Date(Date.UTC(orig.y, orig.m - 1, 1));
  const fimOrig = new Date(Date.UTC(orig.y, orig.m, 0, 23, 59, 59, 999));

  const plantoes = await prisma.escalaPlantao.findMany({
    where: {
      tenantId: input.tenantId,
      escalaId: input.escalaId,
      data: { gte: inicioOrig, lte: fimOrig },
    },
  });

  if (plantoes.length === 0) {
    throw { statusCode: 400, message: 'Não há plantões no mês de origem para replicar' };
  }

  let criados = 0;
  let ignoradosJaExistia = 0;
  let ignoradosForaPeriodo = 0;
  let erros = 0;

  const lastDayDest = new Date(Date.UTC(dest.y, dest.m, 0)).getUTCDate();

  for (const p of plantoes) {
    const src = new Date(p.data);
    const srcDay = src.getUTCDate();
    const dayClamped = Math.min(srcDay, lastDayDest);
    const targetYmd = `${dest.y}-${String(dest.m).padStart(2, '0')}-${String(dayClamped).padStart(2, '0')}`;

    if (targetYmd < escalaInicio || targetYmd > escalaFim) {
      ignoradosForaPeriodo += 1;
      continue;
    }

    const dataDateTarget = new Date(`${targetYmd}T12:00:00.000Z`);
    const jaExiste = await prisma.escalaPlantao.findFirst({
      where: {
        tenantId: input.tenantId,
        escalaId: input.escalaId,
        data: dataDateTarget,
        gradeId: p.gradeId,
        medicoId: p.medicoId,
      },
    });
    if (jaExiste) {
      ignoradosJaExistia += 1;
      continue;
    }

    try {
      await createEscalaPlantaoService({
        tenantId: input.tenantId,
        masterId: input.masterId,
        escalaId: input.escalaId,
        data: targetYmd,
        gradeId: p.gradeId,
        medicoId: p.medicoId,
        valorHora: p.valorHora != null ? Number(p.valorHora) : undefined,
      });
      criados += 1;
    } catch (e: any) {
      const code = e?.statusCode;
      if (code === 409) {
        ignoradosJaExistia += 1;
      } else if (code === 404) {
        erros += 1;
      } else {
        throw e;
      }
    }
  }

  await createAuditLog({
    acao: 'REPLICAR_ESCALA_PLANTAO_MES',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: {
      escalaId: input.escalaId,
      mesOrigem: input.mesOrigem,
      mesDestino: input.mesDestino,
      criados,
      ignoradosJaExistia,
      ignoradosForaPeriodo,
      erros,
      totalOrigem: plantoes.length,
    },
  });

  return {
    criados,
    ignoradosJaExistia,
    ignoradosForaPeriodo,
    erros,
    totalOrigem: plantoes.length,
  };
}

export async function removerEscalaPlantaoService(
  tenantId: string,
  masterId: string,
  plantaoId: string
) {
  const plantao = await prisma.escalaPlantao.findFirst({
    where: { id: plantaoId, tenantId },
  });

  if (!plantao) {
    throw { statusCode: 404, message: 'Plantão não encontrado' };
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.escalaPlantao.delete({ where: { id: plantaoId } });

    await createAuditLog(
      {
        acao: 'REMOVER_ESCALA_PLANTAO',
        tenantId,
        masterId,
        medicoId: plantao.medicoId,
        detalhes: { escalaId: plantao.escalaId, data: plantao.data, gradeId: plantao.gradeId },
      },
      tx
    );
  });
}

export async function getValoresPlantaoService(
  tenantId: string,
  contratoAtivoId: string,
  subgrupoId?: string | null,
  equipeId?: string | null
) {
  await ensureTiposLegadoMigrados(tenantId, contratoAtivoId);
  const sg = subgrupoId?.trim();
  if (!sg) {
    const rows = await prisma.valorPlantao.findMany({
      where: { tenantId, contratoAtivoId },
      orderBy: [{ subgrupoId: 'asc' }, { gradeId: 'asc' }],
    });
    return rows;
  }

  const eq = equipeId?.trim();
  if (!eq) {
    const rows = await prisma.valorPlantao.findMany({
      where: { tenantId, contratoAtivoId, subgrupoId: sg, equipeId: null },
      orderBy: [{ gradeId: 'asc' }],
    });
    return rows;
  }

  const rows = await prisma.valorPlantao.findMany({
    where: {
      tenantId,
      contratoAtivoId,
      subgrupoId: sg,
      OR: [{ equipeId: eq }, { equipeId: null }],
    },
    orderBy: [{ gradeId: 'asc' }],
  });

  const byGrade = new Map<string, (typeof rows)[0]>();
  for (const r of rows) {
    if (r.equipeId != null && r.equipeId === eq) {
      byGrade.set(r.gradeId, r);
    }
  }
  for (const r of rows) {
    if (r.equipeId == null && !byGrade.has(r.gradeId)) {
      byGrade.set(r.gradeId, r);
    }
  }
  return Array.from(byGrade.values()).sort((a, b) => a.gradeId.localeCompare(b.gradeId));
}

export async function listAdicionaisPlantaoService(input: {
  tenantId: string;
  contratoAtivoId: string;
  dataInicio?: Date;
  dataFim?: Date;
}) {
  await ensureTiposLegadoMigrados(input.tenantId, input.contratoAtivoId);
  const where: any = {
    tenantId: input.tenantId,
    contratoAtivoId: input.contratoAtivoId,
  };
  if (input.dataInicio || input.dataFim) {
    where.data = {};
    if (input.dataInicio) where.data.gte = input.dataInicio;
    if (input.dataFim) where.data.lte = input.dataFim;
  }
  const rows = await prisma.adicionalPlantaoData.findMany({
    where,
    orderBy: [{ data: 'asc' }, { gradeId: 'asc' }],
  });
  return rows;
}

export async function upsertAdicionalPlantaoService(input: {
  tenantId: string;
  masterId: string;
  contratoAtivoId: string;
  data: Date;
  gradeId: string;
  percentual: number;
}) {
  const gradeId = await resolveGradeIdParaContrato(
    input.tenantId,
    input.contratoAtivoId,
    input.gradeId
  );
  const percentual = Number(input.percentual);
  return prisma.$transaction(async (tx: any) => {
    const row = await tx.adicionalPlantaoData.upsert({
      where: {
        tenantId_contratoAtivoId_data_gradeId: {
          tenantId: input.tenantId,
          contratoAtivoId: input.contratoAtivoId,
          data: input.data,
          gradeId,
        },
      },
      update: { percentual },
      create: {
        tenantId: input.tenantId,
        contratoAtivoId: input.contratoAtivoId,
        data: input.data,
        gradeId,
        percentual,
      },
    });
    await createAuditLog(
      {
        acao: 'CONFIGURAR_ADICIONAL_PLANTAO',
        tenantId: input.tenantId,
        masterId: input.masterId,
        detalhes: {
          contratoAtivoId: input.contratoAtivoId,
          data: input.data,
          gradeId,
          percentual,
        },
      },
      tx
    );
    return row;
  });
}

export async function removerAdicionalPlantaoService(input: {
  tenantId: string;
  masterId: string;
  contratoAtivoId: string;
  data: Date;
  gradeId: string;
}) {
  const gradeId = await resolveGradeIdParaContrato(
    input.tenantId,
    input.contratoAtivoId,
    input.gradeId
  );
  return prisma.$transaction(async (tx: any) => {
    const row = await tx.adicionalPlantaoData.findUnique({
      where: {
        tenantId_contratoAtivoId_data_gradeId: {
          tenantId: input.tenantId,
          contratoAtivoId: input.contratoAtivoId,
          data: input.data,
          gradeId,
        },
      },
    });
    if (!row) {
      throw { statusCode: 404, message: 'Adicional não encontrado' };
    }
    await tx.adicionalPlantaoData.delete({ where: { id: row.id } });
    await createAuditLog(
      {
        acao: 'REMOVER_ADICIONAL_PLANTAO',
        tenantId: input.tenantId,
        masterId: input.masterId,
        detalhes: {
          contratoAtivoId: input.contratoAtivoId,
          data: input.data,
          gradeId,
          percentual: row.percentual,
        },
      },
      tx
    );
    return { ok: true };
  });
}

export async function setValorPlantaoService(input: {
  tenantId: string;
  masterId: string;
  contratoAtivoId: string;
  subgrupoId: string;
  equipeId: string;
  gradeId: string;
  valorHora: number | null;
  valorHoraCobranca?: number | null;
  valorHoraPorDia?: unknown;
  valorHoraCobrancaPorDia?: unknown;
}) {
  const gradeId = await resolveGradeIdParaContrato(
    input.tenantId,
    input.contratoAtivoId,
    input.gradeId
  );
  const equipeId = input.equipeId.trim();

  const contratoTemSubgrupo = await prisma.contratoSubgrupo.findFirst({
    where: {
      tenantId: input.tenantId,
      contratoAtivoId: input.contratoAtivoId,
      subgrupoId: input.subgrupoId,
    },
    select: { id: true },
  });
  if (!contratoTemSubgrupo) {
    throw { statusCode: 400, message: 'Subgrupo não vinculado a este contrato' };
  }

  const equipe = await prisma.equipe.findFirst({
    where: { id: equipeId, tenantId: input.tenantId },
  });
  if (!equipe) {
    throw { statusCode: 400, message: 'Equipe não encontrada' };
  }
  if (equipe.subgrupoId !== input.subgrupoId) {
    throw { statusCode: 400, message: 'Equipe não pertence ao subgrupo selecionado' };
  }
  if (equipe.ativo === false) {
    throw { statusCode: 400, message: 'Equipe inativa' };
  }

  const valorHora = input.valorHora != null ? Number(input.valorHora) : null;

  const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
  type DiaKey = (typeof DIAS)[number];
  const parseDiaMap = (
    raw: unknown
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
    // Se vier null explicitamente, limpar no banco (NULL).
    if (raw === null) return Prisma.DbNull;
    if (raw === undefined) return undefined;
    if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const inputObj = raw as Record<string, unknown>;
    const out: Record<DiaKey, number | null> = {
      seg: null,
      ter: null,
      qua: null,
      qui: null,
      sex: null,
      sab: null,
      dom: null,
    };
    let hasAny = false;
    for (const k of DIAS) {
      const v = inputObj[k];
      if (v == null || v === '') continue;
      const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
      if (!Number.isFinite(n) || n < 0) continue;
      out[k] = Math.round(n * 100) / 100;
      hasAny = true;
    }
    // Se não tem nenhum valor, tratar como "limpar" quando o cliente mandou objeto vazio.
    return hasAny ? out : Prisma.DbNull;
  };

  const valorHoraCobranca = input.valorHoraCobranca != null ? Number(input.valorHoraCobranca) : null;
  const valorHoraPorDia = parseDiaMap(input.valorHoraPorDia);
  const valorHoraCobrancaPorDia = parseDiaMap(input.valorHoraCobrancaPorDia);

  const data: any = {
    valorHora,
    valorHoraCobranca,
    ...(valorHoraPorDia !== undefined ? { valorHoraPorDia } : {}),
    ...(valorHoraCobrancaPorDia !== undefined ? { valorHoraCobrancaPorDia } : {}),
  };

  const existing = await prisma.valorPlantao.findFirst({
    where: {
      tenantId: input.tenantId,
      contratoAtivoId: input.contratoAtivoId,
      subgrupoId: input.subgrupoId,
      gradeId,
      equipeId,
    },
  });

  const row = existing
    ? await prisma.valorPlantao.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.valorPlantao.create({
        data: {
          tenantId: input.tenantId,
          contratoAtivoId: input.contratoAtivoId,
          subgrupoId: input.subgrupoId,
          equipeId,
          gradeId,
          ...data,
        },
      });

  await createAuditLog({
    acao: 'CONFIGURAR_VALOR_PLANTAO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: {
      contratoAtivoId: input.contratoAtivoId,
      subgrupoId: input.subgrupoId,
      equipeId,
      gradeId,
      valorHora,
      valorHoraCobranca,
      ...(valorHoraPorDia !== undefined ? { valorHoraPorDia } : {}),
      ...(valorHoraCobrancaPorDia !== undefined ? { valorHoraCobrancaPorDia } : {}),
    },
  });
  return row;
}

export async function getConfigPontoService(
  tenantId: string,
  contratoAtivoId: string,
  subgrupoId: string,
  equipeId: string | null
) {
  if (equipeId) {
    const row = await prisma.configPontoEletronico.findUnique({
      where: {
        tenantId_contratoAtivoId_subgrupoId_equipeId: {
          tenantId,
          contratoAtivoId,
          subgrupoId,
          equipeId,
        },
      },
    });
    return row;
  }
  const row = await prisma.configPontoEletronico.findFirst({
    where: {
      tenantId,
      contratoAtivoId,
      subgrupoId,
      equipeId: null,
    },
  });
  return row;
}

const HORARIO_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

function normalizarHorario(v: string | null | undefined): string | null {
  if (v == null || typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (!HORARIO_REGEX.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function parseCoord(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function setConfigPontoService(input: {
  tenantId: string;
  masterId: string;
  contratoAtivoId: string;
  subgrupoId: string;
  equipeId: string | null;
  horasPrevistasMes: number | null;
  valorHora: number | null;
  valorHoraCobranca: number | null;
  valorHoraPorDia?: unknown;
  valorHoraCobrancaPorDia?: unknown;
  horarioEntrada?: string | null;
  horarioSaida?: string | null;
  toleranciaMinutos?: number | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  raioMetros?: number | null;
  enderecoPonto?: string | null;
}) {
  const horasPrevistasMes = input.horasPrevistasMes != null ? Number(input.horasPrevistasMes) : null;
  const valorHora = input.valorHora != null ? Number(input.valorHora) : null;
  const valorHoraCobranca = input.valorHoraCobranca != null ? Number(input.valorHoraCobranca) : null;
  const horarioEntrada = normalizarHorario(input.horarioEntrada);
  const horarioSaida = normalizarHorario(input.horarioSaida);
  const toleranciaMinutos =
    input.toleranciaMinutos != null
      ? Math.max(0, Math.min(120, Math.round(Number(input.toleranciaMinutos))))
      : null;

  let latitude: number | null = parseCoord(input.latitude);
  let longitude: number | null = parseCoord(input.longitude);
  if (latitude != null && (latitude < -90 || latitude > 90)) latitude = null;
  if (longitude != null && (longitude < -180 || longitude > 180)) longitude = null;
  const raioMetros =
    input.raioMetros != null
      ? Math.max(0, Math.min(10000, Math.round(Number(input.raioMetros))))
      : null;

  const enderecoPonto =
    input.enderecoPonto != null && typeof input.enderecoPonto === 'string'
      ? input.enderecoPonto.trim().slice(0, 500) || null
      : null;

  const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
  type DiaKey = (typeof DIAS)[number];
  const parseDiaMap = (raw: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
    // Se vier null explicitamente, limpar no banco (NULL).
    if (raw === null) return Prisma.DbNull;
    if (raw === undefined) return undefined;
    if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const inputObj = raw as Record<string, unknown>;
    const out: Record<DiaKey, number | null> = {
      seg: null,
      ter: null,
      qua: null,
      qui: null,
      sex: null,
      sab: null,
      dom: null,
    };
    let hasAny = false;
    for (const k of DIAS) {
      const v = inputObj[k];
      if (v == null || v === '') continue;
      const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
      if (!Number.isFinite(n) || n < 0) continue;
      out[k] = n;
      hasAny = true;
    }
    // Se não tem nenhum valor, tratar como "limpar" quando o cliente mandou objeto vazio.
    return hasAny ? out : Prisma.DbNull;
  };

  const valorHoraPorDia = parseDiaMap(input.valorHoraPorDia);
  const valorHoraCobrancaPorDia = parseDiaMap(input.valorHoraCobrancaPorDia);

  const data = {
    horasPrevistasMes,
    valorHora,
    valorHoraCobranca,
    valorHoraPorDia,
    valorHoraCobrancaPorDia,
    horarioEntrada,
    horarioSaida,
    toleranciaMinutos,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    raioMetros,
    enderecoPonto,
  };

  if (input.equipeId) {
    const row = await prisma.configPontoEletronico.upsert({
      where: {
        tenantId_contratoAtivoId_subgrupoId_equipeId: {
          tenantId: input.tenantId,
          contratoAtivoId: input.contratoAtivoId,
          subgrupoId: input.subgrupoId,
          equipeId: input.equipeId,
        },
      },
      update: data,
      create: {
        tenantId: input.tenantId,
        contratoAtivoId: input.contratoAtivoId,
        subgrupoId: input.subgrupoId,
        equipeId: input.equipeId,
        ...data,
      },
    });
    await createAuditLog({
      acao: 'CONFIGURAR_PONTO_ELETRONICO',
      tenantId: input.tenantId,
      masterId: input.masterId,
      detalhes: {
        contratoAtivoId: input.contratoAtivoId,
        subgrupoId: input.subgrupoId,
        equipeId: input.equipeId,
        ...data,
      },
    });
    return row;
  }

  const existing = await prisma.configPontoEletronico.findFirst({
    where: {
      tenantId: input.tenantId,
      contratoAtivoId: input.contratoAtivoId,
      subgrupoId: input.subgrupoId,
      equipeId: null,
    },
  });
  const row = existing
    ? await prisma.configPontoEletronico.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.configPontoEletronico.create({
        data: {
          tenantId: input.tenantId,
          contratoAtivoId: input.contratoAtivoId,
          subgrupoId: input.subgrupoId,
          equipeId: null,
          ...data,
        },
      });
  await createAuditLog({
    acao: 'CONFIGURAR_PONTO_ELETRONICO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: {
      contratoAtivoId: input.contratoAtivoId,
      subgrupoId: input.subgrupoId,
      equipeId: null,
      ...data,
    },
  });
  return row;
}
