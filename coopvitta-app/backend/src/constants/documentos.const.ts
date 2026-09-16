import { DocumentoPerfilTipo } from '@prisma/client';

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

export type DocumentoPerfilFieldName = (typeof DOCUMENTOS_PERFIL_FIELDS)[number];

export const DOCUMENTO_TIPO_BY_FIELD: Record<DocumentoPerfilFieldName, DocumentoPerfilTipo> = {
  cedulaIdentidadeCrm: DocumentoPerfilTipo.CEDULA_IDENTIDADE_CRM,
  certidaoRegularidadeFiscalCrm: DocumentoPerfilTipo.CERTIDAO_REGULARIDADE_FISCAL_CRM,
  comprovanteEnderecoResidencia: DocumentoPerfilTipo.COMPROVANTE_ENDERECO,
  dadosBancariosPfPix: DocumentoPerfilTipo.DADOS_BANCARIOS_PF_PIX,
  declaracaoRegularidadeContribuinteIndividual:
    DocumentoPerfilTipo.DECLARACAO_REGULARIDADE_CONTRIBUINTE_INDIVIDUAL,
  diploma: DocumentoPerfilTipo.DIPLOMA,
  documentoAssinaturaDigital: DocumentoPerfilTipo.DOCUMENTO_ASSINATURA_DIGITAL,
  rqeRegistroQualificacao: DocumentoPerfilTipo.RQE,
  rgCpfOuCnh: DocumentoPerfilTipo.RG_CPF_OU_CNH,
  tituloEspecialista: DocumentoPerfilTipo.TITULO_ESPECIALISTA,
};

export const DOCUMENTO_LABEL_BY_TIPO: Record<DocumentoPerfilTipo, string> = {
  [DocumentoPerfilTipo.CEDULA_IDENTIDADE_CRM]:
    'Documento do conselho profissional (cédula ou registro — CRM, COREN, CRP, etc.)',
  [DocumentoPerfilTipo.CERTIDAO_REGULARIDADE_FISCAL_CRM]:
    'Certidão de Regularidade Fiscal no Conselho Regional',
  [DocumentoPerfilTipo.COMPROVANTE_ENDERECO]: 'Comprovante de Endereço / Residência',
  [DocumentoPerfilTipo.DADOS_BANCARIOS_PF_PIX]: 'Dados bancários pessoa física e chave PIX',
  [DocumentoPerfilTipo.DECLARACAO_REGULARIDADE_CONTRIBUINTE_INDIVIDUAL]:
    'Declaração de Regularidade de Contribuinte Individual (gov.com)',
  [DocumentoPerfilTipo.DIPLOMA]: 'Diploma',
  [DocumentoPerfilTipo.DOCUMENTO_ASSINATURA_DIGITAL]: 'Documento com Assinatura Digital',
  [DocumentoPerfilTipo.RQE]: 'RQE - Registro de Qualificação',
  [DocumentoPerfilTipo.RG_CPF_OU_CNH]: 'RG/CPF ou CNH',
  [DocumentoPerfilTipo.TITULO_ESPECIALISTA]: 'Título - Especialista',
};
