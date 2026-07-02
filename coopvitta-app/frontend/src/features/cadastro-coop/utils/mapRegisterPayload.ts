import type { DocumentoPerfilField } from '../../../constants/documentosPerfil';
import type { RegisterDocumentFiles, RegisterPayload } from '../../../services/auth.service';
import { FILE_FIELDS } from '../data/fieldLabels';
import type { FormData } from '../schemas/formSchema';

const CATEGORIA_PROFISSAO: Record<string, string> = {
  medicina: 'Médico',
  enfermagem: 'Enfermeiro',
  fisioterapia: 'Fisioterapeuta',
  nutricao: 'Nutricionista',
  farmacia: 'Farmacêutico',
  psicologia: 'Psicólogo',
  fonoaudiologia: 'Fonoaudiólogo',
  'tecnico-enfermagem': 'Técnico em Enfermagem',
};

const ESTADO_CIVIL_MAP: Record<string, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
  'uniao-estavel': 'União estável',
};

const BANCO_LABEL: Record<string, string> = {
  '001': '001 — Banco do Brasil',
  '033': '033 — Santander',
  '104': '104 — Caixa Econômica',
  '237': '237 — Bradesco',
  '341': '341 — Itáú',
  '260': '260 — Nubank',
  '077': '077 — Inter',
};

/** Campos de arquivo do formulário COOPVITTA → campos do AppVS. */
export const FILE_FIELD_MAP: Record<string, DocumentoPerfilField> = {
  certidaoNegativaConselho: 'certidaoRegularidadeFiscalCrm',
  carteiraConselho: 'cedulaIdentidadeCrm',
  comprovanteResidencia: 'comprovanteEnderecoResidencia',
  rgCnh: 'rgCpfOuCnh',
  declaracaoInss: 'declaracaoRegularidadeContribuinteIndividual',
  certificadoCurso: 'diploma',
  cartaoBancario: 'dadosBancariosPfPix',
};

function mapProfissao(categoria: string, detalhe: string): string {
  const key = (categoria || '').trim();
  if (CATEGORIA_PROFISSAO[key]) return CATEGORIA_PROFISSAO[key];
  const extra = (detalhe || '').trim();
  if (extra.length >= 3) return extra.slice(0, 80);
  return 'Profissional da saúde';
}

function mapEstadoCivil(value: string): string {
  const key = (value || '').trim();
  return ESTADO_CIVIL_MAP[key] || key;
}

function formatCep(cep: string): string {
  const d = String(cep || '').replace(/\D/g, '');
  if (d.length !== 8) return cep || '';
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function montarEnderecoResidencial(dados: FormData): string {
  const cepFmt = formatCep(dados.cep);
  const linhas = [
    `CEP: ${cepFmt}`,
    `Logradouro: ${String(dados.rua || '').trim()}`,
    `Número: ${String(dados.numero || '').trim()}`,
    dados.complemento?.trim() ? `Complemento: ${dados.complemento.trim()}` : null,
    `Bairro: ${String(dados.bairro || '').trim()}`,
    `Cidade/UF: ${String(dados.cidade || '').trim()} / ${String(dados.estado || '').trim().toUpperCase()}`,
  ].filter(Boolean);
  return linhas.join('\n');
}

function montarDadosBancarios(dados: FormData): string {
  const banco = BANCO_LABEL[dados.banco] || dados.banco || '';
  const conta = [dados.conta, dados.digitoConta].filter(Boolean).join('-');
  return [
    `Conta: ${String(conta).trim()}`,
    `Agência: ${String(dados.agencia || '').trim()}`,
    `Banco: ${String(banco).trim()}`,
  ].join('\n');
}

function montarTelefone(dados: FormData): string {
  const ddd = String(dados.dddCelular || '').replace(/\D/g, '');
  const tel = String(dados.telefoneCelular || '').replace(/\D/g, '');
  if (!ddd || !tel) return '';
  return `(${ddd}) ${tel}`;
}

function resolveRegistroConselho(dados: FormData, profissao: string): string | undefined {
  const raw = String(dados.numeroConselho || '').trim();
  if (!raw) return undefined;

  if (profissao === 'Médico' || profissao === 'Cirurgião-Dentista') {
    const compact = raw.toUpperCase().replace(/\s+/g, '').replace(/^CRM:?/, '');
    if (/^\d{4,6}[-/]?[A-Z]{2}$/.test(compact)) {
      return compact.replace('/', '-');
    }
    const num = raw.replace(/\D/g, '');
    const uf = String(dados.estado || dados.estadoNaturalidade || 'CE')
      .trim()
      .toUpperCase()
      .slice(0, 2);
    if (num.length >= 4) return `${num}-${uf}`;
  }

  return raw;
}

export function mapCadastroToRegisterPayload(dados: FormData): RegisterPayload {
  const profissao = mapProfissao(dados.categoriaProfissional, dados.categoriaProfissionalDetalhe);
  const payload: RegisterPayload = {
    nomeCompleto: String(dados.nomeCompleto || '').trim(),
    email: String(dados.email || '').trim().toLowerCase(),
    cpf: String(dados.cpf || '').trim(),
    password: String(dados.password || ''),
    confirmPassword: String(dados.confirmPassword || ''),
    profissao,
    telefone: montarTelefone(dados),
    estadoCivil: mapEstadoCivil(dados.estadoCivil),
    enderecoResidencial: montarEnderecoResidencial(dados),
    dadosBancarios: montarDadosBancarios(dados),
    chavePix: String(dados.pix || '').trim(),
    aceitouTermos: dados.termoConsentimento === true,
  };

  const crm = resolveRegistroConselho(dados, profissao);
  if (crm) payload.crm = crm;

  const especialidade = String(dados.especialidadeProfissional || '').trim();
  if (especialidade) {
    payload.especialidades = [especialidade];
  }

  return payload;
}

function getFile(value: FormData[keyof FormData]): File | null {
  if (!value) return null;
  if (value instanceof FileList) return value[0] ?? null;
  if (value instanceof File) return value;
  return null;
}

export function mapCadastroFiles(values: FormData): RegisterDocumentFiles {
  const files: RegisterDocumentFiles = {};

  for (const field of FILE_FIELDS) {
    const mapped = FILE_FIELD_MAP[field];
    if (!mapped) continue;
    const file = getFile(values[field as keyof FormData]);
    if (file) files[mapped] = file;
  }

  return files;
}
