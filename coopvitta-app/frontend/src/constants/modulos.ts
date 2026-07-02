export type ModuloSistema =
  | 'DASHBOARD'
  | 'MEDICOS'
  | 'CONTRATOS_ATIVOS'
  | 'ESCALAS'
  | 'VALORES_PLANTAO'
  | 'RELATORIOS'
  | 'PONTO_ELETRONICO'
  | 'ATENDIMENTOS'
  | 'VAGAS'
  | 'CONFIGURACOES'
  | 'ENVIO_DOCUMENTOS'
  | 'AVALIACAO'
  | 'PERFIL';

export const MODULO_LABEL: Record<ModuloSistema, string> = {
  DASHBOARD: 'Dashboard',
  MEDICOS: 'Médicos',
  CONTRATOS_ATIVOS: 'Contratos Ativos',
  ESCALAS: 'Escalas',
  VALORES_PLANTAO: 'Valores Hora/Plantão',
  RELATORIOS: 'Relatórios',
  PONTO_ELETRONICO: 'Ponto Eletrônico',
  ATENDIMENTOS: 'Atendimentos',
  VAGAS: 'Vagas',
  CONFIGURACOES: 'Configurações',
  ENVIO_DOCUMENTOS: 'Envio de Documentos',
  AVALIACAO: 'Avaliação',
  PERFIL: 'Minha Conta',
};
