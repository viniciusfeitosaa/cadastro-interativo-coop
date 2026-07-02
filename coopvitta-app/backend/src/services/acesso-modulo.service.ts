import { ModuloSistema, UserRole } from '@prisma/client';
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

export const getMinhaPermissaoModulosService = async (tenantId: string, perfil: UserRole) => {
  const items = await getAcessosModuloPerfilService(tenantId, perfil);
  return {
    perfil,
    items,
    map: Object.fromEntries(items.map((i) => [i.modulo, i.permitido])) as Record<ModuloSistema, boolean>,
  };
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

export const possuiAcessoModuloService = async (
  tenantId: string,
  perfil: UserRole,
  modulo: ModuloSistema
) => {
  const permissao = await getMinhaPermissaoModulosService(tenantId, perfil);
  return permissao.map[modulo] ?? false;
};
