import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import type { ModuloSistema, NivelAcessoModulo } from '../constants/modulos';
import {
  authService,
  canEdit as canEditPerm,
  hasAccess as hasAccessPerm,
  isAdminPleno as isAdminPlenoPerm,
  nivelDeModulo,
} from '../services/auth.service';

/**
 * Nível de acesso ao módulo (`OFF` | `VER` | `EDITAR`), reutilizando a query
 * `['auth', 'modulos-acesso', userId]` do AppShell.
 * Enquanto carrega, assume EDITAR (mesmo padrão do menu: não fecha a UI).
 */
export function useModuloNivel(modulo: ModuloSistema) {
  const { user } = useAuth();
  const { data: modulosAcessoResp, isLoading } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });

  const perms = modulosAcessoResp?.data;
  const loaded = !!modulosAcessoResp;
  const nivel: NivelAcessoModulo = !loaded ? 'EDITAR' : nivelDeModulo(perms, modulo);

  return {
    nivel,
    canEdit: !loaded ? true : canEditPerm(perms, modulo),
    hasAccess: !loaded ? true : hasAccessPerm(perms, modulo),
    isAdminPleno: !loaded ? true : isAdminPlenoPerm(perms),
    isLoading,
    loaded,
  };
}
