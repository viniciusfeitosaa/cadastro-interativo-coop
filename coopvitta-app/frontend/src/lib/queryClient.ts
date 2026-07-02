import { QueryClient } from '@tanstack/react-query';

/** Instância única usada no app; importada também no AuthContext para limpar cache ao trocar de sessão. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      /** Listagens admin mudam com pouca frequência; 90s reduz refetch e sensação de lentidão. */
      staleTime: 90 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error: any) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403) return false;
        /** Sem response (ECONNREFUSED, reset, timeout): mais tentativas com backoff — comum em HMR ou API a subir. */
        if (!error?.response) return failureCount < 2;
        if (status != null && status >= 500) return failureCount < 2;
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(800 * 2 ** attemptIndex, 8000),
    },
  },
});
