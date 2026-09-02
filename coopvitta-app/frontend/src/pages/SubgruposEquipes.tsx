import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMasterEscopo } from '../context/MasterEscopoContext';
import { useModuloNivel } from '../hooks/useModuloNivel';
import { adminService, type AdminMedico } from '../services/admin.service';
import { notify } from '../lib/notificationEmitter';

const SubgruposEquipes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isMaster = user?.role === 'MASTER';
  const { canEdit: podeEditarEscalas } = useModuloNivel('ESCALAS');
  const {
    contratoId: selectedContratoId,
    subgrupoId: selectedSubgrupoId,
    equipeId: selectedEquipeId,
    setContratoId: setSelectedContratoId,
    setSubgrupoId: setSelectedSubgrupoId,
    setEquipeId: setSelectedEquipeId,
  } = useMasterEscopo();
  const [subgrupoNome, setSubgrupoNome] = useState('');
  const [equipeNome, setEquipeNome] = useState('');
  const [membrosEquipeBusca, setMembrosEquipeBusca] = useState('');
  const [membrosNaEquipeBusca, setMembrosNaEquipeBusca] = useState('');
  const [membrosEquipePickIds, setMembrosEquipePickIds] = useState<string[]>([]);
  const [membrosEquipeError, setMembrosEquipeError] = useState<string | null>(null);
  const [membrosEquipeActionLoading, setMembrosEquipeActionLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [novaEscalaNome, setNovaEscalaNome] = useState('');
  const [confirmExcluir, setConfirmExcluir] = useState<{ tipo: 'subgrupo' | 'equipe' | 'escala'; id: string; nome: string } | null>(null);
  const [editEscala, setEditEscala] = useState<{ id: string; nome: string } | null>(null);
  const [editEscalaNome, setEditEscalaNome] = useState('');
  const [producaoSubgrupoDraft, setProducaoSubgrupoDraft] = useState<{ usaEscala: boolean; usaPonto: boolean }>({
    usaEscala: true,
    usaPonto: true,
  });

  const estiloProducaoSelecionado = useMemo(() => {
    if (producaoSubgrupoDraft.usaEscala && producaoSubgrupoDraft.usaPonto) return 'ESCALA_E_PONTO' as const;
    if (producaoSubgrupoDraft.usaEscala && !producaoSubgrupoDraft.usaPonto) return 'SOMENTE_ESCALA' as const;
    return 'SOMENTE_PONTO' as const;
  }, [producaoSubgrupoDraft]);

  /** Ao vir da página Escalas pelo link "Ir para Subgrupos e Equipes" ou "Criar escala e vincular", pré-selecionar subgrupo e/ou equipe. */
  useEffect(() => {
    const state = location.state as { subgrupoId?: string; equipeId?: string } | null;
    if (!state) return;
    if (state.subgrupoId && typeof state.subgrupoId === 'string') {
      setSelectedSubgrupoId(state.subgrupoId);
    }
    if (state.equipeId && typeof state.equipeId === 'string') {
      setSelectedEquipeId(state.equipeId);
    }
  }, [location.state, setSelectedEquipeId, setSelectedSubgrupoId]);

  const { data: contratosAtivosResp } = useQuery({
    queryKey: ['admin', 'contratos-ativos', 'subgrupos-equipes'],
    queryFn: () => adminService.listContratosAtivos({ page: 1, limit: 200 }),
    enabled: isMaster,
  });
  const { data: equipeEscalasResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId ?? '', 'escalas'],
    queryFn: () => adminService.listEscalasByEquipe(selectedEquipeId!),
    enabled: isMaster && !!selectedEquipeId,
  });
  const { data: medicosResp, isFetching: loadingMedicosLista } = useQuery({
    queryKey: ['admin', 'medicos', 'for-subgrupos'],
    queryFn: () => adminService.listMedicos({ page: 1, limit: 2000, ativo: true }),
    enabled: isMaster,
  });
  const { data: subgruposResp } = useQuery({
    queryKey: ['admin', 'subgrupos'],
    queryFn: () => adminService.listSubgrupos(),
    enabled: isMaster,
  });
  const { data: equipesResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedSubgrupoId || 'todos'],
    queryFn: () => adminService.listEquipes(selectedSubgrupoId ? { subgrupoId: selectedSubgrupoId } : undefined),
    enabled: isMaster,
  });
  const { data: equipeMedicosResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId, 'medicos'],
    queryFn: () => adminService.listEquipeMedicos(selectedEquipeId),
    enabled: isMaster && !!selectedEquipeId,
  });

  const contratosAtivos = useMemo(() => contratosAtivosResp?.data || [], [contratosAtivosResp]);
  const medicos = useMemo(() => medicosResp?.data || [], [medicosResp]);
  const subgrupos = useMemo(() => subgruposResp?.data || [], [subgruposResp]);
  const equipes = useMemo(() => equipesResp?.data || [], [equipesResp]);
  const equipeMedicos = useMemo(() => equipeMedicosResp?.data || [], [equipeMedicosResp]);
  const equipeMedicosFiltradosNaLista = useMemo(() => {
    const q = membrosNaEquipeBusca.trim().toLowerCase();
    if (!q) return equipeMedicos;
    return equipeMedicos.filter((a: { medico?: { nomeCompleto?: string; crm?: string | null } }) => {
      const nome = (a.medico?.nomeCompleto ?? '').toLowerCase();
      const crm = (a.medico?.crm ?? '').toLowerCase();
      return nome.includes(q) || crm.includes(q);
    });
  }, [equipeMedicos, membrosNaEquipeBusca]);
  const equipeEscalas = useMemo(() => equipeEscalasResp?.data || [], [equipeEscalasResp]);
  const idsNaEquipe = useMemo(
    () => new Set(equipeMedicos.map((a: { medicoId: string }) => a.medicoId)),
    [equipeMedicos]
  );
  const medicosDisponiveis = useMemo(() => {
    const q = membrosEquipeBusca.trim().toLowerCase();
    return medicos.filter((m: AdminMedico) => {
      if (idsNaEquipe.has(m.id)) return false;
      if (!q) return true;
      const nome = (m.nomeCompleto ?? '').toLowerCase();
      const crm = (m.crm ?? '').toLowerCase();
      return nome.includes(q) || crm.includes(q);
    });
  }, [medicos, idsNaEquipe, membrosEquipeBusca]);
  /** Subgrupos do contrato selecionado (quando há contrato). */
  const subgruposDoContrato = useMemo(() => {
    if (!selectedContratoId) return subgrupos;
    return subgrupos.filter((s) =>
      (s.contratoSubgrupos ?? []).some(
        (cs: { contratoAtivo?: { id: string } }) => cs.contratoAtivo?.id === selectedContratoId
      )
    );
  }, [subgrupos, selectedContratoId]);

  /** Ao vir com subgrupoId no state, definir contrato do subgrupo para exibir no bloco 1. */
  useEffect(() => {
    if (!subgrupos.length || selectedContratoId) return;
    const state = location.state as { subgrupoId?: string } | null;
    const subgrupoId = state?.subgrupoId;
    if (!subgrupoId) return;
    const subgrupo = subgrupos.find((s) => s.id === subgrupoId);
    const contratoId = (subgrupo?.contratoSubgrupos ?? [])[0]?.contratoAtivo?.id;
    if (contratoId) setSelectedContratoId(contratoId);
  }, [subgrupos, location.state, selectedContratoId, setSelectedContratoId]);

  useEffect(() => {
    setMembrosEquipePickIds([]);
    setMembrosEquipeBusca('');
    setMembrosNaEquipeBusca('');
    setMembrosEquipeError(null);
  }, [selectedEquipeId]);

  const invalidateSubgrupos = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'subgrupos'] });
    if (selectedSubgrupoId) queryClient.invalidateQueries({ queryKey: ['admin', 'subgrupos', selectedSubgrupoId, 'medicos'] });
  };
  const invalidateEquipes = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'equipes'] });
    if (selectedEquipeId) {
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipes', selectedEquipeId, 'medicos'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipes', selectedEquipeId, 'escalas'] });
    }
  };
  const invalidateEscalas = () => queryClient.invalidateQueries({ queryKey: ['admin', 'escalas'] });
  const invalidateEscalasDaEquipe = async () => {
    await invalidateEscalas();
    await invalidateEquipes();
  };
  const selectedSubgrupo = useMemo(() => subgrupos.find((s) => s.id === selectedSubgrupoId), [subgrupos, selectedSubgrupoId]);

  useEffect(() => {
    const s = subgrupos.find((x) => x.id === selectedSubgrupoId);
    if (!s) return;
    setProducaoSubgrupoDraft({
      usaEscala: s.usaEscala !== false,
      usaPonto: s.usaPonto !== false,
    });
  }, [selectedSubgrupoId, subgrupos]);

  /** Contrato (no escopo atual) para criar escala quando o subgrupo usa plantões. */
  const contratoEscalaDoSubgrupo = useMemo(() => {
    if (!selectedSubgrupo?.usaEscala) return '';
    const list = selectedSubgrupo?.contratoSubgrupos ?? [];
    const match = list.find((c: { contratoAtivo?: { id: string } }) => c.contratoAtivo?.id === selectedContratoId);
    return match?.contratoAtivo?.id ?? list[0]?.contratoAtivo?.id ?? '';
  }, [selectedSubgrupo, selectedContratoId]);

  const criarSubgrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = subgrupoNome.trim();
    if (!nome || !selectedContratoId) return;
    setLoadingAction(true);
    try {
      const res = await adminService.createSubgrupo({ nome });
      const created = res as { data?: { id: string } };
      if (created?.data?.id) {
        await adminService.addContratoSubgrupo(selectedContratoId, created.data.id);
        setSubgrupoNome('');
        notify({ kind: 'success', title: 'Subgrupo criado', message: 'Subgrupo associado ao contrato com sucesso.', source: 'subgrupo' });
      }
      await invalidateSubgrupos();
    } catch (err: any) {
      notify({ kind: 'error', title: 'Erro ao criar subgrupo', message: err.response?.data?.error || err.message || 'Tente novamente.', source: 'subgrupo' });
    } finally {
      setLoadingAction(false);
    }
  };
  const criarEquipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = equipeNome.trim();
    if (!nome || !selectedSubgrupoId) return;
    setLoadingAction(true);
    try {
      await adminService.createEquipe({
        nome,
        subgrupoId: selectedSubgrupoId,
      });
      setEquipeNome('');
      await invalidateEquipes();
      notify({ kind: 'success', title: 'Equipe criada', message: 'Equipe vinculada ao subgrupo com sucesso.', source: 'equipe' });
    } catch (err: any) {
      notify({ kind: 'error', title: 'Erro ao criar equipe', message: err.response?.data?.error || err.message || 'Tente novamente.', source: 'equipe' });
    } finally {
      setLoadingAction(false);
    }
  };
  const criarEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = novaEscalaNome.trim();
    if (!nome || !contratoEscalaDoSubgrupo || !selectedSubgrupoId || !selectedEquipeId) return;
    if (equipeEscalas.length > 0) {
      notify({
        kind: 'error',
        title: 'Equipe já tem escala',
        message: 'Cada equipe pode ter apenas uma escala. Exclua a atual para criar outra.',
        source: 'escala',
      });
      return;
    }
    setLoadingAction(true);
    try {
      const ano = new Date().getFullYear();
      const dataInicio = `${ano}-01-01`;
      const dataFim = `${ano + 1}-12-31`;
      const res = await adminService.createEscala({
        contratoAtivoId: contratoEscalaDoSubgrupo,
        nome,
        dataInicio,
        dataFim,
        ativo: false,
      });
      const created = res as { data?: { id: string } };
      if (created?.data?.id) {
        await adminService.addSubgrupoToEscala(created.data.id, selectedSubgrupoId);
        await adminService.addEquipeToEscala(created.data.id, selectedEquipeId);
        setNovaEscalaNome('');
      }
      await invalidateEscalasDaEquipe();
      notify({ kind: 'success', title: 'Escala criada', message: 'Escala criada e vinculada à equipe.', source: 'escala' });
    } catch (err: any) {
      notify({ kind: 'error', title: 'Erro ao criar escala', message: err.response?.data?.error || err.message || 'Tente novamente.', source: 'escala' });
    } finally {
      setLoadingAction(false);
    }
  };
  const toggleMembrosEquipePick = (medicoId: string) => {
    setMembrosEquipePickIds((prev) =>
      prev.includes(medicoId) ? prev.filter((id) => id !== medicoId) : [...prev, medicoId]
    );
  };

  const adicionarMedicoNaEquipeUm = async (medicoId: string) => {
    if (!selectedEquipeId) return;
    setMembrosEquipeError(null);
    setMembrosEquipeActionLoading(true);
    try {
      await adminService.addMedicoToEquipe(selectedEquipeId, medicoId);
      setMembrosEquipePickIds((prev) => prev.filter((id) => id !== medicoId));
      notify({ kind: 'success', title: 'Profissional adicionado', message: 'Profissional incluído na equipe.', source: 'equipe' });
    } catch (err: any) {
      setMembrosEquipeError(err.response?.data?.error || err.message || 'Erro ao adicionar');
      notify({ kind: 'error', title: 'Erro ao adicionar profissional', message: err.response?.data?.error || err.message || 'Tente novamente.', source: 'equipe' });
    } finally {
      setMembrosEquipeActionLoading(false);
    }
    void invalidateEquipes();
  };

  const adicionarMedicosSelecionadosNaEquipe = async () => {
    if (!selectedEquipeId) return;
    const toAdd = [...membrosEquipePickIds];
    if (toAdd.length === 0) return;
    setMembrosEquipeError(null);
    setMembrosEquipeActionLoading(true);
    try {
      for (const medicoId of toAdd) {
        await adminService.addMedicoToEquipe(selectedEquipeId, medicoId);
      }
      setMembrosEquipePickIds([]);
      notify({ kind: 'success', title: 'Profissionais adicionados', message: `${toAdd.length} profissional(is) incluído(s) na equipe.`, source: 'equipe' });
    } catch (err: any) {
      setMembrosEquipeError(err.response?.data?.error || err.message || 'Erro ao adicionar');
      notify({ kind: 'error', title: 'Erro ao adicionar selecionados', message: err.response?.data?.error || err.message || 'Tente novamente.', source: 'equipe' });
    } finally {
      setMembrosEquipeActionLoading(false);
    }
    void invalidateEquipes();
  };

  const removerMedicoDaEquipe = async (medicoId: string) => {
    if (!selectedEquipeId) return;
    setMembrosEquipeError(null);
    setMembrosEquipeActionLoading(true);
    try {
      await adminService.removeMedicoFromEquipe(selectedEquipeId, medicoId);
      setMembrosEquipePickIds((prev) => prev.filter((id) => id !== medicoId));
      notify({ kind: 'success', title: 'Profissional removido', message: 'Profissional removido da equipe.', source: 'equipe' });
    } catch (err: any) {
      setMembrosEquipeError(err.response?.data?.error || err.message || 'Erro ao remover');
      notify({ kind: 'error', title: 'Erro ao remover profissional', message: err.response?.data?.error || err.message || 'Tente novamente.', source: 'equipe' });
    } finally {
      setMembrosEquipeActionLoading(false);
    }
    void invalidateEquipes();
  };
  const openConfirmExcluirSubgrupo = (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    setConfirmExcluir({ tipo: 'subgrupo', id, nome });
  };
  const openConfirmExcluirEquipe = (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    setConfirmExcluir({ tipo: 'equipe', id, nome });
  };
  const openConfirmExcluirEscala = (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    setConfirmExcluir({ tipo: 'escala', id, nome });
  };
  const openEditEscala = (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    setEditEscala({ id, nome });
    setEditEscalaNome(nome);
  };
  const closeEditEscala = () => {
    setEditEscala(null);
    setEditEscalaNome('');
  };
  const salvarEdicaoEscala = async () => {
    if (!editEscala) return;
    const nome = editEscalaNome.trim();
    if (!nome || nome === editEscala.nome) {
      closeEditEscala();
      return;
    }
    setLoadingAction(true);
    try {
      await adminService.updateEscala(editEscala.id, { nome });
      await invalidateEscalasDaEquipe();
      closeEditEscala();
    } finally {
      setLoadingAction(false);
    }
  };
  const closeConfirmExcluir = () => setConfirmExcluir(null);
  const executarExcluir = async () => {
    if (!confirmExcluir) return;
    const { tipo, id } = confirmExcluir;
    setLoadingAction(true);
    try {
      if (tipo === 'subgrupo') {
        await adminService.deleteSubgrupo(id);
        if (selectedSubgrupoId === id) setSelectedSubgrupoId('');
        queryClient.removeQueries({ queryKey: ['admin', 'subgrupos', id, 'medicos'] });
        await invalidateSubgrupos();
      } else {
        if (tipo === 'equipe') {
          await adminService.deleteEquipe(id);
          if (selectedEquipeId === id) setSelectedEquipeId('');
          queryClient.removeQueries({ queryKey: ['admin', 'equipes', id, 'medicos'] });
          await invalidateEquipes();
        } else {
          await adminService.deleteEscala(id);
          await invalidateEscalasDaEquipe();
        }
      }
      setConfirmExcluir(null);
    } finally {
      setLoadingAction(false);
    }
  };

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-coop-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Somente o perfil Master pode gerenciar subgrupos e equipes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-coop-500">
        <h2 className="text-2xl font-bold text-coop-900 mb-1">Subgrupos e Equipes</h2>
        <p className="text-gray-600">
          Crie na ordem: contrato → subgrupo (já associado ao contrato) → equipe (já associada ao subgrupo) → escala (já associada à equipe).{' '}
          <Link to="/escalas" className="text-coop-600 hover:underline font-medium">Ir para Escalas</Link>
        </p>
      </div>

      {/* 1. Contrato e subgrupos */}
      <div className="card">
        <h3 className="text-lg font-bold text-coop-900 mb-2">1. Contrato e subgrupos</h3>
        <p className="text-sm text-gray-600 mb-4">Selecione o contrato e crie subgrupos já vinculados a ele.</p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-coop-800 mb-1">Contrato</label>
          <select
            className="input max-w-md"
            value={selectedContratoId}
            onChange={(e) => { setSelectedContratoId(e.target.value); setSelectedSubgrupoId(''); setSelectedEquipeId(''); }}
          >
            <option value="">Selecionar contrato</option>
            {contratosAtivos.map((c: { id: string; nome: string }) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        {selectedContratoId && (
          <>
            {podeEditarEscalas ? (
              <form onSubmit={criarSubgrupo} className="flex flex-wrap items-end gap-2 mb-3">
                <div className="min-w-[200px]">
                  <label className="block text-sm font-medium text-coop-800 mb-1">Novo subgrupo</label>
                  <input className="input w-full" placeholder="Nome do subgrupo" value={subgrupoNome} onChange={(e) => setSubgrupoNome(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loadingAction}>Criar subgrupo</button>
              </form>
            ) : (
              <p className="text-sm text-coop-600 font-serif mb-3">Somente leitura — sem permissão para criar subgrupos.</p>
            )}
            <div className="space-y-2 max-h-48 overflow-auto">
              {subgruposDoContrato.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum subgrupo neste contrato ainda.</p>
              ) : (
                subgruposDoContrato.map((s) => (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    className={`w-full text-left border rounded-lg p-2 flex items-center justify-between gap-2 ${selectedSubgrupoId === s.id ? 'border-coop-900 bg-coop-50' : 'border-coop-200'} cursor-pointer hover:bg-coop-50/50`}
                    onClick={() => { setSelectedSubgrupoId(s.id); setSelectedEquipeId(''); }}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-coop-900">{s.nome}</p>
                      <p className="text-xs text-gray-600">
                        Equipes: {s._count?.equipes ?? 0}
                        {s.usaEscala !== false && s.usaPonto !== false
                          ? ' · Escala + ponto'
                          : s.usaEscala !== false
                            ? ' · Só escala'
                            : s.usaPonto !== false
                              ? ' · Só ponto'
                              : ''}
                      </p>
                    </div>
                    {podeEditarEscalas && (
                      <button type="button" className="btn btn-secondary shrink-0" onClick={(e) => openConfirmExcluirSubgrupo(e, s.id, s.nome)} disabled={loadingAction}>Excluir</button>
                    )}
                  </div>
                ))
              )}
            </div>
            {selectedSubgrupoId && selectedSubgrupo && (
              <div className="mt-4 rounded-lg border border-coop-200 bg-coop-50/40 p-3 space-y-3">
                <p className="text-sm font-semibold text-coop-900">Estilo de produção — {selectedSubgrupo.nome}</p>
                <p className="text-xs text-gray-600">
                  Define se este subgrupo usa grade de plantões na escala e/ou ponto eletrônico (independente de outros
                  subgrupos do mesmo contrato).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label className="flex items-start gap-2 text-sm text-coop-900 rounded-lg border border-coop-200 bg-white p-2">
                    <input
                      type="radio"
                      name="estilo-producao-subgrupo"
                      checked={estiloProducaoSelecionado === 'ESCALA_E_PONTO'}
                      onChange={() => setProducaoSubgrupoDraft({ usaEscala: true, usaPonto: true })}
                      disabled={loadingAction || !podeEditarEscalas}
                    />
                    <span>
                      <span className="font-semibold">Escala + ponto</span>
                      <span className="block text-xs text-coop-600">Usa grade de plantões e ponto eletrônico.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-coop-900 rounded-lg border border-coop-200 bg-white p-2">
                    <input
                      type="radio"
                      name="estilo-producao-subgrupo"
                      checked={estiloProducaoSelecionado === 'SOMENTE_ESCALA'}
                      onChange={() => setProducaoSubgrupoDraft({ usaEscala: true, usaPonto: false })}
                      disabled={loadingAction || !podeEditarEscalas}
                    />
                    <span>
                      <span className="font-semibold">Somente escala</span>
                      <span className="block text-xs text-coop-600">Usa só grade de plantões, sem ponto eletrônico.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-coop-900 rounded-lg border border-coop-200 bg-white p-2">
                    <input
                      type="radio"
                      name="estilo-producao-subgrupo"
                      checked={estiloProducaoSelecionado === 'SOMENTE_PONTO'}
                      onChange={() => setProducaoSubgrupoDraft({ usaEscala: false, usaPonto: true })}
                      disabled={loadingAction || !podeEditarEscalas}
                    />
                    <span>
                      <span className="font-semibold">Somente ponto</span>
                      <span className="block text-xs text-coop-600">Usa apenas ponto eletrônico (sem grade).</span>
                    </span>
                  </label>
                </div>
                {podeEditarEscalas && (
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  disabled={loadingAction}
                  onClick={async () => {
                    if (!selectedSubgrupoId) return;
                    setLoadingAction(true);
                    try {
                      await adminService.updateSubgrupo(selectedSubgrupoId, {
                        usaEscala: producaoSubgrupoDraft.usaEscala,
                        usaPonto: producaoSubgrupoDraft.usaPonto,
                      });
                      await invalidateSubgrupos();
                      notify({
                        kind: 'success',
                        title: 'Subgrupo',
                        message: 'Estilo de produção atualizado.',
                        source: 'subgrupo',
                      });
                    } catch (err: any) {
                      notify({
                        kind: 'error',
                        title: 'Erro',
                        message: err.response?.data?.error || err.message || 'Tente novamente.',
                        source: 'subgrupo',
                      });
                    } finally {
                      setLoadingAction(false);
                    }
                  }}
                >
                  Salvar estilo
                </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 2. Equipes do subgrupo */}
      <div className="card overflow-hidden p-0">
        <h3 className="sticky top-0 px-4 py-3 bg-white border-b border-coop-100 text-lg font-bold text-coop-800 shadow-sm z-10">
          2. Equipes do subgrupo
        </h3>
        <div className="p-4">
        {!selectedSubgrupoId ? (
          <p className="text-sm text-coop-700 font-serif">Selecione um contrato e um subgrupo acima para criar equipes já vinculadas a esse subgrupo.</p>
        ) : (
          <>
            <p className="text-sm text-coop-600 mb-3 font-serif">Subgrupo selecionado: <strong className="text-coop-900">{selectedSubgrupo?.nome}</strong>. {podeEditarEscalas ? 'Crie equipes já vinculadas a ele.' : 'Visualização somente leitura.'}</p>
            {podeEditarEscalas ? (
              <form onSubmit={criarEquipe} className="flex flex-wrap items-end gap-2 mb-4">
                <div className="min-w-[200px] flex-1">
                  <label className="block text-sm font-medium text-coop-800 mb-1">Nova equipe</label>
                  <input className="input w-full" placeholder="Nome da equipe" value={equipeNome} onChange={(e) => setEquipeNome(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loadingAction}>Criar equipe</button>
              </form>
            ) : null}
            <div className="rounded-xl border border-coop-100 overflow-hidden bg-white mb-4">
              <h4 className="px-4 py-2.5 bg-coop-50/80 border-b border-coop-100 text-sm font-bold text-coop-800">
                Equipes de {selectedSubgrupo?.nome}
              </h4>
              <div className="flex flex-col gap-0 max-h-48 overflow-y-auto p-2">
              {equipes.length === 0 ? (
                <p className="text-sm text-coop-600 px-2 py-3 font-serif">Nenhuma equipe neste subgrupo ainda.</p>
              ) : (
                equipes.map((equipe: { id: string; nome: string; _count?: { equipeMedicos: number; escalaEquipes: number } }) => {
                  const isSelected = selectedEquipeId === equipe.id;
                  const medicosCount = isSelected ? equipeMedicos.length : (equipe._count?.equipeMedicos ?? 0);
                  const escalasCount = isSelected
                    ? (equipeEscalasResp != null ? equipeEscalas.length : (equipe._count?.escalaEquipes ?? 0))
                    : (equipe._count?.escalaEquipes ?? 0);
                  return (
                  <div
                    key={equipe.id}
                    className={`flex items-stretch gap-2 p-3 rounded-lg w-full transition border-b border-coop-100 last:border-b-0 ${isSelected ? 'bg-coop-100 ring-2 ring-coop-500/30' : 'hover:bg-coop-50/80'}`}
                  >
                    <button
                      type="button"
                      className="flex items-stretch gap-2 flex-1 min-w-0 text-left"
                      onClick={() => setSelectedEquipeId(equipe.id)}
                    >
                      <div className="w-1.5 rounded-md bg-coop-500 flex-shrink-0 self-stretch" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-coop-900 truncate">{equipe.nome}</p>
                        <p className="text-sm text-coop-600">{medicosCount} médico(s) · {escalasCount} escala(s)</p>
                      </div>
                    </button>
                    {podeEditarEscalas && (
                      <button type="button" className="btn btn-secondary shrink-0 self-center text-xs" onClick={(e) => openConfirmExcluirEquipe(e, equipe.id, equipe.nome)} disabled={loadingAction}>Excluir</button>
                    )}
                  </div>
                  );
                })
              )}
              </div>
            </div>
            {selectedEquipeId && (
              <div className="rounded-xl border border-coop-100 overflow-hidden bg-white">
                <h4 className="px-4 py-2.5 bg-coop-50/80 border-b border-coop-100 text-sm font-bold text-coop-800">
                  Associados da equipe
                </h4>
                <div className="p-4">
                <div className="mb-4 pb-4 border-b border-coop-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-coop-600 mb-2">Adicionar profissionais</p>
                  {!podeEditarEscalas ? (
                    <p className="text-sm text-coop-600 font-serif">Somente leitura — sem permissão para alterar membros.</p>
                  ) : (
                  <>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm mb-2"
                    placeholder="Buscar por nome ou CRM…"
                    value={membrosEquipeBusca}
                    onChange={(e) => setMembrosEquipeBusca(e.target.value)}
                    disabled={membrosEquipeActionLoading}
                    autoComplete="off"
                  />
                  {membrosEquipeError && (
                    <p className="text-xs text-red-600 font-medium mb-2">{membrosEquipeError}</p>
                  )}
                  {loadingMedicosLista && medicos.length === 0 ? (
                    <p className="text-sm text-coop-600 py-2">Carregando profissionais…</p>
                  ) : medicosDisponiveis.length === 0 ? (
                    <p className="text-sm text-gray-500 py-1">
                      {medicos.length === 0 && !loadingMedicosLista
                        ? 'Não foi possível carregar a lista de médicos.'
                        : 'Nenhum profissional disponível: todos já estão na equipe ou a busca não encontrou resultados.'}
                    </p>
                  ) : (
                    <>
                      <ul className="max-h-44 overflow-y-auto space-y-1 rounded-lg border border-coop-200 bg-coop-50/50 p-1.5">
                        {medicosDisponiveis.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-white border border-transparent hover:border-coop-100"
                          >
                            <input
                              type="checkbox"
                              className="rounded border-coop-300 text-coop-600 focus:ring-coop-500 shrink-0"
                              checked={membrosEquipePickIds.includes(m.id)}
                              onChange={() => toggleMembrosEquipePick(m.id)}
                              disabled={membrosEquipeActionLoading}
                              aria-label={`Selecionar ${m.nomeCompleto}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-coop-900 text-sm truncate">{m.nomeCompleto}</p>
                              {m.crm ? <p className="text-xs text-coop-600">CRM: {m.crm}</p> : null}
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary text-xs py-1 px-2 shrink-0"
                              disabled={membrosEquipeActionLoading}
                              onClick={() => adicionarMedicoNaEquipeUm(m.id)}
                            >
                              Adicionar
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="btn btn-primary text-sm w-full mt-2"
                        disabled={membrosEquipePickIds.length === 0 || membrosEquipeActionLoading}
                        onClick={adicionarMedicosSelecionadosNaEquipe}
                      >
                        {membrosEquipeActionLoading
                          ? 'Aplicando…'
                          : `Adicionar selecionados (${membrosEquipePickIds.length})`}
                      </button>
                    </>
                  )}
                  </>
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-coop-600 mb-2">Na equipe</p>
                {equipeMedicos.length === 0 ? (
                  <p className="text-sm text-coop-600 font-serif">Nenhum profissional vinculado a esta equipe.</p>
                ) : (
                  <>
                    <label htmlFor="busca-membros-na-equipe" className="sr-only">
                      Pesquisar profissionais já na equipe por nome ou CRM
                    </label>
                    <input
                      id="busca-membros-na-equipe"
                      type="search"
                      className="input w-full text-sm mb-2"
                      placeholder="Pesquisar na lista (nome ou CRM)…"
                      value={membrosNaEquipeBusca}
                      onChange={(e) => setMembrosNaEquipeBusca(e.target.value)}
                      disabled={membrosEquipeActionLoading}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {equipeMedicosFiltradosNaLista.length === 0 ? (
                      <p className="text-sm text-coop-600 font-serif">Nenhum resultado para a pesquisa.</p>
                    ) : (
                      <ul className="flex flex-col gap-0 max-h-[min(50vh,360px)] overflow-y-auto">
                        {equipeMedicosFiltradosNaLista.map(
                          (a: { id: string; medicoId: string; medico?: { nomeCompleto: string; crm?: string | null } }) => (
                            <li
                              key={a.id}
                              className="flex items-stretch gap-2 p-3 rounded-lg border-b border-coop-100 last:border-b-0 hover:bg-coop-50/80"
                            >
                              <div className="w-1.5 rounded-md bg-coop-500 flex-shrink-0 self-stretch" />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-coop-900 text-sm truncate">{a.medico?.nomeCompleto ?? '—'}</p>
                                {a.medico?.crm ? <p className="text-xs text-coop-600">CRM: {a.medico.crm}</p> : null}
                              </div>
                              {podeEditarEscalas && (
                                <button
                                  type="button"
                                  className="btn btn-secondary text-xs shrink-0 self-center"
                                  disabled={membrosEquipeActionLoading}
                                  onClick={() => removerMedicoDaEquipe(a.medicoId)}
                                >
                                  Remover
                                </button>
                              )}
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </>
                )}
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {/* 3. Escala da equipe */}
      <div className="card overflow-hidden p-0">
        <h3 className="sticky top-0 px-4 py-3 bg-white border-b border-coop-100 text-lg font-bold text-coop-800 shadow-sm z-10">
          3. Escala da equipe
        </h3>
        <div className="p-4">
        {!selectedEquipeId || !contratoEscalaDoSubgrupo ? (
          <p className="text-sm text-coop-700 font-serif">Selecione uma equipe (cujo subgrupo tenha contrato com escala) acima para criar uma escala já vinculada a essa equipe e ao subgrupo.</p>
        ) : (
          <>
            <p className="text-sm text-coop-600 mb-3 font-serif">
              Equipe selecionada:{' '}
              <strong className="text-coop-900">
                {equipes.find((e: { id: string; nome: string }) => e.id === selectedEquipeId)?.nome}
              </strong>
              . Cada equipe tem no máximo uma escala — depois de criada, só editar ou excluir (ao excluir, pode criar outra).
            </p>
            {equipeEscalas.length === 0 ? (
              podeEditarEscalas ? (
              <form onSubmit={criarEscala} className="flex flex-wrap items-end gap-2 mb-4">
                <div className="min-w-[200px] flex-1">
                  <label className="block text-sm font-medium text-coop-800 mb-1">Escala da equipe</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Ex: UPA Bom Jardim - Chefe de Equipe"
                    value={novaEscalaNome}
                    onChange={(e) => setNovaEscalaNome(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loadingAction}>Criar escala</button>
              </form>
              ) : (
                <p className="text-sm text-coop-600 font-serif">Somente leitura — sem permissão para criar escala.</p>
              )
            ) : (
              <div className="rounded-xl border border-coop-100 overflow-hidden bg-white">
                <h4 className="px-4 py-2.5 bg-coop-50/80 border-b border-coop-100 text-sm font-bold text-coop-800">
                  Escala desta equipe
                </h4>
                <div className="flex flex-col gap-0 p-2">
                  {equipeEscalas.slice(0, 1).map((esc: { id: string; nome: string }) => (
                    <div
                      key={esc.id}
                      className="flex items-stretch gap-2 p-3 rounded-lg w-full hover:bg-coop-50/80"
                    >
                      <div className="w-1.5 rounded-md bg-coop-500 flex-shrink-0 self-stretch" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-coop-900 truncate">{esc.nome}</p>
                        <p className="text-sm text-coop-600">{selectedSubgrupo?.nome ?? 'Subgrupo'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-center flex-wrap justify-end">
                        {podeEditarEscalas && (
                          <>
                            <button
                              type="button"
                              className="text-sm text-coop-700 hover:underline font-medium"
                              onClick={(e) => openEditEscala(e, esc.id, esc.nome)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-sm text-red-700 hover:underline font-medium"
                              onClick={(e) => openConfirmExcluirEscala(e, esc.id, esc.nome)}
                              disabled={loadingAction}
                            >
                              Excluir
                            </button>
                          </>
                        )}
                        <Link to="/escalas" state={{ escalaId: esc.id }} className="text-sm text-coop-600 hover:underline font-medium">Abrir</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {confirmExcluir && podeEditarEscalas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeConfirmExcluir}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-coop-900 mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-gray-600 mb-4">
              {confirmExcluir.tipo === 'subgrupo'
                ? `Excluir o subgrupo "${confirmExcluir.nome}"? Esta ação não pode ser desfeita.`
                : confirmExcluir.tipo === 'equipe'
                  ? `Excluir a equipe "${confirmExcluir.nome}"? Esta ação não pode ser desfeita.`
                  : `Excluir a escala "${confirmExcluir.nome}"? Esta ação não pode ser desfeita.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-secondary" onClick={closeConfirmExcluir} disabled={loadingAction}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary bg-red-600 hover:bg-red-700" onClick={executarExcluir} disabled={loadingAction}>
                {loadingAction ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
      {editEscala && podeEditarEscalas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeEditEscala}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-coop-900 mb-2">Editar escala</h3>
            <p className="text-sm text-gray-600 mb-3">Atualize o nome da escala selecionada.</p>
            <input
              type="text"
              className="input w-full"
              value={editEscalaNome}
              onChange={(e) => setEditEscalaNome(e.target.value)}
              placeholder="Nome da escala"
              autoFocus
            />
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" className="btn btn-secondary" onClick={closeEditEscala} disabled={loadingAction}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={salvarEdicaoEscala} disabled={loadingAction}>
                {loadingAction ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubgruposEquipes;
