import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { notify } from '../lib/notificationEmitter';
import { authService } from '../services/auth.service';
import { medicoService, type VagaPublicadaItem } from '../services/medico.service';
import { pontoService, type TrocaPlantaoPendenteItem } from '../services/ponto.service';
import { fixMojibake } from '../utils/validation.util';
import {
  faixaExibicaoPlantao,
  fimPlantaoCliente,
  plantaoChipClassesFromOrdem,
  rotuloCurtoTipo,
  type PlantaoAgendaInput,
} from '../utils/plantao-agenda';
import { canTrocarPlantaoAgendaEm, trocaPendenteVisivelNoPainel } from '../utils/troca-plantao-painel';

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function canTrocarPlantaoAgenda(dataStr: string, p: PlantaoAgendaInput): boolean {
  return canTrocarPlantaoAgendaEm(dataStr, p, new Date());
}

function isPlantaoAindaFuturoAgenda(dataStr: string, p: PlantaoAgendaInput): boolean {
  const now = new Date();
  const fim = fimPlantaoCliente(dataStr, p);
  return now < fim;
}

function labelDiaCompleto(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDataCurta(dataStr: string): string {
  const d = new Date(dataStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}

function labelTrocaRecebidaResumo(t: TrocaPlantaoPendenteItem): string {
  const data = formatDataCurta(String(t.dataPlantao).slice(0, 10));
  const fx = faixaExibicaoPlantao({ gradeId: t.gradeId });
  const n = fixMojibake(t.solicitante.nomeCompleto);
  if (t.paraEquipeInteira) {
    return (t.tipoSolicitacao ?? 'PERMUTA') === 'CEDER'
      ? `${n} · cessão à equipe · ${data} · ${fx}`
      : `${n} · permuta com a equipe · ${data} · ${fx}`;
  }
  if ((t.tipoSolicitacao ?? 'PERMUTA') === 'CEDER') {
    return `${n} · cede a você · ${data} · ${fx}`;
  }
  if (t.contrapartidaPlantaoId && t.dataPlantaoContrapartida && t.gradeIdContrapartida) {
    const d2 = formatDataCurta(String(t.dataPlantaoContrapartida).slice(0, 10));
    const fx2 = faixaExibicaoPlantao({ gradeId: t.gradeIdContrapartida });
    return `${n} · permuta · ${data} (${fx}) ↔ ${d2} (${fx2})`;
  }
  return `${n} · troca · ${data} · ${fx}`;
}

function labelTrocaEnviadaResumo(t: TrocaPlantaoPendenteItem): string {
  const data = formatDataCurta(String(t.dataPlantao).slice(0, 10));
  const fx = faixaExibicaoPlantao({ gradeId: t.gradeId });
  if (t.paraEquipeInteira) {
    return (t.tipoSolicitacao ?? 'PERMUTA') === 'CEDER'
      ? `Você · cessão à equipe · ${data} · ${fx}`
      : `Você · permuta à equipe · ${data} · ${fx}`;
  }
  if ((t.tipoSolicitacao ?? 'PERMUTA') === 'CEDER' && t.destino) {
    return `Você · cessão para ${fixMojibake(t.destino.nomeCompleto)} · ${data} · ${fx}`;
  }
  if (t.contrapartidaPlantaoId && t.dataPlantaoContrapartida && t.gradeIdContrapartida && t.destino) {
    const d2 = formatDataCurta(String(t.dataPlantaoContrapartida).slice(0, 10));
    const fx2 = faixaExibicaoPlantao({ gradeId: t.gradeIdContrapartida });
    return `Você · permuta com ${fixMojibake(t.destino.nomeCompleto)} · ${data} (${fx}) ↔ ${d2} (${fx2})`;
  }
  if (t.destino) {
    return `Você · pedido a ${fixMojibake(t.destino.nomeCompleto)} · ${data} · ${fx}`;
  }
  return `Você · aguardando · ${data} · ${fx}`;
}

type PlantaoCal = PlantaoAgendaInput & {
  id: string;
  data: string;
  gradeId: string;
  escalaId: string;
  escalaNome: string | null;
  permiteTrocaPlantao?: boolean;
  tipoNome?: string | null;
  tipoOrdem?: number | null;
};

const MeuCalendarioPlantoes = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMedico = user?.role === 'MEDICO';

  const { data: meuDiaCtx, isLoading: carregandoContextoPonto } = useQuery({
    queryKey: ['ponto', 'meu-dia'],
    queryFn: () => pontoService.getMeuDia(),
    enabled: isMedico,
  });
  const temContratoComEscala =
    (meuDiaCtx?.data as { temContratoComEscala?: boolean } | undefined)?.temContratoComEscala !== false;

  const [view, setView] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });

  const { data: equipesResp } = useQuery({
    queryKey: ['ponto', 'equipes-calendario'],
    queryFn: () => pontoService.listMinhasEquipesCalendario(),
    enabled: isMedico,
  });
  const equipes = equipesResp?.data ?? [];

  // null = mostrar todas as equipes
  const [selectedEquipeIds, setSelectedEquipeIds] = useState<string[] | null>(null);
  useEffect(() => {
    // Se o usuário abrir a tela e ainda não escolheu explicitamente, mantemos "todas".
    // Ao mesmo tempo, se o backend retornar 0 equipes, deixamos seleção explícita vazia.
    if (equipes.length === 0 && selectedEquipeIds === null) {
      setSelectedEquipeIds([]);
    }
  }, [equipes.length, selectedEquipeIds]);

  const equipeKey = selectedEquipeIds === null ? 'all' : [...selectedEquipeIds].sort().join(',');

  const [relogioTrocas, setRelogioTrocas] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setRelogioTrocas(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const { data: modulosResp, isLoading: modulosLoading } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user && isMedico,
  });
  const mapModulos = modulosResp?.data?.map;
  const vagasDesabilitado = modulosResp && mapModulos ? mapModulos.VAGAS === false : false;

  const { data: trocasPendentesResp } = useQuery({
    queryKey: ['ponto', 'trocas-plantao-pendentes'],
    queryFn: () => pontoService.listTrocasPlantaoPendentes(),
    enabled: isMedico,
    staleTime: 15 * 1000,
  });

  const { data: vagasResp, isLoading: vagasLoading } = useQuery({
    queryKey: ['medico', 'vagas'],
    queryFn: () => medicoService.listVagas(),
    enabled: !!user && isMedico && !modulosLoading && !vagasDesabilitado,
  });

  const trocasRecebidasVis = useMemo(() => {
    const r = trocasPendentesResp?.data?.recebidas ?? [];
    return r.filter((t) => trocaPendenteVisivelNoPainel(t, relogioTrocas));
  }, [trocasPendentesResp, relogioTrocas]);

  const trocasEnviadasVis = useMemo(() => {
    const r = trocasPendentesResp?.data?.enviadas ?? [];
    return r.filter((t) => trocaPendenteVisivelNoPainel(t, relogioTrocas));
  }, [trocasPendentesResp, relogioTrocas]);

  const vagasOutros = useMemo(() => {
    const items = (vagasResp?.data?.items ?? []) as VagaPublicadaItem[];
    return items.filter((v) => !v.souPublicador);
  }, [vagasResp]);

  const { data, isLoading } = useQuery({
    queryKey: ['ponto', 'meus-plantoes-calendario', view.ano, view.mes, equipeKey],
    queryFn: () =>
      pontoService.listMeusPlantoesCalendario(view.ano, view.mes, selectedEquipeIds === null ? undefined : selectedEquipeIds),
    enabled: isMedico,
  });

  const plantoes = useMemo(() => (data?.data ?? []) as PlantaoCal[], [data?.data]);
  const byDay = useMemo(() => {
    const m = new Map<string, PlantaoCal[]>();
    for (const p of plantoes) {
      const k = p.data.slice(0, 10);
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return m;
  }, [plantoes]);

  const { gridDays, monthLabel } = useMemo(() => {
    const { ano, mes } = view;
    const first = new Date(ano, mes - 1, 1);
    const last = new Date(ano, mes, 0);
    const daysInMonth = last.getDate();
    const startWeekday = first.getDay();
    const cells: { day: number | null; key: string }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, key: `pad-${ano}-${mes}-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dk = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, key: dk });
    }
    const label = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { gridDays: cells, monthLabel: label };
  }, [view]);

  const toggleEquipeChip = (equipeId: string) => {
    const allIds = equipes.map((e: any) => e.id).filter(Boolean) as string[];

    if (selectedEquipeIds === null) {
      // quando está em "todas", um toque mostra só a equipe clicada (mais previsível no celular)
      setSelectedEquipeIds([equipeId]);
      return;
    }

    const has = selectedEquipeIds.includes(equipeId);
    const next = has ? selectedEquipeIds.filter((id) => id !== equipeId) : [...selectedEquipeIds, equipeId];

    // Sem seleção explícita útil: volta para "Todas" em vez de ficar sem filtro (evita mismatch UI/API).
    if (next.length === 0) {
      setSelectedEquipeIds(null);
      return;
    }

    if (next.length === allIds.length) {
      setSelectedEquipeIds(null); // voltou para "todas"
      return;
    }

    setSelectedEquipeIds(next);
  };

  const [dayModalKey, setDayModalKey] = useState<string | null>(null);
  const [showTrocaModal, setShowTrocaModal] = useState(false);
  const [trocaEscalaId, setTrocaEscalaId] = useState<string | null>(null);
  const [trocaPlantaoId, setTrocaPlantaoId] = useState<string | null>(null);
  const [trocaMeuPlantaoMeta, setTrocaMeuPlantaoMeta] = useState<{ data: string; gradeId: string } | null>(
    null
  );
  const [trocaStep, setTrocaStep] = useState<1 | 2>(1);
  const [trocaAcaoTipo, setTrocaAcaoTipo] = useState<'PERMUTA' | 'CEDER' | null>(null);
  const [trocaDestinoModo, setTrocaDestinoModo] = useState<'colega' | 'equipe'>('colega');
  const [selectedColegaId, setSelectedColegaId] = useState<string | null>(null);
  const [selectedPlantaoContrapartidaId, setSelectedPlantaoContrapartidaId] = useState<string | null>(null);

  const resetTrocaModal = () => {
    setShowTrocaModal(false);
    setTrocaStep(1);
    setTrocaAcaoTipo(null);
    setTrocaDestinoModo('colega');
    setSelectedColegaId(null);
    setTrocaEscalaId(null);
    setTrocaPlantaoId(null);
    setTrocaMeuPlantaoMeta(null);
    setSelectedPlantaoContrapartidaId(null);
  };

  const abrirTrocaParaPlantao = (p: PlantaoCal) => {
    setDayModalKey(null);
    setTrocaEscalaId(p.escalaId);
    setTrocaPlantaoId(p.id);
    setTrocaMeuPlantaoMeta({ data: p.data, gradeId: p.gradeId });
    setShowTrocaModal(true);
    setTrocaStep(1);
    setTrocaAcaoTipo(null);
    setTrocaDestinoModo('colega');
    setSelectedColegaId(null);
    setSelectedPlantaoContrapartidaId(null);
  };

  const trocaMutation = useMutation({
    mutationFn: () => {
      const tipo = trocaAcaoTipo;
      if (!tipo) {
        throw new Error('Selecione Trocar ou Ceder');
      }
      if (trocaDestinoModo === 'equipe') {
        return pontoService.solicitarTrocaPlantao({
          plantaoId: trocaPlantaoId!,
          paraEquipeInteira: true,
          ...(tipo === 'CEDER' ? { tipoSolicitacao: 'CEDER' as const } : {}),
        });
      }
      if (tipo === 'CEDER') {
        return pontoService.solicitarTrocaPlantao({
          plantaoId: trocaPlantaoId!,
          medicoDestinoId: selectedColegaId!,
          tipoSolicitacao: 'CEDER',
        });
      }
      return pontoService.solicitarTrocaPlantao({
        plantaoId: trocaPlantaoId!,
        medicoDestinoId: selectedColegaId!,
        plantaoContrapartidaId: selectedPlantaoContrapartidaId!,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medico', 'notificacoes'] });
      queryClient.invalidateQueries({ queryKey: ['ponto', 'proximos-plantoes'] });
      queryClient.invalidateQueries({ queryKey: ['ponto', 'meus-plantoes-calendario'] });
      queryClient.invalidateQueries({ queryKey: ['ponto', 'trocas-plantao-pendentes'] });
      resetTrocaModal();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      notify({
        kind: 'error',
        title: 'Não foi possível',
        message: msg ?? 'Tente novamente.',
        source: 'ponto',
      });
    },
  });

  const { data: colegasResp } = useQuery({
    queryKey: ['ponto', 'equipe-colegas', trocaEscalaId],
    queryFn: () => pontoService.listEquipeColegas(trocaEscalaId!),
    enabled: !!user && isMedico && showTrocaModal && !!trocaEscalaId,
  });
  const colegasList = (colegasResp?.data ?? colegasResp ?? []) as Array<{
    id: string;
    nomeCompleto: string;
    crm?: string | null;
  }>;
  const selectedColega = selectedColegaId ? colegasList.find((c) => c.id === selectedColegaId) : null;

  const { data: plantoesColegaResp, isFetching: plantoesColegaFetching } = useQuery({
    queryKey: ['ponto', 'plantoes-colega-troca', trocaEscalaId, selectedColegaId],
    queryFn: () => pontoService.listPlantoesColegaParaTroca(trocaEscalaId!, selectedColegaId!),
    enabled:
      !!user &&
      isMedico &&
      showTrocaModal &&
      !!trocaEscalaId &&
      !!selectedColegaId &&
      trocaAcaoTipo === 'PERMUTA',
  });
  const plantoesColegaList = plantoesColegaResp?.data ?? [];
  const plantaoContrapartidaSelecionado = selectedPlantaoContrapartidaId
    ? plantoesColegaList.find((x) => x.id === selectedPlantaoContrapartidaId)
    : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showTrocaModal) {
        setShowTrocaModal(false);
        setTrocaStep(1);
        setTrocaAcaoTipo(null);
        setTrocaDestinoModo('colega');
        setSelectedColegaId(null);
        setTrocaEscalaId(null);
        setTrocaPlantaoId(null);
        setTrocaMeuPlantaoMeta(null);
        setSelectedPlantaoContrapartidaId(null);
      } else if (dayModalKey) {
        setDayModalKey(null);
      }
    };
    if (dayModalKey || showTrocaModal) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [dayModalKey, showTrocaModal]);

  useEffect(() => {
    setDayModalKey(null);
  }, [view.ano, view.mes]);

  const prevMonth = () => {
    setView((v) => {
      let { ano, mes } = v;
      mes -= 1;
      if (mes < 1) {
        mes = 12;
        ano -= 1;
      }
      return { ano, mes };
    });
  };

  const nextMonth = () => {
    setView((v) => {
      let { ano, mes } = v;
      mes += 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
      return { ano, mes };
    });
  };

  if (!isMedico) {
    return (
      <div className="card border-l-4 border-amber-500">
        <p className="text-sm text-coop-800 font-serif">Esta área é para profissionais.</p>
        <Link to="/dashboard" className="btn btn-secondary text-sm mt-3 inline-block">
          Voltar
        </Link>
      </div>
    );
  }

  if (carregandoContextoPonto) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-coop-200 border-t-coop-600" />
        <p className="text-sm text-coop-600 font-serif">Carregando…</p>
      </div>
    );
  }

  if (!temContratoComEscala) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="card border-l-4 border-coop-500">
          <h1 className="text-lg font-bold text-coop-900 font-display mb-2">Calendário de plantões</h1>
          <p className="text-sm text-coop-700 font-serif leading-relaxed">
            O calendário de escalas e plantões está disponível apenas para contratos que utilizam <strong>escala de
            plantão</strong>. Nos seus vínculos atuais o ponto é registrado sem essa grade — use o{' '}
            <strong>Ponto eletrônico</strong> para entrada e saída.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/ponto-eletronico" className="btn btn-primary text-sm">
              Ir ao ponto eletrônico
            </Link>
            <Link to="/dashboard" className="btn btn-secondary text-sm">
              Voltar ao painel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-1 sm:px-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-coop-600 font-display">Escala</p>
        <h1 className="text-xl md:text-2xl font-bold text-coop-900 font-display tracking-tight">
          Calendário de plantões
        </h1>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-[var(--app-border)] bg-gradient-to-br from-white via-coop-50/35 to-white p-4 shadow-[var(--card-shadow)] sm:p-6 stagger-1">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-coop-200/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-coop-100/40 blur-2xl"
        />

        <div className="relative">
          <div className="mb-5 border-b border-coop-200/60 pb-5">
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-coop-600 font-display">
              Equipes para visualizar
            </h2>
            {equipes.length === 0 ? (
              <p className="text-xs text-coop-600 font-serif">Nenhuma equipe vinculada para filtrar.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedEquipeIds(null)}
                  className={`min-h-[32px] rounded-xl border px-2.5 py-1 text-[10px] font-semibold leading-none transition font-display active:scale-[0.98] ${
                    selectedEquipeIds === null
                      ? 'border-coop-800 bg-coop-900 text-white shadow-sm'
                      : 'border-coop-200 bg-white/90 text-coop-600 hover:border-coop-300 hover:bg-coop-50 hover:text-coop-800'
                  }`}
                >
                  Todas
                </button>
                {equipes.map((e: any) => {
                  const active =
                    selectedEquipeIds === null ? true : selectedEquipeIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEquipeChip(e.id)}
                      className={`min-h-[32px] max-w-full rounded-xl border px-2.5 py-1 text-[10px] font-semibold leading-snug transition font-display active:scale-[0.98] ${
                        active
                          ? 'border-coop-800 bg-coop-900 text-white shadow-sm'
                          : 'border-coop-200 bg-white/90 text-coop-700 hover:border-coop-300 hover:bg-coop-50'
                      }`}
                    >
                      {fixMojibake(e.nome)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mb-4 flex items-center gap-2 sm:mb-5 sm:gap-3">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-coop-500 transition hover:bg-coop-50 hover:text-coop-900"
              aria-label="Mês anterior"
            >
              <span aria-hidden>←</span>
            </button>
            <h2 className="min-w-0 flex-1 text-center text-sm font-medium capitalize tracking-tight text-coop-900 sm:text-base">
              {monthLabel}
            </h2>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-coop-500 transition hover:bg-coop-50 hover:text-coop-900"
              aria-label="Próximo mês"
            >
              <span aria-hidden>→</span>
            </button>
          </div>

          {isLoading ? (
            <p className="py-14 text-center text-sm text-coop-600 font-serif">Carregando calendário…</p>
          ) : (
            <>
              <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0">
                <div className="min-w-[min(100%,36rem)] sm:min-w-0">
                  <div className="grid grid-cols-7 gap-px text-center text-[9px] font-semibold uppercase tracking-wider text-coop-600 sm:gap-1 sm:text-[10px] sm:tracking-wide">
                    {WEEK_DAYS.map((d) => (
                      <div key={d} className="rounded-md bg-coop-100/70 py-1.5 text-coop-800 sm:py-2">
                        <span className="sm:hidden">{d.slice(0, 1)}</span>
                        <span className="hidden sm:inline">{d}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-px sm:mt-2 sm:gap-1">
                    {gridDays.map((cell) => {
                      if (cell.day === null) {
                        return (
                          <div
                            key={cell.key}
                            className="min-h-[58px] rounded-md bg-coop-50/50 min-w-0 sm:min-h-[84px] sm:rounded-lg"
                          />
                        );
                      }
                      const list = byDay.get(cell.key) ?? [];
                      const t = new Date();
                      const isToday =
                        t.getFullYear() === view.ano &&
                        t.getMonth() + 1 === view.mes &&
                        t.getDate() === cell.day;
                      return (
                        <button
                          type="button"
                          key={cell.key}
                          onClick={() => setDayModalKey(cell.key)}
                          className={`text-left min-h-[58px] rounded-md border p-0.5 flex flex-col gap-0.5 min-w-0 transition sm:min-h-[84px] sm:rounded-lg sm:p-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-coop-400/60 focus:ring-offset-1 ${
                            isToday
                              ? 'border-coop-500 bg-coop-50/90 ring-1 ring-coop-300/50'
                              : 'border-coop-200/70 bg-white hover:border-coop-300/80 hover:bg-coop-50/30'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold tabular-nums shrink-0 sm:text-[11px] ${
                              isToday ? 'text-coop-900' : 'text-coop-600'
                            }`}
                          >
                            {cell.day}
                          </span>
                          <div className="flex flex-col gap-0.5 mt-auto overflow-hidden min-h-0">
                            {list.map((p) => (
                              <span
                                key={p.id}
                                title={`${fixMojibake(p.escalaNome || 'Escala')} · ${faixaExibicaoPlantao(p)}`}
                                className={`truncate rounded px-0.5 py-0.5 text-[8px] font-semibold leading-tight border sm:px-1 sm:text-[9px] ${plantaoChipClassesFromOrdem(p)}`}
                              >
                                {rotuloCurtoTipo(p)} · {fixMojibake(p.escalaNome || '—')}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {plantoes.length === 0 && (
                <p className="mt-4 text-center text-xs text-coop-600 font-serif">
                  Nenhum plantão seu neste mês nesta visualização.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--app-border)] bg-gradient-to-br from-amber-50/50 via-white to-orange-50/25 p-4 shadow-[var(--card-shadow)] sm:p-5 stagger-2">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-amber-200/30 blur-2xl"
          />
          <div className="relative">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-amber-200/60 pb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 font-display">Trocas</p>
                <h2 className="text-sm font-bold text-coop-900 font-display tracking-tight">Quem quer trocar ou ceder</h2>
              </div>
              <Link
                to="/dashboard"
                className="text-xs font-semibold text-coop-700 underline-offset-2 hover:text-coop-900 hover:underline font-display"
              >
                Aceitar no painel
              </Link>
            </div>
            {trocasRecebidasVis.length === 0 && trocasEnviadasVis.length === 0 ? null : (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {trocasRecebidasVis.map((t) => (
                  <li
                    key={`troca-r-${t.id}`}
                    className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-950 font-serif leading-snug"
                  >
                    <span className="font-semibold text-amber-900 font-display">Recebida · </span>
                    {labelTrocaRecebidaResumo(t)}
                    {t.escalaNome ? (
                      <span className="mt-0.5 block text-[10px] text-amber-800/90">{fixMojibake(t.escalaNome)}</span>
                    ) : null}
                  </li>
                ))}
                {trocasEnviadasVis.map((t) => (
                  <li
                    key={`troca-e-${t.id}`}
                    className="rounded-xl border border-coop-200/70 bg-coop-50/50 px-3 py-2 text-xs text-coop-900 font-serif leading-snug"
                  >
                    <span className="font-semibold text-coop-800 font-display">Enviada por você · </span>
                    {labelTrocaEnviadaResumo(t)}
                    {t.escalaNome ? (
                      <span className="mt-0.5 block text-[10px] text-coop-600">{fixMojibake(t.escalaNome)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-[var(--app-border)] bg-gradient-to-br from-white via-coop-50/35 to-white p-4 shadow-[var(--card-shadow)] sm:p-5 stagger-3">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-8 h-24 w-24 rounded-full bg-coop-200/25 blur-2xl"
          />
          <div className="relative">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-coop-200/60 pb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600 font-display">Vagas</p>
                <h2 className="text-sm font-bold text-coop-900 font-display tracking-tight">Oportunidades publicadas</h2>
              </div>
              {!vagasDesabilitado ? (
                <Link
                  to="/vagas"
                  className="text-xs font-semibold text-coop-700 underline-offset-2 hover:text-coop-900 hover:underline font-display"
                >
                  Ver todas
                </Link>
              ) : null}
            </div>
            {modulosLoading ? (
              <div className="flex items-center gap-2 text-xs text-coop-600 font-serif">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-coop-200 border-t-coop-600" />
                Carregando módulos…
              </div>
            ) : vagasDesabilitado ? (
              <p className="text-xs text-coop-600 font-serif leading-relaxed">
                O módulo Vagas não está habilitado para o seu perfil. Peça ao administrador para ativá-lo se precisar ver
                plantões vagos publicados.
              </p>
            ) : vagasLoading ? (
              <div className="flex items-center gap-2 text-xs text-coop-600 font-serif">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-coop-200 border-t-coop-600" />
                Carregando vagas…
              </div>
            ) : vagasOutros.length === 0 ? null : (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {vagasOutros.slice(0, 12).map((v) => {
                  const dias =
                    v.diasVaga?.length > 0
                      ? v.diasVaga
                          .slice(0, 4)
                          .map((d) => formatDataCurta(String(d).slice(0, 10)))
                          .join(', ') + (v.diasVaga.length > 4 ? '…' : '')
                      : null;
                  return (
                    <li
                      key={v.id}
                      className="rounded-xl border border-coop-200/70 bg-white/80 px-3 py-2 text-xs text-coop-900 font-serif leading-snug"
                    >
                      <span className="font-semibold text-coop-900 font-display">{v.tipoAtendimento}</span>
                      <span className="text-coop-600"> · {v.setor}</span>
                      <span className="mt-0.5 block text-[10px] text-coop-600">
                        {fixMojibake(v.publicador.nomeCompleto)}
                        {v.publicador.crm ? ` · CRM ${v.publicador.crm}` : ''}
                      </span>
                      {dias ? <span className="mt-0.5 block text-[10px] text-coop-500">Dias: {dias}</span> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {dayModalKey && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDayModalKey(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dia-plantao-titulo"
          >
            <h3 id="dia-plantao-titulo" className="text-lg font-semibold text-coop-900 font-display capitalize">
              {labelDiaCompleto(dayModalKey)}
            </h3>
            {(byDay.get(dayModalKey) ?? []).length === 0 ? (
              <p className="text-sm text-coop-600 font-serif">Nenhum plantão seu neste dia.</p>
            ) : (
              <ul className="space-y-3">
                {(byDay.get(dayModalKey) ?? []).map((p) => {
                  const podeContrato = p.permiteTrocaPlantao !== false;
                  const noPrazo = canTrocarPlantaoAgenda(p.data, p);
                  const mostrarTrocar = podeContrato && noPrazo;
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl border border-coop-200/80 bg-coop-50/40 p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-coop-900">{fixMojibake(p.escalaNome || 'Escala')}</p>
                        <p className="text-xs text-coop-600 mt-1">
                          {rotuloCurtoTipo(p)} · {faixaExibicaoPlantao(p)}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-1">
                        {mostrarTrocar ? (
                          <button
                            type="button"
                            className="btn btn-secondary text-sm"
                            onClick={() => abrirTrocaParaPlantao(p)}
                          >
                            Trocar / ceder
                          </button>
                        ) : (
                          <span className="text-xs text-coop-600 text-right sm:max-w-[11rem]">
                            {!podeContrato
                              ? 'Troca não habilitada neste contrato.'
                              : isPlantaoAindaFuturoAgenda(p.data, p)
                                ? 'Período de troca encerrado'
                                : 'Plantão já passou'}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex justify-end pt-1">
              <button type="button" className="btn btn-secondary" onClick={() => setDayModalKey(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrocaModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50" onClick={resetTrocaModal}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-coop-900 font-display">
              {trocaStep === 1
                ? trocaAcaoTipo === null
                  ? 'Trocar ou ceder plantão'
                  : trocaAcaoTipo === 'CEDER'
                    ? 'Ceder plantão'
                    : 'Trocar plantão'
                : trocaAcaoTipo === 'CEDER'
                  ? 'Confirmar cessão'
                  : 'Confirmar troca'}
            </h3>
            {trocaStep === 1 ? (
              <>
                <p className="text-sm text-coop-700">O que você deseja fazer?</p>
                <div className="flex rounded-xl border border-coop-200 p-1 gap-1 bg-coop-50/50">
                  <button
                    type="button"
                    className={`flex-1 text-sm py-2.5 rounded-lg font-medium transition-colors ${
                      trocaAcaoTipo === 'PERMUTA'
                        ? 'bg-coop-600 text-white shadow-sm'
                        : 'text-coop-800 hover:bg-white/80'
                    }`}
                    onClick={() => {
                      setTrocaAcaoTipo('PERMUTA');
                      setSelectedPlantaoContrapartidaId(null);
                    }}
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    className={`flex-1 text-sm py-2.5 rounded-lg font-medium transition-colors ${
                      trocaAcaoTipo === 'CEDER'
                        ? 'bg-coop-600 text-white shadow-sm'
                        : 'text-coop-800 hover:bg-white/80'
                    }`}
                    onClick={() => {
                      setTrocaAcaoTipo('CEDER');
                      setSelectedPlantaoContrapartidaId(null);
                    }}
                  >
                    Ceder
                  </button>
                </div>
                {trocaAcaoTipo != null ? (
                  <>
                    <p className="text-xs text-coop-600 font-serif leading-relaxed">
                      {trocaAcaoTipo === 'CEDER'
                        ? 'Quem aceitar fica com o seu plantão; não precisa ceder um dele.'
                        : 'Troca pelo plantão de um colega. À equipe: quem aceitar escolhe o dele na troca.'}
                    </p>
                    <p className="text-sm text-coop-700 pt-1">Quem pode receber o pedido?</p>
                    <div className="flex rounded-xl border border-coop-200 p-1 gap-1 bg-coop-50/50">
                      <button
                        type="button"
                        className={`flex-1 text-sm py-2.5 rounded-lg font-medium transition-colors ${
                          trocaDestinoModo === 'colega'
                            ? 'bg-coop-600 text-white shadow-sm'
                            : 'text-coop-800 hover:bg-white/80'
                        }`}
                        onClick={() => {
                          setTrocaDestinoModo('colega');
                          setSelectedColegaId(null);
                          setSelectedPlantaoContrapartidaId(null);
                        }}
                      >
                        Um colega
                      </button>
                      <button
                        type="button"
                        className={`flex-1 text-sm py-2.5 rounded-lg font-medium transition-colors ${
                          trocaDestinoModo === 'equipe'
                            ? 'bg-coop-600 text-white shadow-sm'
                            : 'text-coop-800 hover:bg-white/80'
                        }`}
                        onClick={() => {
                          setTrocaDestinoModo('equipe');
                          setSelectedColegaId(null);
                          setSelectedPlantaoContrapartidaId(null);
                        }}
                      >
                        Equipe inteira
                      </button>
                    </div>
                    {trocaDestinoModo === 'equipe' ? (
                      <p className="text-sm text-coop-700 font-serif leading-relaxed">
                        {trocaAcaoTipo === 'CEDER' ? (
                          <>
                            Colegas da escala veem o pedido. <strong>O primeiro a aceitar</strong> fica com o plantão, sem
                            contrapartida.
                          </>
                        ) : (
                          <>
                            Colegas da escala veem o pedido. <strong>O primeiro a aceitar</strong> indica o plantão dele na
                            troca.
                          </>
                        )}
                      </p>
                    ) : (
                      <>
                        <label className="text-xs font-semibold text-coop-600 uppercase tracking-wide">Profissional</label>
                        <select
                          value={selectedColegaId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value || null;
                            setSelectedColegaId(v);
                            setSelectedPlantaoContrapartidaId(null);
                          }}
                          className="input w-full py-2"
                        >
                          <option value="">Selecione um profissional</option>
                          {colegasList.map((c) => (
                            <option key={c.id} value={c.id}>
                              {fixMojibake(c.nomeCompleto)}
                              {c.crm ? ` — ${c.crm}` : ''}
                            </option>
                          ))}
                        </select>
                        {selectedColegaId && trocaAcaoTipo === 'PERMUTA' ? (
                          <div className="flex flex-col gap-2 pt-1 border-t border-coop-100">
                            <label className="text-xs font-semibold text-coop-600 uppercase tracking-wide">
                              Plantão do colega
                            </label>
                            <p className="text-xs text-coop-600 font-serif">
                              Plantões de <strong>{selectedColega ? fixMojibake(selectedColega.nomeCompleto) : '—'}</strong> nesta
                              escala.
                            </p>
                            {plantoesColegaFetching ? (
                              <p className="text-sm text-coop-600 font-serif">Carregando…</p>
                            ) : plantoesColegaList.length === 0 ? (
                              <p className="text-sm text-amber-800 font-serif">Nenhum plantão disponível para troca.</p>
                            ) : (
                              <select
                                value={selectedPlantaoContrapartidaId ?? ''}
                                onChange={(e) => setSelectedPlantaoContrapartidaId(e.target.value || null)}
                                className="input w-full py-2"
                              >
                                <option value="">Selecione o plantão do colega</option>
                                {plantoesColegaList.map((pl) => (
                                  <option key={pl.id} value={pl.id}>
                                    {formatDataCurta(pl.data)} — {pl.gradeLabel}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : selectedColegaId && trocaAcaoTipo === 'CEDER' ? (
                          <p className="text-sm text-coop-700 font-serif pt-1 border-t border-coop-100">
                            O plantão será cedido a <strong>{selectedColega ? fixMojibake(selectedColega.nomeCompleto) : '—'}</strong>{' '}
                            se ele(a) aceitar.
                          </p>
                        ) : null}
                      </>
                    )}
                    <div className="flex gap-2 justify-end">
                      <button type="button" className="btn btn-secondary" onClick={resetTrocaModal}>
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          trocaDestinoModo === 'colega'
                            ? !selectedColegaId ||
                              (trocaAcaoTipo === 'PERMUTA' &&
                                (!selectedPlantaoContrapartidaId ||
                                  plantoesColegaList.length === 0 ||
                                  plantoesColegaFetching))
                            : false
                        }
                        onClick={() => setTrocaStep(2)}
                      >
                        {trocaAcaoTipo === 'CEDER' ? 'Revisar cessão' : 'Revisar troca'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2 justify-end pt-1">
                    <button type="button" className="btn btn-secondary" onClick={resetTrocaModal}>
                      Cancelar
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {trocaDestinoModo === 'equipe' ? (
                  <>
                    <p className="text-sm text-coop-700 leading-relaxed">
                      Confirme o envio do seu plantão à <strong>equipe</strong>:
                    </p>
                    <ul className="text-sm text-coop-800 list-disc pl-5 space-y-1 font-serif">
                      <li>
                        Seu plantão em{' '}
                        <strong>
                          {trocaMeuPlantaoMeta ? formatDataCurta(trocaMeuPlantaoMeta.data) : '—'}
                        </strong>{' '}
                        (
                        {trocaMeuPlantaoMeta
                          ? faixaExibicaoPlantao({ gradeId: trocaMeuPlantaoMeta.gradeId })
                          : '—'}
                        ){trocaAcaoTipo === 'CEDER' ? ' vai para o primeiro colega que aceitar.' : ' é ofertado à equipe em troca.'}
                      </li>
                      <li>
                        {trocaAcaoTipo === 'CEDER'
                          ? 'Quem aceitar fica com ele, sem dar outro plantão.'
                          : 'O primeiro a aceitar escolhe o plantão dele.'}
                      </li>
                    </ul>
                  </>
                ) : trocaAcaoTipo === 'CEDER' ? (
                  <>
                    <p className="text-sm text-coop-700 leading-relaxed">
                      Confirme a <strong>cessão</strong> para{' '}
                      <strong>{selectedColega ? fixMojibake(selectedColega.nomeCompleto) : '—'}</strong>:
                    </p>
                    <ul className="text-sm text-coop-800 list-disc pl-5 space-y-1 font-serif">
                      <li>
                        Seu plantão em{' '}
                        <strong>
                          {trocaMeuPlantaoMeta ? formatDataCurta(trocaMeuPlantaoMeta.data) : '—'}
                        </strong>{' '}
                        (
                        {trocaMeuPlantaoMeta
                          ? faixaExibicaoPlantao({ gradeId: trocaMeuPlantaoMeta.gradeId })
                          : '—'}
                        ) passará para essa pessoa se ela aceitar.
                      </li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-coop-700 leading-relaxed">
                      Confirme a <strong>troca</strong> com{' '}
                      <strong>{selectedColega ? fixMojibake(selectedColega.nomeCompleto) : '—'}</strong>:
                    </p>
                    <ul className="text-sm text-coop-800 list-disc pl-5 space-y-1 font-serif">
                      <li>
                        Você fica com o plantão dele em{' '}
                        <strong>
                          {plantaoContrapartidaSelecionado
                            ? formatDataCurta(plantaoContrapartidaSelecionado.data)
                            : '—'}
                        </strong>{' '}
                        ({plantaoContrapartidaSelecionado?.gradeLabel ?? '—'}).
                      </li>
                      <li>
                        Ele(a) fica com o seu plantão em{' '}
                        <strong>
                          {trocaMeuPlantaoMeta ? formatDataCurta(trocaMeuPlantaoMeta.data) : '—'}
                        </strong>{' '}
                        (
                        {trocaMeuPlantaoMeta
                          ? faixaExibicaoPlantao({ gradeId: trocaMeuPlantaoMeta.gradeId })
                          : '—'}
                        ).
                      </li>
                    </ul>
                  </>
                )}
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn btn-secondary" onClick={() => setTrocaStep(1)}>
                    Voltar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      trocaMutation.isPending ||
                      !trocaPlantaoId ||
                      (trocaDestinoModo === 'colega' &&
                        (!selectedColegaId ||
                          (trocaAcaoTipo === 'PERMUTA' && !selectedPlantaoContrapartidaId) ||
                          trocaAcaoTipo == null))
                    }
                    onClick={() => trocaMutation.mutate()}
                  >
                    {trocaMutation.isPending ? 'Enviando…' : 'Enviar pedido'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeuCalendarioPlantoes;
