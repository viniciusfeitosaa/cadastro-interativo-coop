import { prisma } from '../config/database';
import { createAuditLog } from './auditoria.service';
import { clearPontoCaches } from './ponto.service';
import { isMissingDatabaseColumnError } from '../utils/prisma-column-error';

export async function listSubgruposService(tenantId: string) {
  return prisma.subgrupo.findMany({
    where: { tenantId },
    include: {
      _count: { select: { subgrupoMedicos: true, escalaSubgrupos: true, equipes: true } },
      contratoSubgrupos: {
        include: {
          contratoAtivo: { select: { id: true, nome: true } },
        },
      },
    },
    orderBy: { nome: 'asc' },
  });
}

export async function createSubgrupoService(
  tenantId: string,
  masterId: string,
  input: { nome: string; descricao?: string | null; ativo?: boolean; usaEscala?: boolean; usaPonto?: boolean }
) {
  if (!input.nome?.trim()) throw { statusCode: 400, message: 'Nome do subgrupo é obrigatório' };
  const usaEscala = input.usaEscala ?? true;
  const usaPonto = input.usaPonto ?? true;
  if (!usaEscala && !usaPonto) {
    throw { statusCode: 400, message: 'Selecione ao menos uma opção: usar escalas ou usar ponto eletrônico' };
  }
  const created = await prisma.subgrupo.create({
    data: {
      tenantId,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      ativo: input.ativo ?? true,
      usaEscala,
      usaPonto,
    },
  });
  await createAuditLog({
    acao: 'CRIAR_SUBGRUPO',
    tenantId,
    masterId,
    detalhes: { subgrupoId: created.id, nome: created.nome },
  });
  return created;
}

export async function updateSubgrupoService(
  tenantId: string,
  masterId: string,
  subgrupoId: string,
  input: { nome?: string; descricao?: string | null; ativo?: boolean; usaEscala?: boolean; usaPonto?: boolean }
) {
  const found = await prisma.subgrupo.findFirst({ where: { id: subgrupoId, tenantId } });
  if (!found) throw { statusCode: 404, message: 'Subgrupo não encontrado' };
  const nextUsaEscala = input.usaEscala !== undefined ? input.usaEscala : found.usaEscala;
  const nextUsaPonto = input.usaPonto !== undefined ? input.usaPonto : found.usaPonto;
  if (input.usaEscala !== undefined || input.usaPonto !== undefined) {
    if (!nextUsaEscala && !nextUsaPonto) {
      throw { statusCode: 400, message: 'Selecione ao menos uma opção: usar escalas ou usar ponto eletrônico' };
    }
  }
  try {
    const updated = await prisma.subgrupo.update({
      where: { id: found.id },
      data: {
        nome: input.nome?.trim() || undefined,
        descricao: input.descricao === undefined ? undefined : input.descricao?.trim() || null,
        ativo: input.ativo,
        usaEscala: input.usaEscala,
        usaPonto: input.usaPonto,
      },
    });
    await createAuditLog({
      acao: 'ATUALIZAR_SUBGRUPO',
      tenantId,
      masterId,
      detalhes: { subgrupoId: updated.id },
    });
    return updated;
  } catch (e: unknown) {
    if (isMissingDatabaseColumnError(e, 'usa_escala') || isMissingDatabaseColumnError(e, 'usa_ponto')) {
      throw {
        statusCode: 503,
        message:
          'Base de dados sem as colunas de estilo de produção no subgrupo. Na pasta backend execute: npx prisma migrate deploy — depois reinicie a API.',
      };
    }
    throw e;
  }
}

export async function deleteSubgrupoService(tenantId: string, masterId: string, subgrupoId: string) {
  const found = await prisma.subgrupo.findFirst({ where: { id: subgrupoId, tenantId } });
  if (!found) throw { statusCode: 404, message: 'Subgrupo não encontrado' };
  await prisma.subgrupo.delete({ where: { id: found.id } });
  await createAuditLog({
    acao: 'EXCLUIR_SUBGRUPO',
    tenantId,
    masterId,
    detalhes: { subgrupoId },
  });
}

export async function listSubgrupoMedicosService(tenantId: string, subgrupoId: string) {
  const subgrupo = await prisma.subgrupo.findFirst({ where: { id: subgrupoId, tenantId } });
  if (!subgrupo) throw { statusCode: 404, message: 'Subgrupo não encontrado' };
  return prisma.subgrupoMedico.findMany({
    where: { tenantId, subgrupoId },
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

export async function addMedicoToSubgrupoService(
  tenantId: string,
  masterId: string,
  subgrupoId: string,
  medicoId: string
) {
  const [subgrupo, medico] = await Promise.all([
    prisma.subgrupo.findFirst({ where: { id: subgrupoId, tenantId, ativo: true } }),
    prisma.medico.findFirst({ where: { id: medicoId, tenantId, ativo: true } }),
  ]);
  if (!subgrupo) throw { statusCode: 404, message: 'Subgrupo não encontrado ou inativo' };
  if (!medico) throw { statusCode: 404, message: 'Médico não encontrado ou inativo' };

  const existingSg = await prisma.subgrupoMedico.findUnique({
    where: { tenantId_subgrupoId_medicoId: { tenantId, subgrupoId, medicoId } },
  });
  if (existingSg) {
    return existingSg;
  }
  const row = await prisma.subgrupoMedico.create({
    data: { tenantId, subgrupoId, medicoId },
  });
  const { notificarMedicoVinculoSubgrupo } = await import('./notificacao-medico.service');
  await notificarMedicoVinculoSubgrupo(tenantId, medicoId, subgrupo.nome, subgrupoId);
  await createAuditLog({
    acao: 'ADICIONAR_MEDICO_SUBGRUPO',
    tenantId,
    masterId,
    medicoId,
    detalhes: { subgrupoId, subgrupoMedicoId: row.id },
  });
  clearPontoCaches(tenantId, medicoId);
  return row;
}

export async function removeMedicoFromSubgrupoService(
  tenantId: string,
  masterId: string,
  subgrupoId: string,
  medicoId: string
) {
  const row = await prisma.subgrupoMedico.findFirst({ where: { tenantId, subgrupoId, medicoId } });
  if (!row) throw { statusCode: 404, message: 'Vínculo não encontrado' };
  await prisma.subgrupoMedico.delete({ where: { id: row.id } });
  await createAuditLog({
    acao: 'REMOVER_MEDICO_SUBGRUPO',
    tenantId,
    masterId,
    medicoId,
    detalhes: { subgrupoId },
  });
  clearPontoCaches(tenantId, medicoId);
}

export async function listEquipesService(tenantId: string, subgrupoId?: string | null) {
  return prisma.equipe.findMany({
    where: {
      tenantId,
      ...(subgrupoId != null && subgrupoId !== '' ? { subgrupoId } : {}),
    },
    include: {
      _count: { select: { equipeMedicos: true, escalaEquipes: true } },
      subgrupo: {
        select: {
          id: true,
          nome: true,
          contratoSubgrupos: {
            select: {
              contratoAtivo: { select: { id: true, nome: true } },
            },
          },
        },
      },
      contratoEquipes: {
        select: {
          contratoAtivo: { select: { id: true, nome: true } },
        },
      },
    },
    orderBy: { nome: 'asc' },
  });
}

export async function createEquipeService(
  tenantId: string,
  masterId: string,
  input: { nome: string; descricao?: string | null; ativo?: boolean; subgrupoId?: string | null }
) {
  if (!input.nome?.trim()) throw { statusCode: 400, message: 'Nome da equipe é obrigatório' };
  const subgrupoId = input.subgrupoId?.trim() || null;
  const created = await prisma.equipe.create({
    data: {
      tenantId,
      subgrupoId,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      ativo: input.ativo ?? true,
    },
  });
  await createAuditLog({
    acao: 'CRIAR_EQUIPE',
    tenantId,
    masterId,
    detalhes: { equipeId: created.id, nome: created.nome, subgrupoId },
  });
  return created;
}

export async function updateEquipeService(
  tenantId: string,
  masterId: string,
  equipeId: string,
  input: { nome?: string; descricao?: string | null; ativo?: boolean; subgrupoId?: string | null }
) {
  const found = await prisma.equipe.findFirst({ where: { id: equipeId, tenantId } });
  if (!found) throw { statusCode: 404, message: 'Equipe não encontrada' };
  const subgrupoId = input.subgrupoId !== undefined ? (input.subgrupoId?.trim() || null) : undefined;
  const updated = await prisma.equipe.update({
    where: { id: found.id },
    data: {
      nome: input.nome?.trim() || undefined,
      descricao: input.descricao === undefined ? undefined : input.descricao?.trim() || null,
      ativo: input.ativo,
      subgrupoId,
    },
  });
  await createAuditLog({
    acao: 'ATUALIZAR_EQUIPE',
    tenantId,
    masterId,
    detalhes: { equipeId: updated.id },
  });
  return updated;
}

export async function deleteEquipeService(tenantId: string, masterId: string, equipeId: string) {
  const found = await prisma.equipe.findFirst({ where: { id: equipeId, tenantId } });
  if (!found) throw { statusCode: 404, message: 'Equipe não encontrada' };
  await prisma.equipe.delete({ where: { id: found.id } });
  await createAuditLog({
    acao: 'EXCLUIR_EQUIPE',
    tenantId,
    masterId,
    detalhes: { equipeId },
  });
}

export async function listEquipeMedicosService(tenantId: string, equipeId: string) {
  const equipe = await prisma.equipe.findFirst({ where: { id: equipeId, tenantId } });
  if (!equipe) throw { statusCode: 404, message: 'Equipe não encontrada' };
  return prisma.equipeMedico.findMany({
    where: { tenantId, equipeId },
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

export async function addMedicoToEquipeService(
  tenantId: string,
  masterId: string,
  equipeId: string,
  medicoId: string
) {
  const [equipe, medico] = await Promise.all([
    prisma.equipe.findFirst({ where: { id: equipeId, tenantId, ativo: true } }),
    prisma.medico.findFirst({ where: { id: medicoId, tenantId, ativo: true } }),
  ]);
  if (!equipe) throw { statusCode: 404, message: 'Equipe não encontrada ou inativa' };
  if (!medico) throw { statusCode: 404, message: 'Médico não encontrado ou inativo' };

  const existingEq = await prisma.equipeMedico.findUnique({
    where: { tenantId_equipeId_medicoId: { tenantId, equipeId, medicoId } },
  });
  if (existingEq) {
    return existingEq;
  }
  const row = await prisma.equipeMedico.create({
    data: { tenantId, equipeId, medicoId },
  });
  const { notificarMedicoVinculoEquipe } = await import('./notificacao-medico.service');
  await notificarMedicoVinculoEquipe(tenantId, medicoId, equipe.nome, equipeId);
  await createAuditLog({
    acao: 'ADICIONAR_MEDICO_EQUIPE',
    tenantId,
    masterId,
    medicoId,
    detalhes: { equipeId, equipeMedicoId: row.id },
  });
  clearPontoCaches(tenantId, medicoId);
  return row;
}

export async function removeMedicoFromEquipeService(
  tenantId: string,
  masterId: string,
  equipeId: string,
  medicoId: string
) {
  const row = await prisma.equipeMedico.findFirst({ where: { tenantId, equipeId, medicoId } });
  if (!row) throw { statusCode: 404, message: 'Vínculo não encontrado' };
  await prisma.equipeMedico.delete({ where: { id: row.id } });
  await createAuditLog({
    acao: 'REMOVER_MEDICO_EQUIPE',
    tenantId,
    masterId,
    medicoId,
    detalhes: { equipeId },
  });
  clearPontoCaches(tenantId, medicoId);
}

export async function listEscalaSubgruposService(tenantId: string, escalaId: string) {
  const escala = await prisma.escala.findFirst({ where: { id: escalaId, tenantId } });
  if (!escala) throw { statusCode: 404, message: 'Escala não encontrada' };
  return prisma.escalaSubgrupo.findMany({
    where: { tenantId, escalaId },
    include: { subgrupo: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addSubgrupoToEscalaService(
  tenantId: string,
  masterId: string,
  escalaId: string,
  subgrupoId: string
) {
  const [escala, subgrupo] = await Promise.all([
    prisma.escala.findFirst({ where: { id: escalaId, tenantId } }),
    prisma.subgrupo.findFirst({ where: { id: subgrupoId, tenantId, ativo: true } }),
  ]);
  if (!escala) throw { statusCode: 404, message: 'Escala não encontrada' };
  if (!subgrupo) throw { statusCode: 404, message: 'Subgrupo não encontrado ou inativo' };

  const row = await prisma.escalaSubgrupo.upsert({
    where: { tenantId_escalaId_subgrupoId: { tenantId, escalaId, subgrupoId } },
    update: {},
    create: { tenantId, escalaId, subgrupoId },
  });
  await createAuditLog({
    acao: 'VINCULAR_SUBGRUPO_ESCALA',
    tenantId,
    masterId,
    detalhes: { escalaId, subgrupoId, escalaSubgrupoId: row.id },
  });
  return row;
}

export async function removeSubgrupoFromEscalaService(
  tenantId: string,
  masterId: string,
  escalaId: string,
  subgrupoId: string
) {
  const row = await prisma.escalaSubgrupo.findFirst({ where: { tenantId, escalaId, subgrupoId } });
  if (!row) throw { statusCode: 404, message: 'Vínculo subgrupo-escala não encontrado' };
  await prisma.escalaSubgrupo.delete({ where: { id: row.id } });
  await createAuditLog({
    acao: 'REMOVER_SUBGRUPO_ESCALA',
    tenantId,
    masterId,
    detalhes: { escalaId, subgrupoId },
  });
}

export async function listEscalaEquipesService(tenantId: string, escalaId: string) {
  const escala = await prisma.escala.findFirst({ where: { id: escalaId, tenantId } });
  if (!escala) throw { statusCode: 404, message: 'Escala não encontrada' };
  return prisma.escalaEquipe.findMany({
    where: { tenantId, escalaId },
    include: { equipe: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addEquipeToEscalaService(
  tenantId: string,
  masterId: string,
  escalaId: string,
  equipeId: string
) {
  const [escala, equipe] = await Promise.all([
    prisma.escala.findFirst({ where: { id: escalaId, tenantId } }),
    prisma.equipe.findFirst({ where: { id: equipeId, tenantId, ativo: true } }),
  ]);
  if (!escala) throw { statusCode: 404, message: 'Escala não encontrada' };
  if (!equipe) throw { statusCode: 404, message: 'Equipe não encontrada ou inativa' };
  const existingV = await prisma.escalaEquipe.findUnique({
    where: { tenantId_escalaId_equipeId: { tenantId, escalaId, equipeId } },
  });
  if (existingV) {
    return existingV;
  }
  const row = await prisma.escalaEquipe.create({
    data: { tenantId, escalaId, equipeId },
  });
  const { notificarMedicosEquipeNaEscala } = await import('./notificacao-medico.service');
  await notificarMedicosEquipeNaEscala(tenantId, escalaId, escala.nome, equipeId, equipe.nome);
  await createAuditLog({
    acao: 'VINCULAR_EQUIPE_ESCALA',
    tenantId,
    masterId,
    detalhes: { escalaId, equipeId, escalaEquipeId: row.id },
  });
  return row;
}

export async function removeEquipeFromEscalaService(
  tenantId: string,
  masterId: string,
  escalaId: string,
  equipeId: string
) {
  const row = await prisma.escalaEquipe.findFirst({ where: { tenantId, escalaId, equipeId } });
  if (!row) throw { statusCode: 404, message: 'Vínculo equipe-escala não encontrado' };
  await prisma.escalaEquipe.delete({ where: { id: row.id } });
  await createAuditLog({
    acao: 'REMOVER_EQUIPE_ESCALA',
    tenantId,
    masterId,
    detalhes: { escalaId, equipeId },
  });
}
