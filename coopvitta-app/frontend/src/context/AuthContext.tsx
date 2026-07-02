import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, LoginCredentials } from '../services/auth.service';
import { queryClient } from '../lib/queryClient';
import { decodeJwtPayloadUnsafe } from '../utils/jwtPayload';

/** Alinha role ao access token (fonte de verdade na sessão) e normaliza strings legadas. */
function mergeRoleFromAccessToken(user: User): User {
  let next = { ...user };
  const raw = String(next.role ?? '').toUpperCase();
  if (raw === 'MEDICO' || raw === 'MASTER') {
    next.role = raw as User['role'];
  }
  const token = localStorage.getItem('accessToken');
  if (!token) return next;
  const payload = decodeJwtPayloadUnsafe<{ role?: string; id?: string }>(token);
  if (!payload?.id || payload.id !== next.id) return next;
  const r = payload.role;
  if (r === 'MEDICO' || r === 'MASTER') {
    next = { ...next, role: r };
  }
  return next;
}

interface User {
  id: string;
  role: 'MASTER' | 'MEDICO';
  tenantId: string;
  nomeCompleto: string;
  profissao?: string;
  crm?: string | null;
  email: string | null;
  especialidades?: string[];
  vinculo?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  introPlayed: boolean;
  setIntroPlayed: (played: boolean) => void;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const fallbackAuthContext: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  introPlayed: false,
  setIntroPlayed: () => undefined,
  login: async () => {
    throw new Error('AuthProvider indisponível no momento');
  },
  logout: () => undefined,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [introPlayed, setIntroPlayed] = useState(false);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          if (!Array.isArray(parsed.especialidades) && parsed.especialidade != null) {
            parsed.especialidades = parsed.especialidade ? [parsed.especialidade] : [];
          }
          if (!Array.isArray(parsed.especialidades)) parsed.especialidades = [];
          setUser(mergeRoleFromAccessToken(parsed as User));
        }
      }
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);
      
      if (response.success && response.data) {
        const userData = response.data.medico || response.data.user;
        if (!userData) {
          throw new Error('Resposta de login sem dados de usuário');
        }

        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        const merged = mergeRoleFromAccessToken(userData as User);
        localStorage.setItem('user', JSON.stringify(merged));
        // Evita flash de dados do usuário anterior (React Query cache)
        queryClient.clear();
        setUser(merged);
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    queryClient.clear();
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    authService.logout();
    setUser(null);
    setIntroPlayed(false); // Reseta a intro ao sair
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        introPlayed,
        setIntroPlayed,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    if (import.meta.env.DEV) {
      // Em hot reload o contexto pode ficar undefined por um instante; retorna fallback sem logar.
      return fallbackAuthContext;
    }
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
