import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useMasterEscopo } from '../context/MasterEscopoContext';
import { adminService } from '../services/admin.service';
import { fixMojibake } from '../utils/validation.util';

type RegistroPontoAdmin = {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  duracaoMinutos: number | null;
  /** Preenchido no checkout (escala+ponto): valor fixo no histórico */
  repasseValorCongelado?: number | string | null;
  medico: {
    id: string;
    nomeCompleto: string;
    crm: string;
    email: string | null;
  } | null;
  escala: {
    id: string;
    nome: string;
    dataInicio: string;
    dataFim: string;
  } | null;
};

/** Uma linha do passo-a-passo do valor (debug / auditoria no relatório). */
type DetalheCalculoRegistroPonto = {
  registroId: string;
  checkInAt: string;
  duracaoMinutos: number;
  valorRepasseAplicado: number | null;
  valorCobrancaAplicado: number | null;
  metodo:
    | 'REPASSE_CONGELADO'
    | 'VALOR_HORA_ALOCACAO_ESCALA'
    | 'VALOR_HORA_PLANTAO'
    | 'SEM_VALOR';
  /** Texto curto para exibir na UI */
  resumo: string;
};

type AgrupamentoHoras = {
  key: string;
  medicoId: string;
  medicoNome: string;
  escalaId: string;
  escalaNome: string;
  totalMinutos: number;
  totalRegistros: number;
  /** Valor/h (R$) usado no cálculo quando aplicável */
  valorHora?: number;
  /** Contrato só ponto: total repasse (valor hora repasse × horas) */
  valorRepasse?: number;
  /** Contrato só ponto: total cobrança (valor hora cobrança × horas) */
  valorCobranca?: number;
  /** Passo a passo por batida de ponto (contrato escala + ponto) */
  calculoPorRegistro?: DetalheCalculoRegistroPonto[];
};

const formatDuration = (minutes: number) => {
  const safe = Math.max(0, minutes || 0);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
};

const formatDateInput = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatValor = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

/**
 * Helvetica no jsPDF não cobre vários Unicode (travessão —, espaço estreito em R$, etc.),
 * o que pode esvaziar ou corromper células do autoTable.
 */
const textoSeguroPdf = (s: string) =>
  String(s)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2013|\u2014|\u2212/g, '-');

const round2 = (n: number) => Math.round(n * 100) / 100;

const inferGradeIdFromCheckIn = (checkInAtIso: string): 'mt' | 'sn' => {
  const d = new Date(checkInAtIso);
  const h = d.getHours();
  // MT: 07:00–18:59, SN: 19:00–06:59
  return h >= 7 && h < 19 ? 'mt' : 'sn';
};

type DiaKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';
const diaKeyFromIso = (iso: string): DiaKey => {
  const d = new Date(iso);
  // JS: 0=Dom ... 6=Sáb
  switch (d.getDay()) {
    case 0:
      return 'dom';
    case 1:
      return 'seg';
    case 2:
      return 'ter';
    case 3:
      return 'qua';
    case 4:
      return 'qui';
    case 5:
      return 'sex';
    default:
      return 'sab';
  }
};

const exportHorasExcel = (
  agrupado: AgrupamentoHoras[],
  dataInicio: string,
  dataFim: string,
  mostrarRepasseECobranca: boolean
) => {
  const rows = agrupado.map((item) =>
    mostrarRepasseECobranca
      ? {
          Medico: item.medicoNome,
          Escala: item.escalaNome,
          Registros: item.totalRegistros,
          'Total (min)': item.totalMinutos,
          'Total (horas)': formatDuration(item.totalMinutos),
          'Repasse (R$)': item.valorRepasse != null ? formatValor(item.valorRepasse) : '',
          'Cobranca (R$)': item.valorCobranca != null ? formatValor(item.valorCobranca) : '',
        }
      : {
          Medico: item.medicoNome,
          Escala: item.escalaNome,
          Registros: item.totalRegistros,
          'Total (min)': item.totalMinutos,
          'Total (horas)': formatDuration(item.totalMinutos),
          'Valor (R$)': item.valorRepasse != null ? formatValor(item.valorRepasse) : '',
        }
  );

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatorio');
  XLSX.writeFile(wb, `relatorio-horas_${dataInicio}_${dataFim}.xlsx`);
};

const exportHorasPdf = (
  agrupado: AgrupamentoHoras[],
  dataInicio: string,
  dataFim: string,
  mostrarRepasseECobranca: boolean
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text(textoSeguroPdf('Relatório financeiro de horas por médico e escala'), 14, 12);
  doc.setFontSize(10);
  doc.text(textoSeguroPdf(`Período: ${dataInicio} a ${dataFim}`), 14, 18);
  const cel = (s: string) => textoSeguroPdf(s);
  const celValor = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? cel(formatValor(n)) : '-';
  autoTable(doc, {
    startY: 24,
    // Uma linha de cabeçalho = [[c1,c2,...]], sem array extra (evita 1 coluna só).
    head: mostrarRepasseECobranca
      ? [
          [
            cel('Médico'),
            cel('Escala'),
            cel('Registros'),
            cel('Total (horas)'),
            cel('Repasse (R$)'),
            cel('Cobrança (R$)'),
          ],
        ]
      : [
          [
            cel('Médico'),
            cel('Escala'),
            cel('Registros'),
            cel('Total (horas)'),
            cel('Valor (R$)'),
          ],
        ],
    body: agrupado.map((item) =>
      mostrarRepasseECobranca
        ? [
            cel(item.medicoNome),
            cel(item.escalaNome),
            String(item.totalRegistros),
            cel(formatDuration(item.totalMinutos)),
            celValor(item.valorRepasse),
            celValor(item.valorCobranca),
          ]
        : [
            cel(item.medicoNome),
            cel(item.escalaNome),
            String(item.totalRegistros),
            cel(formatDuration(item.totalMinutos)),
            celValor(item.valorRepasse),
          ]
    ),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [22, 163, 74] },
    margin: { left: 14, right: 14, bottom: 14 },
  });
  doc.save(`relatorio-horas_${dataInicio}_${dataFim}.pdf`);
};

function pathnameEndsWithRelatorios(pathname: string): boolean {
  return pathname === '/relatorios' || pathname.endsWith('/relatorios');
}

const Relatorios = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';
  const location = useLocation();
  const masterEscopo = useMasterEscopo();
  const prevPathRef = useRef(location.pathname);

  const now = new Date();
  const [dataInicio, setDataInicio] = useState(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dataFim, setDataFim] = useState(formatDateInput(now));
  const [contratoId, setContratoId] = useState('');
  const [subgrupoId, setSubgrupoId] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [mostrarDetalheCalculo, setMostrarDetalheCalculo] = useState(false);

  /** Ao entrar nesta página, copia o escopo guardado (outros módulos) para os filtros — Relatórios continua podendo usar "Todos". */
  useEffect(() => {
    const path = location.pathname;
    const prev = prevPathRef.current;
    prevPathRef.current = path;
    const entered = pathnameEndsWithRelatorios(path) && !pathnameEndsWithRelatorios(prev);
    if (!isMaster || !masterEscopo.hydrated || !entered) return;
    setContratoId(masterEscopo.contratoId);
    setSubgrupoId(masterEscopo.subgrupoId);
    setEquipeId(masterEscopo.equipeId);
  }, [
    location.pathname,
    isMaster,
    masterEscopo.hydrated,
    masterEscopo.contratoId,
    masterEscopo.subgrupoId,
    masterEscopo.equipeId,
  ]);

  const { data: contratosResp } = useQuery({
    queryKey: ['admin', 'contratos-ativos', 'relatorio-filtros'],
    queryFn: () => adminService.listContratosAtivos({ page: 1, limit: 200 }),
    enabled: isMaster,
  });

  const { data: subgruposResp } = useQuery({
    queryKey: ['admin', 'contrato-subgrupos', contratoId],
    queryFn: () => adminService.listContratoSubgrupos(contratoId),
    enabled: isMaster && Boolean(contratoId),
  });

  const { data: equipesResp } = useQuery({
    queryKey: ['admin', 'contrato-equipes', contratoId],
    queryFn: () => adminService.listContratoEquipes(contratoId),
    enabled: isMaster && Boolean(contratoId),
  });

  const { data: equipesPorSubgrupoResp } = useQuery({
    queryKey: ['admin', 'equipes', subgrupoId],
    queryFn: () => adminService.listEquipes(subgrupoId ? { subgrupoId } : undefined),
    enabled: isMaster && Boolean(subgrupoId),
  });

  const contratos = useMemo(() => contratosResp?.data ?? [], [contratosResp?.data]);
  const subgruposList = useMemo(() => subgruposResp?.data ?? [], [subgruposResp?.data]);
  const equipesList = equipesResp?.data ?? [];
  const equipesDoSubgrupo = equipesPorSubgrupoResp?.data ?? [];
  const equipesFiltradas =
    subgrupoId && equipesDoSubgrupo.length > 0
      ? equipesDoSubgrupo
      : subgrupoId && equipesList.length > 0
        ? equipesList.filter((e: any) => e.equipe?.subgrupo?.id === subgrupoId || e.equipe?.subgrupoId === subgrupoId)
        : equipesList;

  const { data: registrosResp, isLoading } = useQuery({
    queryKey: ['admin', 'registros-ponto', { contratoId, subgrupoId, equipeId, dataInicio, dataFim }],
    queryFn: () =>
      adminService.listRegistrosPonto({
        contratoAtivoId: contratoId || undefined,
        subgrupoId: subgrupoId || undefined,
        equipeId: equipeId || undefined,
        dataInicio: `${dataInicio}T00:00:00.000`,
        dataFim: `${dataFim}T23:59:59.999`,
      }),
    enabled: isMaster && Boolean(dataInicio && dataFim),
  });

  const contratoSelecionado = useMemo(
    () => (contratoId ? contratos.find((c: any) => c.id === contratoId) : null),
    [contratoId, contratos]
  );

  const subgrupoSelecionadoMeta = useMemo(() => {
    if (!subgrupoId) return null;
    const row = (subgruposList as { subgrupo?: { id: string; usaEscala?: boolean; usaPonto?: boolean } }[]).find(
      (r) => r.subgrupo?.id === subgrupoId
    );
    return row?.subgrupo ?? null;
  }, [subgrupoId, subgruposList]);

  /** Regras de relatório alinhadas ao estilo de produção por subgrupo (com fallback ao contrato até carregar subgrupos). */
  const { usaEscalaEPonto, usaSomenteEscala, apenasPonto, mostrarRepasseECobranca } = useMemo(() => {
    if (subgrupoSelecionadoMeta) {
      const sg = subgrupoSelecionadoMeta;
      return {
        usaEscalaEPonto: Boolean(sg.usaEscala && sg.usaPonto),
        usaSomenteEscala: Boolean(sg.usaEscala && !sg.usaPonto),
        apenasPonto: Boolean(sg.usaPonto && !sg.usaEscala),
        mostrarRepasseECobranca: Boolean(sg.usaEscala || sg.usaPonto),
      };
    }
    const sgList = (subgruposList as { subgrupo?: { usaEscala?: boolean; usaPonto?: boolean } }[])
      .map((r) => r.subgrupo)
      .filter(Boolean) as { usaEscala?: boolean; usaPonto?: boolean }[];
    if (contratoId && sgList.length > 0) {
      return {
        usaEscalaEPonto: sgList.some((s) => s.usaEscala && s.usaPonto),
        usaSomenteEscala:
          sgList.some((s) => s.usaEscala && !s.usaPonto) && !sgList.some((s) => s.usaEscala && s.usaPonto),
        apenasPonto:
          sgList.some((s) => s.usaPonto && !s.usaEscala) && !sgList.some((s) => s.usaEscala && s.usaPonto),
        mostrarRepasseECobranca: sgList.some((s) => s.usaEscala || s.usaPonto),
      };
    }
    return {
      usaEscalaEPonto: Boolean(contratoSelecionado?.usaEscala && contratoSelecionado?.usaPonto),
      usaSomenteEscala: Boolean(contratoSelecionado?.usaEscala && !contratoSelecionado?.usaPonto),
      apenasPonto: Boolean(contratoSelecionado?.usaPonto && !contratoSelecionado?.usaEscala),
      mostrarRepasseECobranca: Boolean(contratoSelecionado?.usaEscala || contratoSelecionado?.usaPonto),
    };
  }, [subgrupoSelecionadoMeta, subgruposList, contratoId, contratoSelecionado]);

  const usaEscalaComValoresPlantao = usaEscalaEPonto || usaSomenteEscala;

  const { data: valoresPlantaoResp } = useQuery({
    queryKey: ['admin', 'valores-plantao', contratoId, subgrupoId || '__all__', equipeId || '__none__', 'relatorio'],
    queryFn: () => adminService.getValoresPlantao(contratoId, subgrupoId || undefined, equipeId || undefined),
    enabled: isMaster && usaEscalaComValoresPlantao && Boolean(contratoId),
  });
  const { data: adicionaisResp } = useQuery({
    queryKey: ['admin', 'adicionais-plantao', contratoId, dataInicio, dataFim],
    queryFn: () =>
      adminService.listAdicionaisPlantao({
        contratoAtivoId: contratoId,
        dataInicio,
        dataFim,
      }),
    enabled: isMaster && usaEscalaComValoresPlantao && Boolean(contratoId && dataInicio && dataFim),
  });

  const valoresPlantaoPorGrade = useMemo(() => {
    const map = new Map<
      string,
      {
        repasseGlobal: number | null;
        repassePorDia: Partial<Record<DiaKey, number | null>>;
        cobrancaGlobal: number | null;
        cobrancaPorDia: Partial<Record<DiaKey, number | null>>;
      }
    >();
    const rows = valoresPlantaoResp?.data ?? [];
    for (const v of rows as any[]) {
      const gradeId = String(v.gradeId ?? '').trim().toLowerCase();
      if (!gradeId) continue;

      const repasseGlobal =
        v.valorHora != null && v.valorHora !== '' && Number.isFinite(Number(v.valorHora))
          ? Number(v.valorHora)
          : null;
      const cobrancaGlobal =
        v.valorHoraCobranca != null && v.valorHoraCobranca !== '' && Number.isFinite(Number(v.valorHoraCobranca))
          ? Number(v.valorHoraCobranca)
          : null;

      map.set(gradeId, {
        repasseGlobal,
        repassePorDia: (v.valorHoraPorDia ?? {}) as any,
        cobrancaGlobal,
        cobrancaPorDia: (v.valorHoraCobrancaPorDia ?? {}) as any,
      });
    }
    return map;
  }, [valoresPlantaoResp?.data]);

  const adicionaisPorDataGrade = useMemo(() => {
    const map = new Map<string, number>();
    const rows = adicionaisResp?.data ?? [];
    for (const row of rows as any[]) {
      const gradeId = String(row?.gradeId ?? '').trim().toLowerCase();
      const data = String(row?.data ?? '').slice(0, 10);
      const percentual = Number(row?.percentual ?? 0);
      if (!gradeId || !data || !Number.isFinite(percentual) || percentual <= 0) continue;
      map.set(`${data}::${gradeId}`, percentual);
    }
    return map;
  }, [adicionaisResp?.data]);

  const registrosDerived = useMemo(() => {
    const raw = registrosResp?.data;
    return {
      registros: (Array.isArray(raw) ? raw : raw?.data ?? []) as RegistroPontoAdmin[],
      valorHoraPorMedico: (!Array.isArray(raw) && raw?.valorHoraPorMedico ? raw.valorHoraPorMedico : {}) as Record<
        string,
        number
      >,
      valorHoraCobrancaPorMedico: (!Array.isArray(raw) && raw?.valorHoraCobrancaPorMedico
        ? raw.valorHoraCobrancaPorMedico
        : {}) as Record<string, number>,
      valorHoraPorRegistroPontoId: (!Array.isArray(raw) && raw?.valorHoraPorRegistroPontoId
        ? raw.valorHoraPorRegistroPontoId
        : {}) as Record<string, number>,
      valorHoraCobrancaPorRegistroPontoId: (!Array.isArray(raw) && raw?.valorHoraCobrancaPorRegistroPontoId
        ? raw.valorHoraCobrancaPorRegistroPontoId
        : {}) as Record<string, number>,
      valorHoraPorMedicoEscala: (!Array.isArray(raw) && raw?.valorHoraPorMedicoEscala
        ? raw.valorHoraPorMedicoEscala
        : {}) as Record<string, number>,
      plantoesValorHoraPorEscalaDataGrade: (!Array.isArray(raw) && raw?.plantoesValorHoraPorEscalaDataGrade
        ? raw.plantoesValorHoraPorEscalaDataGrade
        : {}) as Record<string, number>,
      valorPlantao12hPorRegistroPontoId: (!Array.isArray(raw) && raw?.valorPlantao12hPorRegistroPontoId
        ? raw.valorPlantao12hPorRegistroPontoId
        : {}) as Record<string, number>,
      gradeIdPlantaoPorRegistroPontoId: (!Array.isArray(raw) && raw?.gradeIdPlantaoPorRegistroPontoId
        ? raw.gradeIdPlantaoPorRegistroPontoId
        : {}) as Record<string, string>,
    };
  }, [registrosResp?.data]);

  const { agrupado, totalMinutos, totalRegistros } = useMemo(() => {
    const {
      registros,
      valorHoraPorMedico,
      valorHoraCobrancaPorMedico,
      valorHoraPorRegistroPontoId,
      valorHoraCobrancaPorRegistroPontoId,
      valorHoraPorMedicoEscala,
      plantoesValorHoraPorEscalaDataGrade,
      valorPlantao12hPorRegistroPontoId,
      gradeIdPlantaoPorRegistroPontoId,
    } = registrosDerived;
    const map = new Map<string, AgrupamentoHoras>();
    let somaMinutos = 0;

    for (const item of registros) {
      const minutos = item.duracaoMinutos || 0;
      const medId = item.medico?.id || 'sem-medico';
      const escId = item.escala?.id ?? (item as any).escalaId ?? 'sem-escala';
      const medNome = fixMojibake(item.medico?.nomeCompleto || 'Médico não identificado');
      const escNome = fixMojibake(item.escala?.nome || 'Escala não identificada');
      const key = `${medId}::${escId}`;
      const valorHoraAlocacao =
        escId !== 'sem-escala' && medId !== 'sem-medico'
          ? Number(valorHoraPorMedicoEscala[key])
          : NaN;
      const temValorHoraAlocacao = Number.isFinite(valorHoraAlocacao) && valorHoraAlocacao > 0;

      const gradeIdInferido = inferGradeIdFromCheckIn(item.checkInAt);
      const dateStr = String(item.checkInAt ?? '').slice(0, 10);
      const gradeResolvido =
        item.id && gradeIdPlantaoPorRegistroPontoId[item.id]
          ? String(gradeIdPlantaoPorRegistroPontoId[item.id]).trim().toLowerCase()
          : null;

      const horasTrabalhadas = minutos / 60;
      const rawCongelado = (item as RegistroPontoAdmin).repasseValorCongelado;
      const repasseCongeladoNum =
        rawCongelado != null && rawCongelado !== ''
          ? Number(rawCongelado)
          : NaN;
      const temRepasseCongelado =
        Number.isFinite(repasseCongeladoNum) && repasseCongeladoNum > 0;
      const repasseRateBackendRaw = item.id ? valorHoraPorRegistroPontoId[item.id] : undefined;
      const repasseRateBackend =
        repasseRateBackendRaw != null && Number.isFinite(Number(repasseRateBackendRaw))
          ? Number(repasseRateBackendRaw)
          : null;
      const cobrancaRateBackendRaw = item.id ? valorHoraCobrancaPorRegistroPontoId[item.id] : undefined;
      const cobrancaRateBackend =
        cobrancaRateBackendRaw != null && Number.isFinite(Number(cobrancaRateBackendRaw))
          ? Number(cobrancaRateBackendRaw)
          : null;
      const diaKey = diaKeyFromIso(item.checkInAt);
      const gradeKey = gradeResolvido != null ? String(gradeResolvido).trim().toLowerCase() : '';
      const cadResolvido = gradeKey ? valoresPlantaoPorGrade.get(gradeKey) ?? null : null;
      const cadInferido = valoresPlantaoPorGrade.get(gradeIdInferido) ?? null;

      const pickRate = (
        byDay: Partial<Record<DiaKey, number | null>>,
        dia: DiaKey,
        fallbackGlobal: number | null
      ): number | null => {
        const v = byDay?.[dia];
        const n = v != null ? Number(v) : NaN;
        if (Number.isFinite(n) && n > 0) return n;
        return fallbackGlobal != null && Number.isFinite(Number(fallbackGlobal)) && Number(fallbackGlobal) > 0
          ? Number(fallbackGlobal)
          : null;
      };

      const repasseRateCad = cadResolvido
        ? pickRate(cadResolvido.repassePorDia, diaKey, cadResolvido.repasseGlobal)
        : cadInferido
          ? pickRate(cadInferido.repassePorDia, diaKey, cadInferido.repasseGlobal)
          : null;
      const cobrancaRateCad = cadResolvido
        ? pickRate(cadResolvido.cobrancaPorDia, diaKey, cadResolvido.cobrancaGlobal)
        : cadInferido
          ? pickRate(cadInferido.cobrancaPorDia, diaKey, cadInferido.cobrancaGlobal)
          : null;

      const repasseRate = temValorHoraAlocacao
        ? valorHoraAlocacao
        : repasseRateBackend != null && repasseRateBackend > 0
          ? repasseRateBackend
          : repasseRateCad;
      const cobrancaRate = cobrancaRateBackend != null && cobrancaRateBackend > 0
        ? cobrancaRateBackend
        : cobrancaRateCad;
      const repasseRegistro = temRepasseCongelado
        ? round2(repasseCongeladoNum)
        : repasseRate != null && repasseRate > 0
          ? round2(horasTrabalhadas * repasseRate)
          : null;

      const cobrancaRegistro =
        cobrancaRate != null && cobrancaRate > 0
          ? round2(horasTrabalhadas * cobrancaRate)
          : null;

      const adicionalPercentual =
        gradeResolvido && dateStr ? adicionaisPorDataGrade.get(`${dateStr}::${gradeResolvido}`) ?? 0 : 0;
      const fatorAdicional = 1 + adicionalPercentual / 100;
      const repasseComAdicional =
        repasseRegistro != null ? round2(repasseRegistro * fatorAdicional) : null;
      const cobrancaComAdicional =
        cobrancaRegistro != null ? round2(cobrancaRegistro * fatorAdicional) : null;

      const metodoCalculo: DetalheCalculoRegistroPonto['metodo'] =
        temRepasseCongelado
          ? 'REPASSE_CONGELADO'
          : temValorHoraAlocacao
            ? 'VALOR_HORA_ALOCACAO_ESCALA'
            : repasseRegistro != null
              ? 'VALOR_HORA_PLANTAO'
              : 'SEM_VALOR';

      const resumoCalculo =
        temRepasseCongelado
          ? `Congelado no checkout: ${formatValor(repasseCongeladoNum)}`
          : temValorHoraAlocacao
            ? `Repasse: ${horasTrabalhadas.toFixed(2)} h × ${formatValor(valorHoraAlocacao)}/h = ${repasseRegistro != null ? formatValor(repasseRegistro) : '—'}. ` +
              `Cobrança: ${horasTrabalhadas.toFixed(2)} h × ${cobrancaRate != null ? `${formatValor(cobrancaRate)}/h` : '—'} = ${cobrancaRegistro != null ? formatValor(cobrancaRegistro) : '—'}.` +
              (adicionalPercentual > 0 ? ` Adicional +${adicionalPercentual}% aplicado.` : '')
            : repasseRegistro != null || cobrancaRegistro != null
              ? `Repasse: ${horasTrabalhadas.toFixed(2)} h × ${repasseRate != null ? `${formatValor(repasseRate)}/h` : '—'} = ${repasseRegistro != null ? formatValor(repasseRegistro) : '—'}. ` +
                `Cobrança: ${horasTrabalhadas.toFixed(2)} h × ${cobrancaRate != null ? `${formatValor(cobrancaRate)}/h` : '—'} = ${cobrancaRegistro != null ? formatValor(cobrancaRegistro) : '—'}.` +
                (adicionalPercentual > 0 ? ` Adicional +${adicionalPercentual}% aplicado.` : '')
              : '—';

      const detalheLinha: DetalheCalculoRegistroPonto = {
        registroId: item.id,
        checkInAt: item.checkInAt,
        duracaoMinutos: minutos,
        valorRepasseAplicado: repasseComAdicional,
        valorCobrancaAplicado: cobrancaComAdicional,
        metodo: metodoCalculo,
        resumo: resumoCalculo,
      };

      const prev = map.get(key);
      if (prev) {
        prev.totalMinutos += minutos;
        prev.totalRegistros += 1;
        if (repasseComAdicional != null) {
          prev.valorRepasse = round2((prev.valorRepasse ?? 0) + repasseComAdicional);
        }
        if (cobrancaComAdicional != null) {
          prev.valorCobranca = round2((prev.valorCobranca ?? 0) + cobrancaComAdicional);
        }
        if (temValorHoraAlocacao) {
          prev.valorHora = valorHoraAlocacao;
        }
        if (escNome && escNome !== 'Escala não identificada' && prev.escalaNome === 'Escala não identificada') {
          prev.escalaNome = escNome;
        }
        if (usaEscalaEPonto && mostrarDetalheCalculo) {
          if (!prev.calculoPorRegistro) prev.calculoPorRegistro = [];
          prev.calculoPorRegistro.push(detalheLinha);
        }
      } else {
        map.set(key, {
          key,
          medicoId: medId,
          medicoNome: medNome,
          escalaId: escId,
          escalaNome: escNome,
          totalMinutos: minutos,
          totalRegistros: 1,
          valorHora: temValorHoraAlocacao ? valorHoraAlocacao : undefined,
          valorRepasse: repasseComAdicional != null ? round2(repasseComAdicional) : undefined,
          valorCobranca: cobrancaComAdicional != null ? round2(cobrancaComAdicional) : undefined,
          calculoPorRegistro:
            usaEscalaEPonto && mostrarDetalheCalculo ? [detalheLinha] : undefined,
        });
      }

      somaMinutos += minutos;
    }

    const rows = Array.from(map.values()).sort((a, b) => b.totalMinutos - a.totalMinutos);

    const temValorPlantaoGravadoNoPeriodo = Object.keys(plantoesValorHoraPorEscalaDataGrade).length > 0;
    const temValorBaseGrade = valoresPlantaoPorGrade.size > 0;
    const temValorPorRegistro = Object.keys(valorPlantao12hPorRegistroPontoId).length > 0;
    const temGradeResolvido = Object.keys(gradeIdPlantaoPorRegistroPontoId).length > 0;
    // Fallback: só quando não há base de plantão/grade no período; nunca sobrescreve linha já calculada no loop principal.
    if (
      !usaEscalaComValoresPlantao ||
      (!temValorBaseGrade &&
        !temValorPlantaoGravadoNoPeriodo &&
        !temValorPorRegistro &&
        !temGradeResolvido)
    ) {
      for (const row of rows) {
        const keyMedEsc = `${row.medicoId}::${row.escalaId}`;
        if (row.escalaId !== 'sem-escala') {
          if (row.valorRepasse != null) continue;
          const vh = valorHoraPorMedicoEscala[keyMedEsc];
          if (vh != null && vh > 0) {
            row.valorHora = vh;
            row.valorRepasse = round2((row.totalMinutos / 60) * vh);
            row.calculoPorRegistro = [
              {
                registroId: '_agrupado',
                checkInAt: '',
                duracaoMinutos: row.totalMinutos,
                valorRepasseAplicado: row.valorRepasse,
                valorCobrancaAplicado: null,
                metodo: 'VALOR_HORA_ALOCACAO_ESCALA',
                resumo: `Fallback (sem plantão/grade no período): ${(row.totalMinutos / 60).toFixed(2)} h × ${formatValor(
                  vh
                )}/h na alocação médico–escala.`,
              },
            ];
          }
        } else if (row.medicoId !== 'sem-medico') {
          const vhLegado = valorHoraPorMedico[row.medicoId];
          // Com valor por dia da semana, o valor/h pode variar dentro do período.
          // Preferir resolução por registro (backend). Fallback para mapa por médico (legado).
          let rep: number | null = null;
          let cob: number | null = null;
          for (const reg of registros.filter((r) => r.escala == null && r.medico?.id === row.medicoId)) {
            const mins = Number(reg.duracaoMinutos ?? 0);
            if (!mins || mins <= 0) continue;
            const vh = reg.id && valorHoraPorRegistroPontoId[reg.id] != null ? Number(valorHoraPorRegistroPontoId[reg.id]) : valorHoraPorMedico[row.medicoId];
            const vhCob =
              reg.id && valorHoraCobrancaPorRegistroPontoId[reg.id] != null
                ? Number(valorHoraCobrancaPorRegistroPontoId[reg.id])
                : valorHoraCobrancaPorMedico[row.medicoId];
            if (vh != null && Number.isFinite(vh) && vh > 0) {
              rep = (rep ?? 0) + (mins / 60) * vh;
            }
            if (vhCob != null && Number.isFinite(vhCob) && vhCob > 0) {
              cob = (cob ?? 0) + (mins / 60) * vhCob;
            }
          }
          if (rep != null || cob != null) {
            row.valorRepasse = rep != null ? round2(rep) : undefined;
            row.valorCobranca = cob != null ? round2(cob) : undefined;
          } else if (!apenasPonto && vhLegado != null && vhLegado > 0) {
            row.valorHora = vhLegado;
            row.valorRepasse = round2((row.totalMinutos / 60) * vhLegado);
          }
        }
      }
    }

    return {
      agrupado: rows,
      totalMinutos: somaMinutos,
      totalRegistros: registros.length,
    };
  }, [
    registrosDerived,
    usaEscalaEPonto,
    usaEscalaComValoresPlantao,
    valoresPlantaoPorGrade,
    apenasPonto,
    adicionaisPorDataGrade,
    mostrarDetalheCalculo,
  ]);

  const totaisRepasseCobranca = useMemo(() => {
    if (!mostrarRepasseECobranca) return { repasse: null as number | null, cobranca: null as number | null };
    let rep = 0;
    let cob = 0;
    let temRep = false;
    let temCob = false;
    for (const r of agrupado) {
      if (r.valorRepasse != null) {
        rep += r.valorRepasse;
        temRep = true;
      }
      if (r.valorCobranca != null) {
        cob += r.valorCobranca;
        temCob = true;
      }
    }
    return {
      repasse: temRep ? round2(rep) : null,
      cobranca: temCob ? round2(cob) : null,
    };
  }, [agrupado, mostrarRepasseECobranca]);

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-coop-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Esta área de relatórios é exclusiva para o perfil Master.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-coop-500">
        <h2 className="text-2xl font-bold text-coop-900 mb-1">Relatório financeiro</h2>
        <p className="text-gray-600">Consolidação por médico e escala, com filtros de período.</p>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-coop-900 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div>
            <label htmlFor="dataInicio" className="block text-sm font-semibold text-coop-800 mb-1">
              Data início
            </label>
            <input
              id="dataInicio"
              type="date"
              className="input"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="dataFim" className="block text-sm font-semibold text-coop-800 mb-1">
              Data fim
            </label>
            <input
              id="dataFim"
              type="date"
              className="input"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="contratoId" className="block text-sm font-semibold text-coop-800 mb-1">
              Contrato
            </label>
            <select
              id="contratoId"
              className="input"
              value={contratoId}
              onChange={(e) => {
                setContratoId(e.target.value);
                setSubgrupoId('');
                setEquipeId('');
              }}
            >
              <option value="">Todos</option>
              {contratos.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {fixMojibake(c.nome ?? c.id)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="subgrupoId" className="block text-sm font-semibold text-coop-800 mb-1">
              Subgrupo
            </label>
            <select
              id="subgrupoId"
              className="input"
              value={subgrupoId}
              onChange={(e) => {
                setSubgrupoId(e.target.value);
                setEquipeId('');
              }}
              disabled={!contratoId}
            >
              <option value="">Todos</option>
              {subgruposList.map((item: any) => (
                <option key={item.subgrupo?.id} value={item.subgrupo?.id ?? ''}>
                  {fixMojibake(item.subgrupo?.nome ?? '')}
                </option>
              ))}
            </select>
            {usaEscalaEPonto && contratoId && !subgrupoId && subgruposList.length > 1 && (
              <p className="text-[11px] text-amber-800 mt-1.5 leading-snug">
                Vários subgrupos neste contrato: com &quot;Todos&quot;, os valores de plantão do cadastro são unidos por
                tipo (maior valor por grade). Para cravar um subgrupo, selecione-o no filtro.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="equipeId" className="block text-sm font-semibold text-coop-800 mb-1">
              Equipe
            </label>
            <select
              id="equipeId"
              className="input"
              value={equipeId}
              onChange={(e) => setEquipeId(e.target.value)}
              disabled={!subgrupoId}
            >
              <option value="">Todas as equipes</option>
              {equipesFiltradas.map((item: any) => {
                const id = item.equipe?.id ?? item.id ?? '';
                const nome = item.equipe?.nome ?? item.nome ?? '';
                return (
                  <option key={id} value={id}>
                    {fixMojibake(nome)}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-4 ${mostrarRepasseECobranca ? 'md:grid-cols-2 xl:grid-cols-5' : 'md:grid-cols-3'}`}
      >
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-coop-600">Total de horas</p>
          <p className="text-2xl font-bold text-coop-900 mt-1">{formatDuration(totalMinutos)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-coop-600">Total de registros</p>
          <p className="text-2xl font-bold text-coop-900 mt-1">{totalRegistros}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-coop-600">Agrupamentos</p>
          <p className="text-2xl font-bold text-coop-900 mt-1">{agrupado.length}</p>
        </div>
        {mostrarRepasseECobranca && (
          <>
            <div className="card border-l-4 border-coop-500">
              <p className="text-xs uppercase tracking-wide text-coop-600">Total repasse</p>
              <p className="text-2xl font-bold text-coop-900 mt-1">
                {totaisRepasseCobranca.repasse != null ? formatValor(totaisRepasseCobranca.repasse) : '—'}
              </p>
            </div>
            <div className="card border-l-4 border-coop-600">
              <p className="text-xs uppercase tracking-wide text-coop-600">Total cobrança</p>
              <p className="text-2xl font-bold text-coop-900 mt-1">
                {totaisRepasseCobranca.cobranca != null ? formatValor(totaisRepasseCobranca.cobranca) : '—'}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-coop-900">Horas por médico e escala</h3>
            <p className="text-xs text-gray-600 mt-1 max-w-3xl leading-relaxed">
              Registros já fechados usam o <strong>valor congelado no checkout</strong> (repasse). Sem congelado, o
              cálculo usa <strong>valor/h × horas</strong> (alocação médico–escala ou valores de plantão por dia).
            </p>
            {usaEscalaEPonto && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-coop-800">
                <input
                  type="checkbox"
                  className="rounded border-coop-300"
                  checked={mostrarDetalheCalculo}
                  onChange={(e) => setMostrarDetalheCalculo(e.target.checked)}
                />
                Mostrar detalhe do cálculo (cada registro de ponto)
              </label>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2"
            disabled={isLoading || agrupado.length === 0}
            onClick={() => exportHorasExcel(agrupado, dataInicio, dataFim, mostrarRepasseECobranca)}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            Exportar Excel
          </button>
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2"
            disabled={isLoading || agrupado.length === 0}
            onClick={() => exportHorasPdf(agrupado, dataInicio, dataFim, mostrarRepasseECobranca)}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
            Exportar PDF
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-gray-600">Carregando relatório...</p>
        ) : agrupado.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhum registro encontrado para os filtros informados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-coop-700 border-b">
                  <th className="py-2 pr-4">Médico</th>
                  <th className="py-2 pr-4">Escala</th>
                  <th className="py-2 pr-4">Registros</th>
                  <th className="py-2 pr-4">Total de horas</th>
                  {mostrarRepasseECobranca ? (
                    <>
                      <th className="py-2 pr-4">Repasse (R$)</th>
                      <th className="py-2 pr-4">Cobrança (R$)</th>
                    </>
                  ) : (
                    <th className="py-2 pr-4">Valor (R$)</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {agrupado.map((item) => {
                  const colSpan = mostrarRepasseECobranca ? 6 : 5;
                  return (
                    <Fragment key={item.key}>
                      <tr className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-medium text-coop-900">{item.medicoNome}</td>
                        <td className="py-2 pr-4 text-gray-700">{item.escalaNome}</td>
                        <td className="py-2 pr-4 text-gray-700">{item.totalRegistros}</td>
                        <td className="py-2 pr-4 font-semibold text-coop-900">{formatDuration(item.totalMinutos)}</td>
                        {mostrarRepasseECobranca ? (
                          <>
                            <td className="py-2 pr-4 text-gray-700">
                              {item.valorRepasse != null ? formatValor(item.valorRepasse) : '—'}
                            </td>
                            <td className="py-2 pr-4 text-gray-700">
                              {item.valorCobranca != null ? formatValor(item.valorCobranca) : '—'}
                            </td>
                          </>
                        ) : (
                          <td className="py-2 pr-4 text-gray-700">
                            {item.valorRepasse != null ? formatValor(item.valorRepasse) : '—'}
                          </td>
                        )}
                      </tr>
                      {usaEscalaEPonto &&
                        mostrarDetalheCalculo &&
                        item.calculoPorRegistro &&
                        item.calculoPorRegistro.length > 0 && (
                          <tr key={`${item.key}-det`} className="border-b bg-coop-50/80 last:border-b-0">
                            <td colSpan={colSpan} className="py-2 px-2 text-xs text-gray-700">
                              <p className="mb-1 font-semibold text-coop-800">Como o valor desta linha foi composto</p>
                              <ul className="list-inside list-disc space-y-1 pl-1">
                                {item.calculoPorRegistro.map((d, i) => (
                                  <li key={`${d.registroId}-${i}`}>
                                    <span className="font-mono text-[11px] text-gray-500">
                                      {d.registroId !== '_agrupado' ? d.registroId.slice(0, 8) : '—'}…
                                    </span>{' '}
                                    {d.checkInAt ? (
                                      <span className="text-gray-500">
                                        check-in {d.checkInAt.slice(0, 16).replace('T', ' ')} ·{' '}
                                      </span>
                                    ) : null}
                                    {formatDuration(d.duracaoMinutos)}
                                    {d.valorRepasseAplicado != null ? ` → Repasse ${formatValor(d.valorRepasseAplicado)}` : ''}
                                    {d.valorCobrancaAplicado != null ? ` · Cobrança ${formatValor(d.valorCobrancaAplicado)}` : ''}
                                    <span className="mt-0.5 block text-gray-600">{d.resumo}</span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Relatorios;
