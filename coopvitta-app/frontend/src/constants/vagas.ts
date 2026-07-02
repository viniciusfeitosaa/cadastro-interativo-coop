/** Tipos de atendimento sugeridos (livre + lista). */
export const TIPOS_ATENDIMENTO_SUGESTOES = [
  'Auditoria',
  'CAPS',
  'Centro Cirúrgico',
  'Pronto-socorro',
  'Ambulatório',
  'UTI',
  'Internação',
  'SAMU',
  'Outro',
] as const;

export const CATEGORIAS_PROFISSIONAL = [{ value: 'MEDICO', label: 'Médico' }] as const;

export const PAGAMENTO_VAGA = {
  A_VISTA: 'A_VISTA',
  COMBINAR: 'COMBINAR',
} as const;

export const PAGAMENTO_LABEL: Record<string, string> = {
  A_VISTA: 'À vista',
  COMBINAR: 'A combinar',
};

export const STATUS_INTERESSE_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  ACEITO: 'Aceito',
  RECUSADO: 'Recusado',
};
