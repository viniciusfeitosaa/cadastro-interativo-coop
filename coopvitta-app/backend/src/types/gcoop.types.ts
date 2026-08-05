/** Item genérico retornado pelas listas de domínio do Gcoop (DadosIniciais). */
export interface GcoopDomainItem {
  ID?: number | string;
  Id?: number | string;
  id?: number | string;
  Descricao?: string;
  Nome?: string;
  Sigla?: string;
  UF?: string;
  Abreviacao?: string;
  CampoAPI?: string;
}

/**
 * Documentos no POST usam campos planos (CampoAPI), não array Documentos.
 * Em memória ficam como Buffer; a serialização JSON gera Collection<byte> ([n,n,...])
 * sem materializar number[] (evita OOM com PDFs/JPGs grandes).
 */
export type GcoopDocumentoFlatFields = {
  CNH?: Buffer;
  ComprovanteEndereco?: Buffer;
  CarteiraConselho?: Buffer;
};

export interface GcoopPreCadastroPayload extends GcoopDocumentoFlatFields {
  ID: number;
  Nome: string;
  CPF: string;
  PisPasep: string;
  ID_Sexo: number;
  ID_RacaCor: number;
  ID_EstadoCivil: number;
  ID_GrauInstrucao: number;
  DataNascimento: string;
  ID_TipoSanguineo: number;
  ID_RegimeComunhao: number | null;
  ID_Especialidade: number | null;
  PossuiCursoCooperativismo: boolean;
  DataRealizacaoCursoCooperativismo: string | null;
  DataAgendamentoCursoCooperativismo: string | null;
  ID_Pais: number;
  /** Sigla UF de naturalidade (ex.: "CE") — obrigatório no POST homolog. */
  Naturalidade: string;
  CidadeNaturalidade: number | null;
  RG: string;
  DataExpedicaoRG: string;
  ID_OrgaoExpedidor: number | null;
  ID_UfOrgaoExpedidor: string;
  NumeroCTPS: string | null;
  SerieCTPS: string | null;
  UFCTPS: string | null;
  TituloEleitor: string | null;
  NomeMae: string;
  NomePai: string;
  Logradouro: string;
  Numero: string;
  CidadeEnderecoID: number | null;
  Complemento: string | null;
  Bairro: string;
  Cep: string;
  UF_Endereco: string;
  Email: string;
  DDDTelefoneResidencial: string | null;
  TelefoneResidencial: string | null;
  DDDTelefoneCelular: string | null;
  TelefoneCelular: string | null;
  ID_Conselho: number | null;
  Nr_Conselho: string | null;
  ID_Categoria: number | null;
  DataPreCadastro: string;
  Matricula: string | null;
  ID_Cooperado: number | null;
  DocumentosProponentes: unknown[];
  Foto: null;
}

export interface GcoopDadosIniciais {
  ListaSexo?: GcoopDomainItem[];
  ListaRacaCor?: GcoopDomainItem[];
  ListaEstadoCivil?: GcoopDomainItem[];
  ListaGrauInstrucao?: GcoopDomainItem[];
  ListaTipoSanguineo?: GcoopDomainItem[];
  ListaRegimeComunhao?: GcoopDomainItem[];
  ListaUF?: GcoopDomainItem[];
  ListaNacionalidade?: GcoopDomainItem[];
  ListaPais?: GcoopDomainItem[];
  ListaOrgaoExpedidor?: GcoopDomainItem[];
  ListaConselho?: GcoopDomainItem[];
  ListaCategoria?: GcoopDomainItem[];
  ListaEspecialidade?: GcoopDomainItem[];
  ListaDocumentos?: GcoopDomainItem[];
  [key: string]: unknown;
}
