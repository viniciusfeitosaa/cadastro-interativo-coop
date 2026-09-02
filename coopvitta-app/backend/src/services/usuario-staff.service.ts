import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { hashPassword } from '../utils/password.util';
import { createAuditLog } from './auditoria.service';

export type CreateUsuarioStaffInput = {
  nome: string;
  email: string;
  senha: string;
  perfilAcessoId: string;
  ativo?: boolean;
};

export type UpdateUsuarioStaffInput = {
  nome?: string;
  perfilAcessoId?: string | null;
  ativo?: boolean;
  senha?: string;
};

const staffSelect = {
  id: true,
  nome: true,
  email: true,
  ativo: true,
  perfilAcessoId: true,
  createdAt: true,
  updatedAt: true,
  perfilAcesso: { select: { id: true, nome: true, ativo: true } },
} as const;

const countAdminPlenosAtivos = (tenantId: string) =>
  prisma.usuarioMaster.count({
    where: {
      tenantId,
      role: UserRole.MASTER,
      ativo: true,
      perfilAcessoId: null,
    },
  });

export async function listUsuariosStaffService(tenantId: string) {
  return prisma.usuarioMaster.findMany({
    where: { tenantId, role: UserRole.MASTER },
    select: staffSelect,
    orderBy: { nome: 'asc' },
  });
}

export async function createUsuarioStaffService(
  tenantId: string,
  masterId: string,
  input: CreateUsuarioStaffInput
) {
  const nome = input.nome?.trim();
  if (!nome) throw { statusCode: 400, message: 'Nome é obrigatório' };

  const email = input.email?.trim().toLowerCase();
  if (!email) throw { statusCode: 400, message: 'E-mail é obrigatório' };

  const senha = input.senha?.trim();
  if (!senha) throw { statusCode: 400, message: 'Senha é obrigatória' };

  const perfilAcessoId = input.perfilAcessoId?.trim();
  if (!perfilAcessoId) {
    throw { statusCode: 400, message: 'perfilAcessoId é obrigatório para criar usuário staff' };
  }

  const perfil = await prisma.perfilAcesso.findFirst({
    where: { id: perfilAcessoId, tenantId },
    select: { id: true, ativo: true, nome: true },
  });
  if (!perfil) {
    throw { statusCode: 400, message: 'Perfil de acesso não encontrado neste tenant' };
  }

  const existente = await prisma.usuarioMaster.findFirst({
    where: { tenantId, email },
    select: { id: true },
  });
  if (existente) {
    throw { statusCode: 409, message: 'Já existe um usuário com este e-mail neste tenant' };
  }

  const senhaHash = await hashPassword(senha);

  try {
    const created = await prisma.usuarioMaster.create({
      data: {
        tenantId,
        nome,
        email,
        senhaHash,
        role: UserRole.MASTER,
        ativo: input.ativo ?? true,
        perfilAcessoId,
      },
      select: staffSelect,
    });

    await createAuditLog({
      acao: 'CRIAR_USUARIO_STAFF',
      tenantId,
      masterId,
      detalhes: {
        usuarioId: created.id,
        email: created.email,
        perfilAcessoId,
      },
    });

    return created;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw { statusCode: 409, message: 'Já existe um usuário com este e-mail neste tenant' };
    }
    throw e;
  }
}

export async function updateUsuarioStaffService(
  tenantId: string,
  masterId: string,
  id: string,
  input: UpdateUsuarioStaffInput
) {
  const found = await prisma.usuarioMaster.findFirst({
    where: { id, tenantId, role: UserRole.MASTER },
    select: {
      id: true,
      nome: true,
      email: true,
      ativo: true,
      perfilAcessoId: true,
    },
  });
  if (!found) {
    throw { statusCode: 404, message: 'Usuário não encontrado' };
  }

  const nextNome =
    input.nome !== undefined ? (input.nome?.trim() || '') : undefined;
  if (nextNome !== undefined && !nextNome) {
    throw { statusCode: 400, message: 'Nome é obrigatório' };
  }

  let nextPerfilAcessoId: string | null | undefined = undefined;
  if (input.perfilAcessoId !== undefined) {
    if (input.perfilAcessoId === null) {
      nextPerfilAcessoId = null;
    } else {
      const perfilId = String(input.perfilAcessoId).trim();
      if (!perfilId) {
        throw { statusCode: 400, message: 'perfilAcessoId inválido' };
      }
      const perfil = await prisma.perfilAcesso.findFirst({
        where: { id: perfilId, tenantId },
        select: { id: true },
      });
      if (!perfil) {
        throw { statusCode: 400, message: 'Perfil de acesso não encontrado neste tenant' };
      }
      nextPerfilAcessoId = perfilId;
    }
  }

  const nextAtivo = input.ativo;

  const isCurrentlyPleno = found.perfilAcessoId == null && found.ativo;
  const willDemote =
    isCurrentlyPleno && nextPerfilAcessoId !== undefined && nextPerfilAcessoId !== null;
  const willDeactivatePleno = isCurrentlyPleno && nextAtivo === false;

  if (willDemote || willDeactivatePleno) {
    const plenos = await countAdminPlenosAtivos(tenantId);
    if (plenos <= 1) {
      throw {
        statusCode: 400,
        message: 'Não é permitido demotar ou desativar o último administrador pleno do tenant',
      };
    }
  }

  const willPromote =
    found.perfilAcessoId != null &&
    nextPerfilAcessoId !== undefined &&
    nextPerfilAcessoId === null;

  let senhaHash: string | undefined;
  if (input.senha !== undefined) {
    const senha = input.senha?.trim();
    if (!senha) throw { statusCode: 400, message: 'Senha inválida' };
    senhaHash = await hashPassword(senha);
  }

  const updated = await prisma.usuarioMaster.update({
    where: { id },
    data: {
      ...(nextNome !== undefined ? { nome: nextNome } : {}),
      ...(nextPerfilAcessoId !== undefined ? { perfilAcessoId: nextPerfilAcessoId } : {}),
      ...(nextAtivo !== undefined ? { ativo: nextAtivo } : {}),
      ...(senhaHash !== undefined ? { senhaHash } : {}),
    },
    select: staffSelect,
  });

  if (willPromote) {
    await createAuditLog({
      acao: 'PROMOVER_ADMIN_PLENO',
      tenantId,
      masterId,
      detalhes: { usuarioId: updated.id, email: updated.email },
    });
  } else {
    await createAuditLog({
      acao: 'ATUALIZAR_USUARIO_STAFF',
      tenantId,
      masterId,
      detalhes: {
        usuarioId: updated.id,
        email: updated.email,
        perfilAcessoId: updated.perfilAcessoId,
        ativo: updated.ativo,
      },
    });
  }

  return updated;
}
