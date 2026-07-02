import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useMasterEscopo } from '../context/MasterEscopoContext';
import { PontoEnderecoMapaBlock } from '../components/PontoEnderecoMapaBlock';
import { usePontoEnderecoMapa } from '../hooks/usePontoEnderecoMapa';
import { adminService, ConfigPontoEletronico, TipoPlantaoConfig, ValorPlantaoConfig } from '../services/admin.service';

function formatValor(valor: string | number | null | undefined): string {
  if (valor == null || valor === '') return '';
  const n = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (Number.isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseValorInput(s: string): number | null {
  const v = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

const DIAS_SEMANA = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
] as const;

type DiaKey = (typeof DIAS_SEMANA)[number]['key'];

function buildMapaValorPorDiaComFallback(draft: Record<string, string>): {
  map: Record<string, number | null>;
  fallbackGlobal: number | null;
} {
  const map: Record<string, number | null> = {};
  let fallbackGlobal: number | null = null;
  for (const { key } of DIAS_SEMANA) {
    const raw = draft[key] ?? '';
    if (raw.trim() === '') {
      map[key] = null;
    } else {
      const n = parseValorInput(raw);
      const rounded = n != null ? Math.round(n * 100) / 100 : null;
      map[key] = rounded;
      if (fallbackGlobal == null && rounded != null) fallbackGlobal = rounded;
    }
  }
  return { map, fallbackGlobal };
}

type ValoresPlantaoModo = 'escala_e_ponto' | 'somente_escala';

interface ValoresPlantaoProps {
  modo?: ValoresPlantaoModo;
  titulo?: string;
  descricao?: string;
  exibirLocalizacaoPonto?: boolean;
}

const ValoresPlantao = ({
  modo = 'escala_e_ponto',
  titulo = 'Valores Hora/Plantão',
  descricao = 'Escolha contrato, subgrupo e equipe. Os valores por tipo valem para essa equipe no contrato; o relatório converte em valor/hora usando a duração do turno. Opcional: local do ponto (mesmo escopo da equipe).',
  exibirLocalizacaoPonto = true,
}: ValoresPlantaoProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const { contratoId, subgrupoId, equipeId, setContratoId, setSubgrupoId, setEquipeId } = useMasterEscopo();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftValorHoraPorDia, setDraftValorHoraPorDia] = useState<
    Record<string, Partial<Record<(typeof DIAS_SEMANA)[number]['key'], string>>>
  >({});
  const [draftValorHoraCobrancaPorDia, setDraftValorHoraCobrancaPorDia] = useState<
    Record<string, Partial<Record<(typeof DIAS_SEMANA)[number]['key'], string>>>
  >({});
  const [savingGeo, setSavingGeo] = useState(false);
  const [savedGeo, setSavedGeo] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [novoTipoHi, setNovoTipoHi] = useState('08:00');
  const [novoTipoHf, setNovoTipoHf] = useState('20:00');
  const [novoTipoCruza, setNovoTipoCruza] = useState(false);
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [excluindoTipoId, setExcluindoTipoId] = useState<string | null>(null);
  const [excluirTipoModal, setExcluirTipoModal] = useState<{ id: string; nome: string } | null>(null);
  const [editarTipoModal, setEditarTipoModal] = useState<TipoPlantaoConfig | null>(null);
  const [salvandoEdicaoTipo, setSalvandoEdicaoTipo] = useState(false);

  const { data: opcoesResp, isLoading: loadingOpcoes, isError: erroOpcoes } = useQuery({
    queryKey: ['admin', 'valores-plantao', 'opcoes'],
    queryFn: () => adminService.getValoresPlantaoOpcoes(),
    enabled: !!user && isMaster,
  });

  const opcoes = opcoesResp?.data;
  const contratos = useMemo(() => opcoes?.contratos ?? [], [opcoes]);
  const subgrupos = useMemo(() => opcoes?.subgrupos ?? [], [opcoes]);
  const equipes = useMemo(() => opcoes?.equipes ?? [], [opcoes]);
  const contratoSubgrupos = useMemo(() => opcoes?.contratoSubgrupos ?? [], [opcoes]);
  const contratoEquipes = useMemo(() => opcoes?.contratoEquipes ?? [], [opcoes]);
  const temEscopoCompleto = !!contratoId && !!subgrupoId && !!equipeId;

  const equipeIdsNoContrato = useMemo(() => {
    if (!contratoId) return new Set<string>();
    return new Set(
      contratoEquipes.filter((ce) => ce.contratoAtivoId === contratoId).map((ce) => ce.equipeId)
    );
  }, [contratoId, contratoEquipes]);

  const equipesFiltradas = useMemo(() => {
    if (!subgrupoId) return [];
    const noSub = equipes.filter((e) => e.subgrupoId === subgrupoId && e.ativo !== false);
    if (equipeIdsNoContrato.size === 0) return noSub;
    return noSub.filter((e) => equipeIdsNoContrato.has(e.id));
  }, [equipes, subgrupoId, equipeIdsNoContrato]);

  const allowedSubgrupoIds = useMemo(() => {
    if (!contratoId) return new Set<string>();
    return new Set(
      contratoSubgrupos
        .filter((cs) => cs.contratoAtivoId === contratoId)
        .map((cs) => cs.subgrupoId)
    );
  }, [contratoId, contratoSubgrupos]);

  const subgruposDoContrato = useMemo(() => {
    if (!contratoId) return [];
    const matchModo = (s: { usaEscala?: boolean; usaPonto?: boolean }) => {
      if (modo === 'somente_escala') return Boolean(s.usaEscala && !s.usaPonto);
      return Boolean(s.usaEscala && s.usaPonto);
    };
    return subgrupos
      .filter((s) => s.ativo !== false)
      .filter((s) => allowedSubgrupoIds.has(s.id))
      .filter((s) => {
        const x = s as { usaEscala?: boolean; usaPonto?: boolean };
        return matchModo(x);
      });
  }, [allowedSubgrupoIds, contratoId, modo, subgrupos]);

  const contratoIdsComSubgrupoDoModo = useMemo(() => {
    const subById = new Map(subgrupos.map((s: { id: string; usaEscala?: boolean; usaPonto?: boolean }) => [s.id, s]));
    const ids = new Set<string>();
    const matchModo = (sg?: { usaEscala?: boolean; usaPonto?: boolean }) => {
      if (!sg) return false;
      if (modo === 'somente_escala') return Boolean(sg.usaEscala && !sg.usaPonto);
      return Boolean(sg.usaEscala && sg.usaPonto);
    };
    for (const cs of contratoSubgrupos as { contratoAtivoId: string; subgrupoId: string }[]) {
      const sg = subById.get(cs.subgrupoId) as { usaEscala?: boolean; usaPonto?: boolean } | undefined;
      if (matchModo(sg)) ids.add(cs.contratoAtivoId);
    }
    return ids;
  }, [contratoSubgrupos, modo, subgrupos]);

  const contratosFiltrados = useMemo(
    () => contratos.filter((c: { id: string }) => contratoIdsComSubgrupoDoModo.has(c.id)),
    [contratos, contratoIdsComSubgrupoDoModo]
  );

  const { data: tiposResp, isLoading: loadingTipos, isError: erroTipos } = useQuery({
    queryKey: ['admin', 'tipos-plantao', contratoId],
    queryFn: () => adminService.listTiposPlantao(contratoId),
    enabled: !!user && isMaster && temEscopoCompleto,
  });

  const tiposPlantao = useMemo(() => {
    const arr = [...(tiposResp?.data ?? [])];
    const inicioMin = (t: TipoPlantaoConfig) => {
      const p = t.horaInicio?.slice(0, 5).split(':').map((x) => parseInt(x, 10)) ?? [0, 0];
      const h = Number.isFinite(p[0]) ? p[0] : 0;
      const m = Number.isFinite(p[1]) ? p[1] : 0;
      return h * 60 + m;
    };
    arr.sort((a, b) => {
      const d = inicioMin(a) - inicioMin(b);
      if (d !== 0) return d;
      return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR');
    });
    return arr;
  }, [tiposResp?.data]);

  const { data: resp, isLoading: loadingValores, isError: erroValores } = useQuery({
    queryKey: ['admin', 'valores-plantao', contratoId, subgrupoId, equipeId],
    queryFn: () => adminService.getValoresPlantao(contratoId, subgrupoId, equipeId),
    enabled: !!user && isMaster && temEscopoCompleto,
  });

  const { data: configPontoResp, isLoading: loadingConfigPonto, isError: erroConfigPonto } = useQuery({
    queryKey: ['admin', 'config-ponto', contratoId, subgrupoId, equipeId || null],
    queryFn: () => adminService.getConfigPonto(contratoId, subgrupoId, equipeId || null),
    enabled: !!user && isMaster && temEscopoCompleto,
  });

  const erroApiRede =
    erroOpcoes || (temEscopoCompleto && (erroTipos || erroValores || erroConfigPonto));

  const tentarRecarregarApi = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'valores-plantao'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'tipos-plantao'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'config-ponto'] }),
    ]);
  };

  const valores = resp?.data ?? [];
  const configPonto: ConfigPontoEletronico | null = configPontoResp?.data ?? null;
  const geo = usePontoEnderecoMapa(configPonto);

  useEffect(() => {
    if (!savedGeo) return;
    const t = setTimeout(() => setSavedGeo(false), 2500);
    return () => clearTimeout(t);
  }, [savedGeo]);

  const getValorForGrade = (gradeId: string): string => {
    if (draft[gradeId] !== undefined) return draft[gradeId];
    const row = valores.find((v: ValorPlantaoConfig) => v.gradeId === gradeId);
    if (row?.valorHora != null) return formatValor(row.valorHora);
    return '';
  };

  const getValorHoraForGradeDia = (gradeId: string, diaKey: DiaKey): string => {
    const byGrade = draftValorHoraPorDia[gradeId];
    const v = byGrade?.[diaKey];
    if (v !== undefined) return v;
    const row = valores.find((x: ValorPlantaoConfig) => x.gradeId === gradeId);
    const fromApi = row?.valorHoraPorDia?.[diaKey];
    if (fromApi != null && String(fromApi).trim() !== '') return formatValor(fromApi);
    return getValorForGrade(gradeId);
  };

  const getValorCobrancaForGrade = (gradeId: string): string => {
    // Por enquanto, não temos um draft global de cobrança separado; usa o que vier do backend.
    const row = valores.find((v: ValorPlantaoConfig) => v.gradeId === gradeId);
    if (row?.valorHoraCobranca != null) return formatValor(row.valorHoraCobranca);
    return '';
  };

  const getValorHoraCobrancaForGradeDia = (gradeId: string, diaKey: DiaKey): string => {
    const byGrade = draftValorHoraCobrancaPorDia[gradeId];
    const v = byGrade?.[diaKey];
    if (v !== undefined) return v;
    const row = valores.find((x: ValorPlantaoConfig) => x.gradeId === gradeId);
    const fromApi = row?.valorHoraCobrancaPorDia?.[diaKey];
    if (fromApi != null && String(fromApi).trim() !== '') return formatValor(fromApi);
    return getValorCobrancaForGrade(gradeId);
  };

  const replicarRepasseSegParaSemana = (gradeId: string) => {
    const segVal = getValorHoraForGradeDia(gradeId, 'seg');
    setDraftValorHoraPorDia((prev) => ({
      ...prev,
      [gradeId]: {
        ...(prev[gradeId] ?? {}),
        ter: segVal,
        qua: segVal,
        qui: segVal,
        sex: segVal,
        sab: segVal,
        dom: segVal,
      },
    }));
  };

  const replicarCobrancaSegParaSemana = (gradeId: string) => {
    const segVal = getValorHoraCobrancaForGradeDia(gradeId, 'seg');
    setDraftValorHoraCobrancaPorDia((prev) => ({
      ...prev,
      [gradeId]: {
        ...(prev[gradeId] ?? {}),
        ter: segVal,
        qua: segVal,
        qui: segVal,
        sex: segVal,
        sab: segVal,
        dom: segVal,
      },
    }));
  };

  const handleSaveSemana = async (grade: { id: string; nome: string }) => {
    if (!contratoId || !subgrupoId || !equipeId) return;
    setSaving(grade.id);
    setError(null);
    setSuccess(null);
    try {
      const repDraft: Record<string, string> = Object.fromEntries(
        DIAS_SEMANA.map(({ key }) => [key, getValorHoraForGradeDia(grade.id, key)])
      );
      const cobDraft: Record<string, string> = Object.fromEntries(
        DIAS_SEMANA.map(({ key }) => [key, getValorHoraCobrancaForGradeDia(grade.id, key)])
      );

      const { map: valorHoraPorDia, fallbackGlobal: valorHora } = buildMapaValorPorDiaComFallback(repDraft);
      const { map: valorHoraCobrancaPorDia, fallbackGlobal: valorHoraCobranca } =
        buildMapaValorPorDiaComFallback(cobDraft);

      await adminService.setValorPlantao(contratoId, subgrupoId, equipeId, grade.id, {
        valorHora,
        valorHoraCobranca,
        valorHoraPorDia,
        valorHoraCobrancaPorDia,
      });
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'valores-plantao', contratoId, subgrupoId, equipeId],
      });
      setDraft((prev) => {
        if (prev[grade.id] === undefined) return prev;
        const next = { ...prev };
        delete next[grade.id];
        return next;
      });
      setDraftValorHoraPorDia((prev) => {
        if (!prev[grade.id]) return prev;
        const next = { ...prev };
        delete next[grade.id];
        return next;
      });
      setDraftValorHoraCobrancaPorDia((prev) => {
        if (!prev[grade.id]) return prev;
        const next = { ...prev };
        delete next[grade.id];
        return next;
      });
      setSuccess(`Valores da semana (seg–dom) de ${grade.nome} salvos.`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar valor');
    } finally {
      setSaving(null);
    }
  };

  const limparRascunhosGeo = () => {
    geo.resetLocalizacao();
  };

  const onContratoChange = (id: string) => {
    setContratoId(id);
    setDraft({});
    setDraftValorHoraPorDia({});
    setDraftValorHoraCobrancaPorDia({});
    limparRascunhosGeo();
    setNovoTipoNome('');
    setNovoTipoHi('08:00');
    setNovoTipoHf('20:00');
    setNovoTipoCruza(false);
  };

  const onSubgrupoChange = (id: string) => {
    setSubgrupoId(id);
    setDraft({});
    setDraftValorHoraPorDia({});
    setDraftValorHoraCobrancaPorDia({});
    limparRascunhosGeo();
  };

  const handleSaveGeo = async () => {
    if (!contratoId || !subgrupoId || !equipeId) return;
    setSavingGeo(true);
    setError(null);
    setSuccess(null);
    try {
      const cfg = configPonto;
      const horas = cfg?.horasPrevistasMes ?? null;
      const valor = cfg?.valorHora != null ? parseFloat(String(cfg.valorHora)) : null;
      const valorCobranca =
        cfg?.valorHoraCobranca != null ? parseFloat(String(cfg.valorHoraCobranca)) : null;
      const horarioEntrada = cfg?.horarioEntrada ?? null;
      const horarioSaida = cfg?.horarioSaida ?? null;
      const toleranciaMinutos = cfg?.toleranciaMinutos ?? null;

      const enderecoSalvar =
        geo.draftEndereco.trim() !== ''
          ? geo.draftEndereco.trim() || null
          : cfg?.enderecoPonto?.trim() || null;
      const lat =
        geo.draftLatitude !== ''
          ? parseFloat(geo.draftLatitude.replace(',', '.'))
          : cfg?.latitude != null && cfg?.latitude !== ''
            ? parseFloat(String(cfg.latitude))
            : null;
      const lng =
        geo.draftLongitude !== ''
          ? parseFloat(geo.draftLongitude.replace(',', '.'))
          : cfg?.longitude != null && cfg?.longitude !== ''
            ? parseFloat(String(cfg.longitude))
            : null;
      const raio =
        geo.draftRaioMetros !== '' ? parseInt(geo.draftRaioMetros, 10) : cfg?.raioMetros ?? null;
      const raioMetros = raio != null && !Number.isNaN(raio) && raio >= 0 ? raio : null;

      await adminService.setConfigPonto(contratoId, subgrupoId, equipeId, {
        horasPrevistasMes: horas ?? null,
        valorHora: valor,
        valorHoraCobranca: valorCobranca,
        horarioEntrada: horarioEntrada || null,
        horarioSaida: horarioSaida || null,
        toleranciaMinutos: toleranciaMinutos != null && toleranciaMinutos >= 0 ? toleranciaMinutos : null,
        latitude: lat != null && !Number.isNaN(lat) ? lat : null,
        longitude: lng != null && !Number.isNaN(lng) ? lng : null,
        raioMetros,
        enderecoPonto: enderecoSalvar,
      });
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'config-ponto', contratoId, subgrupoId, equipeId || null],
      });
      limparRascunhosGeo();
      setSuccess('Localização do ponto salva com sucesso.');
      setSavedGeo(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar localização do ponto.');
    } finally {
      setSavingGeo(false);
    }
  };

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-coop-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Somente o perfil Master pode configurar valores de plantão.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-coop-500">
        <h2 className="text-2xl font-bold text-coop-900 mb-1">{titulo}</h2>
        <p className="text-gray-600">{descricao}</p>
      </div>

      {error && (
        <div className="card border-l-4 border-red-400">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="card border-l-4 border-green-400">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {erroApiRede && !loadingOpcoes && (
        <div className="card border-l-4 border-amber-500 bg-amber-50/50">
          <p className="text-sm text-amber-950 mb-3">
            A API não respondeu (por exemplo <strong>ECONNREFUSED</strong> em <code className="text-xs bg-white px-1 rounded">localhost:3001</code>
            ). Inicie o backend ou confira <code className="text-xs bg-white px-1 rounded">VITE_API_URL</code> no build do
            frontend.
          </p>
          <button type="button" className="btn btn-secondary text-sm" onClick={tentarRecarregarApi}>
            Tentar novamente
          </button>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-bold text-coop-900 mb-4">Contrato, subgrupo e equipe</h3>
        {loadingOpcoes ? (
          <p className="text-sm text-gray-600">Carregando opções...</p>
        ) : (
          <div className="flex flex-wrap gap-6">
            <div className="min-w-[200px]">
              <label className="block text-sm font-semibold text-coop-800 mb-1">Contrato</label>
              <select
                className="input w-full"
                value={contratoId}
                onChange={(e) => onContratoChange(e.target.value)}
              >
                <option value="">Selecione o contrato</option>
                {contratosFiltrados.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px]">
              <label className="block text-sm font-semibold text-coop-800 mb-1">Subgrupo</label>
              <select
                className="input w-full"
                value={subgrupoId}
                onChange={(e) => onSubgrupoChange(e.target.value)}
                disabled={!contratoId}
              >
                <option value="">{contratoId ? 'Selecione o subgrupo' : 'Selecione o contrato primeiro'}</option>
                {subgruposDoContrato.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px]">
              <label className="block text-sm font-semibold text-coop-800 mb-1">Equipe</label>
              <select
                className="input w-full"
                value={equipeId}
                onChange={(e) => {
                  setEquipeId(e.target.value);
                  setDraft({});
                  setDraftValorHoraPorDia({});
                  setDraftValorHoraCobrancaPorDia({});
                  limparRascunhosGeo();
                }}
                disabled={!subgrupoId}
              >
                <option value="">
                  {subgrupoId ? 'Selecione a equipe' : 'Selecione o subgrupo primeiro'}
                </option>
                {equipesFiltradas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {temEscopoCompleto && exibirLocalizacaoPonto && (
        <div className="card">
          <h3 className="text-lg font-bold text-coop-900 mb-4">Tipos de plantão (contrato)</h3>
          <p className="text-sm text-coop-700 mb-4">
            Cada tipo tem nome e faixa de horário (usada na grade, calendário, troca e ponto). O horário define-se ao
            criar o tipo; depois só o <span className="font-semibold text-coop-800">nome</span> pode ser alterado. A
            lista ordena-se automaticamente pelo <span className="font-semibold text-coop-800">início</span> do
            plantão. Os padrões MT/SN são criados na primeira carga.
          </p>
          {loadingTipos ? (
            <p className="text-sm text-gray-600">Carregando tipos...</p>
          ) : (
            <>
              <div className="space-y-3 mb-6">
                {tiposPlantao.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-coop-200 bg-white"
                  >
                    <div>
                      <p className="text-sm font-semibold text-coop-900">{t.nome}</p>
                      <p className="text-xs text-coop-600">
                        {t.horaInicio.slice(0, 5)} – {t.horaFim.slice(0, 5)}
                        {t.cruzaMeiaNoite ? ' (cruza meia-noite)' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary text-sm py-1.5 px-3"
                        disabled={excluindoTipoId === t.id || salvandoEdicaoTipo}
                        onClick={() => setEditarTipoModal({ ...t })}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary text-sm py-1.5 px-3"
                        disabled={excluindoTipoId === t.id || salvandoEdicaoTipo}
                        onClick={() => setExcluirTipoModal({ id: t.id, nome: t.nome })}
                      >
                        {excluindoTipoId === t.id ? '…' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl border border-dashed border-coop-300 bg-coop-50/40 space-y-3">
                <p className="text-sm font-semibold text-coop-800">Novo tipo</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="min-w-[200px] flex-1">
                    <label className="block text-xs font-semibold text-coop-800 mb-1">Nome</label>
                    <input
                      className="input w-full"
                      placeholder="Ex.: Plantão vespertino"
                      value={novoTipoNome}
                      onChange={(e) => setNovoTipoNome(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[8.75rem]">
                    <label className="block text-xs font-semibold text-coop-800 mb-1">Início</label>
                    <input
                      type="time"
                      step={60}
                      className="input-time"
                      value={novoTipoHi}
                      onChange={(e) => setNovoTipoHi(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[8.75rem]">
                    <label className="block text-xs font-semibold text-coop-800 mb-1">Fim</label>
                    <input
                      type="time"
                      step={60}
                      className="input-time"
                      value={novoTipoHf}
                      onChange={(e) => setNovoTipoHf(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-coop-800 cursor-pointer pb-1">
                    <input
                      type="checkbox"
                      checked={novoTipoCruza}
                      onChange={(e) => setNovoTipoCruza(e.target.checked)}
                    />
                    Cruza meia-noite
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={criandoTipo || !novoTipoNome.trim()}
                    onClick={async () => {
                      setCriandoTipo(true);
                      setError(null);
                      setSuccess(null);
                      try {
                        await adminService.createTipoPlantao({
                          contratoAtivoId: contratoId,
                          nome: novoTipoNome.trim(),
                          horaInicio: novoTipoHi.length === 5 ? novoTipoHi : `${novoTipoHi}:00`.slice(0, 5),
                          horaFim: novoTipoHf.length === 5 ? novoTipoHf : `${novoTipoHf}:00`.slice(0, 5),
                          cruzaMeiaNoite: novoTipoCruza,
                        });
                        setNovoTipoNome('');
                        setNovoTipoCruza(false);
                        await queryClient.invalidateQueries({ queryKey: ['admin', 'tipos-plantao'] });
                        setSuccess('Tipo de plantão criado.');
                      } catch (err: any) {
                        setError(err.response?.data?.error || 'Erro ao criar tipo');
                      } finally {
                        setCriandoTipo(false);
                      }
                    }}
                  >
                    {criandoTipo ? 'Salvando...' : 'Adicionar tipo'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {temEscopoCompleto && (
        <div className="card">
          <h3 className="text-lg font-bold text-coop-900 mb-4">Valor por tipo (R$/h)</h3>
          {loadingValores ? (
            <p className="text-sm text-gray-600">Carregando valores...</p>
          ) : tiposPlantao.length === 0 ? (
            <p className="text-sm text-coop-700">Carregue os tipos do contrato acima.</p>
          ) : (
            <div className="space-y-6">
              {tiposPlantao.map((grade) => (
                <div
                  key={grade.id}
                  className="p-4 rounded-xl border border-coop-200 bg-white space-y-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-coop-900">
                      {grade.nome}{' '}
                      <span className="font-normal text-coop-600">
                        ({grade.horaInicio.slice(0, 5)}–{grade.horaFim.slice(0, 5)})
                      </span>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Use → na segunda para copiar o valor para ter–dom. Um único salvar grava repasse e cobrança da semana (seg–dom).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {DIAS_SEMANA.map(({ key, label }) => (
                      <div
                        key={key}
                        className="flex flex-wrap items-end gap-2 p-4 rounded-xl border border-coop-200 bg-coop-50/30"
                      >
                        <div className="min-w-[200px] flex-1">
                          <label className="block text-sm font-semibold text-coop-800 mb-1">
                            {label} <span className="font-normal text-coop-600">(Repasse R$/h)</span>
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="input w-full max-w-[180px]"
                            placeholder="Ex: 150,00"
                            value={getValorHoraForGradeDia(grade.id, key)}
                            onChange={(e) =>
                              setDraftValorHoraPorDia((prev) => ({
                                ...prev,
                                [grade.id]: {
                                  ...(prev[grade.id] ?? {}),
                                  [key]: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        {key === 'seg' && (
                          <button
                            type="button"
                            className="btn btn-secondary shrink-0 px-2 min-w-[2.25rem]"
                            title="Replicar valor da segunda para ter–dom"
                            onClick={() => replicarRepasseSegParaSemana(grade.id)}
                          >
                            →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <p className="text-sm font-semibold text-coop-800 mb-2">Cobrança (R$/h)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {DIAS_SEMANA.map(({ key, label }) => (
                        <div
                          key={key}
                          className="flex flex-wrap items-end gap-2 p-4 rounded-xl border border-coop-200 bg-coop-50/30"
                        >
                          <div className="min-w-[200px] flex-1">
                            <label className="block text-sm font-semibold text-coop-800 mb-1">
                              {label} <span className="font-normal text-coop-600">(Cobrança R$/h)</span>
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="input w-full max-w-[180px]"
                              placeholder="Ex: 150,00"
                              value={getValorHoraCobrancaForGradeDia(grade.id, key)}
                              onChange={(e) =>
                                setDraftValorHoraCobrancaPorDia((prev) => ({
                                  ...prev,
                                  [grade.id]: {
                                    ...(prev[grade.id] ?? {}),
                                    [key]: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          {key === 'seg' && (
                            <button
                              type="button"
                              className="btn btn-secondary shrink-0 px-2 min-w-[2.25rem]"
                              title="Replicar valor da segunda para ter–dom"
                              onClick={() => replicarCobrancaSegParaSemana(grade.id)}
                            >
                              →
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleSaveSemana(grade)}
                      disabled={saving === grade.id}
                    >
                      {saving === grade.id ? 'Salvando...' : 'Salvar semana (seg–dom)'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {temEscopoCompleto && (
        <div className="card">
          <h3 className="text-lg font-bold text-coop-900 mb-4">Localização do ponto (opcional)</h3>
          {loadingConfigPonto ? (
            <p className="text-sm text-gray-600">Carregando configuração de ponto...</p>
          ) : (
            <>
              <PontoEnderecoMapaBlock
                geo={geo}
                intro={
                  <p className="text-sm text-gray-600 mb-4">
                    Mesmo fluxo da tela <strong>Horas e valor – Ponto</strong>: pesquise o endereço, use o mapa
                    OpenStreetMap e defina o raio. Depois clique em <strong>Salvar</strong> para gravar só a localização
                    desta equipe (demais dados de ponto continuam na configuração existente).
                  </p>
                }
              />
              <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-coop-200 bg-coop-50/30 mt-3">
                <div className="min-w-[140px]">
                  <label className="block text-sm font-semibold text-coop-800 mb-1">Raio (metros)</label>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    step={10}
                    className="input w-full max-w-[120px]"
                    placeholder="Ex: 200"
                    value={geo.raioMetrosDisplay}
                    onChange={(e) => geo.setDraftRaioMetros(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className={`btn ${savedGeo ? 'bg-green-600 hover:bg-green-700 border-green-700' : 'btn-primary'}`}
                  onClick={handleSaveGeo}
                  disabled={savingGeo}
                >
                  {savingGeo ? 'Salvando...' : savedGeo ? 'Salvo!' : 'Salvar'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {editarTipoModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onClick={() => !salvandoEdicaoTipo && setEditarTipoModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4 border border-coop-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-tipo-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="editar-tipo-titulo" className="text-lg font-bold text-coop-900 font-display">
              Editar tipo de plantão
            </h3>
            <p className="text-xs text-coop-600">
              O identificador na escala (ligação aos plantões) não muda. Só o nome de exibição é editável; horários
              permanecem os definidos na criação do tipo.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-coop-800 mb-1">Nome</label>
                <input
                  className="input w-full"
                  value={editarTipoModal.nome}
                  onChange={(e) => setEditarTipoModal((m) => (m ? { ...m, nome: e.target.value } : m))}
                />
              </div>
              <div className="rounded-lg border border-coop-200 bg-coop-50/50 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-coop-600 mb-1">Horário (fixo)</p>
                <p className="text-sm text-coop-900">
                  {editarTipoModal.horaInicio.slice(0, 5)} – {editarTipoModal.horaFim.slice(0, 5)}
                  {editarTipoModal.cruzaMeiaNoite ? ' (cruza meia-noite)' : ''}
                </p>
                <p className="text-[11px] text-coop-600 mt-1">
                  Para mudar início/fim ou “cruza meia-noite”, exclua este tipo e crie outro (sem plantões na escala
                  usando este tipo).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={salvandoEdicaoTipo}
                onClick={() => setEditarTipoModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={salvandoEdicaoTipo || !editarTipoModal.nome.trim()}
                onClick={async () => {
                  const m = editarTipoModal;
                  setSalvandoEdicaoTipo(true);
                  setError(null);
                  setSuccess(null);
                  try {
                    await adminService.updateTipoPlantao(m.id, {
                      nome: m.nome.trim(),
                    });
                    await queryClient.invalidateQueries({ queryKey: ['admin', 'tipos-plantao'] });
                    setEditarTipoModal(null);
                    setSuccess('Tipo atualizado.');
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Não foi possível salvar');
                  } finally {
                    setSalvandoEdicaoTipo(false);
                  }
                }}
              >
                {salvandoEdicaoTipo ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {excluirTipoModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onClick={() => !excluindoTipoId && setExcluirTipoModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4 border border-coop-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="excluir-tipo-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="excluir-tipo-titulo" className="text-lg font-bold text-coop-900 font-display">
              Excluir tipo de plantão?
            </h3>
            <p className="text-sm text-coop-700 leading-relaxed">
              O tipo <span className="font-semibold text-coop-900">{excluirTipoModal.nome}</span> será removido
              permanentemente. Valores por subgrupo e adicionais por data deste tipo serão apagados junto. A exclusão
              só é bloqueada se ainda existir <span className="font-semibold">plantão agendado na escala</span> usando
              este tipo.
            </p>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!!excluindoTipoId}
                onClick={() => setExcluirTipoModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 border border-red-700 disabled:opacity-60"
                disabled={!!excluindoTipoId}
                onClick={async () => {
                  const id = excluirTipoModal.id;
                  setExcluindoTipoId(id);
                  setError(null);
                  try {
                    await adminService.deleteTipoPlantao(id);
                    await queryClient.invalidateQueries({ queryKey: ['admin', 'tipos-plantao'] });
                    await queryClient.invalidateQueries({ queryKey: ['admin', 'valores-plantao', contratoId] });
                    setSuccess('Tipo removido.');
                    setExcluirTipoModal(null);
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Não foi possível excluir');
                  } finally {
                    setExcluindoTipoId(null);
                  }
                }}
              >
                {excluindoTipoId ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValoresPlantao;
