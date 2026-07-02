import api from './api';

interface CheckInPayload {
  escalaId?: string;
  observacao?: string;
  latitude?: number;
  longitude?: number;
  foto: File;
}

interface CheckInSemFotoPayload {
  escalaId?: string;
  observacao?: string;
  latitude?: number;
  longitude?: number;
  motivoSemFoto: string;
}

interface CheckOutPayload {
  observacao?: string;
  latitude?: number;
  longitude?: number;
}

export interface TrocaPlantaoPendenteItem {
  id: string;
  createdAt: string;
  plantaoId: string;
  dataPlantao: string;
  escalaId: string;
  escalaNome: string | null;
  gradeId: string;
  contrapartidaPlantaoId: string | null;
  dataPlantaoContrapartida: string | null;
  gradeIdContrapartida: string | null;
  solicitante: { id: string; nomeCompleto: string };
  destino: { id: string; nomeCompleto: string } | null;
  /** Pedido aberto à equipe; quem aceitar escolhe o plantão dele. */
  paraEquipeInteira?: boolean;
  /** PERMUTA (troca bilateral) ou CEDER (cede o plantão ao aceitante). */
  tipoSolicitacao?: 'PERMUTA' | 'CEDER';
}

export const pontoService = {
  checkIn: async (payload: CheckInPayload) => {
    const formData = new FormData();
    if (payload.escalaId) formData.append('escalaId', payload.escalaId);
    if (payload.observacao) formData.append('observacao', payload.observacao);
    if (payload.latitude != null) formData.append('latitude', String(payload.latitude));
    if (payload.longitude != null) formData.append('longitude', String(payload.longitude));
    formData.append('foto', payload.foto);
    const response = await api.post('/ponto/checkin', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** Check-in quando a câmera não pode ser usada (motivo obrigatório no servidor). */
  checkInSemFoto: async (payload: CheckInSemFotoPayload) => {
    const response = await api.post('/ponto/checkin-sem-foto', payload);
    return response.data;
  },

  checkOut: async (payload?: CheckOutPayload) => {
    const response = await api.post('/ponto/checkout', payload || {});
    return response.data;
  },

  getMeuDia: async () => {
    const response = await api.get('/ponto/meu-dia');
    return response.data;
  },

  /** Meu dia + escalas em um request (tela Ponto Eletrônico). */
  getPainelInicial: async () => {
    const response = await api.get('/ponto/painel-inicial');
    return response.data as {
      success: boolean;
      data: { meuDia: Record<string, unknown>; escalas: Array<{ id: string; nome: string }> };
    };
  },

  listMinhasEscalas: async () => {
    const response = await api.get('/ponto/minhas-escalas');
    return response.data;
  },

  listEquipeColegas: async (escalaId: string) => {
    const response = await api.get('/ponto/equipe-colegas', { params: { escalaId } });
    return response.data;
  },

  /** Plantões futuros do colega na mesma escala elegíveis para permuta (escolha no fluxo de troca). */
  listPlantoesColegaParaTroca: async (escalaId: string, medicoDestinoId: string) => {
    const response = await api.get('/ponto/plantoes-colega-troca', {
      params: { escalaId, medicoDestinoId },
    });
    return response.data as {
      success: boolean;
      data: Array<{ id: string; data: string; gradeId: string; gradeLabel: string }>;
    };
  },

  /** Seus plantões na escala elegíveis para oferecer ao aceitar permuta aberta à equipe. */
  listMeusPlantoesParaTroca: async (escalaId: string) => {
    const response = await api.get('/ponto/meus-plantoes-troca', { params: { escalaId } });
    return response.data as {
      success: boolean;
      data: Array<{ id: string; data: string; gradeId: string; gradeLabel: string }>;
    };
  },

  listProximosPlantoes: async () => {
    const response = await api.get('/ponto/proximos-plantoes');
    return response.data;
  },

  /** Plantões do mês para calendário (profissional). */
  listMeusPlantoesCalendario: async (ano: number, mes: number, equipeIds?: string[]) => {
    const params: Record<string, unknown> = { ano, mes };
    if (equipeIds && equipeIds.length > 0) {
      params.equipeIds = equipeIds.join(',');
    }

    const response = await api.get('/ponto/meus-plantoes-calendario', { params });
    return response.data as {
      success: boolean;
      data: Array<{
        id: string;
        data: string;
        gradeId: string;
        escalaId: string;
        escalaNome: string | null;
        permiteTrocaPlantao?: boolean;
      }>;
      meta: { ano: number; mes: number };
    };
  },

  listMinhasEquipesCalendario: async () => {
    const response = await api.get('/ponto/minhas-equipes-calendario');
    return response.data as { success: boolean; data: Array<{ id: string; nome: string }> };
  },

  canCheckIn: async (escalaId: string) => {
    const response = await api.get('/ponto/can-checkin', { params: { escalaId } });
    return response.data;
  },

  getHistorico: async (params?: { ano?: number; mes?: number }) => {
    const response = await api.get('/ponto/historico', { params });
    return response.data as {
      success: boolean;
      data: {
        referencia: { ano: number; mes: number };
        totalRegistros: number;
        totalMinutos: number;
        totalValorCentavos: number;
        totalValor: number;
        registros: Array<{
          id: string;
          checkInAt: string;
          checkOutAt: string | null;
          duracaoMinutos: number | null;
          checkInAtrasado: boolean;
          minutosAtrasoCheckin: number | null;
          valor: number | null;
          escalaId: string | null;
          escala?: { id: string; nome: string } | null;
          equipe?: string | null;
        }>;
      };
    };
  },

  solicitarTrocaPlantao: async (
    payload:
      | { plantaoId: string; paraEquipeInteira: true; tipoSolicitacao?: 'PERMUTA' | 'CEDER' }
      | {
          plantaoId: string;
          medicoDestinoId: string;
          plantaoContrapartidaId: string;
          tipoSolicitacao?: 'PERMUTA';
        }
      | { plantaoId: string; medicoDestinoId: string; tipoSolicitacao: 'CEDER' }
  ) => {
    const response = await api.post('/ponto/solicitar-troca-plantao', payload);
    return response.data as { success: boolean; message?: string; data?: unknown };
  },

  listTrocasPlantaoPendentes: async () => {
    const response = await api.get('/ponto/trocas-plantao-pendentes');
    return response.data as {
      success: boolean;
      data: { recebidas: TrocaPlantaoPendenteItem[]; enviadas: TrocaPlantaoPendenteItem[] };
    };
  },

  aceitarTrocaPlantao: async (
    solicitacaoId: string,
    body?: { plantaoContrapartidaId?: string }
  ) => {
    const response = await api.post(`/ponto/trocas-plantao/${solicitacaoId}/aceitar`, body ?? {});
    return response.data as { success: boolean; message?: string };
  },

  recusarTrocaPlantao: async (solicitacaoId: string) => {
    const response = await api.post(`/ponto/trocas-plantao/${solicitacaoId}/recusar`);
    return response.data as { success: boolean; message?: string };
  },
};
