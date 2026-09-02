import { ModuloSistema, NivelAcessoModulo, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import {
  CORE_MASTER_SEMPRE_ATIVOS,
  MODULOS_DEFAULT_POR_PERFIL,
  MODULOS_SISTEMA,
} from '../constants/modulos.const';
import { createAuditLog } from './auditoria.service';

export interface AcessoModuloItem {
  perfil: UserRole;
  modulo: ModuloSistema;
  permitido: boolean;
}

export interface NiveisModuloUsuario {
  isAdminPleno: boolean;
  map: Record<ModuloSistema, NivelAcessoModulo>;
}

const mapOffTodos = (): Record<ModuloSistema, NivelAcessoModulo> =>
  Object.fromEntries(MODULOS_SISTEMA.map((m) => [m, NivelAcessoModulo.OFF])) as Record<
    ModuloSistema,
    NivelAcessoModulo
  >;

const mapEditarTodos = (): Record<ModuloSistema, NivelAcessoModulo> =>
  Object.fromEntries(MODULOS_SISTEMA.map((m) => [m, NivelAcessoModulo.EDITAR])) as Record<
    ModuloSistema,
    NivelAcessoModulo
  >;

const nivelRank = (nivel: NivelAcessoModulo): number => {
  if (nivel === NivelAcessoModulo.EDITAR) return 2;
  if (nivel === NivelAcessoModulo.VER) return 1;
  return 0;
};

const maxNivel = (a: NivelAcessoModulo, b: NivelAcessoModulo): NivelAcessoModulo =>
  nivelRank(a) >= nivelRank(b) ? a : b;

export const getAcessosModuloPerfilService = async (tenantId: string, perfil: UserRole) => {
  const rows = await prisma.acessoModuloPerfil.findMany({
    where: { tenantId, perfil },
    select: { modulo: true, permitido: true },
  });

  const base = { ...MODULOS_DEFAULT_POR_PERFIL[perfil] };
  for (const row of rows) {
    base[row.modulo] = row.permitido;
  }

  if (perfil === UserRole.MASTER) {
    CORE_MASTER_SEMPRE_ATIVOS.forEach((modulo) => {
      base[modulo] = true;
    });
  }

  return MODULOS_SISTEMA.map((modulo) => ({
    perfil,
    modulo,
    permitido: base[modulo],
  }));
};

export const getMatrizAcessosModulosService = async (tenantId: string) => {
  const [master, medico] = await Promise.all([
    getAcessosModuloPerfilService(tenantId, UserRole.MASTER),
    getAcessosModuloPerfilService(tenantId, UserRole.MEDICO),
  ]);
  return { master, medico };
};

export const salvarMatrizAcessosModulosService = async (
  tenantId: string,
  masterId: string,
  items: AcessoModuloItem[]
) => {
  for (const item of items) {
    const permitidoFinal =
      item.perfil === UserRole.MASTER && CORE_MASTER_SEMPRE_ATIVOS.has(item.modulo)
        ? true
        : item.permitido;

    await prisma.acessoModuloPerfil.upsert({
      where: {
        tenantId_perfil_modulo: {
          tenantId,
          perfil: item.perfil,
          modulo: item.modulo,
        },
      },
      update: {
        permitido: permitidoFinal,
      },
      create: {
        tenantId,
        perfil: item.perfil,
        modulo: item.modulo,
        permitido: permitidoFinal,
      },
    });
  }

  await createAuditLog({
    acao: 'ATUALIZAR_ACESSO_MODULOS_PERFIL',
    tenantId,
    masterId,
    detalhes: {
      totalItens: items.length,
    },
  });

  return getMatrizAcessosModulosService(tenantId);
};

export const getNiveisModuloUsuarioService = async (
  tenantId: string,
  userId: string,
  role: UserRole
): Promise<NiveisModuloUsuario> => {
  if (role === UserRole.MEDICO) {
    const items = await getAcessosModuloPerfilService(tenantId, UserRole.MEDICO);
    const map = mapOffTodos();
    for (const item of items) {
      map[item.modulo] = item.permitido ? NivelAcessoModulo.VER : NivelAcessoModulo.OFF;
    }
    return { isAdminPleno: false, map };
  }

  const master = await prisma.usuarioMaster.findFirst({
    where: { id: userId, tenantId },
    select: {
      id: true,
      ativo: true,
      perfilAcessoId: true,
      perfilAcesso: {
        select: {
          id: true,
          tenantId: true,
          ativo: true,
          modulos: { select: { modulo: true, nivel: true } },
        },
      },
    },
  });

  if (!master || !master.ativo) {
    return { isAdminPleno: false, map: mapOffTodos() };
  }

  if (master.perfilAcessoId == null) {
    return { isAdminPleno: true, map: mapEditarTodos() };
  }

  const perfil = master.perfilAcesso;
  if (!perfil || !perfil.ativo || perfil.tenantId !== tenantId) {
    return { isAdminPleno: false, map: mapOffTodos() };
  }

  const map = mapOffTodos();
  for (const row of perfil.modulos) {
    map[row.modulo] = row.nivel;
  }

  // Defesa em profundidade: staff nunca edita CONFIGURACOES
  if (map[ModuloSistema.CONFIGURACOES] === NivelAcessoModulo.EDITAR) {
    map[ModuloSistema.CONFIGURACOES] = NivelAcessoModulo.VER;
  }

  // Todo perfil staff garante ao menos VER em PERFIL (Minha Conta)
  map[ModuloSistema.PERFIL] = maxNivel(map[ModuloSistema.PERFIL], NivelAcessoModulo.VER);

  return { isAdminPleno: false, map };
};

export const getMinhaPermissaoModulosService = async (
  tenantId: string,
  perfil: UserRole,
  userId?: string
) => {
  if (userId) {
    const { isAdminPleno, map: mapNiveis } = await getNiveisModuloUsuarioService(
      tenantId,
      userId,
      perfil
    );
    const map = Object.fromEntries(
      MODULOS_SISTEMA.map((m) => [m, mapNiveis[m] !== NivelAcessoModulo.OFF])
    ) as Record<ModuloSistema, boolean>;
    return { isAdminPleno, mapNiveis, map, perfil };
  }

  const items = await getAcessosModuloPerfilService(tenantId, perfil);
  return {
    perfil,
    items,
    map: Object.fromEntries(items.map((i) => [i.modulo, i.permitido])) as Record<ModuloSistema, boolean>,
  };
};

export const possuiAcessoModuloService = async (
  tenantId: string,
  perfil: UserRole,
  modulo: ModuloSistema
) => {
  const permissao = await getMinhaPermissaoModulosService(tenantId, perfil);
  return permissao.map[modulo] ?? false;
};

export const possuiAcessoModuloUsuarioService = async (
  tenantId: string,
  userId: string,
  role: UserRole,
  modulo: ModuloSistema
) => {
  const { map } = await getNiveisModuloUsuarioService(tenantId, userId, role);
  const nivel = map[modulo] ?? NivelAcessoModulo.OFF;
  return nivel === NivelAcessoModulo.VER || nivel === NivelAcessoModulo.EDITAR;
};

export const possuiEscritaModuloUsuarioService = async (
  tenantId: string,
  userId: string,
  role: UserRole,
  modulo: ModuloSistema
) => {
  const { map } = await getNiveisModuloUsuarioService(tenantId, userId, role);
  return (map[modulo] ?? NivelAcessoModulo.OFF) === NivelAcessoModulo.EDITAR;
};
