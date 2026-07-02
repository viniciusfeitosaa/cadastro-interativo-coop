import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { notify } from '../lib/notificationEmitter';
import { medicoService } from '../services/medico.service';
import { PONTO_SEM_ESCALA_ESCALA_ID } from '../constants/ponto';
import { pontoService } from '../services/ponto.service';
import { formatCRM, fixMojibake } from '../utils/validation.util';
import {
  faixaExibicaoPlantao,
  fimPlantaoCliente,
  inicioPlantaoCliente,
  type PlantaoAgendaInput,
} from '../utils/plantao-agenda';
import { canTrocarPlantaoAgendaEm, trocaPendenteVisivelNoPainel } from '../utils/troca-plantao-painel';

/** Extrai a hora no formato "HHh" de "HH:mm" ou "HH:mm:ss". */
const toHoraLabel = (horario: string | null | undefined): string | null => {
  if (!horario) return null;
  const part = String(horario).trim().slice(0, 5);
  if (part.length < 5) return null;
  const [h] = part.split(':');
  return `${h}h`;
};

/** Escala + ponto: link e check-in a partir de 10 min antes do início até o fim do plantão. */
const MINUTOS_ANTES_INICIO_PARA_CHECKIN = 10;

function podeExibirLinkBaterPontoAgenda(dataStr: string, p: PlantaoAgendaInput, at: Date): boolean {
  const inicio = inicioPlantaoCliente(dataStr, p);
  const fim = fimPlantaoCliente(dataStr, p);
  const abertura = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_CHECKIN * 60 * 1000);
  return at.getTime() >= abertura.getTime() && at.getTime() <= fim.getTime();
}

function antesDaAberturaCheckinPonto(dataStr: string, p: PlantaoAgendaInput, at: Date): boolean {
  const inicio = inicioPlantaoCliente(dataStr, p);
  const abertura = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_CHECKIN * 60 * 1000);
  return at.getTime() < abertura.getTime();
}

function mensagemLinkBaterPontoAntesDaJanela(dataStr: string, p: PlantaoAgendaInput): string {
  const inicio = inicioPlantaoCliente(dataStr, p);
  const abertura = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_CHECKIN * 60 * 1000);
  const hm = abertura.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `Ponto a partir das ${hm}.`;
}

function canTrocarPlantaoAgenda(dataStr: string, p: PlantaoAgendaInput): boolean {
  return canTrocarPlantaoAgendaEm(dataStr, p, new Date());
}

function isPlantaoAindaFuturoAgenda(dataStr: string, p: PlantaoAgendaInput): boolean {
  const now = new Date();
  const fim = fimPlantaoCliente(dataStr, p);
  return now < fim;
}

/** Formata data para exibição (ex.: "27 fev."). */
function formatDataCurta(dataStr: string): string {
  const d = new Date(dataStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** Retorna primeiro e segundo nome. */
const primeiroSegundoNome = (nome?: string | null): string => {
  const n = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (n.length === 0) return nome ?? '';
  if (n.length === 1) return n[0];
  return `${n[0]} ${n[1]}`;
};

const formatFaixaEscala = (
  gradeFaixas: string[] | undefined,
  gradeIds: string[] | undefined,
  horarioEntrada: string | null | undefined,
  horarioSaida: string | null | undefined
): string => {
  if (gradeFaixas && gradeFaixas.length > 0) {
    return gradeFaixas.filter(Boolean).join(' e ');
  }
  if (gradeIds && gradeIds.length > 0) {
    const faixas = gradeIds.map((g) => faixaExibicaoPlantao({ gradeId: g })).filter(Boolean);
    if (faixas.length > 0) return faixas.join(' e ');
  }
  const entrada = toHoraLabel(horarioEntrada);
  const saida = toHoraLabel(horarioSaida);
  if (entrada && saida) return `${entrada} às ${saida}`;
  return '07h às 19h ou 19h às 07h';
};

const Dashboard = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';
  const isMedico = user?.role === 'MEDICO';

  const [forceLegacyQueries, setForceLegacyQueries] = useState(false);

  const {
    data: dashboardResp,
    isError: isDashboardError,
    isLoading: isDashboardLoading,
  } = useQuery({
    queryKey: ['medico', 'dashboard', user?.id],
    queryFn: () => medicoService.getDashboard(),
    enabled: !!user && isMedico && !isMaster && !forceLegacyQueries,
    staleTime: 30 * 1000,
    retry: false,
  });

  // Se o endpoint agregado falhar, cai automaticamente para as queries legadas (mais seguro).
  useEffect(() => {
    if (isDashboardError) setForceLegacyQueries(true);
  }, [isDashboardError]);

  const {
    data: perfilLegacy,
    isLoading: isPerfilLegacyLoading,
  } = useQuery({
    queryKey: ['medico', 'perfil', user?.id],
    queryFn: async () => {
      const response = await medicoService.getPerfil();
      return response.data;
    },
    enabled: !!user && isMedico && !isMaster && forceLegacyQueries,
    staleTime: 5 * 60 * 1000,
  });

  const { data: meuDiaLegacy } = useQuery({
    queryKey: ['ponto', 'meu-dia'],
    queryFn: () => pontoService.getMeuDia(),
    enabled: !!user && isMedico && !isMaster && forceLegacyQueries,
    staleTime: 30 * 1000,
  });

  const { data: escalasLegacy } = useQuery({
    queryKey: ['ponto', 'minhas-escalas'],
    queryFn: () => pontoService.listMinhasEscalas(),
    enabled: !!user && isMedico && !isMaster && forceLegacyQueries,
    staleTime: 30 * 1000,
  });

  const { data: proximosLegacy } = useQuery({
    queryKey: ['ponto', 'proximos-plantoes'],
    queryFn: () => pontoService.listProximosPlantoes(),
    enabled: !!user && isMedico && !isMaster && forceLegacyQueries,
    staleTime: 15 * 1000,
  });

  const { data: docsLegacy } = useQuery({
    queryKey: ['medico', 'documentos-enviados', user?.id],
    queryFn: () => medicoService.listDocumentosEnviados(),
    enabled: !!user && isMedico && !isMaster && forceLegacyQueries,
    staleTime: 2 * 60 * 1000,
  });

  const perfil = forceLegacyQueries ? perfilLegacy : dashboardResp?.data?.perfil;
  const meuDiaResp = forceLegacyQueries
    ? meuDiaLegacy
      ? { data: meuDiaLegacy.data ?? meuDiaLegacy }
      : undefined
    : dashboardResp
      ? { data: dashboardResp.data.meuDia }
      : undefined;
  const escalasResp = forceLegacyQueries
    ? escalasLegacy
      ? { data: (escalasLegacy as any).data ?? escalasLegacy }
      : undefined
    : dashboardResp
      ? { data: dashboardResp.data.escalas }
      : undefined;
  const proximosResp = useMemo(
    () =>
      forceLegacyQueries
        ? proximosLegacy
          ? { data: (proximosLegacy as any).data ?? proximosLegacy }
          : undefined
        : dashboardResp
          ? { data: dashboardResp.data.proximosPlantoes }
          : undefined,
    [forceLegacyQueries, proximosLegacy, dashboardResp]
  );
  const docsResp = forceLegacyQueries
    ? docsLegacy
      ? { data: (docsLegacy as any).data ?? docsLegacy }
      : undefined
    : dashboardResp
      ? { data: dashboardResp.data.documentosEnviados }
      : undefined;

  // Loading “seguro”: só bloqueia se não tiver nada para renderizar ainda (nem user/perfil).
  const shouldBlock =
    (!!user && isMedico && !isMaster) &&
    ((isDashboardLoading && !forceLegacyQueries && !perfil) ||
      (forceLegacyQueries && isPerfilLegacyLoading && !perfil));

  const documentosDisponiveis = docsResp?.data ?? [];
  const displayUser = isMaster ? user : perfil || user;
  const rawEscalas = escalasResp?.data ?? escalasResp;
  const listaEscalas = Array.isArray(rawEscalas) ? rawEscalas : [];
  type EscalaItem = {
    id?: string;
    nome?: string;
    ativo?: boolean;
    dataInicio?: string;
    dataFim?: string;
    gradeIds?: string[];
    gradeFaixas?: string[];
  };
  const escalasEmVigor = listaEscalas.filter((e: EscalaItem) => {
    if (e?.ativo === false) return false;
    const inicio = e?.dataInicio ? new Date(e.dataInicio) : null;
    const fim = e?.dataFim ? new Date(e.dataFim) : null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (inicio && inicio > hoje) return false;
    if (fim) {
      const fimDia = new Date(fim);
      fimDia.setHours(23, 59, 59, 999);
      if (fimDia < hoje) return false;
    }
    return true;
  });
  const escalaAtiva = escalasEmVigor.length > 0 ? (escalasEmVigor[0] as EscalaItem) : (listaEscalas[0] as EscalaItem) ?? null;
  const escalaNome = escalaAtiva?.nome ?? null;
  const minhasEquipes = Array.from(
    new Set(
      [
        ...((meuDiaResp?.data?.minhasEquipes as string[] | undefined) ?? []),
        ...listaEscalas.flatMap((e: any) => (Array.isArray(e?.equipes) ? e.equipes : [])),
      ]
        .map((nome: string) => fixMojibake(String(nome || '').trim()))
        .filter(Boolean)
    )
  );
  const configHorario = meuDiaResp?.data?.configHorario as { horarioEntrada?: string | null; horarioSaida?: string | null } | undefined;
  const faixaHorario = formatFaixaEscala(
    escalaAtiva?.gradeFaixas,
    escalaAtiva?.gradeIds,
    configHorario?.horarioEntrada ?? null,
    configHorario?.horarioSaida ?? null
  );
  type PlantaoProximo = PlantaoAgendaInput & {
    id: string;
    data: string;
    gradeId: string;
    escalaId: string;
    escalaNome: string | null;
    permiteTrocaPlantao?: boolean;
    tipoNome?: string | null;
    tipoOrdem?: number | null;
    usaPonto?: boolean;
    usaEscala?: boolean;
  };
  const proximosList = useMemo(() => {
    const raw = (proximosResp?.data ?? proximosResp ?? []) as PlantaoProximo[];
    return [...raw].sort((a, b) => {
      const ta = inicioPlantaoCliente(a.data, a).getTime();
      const tb = inicioPlantaoCliente(b.data, b).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [proximosResp]);
  const proxima = proximosList[0] ?? null;
  const segundaProxima = proximosList[1] ?? null;
  const temProximosPlantoes = proximosList.length > 0;
  const temContratoComEscala =
    (meuDiaResp?.data as { temContratoComEscala?: boolean } | undefined)?.temContratoComEscala !== false;

  const [relogioUi, setRelogioUi] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setRelogioUi(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

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
  const [showAceitarEquipeModal, setShowAceitarEquipeModal] = useState(false);
  const [aceitarEquipeCtx, setAceitarEquipeCtx] = useState<{
    solicitacaoId: string;
    escalaId: string;
  } | null>(null);
  const [aceitarMeuPlantaoId, setAceitarMeuPlantaoId] = useState<string | null>(null);

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

  const abrirTrocaDashboard = (pl: PlantaoProximo) => {
    setTrocaEscalaId(pl.escalaId);
    setTrocaPlantaoId(pl.id);
    setTrocaMeuPlantaoMeta({ data: pl.data, gradeId: pl.gradeId });
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
  const colegasList = (colegasResp?.data ?? colegasResp ?? []) as Array<{ id: string; nomeCompleto: string; crm?: string | null }>;
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

  const { data: trocasPendentesResp } = useQuery({
    queryKey: ['ponto', 'trocas-plantao-pendentes'],
    queryFn: () => pontoService.listTrocasPlantaoPendentes(),
    enabled: !!user && isMedico && !isMaster,
    staleTime: 10 * 1000,
  });
  const trocasRecebidas = useMemo(
    () => trocasPendentesResp?.data?.recebidas ?? [],
    [trocasPendentesResp?.data?.recebidas]
  );
  const trocasEnviadas = useMemo(
    () => trocasPendentesResp?.data?.enviadas ?? [],
    [trocasPendentesResp?.data?.enviadas]
  );

  const trocasRecebidasVisiveis = useMemo(
    () => trocasRecebidas.filter((t) => trocaPendenteVisivelNoPainel(t, relogioUi)),
    [trocasRecebidas, relogioUi]
  );
  const trocasEnviadasVisiveis = useMemo(
    () => trocasEnviadas.filter((t) => trocaPendenteVisivelNoPainel(t, relogioUi)),
    [trocasEnviadas, relogioUi]
  );

  const { data: meusPlantoesAceiteResp, isFetching: meusPlantoesAceiteFetching } = useQuery({
    queryKey: ['ponto', 'meus-plantoes-troca', aceitarEquipeCtx?.escalaId],
    queryFn: () => pontoService.listMeusPlantoesParaTroca(aceitarEquipeCtx!.escalaId),
    enabled: !!user && isMedico && showAceitarEquipeModal && !!aceitarEquipeCtx?.escalaId,
  });
  const meusPlantoesAceiteList = meusPlantoesAceiteResp?.data ?? [];

  const aceitarTrocaMutation = useMutation({
    mutationFn: (p: { id: string; plantaoContrapartidaId?: string }) =>
      pontoService.aceitarTrocaPlantao(
        p.id,
        p.plantaoContrapartidaId ? { plantaoContrapartidaId: p.plantaoContrapartidaId } : undefined
      ),
    onSuccess: () => {
      notify({ kind: 'success', title: 'Pedido aceito', message: 'Plantão atualizado com sucesso.', source: 'ponto' });
      setShowAceitarEquipeModal(false);
      setAceitarEquipeCtx(null);
      setAceitarMeuPlantaoId(null);
      queryClient.invalidateQueries({ queryKey: ['ponto', 'trocas-plantao-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['ponto', 'proximos-plantoes'] });
      queryClient.invalidateQueries({ queryKey: ['medico', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['medico', 'notificacoes'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'escalas'] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      notify({ kind: 'error', title: 'Não foi possível aceitar', message: msg ?? 'Tente novamente.', source: 'ponto' });
    },
  });

  const recusarTrocaMutation = useMutation({
    mutationFn: (id: string) => pontoService.recusarTrocaPlantao(id),
    onSuccess: () => {
      notify({ kind: 'success', title: 'Troca recusada', message: 'A solicitação foi recusada.', source: 'ponto' });
      queryClient.invalidateQueries({ queryKey: ['ponto', 'trocas-plantao-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'escalas'] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      notify({ kind: 'error', title: 'Não foi possível recusar', message: msg ?? 'Tente novamente.', source: 'ponto' });
    },
  });

  const faixaPorPlantao = (p: PlantaoProximo | null) =>
    p ? faixaExibicaoPlantao(p) : '07h às 19h';

  if (shouldBlock) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-coop-200 border-t-coop-600 mx-auto" />
          <p className="mt-4 text-coop-700 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Hero */}
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-coop-600 mb-2 font-display">
          {isMaster ? 'Acesso Master' : 'Acesso Profissional'}
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-coop-900 font-display leading-tight mb-2">
          Bem-vindo, {fixMojibake(primeiroSegundoNome(displayUser?.nomeCompleto))}!
        </h1>
        <p className="text-coop-700 font-serif text-base">
          Sistema de gestão COOPVITTA
        </p>
      </div>

      {isMedico && !isMaster && temContratoComEscala && (temProximosPlantoes || listaEscalas.length > 0) && (
        <div className="col-span-full stagger-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-semibold text-coop-800 font-display">Suas próximas escalas</h2>
            <Link
              to="/meu-calendario-plantoes"
              className="btn btn-secondary text-xs sm:text-sm shrink-0"
            >
              Calendário de escalas
            </Link>
          </div>
          {!temProximosPlantoes && (
            <p className="text-xs text-coop-600 px-1 font-serif leading-relaxed">
              Não há plantões futuros em destaque. Abra o calendário para ver todas as suas alocações por mês.
            </p>
          )}
          {/* Próxima escala */}
          {proxima && (
            <div className="card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-coop-500 bg-gradient-to-r from-coop-50/60 to-transparent">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-coop-600 mb-0.5">Próxima escala</p>
                <p className="text-coop-900 font-medium text-sm">
                  Você tem escala para <span className="font-bold text-coop-800">{fixMojibake(proxima.escalaNome || 'Escala')}</span> no dia{' '}
                  <span className="font-bold text-coop-800">{formatDataCurta(proxima.data)}</span> no horário{' '}
                  <span className="font-bold text-coop-800">{faixaPorPlantao(proxima)}</span>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {proxima.permiteTrocaPlantao === false
                  ? null
                  : canTrocarPlantaoAgenda(proxima.data, proxima)
                    ? (
                        <button
                          type="button"
                          onClick={() => abrirTrocaDashboard(proxima)}
                          className="btn btn-secondary text-sm"
                        >
                          Trocar / ceder
                        </button>
                      )
                    : (
                        <span className="text-xs text-coop-600 max-w-[14rem]">
                          {isPlantaoAindaFuturoAgenda(proxima.data, proxima)
                            ? 'Período de troca encerrado'
                            : 'Plantão já passou'}
                        </span>
                      )}
                {proxima.usaPonto === false ? (
                  <span className="text-xs text-coop-600 max-w-[14rem] text-right">
                    Ponto eletrônico não está habilitado para esta escala.
                  </span>
                ) : proxima.usaEscala === false ? (
                  <Link to="/ponto-eletronico" className="btn btn-primary text-sm">
                    Bater ponto
                  </Link>
                ) : podeExibirLinkBaterPontoAgenda(proxima.data, proxima, relogioUi) ? (
                  <Link to="/ponto-eletronico" className="btn btn-primary text-sm">
                    Bater ponto
                  </Link>
                ) : antesDaAberturaCheckinPonto(proxima.data, proxima, relogioUi) ? (
                  <span className="text-xs text-coop-600 max-w-[14rem] text-right leading-snug">
                    {mensagemLinkBaterPontoAntesDaJanela(proxima.data, proxima)}
                  </span>
                ) : null}
              </div>
            </div>
          )}
          {/* Segunda próxima escala */}
          {segundaProxima && (
            <div className="card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-coop-400/80 bg-gradient-to-r from-coop-50/40 to-transparent">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-coop-600 mb-0.5">Segunda próxima</p>
                <p className="text-coop-900 font-medium text-sm">
                  Você tem escala para <span className="font-bold text-coop-800">{fixMojibake(segundaProxima.escalaNome || 'Escala')}</span> no dia{' '}
                  <span className="font-bold text-coop-800">{formatDataCurta(segundaProxima.data)}</span> no horário{' '}
                  <span className="font-bold text-coop-800">{faixaPorPlantao(segundaProxima)}</span>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {segundaProxima.permiteTrocaPlantao === false
                  ? null
                  : canTrocarPlantaoAgenda(segundaProxima.data, segundaProxima)
                    ? (
                        <button
                          type="button"
                          onClick={() => abrirTrocaDashboard(segundaProxima)}
                          className="btn btn-secondary text-sm"
                        >
                          Trocar / ceder
                        </button>
                      )
                    : (
                        <span className="text-xs text-coop-600 max-w-[14rem]">
                          {isPlantaoAindaFuturoAgenda(segundaProxima.data, segundaProxima)
                            ? 'Período de troca encerrado'
                            : 'Plantão já passou'}
                        </span>
                      )}
                {segundaProxima.usaPonto === false ? (
                  <span className="text-xs text-coop-600 max-w-[14rem] text-right">
                    Ponto eletrônico não está habilitado para esta escala.
                  </span>
                ) : segundaProxima.usaEscala === false ? (
                  <Link to="/ponto-eletronico" className="btn btn-primary text-sm">
                    Bater ponto
                  </Link>
                ) : podeExibirLinkBaterPontoAgenda(segundaProxima.data, segundaProxima, relogioUi) ? (
                  <Link to="/ponto-eletronico" className="btn btn-primary text-sm">
                    Bater ponto
                  </Link>
                ) : antesDaAberturaCheckinPonto(segundaProxima.data, segundaProxima, relogioUi) ? (
                  <span className="text-xs text-coop-600 max-w-[14rem] text-right leading-snug">
                    {mensagemLinkBaterPontoAntesDaJanela(segundaProxima.data, segundaProxima)}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {isMedico &&
        !isMaster &&
        (trocasRecebidasVisiveis.length > 0 || trocasEnviadasVisiveis.length > 0) && (
        <div className="card col-span-full stagger-2 border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-orange-50/40">
          <h3 className="text-sm font-semibold text-amber-900 font-display mb-3">Pedidos de plantão pendentes</h3>
          <div className="space-y-3">
            {trocasRecebidasVisiveis.map((t) => (
              <div key={t.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-amber-950">
                  {t.paraEquipeInteira ? (
                    (t.tipoSolicitacao ?? 'PERMUTA') === 'CEDER' ? (
                      <>
                        <strong>{fixMojibake(t.solicitante.nomeCompleto)}</strong> cedeu o plantão do dia{' '}
                        <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                        {faixaExibicaoPlantao({ gradeId: t.gradeId })}) à <strong>equipe</strong>. O primeiro a aceitar assume esse
                        plantão (sem permuta).
                      </>
                    ) : (
                      <>
                        <strong>{fixMojibake(t.solicitante.nomeCompleto)}</strong> abriu permuta com a <strong>equipe</strong> pelo
                        plantão do dia <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                        {faixaExibicaoPlantao({ gradeId: t.gradeId })}). O primeiro a aceitar escolhe qual plantão seu permuta.
                      </>
                    )
                  ) : (t.tipoSolicitacao ?? 'PERMUTA') === 'CEDER' ? (
                    <>
                      <strong>{fixMojibake(t.solicitante.nomeCompleto)}</strong> está cedendo a <strong>você</strong> o plantão do dia{' '}
                      <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                      {faixaExibicaoPlantao({ gradeId: t.gradeId })}).
                    </>
                  ) : t.contrapartidaPlantaoId && t.dataPlantaoContrapartida && t.gradeIdContrapartida ? (
                    <>
                      <strong>{fixMojibake(t.solicitante.nomeCompleto)}</strong> propõe permutar: você assume o plantão dele no dia{' '}
                      <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                      {faixaExibicaoPlantao({ gradeId: t.gradeId })}) e ele(a) assume o seu no dia{' '}
                      <strong>{formatDataCurta(String(t.dataPlantaoContrapartida).slice(0, 10))}</strong> (
                      {faixaExibicaoPlantao({ gradeId: t.gradeIdContrapartida })}).
                    </>
                  ) : (
                    <>
                      <strong>{fixMojibake(t.solicitante.nomeCompleto)}</strong> solicitou troca em{' '}
                      <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                      {faixaExibicaoPlantao({ gradeId: t.gradeId })}).
                    </>
                  )}
                </p>
                <div className="flex gap-2">
                  {!t.paraEquipeInteira ? (
                    <button
                      type="button"
                      className="btn btn-secondary text-sm"
                      disabled={aceitarTrocaMutation.isPending || recusarTrocaMutation.isPending}
                      onClick={() => recusarTrocaMutation.mutate(t.id)}
                    >
                      Recusar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary text-sm"
                    disabled={aceitarTrocaMutation.isPending || recusarTrocaMutation.isPending}
                    onClick={() => {
                      const exigeMeuPlantao =
                        t.paraEquipeInteira && (t.tipoSolicitacao ?? 'PERMUTA') === 'PERMUTA';
                      if (exigeMeuPlantao) {
                        setAceitarEquipeCtx({ solicitacaoId: t.id, escalaId: t.escalaId });
                        setAceitarMeuPlantaoId(null);
                        setShowAceitarEquipeModal(true);
                      } else {
                        aceitarTrocaMutation.mutate({ id: t.id });
                      }
                    }}
                  >
                    Aceitar
                  </button>
                </div>
              </div>
            ))}
            {trocasEnviadasVisiveis.map((t) => (
              <div key={t.id} className="rounded-xl border border-coop-200/70 bg-coop-50/40 p-3">
                <p className="text-sm text-coop-800">
                  {t.paraEquipeInteira ? (
                    (t.tipoSolicitacao ?? 'PERMUTA') === 'CEDER' ? (
                      <>
                        Cessão aberta à <strong>equipe</strong>: seu plantão no dia{' '}
                        <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                        {faixaExibicaoPlantao({ gradeId: t.gradeId })}). O primeiro colega a aceitar assume o plantão.
                      </>
                    ) : (
                      <>
                        Troca aberta à <strong>equipe</strong>: seu plantão no dia{' '}
                        <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                        {faixaExibicaoPlantao({ gradeId: t.gradeId })}). Aguardando o primeiro colega a aceitar.
                      </>
                    )
                  ) : (t.tipoSolicitacao ?? 'PERMUTA') === 'CEDER' && t.destino ? (
                    <>
                      Cessão enviada para <strong>{fixMojibake(t.destino.nomeCompleto)}</strong>: seu plantão no dia{' '}
                      <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                      {faixaExibicaoPlantao({ gradeId: t.gradeId })}).
                    </>
                  ) : t.contrapartidaPlantaoId && t.dataPlantaoContrapartida && t.gradeIdContrapartida && t.destino ? (
                    <>
                      Troca enviada para <strong>{fixMojibake(t.destino.nomeCompleto)}</strong>: seu plantão no dia{' '}
                      <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                      {faixaExibicaoPlantao({ gradeId: t.gradeId })}) pelo plantão dele(a) no dia{' '}
                      <strong>{formatDataCurta(String(t.dataPlantaoContrapartida).slice(0, 10))}</strong> (
                      {faixaExibicaoPlantao({ gradeId: t.gradeIdContrapartida })}).
                    </>
                  ) : t.destino ? (
                    <>
                      Solicitação enviada para <strong>{fixMojibake(t.destino.nomeCompleto)}</strong> em{' '}
                      <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                      {faixaExibicaoPlantao({ gradeId: t.gradeId })}).
                    </>
                  ) : (
                    <>
                      Solicitação registrada — plantão no dia{' '}
                      <strong>{formatDataCurta(String(t.dataPlantao).slice(0, 10))}</strong> (
                      {faixaExibicaoPlantao({ gradeId: t.gradeId })}).
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback: tem escala ativa mas nenhum plantão futuro (ex.: escala sem grade definida) */}
      {isMedico &&
        temContratoComEscala &&
        escalasEmVigor.some((e: EscalaItem) => e?.id && e.id !== PONTO_SEM_ESCALA_ESCALA_ID) &&
        !temProximosPlantoes && (
        <div className="card col-span-full stagger-2 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-coop-500 bg-gradient-to-r from-coop-50/60 to-transparent">
          <p className="text-coop-900 font-medium text-sm">
            Escala cadastrada:{' '}
            <span className="font-bold text-coop-800">{fixMojibake(escalaNome || '—')}</span>
          </p>
        </div>
      )}

      {/* Modal permutar plantão (seu plantão ↔ plantão do colega) */}
      {showTrocaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={resetTrocaModal}>
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

      {showAceitarEquipeModal && aceitarEquipeCtx && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          onClick={() => {
            setShowAceitarEquipeModal(false);
            setAceitarEquipeCtx(null);
            setAceitarMeuPlantaoId(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-coop-900 font-display">Aceitar permuta da equipe</h3>
            <p className="text-sm text-coop-700 font-serif">
              Escolha <strong>seu</strong> plantão nesta escala que você oferece em troca.
            </p>
            {meusPlantoesAceiteFetching ? (
              <p className="text-sm text-coop-600 font-serif">Carregando…</p>
            ) : meusPlantoesAceiteList.length === 0 ? (
              <p className="text-sm text-amber-800 font-serif">Nenhum plantão seu disponível para troca aqui.</p>
            ) : (
              <select
                value={aceitarMeuPlantaoId ?? ''}
                onChange={(e) => setAceitarMeuPlantaoId(e.target.value || null)}
                className="input w-full py-2"
              >
                <option value="">Selecione seu plantão</option>
                {meusPlantoesAceiteList.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {formatDataCurta(pl.data)} — {pl.gradeLabel}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowAceitarEquipeModal(false);
                  setAceitarEquipeCtx(null);
                  setAceitarMeuPlantaoId(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  aceitarTrocaMutation.isPending ||
                  !aceitarMeuPlantaoId ||
                  meusPlantoesAceiteList.length === 0
                }
                onClick={() =>
                  aceitarTrocaMutation.mutate({
                    id: aceitarEquipeCtx.solicitacaoId,
                    plantaoContrapartidaId: aceitarMeuPlantaoId!,
                  })
                }
              >
                {aceitarTrocaMutation.isPending ? 'Confirmando…' : 'Confirmar permuta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Acesso rápido Master */}
      {isMaster && (
        <div className="card col-span-full stagger-2 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-coop-500 bg-gradient-to-r from-coop-50/60 to-transparent">
          <p className="text-coop-900 font-medium text-sm font-display">
            Acesso rápido às áreas de gestão
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/escalas" className="btn-sm btn-primary">Escalas</Link>
            <Link to="/medicos" className="btn-sm btn-primary">Médicos</Link>
            <Link to="/relatorios" className="btn-sm btn-primary">Relatórios</Link>
          </div>
        </div>
      )}

      {/* Card de Informações */}
      <div className="card stagger-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-coop-600 mb-4 font-display">
          Informações Pessoais
        </h3>
        <div className="space-y-3">
          {!isMaster && (displayUser?.profissao || (displayUser?.especialidades?.length ?? 0) > 0) && (
            <div className="rounded-xl bg-coop-100/80 border border-coop-200/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Identificação profissional</p>
              {displayUser?.profissao && (
                <p className="text-sm font-semibold text-coop-900 mt-1 font-display">
                  {fixMojibake(displayUser.profissao)}
                </p>
              )}
              {(displayUser?.especialidades?.length ?? 0) > 0 && (
                <p className="text-xs text-coop-800 mt-0.5 font-serif">
                  {fixMojibake(displayUser!.especialidades!.join(', '))}
                </p>
              )}
            </div>
          )}
          {!isMaster && displayUser?.crm && (
            <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">CRM</p>
              <p className="text-sm font-semibold text-coop-900 mt-0.5 font-display">{formatCRM(displayUser.crm)}</p>
            </div>
          )}
          {!isMaster && (
            <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Tipo de vínculo</p>
              <p className="text-sm font-semibold text-coop-900 mt-0.5">
                {displayUser?.vinculo?.toUpperCase() === 'PJ' ? 'PJ' : 'Associado'}
              </p>
            </div>
          )}
          {!isMaster && (
            <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Equipes vinculadas</p>
              {minhasEquipes.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {minhasEquipes.map((nome) => (
                    <span
                      key={nome}
                      className="inline-flex items-center rounded-full border border-coop-200 bg-white px-2.5 py-1 text-[11px] font-medium text-coop-800"
                    >
                      {nome}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-coop-700 mt-1 font-serif">Sem equipe vinculada no momento.</p>
              )}
            </div>
          )}
          {isMaster && (
            <>
              <div className="rounded-xl bg-coop-100/80 border border-coop-200/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600 font-display">Perfil</p>
                <p className="text-sm font-semibold text-coop-900 mt-1 font-display">Administrador Master</p>
              </div>
              {displayUser?.email && (
                <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600 font-display">Email de contato</p>
                  <p className="text-sm font-medium text-coop-900 mt-0.5 break-all font-display">{fixMojibake(displayUser.email)}</p>
                </div>
              )}
            </>
          )}
          {false && !isMaster && listaEscalas.length > 0 && (
            <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Escala(s)</p>
              <p className="text-xs font-medium text-coop-900 mt-1 leading-snug">
                <span className="font-semibold">{fixMojibake(escalaNome ?? '—')}</span>
                <span className="text-coop-600"> · </span>
                <span className="font-medium">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
                <span className="text-coop-600"> · </span>
                <span className="font-medium">{faixaHorario}</span>
              </p>
              <div className="mt-3">
                <Link
                  to="/ponto-eletronico"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-coop-700 hover:text-coop-900 transition"
                >
                  Bater ponto
                  <span aria-hidden className="text-coop-500">→</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Documentos disponíveis (profissional) */}
      {!isMaster && (
        <div className="card col-span-full stagger-5 border-l-4 border-l-coop-500 bg-gradient-to-br from-white to-coop-50/30">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-coop-800 font-display">
                Documentos enviados para você
              </h3>
              <p className="text-xs text-coop-600 mt-1 font-serif max-w-xl">
                Acesse Documentos para registar ciência depois de ler (visível para o Master em Envio de Documentos).
              </p>
            </div>
            <Link
              to="/documentos"
              className="btn-sm btn-primary shrink-0 inline-flex items-center gap-1.5"
            >
              Ver todos
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          {documentosDisponiveis.length > 0 && (
            <ul className="space-y-1 rounded-xl overflow-hidden">
              {documentosDisponiveis.map(
                (doc: {
                  id: string;
                  titulo?: string | null;
                  nomeArquivo: string;
                  createdAt: string;
                  aceitoEm?: string | null;
                }) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-coop-50/50 hover:bg-coop-100/50 active:bg-coop-100/80 border border-coop-200/40 transition text-left cursor-pointer"
                    onClick={() => medicoService.openDocumentoEnviado(doc.id, doc.nomeArquivo)}
                  >
                    <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-coop-200/50 flex items-center justify-center text-coop-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-coop-900 truncate text-xs font-display">
                        {doc.titulo || doc.nomeArquivo}
                      </p>
                      {doc.titulo && (
                        <p className="text-[10px] text-coop-600 truncate mt-0.5">{doc.nomeArquivo}</p>
                      )}
                    </div>
                    {doc.aceitoEm ? (
                      <span className="text-[10px] font-medium text-green-800 shrink-0 px-2 py-0.5 rounded bg-green-100/90">
                        Ciência OK
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-800 shrink-0 px-2 py-0.5 rounded bg-amber-100/90">
                        Pendente
                      </span>
                    )}
                    <span className="btn-sm btn-primary shrink-0 pointer-events-none">Visualizar</span>
                  </button>
                </li>
              )
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
