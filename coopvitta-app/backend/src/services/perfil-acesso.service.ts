import { ModuloSistema, NivelAcessoModulo, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { MODULOS_SISTEMA } from '../constants/modulos.const';
import { createAuditLog } from './auditoria.service';

export type PerfilAcessoModuloInput = {
  modulo: ModuloSistema;
  nivel: NivelAcessoModulo;
};

export type CreatePerfilAcessoInput = {
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
  modulos: PerfilAcessoModuloInput[];
};

export type UpdatePerfilAcessoInput = {
  nome?: string;
  descricao?: string | null;
  ativo?: boolean;
  modulos?: PerfilAcessoModuloInput[];
};

const perfilInclude = {
  modulos: { select: { modulo: true, nivel: true } },
  _count: { select: { usuarios: true } },
} as const;

const nivelRank = (nivel: NivelAcessoModulo): number => {
  if (nivel === NivelAcessoModulo.EDITAR) return 2;
  if (nivel === NivelAcessoModulo.VER) return 1;
  return 0;
};

const maxNivel = (a: NivelAcessoModulo, b: NivelAcessoModulo): NivelAcessoModulo =>
  nivelRank(a) >= nivelRank(b) ? a : b;

/** Normaliza grade: faltantes=OFF, força PERFIL≥VER, rejeita CONFIGURACOES=EDITAR. */
export function normalizeGradeModulos(modulos: PerfilAcessoModuloInput[]): PerfilAcessoModuloInput[] {
  const map = Object.fromEntries(MODULOS_SISTEMA.map((m) => [m, NivelAcessoModulo.OFF])) as Record<
    ModuloSistema,
    NivelAcessoModulo
  >;

  for (const row of modulos ?? []) {
    if (!row?.modulo || !MODULOS_SISTEMA.includes(row.modulo)) continue;
    if (!Object.values(NivelAcessoModulo).includes(row.nivel)) {
      throw { statusCode: 400, message: `Nível inválido para módulo ${row.modulo}` };
    }
    map[row.modulo] = row.nivel;
  }

  if (map[ModuloSistema.CONFIGURACOES] === NivelAcessoModulo.EDITAR) {
    throw {
      statusCode: 400,
      message: 'Perfil customizado não pode ter CONFIGURACOES = EDITAR',
    };
  }

  map[ModuloSistema.PERFIL] = maxNivel(map[ModuloSistema.PERFIL], NivelAcessoModulo.VER);

  const hasAccess = MODULOS_SISTEMA.some(
    (m) => map[m] === NivelAcessoModulo.VER || map[m] === NivelAcessoModulo.EDITAR
  );
  if (!hasAccess) {
    throw { statusCode: 400, message: 'Informe ao menos um módulo com nível VER ou EDITAR' };
  }

  return MODULOS_SISTEMA.map((modulo) => ({ modulo, nivel: map[modulo] }));
}

export async function listPerfisAcessoService(tenantId: string) {
  return prisma.perfilAcesso.findMany({
    where: { tenantId },
    include: perfilInclude,
    orderBy: { nome: 'asc' },
  });
}

export async function getPerfilAcessoService(tenantId: string, id: string) {
  const perfil = await prisma.perfilAcesso.findFirst({
    where: { id, tenantId },
    include: perfilInclude,
  });
  if (!perfil) throw { statusCode: 404, message: 'Perfil de acesso não encontrado' };
  return perfil;
}

export async function createPerfilAcessoService(
  tenantId: string,
  masterId: string,
  input: CreatePerfilAcessoInput
) {
  const nome = input.nome?.trim();
  if (!nome) throw { statusCode: 400, message: 'Nome do perfil é obrigatório' };

  const grade = normalizeGradeModulos(input.modulos ?? []);

  const existente = await prisma.perfilAcesso.findFirst({
    where: { tenantId, nome },
    select: { id: true },
  });
  if (existente) {
    throw { statusCode: 409, message: 'Já existe um perfil com este nome neste tenant' };
  }

  try {
    const created = await prisma.perfilAcesso.create({
      data: {
        tenantId,
        nome,
        descricao: input.descricao?.trim() || null,
        ativo: input.ativo ?? true,
        modulos: {
          create: grade.map((m) => ({ modulo: m.modulo, nivel: m.nivel })),
        },
      },
      include: perfilInclude,
    });

    await createAuditLog({
      acao: 'CRIAR_PERFIL_ACESSO',
      tenantId,
      masterId,
      detalhes: { perfilAcessoId: created.id, nome: created.nome },
    });

    return created;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw { statusCode: 409, message: 'Já existe um perfil com este nome neste tenant' };
    }
    throw e;
  }
}

export async function updatePerfilAcessoService(
  tenantId: string,
  masterId: string,
  id: string,
  input: UpdatePerfilAcessoInput
) {
  const found = await prisma.perfilAcesso.findFirst({
    where: { id, tenantId },
    select: { id: true, nome: true },
  });
  if (!found) throw { statusCode: 404, message: 'Perfil de acesso não encontrado' };

  const nome =
    input.nome !== undefined ? (input.nome?.trim() || '') : undefined;
  if (nome !== undefined && !nome) {
    throw { statusCode: 400, message: 'Nome do perfil é obrigatório' };
  }

  if (nome && nome !== found.nome) {
    const conflito = await prisma.perfilAcesso.findFirst({
      where: { tenantId, nome, NOT: { id } },
      select: { id: true },
    });
    if (conflito) {
      throw { statusCode: 409, message: 'Já existe um perfil com este nome neste tenant' };
    }
  }

  const grade =
    input.modulos !== undefined ? normalizeGradeModulos(input.modulos) : undefined;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (grade) {
        await tx.perfilAcessoModulo.deleteMany({ where: { perfilAcessoId: id } });
        await tx.perfilAcessoModulo.createMany({
          data: grade.map((m) => ({
            perfilAcessoId: id,
            modulo: m.modulo,
            nivel: m.nivel,
          })),
        });
      }

      return tx.perfilAcesso.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { nome } : {}),
          ...(input.descricao !== undefined
            ? { descricao: input.descricao?.trim() || null }
            : {}),
          ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
        },
        include: perfilInclude,
      });
    });

    await createAuditLog({
      acao: 'ATUALIZAR_PERFIL_ACESSO',
      tenantId,
      masterId,
      detalhes: { perfilAcessoId: updated.id, nome: updated.nome },
    });

    return updated;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw { statusCode: 409, message: 'Já existe um perfil com este nome neste tenant' };
    }
    throw e;
  }
}
