import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import { useMasterEscopo } from '../context/MasterEscopoContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  adminService,
  Escala,
  type AdminMedico,
  type EscalaPlantao,
  type HistoricoTrocaPlantaoEscala,
  type TipoPlantaoConfig,
} from '../services/admin.service';
import { fixMojibake } from '../utils/validation.util';
import { notify } from '../lib/notificationEmitter';

interface EscalaFormState {
  contratoAtivoId: string;
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
}

const emptyForm: EscalaFormState = {
  contratoAtivoId: '',
  nome: '',
  descricao: '',
  dataInicio: '',
  dataFim: '',
  ativo: false,
};

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

/** Datas padrão para nova escala (início do ano atual até fim do próximo). O usuário não define período. */
const getDefaultScaleDates = () => {
  const ano = new Date().getFullYear();
  return { dataInicio: `${ano}-01-01`, dataFim: `${ano + 1}-12-31` };
};

function dateToInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type GradeColDef = {
  id: string;
  label: string;
  horario: string;
  tipo: string;
  regua: [string, string];
};

const FALLBACK_GRADES: GradeColDef[] = [
  { id: 'mt', label: 'MT', horario: '07-19', tipo: 'Diurno', regua: ['07:00', '19:00'] },
  { id: 'sn', label: 'SN', horario: '19-07', tipo: 'Noturno', regua: ['19:00', '07:00'] },
];

/** Fim do dia civil local (YYYY-MM-DD) para comparar com createdAt dos tipos. */
function endOfLocalCalendarDayYmd(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function tipoPlantaoToGradeCol(t: TipoPlantaoConfig): GradeColDef {
  return {
    id: t.id,
    label: t.nome.length > 12 ? `${t.nome.slice(0, 10)}…` : t.nome,
    horario: `${t.horaInicio.slice(0, 5)}-${t.horaFim.slice(0, 5)}`,
    tipo: t.nome,
    regua: [t.horaInicio.slice(0, 5), t.horaFim.slice(0, 5)] as [string, string],
  };
}

function getMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function getWeekDates(weekStart: Date): Date[] {
  const out: Date[] = [];
  const m = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    out.push(new Date(m));
    m.setDate(m.getDate() + 1);
  }
  return out;
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Chave estável YYYY-MM e título legível (ex.: "Abril de 2026") para agrupar o histórico. */
function monthKeyAndLabel(d: Date): { key: string; label: string } {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const key = `${y}-${String(m).padStart(2, '0')}`;
  const raw = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  return { key, label };
}

function formatDayName(d: Date): string {
  const i = d.getDay();
  const names = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return names[i];
}

/** Ex.: "2026-04" → "Abril de 2026" */
function formatMesAnoFromYM(ym: string): string {
  const parts = ym.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  if (!y || !m || m < 1 || m > 12) return ym;
  const d = new Date(y, m - 1, 1);
  const raw = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Primeiras duas palavras do nome para exibir na célula */
function shortName(nomeCompleto: string): string {
  const parts = nomeCompleto.trim().split(/\s+/);
  if (parts.length <= 2) return nomeCompleto.trim();
  return parts.slice(0, 2).join(' ');
}

/** Texto seguro para Helvetica no jsPDF (evita células corrompidas com Unicode raro). */
function textoSeguroPdf(s: string): string {
  return String(s)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2013|\u2014|\u2212/g, '-');
}

function formatValorHora(valor: string | number | null | undefined): string {
  if (valor == null || valor === '') return '—';
  const n = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

/** Escala cujo período (data fim) já terminou antes de hoje. */
function isEscalaEncerrada(dataFim: string): boolean {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const f = new Date(toDateInput(dataFim) + 'T12:00:00');
  f.setHours(0, 0, 0, 0);
  return f < hoje;
}

function formatDuracaoMinutos(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
}

const Escalas = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const {
    contratoId: filtroListaContratoId,
    subgrupoId: selectedSubgrupoId,
    equipeId: selectedEquipeId,
    setContratoId: setFiltroListaContratoId,
    setSubgrupoId: setSelectedSubgrupoId,
    setEquipeId: setSelectedEquipeId,
  } = useMasterEscopo();
  const [selectedEscalaId, setSelectedEscalaId] = useState<string>('');
  const [editingEscalaId, setEditingEscalaId] = useState<string | null>(null);
  const [form, setForm] = useState<EscalaFormState>(emptyForm);
  const [medicoIdToAllocate, setMedicoIdToAllocate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [adicionalPercentualInput, setAdicionalPercentualInput] = useState<string>('');
  const [adicionalDiaOpenGradeId, setAdicionalDiaOpenGradeId] = useState<string | null>(null);
  const [weekStart] = useState<Date>(() => getMonday(new Date()));
  /** Primeiro dia do mês exibido na grade mensal (layout principal da escala). */
  const [gradeMonthStart, setGradeMonthStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  /** Modal do formulário Nova escala / Editar escala. */
  const [escalaFormModalOpen, setEscalaFormModalOpen] = useState(false);
  const [medicoAllocateSearch, setMedicoAllocateSearch] = useState('');
  const [medicoAllocateOpen, setMedicoAllocateOpen] = useState(false);
  const medicoAllocateRef = useRef<HTMLDivElement>(null);
  const [medicoIdToAllocateCell, setMedicoIdToAllocateCell] = useState('');
  const [medicoAllocateCellSearch, setMedicoAllocateCellSearch] = useState('');
  const [medicoAllocateCellOpen, setMedicoAllocateCellOpen] = useState(false);
  const medicoAllocateCellRef = useRef<HTMLDivElement>(null);
  /** Rótulos de médicos escolhidos na busca (ID pode não estar mais na página atual da API). */
  const [medicoPickLabels, setMedicoPickLabels] = useState<Record<string, { nomeCompleto: string; crm: string }>>({});

  /** 'grupos' = primeira tela (Lista de subgrupos e equipes); 'escalas' = escalas + grade */
  const [viewEscalas, setViewEscalas] = useState<'grupos' | 'escalas'>('grupos');
  /** Entradas extra no history ao abrir a grade pelo painel "Editar escala" → Voltar / browser back volta ao painel. */
  const panelGradeHistoryDepthRef = useRef(0);
  const [searchGrupos, setSearchGrupos] = useState('');
  /** Contrato / subgrupo / equipe vêm do MasterEscopo (partilhado entre módulos + localStorage). */
  /** Aba ativa no painel lateral da equipe. */
  const [equipePanelTab, setEquipePanelTab] = useState<'calendario' | 'editar' | 'membros' | 'historico' | 'relatorio'>('calendario');
  /** Aba Membros: busca e seleção para adicionar profissionais à equipe. */
  const [membrosEquipeBusca, setMembrosEquipeBusca] = useState('');
  const [membrosNaEquipeBusca, setMembrosNaEquipeBusca] = useState('');
  const [membrosEquipePickIds, setMembrosEquipePickIds] = useState<string[]>([]);
  const [membrosEquipeActionLoading, setMembrosEquipeActionLoading] = useState(false);
  const [membrosEquipeError, setMembrosEquipeError] = useState<string | null>(null);
  /** Mês/ano exibido no calendário do painel da equipe. */
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
  /** Dia clicado no calendário: abre o painel "Plantões do dia". */
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{ year: number; month: number; day: number } | null>(null);
  /** Aba no painel Plantões do dia: Dinâmica ou Fixa. */
  const [plantaoViewMode, setPlantaoViewMode] = useState<'dinamica' | 'fixa'>('dinamica');
  /** Ano exibido na aba "Editar escala" do painel da equipe. */
  const [editarEscalaYear, setEditarEscalaYear] = useState(() => new Date().getFullYear());
  /** Busca por profissional na grade da escala (filtra linhas da tabela). */
  const [gradeBuscaProfissional, setGradeBuscaProfissional] = useState('');
  /**
   * Escala publicada (`ativo`): abre em somente leitura; o usuário clica em "Editar escala" na barra inferior
   * para alterar células e então "Publicar" para confirmar e voltar ao modo leitura.
   * Rascunho: edição liberada por padrão.
   */
  const [gradeEdicaoLiberada, setGradeEdicaoLiberada] = useState(true);

  useEffect(() => {
    const onPopState = () => {
      if (panelGradeHistoryDepthRef.current <= 0) return;
      panelGradeHistoryDepthRef.current -= 1;
      setViewEscalas('grupos');
      setSelectedEscalaId('');
      setEquipePanelTab('editar');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  type CellModalState = {
    open: boolean;
    grade?: GradeColDef;
    date?: Date;
    gradeIndex?: number;
    dayIndex?: number;
    medico?: { id: string; nomeCompleto: string; crm: string; telefone?: string | null; email?: string | null } | null;
    plantaoId?: string;
    /** true quando a célula clicada pertence à linha "Plantão Vago" (divulgar vagas). */
    isPlantaoVagoRow?: boolean;
  };
  const [cellModal, setCellModal] = useState<CellModalState>({ open: false });
  const [plantaoVagoVagas, setPlantaoVagoVagas] = useState(0);
  const [plantaoVagoSlots, setPlantaoVagoSlots] = useState<Record<string, number>>({});
  const [pendingPlantaoKey, setPendingPlantaoKey] = useState<string | null>(null);
  const [confirmClearVagas, setConfirmClearVagas] = useState<{ open: boolean; key?: string; label?: string }>(
    { open: false }
  );
  const [replicarMesModalOpen, setReplicarMesModalOpen] = useState(false);
  const [replicarMesDestino, setReplicarMesDestino] = useState('');
  const [replicarMesSubmitting, setReplicarMesSubmitting] = useState(false);
  useEffect(() => {
    if (cellModal.open && cellModal.isPlantaoVagoRow) setPlantaoVagoVagas(0);
  }, [cellModal.open, cellModal.isPlantaoVagoRow]);


  useEffect(() => {
    setMembrosEquipePickIds([]);
    setMembrosEquipeBusca('');
    setMembrosNaEquipeBusca('');
    setMembrosEquipeError(null);
  }, [selectedEquipeId]);

  useEffect(() => {
    if (!medicoAllocateOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (medicoAllocateRef.current && !medicoAllocateRef.current.contains(e.target as Node)) {
        setMedicoAllocateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [medicoAllocateOpen]);

  useEffect(() => {
    if (!medicoAllocateCellOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (medicoAllocateCellRef.current && !medicoAllocateCellRef.current.contains(e.target as Node)) {
        setMedicoAllocateCellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [medicoAllocateCellOpen]);

  const debouncedMedicoAllocateSearch = useDebouncedValue(medicoAllocateSearch, 320);
  const debouncedMedicoCellSearch = useDebouncedValue(medicoAllocateCellSearch, 320);

  /** Contratos e escalas só ao entrar em "Escalas e grades" — evita requests pesadas na lista de grupos. Médicos na alocação: busca sob demanda (debounce). */
  const precisaDadosEscalasGrade = isMaster && viewEscalas === 'escalas';

  const medicoSuggestSearchTrimmed = medicoAllocateCellOpen
    ? debouncedMedicoCellSearch.trim()
    : debouncedMedicoAllocateSearch.trim();
  const medicosSuggestBranch = medicoAllocateCellOpen ? 'cell' : 'alloc';
  const medicosSuggestEnabled =
    precisaDadosEscalasGrade && (medicoAllocateOpen || medicoAllocateCellOpen);

  const { data: medicosSuggestResp, isFetching: loadingMedicosSuggest } = useQuery({
    queryKey: ['admin', 'medicos', 'for-escalas-suggest', medicosSuggestBranch, medicoSuggestSearchTrimmed],
    queryFn: () =>
      adminService.listMedicos({
        page: 1,
        limit: 80,
        search: medicoSuggestSearchTrimmed || undefined,
        ativo: true,
      }),
    enabled: medicosSuggestEnabled,
    staleTime: 60 * 1000,
  });

  const rememberMedicoLabel = (m: AdminMedico) => {
    setMedicoPickLabels((prev) => ({
      ...prev,
      [m.id]: { nomeCompleto: m.nomeCompleto, crm: m.crm ?? '' },
    }));
  };

  const { data: contratosResp } = useQuery({
    queryKey: ['admin', 'contratos-ativos', 'for-escalas'],
    queryFn: () => adminService.listContratosAtivos({ page: 1, limit: 200 }),
    enabled: precisaDadosEscalasGrade,
    staleTime: 3 * 60 * 1000,
  });

  const { data: escalasResp, isLoading: loadingEscalas } = useQuery({
    queryKey: ['admin', 'escalas'],
    queryFn: () => adminService.listEscalas({ page: 1, limit: 200 }),
    enabled: precisaDadosEscalasGrade,
    staleTime: 3 * 60 * 1000,
  });

  const { data: subgruposResp } = useQuery({
    queryKey: ['admin', 'subgrupos'],
    queryFn: () => adminService.listSubgrupos(),
    enabled: isMaster,
    staleTime: 3 * 60 * 1000,
  });
  const { data: equipesResp } = useQuery({
    queryKey: ['admin', 'equipes', 'todos'],
    queryFn: () => adminService.listEquipes(),
    enabled: isMaster,
    staleTime: 3 * 60 * 1000,
  });

  const plantoesDiaDateStr = useMemo(() => {
    if (!selectedCalendarDay) return '';
    const { year, month, day } = selectedCalendarDay;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }, [selectedCalendarDay]);

  const abrirAdicionalDoDia = (gradeId: string, currentPercentual: number) => {
    setAdicionalPercentualInput(String(currentPercentual ?? 0));
    setAdicionalDiaOpenGradeId(gradeId);
  };

  const fecharAdicionalDoDia = () => {
    setAdicionalDiaOpenGradeId(null);
  };

  const salvarAdicionalDoDiaPanel = async (gradeId: string) => {
    if (!isMaster || !contratoAtivoIdContext || !plantoesDiaDateStr) return;
    setLoadingAction(true);
    setError(null);
    try {
      const percentual = Number(adicionalPercentualInput.replace(',', '.'));
      if (!Number.isFinite(percentual) || percentual < 0 || percentual > 300) {
        setError('Percentual inválido (use um número entre 0 e 300).');
        return;
      }
      await adminService.upsertAdicionalPlantao({
        contratoAtivoId: contratoAtivoIdContext,
        data: plantoesDiaDateStr,
        gradeId,
        percentual,
      });
      await queryClient.invalidateQueries({
        queryKey: [
          'admin',
          'adicionais-plantao',
          contratoAtivoIdContext,
          dateToInput(gradeMonthStart),
          dateToInput(gradeMonthEnd),
        ],
      });
      setAdicionalDiaOpenGradeId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar adicional');
    } finally {
      setLoadingAction(false);
    }
  };

  const removerAdicionalDoDiaPanel = async (gradeId: string) => {
    if (!isMaster || !contratoAtivoIdContext || !plantoesDiaDateStr) return;
    setLoadingAction(true);
    setError(null);
    try {
      await adminService.removerAdicionalPlantao({
        contratoAtivoId: contratoAtivoIdContext,
        data: plantoesDiaDateStr,
        gradeId,
      });
      await queryClient.invalidateQueries({
        queryKey: [
          'admin',
          'adicionais-plantao',
          contratoAtivoIdContext,
          dateToInput(gradeMonthStart),
          dateToInput(gradeMonthEnd),
        ],
      });
      setAdicionalPercentualInput('0');
      setAdicionalDiaOpenGradeId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao remover adicional');
    } finally {
      setLoadingAction(false);
    }
  };

  const { data: equipePlantoesDiaResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId ?? '', 'plantoes', plantoesDiaDateStr, plantaoViewMode],
    queryFn: () =>
      adminService.listEquipePlantoes(selectedEquipeId!, {
        dataInicio: plantoesDiaDateStr,
        dataFim: plantoesDiaDateStr,
        modo: plantaoViewMode,
      }),
    enabled: isMaster && !!selectedEquipeId && !!plantoesDiaDateStr,
  });

  const { data: equipeEscalasResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId ?? '', 'escalas'],
    queryFn: () => adminService.listEscalasByEquipe(selectedEquipeId!),
    enabled: isMaster && !!selectedEquipeId,
  });

  const equipeEscalasForHistorico = useMemo(
    () => (equipeEscalasResp?.data ?? []) as Escala[],
    [equipeEscalasResp?.data]
  );

  /**
   * Aba Histórico no drawer da equipe: a escala não vem do seletor da tela principal.
   * Usa a escala selecionada na grade se ela pertencer à equipe; senão, a primeira escala vinculada à equipe.
   */
  const escalaIdParaHistoricoDrawer = useMemo(() => {
    if (!selectedEquipeId || equipeEscalasForHistorico.length === 0) return '';
    if (selectedEscalaId && equipeEscalasForHistorico.some((e) => e.id === selectedEscalaId)) {
      return selectedEscalaId;
    }
    return equipeEscalasForHistorico[0].id;
  }, [selectedEquipeId, selectedEscalaId, equipeEscalasForHistorico]);

  const historicoDrawerDadosEnabled =
    isMaster && equipePanelTab === 'historico' && !!escalaIdParaHistoricoDrawer;

  /** Plantões de todas as escalas da equipe no ano (aba Gerenciamento de escalas — status por mês). */
  const { data: equipePlantoesAnoGerenciamentoResp, isLoading: loadingPlantoesAnoGerenciamento } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId, 'plantoes', 'year-range', editarEscalaYear],
    queryFn: () =>
      adminService.listEquipePlantoes(selectedEquipeId!, {
        dataInicio: `${editarEscalaYear}-01-01`,
        dataFim: `${editarEscalaYear}-12-31`,
        modo: 'dinamica',
      }),
    enabled: isMaster && !!selectedEquipeId && equipePanelTab === 'editar',
  });

  const plantaoCountByEscalaMonthGerenciamento = useMemo(() => {
    const map = new Map<string, number>();
    const raw = equipePlantoesAnoGerenciamentoResp?.data;
    const items: EscalaPlantao[] = Array.isArray(raw) ? raw : [];
    for (const p of items) {
      const ymd = toDateInput(p.data);
      const parts = ymd.split('-').map(Number);
      const y = parts[0];
      const m = parts[1];
      if (!y || !m || y !== editarEscalaYear) continue;
      const key = `${p.escalaId}|${m}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [equipePlantoesAnoGerenciamentoResp?.data, editarEscalaYear]);

  const periodoRegistrosEquipeRelatorio = useMemo(() => {
    const list = (equipeEscalasResp?.data ?? []) as Escala[];
    if (list.length === 0) return null;
    let min = list[0].dataInicio.slice(0, 10);
    for (const e of list) {
      const di = e.dataInicio.slice(0, 10);
      if (di < min) min = di;
    }
    return { inicio: min, fim: dateToInput(new Date()) };
  }, [equipeEscalasResp?.data]);

  const { data: registrosEquipeRelatorioResp, isLoading: loadingRegistrosEquipeRelatorio } = useQuery({
    queryKey: [
      'admin',
      'registros-ponto',
      'equipe-drawer',
      selectedEquipeId,
      periodoRegistrosEquipeRelatorio?.inicio,
      periodoRegistrosEquipeRelatorio?.fim,
    ],
    queryFn: () =>
      adminService.listRegistrosPonto({
        equipeId: selectedEquipeId!,
        dataInicio: `${periodoRegistrosEquipeRelatorio!.inicio}T00:00:00.000`,
        dataFim: `${periodoRegistrosEquipeRelatorio!.fim}T23:59:59.999`,
      }),
    enabled:
      isMaster &&
      !!selectedEquipeId &&
      equipePanelTab === 'relatorio' &&
      !!periodoRegistrosEquipeRelatorio?.inicio &&
      !!periodoRegistrosEquipeRelatorio?.fim,
  });

  /** Todas as escalas da equipe, com horas por profissional (inclui escalas em andamento — antes só listávamos encerradas). */
  const escalasHorasPontoRelatorio = useMemo(() => {
    const escalas = (equipeEscalasResp?.data ?? []) as Escala[];
    const raw = registrosEquipeRelatorioResp?.data;
    const registros: Array<{
      duracaoMinutos?: number | null;
      escalaId?: string | null;
      medico?: { id: string; nomeCompleto: string } | null;
      escala?: { id: string; nome?: string } | null;
    }> = Array.isArray(raw) ? raw : raw?.data ?? [];

    const nomePorMedico = new Map<string, string>();
    const minutosPorEscalaMedico = new Map<string, Map<string, number>>();

    for (const r of registros) {
      const eid = r.escala?.id ?? r.escalaId;
      const mid = r.medico?.id;
      if (!eid || !mid) continue;
      const add = r.duracaoMinutos ?? 0;
      if (!minutosPorEscalaMedico.has(eid)) minutosPorEscalaMedico.set(eid, new Map());
      const inner = minutosPorEscalaMedico.get(eid)!;
      inner.set(mid, (inner.get(mid) ?? 0) + add);
      if (r.medico?.nomeCompleto) nomePorMedico.set(mid, fixMojibake(r.medico.nomeCompleto));
    }

    return escalas
      .sort((a, b) => {
        const aEnc = isEscalaEncerrada(a.dataFim);
        const bEnc = isEscalaEncerrada(b.dataFim);
        if (aEnc !== bEnc) return aEnc ? 1 : -1;
        return new Date(b.dataFim).getTime() - new Date(a.dataFim).getTime();
      })
      .map((esc) => {
        const encerrada = isEscalaEncerrada(esc.dataFim);
        const medMap = minutosPorEscalaMedico.get(esc.id) ?? new Map();
        const linhas = Array.from(medMap.entries())
          .map(([medicoId, minutos]) => ({
            medicoId,
            minutos,
            nome: nomePorMedico.get(medicoId) ?? medicoId,
          }))
          .filter((x) => x.minutos > 0)
          .sort((a, b) => b.minutos - a.minutos);
        return { escala: esc, linhas, encerrada };
      });
  }, [equipeEscalasResp?.data, registrosEquipeRelatorioResp?.data]);

  const { data: escalaEquipesResp } = useQuery({
    queryKey: ['admin', 'escalas', selectedEscalaId, 'equipes'],
    queryFn: () => adminService.listEscalaEquipes(selectedEscalaId),
    enabled: isMaster && !!selectedEscalaId,
  });
  const equipeIdParaGrade = useMemo(() => {
    if (selectedEquipeId) return selectedEquipeId;
    const list = escalaEquipesResp?.data ?? [];
    const first = list[0] as { equipeId?: string; equipe?: { id: string } } | undefined;
    return first?.equipeId ?? first?.equipe?.id ?? '';
  }, [selectedEquipeId, escalaEquipesResp?.data]);
  const { data: equipeMedicosResp } = useQuery({
    queryKey: ['admin', 'equipes', equipeIdParaGrade, 'medicos'],
    queryFn: () => adminService.listEquipeMedicos(equipeIdParaGrade),
    enabled: isMaster && !!equipeIdParaGrade,
  });

  const medicosParaMembrosEquipeTab =
    isMaster && viewEscalas === 'grupos' && equipePanelTab === 'membros' && !!selectedEquipeId;
  const { data: medicosMembrosEquipeResp, isFetching: loadingMedicosMembrosEquipe } = useQuery({
    queryKey: ['admin', 'medicos', 'for-equipe-membros-tab', selectedEquipeId],
    queryFn: () => adminService.listMedicos({ page: 1, limit: 2000, ativo: true }),
    enabled: medicosParaMembrosEquipeTab,
    staleTime: 60 * 1000,
  });

  const invalidateEquipeMedicosList = useCallback(() => {
    if (selectedEquipeId) {
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipes', selectedEquipeId, 'medicos'] });
    }
    if (equipeIdParaGrade && equipeIdParaGrade !== selectedEquipeId) {
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipes', equipeIdParaGrade, 'medicos'] });
    }
  }, [queryClient, selectedEquipeId, equipeIdParaGrade]);

  const toggleMembrosEquipePick = (medicoId: string) => {
    setMembrosEquipePickIds((prev) =>
      prev.includes(medicoId) ? prev.filter((id) => id !== medicoId) : [...prev, medicoId]
    );
  };

  const adicionarMedicoNaEquipeUm = async (equipeId: string, medicoId: string) => {
    setMembrosEquipeError(null);
    setMembrosEquipeActionLoading(true);
    try {
      await adminService.addMedicoToEquipe(equipeId, medicoId);
      setMembrosEquipePickIds((prev) => prev.filter((id) => id !== medicoId));
    } catch (err: any) {
      setMembrosEquipeError(err.response?.data?.error || err.message || 'Erro ao adicionar');
    } finally {
      setMembrosEquipeActionLoading(false);
    }
    void invalidateEquipeMedicosList();
  };

  const adicionarMedicosSelecionadosNaEquipe = async (equipeId: string, ids: string[]) => {
    const toAdd = ids.filter(Boolean);
    if (toAdd.length === 0) return;
    setMembrosEquipeError(null);
    setMembrosEquipeActionLoading(true);
    try {
      for (const medicoId of toAdd) {
        await adminService.addMedicoToEquipe(equipeId, medicoId);
      }
      setMembrosEquipePickIds([]);
    } catch (err: any) {
      setMembrosEquipeError(err.response?.data?.error || err.message || 'Erro ao adicionar');
    } finally {
      setMembrosEquipeActionLoading(false);
    }
    void invalidateEquipeMedicosList();
  };

  const removerMedicoDaEquipePainel = async (equipeId: string, medicoId: string) => {
    setMembrosEquipeError(null);
    setMembrosEquipeActionLoading(true);
    try {
      await adminService.removeMedicoFromEquipe(equipeId, medicoId);
      setMembrosEquipePickIds((prev) => prev.filter((id) => id !== medicoId));
    } catch (err: any) {
      setMembrosEquipeError(err.response?.data?.error || err.message || 'Erro ao remover');
    } finally {
      setMembrosEquipeActionLoading(false);
    }
    void invalidateEquipeMedicosList();
  };

  const { data: alocacoesResp } = useQuery({
    queryKey: ['admin', 'escalas', selectedEscalaId, 'medicos'],
    queryFn: () => adminService.listEscalaMedicos(selectedEscalaId),
    enabled: isMaster && !!selectedEscalaId,
  });

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const { data: plantoesResp } = useQuery({
    queryKey: ['admin', 'escalas', selectedEscalaId, 'plantoes', dateToInput(weekStart), dateToInput(weekEnd)],
    queryFn: () =>
      adminService.listEscalaPlantoes(selectedEscalaId, {
        dataInicio: dateToInput(weekStart),
        dataFim: dateToInput(weekEnd),
      }),
    enabled: isMaster && !!selectedEscalaId,
  });

  const gradeMonthEnd = useMemo(() => {
    const d = new Date(gradeMonthStart.getFullYear(), gradeMonthStart.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [gradeMonthStart]);

  /** YYYY-MM do mês visível na grade (origem da replicação). */
  const mesOrigemGradeYM = useMemo(() => {
    const y = gradeMonthStart.getFullYear();
    const m = gradeMonthStart.getMonth() + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  }, [gradeMonthStart]);

  const { data: plantoesMonthResp } = useQuery({
    queryKey: ['admin', 'escalas', selectedEscalaId, 'plantoes-month', dateToInput(gradeMonthStart), dateToInput(gradeMonthEnd)],
    queryFn: () =>
      adminService.listEscalaPlantoes(selectedEscalaId, {
        dataInicio: dateToInput(gradeMonthStart),
        dataFim: dateToInput(gradeMonthEnd),
      }),
    enabled: isMaster && !!selectedEscalaId,
  });

  const { data: historicoDrawerMedicosResp, isLoading: loadingHistoricoDrawerMedicos } = useQuery({
    queryKey: ['admin', 'escalas', escalaIdParaHistoricoDrawer, 'medicos'],
    queryFn: () => adminService.listEscalaMedicos(escalaIdParaHistoricoDrawer),
    enabled: historicoDrawerDadosEnabled,
  });

  const { data: historicoDrawerPlantoesMonthResp, isLoading: loadingHistoricoDrawerPlantoes } = useQuery({
    queryKey: [
      'admin',
      'escalas',
      escalaIdParaHistoricoDrawer,
      'plantoes-month',
      dateToInput(gradeMonthStart),
      dateToInput(gradeMonthEnd),
    ],
    queryFn: () =>
      adminService.listEscalaPlantoes(escalaIdParaHistoricoDrawer, {
        dataInicio: dateToInput(gradeMonthStart),
        dataFim: dateToInput(gradeMonthEnd),
      }),
    enabled: historicoDrawerDadosEnabled,
  });

  const { data: trocasHistoricoResp, isLoading: loadingTrocasHistorico } = useQuery({
    queryKey: ['admin', 'escalas', escalaIdParaHistoricoDrawer, 'trocas-plantao-historico'],
    queryFn: () => adminService.listHistoricoTrocasPlantaoEscala(escalaIdParaHistoricoDrawer),
    enabled: historicoDrawerDadosEnabled,
  });

  const { data: escalaSubgruposResp } = useQuery({
    queryKey: ['admin', 'escalas', selectedEscalaId, 'subgrupos'],
    queryFn: () => adminService.listEscalaSubgrupos(selectedEscalaId),
    enabled: isMaster && !!selectedEscalaId,
  });

  const selectedEscala = useMemo(
    () => (escalasResp?.data || []).find((e: Escala) => e.id === selectedEscalaId),
    [escalasResp?.data, selectedEscalaId]
  );

  useEffect(() => {
    if (!selectedEscalaId) {
      setGradeEdicaoLiberada(true);
      return;
    }
    if (!selectedEscala) return;
    setGradeEdicaoLiberada(!selectedEscala.ativo);
  }, [selectedEscalaId, selectedEscala]);

  const gradeSomenteLeitura = useMemo(
    () => selectedEscala?.ativo === true && !gradeEdicaoLiberada,
    [selectedEscala?.ativo, gradeEdicaoLiberada]
  );

  /** Calendário da equipe não define selectedEscalaId; tipos vinham vazios e a UI caía só em MT/SN fixos. */
  const contratoAtivoIdParaTipos = useMemo(() => {
    const eq0 = (equipeEscalasResp?.data ?? [])[0] as Escala | undefined;
    return (
      selectedEscala?.contratoAtivoId ??
      selectedEscala?.contratoAtivo?.id ??
      eq0?.contratoAtivoId ??
      eq0?.contratoAtivo?.id ??
      ''
    );
  }, [selectedEscala, equipeEscalasResp?.data]);

  const { data: tiposPlantaoEscalResp } = useQuery({
    queryKey: ['admin', 'tipos-plantao', contratoAtivoIdParaTipos],
    queryFn: () => adminService.listTiposPlantao(contratoAtivoIdParaTipos),
    enabled: isMaster && !!contratoAtivoIdParaTipos,
  });

  const gradesForGrid = useMemo((): GradeColDef[] => {
    const tipos = tiposPlantaoEscalResp?.data ?? [];
    if (tipos.length > 0) {
      return tipos.map(tipoPlantaoToGradeCol);
    }
    const byId = new Map<string, GradeColDef>();
    for (const fg of FALLBACK_GRADES) byId.set(fg.id, { ...fg });
    const plantoesUnion = [
      ...(plantoesResp?.data ?? []),
      ...(plantoesMonthResp?.data ?? []),
      ...(equipePlantoesDiaResp?.data ?? []),
      ...(equipePanelTab === 'historico' ? (historicoDrawerPlantoesMonthResp?.data ?? []) : []),
    ];
    for (const p of plantoesUnion) {
      const gid = String(p.gradeId);
      if (byId.has(gid)) continue;
      const low = gid.toLowerCase();
      const fb = low === 'mt' || low === 'sn' ? FALLBACK_GRADES.find((g) => g.id === low) : undefined;
      if (fb) {
        byId.set(gid, { ...fb, id: gid });
      } else {
        byId.set(gid, {
          id: gid,
          label: gid.length > 10 ? `${gid.slice(0, 8)}…` : gid,
          horario: '—',
          tipo: 'Turno',
          regua: ['—', '—'] as [string, string],
        });
      }
    }
    return Array.from(byId.values());
  }, [
    tiposPlantaoEscalResp?.data,
    plantoesResp?.data,
    plantoesMonthResp?.data,
    equipePlantoesDiaResp?.data,
    equipePanelTab,
    historicoDrawerPlantoesMonthResp?.data,
  ]);

  /**
   * Colunas do painel "Plantões do dia" respeitam a data clicada: só tipos já criados até aquele dia
   * (createdAt ≤ fim do dia) + grades que aparecem nos plantões daquele dia (ex.: mt/sn legado).
   * Evita mostrar turnos novos em dias anteriores à criação do tipo.
   */
  const gradesParaPlantoesDoDia = useMemo((): GradeColDef[] => {
    if (!selectedCalendarDay || !plantoesDiaDateStr) return gradesForGrid;
    const tipos = tiposPlantaoEscalResp?.data ?? [];
    const plantoesDia = equipePlantoesDiaResp?.data ?? [];
    const fimDia = endOfLocalCalendarDayYmd(plantoesDiaDateStr);

    const tiposQueJaExistiam = tipos.filter((t) => new Date(t.createdAt).getTime() <= fimDia.getTime());
    const byId = new Map<string, GradeColDef>();

    for (const t of tiposQueJaExistiam) {
      byId.set(t.id, tipoPlantaoToGradeCol(t));
    }

    for (const p of plantoesDia) {
      const gid = String(p.gradeId);
      if (byId.has(gid)) continue;
      const t = tipos.find((x) => x.id === gid);
      if (t) {
        byId.set(gid, tipoPlantaoToGradeCol(t));
        continue;
      }
      const low = gid.toLowerCase();
      const fb = low === 'mt' || low === 'sn' ? FALLBACK_GRADES.find((g) => g.id === low) : undefined;
      if (fb) {
        byId.set(gid, { ...fb, id: gid });
      } else {
        byId.set(gid, {
          id: gid,
          label: gid.length > 10 ? `${gid.slice(0, 8)}…` : gid,
          horario: '—',
          tipo: 'Turno',
          regua: ['—', '—'] as [string, string],
        });
      }
    }

    // Se só existia um tipo "vigente" na data (ex.: SN antigo) e o MT novo foi criado depois,
    // mantém o par legado 07h–19h / 19h–07h como antes (colunas vazias ou com alocação).
    if (tiposQueJaExistiam.length <= 1) {
      const colList = Array.from(byId.values());
      const hasFullDiurnal =
        byId.has('mt') ||
        colList.some((g) => g.regua[0] === '07:00' && g.regua[1] === '19:00');
      const hasNight =
        byId.has('sn') ||
        colList.some((g) => g.regua[0] === '19:00' && g.regua[1] === '07:00');
      const mtFb = FALLBACK_GRADES.find((x) => x.id === 'mt');
      const snFb = FALLBACK_GRADES.find((x) => x.id === 'sn');
      if (mtFb && !hasFullDiurnal) byId.set('mt', { ...mtFb });
      if (snFb && !hasNight) byId.set('sn', { ...snFb });
    }

    const inicioMinCol = (g: GradeColDef) => {
      const t = tipos.find((x) => x.id === g.id);
      const hm = (t?.horaInicio ?? g.regua?.[0] ?? '00:00').slice(0, 5);
      const p = hm.split(':').map((x) => parseInt(x, 10));
      const h = Number.isFinite(p[0]) ? p[0] : 0;
      const m = Number.isFinite(p[1]) ? p[1] : 0;
      return h * 60 + m;
    };
    const sortCols = (cols: GradeColDef[]) =>
      [...cols].sort((a, b) => {
        const da = inicioMinCol(a);
        const db = inicioMinCol(b);
        if (da !== db) return da - db;
        const na = tipos.find((x) => x.id === a.id)?.nome ?? a.label;
        const nb = tipos.find((x) => x.id === b.id)?.nome ?? b.label;
        return na.localeCompare(nb, 'pt-BR');
      });

    if (byId.size === 0) {
      if (tiposQueJaExistiam.length > 0) return sortCols(tiposQueJaExistiam.map(tipoPlantaoToGradeCol));
      return FALLBACK_GRADES;
    }

    return sortCols(Array.from(byId.values()));
  }, [
    selectedCalendarDay,
    plantoesDiaDateStr,
    tiposPlantaoEscalResp?.data,
    equipePlantoesDiaResp?.data,
    gradesForGrid,
  ]);

  const contratoAtivoIdContext = useMemo(() => {
    return (
      selectedEscala?.contratoAtivoId ??
      (equipeEscalasResp?.data?.[0] as any)?.contratoAtivoId ??
      ''
    );
  }, [equipeEscalasResp?.data, selectedEscala?.contratoAtivoId]);
  const firstSubgrupoId = useMemo(() => {
    const list = escalaSubgruposResp?.data || [];
    const first = list[0];
    return first?.subgrupoId ?? first?.subgrupo?.id ?? '';
  }, [escalaSubgruposResp?.data]);

  const { data: valoresPlantaoResp } = useQuery({
    queryKey: [
      'admin',
      'valores-plantao',
      selectedEscala?.contratoAtivoId ?? '',
      firstSubgrupoId,
      equipeIdParaGrade || '__none__',
    ],
    queryFn: () =>
      adminService.getValoresPlantao(
        selectedEscala!.contratoAtivoId,
        firstSubgrupoId,
        equipeIdParaGrade || undefined
      ),
    enabled:
      isMaster &&
      !!selectedEscala?.contratoAtivoId &&
      !!firstSubgrupoId,
  });

  const { data: adicionaisPlantaoResp } = useQuery({
    queryKey: [
      'admin',
      'adicionais-plantao',
      contratoAtivoIdContext,
      dateToInput(gradeMonthStart),
      dateToInput(gradeMonthEnd),
    ],
    queryFn: async () => {
      try {
        return await adminService.listAdicionaisPlantao({
          contratoAtivoId: contratoAtivoIdContext,
          dataInicio: dateToInput(gradeMonthStart),
          dataFim: dateToInput(gradeMonthEnd),
        });
      } catch {
        return { success: true, data: [] };
      }
    },
    enabled: isMaster && !!contratoAtivoIdContext,
  });

  const contratos = useMemo(() => contratosResp?.data || [], [contratosResp]);
  const escalas = useMemo(() => escalasResp?.data || [], [escalasResp]);

  /** Na view "escalas", se houver só uma escala, já abre direto a grade (evita lista + clique). */
  useEffect(() => {
    if (viewEscalas !== 'escalas' || escalas.length !== 1 || selectedEscalaId) return;
    setSelectedEscalaId(escalas[0].id);
  }, [viewEscalas, escalas, selectedEscalaId]);

  const medicos = useMemo(() => medicosSuggestResp?.data ?? [], [medicosSuggestResp]);
  const subgrupos = useMemo(() => subgruposResp?.data || [], [subgruposResp]);
  const equipes = useMemo(() => equipesResp?.data || [], [equipesResp]);

  const searchGruposLower = searchGrupos.trim().toLowerCase();
  /** Na página Escalas: só subgrupos que usam escala (plantões), vinculados a algum contrato. */
  const subgruposComEscala = useMemo(
    () =>
      subgrupos.filter(
        (s) => s.usaEscala !== false && (s.contratoSubgrupos ?? []).some((cs) => !!cs.contratoAtivo?.id)
      ),
    [subgrupos]
  );

  const contratosParaFiltroLista = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subgruposComEscala) {
      for (const cs of s.contratoSubgrupos ?? []) {
        const ca = cs.contratoAtivo;
        if (ca?.id) map.set(ca.id, fixMojibake(ca.nome));
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
      .map(([id, nome]) => ({ id, nome }));
  }, [subgruposComEscala]);

  const subgruposAposFiltroContrato = useMemo(() => {
    if (!filtroListaContratoId) return subgruposComEscala;
    return subgruposComEscala.filter((s) =>
      (s.contratoSubgrupos ?? []).some((cs) => cs.contratoAtivo?.id === filtroListaContratoId)
    );
  }, [subgruposComEscala, filtroListaContratoId]);

  const subgruposFiltrados = useMemo(() => {
    if (!filtroListaContratoId) return [];
    const base = subgruposAposFiltroContrato;
    if (!searchGruposLower) return base;
    return base.filter((s) => s.nome.toLowerCase().includes(searchGruposLower));
  }, [filtroListaContratoId, subgruposAposFiltroContrato, searchGruposLower]);

  useEffect(() => {
    if (!filtroListaContratoId) {
      setSelectedSubgrupoId('');
      setSelectedEquipeId('');
      return;
    }
    if (selectedSubgrupoId && !subgruposAposFiltroContrato.some((s) => s.id === selectedSubgrupoId)) {
      setSelectedSubgrupoId('');
      setSelectedEquipeId('');
    }
  }, [filtroListaContratoId, subgruposAposFiltroContrato, selectedSubgrupoId, setSelectedSubgrupoId, setSelectedEquipeId]);

  /** Equipes do subgrupo selecionado (só preenchido quando selectedSubgrupoId está setado). */
  const equipesDoSubgrupoSelecionado = useMemo(() => {
    if (!selectedSubgrupoId) return [];
    return equipes.filter(
      (e) => e.subgrupoId === selectedSubgrupoId || e.subgrupo?.id === selectedSubgrupoId
    );
  }, [equipes, selectedSubgrupoId]);

  const selectedSubgrupo = useMemo(
    () => (selectedSubgrupoId ? subgrupos.find((s) => s.id === selectedSubgrupoId) : null),
    [subgrupos, selectedSubgrupoId]
  );

  const selectedEquipe = useMemo(
    () => (selectedEquipeId ? equipes.find((e) => e.id === selectedEquipeId) : null),
    [equipes, selectedEquipeId]
  );
  const alocacoes = useMemo(() => alocacoesResp?.data || [], [alocacoesResp]);
  const plantoes = useMemo(() => plantoesResp?.data || [], [plantoesResp]);
  const valoresPlantao = useMemo(() => valoresPlantaoResp?.data || [], [valoresPlantaoResp]);

  const valorByGrade = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const v of valoresPlantao) {
      const n = v.valorHora != null && v.valorHora !== '' ? parseFloat(String(v.valorHora)) : null;
      map.set(v.gradeId, Number.isNaN(n as number) ? null : n);
    }
    return map;
  }, [valoresPlantao]);

  const adicionalPercentualByDataGrade = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of adicionaisPlantaoResp?.data ?? []) {
      const dateStr = (a.data ?? '').slice(0, 10);
      if (!dateStr || !a.gradeId) continue;
      const p = typeof a.percentual === 'number' ? a.percentual : parseFloat(String(a.percentual));
      if (Number.isNaN(p)) continue;
      map.set(`${dateStr}_${a.gradeId}`, p);
    }
    return map;
  }, [adicionaisPlantaoResp?.data]);

  const adicionalPercentualDoDiaPorGrade = useMemo(() => {
    if (!plantoesDiaDateStr) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const g of gradesParaPlantoesDoDia) {
      const p = adicionalPercentualByDataGrade.get(`${plantoesDiaDateStr}_${g.id}`);
      if (p != null) map.set(g.id, p);
    }
    return map;
  }, [adicionalPercentualByDataGrade, plantoesDiaDateStr, gradesParaPlantoesDoDia]);

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const getValorFinalComAdicional = (base: number | null, percentual: number | null) => {
    if (base == null) return null;
    if (percentual == null || percentual === 0) return base;
    return round2(base * (1 + percentual / 100));
  };

  type PlantaoSlotEntry = {
    medico: { id: string; nomeCompleto: string; crm: string; telefone?: string | null; email?: string | null };
    plantaoId: string;
    valorHora: string | null;
  };

  const plantaoMap = useMemo(() => {
    const map = new Map<string, PlantaoSlotEntry[]>();
    for (const p of plantoes) {
      if (!p.medico?.id) continue;
      const dateStr = p.data.slice(0, 10);
      const key = `${dateStr}_${p.gradeId}`;
      const entry: PlantaoSlotEntry = {
        medico: {
          id: p.medico.id,
          nomeCompleto: p.medico.nomeCompleto,
          crm: p.medico.crm,
          telefone: p.medico.telefone ?? null,
          email: p.medico.email ?? null,
        },
        plantaoId: p.id,
        valorHora: p.valorHora ?? null,
      };
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.medico?.nomeCompleto ?? '').localeCompare(b.medico?.nomeCompleto ?? '', 'pt-BR')
      );
    }
    return map;
  }, [plantoes]);

  const plantoesMonth = useMemo(() => plantoesMonthResp?.data || [], [plantoesMonthResp]);
  const plantaoMapMonth = useMemo(() => {
    const map = new Map<string, PlantaoSlotEntry[]>();
    for (const p of plantoesMonth) {
      if (!p.medico?.id) continue;
      const dateStr = p.data.slice(0, 10);
      const key = `${dateStr}_${p.gradeId}`;
      const entry: PlantaoSlotEntry = {
        medico: {
          id: p.medico.id,
          nomeCompleto: p.medico.nomeCompleto,
          crm: p.medico.crm,
          telefone: p.medico.telefone ?? null,
          email: p.medico.email ?? null,
        },
        plantaoId: p.id,
        valorHora: p.valorHora ?? null,
      };
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.medico?.nomeCompleto ?? '').localeCompare(b.medico?.nomeCompleto ?? '', 'pt-BR')
      );
    }
    return map;
  }, [plantoesMonth]);

  const imprimirRelatorioEscalaPdf = useCallback(() => {
    if (!selectedEscala || !selectedEscalaId) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const mesTitulo = gradeMonthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const slugMes = `${gradeMonthStart.getFullYear()}-${String(gradeMonthStart.getMonth() + 1).padStart(2, '0')}`;
    let y = 12;
    doc.setFontSize(14);
    doc.text(textoSeguroPdf(fixMojibake(selectedEscala.nome)), 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(
      textoSeguroPdf(
        fixMojibake(
          `${selectedEscala.contratoAtivo?.nome ?? '-'} | Periodo: ${toDateInput(selectedEscala.dataInicio)} a ${toDateInput(selectedEscala.dataFim)} | Status: ${selectedEscala.ativo ? 'Publicada' : 'Rascunho'}`
        )
      ),
      14,
      y
    );
    y += 6;
    doc.text(textoSeguroPdf(fixMojibake(`Mes de referencia: ${mesTitulo}`)), 14, y);
    y += 9;

    const daysInMonth = gradeMonthEnd.getDate();
    const header = [
      textoSeguroPdf('Profissional'),
      textoSeguroPdf('Turno'),
      ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
    ];

    const equipeMedicosList =
      equipeIdParaGrade && Array.isArray(equipeMedicosResp?.data)
        ? (equipeMedicosResp!.data as { medicoId: string; medico?: { nomeCompleto: string; crm?: string | null } }[]).map(
            (em) => ({
              label: em.medico?.nomeCompleto ?? '—',
              medicoId: em.medicoId,
            })
          )
        : null;
    const baseList =
      equipeMedicosList !== null
        ? equipeMedicosList
        : alocacoes.map((a) => ({
            label: a.medico.nomeCompleto,
            medicoId: a.medico.id,
          }));
    const tableRows = [{ label: 'Plantão Vago', medicoId: '' }, ...baseList.map((r) => ({ label: r.label, medicoId: r.medicoId }))];

    const body: string[][] = [];
    for (const row of tableRows) {
      for (const grade of gradesForGrid) {
        const dayCells: string[] = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const d = new Date(gradeMonthStart.getFullYear(), gradeMonthStart.getMonth(), day);
          const dateStr = dateToInput(d);
          const key = `${dateStr}_${grade.id}`;
          const slots = plantaoMapMonth.get(key) ?? [];
          if (row.medicoId === '') {
            const vagas = plantaoVagoSlots[key] ?? 0;
            dayCells.push(vagas > 0 ? String(vagas) : '');
          } else {
            const cell = slots.find((s) => s.medico.id === row.medicoId);
            dayCells.push(cell ? textoSeguroPdf(fixMojibake(shortName(cell.medico.nomeCompleto))) : '');
          }
        }
        body.push([
          textoSeguroPdf(fixMojibake(row.label)),
          textoSeguroPdf(fixMojibake(`${grade.label} (${grade.regua[0]}-${grade.regua[1]})`)),
          ...dayCells.map((c) => textoSeguroPdf(c)),
        ]);
      }
    }

    if (gradesForGrid.length === 0) {
      doc.setFontSize(10);
      doc.text(textoSeguroPdf('Nenhum turno configurado para esta escala.'), 14, y);
    } else {
      autoTable(doc, {
        startY: y,
        head: [header],
        body,
        styles: { fontSize: 5, cellPadding: 0.35, overflow: 'hidden' },
        headStyles: { fillColor: [37, 111, 255], textColor: 255, fontStyle: 'bold' },
        margin: { left: 10, right: 10, bottom: 14 },
        theme: 'grid',
      });
      const g = doc as jsPDF & { lastAutoTable?: { finalY: number } };
      const finalY = g.lastAutoTable?.finalY;
      if (finalY != null) {
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text(textoSeguroPdf(`Gerado em ${new Date().toLocaleString('pt-BR')}`), 14, Math.min(finalY + 6, doc.internal.pageSize.getHeight() - 8));
      }
    }

    const rawPdfNome = selectedEscala.nome || 'escala';
    const baseNome = [...rawPdfNome]
      .map((ch) => {
        const code = ch.charCodeAt(0);
        if (code < 32) return '_';
        if ('<>:"/\\|?*'.includes(ch)) return '_';
        return ch;
      })
      .join('')
      .trim()
      .slice(0, 80);
    doc.save(`relatorio-escala_${baseNome}_${slugMes}.pdf`);
  }, [
    selectedEscala,
    selectedEscalaId,
    gradeMonthStart,
    gradeMonthEnd,
    gradesForGrid,
    plantaoMapMonth,
    plantaoVagoSlots,
    equipeIdParaGrade,
    equipeMedicosResp,
    alocacoes,
  ]);

  const medicoParaReplicar = cellModal.medico?.id ?? medicoIdToAllocateCell;
  const alocacaoParaValor = useMemo(() => {
    if (!cellModal.medico?.id) return null;
    return alocacoes.find((a) => a.medicoId === cellModal.medico!.id) ?? null;
  }, [alocacoes, cellModal.medico]);

  const plantaoSlotValor = useMemo(() => {
    if (!cellModal.date || !cellModal.grade) return null;
    const key = `${dateToInput(cellModal.date)}_${cellModal.grade.id}`;
    const slots = plantaoMap.get(key) ?? [];
    const medicoModalId = cellModal.medico?.id;
    const slot = medicoModalId ? slots.find((s) => s?.medico?.id === medicoModalId) : slots[0];
    if (slot?.valorHora == null || slot.valorHora === '') return null;
    const n = parseFloat(String(slot.valorHora));
    return Number.isNaN(n) ? null : n;
  }, [cellModal.date, cellModal.grade, cellModal.medico, plantaoMap]);

  const valorBaseModal = useMemo(() => {
    if (!cellModal.grade) return null;
    return valorByGrade.get(cellModal.grade.id) ?? null;
  }, [cellModal.grade, valorByGrade]);

  const adicionalPercentualModal = useMemo(() => {
    if (!cellModal.date || !cellModal.grade) return null;
    const key = `${dateToInput(cellModal.date)}_${cellModal.grade.id}`;
    return adicionalPercentualByDataGrade.get(key) ?? null;
  }, [adicionalPercentualByDataGrade, cellModal.date, cellModal.grade]);

  const valorFinalModal = getValorFinalComAdicional(valorBaseModal, adicionalPercentualModal);

  useEffect(() => {
    if (!cellModal.open || !cellModal.date || !cellModal.grade) return;
    setAdicionalPercentualInput(String(adicionalPercentualModal ?? 0));
  }, [cellModal.open, cellModal.date, cellModal.grade, adicionalPercentualModal]);

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400 stagger-1">
        <h2 className="text-lg font-bold text-coop-900 mb-2 font-display">Acesso restrito</h2>
        <p className="text-sm text-coop-700 font-serif">Somente o perfil Master pode gerenciar escalas.</p>
      </div>
    );
  }

  const invalidateEscalas = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'escalas'] });
  };

  const invalidateAlocacoes = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'escalas', selectedEscalaId, 'medicos'] });
  };

  const invalidatePlantoes = () => {
    const escalaIds = new Set<string>();
    if (selectedEscalaId) escalaIds.add(selectedEscalaId);
    if (escalaIdParaHistoricoDrawer) escalaIds.add(escalaIdParaHistoricoDrawer);
    for (const eid of escalaIds) {
      queryClient.invalidateQueries({ queryKey: ['admin', 'escalas', eid, 'plantoes'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'escalas', eid, 'plantoes-month'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'escalas', eid, 'trocas-plantao-historico'] });
    }
    if (selectedEquipeId) {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'equipes', selectedEquipeId, 'plantoes', 'year-range'],
      });
    }
  };

  const abrirModalReplicarMes = () => {
    const next = new Date(gradeMonthStart);
    next.setMonth(next.getMonth() + 1);
    setReplicarMesDestino(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    );
    setReplicarMesModalOpen(true);
    setError(null);
  };

  const confirmarReplicarMes = async () => {
    if (!selectedEscalaId || replicarMesDestino === mesOrigemGradeYM) return;
    setReplicarMesSubmitting(true);
    setError(null);
    try {
      const res = await adminService.replicarEscalaPlantoesMes(selectedEscalaId, {
        mesOrigem: mesOrigemGradeYM,
        mesDestino: replicarMesDestino,
      });
      const d = res?.data;
      if (!d) {
        setError('Resposta inválida do servidor.');
        return;
      }
      const partes = [
        `${d.criados} plantão(ões) criado(s).`,
        d.ignoradosJaExistia > 0 ? `${d.ignoradosJaExistia} ignorado(s) (já existiam no destino).` : '',
        d.ignoradosForaPeriodo > 0 ? `${d.ignoradosForaPeriodo} fora do período da escala.` : '',
        d.erros > 0 ? `${d.erros} não replicado(s) (ex.: médico inativo).` : '',
      ].filter(Boolean);
      notify({
        kind: 'success',
        title: 'Escala replicada',
        message: partes.length ? partes.join(' ') : 'Plantões replicados com sucesso.',
        source: 'escala',
      });
      setReplicarMesModalOpen(false);
      invalidatePlantoes();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao replicar plantões');
    } finally {
      setReplicarMesSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingEscalaId(null);
    setEscalaFormModalOpen(false);
    setError(null);
  };

  const startEdit = (escala: Escala) => {
    setEditingEscalaId(escala.id);
    setForm({
      contratoAtivoId: escala.contratoAtivoId,
      nome: escala.nome,
      descricao: escala.descricao || '',
      dataInicio: toDateInput(escala.dataInicio),
      dataFim: toDateInput(escala.dataFim),
      ativo: escala.ativo,
    });
  };

  const submitEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction(true);
    setError(null);
    try {
      const payload = {
        contratoAtivoId: form.contratoAtivoId,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        ativo: form.ativo,
      };
      if (!payload.nome || !payload.contratoAtivoId || !payload.dataInicio || !payload.dataFim) {
        throw new Error('Preencha contrato, nome, data inicial e data final.');
      }

      if (editingEscalaId) {
        await adminService.updateEscala(editingEscalaId, payload);
      } else {
        await adminService.createEscala(payload);
      }

      resetForm();
      await invalidateEscalas();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar escala');
    } finally {
      setLoadingAction(false);
    }
  };

  const deleteEscala = async (escala: Escala) => {
    const ok = window.confirm(`Excluir escala "${escala.nome}"?`);
    if (!ok) return;
    setLoadingAction(true);
    try {
      await adminService.deleteEscala(escala.id);
      if (selectedEscalaId === escala.id) {
        setSelectedEscalaId('');
      }
      if (editingEscalaId === escala.id) {
        resetForm();
      }
      await invalidateEscalas();
    } finally {
      setLoadingAction(false);
    }
  };

  const alocarMedico = async () => {
    if (!selectedEscalaId || !medicoIdToAllocate) return;
    setLoadingAction(true);
    setError(null);
    try {
      await adminService.alocarMedicoEscala(selectedEscalaId, { medicoId: medicoIdToAllocate });
      setMedicoIdToAllocate('');
      setMedicoAllocateSearch('');
      setMedicoAllocateOpen(false);
      await invalidateAlocacoes();
      await invalidateEscalas();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao alocar médico');
    } finally {
      setLoadingAction(false);
    }
  };

  const removerAlocacao = async (medicoId: string) => {
    if (!selectedEscalaId) return;
    setLoadingAction(true);
    try {
      await adminService.removerMedicoEscala(selectedEscalaId, medicoId);
      await invalidateAlocacoes();
      await invalidateEscalas();
    } finally {
      setLoadingAction(false);
    }
  };

  const alocarMedicoNoPlantao = async () => {
    if (!selectedEscalaId || !cellModal.grade || !cellModal.date || !medicoIdToAllocateCell) return;
    setLoadingAction(true);
    setError(null);
    try {
      const baseValor = valorByGrade.get(cellModal.grade.id) ?? null;
      const dateStr = dateToInput(cellModal.date);
      const percentual = adicionalPercentualByDataGrade.get(`${dateStr}_${cellModal.grade.id}`) ?? null;
      const valorFinal = getValorFinalComAdicional(baseValor, percentual);
      await adminService.createEscalaPlantao(selectedEscalaId, {
        data: dateStr,
        gradeId: cellModal.grade.id,
        medicoId: medicoIdToAllocateCell,
        valorHora: valorFinal,
      });
      setMedicoIdToAllocateCell('');
      setMedicoAllocateCellSearch('');
      setMedicoAllocateCellOpen(false);
      invalidatePlantoes();
      setCellModal((m) => ({ ...m, open: false }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atribuir plantão');
    } finally {
      setLoadingAction(false);
    }
  };

  const removerPlantaoDaCelula = async () => {
    if (!selectedEscalaId || !cellModal.plantaoId) return;
    setLoadingAction(true);
    try {
      await adminService.removerEscalaPlantao(selectedEscalaId, cellModal.plantaoId);
      invalidatePlantoes();
      setCellModal((m) => ({ ...m, open: false }));
    } finally {
      setLoadingAction(false);
    }
  };

  const salvarAdicionalDoDiaModal = async () => {
    if (!isMaster || !selectedEscala?.contratoAtivoId || !cellModal.date || !cellModal.grade) return;
    setLoadingAction(true);
    setError(null);
    try {
      const percentual = Number(adicionalPercentualInput.replace(',', '.'));
      if (!Number.isFinite(percentual) || percentual < 0 || percentual > 300) {
        setError('Percentual inválido (use um número entre 0 e 300).');
        return;
      }
      await adminService.upsertAdicionalPlantao({
        contratoAtivoId: selectedEscala.contratoAtivoId,
        data: dateToInput(cellModal.date),
        gradeId: cellModal.grade.id,
        percentual,
      });
      await queryClient.invalidateQueries({
        queryKey: [
          'admin',
          'adicionais-plantao',
          selectedEscala.contratoAtivoId,
          dateToInput(gradeMonthStart),
          dateToInput(gradeMonthEnd),
        ],
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar adicional');
    } finally {
      setLoadingAction(false);
    }
  };

  const removerAdicionalDoDiaModal = async () => {
    if (!isMaster || !selectedEscala?.contratoAtivoId || !cellModal.date || !cellModal.grade) return;
    setLoadingAction(true);
    setError(null);
    try {
      await adminService.removerAdicionalPlantao({
        contratoAtivoId: selectedEscala.contratoAtivoId,
        data: dateToInput(cellModal.date),
        gradeId: cellModal.grade.id,
      });
      await queryClient.invalidateQueries({
        queryKey: [
          'admin',
          'adicionais-plantao',
          selectedEscala.contratoAtivoId,
          dateToInput(gradeMonthStart),
          dateToInput(gradeMonthEnd),
        ],
      });
      setAdicionalPercentualInput('0');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao remover adicional');
    } finally {
      setLoadingAction(false);
    }
  };

  const replicarMedicoNaSemana = async () => {
    if (!selectedEscalaId || !cellModal.grade || !medicoParaReplicar) return;
    setLoadingAction(true);
    setError(null);
    try {
      const dias = getWeekDates(weekStart);
      for (const d of dias) {
        const baseValor = valorByGrade.get(cellModal.grade.id) ?? null;
        const dateStr = dateToInput(d);
        const percentual = adicionalPercentualByDataGrade.get(`${dateStr}_${cellModal.grade.id}`) ?? null;
        const valorHora = getValorFinalComAdicional(baseValor, percentual);
        await adminService.createEscalaPlantao(selectedEscalaId, {
          data: dateStr,
          gradeId: cellModal.grade.id,
          medicoId: medicoParaReplicar,
          valorHora,
        });
      }
      setMedicoIdToAllocateCell('');
      setMedicoAllocateCellSearch('');
      invalidatePlantoes();
      setCellModal((m) => ({ ...m, open: false }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao replicar');
    } finally {
      setLoadingAction(false);
    }
  };

  if (viewEscalas === 'grupos') {
    const equipePanelTabs: { id: typeof equipePanelTab; label: string }[] = [
      { id: 'calendario', label: 'Calendário' },
      { id: 'editar', label: 'Editar escala' },
      { id: 'membros', label: 'Membros' },
      { id: 'historico', label: 'Histórico' },
      { id: 'relatorio', label: 'Relatório' },
    ];
    return (
      <>
        <div className="flex flex-col h-full">
        <div className="flex-1 bg-white rounded-lg border border-coop-200/80 flex flex-col overflow-hidden">
          <div className="pb-4 border-b border-coop-200 px-4 sm:px-5 flex-shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3 my-3">
              <p className="font-semibold text-coop-900 text-lg">Lista de grupos</p>
              <button
                type="button"
                className="btn btn-primary inline-flex items-center gap-2"
                onClick={() => setViewEscalas('escalas')}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M7 2v4M17 2v4M3 10h18M8 14h8M8 18h5" /></svg>
                Escalas e grades
              </button>
            </div>
            <div className="min-w-0 max-w-xl">
              <label htmlFor="filtro-grupo-contrato" className="block text-xs font-medium text-coop-600 mb-1">
                Contrato
              </label>
              <select
                id="filtro-grupo-contrato"
                value={filtroListaContratoId}
                onChange={(e) => {
                  setFiltroListaContratoId(e.target.value);
                  setSearchGrupos('');
                }}
                className="w-full py-2 px-3 text-sm border border-coop-200 rounded-lg outline-none bg-coop-50/50 focus:ring-2 focus:ring-coop-500/30 focus:border-coop-500"
              >
                <option value="">Selecione um contrato</option>
                {contratosParaFiltroLista.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            {filtroListaContratoId ? (
              <div className="mt-3 flex flex-col gap-2">
                {searchGrupos.trim() ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm font-medium text-coop-600 hover:text-coop-800 underline"
                      onClick={() => setSearchGrupos('')}
                    >
                      Limpar busca
                    </button>
                  </div>
                ) : null}
                <div className="relative flex items-center gap-2">
                  <svg className="absolute left-3 h-5 w-5 text-gray-500 pointer-events-none" fill="currentColor" viewBox="0 0 512 512"><path d="M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2 128-128 128z" /></svg>
                  <input
                    type="text"
                    placeholder="Procurar grupo"
                    value={searchGrupos}
                    onChange={(e) => setSearchGrupos(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-base border border-coop-200 rounded-lg outline-none bg-coop-50/50 focus:ring-2 focus:ring-coop-500/30 focus:border-coop-500"
                  />
                  <Link
                    to="/subgrupos-equipes"
                    className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-lg bg-coop-100 hover:bg-coop-200 text-coop-800 transition"
                    title="Criar subgrupo ou equipe"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {!filtroListaContratoId ? (
              <div className="p-6 text-center text-coop-700">
                Selecione um contrato acima para ver subgrupos e equipes vinculados a ele.
              </div>
            ) : subgruposFiltrados.length === 0 ? (
              <div className="p-6 text-center text-coop-700">
                {searchGrupos.trim()
                  ? 'Nenhum subgrupo corresponde à busca. Ajuste o texto em "Procurar grupo".'
                  : 'Nenhum subgrupo com escalas neste contrato. Vincule subgrupos em Contratos ativos e ative “Usar escalas” no subgrupo em Subgrupos e Equipes.'}
              </div>
            ) : (
              <>
        <div>
                  <h2 className="sticky top-0 px-4 py-3 bg-white border-b border-coop-100 text-lg font-bold text-coop-800 shadow-sm z-10">Subgrupos</h2>
                  <div className="flex flex-col gap-0 p-4">
                    {subgruposFiltrados.map((s) => {
                      const countEquipes = s._count?.equipes ?? 0;
                      const isSelected = selectedSubgrupoId === s.id;
                      const contratosComEscala = (s.contratoSubgrupos ?? [])
                        .map((cs) => cs.contratoAtivo?.nome)
                        .filter(Boolean) as string[];
                      const contratosLabel =
                        contratosComEscala.length === 0
                          ? ''
                          : contratosComEscala.length === 1
                            ? `Contrato: ${contratosComEscala[0]}`
                            : `Contratos: ${contratosComEscala.join(', ')}`;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSubgrupoId(isSelected ? '' : s.id)}
                          className={`flex items-stretch gap-2 p-3 rounded-lg w-full transition text-left border-b border-coop-100 last:border-b-0 ${isSelected ? 'bg-coop-100 ring-2 ring-coop-500/30' : 'hover:bg-coop-50/80'}`}
                        >
                          <div className="w-1.5 rounded-md bg-coop-500 flex-shrink-0 self-stretch" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-coop-900 truncate">{s.nome}</p>
                            <p className="text-sm text-coop-600">
                              {countEquipes} equipe(s) · {s._count?.escalaSubgrupos ?? 0} escala(s)
                              {contratosLabel ? ` · ${contratosLabel}` : ''}
                            </p>
        </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedSubgrupoId && selectedSubgrupo && (
                  <div>
                    <h2 className="sticky top-0 px-4 py-3 bg-white border-b border-coop-100 text-lg font-bold text-coop-800 shadow-sm z-10">
                      Escala de {selectedSubgrupo.nome}
                    </h2>
                    <div className="flex flex-col gap-0 p-4">
                      {equipesDoSubgrupoSelecionado.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="text-coop-700 mb-3">Este subgrupo não possui equipe associada ainda.</p>
                          <Link
                            to="/subgrupos-equipes"
                            state={{ subgrupoId: selectedSubgrupoId }}
                            className="text-sm font-semibold text-coop-600 hover:text-coop-800 underline"
                          >
                            Ir para Subgrupos e Equipes para adicionar
        </Link>
                        </div>
                      ) : (
                        equipesDoSubgrupoSelecionado.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => { setSelectedEquipeId(e.id); setEquipePanelTab('calendario'); }}
                            className="flex items-stretch gap-2 p-3 rounded-lg w-full hover:bg-coop-50/80 transition text-left border-b border-coop-100 last:border-b-0"
                          >
                            <div className="w-1.5 rounded-md bg-coop-500 flex-shrink-0 self-stretch" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-coop-900 truncate">{e.nome}</p>
                              <p className="text-sm text-coop-600">{e.subgrupo?.nome ?? 'Sem subgrupo'}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {selectedEquipeId && selectedEquipe && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setSelectedEquipeId('')}
            aria-hidden="true"
          />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            <div className="bg-coop-600 flex-shrink-0">
              <div className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setSelectedEquipeId('')}
                  className="p-2 rounded-lg text-white hover:bg-coop-500 transition"
                  aria-label="Fechar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-semibold truncate">{selectedEquipe.nome}</h2>
                  <p className="text-coop-100 text-sm truncate">{selectedEquipe.subgrupo?.nome ?? 'Sem subgrupo'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center overflow-x-auto border-b border-coop-200 flex-shrink-0">
              {equipePanelTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEquipePanelTab(tab.id)}
                  className={`flex flex-col items-center flex-1 min-w-[4.5rem] py-3 text-xs transition ${equipePanelTab === tab.id ? 'bg-coop-50 text-coop-700 border-b-2 border-coop-500 font-semibold' : 'text-gray-500 hover:bg-coop-50/50 hover:text-coop-600'}`}
                >
                  {tab.id === 'calendario' && <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
                  {tab.id === 'editar' && <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>}
                  {tab.id === 'membros' && <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                  {tab.id === 'historico' && <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
                  {tab.id === 'relatorio' && <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {equipePanelTab === 'calendario' && (() => {
                const equipeEscalas = equipeEscalasResp?.data ?? [];
                const equipeSemEscala = equipeEscalas.length === 0;
                const carregandoEscalas = !!selectedEquipeId && equipeEscalasResp === undefined;
                if (carregandoEscalas) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-coop-700">
                      <p className="text-sm">Carregando...</p>
                    </div>
                  );
                }
                if (equipeSemEscala) {
                  return (
                    <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center py-8 px-4 text-center">
                      <div className="rounded-full bg-amber-100 p-4 mb-4">
                        <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                      <h3 className="text-lg font-semibold text-coop-900 mb-2">Nenhuma escala vinculada</h3>
                      <p className="text-sm text-gray-600 mb-4">O subgrupo desta equipe ainda não possui escala. Crie uma escala e vincule o subgrupo e a equipe para visualizar o calendário.</p>
                      <Link
                        to="/subgrupos-equipes"
                        state={{
                          subgrupoId: selectedEquipe?.subgrupoId ?? selectedEquipe?.subgrupo?.id ?? '',
                          equipeId: selectedEquipeId ?? '',
                        }}
                        className="btn btn-primary"
                      >
                        Criar escala e vincular
                      </Link>
                    </div>
                  );
                }
                const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                const year = calendarViewDate.getFullYear();
                const month = calendarViewDate.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDate = new Date(year, month + 1, 0).getDate();
                const startOffset = firstDay.getDay();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                const isPastDay = (day: number) => {
                  const d = new Date(year, month, day);
                  d.setHours(0, 0, 0, 0);
                  return d.getTime() < today.getTime();
                };
                const cells: (number | null)[] = [];
                for (let i = 0; i < startOffset; i++) cells.push(null);
                for (let d = 1; d <= lastDate; d++) cells.push(d);
                while (cells.length < 42) cells.push(null);
                return (
                  <div className="w-full max-w-sm mx-auto">
                    <div className="flex flex-col w-full bg-white rounded-lg border border-coop-100 overflow-hidden">
                      <header className="flex items-center justify-between p-4 border-b border-coop-100">
                        <button
                          type="button"
                          onClick={() => setCalendarViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
                          className="p-2 rounded-lg text-coop-800 hover:bg-coop-100 transition"
                          aria-label="Mês anterior"
                        >
                          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="w-6 h-6"><path fill="none" d="M0 0h24v24H0V0z" /><path d="M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" /></svg>
                        </button>
                        <div className="flex flex-row gap-2">
                          <span className="text-lg font-semibold text-coop-900">{monthNames[month]}</span>
                          <span className="text-lg font-semibold text-gray-400">{year}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCalendarViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
                          className="p-2 rounded-lg text-coop-800 hover:bg-coop-100 transition"
                          aria-label="Próximo mês"
                        >
                          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="w-6 h-6"><path fill="none" d="M0 0h24v24H0V0z" /><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" /></svg>
                        </button>
                      </header>
                      <div className="grid grid-cols-7 px-3 text-center text-coop-700 my-2 text-sm font-medium">
                        <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5 px-3 pb-4">
                        {cells.map((day, idx) => (
                          <div key={idx} className="w-full aspect-square relative">
                            {day === null ? (
                              <div className="w-full h-full" />
                            ) : (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedCalendarDay({ year, month, day })}
                                onKeyDown={(e) => e.key === 'Enter' && setSelectedCalendarDay({ year, month, day })}
                                className={`flex items-center justify-center w-full h-full rounded-lg cursor-pointer transition ${
                                  isToday(day)
                                    ? 'bg-gray-200 border-2 border-white ring-4 ring-coop-500 font-bold text-gray-900'
                                    : isPastDay(day)
                                      ? 'bg-gray-200 opacity-50 text-gray-400 font-medium'
                                      : 'bg-gray-200 hover:bg-gray-300 font-medium text-gray-900'
                                }`}
                              >
                                <span>{day}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {equipePanelTab === 'editar' && (() => {
                const equipeEscalas = equipeEscalasResp?.data ?? [];
                const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                const getEscalaForMonth = (year: number, month1Based: number): Escala | null => {
                  // Várias escalas podem cobrir o mesmo mês (ex.: uma anual + recortes mensais).
                  // Usamos a de menor duração que ainda intersecta o mês — é a mais específica e
                  // reflete melhor o status (rascunho/publicada) daquele período.
                  const firstDay = new Date(year, month1Based - 1, 1);
                  const lastDay = new Date(year, month1Based, 0);
                  const candidates = equipeEscalas.filter((e) => {
                    const inicio = new Date(e.dataInicio);
                    const fim = new Date(e.dataFim);
                    return inicio <= lastDay && fim >= firstDay;
                  });
                  if (candidates.length === 0) return null;
                  if (candidates.length === 1) return candidates[0];
                  return [...candidates].sort((a, b) => {
                    const spanA = new Date(a.dataFim).getTime() - new Date(a.dataInicio).getTime();
                    const spanB = new Date(b.dataFim).getTime() - new Date(b.dataInicio).getTime();
                    if (spanA !== spanB) return spanA - spanB;
                    return new Date(b.dataInicio).getTime() - new Date(a.dataInicio).getTime();
                  })[0];
                };
                return (
                  <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                    <p className="text-xl text-center my-2 font-display font-semibold text-coop-900">Gerenciamento de escalas</p>
                    <div className="flex flex-row my-2 items-center border border-coop-200 rounded-xl p-3 justify-between mb-3">
                      <button
                        type="button"
                        onClick={() => setEditarEscalaYear((y) => y - 1)}
                        className="p-2 rounded-lg text-coop-600 hover:bg-coop-100 transition-colors"
                        aria-label="Ano anterior"
                      >
                        <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M257.5 445.1l-22.2 22.2c-9.4 9.4-24.6 9.4-33.9 0L7 273c-9.4-9.4-9.4-24.6 0-33.9L201.4 44.7c9.4-9.4 24.6-9.4 33.9 0l22.2 22.2c9.5 9.5 9.3 25-.4 34.3L136.6 216H424c13.3 0 24 10.7 24 24v32c0 13.3-10.7 24-24 24H136.6l120.5 114.8c9.8 9.3 10 24.8.4 34.3z" /></svg>
                      </button>
                      <span className="text-lg font-semibold text-coop-900 font-display">{editarEscalaYear}</span>
                      <button
                        type="button"
                        onClick={() => setEditarEscalaYear((y) => y + 1)}
                        className="p-2 rounded-lg text-coop-600 hover:bg-coop-100 transition-colors"
                        aria-label="Próximo ano"
                      >
                        <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M190.5 66.9l22.2-22.2c9.4-9.4 24.6-9.4 33.9 0L441 239c9.4 9.4 9.4 24.6 0 33.9L246.6 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.2-22.2c-9.5-9.5-9.3-25 .4-34.3L311.4 296H24c-13.3 0-24-10.7-24-24v-32c0-13.3 10.7-24 24-24h287.4L190.9 101.2c-9.8-9.3-10-24.8-.4-34.3z" /></svg>
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((month1Based) => {
                        const escala = getEscalaForMonth(editarEscalaYear, month1Based);
                        const plantoesNoMes = escala
                          ? plantaoCountByEscalaMonthGerenciamento.get(`${escala.id}|${month1Based}`) ?? 0
                          : 0;

                        // Publicada só se a escala está publicada (ativo) e há plantão na grade naquele mês.
                        // Uma escala anual publicada não implica todos os meses “publicados”.
                        let status: 'Sem escala' | 'Em rascunho' | 'Publicada' | 'Sem plantões' | 'Carregando…' =
                          'Sem escala';
                        let statusColor = 'text-gray-500';
                        if (loadingPlantoesAnoGerenciamento && escala) {
                          status = 'Carregando…';
                          statusColor = 'text-gray-400';
                        } else if (escala) {
                          if (!escala.ativo) {
                            status = 'Em rascunho';
                            statusColor = 'text-amber-600';
                          } else if (plantoesNoMes > 0) {
                            status = 'Publicada';
                            statusColor = 'text-coop-600';
                          } else {
                            status = 'Sem plantões';
                            statusColor = 'text-gray-500';
                          }
                        }
                        const now = new Date();
                        const isMesAtual = editarEscalaYear === now.getFullYear() && month1Based === now.getMonth() + 1;
                        return (
                          <div
                            key={month1Based}
                            className={`flex w-full p-3 items-center border-b border-coop-100 last:border-b-0 ${isMesAtual ? 'bg-coop-100/80 ring-1 ring-coop-400/50' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-lg font-semibold text-coop-900 font-display">
                                {monthNames[month1Based - 1]}
                                {isMesAtual && <span className="ml-2 text-xs font-normal text-coop-600">(mês atual)</span>}
                              </p>
                              <p className={`text-sm ${statusColor}`}>{status}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                panelGradeHistoryDepthRef.current += 1;
                                window.history.pushState({ vivaEscalasPanelGrade: true }, '', window.location.href);
                                setViewEscalas('escalas');
                                const firstDay = new Date(editarEscalaYear, month1Based - 1, 1);
                                firstDay.setHours(0, 0, 0, 0);
                                setGradeMonthStart(firstDay);
                                if (escala) {
                                  setSelectedEscalaId(escala.id);
                                } else {
                                  setSelectedEscalaId('');
                                }
                              }}
                              className="btn btn-secondary text-sm shrink-0"
                            >
                              {escala ? (escala.ativo ? 'Ver escala' : 'Editar escala') : 'Abrir mês'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {equipePanelTab === 'membros' && (() => {
                const equipeMedicos = equipeMedicosResp?.data ?? [];
                const equipeEscalas = equipeEscalasResp?.data ?? [];
                const escalaAtualDaEquipe = selectedEscalaId && equipeEscalas.some((e: { id: string }) => e.id === selectedEscalaId);
                const alocadosIds = escalaAtualDaEquipe ? new Set(alocacoes.map((a: { medicoId: string }) => a.medicoId)) : new Set<string>();
                const idsNaEquipe = new Set(equipeMedicos.map((em: { medicoId: string }) => em.medicoId));
                const todosMedicos = (medicosMembrosEquipeResp?.data ?? []) as AdminMedico[];
                const qBusca = membrosEquipeBusca.trim().toLowerCase();
                const medicosDisponiveis = todosMedicos.filter((m) => {
                  if (idsNaEquipe.has(m.id)) return false;
                  if (!qBusca) return true;
                  const nome = (m.nomeCompleto ?? '').toLowerCase();
                  const crm = (m.crm ?? '').toLowerCase();
                  return nome.includes(qBusca) || crm.includes(qBusca);
                });
                const qNaEquipeLista = membrosNaEquipeBusca.trim().toLowerCase();
                const equipeMedicosFiltradosNaLista = !qNaEquipeLista
                  ? equipeMedicos
                  : equipeMedicos.filter((em: { medico?: { nomeCompleto?: string; crm?: string | null } }) => {
                      const nome = (em.medico?.nomeCompleto ?? '').toLowerCase();
                      const crm = (em.medico?.crm ?? '').toLowerCase();
                      return nome.includes(qNaEquipeLista) || crm.includes(qNaEquipeLista);
                    });
                const equipeIdAlvo = selectedEquipeId!;
                return (
                  <div className="py-2">
                    <p className="font-medium text-coop-900 mb-3">Membros da equipe</p>
                    {!selectedEquipeId ? (
                      <p className="text-sm text-gray-500">Selecione uma equipe para ver os profissionais.</p>
                    ) : (
                      <>
                        <div className="mb-4 pb-4 border-b border-coop-100">
                          <p className="text-xs font-semibold uppercase tracking-wide text-coop-600 mb-2">Adicionar profissionais</p>
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
                          {loadingMedicosMembrosEquipe && todosMedicos.length === 0 ? (
                            <p className="text-sm text-coop-600 py-2">Carregando profissionais…</p>
                          ) : medicosDisponiveis.length === 0 ? (
                            <p className="text-sm text-gray-500 py-1">
                              {todosMedicos.length === 0 && !loadingMedicosMembrosEquipe
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
                                      onClick={() => adicionarMedicoNaEquipeUm(equipeIdAlvo, m.id)}
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
                                onClick={() => {
                                  const ids = [...membrosEquipePickIds];
                                  void adicionarMedicosSelecionadosNaEquipe(equipeIdAlvo, ids);
                                }}
                              >
                                {membrosEquipeActionLoading
                                  ? 'Aplicando…'
                                  : `Adicionar selecionados (${membrosEquipePickIds.length})`}
                              </button>
                            </>
                          )}
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-coop-600 mb-2">Na equipe</p>
                        {equipeMedicos.length === 0 ? (
                          <p className="text-sm text-gray-500">Nenhum profissional vinculado a esta equipe.</p>
                        ) : (
                          <>
                            <label htmlFor="busca-membros-na-equipe-escalas" className="sr-only">
                              Pesquisar profissionais já na equipe por nome ou CRM
                            </label>
                            <input
                              id="busca-membros-na-equipe-escalas"
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
                              <p className="text-sm text-gray-500">Nenhum resultado para a pesquisa.</p>
                            ) : (
                              <ul className="space-y-2 max-h-[min(50vh,360px)] overflow-y-auto pr-0.5">
                                {equipeMedicosFiltradosNaLista.map(
                                  (em: { id: string; medicoId: string; medico?: { nomeCompleto: string; crm?: string | null } }) => (
                                    <li
                                      key={em.id}
                                      className="flex items-center justify-between gap-2 border border-coop-200 rounded-lg px-3 py-2 bg-white"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-medium text-coop-900 text-sm">{em.medico?.nomeCompleto ?? '—'}</p>
                                        {em.medico?.crm && <p className="text-xs text-coop-600">CRM: {em.medico.crm}</p>}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {escalaAtualDaEquipe && alocadosIds.has(em.medicoId) && (
                                          <span className="text-[10px] font-medium text-coop-600 bg-coop-100 px-2 py-0.5 rounded whitespace-nowrap">
                                            Alocado na escala
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          className="btn btn-secondary text-xs py-1 px-2"
                                          disabled={membrosEquipeActionLoading}
                                          onClick={() => removerMedicoDaEquipePainel(equipeIdAlvo, em.medicoId)}
                                        >
                                          Remover
                                        </button>
                                      </div>
                                    </li>
                                  )
                                )}
                              </ul>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
              {equipePanelTab === 'historico' && (() => {
                if (!selectedEquipeId) {
                  return (
                    <p className="text-sm text-gray-500 text-center py-8">Selecione uma equipe para ver o histórico.</p>
                  );
                }
                if (equipeEscalasResp === undefined) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-coop-700">
                      <p className="text-sm">Carregando escalas da equipe…</p>
                    </div>
                  );
                }
                if (equipeEscalasForHistorico.length === 0) {
                  return (
                    <div className="text-center py-8 text-coop-700 px-2">
                      <p className="font-medium mb-1">Histórico da escala</p>
                      <p className="text-sm">Nenhuma escala vinculada a esta equipe. Vincule uma escala para ver alocações, plantões e trocas.</p>
                    </div>
                  );
                }

                if (
                  historicoDrawerDadosEnabled &&
                  (loadingHistoricoDrawerMedicos || loadingHistoricoDrawerPlantoes || loadingTrocasHistorico)
                ) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-coop-700">
                      <p className="text-sm">Carregando histórico…</p>
                    </div>
                  );
                }

                const trocasRows = (trocasHistoricoResp?.data ?? []) as HistoricoTrocaPlantaoEscala[];
                const alocacoesHistoricoDrawer = (historicoDrawerMedicosResp?.data ?? []) as {
                  id: string;
                  medicoId: string;
                  medico: { nomeCompleto: string; crm: string | null };
                  createdAt?: string;
                }[];
                const plantoesHistoricoDrawer = (historicoDrawerPlantoesMonthResp?.data ?? []) as {
                  id: string;
                  data: string;
                  gradeId: string;
                  medico: { nomeCompleto: string; crm: string };
                }[];

                const escalaHistoricoMeta = equipeEscalasForHistorico.find((e) => e.id === escalaIdParaHistoricoDrawer);

                const historico: {
                  id: string;
                  data: Date;
                  tipo: 'alocacao' | 'plantao' | 'troca';
                  titulo: string;
                  descricao: string;
                }[] = [];

                // Alocações na escala (médicos vinculados à escala)
                for (const a of alocacoesHistoricoDrawer) {
                  if (!a.createdAt) continue;
                  historico.push({
                    id: `aloc-${a.id}`,
                    data: new Date(a.createdAt),
                    tipo: 'alocacao',
                    titulo: `Médico alocado na escala`,
                    descricao: `${fixMojibake(a.medico.nomeCompleto)} (${a.medico.crm ?? 'CRM não informado'})`,
                  });
                }

                // Plantões do mês visível na grade principal (mesmo recorte de datas)
                for (const p of plantoesHistoricoDrawer) {
                  if (!p.medico) continue;
                  const d = new Date(p.data);
                  const grade = gradesForGrid.find((g) => g.id === p.gradeId);
                  historico.push({
                    id: `plantao-${p.id}`,
                    data: d,
                    tipo: 'plantao',
                    titulo: `Plantão ${grade?.label ?? ''} atribuído`,
                    descricao: `${fixMojibake(p.medico.nomeCompleto)} (${p.medico.crm}) · ${formatDayShort(d)} · ${grade?.horario ?? ''}`,
                  });
                }

                for (const t of trocasRows) {
                  const dPlantao = new Date(t.dataPlantao + 'T12:00:00');
                  const grade = gradesForGrid.find((g) => g.id === t.gradeId);
                  const sol = fixMojibake(t.solicitante.nomeCompleto);
                  const dst = t.destino
                    ? fixMojibake(t.destino.nomeCompleto)
                    : 'colega (pedido à equipe)';
                  const crmS = t.solicitante.crm ?? '—';
                  const crmD = t.destino?.crm ?? '—';
                  const aceita = t.status === 'ACEITA';
                  const ehCederHist = String(t.tipoSolicitacao ?? 'PERMUTA').toUpperCase() === 'CEDER';
                  const blocoData = `· ${formatDayShort(dPlantao)} · ${grade?.label ?? 'Turno'} ${grade?.horario ? `· ${grade.horario}` : ''}`;
                  historico.push({
                    id: `troca-${t.id}`,
                    data: new Date(t.respondidaEm),
                    tipo: 'troca',
                    titulo: aceita
                      ? ehCederHist
                        ? 'Cessão de plantão concluída'
                        : 'Permuta de plantão concluída'
                      : ehCederHist
                        ? 'Cessão de plantão recusada'
                        : 'Permuta de plantão recusada',
                    descricao: aceita
                      ? ehCederHist
                        ? `${sol} (${crmS}) cedeu o plantão a ${dst}${t.destino ? ` (${crmD})` : ''} ${blocoData}`
                        : `${sol} (${crmS}) concluiu permuta com ${dst}${t.destino ? ` (${crmD})` : ''} ${blocoData}`
                      : ehCederHist
                        ? `${sol} (${crmS}) pediu cessão para ${dst}${t.destino ? ` (${crmD})` : ''} — recusada ${blocoData}`
                        : `${sol} (${crmS}) solicitou permuta com ${dst}${t.destino ? ` (${crmD})` : ''} — recusada ${blocoData}`,
                  });
                }

                historico.sort((a, b) => b.data.getTime() - a.data.getTime());

                if (historico.length === 0) {
                  return (
                    <div className="text-center py-8 text-coop-700">
                      <p className="font-medium mb-1">Histórico da escala</p>
                      <p className="text-sm">Nenhuma atividade registrada nesta escala até o momento.</p>
                    </div>
                  );
                }

                const porMes = new Map<string, { label: string; itens: typeof historico }>();
                for (const item of historico) {
                  const { key, label } = monthKeyAndLabel(item.data);
                  const bucket = porMes.get(key);
                  if (bucket) {
                    bucket.itens.push(item);
                  } else {
                    porMes.set(key, { label, itens: [item] });
                  }
                }
                const mesesOrdenados = [...porMes.entries()].sort(([ka], [kb]) => kb.localeCompare(ka));

                return (
                  <div className="py-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-coop-600 font-display mb-1">
                      Histórico da escala
                    </p>
                    {escalaHistoricoMeta && (
                      <p className="text-xs text-coop-600 font-serif mb-1">
                        Escala: <span className="font-medium text-coop-800">{escalaHistoricoMeta.nome}</span>
                        {equipeEscalasForHistorico.length > 1 && (
                          <span className="block mt-1 text-coop-500">
                            Esta equipe tem várias escalas. Ajuste a escala na tela &quot;Escalas e grades&quot; para ver outra.
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-[11px] text-coop-500 font-serif mb-4">
                      Plantões listados conforme o mês da grade principal ({formatDayShort(gradeMonthStart)} –{' '}
                      {formatDayShort(gradeMonthEnd)}). Trocas incluem todo o período desta escala.
                    </p>
                    <div className="space-y-6">
                      {mesesOrdenados.map(([mesKey, { label, itens }]) => {
                        const trocasNoMes = itens.filter((i) => i.tipo === 'troca');
                        return (
                          <section key={mesKey} className="space-y-2">
                            <div className="sticky top-0 z-[1] bg-gradient-to-b from-white to-transparent pb-1 pt-0.5">
                              <h3 className="text-sm font-semibold text-coop-800 font-display border-b border-coop-200 pb-2">
                                {label}
                              </h3>
                              {trocasNoMes.length > 0 && (
                                <p className="text-[11px] text-coop-600 font-serif mt-1.5">
                                  {trocasNoMes.length === 1
                                    ? '1 troca de plantão neste mês.'
                                    : `${trocasNoMes.length} trocas de plantão neste mês.`}
                                </p>
                              )}
                            </div>
                            <ul className="space-y-3">
                              {itens.map((item) => (
                                <li
                                  key={item.id}
                                  className="flex items-start gap-3 rounded-xl border border-coop-200/70 bg-coop-50/40 px-3 py-2.5"
                                >
                                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-coop-200 text-coop-800 text-[10px] font-display leading-tight text-center px-0.5">
                                    {item.tipo === 'alocacao' ? 'AL' : item.tipo === 'plantao' ? 'PL' : 'TR'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] text-coop-600 font-serif">
                                      {item.data.toLocaleString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </p>
                                    <p className="text-sm font-medium text-coop-900 font-display leading-tight">
                                      {item.titulo}
                                    </p>
                                    <p className="text-xs text-coop-700 font-serif mt-0.5">{item.descricao}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </section>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {equipePanelTab === 'relatorio' && (() => {
                const equipeEscalasList = (equipeEscalasResp?.data ?? []) as Escala[];
                if (equipeEscalasResp === undefined) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-coop-700">
                      <p className="text-sm">Carregando escalas…</p>
                    </div>
                  );
                }
                if (equipeEscalasList.length === 0) {
                  return (
                    <div className="text-center py-8 text-coop-700">
                      <p className="font-medium mb-1">Relatório de horas</p>
                      <p className="text-sm">Nenhuma escala vinculada a esta equipe.</p>
                    </div>
                  );
                }
                if (loadingRegistrosEquipeRelatorio) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-coop-700">
                      <p className="text-sm">Carregando registros de ponto…</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-5 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wider text-coop-600 font-display mb-3">
                      Relatório de horas
                    </p>
                    {escalasHorasPontoRelatorio.length === 0 ? (
                      <p className="text-sm text-coop-600 rounded-xl border border-coop-200/80 bg-coop-50/40 px-3 py-2.5">
                        Nenhuma escala encontrada para esta equipe.
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {escalasHorasPontoRelatorio.map(({ escala, linhas, encerrada }) => (
                          <li
                            key={escala.id}
                            className="rounded-xl border border-coop-200/80 bg-white shadow-sm overflow-hidden"
                          >
                            <div className="px-3 py-2.5 bg-coop-50/80 border-b border-coop-200/60 flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                {escala.contratoAtivo?.nome && (
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-coop-500 mb-1">
                                    {fixMojibake(escala.contratoAtivo.nome)}
                                  </p>
                                )}
                                <p className="font-semibold text-coop-900 text-sm font-display">
                                  <span className="text-coop-600 font-medium">Escala</span>
                                  <span className="text-coop-400 mx-1.5" aria-hidden>
                                    ·
                                  </span>
                                  {fixMojibake(escala.nome)}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                                  encerrada
                                    ? 'bg-slate-200/80 text-slate-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {encerrada ? 'Encerrada' : 'Em andamento'}
                              </span>
                            </div>
                            {linhas.length === 0 ? (
                              <p className="text-xs text-coop-600 px-3 py-3 font-serif">
                                Nenhum registro de ponto com duração nesta escala no período (verifique se o
                                profissional pertence a esta equipe e se o ponto foi registrado nesta escala).
                              </p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-coop-600 border-b border-coop-100">
                                    <th className="py-2 px-3 font-semibold">Profissional</th>
                                    <th className="py-2 px-3 font-semibold text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {linhas.map((row) => (
                                    <tr key={row.medicoId} className="border-b border-coop-50 last:border-0">
                                      <td className="py-2 px-3 text-coop-900">{row.nome}</td>
                                      <td className="py-2 px-3 text-right font-semibold text-coop-700 tabular-nums">
                                        {formatDuracaoMinutos(row.minutos)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {selectedCalendarDay && (() => {
        const { year, month, day } = selectedCalendarDay;
        const selDate = new Date(year, month, day);
        const weekStart = new Date(selDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekDates: Date[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + i);
          weekDates.push(d);
        }
        const dayNamesShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const isSelectedDay = (d: Date) => d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const isPastDay = (d: Date) => {
          const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          return dStart.getTime() < todayStart.getTime();
        };
        const goPrevWeek = () => {
          const d = new Date(year, month, day);
          d.setDate(d.getDate() - 7);
          setSelectedCalendarDay({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() });
        };
        const goNextWeek = () => {
          const d = new Date(year, month, day);
          d.setDate(d.getDate() + 7);
          setSelectedCalendarDay({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() });
        };
        return (
          <>
            <div
              className="fixed inset-0 bg-black/30 z-[60]"
              onClick={() => setSelectedCalendarDay(null)}
              aria-hidden="true"
            />
            <div className="flex flex-col fixed right-0 top-0 h-screen bg-white shadow-lg z-[70] transition-transform w-full sm:w-[650px] rounded-tl-lg rounded-tr-lg">
              <div className="p-5 flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center border-b py-4 border-gray-200 flex-shrink-0">
                  <h2 className="text-xl font-semibold text-gray-800">Plantões do dia</h2>
                  <button
                    type="button"
                    onClick={() => setSelectedCalendarDay(null)}
                    className="p-1 rounded text-gray-500 hover:text-gray-700 hover:scale-110 transition-transform"
                    aria-label="Fechar"
                  >
                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 352 512" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z" /></svg>
                  </button>
                </div>
                <div className="flex items-center gap-3 p-3 my-2 flex-shrink-0 font-display">
                  <button type="button" onClick={goPrevWeek} className="p-2 rounded-xl text-coop-600 hover:bg-coop-100 transition-colors" aria-label="Semana anterior">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6l6 6" /></svg>
                  </button>
                  <div className="flex flex-1 justify-center gap-2">
                    {weekDates.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedCalendarDay({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() })}
                        className={`flex flex-col items-center justify-center min-w-[12%] py-2 rounded-xl transition-all duration-200 ${
                          isPastDay(d)
                            ? 'bg-gray-300 text-gray-600 cursor-default'
                            : isSelectedDay(d)
                              ? 'bg-coop-600 text-white border-2 border-white shadow-[0_0_0_2px] shadow-coop-500'
                              : 'bg-coop-500 text-white/95 hover:bg-coop-600 hover:text-white'
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">{dayNamesShort[d.getDay()]}</span>
                        <span className="text-base font-bold tabular-nums mt-0.5">{d.getDate()}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={goNextWeek} className="p-2 rounded-xl text-coop-600 hover:bg-coop-100 transition-colors" aria-label="Próxima semana">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6l-6 6" /></svg>
                  </button>
                </div>
                <hr className="border-gray-200 flex-shrink-0" />
                <div className="w-full flex justify-center flex-shrink-0 py-2">
                  <div className="relative w-64 h-10 bg-gray-100 rounded-lg flex items-center">
                    <div
                      className={`absolute top-0 bottom-0 w-1/2 rounded-lg transition-transform duration-300 ${plantaoViewMode === 'dinamica' ? 'translate-x-0' : 'translate-x-full'}`}
                      style={{ background: 'rgb(37, 111, 255)' }}
                    />
                    <button type="button" onClick={() => setPlantaoViewMode('dinamica')} className={`w-1/2 z-10 text-center text-sm font-medium transition-colors duration-300 py-2 rounded-l-lg ${plantaoViewMode === 'dinamica' ? 'text-white' : 'text-gray-700'}`}>Dinâmica</button>
                    <button type="button" onClick={() => setPlantaoViewMode('fixa')} className={`w-1/2 z-10 text-center text-sm font-medium transition-colors duration-300 py-2 rounded-r-lg ${plantaoViewMode === 'fixa' ? 'text-white' : 'text-gray-700'}`}>Fixa</button>
                  </div>
                </div>
                <hr className="border-gray-200 flex-shrink-0" />
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <div className="flex-1 overflow-auto">
                    {(() => {
                      const plantoesDia = equipePlantoesDiaResp?.data ?? [];
                      const horarioLabel = (g: GradeColDef) => {
                        const a = g.regua[0];
                        const b = g.regua[1];
                        if (a === '—' || b === '—') return 'ver tipos no contrato';
                        return `${a.replace(':', 'h')} às ${b.replace(':', 'h')}`;
                      };
                      return gradesParaPlantoesDoDia.map((grade) => {
                        const alocados = plantoesDia.filter((p) => p.gradeId === grade.id && p.medico);
                        const adicionalPercentualDia = adicionalPercentualDoDiaPorGrade.get(grade.id) ?? 0;
                        return (
                          <div key={grade.id} className="rounded-xl overflow-hidden my-2">
                            <div className="p-4 text-white uppercase font-bold text-lg bg-coop-500 font-display flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <p className="truncate">
                                    {grade.label} - {horarioLabel(grade)}
                                  </p>
                                  {adicionalPercentualDia > 0 && (
                                    <span
                                      className="relative inline-flex items-center justify-center w-6 h-6 rounded-full overflow-hidden"
                                      title={`Adicional ativo: +${adicionalPercentualDia}%`}
                                    >
                                      <span className="absolute inset-0 bg-gradient-to-br from-[#2F80FF] via-[#256FFF] to-[#00B2FF]" />
                                      <span className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-white/25 blur-[2px]" />
                                      <span className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-black/10 blur-[3px]" />
                                      <span className="absolute inset-0 ring-1 ring-white/25" />
                                      <span className="relative text-white text-[10px] leading-none font-extrabold tabular-nums">
                                        {Math.round(adicionalPercentualDia)}%
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isMaster && !!contratoAtivoIdContext && plantoesDiaDateStr && (
                                <button
                                  type="button"
                                  className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition text-[12px] font-semibold normal-case"
                                  onClick={() => {
                                    if (adicionalDiaOpenGradeId === grade.id) return fecharAdicionalDoDia();
                                    return abrirAdicionalDoDia(grade.id, adicionalPercentualDia);
                                  }}
                                >
                                  {adicionalPercentualDia > 0 ? 'Editar adicional' : 'Adicional'}
                                </button>
                              )}
                            </div>
                            <div className="w-full flex flex-wrap gap-2 border border-coop-200 rounded-b-xl p-2 bg-white">
                              {isMaster &&
                                !!contratoAtivoIdContext &&
                                plantoesDiaDateStr &&
                                adicionalDiaOpenGradeId === grade.id && (
                                  <div className="w-full mb-2 rounded-xl border border-coop-200 bg-coop-50/40 p-3">
                                    <p className="text-[11px] text-coop-700 font-serif mb-2">
                                      Percentual para {plantoesDiaDateStr} ({grade.label}). Aplica sobre o valor base do turno.
                                    </p>
                                    <div className="flex flex-wrap items-end gap-2">
                                      <div className="min-w-[160px]">
                                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-coop-600 font-display mb-1">
                                          Percentual (%)
                                        </label>
          <input
                                          type="text"
                                          inputMode="decimal"
                                          className="input w-full"
                                          placeholder="Ex.: 50"
                                          value={adicionalPercentualInput}
                                          onChange={(e) => setAdicionalPercentualInput(e.target.value)}
                                          disabled={loadingAction}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        className="btn btn-primary text-sm"
                                        onClick={() => salvarAdicionalDoDiaPanel(grade.id)}
                                        disabled={loadingAction}
                                      >
                                        Salvar
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary text-sm"
                                        onClick={() => removerAdicionalDoDiaPanel(grade.id)}
                                        disabled={loadingAction || adicionalPercentualDia <= 0}
                                      >
                                        Remover
                                      </button>
                                    </div>
                                  </div>
                                )}
                              {alocados.length === 0 ? (
                                <p className="text-sm text-coop-600 py-2 font-serif">Nenhum profissional alocado</p>
                              ) : (
                                alocados.map((p) => (
                                  <div key={p.id} className="relative cursor-pointer flex flex-col items-center" title={p.medico.nomeCompleto}>
                                    <img
                                      alt={p.medico.nomeCompleto}
                                      className="w-14 h-14 rounded-full bg-coop-100 object-cover border-2 border-coop-200"
                                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.medico.nomeCompleto)}&background=F1F2F6&color=1C1F24&bold=true&size=256`}
                                    />
                                    <span className="text-xs font-medium text-coop-800 mt-1 text-center line-clamp-2 max-w-[5rem]">{shortName(p.medico.nomeCompleto)}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}
      </>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Hero */}
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-coop-600 mb-2 font-display">
          Área Master
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-coop-900 font-display leading-tight mb-2">
          Escalas
        </h1>
        <p className="text-coop-700 font-serif text-base">
          Cadastre escalas, associe contratos ativos e aloque médicos na grade semanal.
        </p>
      </div>

      <div className="card border-l-4 border-l-coop-500 stagger-2 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-coop-50/60 to-transparent">
        <p className="text-coop-900 font-medium text-sm font-display">
          Subgrupos e equipes definem a estrutura dos plantões e valores.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2"
            onClick={() => {
              if (panelGradeHistoryDepthRef.current > 0) {
                window.history.back();
              } else {
                setViewEscalas('grupos');
              }
            }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            Lista de grupos
            </button>
          <Link to="/subgrupos-equipes" className="btn btn-secondary inline-flex items-center gap-2">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
            Gerenciar Subgrupos e Equipes
          </Link>
          </div>
      </div>

      <main className="min-h-[calc(100vh-12rem)] flex flex-col p-5 bg-coop-100/30 flex-1 overflow-hidden">
        <div className="flex-1 bg-white rounded-xl overflow-hidden flex flex-col shadow-sm border border-coop-200/60">
          {!selectedEscalaId ? (
            <>
              <div className="flex items-center justify-between gap-4 p-4 border-b border-coop-200/80 flex-wrap">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-coop-600 font-display">Escalas</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    className="input max-w-xs"
                    value={selectedEscalaId}
                    onChange={(e) => setSelectedEscalaId(e.target.value)}
                  >
                    <option value="">Selecione uma escala</option>
                    {escalas.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-primary" onClick={() => { setForm({ ...emptyForm, ...getDefaultScaleDates() }); setEditingEscalaId(null); setError(null); setEscalaFormModalOpen(true); }}>
                    Nova escala
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
        {loadingEscalas ? (
                  <p className="text-sm text-coop-700 font-serif">Carregando escalas...</p>
        ) : escalas.length === 0 ? (
                  <p className="text-sm text-coop-700 font-serif">Nenhuma escala cadastrada. Clique em &quot;Nova escala&quot; para criar.</p>
        ) : (
          <div className="space-y-2">
            {escalas.map((escala) => (
              <div
                key={escala.id}
                        className="border rounded-xl p-3 transition border-coop-200/80 bg-coop-50/30 hover:bg-coop-50/50 flex flex-wrap items-center justify-between gap-2"
              >
                  <button
                          type="button"
                          className="text-left min-w-0 flex-1"
                          onClick={() => setSelectedEscalaId(escala.id)}
                        >
                          <p className="font-semibold text-coop-900 text-sm font-display">{escala.nome}</p>
                          <p className="text-[10px] text-coop-600 mt-0.5 font-serif">
                            {escala.contratoAtivo?.nome || '-'} · {toDateInput(escala.dataInicio)} até {toDateInput(escala.dataFim)} · Alocados: {escala._count?.alocacoes ?? 0}
                    </p>
                  </button>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" className="btn-sm btn-secondary" onClick={() => { startEdit(escala); setEscalaFormModalOpen(true); }}>Editar</button>
                          <button type="button" className="btn-sm btn-secondary" onClick={() => deleteEscala(escala)}>Excluir</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center p-4 justify-between shrink-0 bg-coop-600 text-white" style={{ background: 'rgb(37, 111, 255)' }}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-white/20"
                    onClick={() => {
                      if (panelGradeHistoryDepthRef.current > 0) {
                        window.history.back();
                      } else {
                        setSelectedEscalaId('');
                      }
                    }}
                    aria-label="Voltar"
                  >
                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M257.5 445.1l-22.2 22.2c-9.4 9.4-24.6 9.4-33.9 0L7 273c-9.4-9.4-9.4-24.6 0-33.9L201.4 44.7c9.4-9.4 24.6-9.4 33.9 0l22.2 22.2c9.5 9.5 9.3 25-.4 34.3L136.6 216H424c13.3 0 24 10.7 24 24v32c0 13.3-10.7 24-24 24H136.6l120.5 114.8c9.8 9.3 10 24.8.4 34.3z" /></svg>
                    </button>
                  <div>
                    <p className="font-semibold text-white font-display">{selectedEscala?.nome ?? 'Escala'}</p>
                    <p className="text-white/90 text-sm">{selectedEscala?.contratoAtivo?.nome ?? '-'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white font-display">
                    {gradeMonthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <button type="button" className="text-white/90 hover:underline text-sm" onClick={() => setGradeMonthStart((d) => { const x = new Date(d); x.setMonth(x.getMonth() - 1); return x; })}>← Anterior</button>
                    <button type="button" className="text-white/90 hover:underline text-sm" onClick={() => setGradeMonthStart((d) => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x; })}>Próximo →</button>
              </div>
          </div>
              </div>
              <div
                className={`overflow-hidden p-3 flex-1 flex min-h-0 transition-colors ${
                  gradeSomenteLeitura ? 'bg-gradient-to-b from-coop-100/35 via-white to-coop-50/20' : ''
                }`}
              >
                <div className="relative flex-1 flex flex-col overflow-y-auto overflow-x-auto min-w-0">
                  <table
                    className={`w-full border-separate border-spacing-0 text-sm transition-[filter] duration-200 ${
                      gradeSomenteLeitura ? 'blur-[1.25px] contrast-[0.98]' : ''
                    }`}
                  >
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr>
                        <th className="text-center border border-coop-200 p-1.5 font-semibold text-coop-800 font-display w-0 whitespace-nowrap">Nome</th>
                        <th className="text-center border border-coop-200 p-1.5 font-semibold text-coop-800 font-display w-0 whitespace-nowrap">Turno</th>
                        {Array.from({ length: gradeMonthEnd.getDate() }, (_, i) => i + 1).map((day) => {
                          const d = new Date(gradeMonthStart.getFullYear(), gradeMonthStart.getMonth(), day);
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const dayLetters = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
                          return (
                            <th key={day} className={`text-center border p-1 min-w-[32px] ${isWeekend ? 'bg-coop-200/60 border-coop-300' : 'border-coop-200'}`}>
                              <div className="flex flex-col">
                                <span>{dayLetters[d.getDay()]}</span>
                                <span className="w-full h-px bg-coop-200" />
                                <span>{day}</span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const busca = gradeBuscaProfissional.trim().toLowerCase();
                        const equipeMedicosList = equipeIdParaGrade && Array.isArray(equipeMedicosResp?.data)
                          ? (equipeMedicosResp!.data as { medicoId: string; medico?: { nomeCompleto: string; crm?: string | null } }[]).map((em) => ({
                              label: em.medico?.nomeCompleto ?? '—',
                              medicoId: em.medicoId,
                              crm: em.medico?.crm ?? '',
                            }))
                          : null;
                        const baseList =
                          equipeMedicosList !== null
                            ? equipeMedicosList
                            : alocacoes.map((a) => ({
                                label: a.medico.nomeCompleto,
                                medicoId: a.medico.id,
                                crm: a.medico.crm ?? '',
                              }));
                        const filtrados = busca
                          ? baseList.filter(
                              (r) =>
                                r.label.toLowerCase().includes(busca) || (r.crm && r.crm.toLowerCase().includes(busca))
                            )
                          : baseList;
                        return [
                          { label: 'Plantão Vago', medicoId: '' },
                          ...filtrados.map((r) => ({ label: r.label, medicoId: r.medicoId })),
                        ];
                      })().map((row, rowGroupIndex) =>
                        gradesForGrid.map((grade, gradeSubIndex) => {
                          const gradeId = grade.id;
                          return (
                            <tr key={`${rowGroupIndex}-${gradeSubIndex}`} className={gradeSubIndex === gradesForGrid.length - 1 ? 'tr-last' : ''}>
                              {gradeSubIndex === 0 ? (
                                <td
                                  className={`border border-coop-200 p-1.5 align-top ${row.medicoId === '' ? 'bg-coop-50/40' : 'bg-white'}`}
                                  rowSpan={gradesForGrid.length}
                                >
                                  <p className="font-medium text-coop-900 text-xs">{row.label}</p>
                                  <div className="text-[10px] text-coop-600">0h</div>
                                </td>
                              ) : null}
                              <td className="text-center border border-coop-200 p-1 text-coop-700 text-xs whitespace-nowrap">
                                <span className="font-medium">{grade.label}</span> - {grade.regua[0]} até {grade.regua[1]}
                              </td>
                              {Array.from({ length: gradeMonthEnd.getDate() }, (_, i) => i + 1).map((day) => {
                                const d = new Date(gradeMonthStart.getFullYear(), gradeMonthStart.getMonth(), day);
                                const dateStr = dateToInput(d);
                                const key = `${dateStr}_${gradeId}`;
                                const slotsNoDia = plantaoMapMonth.get(key) ?? [];
                                const cell = row.medicoId
                                  ? slotsNoDia.find((s) => s?.medico?.id === row.medicoId)
                                  : undefined;
                                const showInCell = !!cell;
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                const vagas = row.medicoId === '' ? (plantaoVagoSlots[key] ?? 0) : 0;
                                return (
                                  <td
                                    key={day}
                                    title={gradeSomenteLeitura ? 'Somente leitura — use Editar escala abaixo' : undefined}
                                    className={`border p-0 min-w-[32px] ${gradeSomenteLeitura ? 'cursor-default' : 'cursor-pointer'} ${isWeekend ? 'bg-coop-200/40 border-coop-300' : 'border-coop-200'}`}
                                    onClick={async () => {
                                      if (gradeSomenteLeitura) return;
                                      // Plantão Vago: abre modal para definir vagas
                                      if (row.medicoId === '') {
                                        const currentVagas = plantaoVagoSlots[key] ?? 0;
                                        if (currentVagas > 0) {
                                          setConfirmClearVagas({
                                            open: true,
                                            key,
                                            label: `${formatDayShort(d)} · ${grade.label}`,
                                          });
                                        } else {
                                          const firstSlot = slotsNoDia[0];
                                          setCellModal({
                                            open: true,
                                            grade,
                                            date: d,
                                            medico: firstSlot?.medico ?? null,
                                            plantaoId: firstSlot?.plantaoId,
                                            isPlantaoVagoRow: true,
                                          });
                                        }
                                        return;
                                      }

                                      if (!selectedEscalaId || !row.medicoId) return;

                                      // Toggle tipo "select": se já está alocado para este médico, remove; senão, aloca.
                                      const isSameMedico = !!cell?.medico?.id && cell.medico.id === row.medicoId;

                                      const opKey = key;
                                      setPendingPlantaoKey(opKey);
                                      setLoadingAction(true);
                                      setError(null);
                                      try {
                                        if (isSameMedico && cell?.plantaoId) {
                                          // Desalocar plantão desta célula
                                          await adminService.removerEscalaPlantao(selectedEscalaId, cell.plantaoId);
                                        } else {
                                          // Alocar este médico neste dia/turno
                                          await adminService.createEscalaPlantao(selectedEscalaId, {
                                            data: dateStr,
                                            gradeId,
                                            medicoId: row.medicoId,
                                            valorHora: (() => {
                                              const baseValor = valorByGrade.get(gradeId) ?? null;
                                              const percentual = adicionalPercentualByDataGrade.get(`${dateStr}_${gradeId}`) ?? null;
                                              return getValorFinalComAdicional(baseValor, percentual);
                                            })(),
                                          });
                                        }
                                        invalidatePlantoes();
                                      } catch (err: any) {
                                        setError(err.response?.data?.error || 'Erro ao alterar plantão');
                                      } finally {
                                        setLoadingAction(false);
                                        setPendingPlantaoKey((prev) => (prev === opKey ? null : prev));
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-center min-h-[40px] text-[11px] text-coop-800">
                                      {row.medicoId === '' ? (
                                        vagas > 0 ? (
                                          <div
                                            className="w-[26px] h-[26px] rounded-full overflow-hidden border-2 border-coop-600 bg-[#F1F2F6] text-coop-900 shadow-sm flex items-center justify-center text-[11px] font-semibold"
                                            title={`${vagas} vaga${vagas > 1 ? 's' : ''} em aberto`}
                                          >
                                            {vagas}
                                          </div>
                                        ) : (
                                          ''
                                        )
                                      ) : pendingPlantaoKey === key && !cell ? (
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-coop-500/70">
                                          <span className="h-3 w-3 border-2 border-coop-500 border-t-transparent rounded-full animate-spin" />
                                        </span>
                                      ) : showInCell && cell?.medico ? (
                                        <div
                                          className="w-[30px] laptop:w-[24px] aspect-square rounded-full overflow-hidden border-2 border-coop-600 shadow-sm"
                                          title={cell.medico.nomeCompleto}
                                        >
                                          <img
                                            className="w-full h-full object-cover"
                                            alt={cell.medico.nomeCompleto}
                                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                              cell.medico.nomeCompleto
                                            )}&background=F1F2F6&color=256F3F&bold=true&size=256`}
                                          />
                                        </div>
                                      ) : (
                                        ''
        )}
      </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  {gradeSomenteLeitura && (
                    <div
                      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="flex items-center gap-2.5 rounded-2xl border border-coop-300/70 bg-white/95 px-4 py-2.5 shadow-lg ring-1 ring-black/[0.04] backdrop-blur-sm">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coop-600/10 text-coop-800"
                          aria-hidden
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </span>
                        <span className="font-semibold font-display text-sm text-coop-900">Escala publicada</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between gap-2 border-t border-coop-200 p-3 items-center flex-wrap shrink-0">
                <div className="flex-1 min-w-[200px] max-w-md">
                  <input
                    type="text"
                    className="input w-full py-2"
                    placeholder="Quem gostaria de encontrar?"
                    value={gradeBuscaProfissional}
                    onChange={(e) => setGradeBuscaProfissional(e.target.value)}
                    disabled={gradeSomenteLeitura}
                    title={gradeSomenteLeitura ? 'Disponível ao editar a escala publicada' : undefined}
                  />
                </div>
                <div className="flex flex-col items-end gap-1 min-w-0">
                  <p className={`text-sm whitespace-nowrap font-medium ${!selectedEscala ? 'text-gray-500' : selectedEscala.ativo ? 'text-coop-600' : 'text-amber-600'}`}>
                    {!selectedEscala
                      ? 'Sem escala'
                      : selectedEscala.ativo
                        ? gradeEdicaoLiberada
                          ? 'Publicada · em edição'
                          : 'Publicada'
                        : 'Em rascunho'}
                  </p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    disabled={!selectedEscalaId || !selectedEscala}
                    onClick={() => imprimirRelatorioEscalaPdf()}
                  >
                    Imprimir
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    disabled={!selectedEscalaId || loadingAction || replicarMesSubmitting}
                    onClick={abrirModalReplicarMes}
                  >
                    Replicar
                  </button>
                  {selectedEscala?.ativo && !gradeEdicaoLiberada && (
                    <button
                      type="button"
                      className="btn btn-secondary text-sm"
                      onClick={() => {
                        setCellModal((m) => ({ ...m, open: false }));
                        setGradeEdicaoLiberada(true);
                      }}
                    >
                      Editar escala
                    </button>
                  )}
                  {selectedEscala?.ativo && gradeEdicaoLiberada && (
                    <button
                      type="button"
                      className="btn btn-secondary text-sm"
                      onClick={() => {
                        setCellModal((m) => ({ ...m, open: false }));
                        setGradeEdicaoLiberada(false);
                      }}
                    >
                      Cancelar edição
                    </button>
                  )}
                  {selectedEscala && (!selectedEscala.ativo || gradeEdicaoLiberada) && (
                    <button
                      type="button"
                      className="btn btn-primary text-sm"
                      disabled={loadingAction}
                      onClick={async () => {
                        if (!selectedEscala?.id) return;
                        setLoadingAction(true);
                        try {
                          await adminService.updateEscala(selectedEscala.id, { ativo: true });
                          await invalidateEscalas();
                          await queryClient.invalidateQueries({ queryKey: ['admin', 'equipes'] });
                          setGradeEdicaoLiberada(false);
                          notify({
                            kind: 'success',
                            title: 'Escala publicada',
                            message: 'A escala foi publicada com sucesso.',
                            source: 'escala',
                          });
                        } finally {
                          setLoadingAction(false);
                        }
                      }}
                    >
                      Publicar
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {escalaFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => resetForm()}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-coop-600 mb-4 font-display">{editingEscalaId ? 'Editar escala' : 'Nova escala'}</h3>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submitEscala}>
              <select className="input" value={form.contratoAtivoId} onChange={(e) => setForm((prev) => ({ ...prev, contratoAtivoId: e.target.value }))}>
                <option value="">Selecione um contrato ativo</option>
                {contratos.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
              </select>
              <input className="input" placeholder="Nome da escala" value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
              <textarea className="input md:col-span-2 min-h-[90px]" placeholder="Descrição (opcional)" value={form.descricao} onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))} />
              <label className="flex items-center gap-2 text-xs font-medium text-coop-900 font-display">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))} />
                Escala ativa
              </label>
              {error && <p className="md:col-span-2 text-sm text-red-600 font-medium">{error}</p>}
              <div className="md:col-span-2 flex gap-2">
                <button className="btn btn-primary" type="submit" disabled={loadingAction}>{editingEscalaId ? 'Salvar alterações' : 'Criar escala'}</button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {replicarMesModalOpen && selectedEscala && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => {
            if (replicarMesSubmitting) return;
            setReplicarMesModalOpen(false);
            setError(null);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-coop-600 mb-2 font-display">
              Replicar plantões para outro mês
            </h3>
            <p className="text-sm text-coop-800 mb-4">
              Os plantões do mês visível na grade ({formatMesAnoFromYM(mesOrigemGradeYM)}) serão copiados para o mesmo dia do mês de destino (ajustado ao último dia do mês, se necessário).
            </p>
            <label className="block text-xs font-medium text-coop-900 mb-1.5">Mês de destino</label>
            <input
              type="month"
              className="input w-full max-w-xs"
              value={replicarMesDestino}
              min={toDateInput(selectedEscala.dataInicio).slice(0, 7)}
              max={toDateInput(selectedEscala.dataFim).slice(0, 7)}
              onChange={(e) => setReplicarMesDestino(e.target.value)}
              disabled={replicarMesSubmitting}
            />
            {replicarMesDestino === mesOrigemGradeYM && replicarMesDestino && (
              <p className="text-xs text-amber-700 mt-2">Escolha um mês diferente do que está aberto na grade.</p>
            )}
            {error && <p className="text-sm text-red-600 font-medium mt-3">{error}</p>}
            <div className="flex gap-2 mt-6 flex-wrap">
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  replicarMesSubmitting || !replicarMesDestino || replicarMesDestino === mesOrigemGradeYM
                }
                onClick={confirmarReplicarMes}
              >
                {replicarMesSubmitting ? 'Replicando…' : 'Confirmar'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={replicarMesSubmitting}
                onClick={() => {
                  setReplicarMesModalOpen(false);
                  setError(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEscalaId && (
        <div className="card stagger-5 hidden">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-coop-600 mb-4 font-display">Alocação de médicos na escala</h3>
          <div className="flex gap-2 mb-4 flex-wrap items-start">
            <div ref={medicoAllocateRef} className="relative flex-1 min-w-[240px] max-w-md">
              <input
                type="text"
                className="input w-full"
                placeholder="Digite para pesquisar ou selecione um médico"
                value={
                  medicoAllocateOpen
                    ? medicoAllocateSearch
                    : medicoIdToAllocate
                      ? (() => {
                          const m = medicos.find((x) => x.id === medicoIdToAllocate);
                          if (m) return `${m.nomeCompleto} (${m.crm})`;
                          const lb = medicoPickLabels[medicoIdToAllocate];
                          return lb ? `${lb.nomeCompleto} (${lb.crm})` : '';
                        })()
                      : medicoAllocateSearch
                }
                onChange={(e) => {
                  setMedicoAllocateSearch(e.target.value);
                  setMedicoAllocateOpen(true);
                  if (!e.target.value) setMedicoIdToAllocate('');
                }}
                onFocus={() => setMedicoAllocateOpen(true)}
              />
              {medicoAllocateOpen && (
                <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-coop-200 bg-white shadow-lg py-1">
                  {(() => {
                    const allocatedIds = new Set(alocacoes.map((a) => a.medicoId));
                    const filtered = medicos.filter((m) => !allocatedIds.has(m.id));
                    if (loadingMedicosSuggest && filtered.length === 0) {
                      return (
                        <li className="px-3 py-2 text-sm text-coop-600 font-serif">Buscando médicos...</li>
                      );
                    }
                    return filtered.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-coop-600 font-serif">Nenhum médico encontrado</li>
                    ) : (
                      filtered.map((m) => (
                        <li
                          key={m.id}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-coop-100 text-coop-900"
                          onClick={() => {
                            rememberMedicoLabel(m);
                            setMedicoIdToAllocate(m.id);
                            setMedicoAllocateSearch('');
                            setMedicoAllocateOpen(false);
                          }}
                        >
                          {m.nomeCompleto} ({m.crm})
                        </li>
                      ))
                    );
                  })()}
                </ul>
              )}
            </div>
            <button className="btn btn-primary" onClick={alocarMedico} disabled={loadingAction}>
              Alocar
            </button>
          </div>

          {alocacoes.length === 0 ? (
            <p className="text-sm text-coop-700 font-serif">Nenhum médico alocado.</p>
          ) : (
            <div className="space-y-2">
              {alocacoes.map((a) => (
                <div key={a.id} className="border border-coop-200 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-coop-900">{a.medico.nomeCompleto}</p>
                    <p className="text-[10px] text-coop-600 font-serif">
                      {a.medico.crm} | {a.medico.email || '-'}
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => removerAlocacao(a.medicoId)}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cellModal.open && cellModal.grade && cellModal.date && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setCellModal((m) => ({ ...m, open: false }))}
        >
          <div
            className="bg-white rounded-3xl shadow-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {cellModal.isPlantaoVagoRow ? (
              /* Modal Plantão Vago: divulgar quantidade de vagas */
              <div className="relative flex flex-col items-center p-6">
                <h2 className="text-lg font-bold text-coop-900 font-display">Plantão Vago</h2>
              <button
                type="button"
                  className="absolute top-4 right-4 p-1 rounded-lg hover:bg-coop-100 text-coop-600"
                  onClick={() => setCellModal((m) => ({ ...m, open: false }))}
                  aria-label="Fechar"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-coop-500 text-white mt-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" strokeWidth="0"><path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" /></svg>
                        </span>
                <p className="text-xs text-coop-600 mt-2">{cellModal.grade?.label} – {cellModal.date && formatDayShort(cellModal.date)}</p>
                <div className="w-full mt-4">
                  <label className="block text-sm font-medium text-coop-800 mb-1">Quantidade de vagas</label>
                  <select
                    className="input w-full cursor-pointer"
                    value={plantaoVagoVagas}
                    onChange={(e) => setPlantaoVagoVagas(Number(e.target.value))}
                  >
                    {Array.from({ length: 21 }, (_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-primary w-full mt-4"
                          onClick={() => {
                    if (!cellModal.grade || !cellModal.date) {
                      setCellModal((m) => ({ ...m, open: false }));
                      return;
                    }
                    const key = `${dateToInput(cellModal.date)}_${cellModal.grade.id}`;
                    setPlantaoVagoSlots((prev) => ({
                      ...prev,
                      [key]: plantaoVagoVagas,
                    }));
                    setCellModal((m) => ({ ...m, open: false }));
                  }}
                >
                  Confirmar
                </button>
                            </div>
                          ) : (
              <>
            {/* Header: turno com destaque */}
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-coop-200/80 bg-gradient-to-br from-coop-50/80 to-white">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coop-500 text-white shadow-sm">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-coop-900 font-display tracking-tight">
                    {cellModal.grade.label} · {cellModal.grade.tipo}
                  </h2>
                  <p className="text-[11px] text-coop-600 font-medium mt-0.5">
                    {cellModal.grade.regua?.join(' – ')}
                  </p>
                        </div>
                  </div>
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-coop-200/80 text-coop-600 transition-colors shrink-0"
                onClick={() => setCellModal((m) => ({ ...m, open: false }))}
                aria-label="Fechar"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Data e valor: chip destacado */}
            <div className="px-5 py-4 border-b border-coop-100">
              <div className="flex items-center gap-2 text-coop-700">
                <svg className="h-4 w-4 text-coop-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                <span className="font-medium font-display text-sm">
                  {formatDayShort(cellModal.date)} · {formatDayName(cellModal.date)}
              </span>
                <span className="text-coop-400">·</span>
                <span className="text-sm font-serif text-coop-700">{cellModal.grade.horario}</span>
              </div>
              {(valorBaseModal != null || adicionalPercentualModal != null || valorFinalModal != null || plantaoSlotValor != null || alocacaoParaValor?.valorHora != null) && (
                <div className="mt-2 text-xs text-coop-700 font-display space-y-1">
                  {valorBaseModal != null && (
                    <p className="font-semibold">
                      Valor base: {formatValorHora(valorBaseModal)}
                    </p>
                  )}
                  {valorBaseModal != null && adicionalPercentualModal != null && adicionalPercentualModal !== 0 && (
                    <p className="font-semibold text-coop-800">
                      Adicional ({formatDayShort(cellModal.date)}): +{adicionalPercentualModal}%
                    </p>
                  )}
                  {plantaoSlotValor != null ? (
                    <p className="font-semibold">
                      Valor gravado: {formatValorHora(plantaoSlotValor)}
                    </p>
                  ) : valorFinalModal != null ? (
                    <p className="font-bold text-coop-900">
                      Valor final: {formatValorHora(valorFinalModal)}
                    </p>
                  ) : alocacaoParaValor?.valorHora != null ? (
                    <p className="font-semibold">
                      Valor (alocação): {formatValorHora(alocacaoParaValor.valorHora)}
                    </p>
                  ) : null}
              </div>
              )}
            </div>

            {/* Conteúdo rolável */}
            <div className="px-5 py-5 overflow-y-auto flex-1">
              {cellModal.medico ? (
                <div className="rounded-2xl border border-coop-200 bg-gradient-to-br from-white to-coop-50/30 p-4 mb-5">
                  <p className="font-semibold text-coop-900 font-display">{cellModal.medico.nomeCompleto}</p>
                  <p className="text-xs text-coop-600 mt-0.5">CRM: {cellModal.medico.crm}</p>
                  {(cellModal.medico.telefone || cellModal.medico.email) && (
                    <p className="text-xs text-coop-600 mt-0.5">{cellModal.medico.telefone || cellModal.medico.email}</p>
                  )}
                  <p className="text-[10px] text-coop-500 mt-2 font-serif">{cellModal.grade.horario}</p>
                  {(plantaoSlotValor != null || valorFinalModal != null || valorBaseModal != null || alocacaoParaValor?.valorHora != null) && (
                    <p className="text-xs font-medium text-coop-700 mt-1">
                      Valor: {formatValorHora(plantaoSlotValor ?? valorFinalModal ?? valorBaseModal ?? alocacaoParaValor?.valorHora)}
                    </p>
                  )}
                  {cellModal.plantaoId && (
                    <button
                      type="button"
                      className="btn btn-secondary mt-3 text-sm"
                      onClick={removerPlantaoDaCelula}
                      disabled={loadingAction}
                    >
                      Remover deste plantão
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-coop-700 font-serif mb-5 rounded-xl bg-coop-50/50 border border-coop-200/60 px-3 py-2.5">
                  Sem profissional atribuído a este plantão.
                </p>
              )}

              {isMaster && selectedEscala?.contratoAtivoId && cellModal.date && cellModal.grade && (
                <div className="rounded-2xl border border-coop-200 bg-white p-4 mb-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-coop-700 font-display mb-2">
                    Adicional por data (contrato)
                  </p>
                  <p className="text-[11px] text-coop-600 font-serif mb-3">
                    Define um percentual para este dia e turno. O valor final do plantão será calculado como \(valor\\_base \\times (1 + percentual/100)\).
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[160px]">
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-coop-600 font-display mb-1">
                        Percentual (%)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input w-full"
                        placeholder="Ex.: 50"
                        value={adicionalPercentualInput}
                        onChange={(e) => setAdicionalPercentualInput(e.target.value)}
                        disabled={loadingAction}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={salvarAdicionalDoDiaModal}
                      disabled={loadingAction}
                    >
                      Salvar adicional
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={removerAdicionalDoDiaModal}
                      disabled={loadingAction || !adicionalPercentualModal || adicionalPercentualModal === 0}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              )}

              {/* CTA: Atribuir médico (destaque visual) */}
              <div className="rounded-2xl border-l-4 border-l-coop-500 bg-gradient-to-r from-coop-50/60 to-transparent p-4 mb-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-coop-700 font-display mb-3">
                  Atribuir médico a este plantão
                </h3>
                <div className="flex gap-2 flex-wrap items-end">
                  <div ref={medicoAllocateCellRef} className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Pesquisar por nome ou CRM..."
                      value={
                        medicoAllocateCellOpen
                          ? medicoAllocateCellSearch
                          : medicoIdToAllocateCell
                            ? (() => {
                                const m = medicos.find((x) => x.id === medicoIdToAllocateCell);
                                if (m) return `${m.nomeCompleto} (${m.crm})`;
                                const lb = medicoPickLabels[medicoIdToAllocateCell];
                                if (lb) return `${lb.nomeCompleto} (${lb.crm})`;
                                if (cellModal.medico?.id === medicoIdToAllocateCell) {
                                  return `${cellModal.medico.nomeCompleto} (${cellModal.medico.crm})`;
                                }
                                return '';
                              })()
                            : medicoAllocateCellSearch
                      }
                      onChange={(e) => {
                        setMedicoAllocateCellSearch(e.target.value);
                        setMedicoAllocateCellOpen(true);
                        if (!e.target.value) setMedicoIdToAllocateCell('');
                      }}
                      onFocus={() => setMedicoAllocateCellOpen(true)}
                    />
                    {medicoAllocateCellOpen && (
                      <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-coop-200 bg-white shadow-lg py-1">
                        {loadingMedicosSuggest && medicos.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-coop-600 font-serif">Buscando médicos...</li>
                        ) : medicos.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-coop-600 font-serif">Nenhum médico encontrado</li>
                        ) : (
                          medicos.map((m) => (
                            <li
                              key={m.id}
                              className="px-3 py-2 text-sm cursor-pointer hover:bg-coop-100 text-coop-900 font-display"
                              onClick={() => {
                                rememberMedicoLabel(m);
                                setMedicoIdToAllocateCell(m.id);
                                setMedicoAllocateCellSearch('');
                                setMedicoAllocateCellOpen(false);
                              }}
                            >
                              {m.nomeCompleto} ({m.crm})
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary shrink-0"
                    onClick={alocarMedicoNoPlantao}
                    disabled={loadingAction || !medicoIdToAllocateCell}
                  >
                    Alocar
                  </button>
                </div>
                <p className="text-[11px] text-coop-600 mt-2 font-serif">
                  O médico ficará atribuído a este dia e turno ({cellModal.grade.label} – {formatDayShort(cellModal.date)}).
                </p>
              </div>

              <p className="text-[11px] text-coop-600 font-serif mb-4">
                Valor definido em <Link to="/valores-plantao" className="font-semibold text-coop-800 underline hover:text-coop-900">Valores Hora/Plantão</Link>. Ao alocar, o valor de {cellModal.grade.label} será aplicado.
                </p>

                {(medicoParaReplicar || cellModal.medico) && (
                <div className="pt-4 mt-4 border-t border-coop-200">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-coop-700 font-display mb-2">Repetir para outros dias</h3>
                  <p className="text-xs text-coop-600 font-serif mb-3">
                    Aplica o médico{' '}
                    {cellModal.medico
                      ? cellModal.medico.nomeCompleto
                      : medicos.find((m) => m.id === medicoIdToAllocateCell)?.nomeCompleto ??
                        medicoPickLabels[medicoIdToAllocateCell]?.nomeCompleto ??
                        'selecionado'}{' '}
                    e o valor no turno {cellModal.grade.label} nos 7 dias desta semana.
                    </p>
                    <button
                      type="button"
                    className="btn btn-secondary w-full sm:w-auto text-sm"
                      onClick={replicarMedicoNaSemana}
                      disabled={loadingAction || !medicoParaReplicar}
                    >
                    {loadingAction ? 'Aplicando...' : `Repetir na semana (${cellModal.grade.label})`}
                    </button>
                  </div>
                )}
              </div>

            <div className="px-5 py-4 border-t border-coop-200 bg-coop-50/30 flex justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCellModal((m) => ({ ...m, open: false }))}
              >
                Fechar
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmClearVagas.open && confirmClearVagas.key && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setConfirmClearVagas({ open: false })}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-coop-600 mb-2 font-display">
              Cancelar vagas em aberto
            </h3>
            <p className="text-sm text-coop-700 font-serif mb-4">
              Remover as vagas de plantão vago para <span className="font-semibold">{confirmClearVagas.label}</span>?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmClearVagas({ open: false })}
              >
                Manter vagas
              </button>
              <button
                type="button"
                className="btn btn-primary bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setPlantaoVagoSlots((prev) => {
                    const copy = { ...prev };
                    delete copy[confirmClearVagas.key!];
                    return copy;
                  });
                  setConfirmClearVagas({ open: false });
                }}
              >
                Remover vagas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Escalas;
