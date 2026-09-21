import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

export type FormularioCampoPublico = {
  chave: string;
  label: string;
  tipo: 'TEXTO' | 'TELEFONE' | 'ESCOLHA_UNICA' | 'FICHEIRO';
  obrigatorio: boolean;
  ordem: number;
  opcoes: string[] | null;
  validacao: Record<string, unknown> | null;
};

export type FormularioPublico = {
  slug: string;
  titulo: string;
  descricao: string | null;
  identificacaoModo: string;
  campos: FormularioCampoPublico[];
};

export const formularioPublicService = {
  getBySlug: async (slug: string) => {
    const r = await axios.get<{ success: boolean; data: FormularioPublico }>(
      `${API_URL}/public/formularios/${encodeURIComponent(slug)}`
    );
    return r.data;
  },

  submit: async (slug: string, formData: FormData) => {
    const r = await axios.post<{ success: boolean; message?: string }>(
      `${API_URL}/public/formularios/${encodeURIComponent(slug)}/respostas`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return r.data;
  },
};
