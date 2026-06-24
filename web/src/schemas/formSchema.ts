import { z } from 'zod'
import { isValidCpf, isValidEmail } from '../utils/validation'
import { onlyDigits } from '../utils/masks'

const requiredString = (label: string) =>
  z.string().trim().min(1, `${label} é obrigatório`)

const cpfField = z
  .string()
  .trim()
  .min(1, 'CPF é obrigatório')
  .refine((v) => isValidCpf(v), 'CPF inválido')

const emailField = z
  .string()
  .trim()
  .min(1, 'E-mail é obrigatório')
  .refine((v) => isValidEmail(v), 'E-mail inválido')

const fileField = z
  .custom<FileList | File | null | undefined>()
  .refine((v) => {
    if (!v) return false
    if (v instanceof FileList) return v.length > 0
    return v instanceof File
  }, 'Envie o documento solicitado')

export const step1Schema = z.object({
  nomeCompleto: requiredString('Nome completo'),
  email: emailField,
  cpf: cpfField,
  pis: requiredString('PIS'),
  dataNascimento: requiredString('Data de nascimento'),
  sexo: requiredString('Sexo'),
  estadoCivil: requiredString('Estado civil'),
  regimeComunhao: z.string().optional(),
  tipoSanguineo: requiredString('Tipo sanguíneo'),
  grauInstrucao: requiredString('Grau de instrução'),
  nacionalidade: requiredString('Nacionalidade'),
  estadoNaturalidade: requiredString('Estado da naturalidade'),
  cidadeNaturalidade: requiredString('Cidade da naturalidade'),
  nomePai: requiredString('Nome do pai'),
  nomeMae: requiredString('Nome da mãe'),
}).superRefine((data, ctx) => {
  if (data.estadoCivil === 'casado' && !data.regimeComunhao?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Regime de comunhão é obrigatório para casados',
      path: ['regimeComunhao'],
    })
  }
})

export const step2Schema = z.object({
  rg: requiredString('RG'),
  rgDataExpedicao: requiredString('Data de expedição do RG'),
  rgOrgaoExpedicao: requiredString('Órgão de expedição'),
  rgUfOrgao: requiredString('UF do órgão'),
  tituloEleitor: requiredString('Título de eleitor'),
})

export const step3Schema = z.object({
  cep: requiredString('CEP').refine(
    (v) => onlyDigits(v).length === 8,
    'CEP inválido',
  ),
  rua: requiredString('Rua'),
  numero: requiredString('Número'),
  bairro: requiredString('Bairro'),
  estado: requiredString('Estado'),
  cidade: requiredString('Cidade'),
  complemento: z.string().optional(),
  dddResidencial: z.string().optional(),
  telefoneResidencial: z.string().optional(),
  dddCelular: requiredString('DDD celular'),
  telefoneCelular: requiredString('Telefone celular'),
  pix: requiredString('Chave PIX'),
})

export const step4Schema = z.object({
  conselhoClasse: requiredString('Conselho de classe'),
  numeroConselho: requiredString('Número no conselho'),
  categoriaProfissional: requiredString('Categoria profissional'),
  categoriaProfissionalDetalhe: requiredString('Qual a categoria profissional'),
  especialidadeProfissional: requiredString('Especialidade profissional'),
})

export const step5Schema = z.object({
  banco: requiredString('Banco'),
  agencia: requiredString('Agência'),
  conta: requiredString('Conta'),
  digitoConta: requiredString('Dígito da conta'),
})

export const step6Schema = z.object({
  certidaoNegativaConselho: fileField,
  carteiraConselho: fileField,
  declaracaoInss: fileField,
  foto3x4: fileField,
  comprovanteResidencia: fileField,
  rgCnh: fileField,
  pisNitPasep: fileField,
  cpfDocumento: fileField,
  cartaoBancario: fileField,
  curriculumVitae: fileField,
  cartaoVacina: fileField,
  certificadoCurso: fileField,
  aph: fileField,
})

export const step7Schema = z.object({
  termoConsentimento: z
    .boolean()
    .refine((v) => v === true, 'Você precisa aceitar o termo de consentimento'),
})

export const stepSchemas = [
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  step7Schema,
] as const

export type Step1Data = z.infer<typeof step1Schema>
export type Step2Data = z.infer<typeof step2Schema>
export type Step3Data = z.infer<typeof step3Schema>
export type Step4Data = z.infer<typeof step4Schema>
export type Step5Data = z.infer<typeof step5Schema>
export type Step6Data = z.infer<typeof step6Schema>
export type Step7Data = z.infer<typeof step7Schema>

export type FormData = Step1Data &
  Step2Data &
  Step3Data &
  Step4Data &
  Step5Data &
  Step6Data &
  Step7Data

export const defaultFormValues: FormData = {
  nomeCompleto: '',
  email: '',
  cpf: '',
  pis: '',
  dataNascimento: '',
  sexo: '',
  estadoCivil: '',
  regimeComunhao: '',
  tipoSanguineo: '',
  grauInstrucao: '',
  nacionalidade: 'Brasileira',
  estadoNaturalidade: '',
  cidadeNaturalidade: '',
  nomePai: '',
  nomeMae: '',
  rg: '',
  rgDataExpedicao: '',
  rgOrgaoExpedicao: '',
  rgUfOrgao: '',
  tituloEleitor: '',
  cep: '',
  rua: '',
  numero: '',
  bairro: '',
  estado: '',
  cidade: '',
  complemento: '',
  dddResidencial: '',
  telefoneResidencial: '',
  dddCelular: '',
  telefoneCelular: '',
  pix: '',
  conselhoClasse: '',
  numeroConselho: '',
  categoriaProfissional: '',
  categoriaProfissionalDetalhe: '',
  especialidadeProfissional: '',
  banco: '',
  agencia: '',
  conta: '',
  digitoConta: '',
  certidaoNegativaConselho: undefined,
  carteiraConselho: undefined,
  declaracaoInss: undefined,
  foto3x4: undefined,
  comprovanteResidencia: undefined,
  rgCnh: undefined,
  pisNitPasep: undefined,
  cpfDocumento: undefined,
  cartaoBancario: undefined,
  curriculumVitae: undefined,
  cartaoVacina: undefined,
  certificadoCurso: undefined,
  aph: undefined,
  termoConsentimento: false,
}

export const STEPS = [
  {
    id: 'pessoal',
    title: 'Identificação',
    subtitle: 'Dados pessoais do proponente',
    icon: 'user',
  },
  {
    id: 'documentos',
    title: 'Documentos',
    subtitle: 'RG, título de eleitor e registros',
    icon: 'id-card',
  },
  {
    id: 'endereco',
    title: 'Endereço',
    subtitle: 'Localização e contatos',
    icon: 'map-pin',
  },
  {
    id: 'profissional',
    title: 'Profissional',
    subtitle: 'Conselho e especialidade',
    icon: 'briefcase',
  },
  {
    id: 'bancario',
    title: 'Bancário',
    subtitle: 'Dados para pagamento',
    icon: 'landmark',
  },
  {
    id: 'anexos',
    title: 'Anexos',
    subtitle: 'Documentos comprobatórios',
    icon: 'paperclip',
  },
  {
    id: 'consentimento',
    title: 'Consentimento',
    subtitle: 'Termo LGPD e envio',
    icon: 'shield',
  },
] as const
