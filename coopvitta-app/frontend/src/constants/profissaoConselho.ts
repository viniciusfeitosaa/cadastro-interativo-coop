/** Alinhado ao backend: `profissao-registro.util.ts` */
export const PROFISSOES_SEM_REGISTRO_OBRIGATORIO = new Set<string>(['Instrumentador Cirúrgico', 'Perfusionista']);

export function profissaoExigeRegistroConselho(profissao: string): boolean {
  const p = (profissao || '').trim();
  if (!p) return false;
  return !PROFISSOES_SEM_REGISTRO_OBRIGATORIO.has(p);
}

/** Sigla ou rótulo curto do campo de registro (CRM, COREN, CRP, etc.) */
const REGISTRO_LABEL: Record<string, string> = {
  Médico: 'CRM',
  Acupunturista: 'Registro profissional',
  'Assistente Social': 'CRESS',
  'Auxiliar de Enfermagem': 'COREN',
  Biomédico: 'CRBM',
  'Cirurgião-Dentista': 'CRO',
  'Educador Físico': 'CREF',
  Enfermeiro: 'COREN',
  'Enfermeiro Obstétrico': 'COREN',
  Farmacêutico: 'CRF',
  Fisioterapeuta: 'CREFITO',
  Fonoaudiólogo: 'CREFONO',
  Musicoterapeuta: 'Registro profissional',
  Nutricionista: 'CRN',
  Optometrista: 'Registro profissional',
  Ortoptista: 'Registro profissional',
  Podólogo: 'Registro profissional',
  Psicólogo: 'CRP',
  Quiropraxista: 'CREFITO',
  Sanitarista: 'CRN',
  'Técnico de Laboratório': 'CRBM',
  'Técnico em Enfermagem': 'COREN',
  'Técnico em Farmácia': 'CRF',
  'Técnico em Nutrição e Dietética': 'CRN',
  'Técnico em Radiologia': 'CRTR',
  'Técnico em Saúde Bucal': 'Registro CFO',
  'Técnico em Ótica': 'Registro profissional',
  'Terapeuta Ocupacional': 'CREFITO',
};

export function labelRegistroConselho(profissao: string): string {
  return REGISTRO_LABEL[(profissao || '').trim()] ?? 'Registro no conselho';
}

export function placeholderRegistroConselho(profissao: string): string {
  const p = (profissao || '').trim();
  if (p === 'Médico') return 'Ex.: 12345-CE';
  if (p === 'Cirurgião-Dentista') return 'Ex.: número do CRO e UF';
  return 'Número conforme seu conselho regional';
}
