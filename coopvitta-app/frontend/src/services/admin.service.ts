import api from './api';
import { ModuloSistema } from '../constants/modulos';

export interface CadastroPendenteListItem {
  id: string;
  nomeCompleto: string;
  email: string | null;
  profissao: string;
  crm: string | null;
  cpf: string;
  telefone: string | null;
  createdAt: string;
}

export interface CadastroPendenteDocumento {
  id: string;
  tipo: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  createdAt: string;
}

export interface CadastroPendenteDetalhe {
  id: string;
  nomeCompleto: string;
  email: string | null;
  profissao: string;
  crm: string | null;
  cpf: string;
  telefone: string | null;
  especialidades: string[];
  vinculo: string | null;
  estadoCivil: string | null;
  enderecoResidencial: string | null;
  dadosBancarios: string | null;
  chavePix: string | null;
  createdAt: string;
  updatedAt: string;
  documentos: CadastroPendenteDocumento[];
}

/** Equipes do profissional (listagem em `/admin/medicos`). */
export interface MedicoEquipeResumo {
  id: string;
  nome: string;
  ativo: boolean;
  subgrupo: { id: string; nome: string } | null;
}

export interface AdminMedico {
  id: string;
  nomeCompleto: string;
  cpf: string;
  profissao: string;
  crm: string | null;
  email: string | null;
  especialidades: string[];
  vinculo: string | null;
  telefone: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  equipes?: MedicoEquipeResumo[];
}

export interface ContratoAtivo {
  id: string;
  nome: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string | null;
  ativo: boolean;
  usaEscala: boolean;
  usaPonto: boolean;
  permiteTrocaPlantao?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Escala {
  id: string;
  tenantId: string;
  contratoAtivoId: string;
  nome: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  contratoAtivo?: {
    id: string;
    nome: string;
    ativo: boolean;
  };
  _count?: {
    alocacoes: number;
  };
}

export interface EscalaMedicoAlocacao {
  id: string;
  tenantId: string;
  escalaId: string;
  medicoId: string;
  cargo: string | null;
  valorHora: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  medico: {
    id: string;
    nomeCompleto: string;
    crm: string | null;
    email: string | null;
    especialidades: string[];
    vinculo: string | null;
    ativo: boolean;
  };
}

export interface ValorPlantaoConfig {
  id: string;
  tenantId: string;
  contratoAtivoId?: string;
  subgrupoId?: string;
  gradeId: string;
  valorHora: string | null;
  valorHoraCobranca?: string | null;
  /** Valores por dia da semana (seg-dom) para repasse (R$/h). */
  valorHoraPorDia?: Record<string, number | null> | null;
  /** Valores por dia da semana (seg-dom) para cobrança (R$/h). */
  valorHoraCobrancaPorDia?: Record<string, number | null> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TipoPlantaoConfig {
  id: string;
  tenantId: string;
  contratoAtivoId: string;
  nome: string;
  horaInicio: string;
  horaFim: string;
  cruzaMeiaNoite: boolean;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigPontoEletronico {
  id: string;
  tenantId: string;
  contratoAtivoId: string;
  subgrupoId: string;
  equipeId: string | null;
  horasPrevistasMes: number | null;
  valorHora: string | null;
  valorHoraCobranca: string | null;
  /** Ponto sem escala: valores por dia (seg-dom). Ausente → usa valorHora global. */
  valorHoraPorDia?: Record<string, number | null> | null;
  valorHoraCobrancaPorDia?: Record<string, number | null> | null;
  horarioEntrada: string | null;
  horarioSaida: string | null;
  toleranciaMinutos: number | null;
  latitude: string | null;
  longitude: string | null;
  raioMetros: number | null;
  enderecoPonto: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EscalaPlantao {
  id: string;
  escalaId: string;
  data: string;
  gradeId: string;
  medicoId: string;
  valorHora: string | null;
  medico: {
    id: string;
    nomeCompleto: string;
    crm: string;
    email: string | null;
    telefone: string | null;
  };
}

export interface HistoricoTrocaPlantaoEscala {
  id: string;
  status: string;
  /** PERMUTA | CEDER (padrão PERMUTA em registros antigos). */
  tipoSolicitacao?: string;
  respondidaEm: string;
  createdAt: string;
  plantaoId: string;
  dataPlantao: string;
  gradeId: string;
  solicitante: { id: string; nomeCompleto: string; crm: string | null };
  /** Null em registros antigos de pedido aberto à equipe antes do aceite preencher destino. */
  destino: { id: string; nomeCompleto: string; crm: string | null } | null;
}

export interface AdicionalPlantaoData {
  id: string;
  tenantId: string;
  contratoAtivoId: string;
  data: string;
  gradeId: string;
  percentual: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subgrupo {
  id: string;
  tenantId: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  usaEscala: boolean;
  usaPonto: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { subgrupoMedicos: number; escalaSubgrupos: number; equipes?: number };
  contratoSubgrupos?: { contratoAtivo: { id: string; nome: string } }[];
}

export interface Equipe {
  id: string;
  tenantId: string;
  subgrupoId: string | null;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { equipeMedicos: number; escalaEquipes: number };
  subgrupo?: {
    id: string;
    nome: string;
    usaEscala?: boolean;
    usaPonto?: boolean;
    contratoSubgrupos?: { contratoAtivo: { id: string; nome: string } }[];
  } | null;
  contratoEquipes?: { contratoAtivo: { id: string; nome: string } }[];
}

export interface DocusealPendenteSubmitter {
  submitterId?: number | null;
  name: string | null;
  email: string | null;
  status: string | null;
  signUrl: string | null;
}

export interface DocusealPendenteSubmission {
  submissionId: number;
  submissionSlug: string | null;
  templateName: string | null;
  createdAt: string | null;
  submittersPendentes: DocusealPendenteSubmitter[];
}

export interface DocusealPendentesResponse {
  success: boolean;
  data: {
    configured: boolean;
    error: string | null;
    items: DocusealPendenteSubmission[];
  };
}

export interface DocusealDocProfissional {
  submitterId: number | null;
  submissionId: number;
  templateName: string | null;
  createdAt: string | null;
  name: string | null;
  email: string | null;
  status: string | null;
  signUrl: string | null;
}

/** Contagens alinhadas à lista de documentos configurados no servidor (mesma lógica do modal). */
export interface DocusealResumoAcaoPorEmail {
  faltaEnviar: number;
  pendenteAssinaturaMedico: number;
  aguardaSegundaParte: number;
}

export interface DocusealResumoPorEmailsResponse {
  success: boolean;
  data: {
    configured: boolean;
    error: string | null;
    byEmail: Record<string, DocusealDocProfissional[]>;
    acoesPorEmail?: Record<string, DocusealResumoAcaoPorEmail>;
  };
}

export type DocusealDocPainelStatus = 'nao_enviado' | 'pendente_medico' | 'pendente_outros' | 'concluido';

export interface DocusealDocumentoPainelItem {
  templateId: number;
  templateName: string;
  status: DocusealDocPainelStatus;
  submissionId: number | null;
  submitterId: number | null;
  signUrl: string | null;
  signerStatus: string | null;
}

export interface DocusealDocumentosPainelResponse {
  success: boolean;
  data: {
    configured: boolean;
    inviteFlowOk: boolean;
    error: string | null;
    documentos: DocusealDocumentoPainelItem[];
  };
}

export interface DocumentoEnviado {
  id: string;
  tenantId: string;
  medicoId: string;
  titulo: string | null;
  nomeArquivo: string;
  caminhoArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  enviadoPorId: string | null;
  /** Quando o profissional registrou ciência (assinatura eletrónica simplificada). */
  aceitoEm: string | null;
  createdAt: string;
  medico?: {
    id: string;
    nomeCompleto: string;
    crm: string | null;
    email: string | null;
  };
}

interface ListMedicosResponse {
  success: boolean;
  data: AdminMedico[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ListContratosAtivosResponse {
  success: boolean;
  data: ContratoAtivo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ListEscalasResponse {
  success: boolean;
  data: Escala[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ContratoAtivoPayload {
  nome: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  ativo?: boolean;
  usaEscala?: boolean;
  usaPonto?: boolean;
  permiteTrocaPlantao?: boolean;
}

interface EscalaPayload {
  contratoAtivoId: string;
  nome: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim: string;
  ativo?: boolean;
}

interface AlocarMedicoEscalaPayload {
  medicoId: string;
  cargo?: string | null;
  valorHora?: number | null;
}

export interface AcessoModuloItem {
  perfil: 'MASTER' | 'MEDICO';
  modulo: ModuloSistema;
  permitido: boolean;
}

export interface RelatorioProcedimentosMesApiResponse {
  success: boolean;
  data: Record<string, unknown> | null;
}

export const adminService = {
  listMedicos: async (params?: { page?: number; limit?: number; search?: string; ativo?: boolean }) => {
    const response = await api.get<ListMedicosResponse>('/admin/medicos', {
      params,
    });
    return response.data;
  },

  getRelatorioProcedimentosMes: async (mesRef: string): Promise<RelatorioProcedimentosMesApiResponse> => {
    const response = await api.get<RelatorioProcedimentosMesApiResponse>(`/admin/relatorios/procedimentos/${mesRef}`);
    return response.data;
  },

  saveRelatorioProcedimentosMes: async (mesRef: string, dados: Record<string, unknown>) => {
    const response = await api.put<{ success: boolean }>(`/admin/relatorios/procedimentos/${mesRef}`, { dados });
    return response.data;
  },

  listDocusealPendentes: async (): Promise<DocusealPendentesResponse> => {
    const response = await api.get<DocusealPendentesResponse>('/admin/integrations/docuseal/pending-submissions');
    return response.data;
  },

  docusealResumoPorEmails: async (emails: string[]): Promise<DocusealResumoPorEmailsResponse> => {
    const response = await api.post<DocusealResumoPorEmailsResponse>('/admin/integrations/docuseal/resumo-por-emails', {
      emails,
    });
    return response.data;
  },

  docusealResendSubmitterEmail: async (submitterId: number): Promise<{ success: boolean; message?: string }> => {
    const response = await api.post<{ success: boolean; message?: string }>(
      `/admin/integrations/docuseal/submitters/${submitterId}/resend-email`
    );
    return response.data;
  },

  getMedicoDocusealDocumentos: async (medicoId: string): Promise<DocusealDocumentosPainelResponse> => {
    const response = await api.get<DocusealDocumentosPainelResponse>(
      `/admin/medicos/${medicoId}/docuseal/documentos`
    );
    return response.data;
  },

  enviarDocusealTemplateMedico: async (
    medicoId: string,
    templateId: number
  ): Promise<{ success: boolean; data?: { attempted: boolean; created: number; errors: string[] } }> => {
    const response = await api.post(`/admin/medicos/${medicoId}/docuseal/enviar-template`, {
      templateId,
    });
    return response.data;
  },

  listContratosAtivos: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get<ListContratosAtivosResponse>('/admin/contratos-ativos', { params });
    return response.data;
  },

  createContratoAtivo: async (payload: ContratoAtivoPayload) => {
    const response = await api.post('/admin/contratos-ativos', payload);
    return response.data;
  },

  updateContratoAtivo: async (id: string, payload: ContratoAtivoPayload) => {
    const response = await api.put(`/admin/contratos-ativos/${id}`, payload);
    return response.data;
  },

  deleteContratoAtivo: async (id: string) => {
    const response = await api.delete(`/admin/contratos-ativos/${id}`);
    return response.data;
  },

  listContratoSubgrupos: async (contratoId: string) => {
    const response = await api.get<{ success: boolean; data: { id: string; subgrupo: { id: string; nome: string; ativo: boolean } }[] }>(
      `/admin/contratos-ativos/${contratoId}/subgrupos`
    );
    return response.data;
  },

  addContratoSubgrupo: async (contratoId: string, subgrupoId: string) => {
    const response = await api.post(`/admin/contratos-ativos/${contratoId}/subgrupos`, { subgrupoId });
    return response.data;
  },

  removeContratoSubgrupo: async (contratoId: string, subgrupoId: string) => {
    const response = await api.delete(`/admin/contratos-ativos/${contratoId}/subgrupos/${subgrupoId}`);
    return response.data;
  },

  listContratoEquipes: async (contratoId: string) => {
    const response = await api.get<{
      success: boolean;
      data: { id: string; equipe: { id: string; nome: string; ativo: boolean; subgrupo?: { id: string; nome: string } } }[];
    }>(`/admin/contratos-ativos/${contratoId}/equipes`);
    return response.data;
  },

  addContratoEquipe: async (contratoId: string, equipeId: string) => {
    const response = await api.post(`/admin/contratos-ativos/${contratoId}/equipes`, { equipeId });
    return response.data;
  },

  removeContratoEquipe: async (contratoId: string, equipeId: string) => {
    const response = await api.delete(`/admin/contratos-ativos/${contratoId}/equipes/${equipeId}`);
    return response.data;
  },

  listEscalas: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get<ListEscalasResponse>('/admin/escalas', { params });
    return response.data;
  },

  createEscala: async (payload: EscalaPayload) => {
    const response = await api.post('/admin/escalas', payload);
    return response.data;
  },

  updateEscala: async (id: string, payload: Partial<EscalaPayload>) => {
    const response = await api.put(`/admin/escalas/${id}`, payload);
    return response.data;
  },

  deleteEscala: async (id: string) => {
    const response = await api.delete(`/admin/escalas/${id}`);
    return response.data;
  },

  listEscalaMedicos: async (escalaId: string) => {
    const response = await api.get<{ success: boolean; data: EscalaMedicoAlocacao[] }>(
      `/admin/escalas/${escalaId}/medicos`
    );
    return response.data;
  },

  alocarMedicoEscala: async (escalaId: string, payload: AlocarMedicoEscalaPayload) => {
    const response = await api.post(`/admin/escalas/${escalaId}/medicos`, payload);
    return response.data;
  },

  removerMedicoEscala: async (escalaId: string, medicoId: string) => {
    const response = await api.delete(`/admin/escalas/${escalaId}/medicos/${medicoId}`);
    return response.data;
  },

  listEscalaPlantoes: async (
    escalaId: string,
    params?: { dataInicio?: string; dataFim?: string }
  ): Promise<{ success: boolean; data: EscalaPlantao[] }> => {
    const response = await api.get(`/admin/escalas/${escalaId}/plantoes`, { params });
    return response.data;
  },

  listHistoricoTrocasPlantaoEscala: async (
    escalaId: string
  ): Promise<{ success: boolean; data: HistoricoTrocaPlantaoEscala[] }> => {
    const response = await api.get(`/admin/escalas/${escalaId}/trocas-plantao-historico`);
    return response.data;
  },

  listEquipePlantoes: async (
    equipeId: string,
    params?: { dataInicio?: string; dataFim?: string; modo?: 'fixa' | 'dinamica' }
  ): Promise<{ success: boolean; data: EscalaPlantao[] }> => {
    const response = await api.get(`/admin/equipes/${equipeId}/plantoes`, { params });
    return response.data;
  },

  listEscalasByEquipe: async (equipeId: string): Promise<{ success: boolean; data: Escala[] }> => {
    const response = await api.get(`/admin/equipes/${equipeId}/escalas`);
    return response.data;
  },

  createEscalaPlantao: async (
    escalaId: string,
    payload: { data: string; gradeId: string; medicoId: string; valorHora?: number | null }
  ) => {
    const response = await api.post(`/admin/escalas/${escalaId}/plantoes`, payload);
    return response.data;
  },

  replicarEscalaPlantoesMes: async (
    escalaId: string,
    payload: { mesOrigem: string; mesDestino: string }
  ): Promise<{
    success: boolean;
    data?: {
      criados: number;
      ignoradosJaExistia: number;
      ignoradosForaPeriodo: number;
      erros: number;
      totalOrigem: number;
    };
    message?: string;
    error?: string;
  }> => {
    const response = await api.post(`/admin/escalas/${escalaId}/plantoes/replicar-mes`, payload);
    return response.data;
  },

  listAdicionaisPlantao: async (params: {
    contratoAtivoId: string;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<{ success: boolean; data: AdicionalPlantaoData[] }> => {
    const response = await api.get('/admin/adicionais-plantao', { params });
    return response.data;
  },

  upsertAdicionalPlantao: async (payload: {
    contratoAtivoId: string;
    data: string;
    gradeId: string;
    percentual: number;
  }): Promise<{ success: boolean; data: AdicionalPlantaoData }> => {
    const response = await api.put('/admin/adicionais-plantao', payload);
    return response.data;
  },

  removerAdicionalPlantao: async (params: {
    contratoAtivoId: string;
    data: string;
    gradeId: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const response = await api.delete('/admin/adicionais-plantao', { params });
    return response.data;
  },

  removerEscalaPlantao: async (escalaId: string, plantaoId: string) => {
    const response = await api.delete(`/admin/escalas/${escalaId}/plantoes/${plantaoId}`);
    return response.data;
  },

  getValoresPlantaoOpcoes: async (): Promise<{
    success: boolean;
    data: {
      contratos: { id: string; nome: string }[];
      subgrupos: { id: string; nome: string; ativo: boolean }[];
      equipes: { id: string; nome: string; ativo: boolean; subgrupoId: string | null }[];
      contratoSubgrupos: { contratoAtivoId: string; subgrupoId: string }[];
      contratoEquipes: { contratoAtivoId: string; equipeId: string }[];
    };
  }> => {
    const response = await api.get('/admin/valores-plantao/opcoes');
    return response.data;
  },

  getValoresPlantao: async (
    contratoId: string,
    subgrupoId?: string,
    equipeId?: string
  ): Promise<{ success: boolean; data: ValorPlantaoConfig[] }> => {
    const params: Record<string, string> = { contratoId };
    if (subgrupoId) params.subgrupoId = subgrupoId;
    if (equipeId) params.equipeId = equipeId;
    const response = await api.get('/admin/valores-plantao', { params });
    return response.data;
  },

  setValorPlantao: async (
    contratoId: string,
    subgrupoId: string,
    equipeId: string,
    gradeId: string,
    payload: {
      valorHora: number | null;
      valorHoraCobranca?: number | null;
      valorHoraPorDia?: Record<string, number | null> | null;
      valorHoraCobrancaPorDia?: Record<string, number | null> | null;
    }
  ) => {
    const response = await api.put('/admin/valores-plantao', {
      contratoId,
      subgrupoId,
      equipeId,
      gradeId,
      ...payload,
    });
    return response.data;
  },

  listTiposPlantao: async (
    contratoAtivoId: string
  ): Promise<{ success: boolean; data: TipoPlantaoConfig[] }> => {
    const response = await api.get('/admin/tipos-plantao', {
      params: { contratoAtivoId },
    });
    return response.data;
  },

  createTipoPlantao: async (payload: {
    contratoAtivoId: string;
    nome: string;
    horaInicio: string;
    horaFim: string;
    cruzaMeiaNoite?: boolean;
  }) => {
    const response = await api.post('/admin/tipos-plantao', payload);
    return response.data;
  },

  updateTipoPlantao: async (
    id: string,
    payload: { nome?: string; horaInicio?: string; horaFim?: string; cruzaMeiaNoite?: boolean }
  ) => {
    const response = await api.put(`/admin/tipos-plantao/${id}`, payload);
    return response.data;
  },

  deleteTipoPlantao: async (id: string) => {
    const response = await api.delete(`/admin/tipos-plantao/${id}`);
    return response.data;
  },

  getConfigPontoOpcoes: async (): Promise<{
    success: boolean;
    data: {
      contratos: { id: string; nome: string }[];
      subgrupos: { id: string; nome: string; ativo: boolean }[];
      equipes: { id: string; nome: string; ativo: boolean; subgrupoId: string | null }[];
      contratoSubgrupos: { contratoAtivoId: string; subgrupoId: string }[];
    };
  }> => {
    const response = await api.get('/admin/config-ponto/opcoes');
    return response.data;
  },

  getConfigPonto: async (
    contratoId: string,
    subgrupoId: string,
    equipeId: string | null
  ): Promise<{ success: boolean; data: ConfigPontoEletronico | null }> => {
    const response = await api.get('/admin/config-ponto', {
      params: { contratoId, subgrupoId, ...(equipeId ? { equipeId } : {}) },
    });
    return response.data;
  },

  setConfigPonto: async (
    contratoId: string,
    subgrupoId: string,
    equipeId: string | null,
    payload: {
      horasPrevistasMes: number | null;
      valorHora: number | null;
      valorHoraCobranca: number | null;
      valorHoraPorDia?: Record<string, number | null> | null;
      valorHoraCobrancaPorDia?: Record<string, number | null> | null;
      horarioEntrada?: string | null;
      horarioSaida?: string | null;
      toleranciaMinutos?: number | null;
      latitude?: string | number | null;
      longitude?: string | number | null;
      raioMetros?: number | null;
      enderecoPonto?: string | null;
    }
  ) => {
    const response = await api.put('/admin/config-ponto', {
      contratoId,
      subgrupoId,
      ...(equipeId ? { equipeId } : {}),
      ...payload,
    });
    return response.data;
  },

  listRegistrosPonto: async (params?: {
    escalaId?: string;
    medicoId?: string;
    contratoAtivoId?: string;
    subgrupoId?: string;
    equipeId?: string;
    dataInicio?: string;
    dataFim?: string;
  }) => {
    const response = await api.get('/admin/registros-ponto', { params });
    return response.data;
  },

  openRegistroPontoFotoCheckin: async (registroId: string) => {
    const response = await api.get(`/admin/registros-ponto/${registroId}/foto-checkin`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'image/jpeg',
    });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    // libera depois (tempo para o navegador carregar o blob)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  getMatrizAcessosModulos: async (): Promise<{
    success: boolean;
    data: {
      master: AcessoModuloItem[];
      medico: AcessoModuloItem[];
    };
  }> => {
    const response = await api.get('/admin/acessos-modulos');
    return response.data;
  },

  salvarMatrizAcessosModulos: async (items: AcessoModuloItem[]) => {
    const response = await api.put('/admin/acessos-modulos', { items });
    return response.data;
  },

  listSubgrupos: async () => {
    const response = await api.get<{ success: boolean; data: Subgrupo[] }>('/admin/subgrupos');
    return response.data;
  },
  createSubgrupo: async (payload: {
    nome: string;
    descricao?: string | null;
    ativo?: boolean;
    usaEscala?: boolean;
    usaPonto?: boolean;
  }) => {
    const response = await api.post('/admin/subgrupos', payload);
    return response.data;
  },
  updateSubgrupo: async (
    id: string,
    payload: { nome?: string; descricao?: string | null; ativo?: boolean; usaEscala?: boolean; usaPonto?: boolean }
  ) => {
    const response = await api.put(`/admin/subgrupos/${id}`, payload);
    return response.data;
  },
  deleteSubgrupo: async (id: string) => {
    const response = await api.delete(`/admin/subgrupos/${id}`);
    return response.data;
  },
  listSubgrupoMedicos: async (id: string) => {
    const response = await api.get(`/admin/subgrupos/${id}/medicos`);
    return response.data;
  },
  addMedicoToSubgrupo: async (id: string, medicoId: string) => {
    const response = await api.post(`/admin/subgrupos/${id}/medicos`, { medicoId });
    return response.data;
  },
  removeMedicoFromSubgrupo: async (id: string, medicoId: string) => {
    const response = await api.delete(`/admin/subgrupos/${id}/medicos/${medicoId}`);
    return response.data;
  },

  listEquipes: async (params?: { subgrupoId?: string | null }) => {
    const response = await api.get<{ success: boolean; data: Equipe[] }>('/admin/equipes', { params });
    return response.data;
  },
  createEquipe: async (payload: { nome: string; descricao?: string | null; ativo?: boolean; subgrupoId?: string | null }) => {
    const response = await api.post('/admin/equipes', payload);
    return response.data;
  },
  updateEquipe: async (id: string, payload: { nome?: string; descricao?: string | null; ativo?: boolean; subgrupoId?: string | null }) => {
    const response = await api.put(`/admin/equipes/${id}`, payload);
    return response.data;
  },
  deleteEquipe: async (id: string) => {
    const response = await api.delete(`/admin/equipes/${id}`);
    return response.data;
  },
  listEquipeMedicos: async (id: string) => {
    const response = await api.get(`/admin/equipes/${id}/medicos`);
    return response.data;
  },
  addMedicoToEquipe: async (id: string, medicoId: string) => {
    const response = await api.post(`/admin/equipes/${id}/medicos`, { medicoId });
    return response.data;
  },
  removeMedicoFromEquipe: async (id: string, medicoId: string) => {
    const response = await api.delete(`/admin/equipes/${id}/medicos/${medicoId}`);
    return response.data;
  },

  listEscalaSubgrupos: async (escalaId: string) => {
    const response = await api.get(`/admin/escalas/${escalaId}/subgrupos`);
    return response.data;
  },
  addSubgrupoToEscala: async (escalaId: string, subgrupoId: string) => {
    const response = await api.post(`/admin/escalas/${escalaId}/subgrupos`, { subgrupoId });
    return response.data;
  },
  removeSubgrupoFromEscala: async (escalaId: string, subgrupoId: string) => {
    const response = await api.delete(`/admin/escalas/${escalaId}/subgrupos/${subgrupoId}`);
    return response.data;
  },
  listEscalaEquipes: async (escalaId: string) => {
    const response = await api.get(`/admin/escalas/${escalaId}/equipes`);
    return response.data;
  },
  addEquipeToEscala: async (escalaId: string, equipeId: string) => {
    const response = await api.post(`/admin/escalas/${escalaId}/equipes`, { equipeId });
    return response.data;
  },
  removeEquipeFromEscala: async (escalaId: string, equipeId: string) => {
    const response = await api.delete(`/admin/escalas/${escalaId}/equipes/${equipeId}`);
    return response.data;
  },

  listDocumentosEnviados: async (medicoId?: string) => {
    const response = await api.get<{ success: boolean; data: DocumentoEnviado[] }>('/admin/documentos-enviados', {
      params: medicoId ? { medicoId } : undefined,
    });
    return response.data;
  },
  uploadDocumentoEnviado: async (arquivo: File, medicoId: string, titulo?: string) => {
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('medicoId', medicoId);
    if (titulo != null && titulo.trim()) formData.append('titulo', titulo.trim());
    const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const res = await fetch(`${base}/admin/documentos-enviados`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: DocumentoEnviado;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      const err = new Error('Request failed') as Error & { response?: { status: number; data: unknown } };
      err.response = { status: res.status, data };
      throw err;
    }
    return data;
  },
  deleteDocumentoEnviado: async (id: string) => {
    const response = await api.delete(`/admin/documentos-enviados/${id}`);
    return response.data;
  },

  listCadastrosPendentes: async () => {
    const response = await api.get<{ success: boolean; data: CadastroPendenteListItem[] }>(
      '/admin/cadastros-pendentes'
    );
    return response.data;
  },

  getCadastroPendenteDetalhe: async (medicoId: string) => {
    const response = await api.get<{ success: boolean; data: CadastroPendenteDetalhe }>(
      `/admin/cadastros-pendentes/${medicoId}`
    );
    return response.data;
  },

  downloadCadastroPendenteDocumento: async (medicoId: string, documentoId: string): Promise<Blob> => {
    const response = await api.get<Blob>(
      `/admin/cadastros-pendentes/${medicoId}/documentos/${documentoId}/download`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  aprovarCadastroPendente: async (medicoId: string) => {
    const response = await api.post<{ success: boolean; message?: string }>(
      `/admin/cadastros-pendentes/${medicoId}/aprovar`
    );
    return response.data;
  },

  rejeitarCadastroPendente: async (medicoId: string) => {
    const response = await api.post<{ success: boolean; message?: string }>(
      `/admin/cadastros-pendentes/${medicoId}/rejeitar`
    );
    return response.data;
  },
};
