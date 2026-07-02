import api from './api';
import { DocumentoPerfilField } from '../constants/documentosPerfil';

export interface NotificacaoMedicoItem {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  metadata: unknown;
  lidaEm: string | null;
  createdAt: string;
}

export interface MedicoPerfil {
  id: string;
  tenantId: string;
  nomeCompleto: string;
  profissao: string;
  crm: string | null;
  email: string | null;
  especialidades: string[];
  vinculo: string | null;
  telefone: string | null;
  estadoCivil: string | null;
  enderecoResidencial: string | null;
  dadosBancarios: string | null;
  chavePix: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  documentos: Array<{
    id: string;
    tipo: string;
    nomeArquivo: string;
    caminhoArquivo: string;
    mimeType: string;
    tamanhoBytes: number;
    updatedAt: string;
  }>;
}

export interface PerfilResponse {
  success: boolean;
  data: MedicoPerfil;
}

export interface DashboardMedicoResponse {
  success: boolean;
  data: {
    perfil: MedicoPerfil;
    meuDia: any;
    escalas: any[];
    proximosPlantoes: any[];
    documentosEnviados: DocumentoEnviadoItem[];
  };
}

export const medicoService = {
  getPerfil: async (): Promise<PerfilResponse> => {
    const response = await api.get<PerfilResponse>('/medico/perfil');
    return response.data;
  },

  getDashboard: async (): Promise<DashboardMedicoResponse> => {
    const response = await api.get<DashboardMedicoResponse>('/medico/dashboard');
    return response.data;
  },

  updatePerfil: async (payload: {
    especialidades?: string[];
    telefone?: string;
    estadoCivil?: string;
    enderecoResidencial?: string;
    dadosBancarios?: string;
    chavePix?: string;
    documentos?: Partial<Record<DocumentoPerfilField, File>>;
  }): Promise<PerfilResponse> => {
    const formData = new FormData();
    if (payload.especialidades?.length)
      formData.append('especialidades', JSON.stringify(payload.especialidades));
    if (payload.telefone) formData.append('telefone', payload.telefone);
    if (payload.estadoCivil) formData.append('estadoCivil', payload.estadoCivil);
    if (payload.enderecoResidencial) formData.append('enderecoResidencial', payload.enderecoResidencial);
    if (payload.dadosBancarios) formData.append('dadosBancarios', payload.dadosBancarios);
    if (payload.chavePix) formData.append('chavePix', payload.chavePix);
    if (payload.documentos) {
      Object.entries(payload.documentos).forEach(([field, file]) => {
        if (file) formData.append(field, file);
      });
    }
    const response = await api.put<PerfilResponse>('/medico/perfil', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteConta: async (payload: {
    senha: string;
    confirmacao: string;
  }): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete<{ success: boolean; message: string }>('/medico/conta', {
      data: payload,
    });
    return response.data;
  },

  listDocumentosEnviados: async (): Promise<{ success: boolean; data: DocumentoEnviadoItem[] }> => {
    const response = await api.get<{ success: boolean; data: DocumentoEnviadoItem[] }>('/medico/documentos-enviados');
    return response.data;
  },

  openDocumentoPerfil: async (docId: string, nomeArquivo?: string): Promise<void> => {
    const response = await api.get(`/medico/perfil/documentos/${docId}/download`, {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      if (nomeArquivo) a.download = nomeArquivo;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  openDocumentoEnviado: async (id: string, nomeArquivo?: string): Promise<void> => {
    const response = await api.get(`/medico/documentos-enviados/${id}/download`, {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      if (nomeArquivo) a.download = nomeArquivo;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  confirmarCienciaDocumentoEnviado: async (
    id: string
  ): Promise<{ success: boolean; data: { id: string; aceitoEm: string; jaRegistrado: boolean }; message?: string }> => {
    const response = await api.post(`/medico/documentos-enviados/${id}/confirmar-ciencia`);
    return response.data;
  },

  listNotificacoes: async (limit?: number): Promise<{
    success: boolean;
    data: NotificacaoMedicoItem[];
  }> => {
    const response = await api.get<{ success: boolean; data: NotificacaoMedicoItem[] }>('/medico/notificacoes', {
      params: limit ? { limit } : undefined,
    });
    return response.data;
  },

  marcarNotificacaoLida: async (id: string): Promise<void> => {
    await api.patch(`/medico/notificacoes/${id}/lida`);
  },

  marcarTodasNotificacoesLidas: async (): Promise<void> => {
    await api.post('/medico/notificacoes/marcar-todas-lidas');
  },

  listVagas: async (): Promise<ListVagasMedicoResponse> => {
    const response = await api.get<ListVagasMedicoResponse>('/medico/vagas');
    return response.data;
  },

  createVaga: async (payload: CreateVagaPayload): Promise<{ success: boolean; data: VagaPublicadaItem }> => {
    const response = await api.post<{ success: boolean; data: VagaPublicadaItem }>('/medico/vagas', payload);
    return response.data;
  },

  listMinhasPublicadasVagas: async (): Promise<{ success: boolean; data: { items: MinhaVagaPublicadaItem[] } }> => {
    const response = await api.get<{ success: boolean; data: { items: MinhaVagaPublicadaItem[] } }>(
      '/medico/vagas/minhas-publicadas'
    );
    return response.data;
  },

  getCandidatosVaga: async (
    vagaId: string
  ): Promise<{ success: boolean; data: { items: CandidatoInteresseItem[] } }> => {
    const response = await api.get<{ success: boolean; data: { items: CandidatoInteresseItem[] } }>(
      `/medico/vagas/${vagaId}/candidatos`
    );
    return response.data;
  },

  postInteresseVaga: async (vagaId: string): Promise<{ success: boolean; data: { id: string; status: StatusInteresseVaga } }> => {
    const response = await api.post(`/medico/vagas/${vagaId}/interesse`);
    return response.data;
  },

  deleteInteresseVaga: async (vagaId: string): Promise<void> => {
    await api.delete(`/medico/vagas/${vagaId}/interesse`);
  },

  deleteVaga: async (vagaId: string): Promise<void> => {
    await api.delete(`/medico/vagas/${vagaId}`);
  },

  patchStatusCandidatoVaga: async (
    vagaId: string,
    candidatoMedicoId: string,
    status: 'ACEITO' | 'RECUSADO'
  ): Promise<{ success: boolean; data: { id: string; status: StatusInteresseVaga } }> => {
    const response = await api.patch(`/medico/vagas/${vagaId}/candidatos/${candidatoMedicoId}`, { status });
    return response.data;
  },
};

export type StatusInteresseVaga = 'PENDENTE' | 'ACEITO' | 'RECUSADO';

export interface VagaPublicadaItem {
  id: string;
  medicoPublicadorId?: string;
  tipoAtendimento: string;
  setor: string;
  valorACombinar: boolean;
  valorCentavos: number | null;
  valorLiquidoBruto: string | null;
  pagamento: string;
  quantidadeVagas: number;
  prazoPublicacaoDias: number;
  categoriaProfissional: string;
  diasVaga: string[];
  descricao: string;
  createdAt: string;
  expiresAt: string;
  publicador: { id: string; nomeCompleto: string; crm: string | null };
  souPublicador?: boolean;
  meuInteresse?: { id: string; status: StatusInteresseVaga } | null;
  totalInteresses?: number;
}

export interface MinhaVagaPublicadaItem {
  id: string;
  tipoAtendimento: string;
  setor: string;
  expiresAt: string;
  ativa: boolean;
  totalInteresses: number;
  pendentes: number;
  createdAt: string;
}

export interface CandidatoInteresseItem {
  interesseId: string;
  status: StatusInteresseVaga;
  criadoEm: string;
  candidato: {
    id: string;
    nomeCompleto: string;
    crm: string | null;
    email: string | null;
    telefone: string | null;
    especialidades: string[];
    profissao: string;
    whatsappHref: string | null;
  };
}

export interface CreateVagaPayload {
  tipoAtendimento: string;
  setor: string;
  valorACombinar: boolean;
  valorCentavos: number | null;
  valorLiquidoBruto: 'LIQUIDO' | 'BRUTO' | null;
  pagamento: 'A_VISTA' | 'COMBINAR';
  quantidadeVagas: number;
  prazoPublicacaoDias: number;
  categoriaProfissional: string;
  diasVaga: string[];
  descricao: string;
  confirmacaoResponsavel: boolean;
}

export interface ListVagasMedicoResponse {
  success: boolean;
  data: {
    items: VagaPublicadaItem[];
    mensagem: string | null;
  };
}

export interface DocumentoEnviadoItem {
  id: string;
  titulo: string | null;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  aceitoEm: string | null;
  createdAt: string;
}
