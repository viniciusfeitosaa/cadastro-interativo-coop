import { ModuloSistema, UserRole } from '@prisma/client';

export const MODULOS_SISTEMA: ModuloSistema[] = [
  ModuloSistema.DASHBOARD,
  ModuloSistema.MEDICOS,
  ModuloSistema.CONTRATOS_ATIVOS,
  ModuloSistema.ESCALAS,
  ModuloSistema.VALORES_PLANTAO,
  ModuloSistema.RELATORIOS,
  ModuloSistema.PONTO_ELETRONICO,
  ModuloSistema.ATENDIMENTOS,
  ModuloSistema.VAGAS,
  ModuloSistema.CONFIGURACOES,
  ModuloSistema.ENVIO_DOCUMENTOS,
  ModuloSistema.AVALIACAO,
  ModuloSistema.PERFIL,
];

export const CORE_MASTER_SEMPRE_ATIVOS = new Set<ModuloSistema>([
  ModuloSistema.DASHBOARD,
  ModuloSistema.CONFIGURACOES,
  ModuloSistema.PERFIL,
]);

export const MODULOS_DEFAULT_POR_PERFIL: Record<UserRole, Record<ModuloSistema, boolean>> = {
  [UserRole.MASTER]: Object.fromEntries(MODULOS_SISTEMA.map((m) => [m, true])) as Record<
    ModuloSistema,
    boolean
  >,
  [UserRole.MEDICO]: {
    [ModuloSistema.DASHBOARD]: true,
    [ModuloSistema.MEDICOS]: false,
    [ModuloSistema.CONTRATOS_ATIVOS]: false,
    [ModuloSistema.ESCALAS]: false,
    [ModuloSistema.VALORES_PLANTAO]: false,
    [ModuloSistema.CONVITES]: false,
    [ModuloSistema.RELATORIOS]: false,
    [ModuloSistema.PONTO_ELETRONICO]: true,
    [ModuloSistema.ATENDIMENTOS]: true,
    [ModuloSistema.VAGAS]: true,
    [ModuloSistema.CONFIGURACOES]: false,
    [ModuloSistema.ENVIO_DOCUMENTOS]: false,
    [ModuloSistema.AVALIACAO]: true,
    [ModuloSistema.PERFIL]: true,
  },
};
