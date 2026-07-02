/** Alinhar com `backend/src/middleware/upload.middleware.ts` (uploadPerfilDocumentos). */
export const CADASTRO_MAX_BYTES_PER_FILE = 25 * 1024 * 1024; // 25 MiB por ficheiro

export const DOCUMENTOS_PERFIL_FIELDS = [
  'cedulaIdentidadeCrm',
  'certidaoRegularidadeFiscalCrm',
  'comprovanteEnderecoResidencia',
  'dadosBancariosPfPix',
  'declaracaoRegularidadeContribuinteIndividual',
  'diploma',
  'documentoAssinaturaDigital',
  'rqeRegistroQualificacao',
  'rgCpfOuCnh',
  'tituloEspecialista',
] as const;

export type DocumentoPerfilField = (typeof DOCUMENTOS_PERFIL_FIELDS)[number];

/** Cadastro público: só estes são obrigatórios; o perfil pode pedir envio dos demais depois. */
export const DOCUMENTOS_PERFIL_OBRIGATORIOS_CADASTRO = [
  'cedulaIdentidadeCrm',
  'certidaoRegularidadeFiscalCrm',
  'comprovanteEnderecoResidencia',
  'rgCpfOuCnh',
] as const satisfies readonly DocumentoPerfilField[];

export function isDocumentoObrigatorioNoCadastro(field: DocumentoPerfilField): boolean {
  return (DOCUMENTOS_PERFIL_OBRIGATORIOS_CADASTRO as readonly DocumentoPerfilField[]).includes(field);
}

/** Ordem na etapa Documentos: críticos primeiro, depois opcionais. */
export const DOCUMENTOS_PERFIL_CADASTRO_ORDEM: DocumentoPerfilField[] = [
  ...DOCUMENTOS_PERFIL_OBRIGATORIOS_CADASTRO,
  ...DOCUMENTOS_PERFIL_FIELDS.filter((f) => !isDocumentoObrigatorioNoCadastro(f)),
];

export const DOCUMENTO_LABEL_BY_FIELD: Record<DocumentoPerfilField, string> = {
  cedulaIdentidadeCrm: 'Documento do conselho profissional (cédula ou registro — CRM, COREN, CRP, etc.)',
  certidaoRegularidadeFiscalCrm: 'Certidão de Regularidade Fiscal no Conselho Regional',
  comprovanteEnderecoResidencia: 'Comprovante de Endereço / Residência',
  dadosBancariosPfPix: 'Dados bancários pessoa física e chave PIX',
  declaracaoRegularidadeContribuinteIndividual:
    'Declaração de Regularidade de Contribuinte Individual (gov.com)',
  diploma: 'Diploma',
  documentoAssinaturaDigital: 'Documento com Assinatura Digital',
  rqeRegistroQualificacao: 'RQE - Registro de Qualificação',
  rgCpfOuCnh: 'RG/CPF ou CNH',
  tituloEspecialista: 'Título - Especialista',
};

export const DOCUMENTO_TIPO_BY_FIELD: Record<DocumentoPerfilField, string> = {
  cedulaIdentidadeCrm: 'CEDULA_IDENTIDADE_CRM',
  certidaoRegularidadeFiscalCrm: 'CERTIDAO_REGULARIDADE_FISCAL_CRM',
  comprovanteEnderecoResidencia: 'COMPROVANTE_ENDERECO',
  dadosBancariosPfPix: 'DADOS_BANCARIOS_PF_PIX',
  declaracaoRegularidadeContribuinteIndividual: 'DECLARACAO_REGULARIDADE_CONTRIBUINTE_INDIVIDUAL',
  diploma: 'DIPLOMA',
  documentoAssinaturaDigital: 'DOCUMENTO_ASSINATURA_DIGITAL',
  rqeRegistroQualificacao: 'RQE',
  rgCpfOuCnh: 'RG_CPF_OU_CNH',
  tituloEspecialista: 'TITULO_ESPECIALISTA',
};
