export const sexoOptions = [
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'outro', label: 'Outro' },
  { value: 'prefiro-nao-informar', label: 'Prefiro não informar' },
]

export const estadoCivilOptions = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
  { value: 'uniao-estavel', label: 'União estável' },
]

export const regimeComunhaoOptions = [
  { value: 'comunhao-parcial', label: 'Comunhão parcial de bens' },
  { value: 'comunhao-universal', label: 'Comunhão universal de bens' },
  { value: 'separacao-total', label: 'Separação total de bens' },
  { value: 'participacao-final', label: 'Participação final nos aquestos' },
]

export const tipoSanguineoOptions = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
]

export const grauInstrucaoOptions = [
  { value: 'fundamental-incompleto', label: 'Fundamental incompleto' },
  { value: 'fundamental-completo', label: 'Fundamental completo' },
  { value: 'medio-incompleto', label: 'Médio incompleto' },
  { value: 'medio-completo', label: 'Médio completo' },
  { value: 'superior-incompleto', label: 'Superior incompleto' },
  { value: 'superior-completo', label: 'Superior completo' },
  { value: 'pos-graduacao', label: 'Pós-graduação' },
  { value: 'mestrado', label: 'Mestrado' },
  { value: 'doutorado', label: 'Doutorado' },
]

export const ufOptions = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
].map((uf) => ({ value: uf, label: uf }))

export const categoriaProfissionalOptions = [
  { value: 'enfermagem', label: 'Enfermagem' },
  { value: 'medicina', label: 'Medicina' },
  { value: 'fisioterapia', label: 'Fisioterapia' },
  { value: 'nutricao', label: 'Nutrição' },
  { value: 'farmacia', label: 'Farmácia' },
  { value: 'psicologia', label: 'Psicologia' },
  { value: 'fonoaudiologia', label: 'Fonoaudiologia' },
  { value: 'tecnico-enfermagem', label: 'Técnico em Enfermagem' },
  { value: 'outro', label: 'Outro' },
]

export const conselhoClasseOptions = [
  { value: 'coren', label: 'COREN' },
  { value: 'crm', label: 'CRM' },
  { value: 'crefito', label: 'CREFITO' },
  { value: 'crn', label: 'CRN' },
  { value: 'crf', label: 'CRF' },
  { value: 'crp', label: 'CRP' },
  { value: 'crfa', label: 'CRFa' },
  { value: 'outro', label: 'Outro' },
]

export const bancosOptions = [
  { value: '001', label: '001 — Banco do Brasil' },
  { value: '033', label: '033 — Santander' },
  { value: '104', label: '104 — Caixa Econômica' },
  { value: '237', label: '237 — Bradesco' },
  { value: '341', label: '341 — Itaú' },
  { value: '260', label: '260 — Nubank' },
  { value: '077', label: '077 — Inter' },
  { value: 'outro', label: 'Outro' },
]
