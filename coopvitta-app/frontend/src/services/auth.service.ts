import api from './api';
import { ModuloSistema } from '../constants/modulos';
import type { DocumentoPerfilField } from '../constants/documentosPerfil';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    medico?: {
      id: string;
      role: 'MASTER' | 'MEDICO';
      tenantId: string;
      nomeCompleto: string;
      profissao?: string;
      crm?: string | null;
      email: string | null;
      especialidades?: string[];
      vinculo?: string | null;
    };
    user?: {
      id: string;
      role: 'MASTER' | 'MEDICO';
      tenantId: string;
      nomeCompleto: string;
      profissao?: string;
      crm?: string | null;
      email: string | null;
      especialidades?: string[];
      vinculo?: string | null;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export interface AcceptInvitePayload {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterPayload {
  nomeCompleto: string;
  email: string;
  cpf: string;
  profissao: string;
  crm?: string;
  especialidades?: string[];
  telefone: string;
  password: string;
  confirmPassword: string;
  estadoCivil?: string;
  enderecoResidencial?: string;
  dadosBancarios?: string;
  chavePix?: string;
  /** Obrigatório no cadastro público (aceite de termos e declaração). */
  aceitouTermos: boolean;
}

export type RegisterDocumentFiles = Partial<Record<DocumentoPerfilField, File>>;

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  acceptInvite: async (payload: AcceptInvitePayload): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/accept-invite', payload);
    return response.data;
  },

  register: async (payload: RegisterPayload, files?: RegisterDocumentFiles) => {
    const hasFile = files && Object.values(files).some((f) => f instanceof File);
    if (!hasFile) {
      const response = await api.post('/auth/register', payload);
      return response.data;
    }
    const fd = new FormData();
    const appendScalar = (key: string, val: string | undefined) => {
      if (val !== undefined && val !== null) fd.append(key, String(val));
    };
    appendScalar('nomeCompleto', payload.nomeCompleto);
    appendScalar('email', payload.email);
    appendScalar('cpf', payload.cpf);
    appendScalar('telefone', payload.telefone);
    appendScalar('profissao', payload.profissao);
    appendScalar('password', payload.password);
    appendScalar('confirmPassword', payload.confirmPassword);
    if (payload.crm !== undefined && payload.crm !== null) {
      fd.append('crm', String(payload.crm).trim());
    }
    if (payload.estadoCivil) appendScalar('estadoCivil', payload.estadoCivil);
    if (payload.enderecoResidencial) appendScalar('enderecoResidencial', payload.enderecoResidencial);
    if (payload.dadosBancarios) appendScalar('dadosBancarios', payload.dadosBancarios);
    if (payload.chavePix) appendScalar('chavePix', payload.chavePix);
    fd.append('aceitouTermos', payload.aceitouTermos ? 'true' : 'false');
    (payload.especialidades || []).forEach((e) => fd.append('especialidades', e));
    Object.entries(files || {}).forEach(([k, file]) => {
      if (file instanceof File) fd.append(k, file);
    });
    // Não usar axios aqui: o cliente global força JSON e o transformRequest pode estragar FormData.
    // fetch deixa o browser definir multipart/form-data com boundary correto.
    const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const url = `${base}/auth/register`;
    const res = await fetch(url, { method: 'POST', body: fd });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = new Error('Request failed') as Error & { response?: { status: number; data: unknown } };
      err.response = { status: res.status, data };
      throw err;
    }
    return data;
  },

  getModulosAcesso: async (): Promise<{
    success: boolean;
    data: {
      perfil: 'MASTER' | 'MEDICO';
      items: Array<{ perfil: 'MASTER' | 'MEDICO'; modulo: ModuloSistema; permitido: boolean }>;
      map: Record<ModuloSistema, boolean>;
    };
  }> => {
    const response = await api.get('/auth/modulos-acesso');
    return response.data;
  },

  esqueciSenha: async (email: string): Promise<{ success: boolean; message: string; resetLink?: string }> => {
    const response = await api.post<{ success: boolean; message: string; resetLink?: string }>(
      '/auth/esqueci-senha',
      { email: email.trim().toLowerCase() }
    );
    return response.data;
  },

  redefinirSenha: async (token: string, novaSenha: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/redefinir-senha', {
      token,
      novaSenha,
      confirmarSenha: novaSenha,
    });
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
