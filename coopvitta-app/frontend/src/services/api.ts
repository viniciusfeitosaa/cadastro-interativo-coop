import axios from 'axios';
import { notify } from '../lib/notificationEmitter';
import { sanitizeNotificationBody } from '../lib/notificationDisplay';

/** Dev: `/api` passa pelo proxy do Vite → backend :3001. Evita CORS e URL sem sufixo `/api`. */
const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

// Em produção a URL tem de vir de VITE_API_URL (build-time). Docker/VPS: .env na raiz; Netlify: env do site.
if (import.meta.env.PROD && (API_URL.includes('localhost') || !import.meta.env.VITE_API_URL)) {
  console.error(
    '[API] VITE_API_URL em falta ou localhost. VPS/Docker: no .env (raiz) use VITE_API_URL=http://SEU_IP:3001/api (ou domínio), depois docker compose build --no-cache frontend && up -d. Netlify: Environment variables → VITE_API_URL.'
  );
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  },
});

// Interceptor para adicionar token nas requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

function routeLabel(url: string): string | undefined {
  if (url.includes('/ponto/')) return 'ponto';
  if (url.includes('/medico/')) return 'perfil';
  if (url.includes('/admin/')) return 'admin';
  if (url.includes('/auth/')) return 'sessão';
  return undefined;
}

// Interceptor: notificações de sucesso (mutações com message) e falhas graves (rede / 5xx)
api.interceptors.response.use(
  (response) => {
    const url = response.config.url || '';
    if (
      url.includes('/auth/login') ||
      url.includes('/auth/login-medico') ||
      url.includes('/auth/login-master') ||
      url.includes('/auth/refresh') ||
      url.includes('/medico/notificacoes')
    ) {
      return response;
    }
    const method = response.config.method?.toUpperCase() || '';
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return response;
    }
    const data = response.data as { success?: boolean; message?: string } | undefined;
    const msg = data?.message;
    if (typeof msg === 'string' && msg.trim() && data?.success !== false) {
      notify({
        kind: 'success',
        title: 'Concluído',
        message: msg.trim(),
        source: routeLabel(response.config.url || ''),
      });
    }
    return response;
  },
  (error) => {
    const requestUrl = error.config?.url || '';
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
    const isAuthRoute =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/login-medico') ||
      requestUrl.includes('/auth/login-master');

    if (error.response?.status === 401 && !isAuthRoute) {
      // Token expirado ou inválido: limpar user também para evitar loop login → dashboard → 401
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = `${base}/`;
    }
    // Não redirecionar para acesso negado em erros de ponto (ex.: check-in duplo, ponto já fechado)
    const isPontoRoute = requestUrl.includes('/ponto/');
    const status = error.response?.status;
    const isPontoError = isPontoRoute && (status === 403 || status === 404 || status === 409);
    if (status === 403 && !requestUrl.includes('/acesso-negado') && !isPontoError) {
      window.location.href = `${base}/acesso-negado`;
    }

    const skipNotify =
      isAuthRoute ||
      (isPontoError && status && status < 500) ||
      (requestUrl.includes('/ponto/') && status && status < 500) ||
      // Evita loop: falha ao carregar notificações não dispara outro toast de erro
      (requestUrl.includes('/medico/notificacoes') && status && status >= 500);

    if (!skipNotify) {
      if (!error.response) {
        const method = (error.config?.method || 'get').toUpperCase();
        /** GET em paralelo (ex.: React Query) com API offline gerava vários toasts iguais; a UI trata loading/erro. */
        if (method !== 'GET') {
          notify({
            kind: 'error',
            title: 'Conexão',
            message: 'Não foi possível conectar ao servidor. Verifique a internet e tente novamente.',
            source: routeLabel(requestUrl),
          });
        }
      } else if (status && status >= 500) {
        const raw =
          (error.response?.data?.error as string) ||
          (error.response?.data?.message as string) ||
          '';
        notify({
          kind: 'error',
          title: 'Algo deu errado',
          message: sanitizeNotificationBody(typeof raw === 'string' ? raw : String(raw ?? '')),
          source: routeLabel(requestUrl),
        });
      }
    }

    return Promise.reject(error);
  }
);

export default api;
