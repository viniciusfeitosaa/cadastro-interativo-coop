import api from './api';

export type FormularioListItem = {
  id: string;
  titulo: string;
  slug: string;
  descricao: string | null;
  ativo: boolean;
  publico: boolean;
  identificacaoModo: string;
  createdAt: string;
  updatedAt: string;
  _count: { respostas: number };
};

export type FormularioRespostaStatus =
  | 'NOVA'
  | 'EM_ANALISE'
  | 'PRE_SELECIONADA'
  | 'REJEITADA'
  | 'ARQUIVADA';

export type FormularioRespostaItem = {
  id: string;
  status: FormularioRespostaStatus;
  remetenteNome: string;
  remetenteTelefone: string;
  createdAt: string;
  valores: Array<{
    id: string;
    valorTexto: string | null;
    nomeArquivo: string | null;
    campo: { id?: string; chave: string; label: string; tipo: string };
  }>;
};

export const formularioAdminService = {
  list: async () => {
    const r = await api.get<{ success: boolean; data: FormularioListItem[] }>('/admin/formularios');
    return r.data;
  },

  get: async (id: string) => {
    const r = await api.get<{ success: boolean; data: FormularioListItem & { campos: unknown[] } }>(
      `/admin/formularios/${id}`
    );
    return r.data;
  },

  patch: async (id: string, body: { ativo?: boolean; descricao?: string }) => {
    const r = await api.patch<{ success: boolean; data: unknown }>(`/admin/formularios/${id}`, body);
    return r.data;
  },

  listRespostas: async (id: string, params?: { status?: string; q?: string }) => {
    const r = await api.get<{ success: boolean; data: FormularioRespostaItem[] }>(
      `/admin/formularios/${id}/respostas`,
      { params }
    );
    return r.data;
  },

  patchResposta: async (formularioId: string, respostaId: string, status: FormularioRespostaStatus) => {
    const r = await api.patch<{ success: boolean; data: unknown }>(
      `/admin/formularios/${formularioId}/respostas/${respostaId}`,
      { status }
    );
    return r.data;
  },

  downloadFicheiro: async (formularioId: string, respostaId: string, campoId: string, nome: string) => {
    const r = await api.get<Blob>(
      `/admin/formularios/${formularioId}/respostas/${respostaId}/ficheiros/${campoId}/download`,
      { responseType: 'blob' }
    );
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome || 'curriculo.pdf';
    a.click();
    URL.revokeObjectURL(url);
  },
};

export function publicFormUrl(slug: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/f/${slug}`;
  }
  return `/f/${slug}`;
}
