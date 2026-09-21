import fs from 'fs';
import { DocumentoPerfilTipo } from '@prisma/client';
import type { GcoopDocumentoFlatFields, GcoopPreCadastroPayload } from '../../types/gcoop.types';
import { resolveStoredFileToAbsolute, fileExistsSafe } from '../../utils/upload-path.util';
import {
  findGcoopCidadeId,
  findGcoopItemIdByLabel,
  resolveGcoopOrgaoExpedidorId,
  findGcoopRacaCorFallbackId,
  findGcoopUfSigla,
  getGcoopCidadesCached,
  getGcoopDadosIniciaisCached,
  normalizeGcoopLabel,
  wizardValueToLabel,
} from './gcoop.domain-cache';

export type WizardGcoopJson = Record<string, unknown>;

interface MedicoDocumentoRef {
  tipo: DocumentoPerfilTipo;
  caminhoArquivo: string;
  mimeType: string | null;
}

/** Tipo perfil → CampoAPI do Gcoop (POST usa campos planos, não array Documentos). */
const GCOOP_CAMPO_API_BY_TIPO: Partial<Record<DocumentoPerfilTipo, keyof GcoopDocumentoFlatFields>> = {
  [DocumentoPerfilTipo.RG_CPF_OU_CNH]: 'CNH',
  [DocumentoPerfilTipo.COMPROVANTE_ENDERECO]: 'ComprovanteEndereco',
  [DocumentoPerfilTipo.CEDULA_IDENTIDADE_CRM]: 'CarteiraConselho',
};

/** Profissão do app → rótulo em ListaCategoria do Gcoop. */
const PROFISSAO_CATEGORIA_GCOOP: Record<string, string> = {
  Médico: 'BIOMÉDICO',
  Enfermeiro: 'ENFERMEIRO',
  Fisioterapeuta: 'FISIOTERAPEUTA',
  Nutricionista: 'NUTRICIONISTA',
  Farmacêutico: 'FARMACÊUTICO',
  Psicólogo: 'PSICÓLOGO',
  Fonoaudiólogo: 'FONOAUDIÓLOGO',
  'Técnico em Enfermagem': 'TÉCNICO DE ENFERMAGEM',
  'Cirurgião-Dentista': 'CIRURGIÃO DENTISTA',
  'Serviço Social': 'ASSISTENTE SOCIAL',
  'Assistente Social': 'ASSISTENTE SOCIAL',
  'Educador Físico': 'EDUCADOR FÍSICO',
  'Terapeuta Ocupacional': 'TERAPEUTA OCUPACIONAL',
  Biomédico: 'BIOMÉDICO',
};

/** Profissão → sigla do conselho quando o wizard usa "outro". */
const PROFISSAO_CONSELHO_GCOOP: Record<string, string> = {
  Médico: 'CRM',
  Enfermeiro: 'COREN',
  Fisioterapeuta: 'CREFITO',
  Nutricionista: 'CRN',
  Farmacêutico: 'CRF',
  Psicólogo: 'CRP',
  Fonoaudiólogo: 'CREFONO',
  'Cirurgião-Dentista': 'CRO',
  Dentista: 'CRO',
  'Serviço Social': 'CRESS',
  'Assistente Social': 'CRESS',
  Biomédico: 'CRBM',
};

/** Lookup case-insensitive / sem acento nas tabelas de profissão → Gcoop. */
function lookupProfissaoMap(map: Record<string, string>, raw: string): string | undefined {
  const key = str(raw);
  if (!key) return undefined;
  if (map[key]) return map[key];
  const n = normalizeGcoopLabel(key);
  for (const [k, v] of Object.entries(map)) {
    if (normalizeGcoopLabel(k) === n) return v;
  }
  // Aliases extras (texto livre do wizard / import lote).
  if (n.includes('servico social') || n.includes('assistente social')) {
    return map['Assistente Social'] || map['Serviço Social'];
  }
  return undefined;
}

function str(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function onlyDigits(value: unknown): string {
  return str(value).replace(/\D/g, '');
}

function toIsoDate(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function readFileAsBuffer(caminhoStored: string): Buffer | null {
  try {
    const full = resolveStoredFileToAbsolute(caminhoStored.trim());
    if (!fileExistsSafe(full)) return null;
    return fs.readFileSync(full);
  } catch {
    return null;
  }
}

/** IDs Gcoop: ímpar = positivo, par = negativo (A+=1, A-=2, O+=7, O-=8). */
export function mapTipoSanguineoId(wizardValue: string): number {
  const v = str(wizardValue).toUpperCase();
  const positive = !v.includes('-');
  if (v.startsWith('AB')) return positive ? 5 : 6;
  if (v.startsWith('A')) return positive ? 1 : 2;
  if (v.startsWith('B')) return positive ? 3 : 4;
  return positive ? 7 : 8;
}

async function resolveCidadeRef(
  ufSigla: string,
  nomeCidade: string,
  opts?: { searchOtherUfs?: boolean }
): Promise<{ id: number; uf: string } | null> {
  const dados = await getGcoopDadosIniciaisCached();
  const uf = findGcoopUfSigla(dados.ListaUF, ufSigla);
  const nome = nomeCidade.trim();
  if (!nome) return null;

  if (uf) {
    const cidades = await getGcoopCidadesCached(uf);
    const id = findGcoopCidadeId(cidades, nome);
    if (id != null) return { id, uf };
  }

  if (!opts?.searchOtherUfs) return null;

  const allUfs = (dados.ListaUF || [])
    .map((item) => {
      const idRaw = item.ID ?? item.Id ?? item.id;
      if (idRaw == null) return '';
      return String(idRaw).trim().toUpperCase().slice(0, 2);
    })
    .filter((s, i, arr) => s.length === 2 && s !== uf && arr.indexOf(s) === i);

  // Em paralelo (listas ficam em cache) — só quando a UF informada não tem a cidade.
  const results = await Promise.all(
    allUfs.map(async (other) => {
      const cidades = await getGcoopCidadesCached(other);
      const id = findGcoopCidadeId(cidades, nome);
      return id != null ? { id, uf: other } : null;
    })
  );
  const hit = results.find(Boolean) ?? null;
  if (hit) {
    console.warn(
      `[gcoop] cidade "${nome}" não encontrada em ${uf || ufSigla || '?'}; usando UF ${hit.uf}`
    );
  }
  return hit;
}

async function resolveCidadeId(ufSigla: string, nomeCidade: string): Promise<number | null> {
  const ref = await resolveCidadeRef(ufSigla, nomeCidade, { searchOtherUfs: false });
  return ref?.id ?? null;
}

function buildFlatDocumentFields(documentos: MedicoDocumentoRef[]): GcoopDocumentoFlatFields {
  const out: GcoopDocumentoFlatFields = {};

  for (const doc of documentos) {
    const campo = GCOOP_CAMPO_API_BY_TIPO[doc.tipo];
    if (!campo) continue;
    const buf = readFileAsBuffer(doc.caminhoArquivo);
    if (!buf?.length) continue;
    out[campo] = buf;
  }

  return out;
}

function resolveCategoriaId(
  profissao: string,
  wizard: WizardGcoopJson,
  lista: Parameters<typeof findGcoopItemIdByLabel>[0]
): number | null {
  const detalhe = str(wizard.categoriaProfissionalDetalhe);
  const especialidade = str(wizard.especialidadeProfissional);
  const candidates = [
    lookupProfissaoMap(PROFISSAO_CATEGORIA_GCOOP, profissao),
    lookupProfissaoMap(PROFISSAO_CATEGORIA_GCOOP, detalhe),
    lookupProfissaoMap(PROFISSAO_CATEGORIA_GCOOP, especialidade),
    detalhe,
    especialidade,
    profissao,
  ].filter(Boolean) as string[];

  for (const label of candidates) {
    const id = findGcoopItemIdByLabel(lista, label);
    if (id != null && id !== 0) return id;
  }
  return null;
}

function resolveConselhoId(
  conselhoLabel: string,
  profissao: string,
  wizard: WizardGcoopJson,
  lista: Parameters<typeof findGcoopItemIdByLabel>[0]
): number | null {
  const detalhe = str(wizard.categoriaProfissionalDetalhe);
  const especialidade = str(wizard.especialidadeProfissional);
  const candidates = [
    conselhoLabel && !/^outro$/i.test(conselhoLabel) ? conselhoLabel : '',
    lookupProfissaoMap(PROFISSAO_CONSELHO_GCOOP, profissao),
    lookupProfissaoMap(PROFISSAO_CONSELHO_GCOOP, detalhe),
    lookupProfissaoMap(PROFISSAO_CONSELHO_GCOOP, especialidade),
  ].filter(Boolean) as string[];

  for (const label of candidates) {
    const id = findGcoopItemIdByLabel(lista, label);
    if (id != null && id !== 0) return id;
  }
  return null;
}

export interface MapGcoopPayloadInput {
  wizard: WizardGcoopJson;
  medico: {
    nomeCompleto: string;
    email: string | null;
    cpf: string;
    crm: string | null;
    profissao: string;
    especialidades: string[];
  };
  documentos: MedicoDocumentoRef[];
}

export async function mapWizardToGcoopPreCadastro(
  input: MapGcoopPayloadInput
): Promise<GcoopPreCadastroPayload> {
  const w = input.wizard;
  const dados = await getGcoopDadosIniciaisCached();

  const ufEndereco = str(w.estado).toUpperCase().slice(0, 2) || 'CE';
  const ufNaturalidadeInformada =
    findGcoopUfSigla(dados.ListaUF, str(w.estadoNaturalidade)) ?? ufEndereco;
  const cidadeEnderecoId = await resolveCidadeId(ufEndereco, str(w.cidade));
  // Naturalidade: se a cidade não existir na UF digitada, procura em outras UFs e corrige a sigla.
  const naturalidadeRef = await resolveCidadeRef(
    ufNaturalidadeInformada,
    str(w.cidadeNaturalidade),
    { searchOtherUfs: true }
  );
  const cidadeNaturalidadeId = naturalidadeRef?.id ?? null;
  const ufNaturalidade = naturalidadeRef?.uf ?? ufNaturalidadeInformada;

  const sexoLabel = wizardValueToLabel('sexo', w.sexo);
  const estadoCivilLabel = wizardValueToLabel('estadoCivil', w.estadoCivil);
  const grauLabel = wizardValueToLabel('grauInstrucao', w.grauInstrucao);
  const regimeLabel = wizardValueToLabel('regimeComunhao', w.regimeComunhao);
  const conselhoLabel = wizardValueToLabel('conselhoClasse', w.conselhoClasse);

  const idSexo = findGcoopItemIdByLabel(dados.ListaSexo, sexoLabel) ?? 1;
  const idRacaCor = findGcoopRacaCorFallbackId(dados.ListaRacaCor) ?? 6;
  const idEstadoCivil = findGcoopItemIdByLabel(dados.ListaEstadoCivil, estadoCivilLabel) ?? 1;
  const idGrau = findGcoopItemIdByLabel(dados.ListaGrauInstrucao, grauLabel) ?? 8;
  const idTipoSanguineo = mapTipoSanguineoId(str(w.tipoSanguineo));
  const idRegime =
    w.estadoCivil === 'casado' && regimeLabel
      ? findGcoopItemIdByLabel(dados.ListaRegimeComunhao, regimeLabel)
      : null;
  const listaNacionalidade = dados.ListaNacionalidade ?? dados.ListaPais;
  const idPais =
    findGcoopItemIdByLabel(listaNacionalidade, str(w.nacionalidade) || 'Brasileira') ??
    findGcoopItemIdByLabel(listaNacionalidade, 'Brasileira') ??
    105;
  const idOrgao = resolveGcoopOrgaoExpedidorId(dados.ListaOrgaoExpedidor, str(w.rgOrgaoExpedicao));
  const idConselho = resolveConselhoId(conselhoLabel, input.medico.profissao, w, dados.ListaConselho);
  const especialidadeNome =
    str(w.especialidadeProfissional) || input.medico.especialidades[0] || '';
  const idEspecialidade = especialidadeNome
    ? findGcoopItemIdByLabel(dados.ListaEspecialidade, especialidadeNome)
    : null;

  const dddCel = onlyDigits(w.dddCelular).slice(0, 2) || null;
  const telCel = onlyDigits(w.telefoneCelular) || null;
  const dddRes = onlyDigits(w.dddResidencial).slice(0, 2) || null;
  const telRes = onlyDigits(w.telefoneResidencial) || null;

  const nrConselho = str(w.numeroConselho) || str(input.medico.crm);
  const flatDocs = buildFlatDocumentFields(input.documentos);

  const payload: GcoopPreCadastroPayload = {
    ID: 0,
    Nome: str(w.nomeCompleto) || input.medico.nomeCompleto,
    CPF: onlyDigits(w.cpf) || input.medico.cpf,
    PisPasep: onlyDigits(w.pis),
    ID_Sexo: idSexo,
    ID_RacaCor: idRacaCor,
    ID_EstadoCivil: idEstadoCivil,
    ID_GrauInstrucao: idGrau,
    DataNascimento: toIsoDate(w.dataNascimento) || '1990-01-01',
    ID_TipoSanguineo: idTipoSanguineo,
    ID_RegimeComunhao: idRegime,
    ID_Especialidade: idEspecialidade,
    PossuiCursoCooperativismo: false,
    DataRealizacaoCursoCooperativismo: null,
    DataAgendamentoCursoCooperativismo: null,
    ID_Pais: idPais,
    Naturalidade: ufNaturalidade,
    CidadeNaturalidade: cidadeNaturalidadeId,
    RG: str(w.rg),
    DataExpedicaoRG: toIsoDate(w.rgDataExpedicao) || '2010-01-01',
    ID_OrgaoExpedidor: idOrgao,
    ID_UfOrgaoExpedidor: str(w.rgUfOrgao).toUpperCase().slice(0, 2) || ufEndereco,
    NumeroCTPS: null,
    SerieCTPS: null,
    UFCTPS: null,
    TituloEleitor: onlyDigits(w.tituloEleitor) || null,
    NomeMae: str(w.nomeMae),
    NomePai: str(w.nomePai),
    Logradouro: str(w.rua),
    Numero: str(w.numero),
    CidadeEnderecoID: cidadeEnderecoId,
    Complemento: str(w.complemento) || null,
    Bairro: str(w.bairro),
    Cep: onlyDigits(w.cep),
    UF_Endereco: ufEndereco,
    Email: str(w.email) || str(input.medico.email),
    DDDTelefoneResidencial: dddRes,
    TelefoneResidencial: telRes,
    DDDTelefoneCelular: dddCel,
    TelefoneCelular: telCel,
    ID_Conselho: idConselho,
    Nr_Conselho: nrConselho || null,
    ID_Categoria: resolveCategoriaId(input.medico.profissao, w, dados.ListaCategoria),
    DataPreCadastro: todayIso(),
    Matricula: null,
    ID_Cooperado: null,
    DocumentosProponentes: [],
    Foto: null,
    ...flatDocs,
  };

  return payload;
}
