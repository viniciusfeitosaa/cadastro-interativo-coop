import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const STORAGE_PREFIX = 'viva_master_escopo';

export interface MasterEscopoState {
  contratoId: string;
  subgrupoId: string;
  equipeId: string;
}

interface MasterEscopoContextValue extends MasterEscopoState {
  /** true depois de ler localStorage (ou definir vazio para não-master). */
  hydrated: boolean;
  setContratoId: (id: string) => void;
  setSubgrupoId: (id: string) => void;
  setEquipeId: (id: string) => void;
}

const defaultValue: MasterEscopoContextValue = {
  contratoId: '',
  subgrupoId: '',
  equipeId: '',
  hydrated: false,
  setContratoId: () => undefined,
  setSubgrupoId: () => undefined,
  setEquipeId: () => undefined,
};

const MasterEscopoContext = createContext<MasterEscopoContextValue>(defaultValue);

function readPersisted(key: string): MasterEscopoState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<MasterEscopoState>;
    if (!p || typeof p !== 'object') return null;
    return {
      contratoId: typeof p.contratoId === 'string' ? p.contratoId : '',
      subgrupoId: typeof p.subgrupoId === 'string' ? p.subgrupoId : '',
      equipeId: typeof p.equipeId === 'string' ? p.equipeId : '',
    };
  } catch {
    return null;
  }
}

export const MasterEscopoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [contratoId, setContratoIdState] = useState('');
  const [subgrupoId, setSubgrupoIdState] = useState('');
  const [equipeId, setEquipeIdState] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const storageKey = useMemo(() => {
    if (user?.role !== 'MASTER' || !user.tenantId || !user.id) return null;
    return `${STORAGE_PREFIX}:${user.tenantId}:${user.id}`;
  }, [user?.role, user?.tenantId, user?.id]);

  useEffect(() => {
    if (!storageKey) {
      setContratoIdState('');
      setSubgrupoIdState('');
      setEquipeIdState('');
      setHydrated(true);
      return;
    }
    const p = readPersisted(storageKey);
    if (p) {
      setContratoIdState(p.contratoId);
      setSubgrupoIdState(p.subgrupoId);
      setEquipeIdState(p.equipeId);
    } else {
      setContratoIdState('');
      setSubgrupoIdState('');
      setEquipeIdState('');
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ contratoId, subgrupoId, equipeId }));
    } catch {
      /* ignore quota */
    }
  }, [contratoId, subgrupoId, equipeId, hydrated, storageKey]);

  const setContratoId = useCallback((id: string) => {
    setContratoIdState(id);
    setSubgrupoIdState('');
    setEquipeIdState('');
  }, []);

  const setSubgrupoId = useCallback((id: string) => {
    setSubgrupoIdState(id);
    setEquipeIdState('');
  }, []);

  const setEquipeId = useCallback((id: string) => {
    setEquipeIdState(id);
  }, []);

  const value = useMemo<MasterEscopoContextValue>(
    () => ({
      contratoId,
      subgrupoId,
      equipeId,
      hydrated,
      setContratoId,
      setSubgrupoId,
      setEquipeId,
    }),
    [contratoId, subgrupoId, equipeId, hydrated, setContratoId, setSubgrupoId, setEquipeId]
  );

  return <MasterEscopoContext.Provider value={value}>{children}</MasterEscopoContext.Provider>;
};

export function useMasterEscopo(): MasterEscopoContextValue {
  return useContext(MasterEscopoContext);
}
