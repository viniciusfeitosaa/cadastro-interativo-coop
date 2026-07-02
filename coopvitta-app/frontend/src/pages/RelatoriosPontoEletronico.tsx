import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useMasterEscopo } from '../context/MasterEscopoContext';
import { adminService } from '../services/admin.service';
import { fixMojibake } from '../utils/validation.util';
import { notify } from '../lib/notificationEmitter';

type RegistroPontoLinha = {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  duracaoMinutos: number | null;
  checkInAtrasado?: boolean;
  minutosAtrasoCheckin?: number | null;
  medico?: { nomeCompleto?: string | null } | null;
};

const formatDateInput = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatMonthInput = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatDateTimePtBr = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (minutes: number) => {
  const safe = Math.max(0, Number.isFinite(minutes) ? minutes : 0);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
};

const textoSeguroPdf = (s: string) =>
  String(s)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2013|\u2014|\u2212/g, '-');

function pathnameEndsWithRelatoriosPonto(pathname: string): boolean {
  return pathname === '/relatorios-ponto-eletronico' || pathname.endsWith('/relatorios-ponto-eletronico');
}

const RelatoriosPontoEletronico = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';
  const location = useLocation();
  const masterEscopo = useMasterEscopo();
  const prevPathRef = useRef(location.pathname);

  const [mesRef, setMesRef] = useState(() => formatMonthInput(new Date()));
  const [contratoId, setContratoId] = useState('');
  const [subgrupoId, setSubgrupoId] = useState('');
  const [equipeId, setEquipeId] = useState('');

  useEffect(() => {
    const path = location.pathname;
    const prev = prevPathRef.current;
    prevPathRef.current = path;
    const entered = pathnameEndsWithRelatoriosPonto(path) && !pathnameEndsWithRelatoriosPonto(prev);
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

  const dataInicio = useMemo(() => {
    const [y, m] = mesRef.split('-').map(Number);
    if (!y || !m) {
      const base = new Date();
      return formatDateInput(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    return formatDateInput(new Date(y, m - 1, 1));
  }, [mesRef]);

  const dataFim = useMemo(() => {
    const [y, m] = mesRef.split('-').map(Number);
    if (!y || !m) {
      const base = new Date();
      return formatDateInput(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    }
    return formatDateInput(new Date(y, m, 0));
  }, [mesRef]);

  const { data: contratosResp } = useQuery({
    queryKey: ['admin', 'contratos-ativos', 'relatorio-ponto-filtros'],
    queryFn: () => adminService.listContratosAtivos({ page: 1, limit: 200 }),
    enabled: isMaster,
  });

  const { data: subgruposResp } = useQuery({
    queryKey: ['admin', 'contrato-subgrupos', contratoId, 'relatorio-ponto'],
    queryFn: () => adminService.listContratoSubgrupos(contratoId),
    enabled: isMaster && Boolean(contratoId),
  });

  const { data: equipesResp } = useQuery({
    queryKey: ['admin', 'contrato-equipes', contratoId, 'relatorio-ponto'],
    queryFn: () => adminService.listContratoEquipes(contratoId),
    enabled: isMaster && Boolean(contratoId),
  });

  const { data: equipesPorSubgrupoResp } = useQuery({
    queryKey: ['admin', 'equipes', subgrupoId, 'relatorio-ponto'],
    queryFn: () => adminService.listEquipes(subgrupoId ? { subgrupoId } : undefined),
    enabled: isMaster && Boolean(subgrupoId),
  });

  const contratos = useMemo(() => contratosResp?.data ?? [], [contratosResp?.data]);
  const subgruposList = useMemo(() => subgruposResp?.data ?? [], [subgruposResp?.data]);
  const equipesList = useMemo(() => equipesResp?.data ?? [], [equipesResp?.data]);
  const equipesDoSubgrupo = useMemo(() => equipesPorSubgrupoResp?.data ?? [], [equipesPorSubgrupoResp?.data]);
  const equipesFiltradas = useMemo(() => {
    if (subgrupoId && equipesDoSubgrupo.length > 0) return equipesDoSubgrupo;
    if (subgrupoId && equipesList.length > 0) {
      return equipesList.filter((e: any) => e.subgrupo?.id === subgrupoId || e.subgrupoId === subgrupoId);
    }
    return equipesList;
  }, [subgrupoId, equipesDoSubgrupo, equipesList]);

  const { data: registrosResp, isLoading } = useQuery({
    queryKey: ['admin', 'registros-ponto', { contratoId, subgrupoId, equipeId, dataInicio, dataFim, scope: 'relatorio-ponto' }],
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

  const registros = useMemo(() => {
    const raw = registrosResp?.data;
    const arr = (Array.isArray(raw) ? raw : raw?.data ?? []) as RegistroPontoLinha[];
    return [...arr].sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
  }, [registrosResp?.data]);

  const linhasTabela = useMemo(() => {
    return registros.map((r) => ({
      id: r.id,
      profissional: fixMojibake(r.medico?.nomeCompleto || 'Profissional não identificado'),
      entrada: formatDateTimePtBr(r.checkInAt),
      saida: formatDateTimePtBr(r.checkOutAt),
      minutos: Math.max(0, Number(r.duracaoMinutos ?? 0)),
      atrasado: !!r.checkInAtrasado,
      minutosAtraso: Math.max(0, Number(r.minutosAtrasoCheckin ?? 0)),
    }));
  }, [registros]);

  const totalMinutosMes = useMemo(
    () => linhasTabela.reduce((acc, row) => acc + row.minutos, 0),
    [linhasTabela]
  );

  const exportExcel = () => {
    const rows = linhasTabela.map((row) => ({
      Profissional: row.profissional,
      Entrada: row.entrada,
      Saida: row.saida,
      Situação: row.atrasado ? `Atrasado (${row.minutosAtraso} min)` : 'No horário',
      'Total do dia': formatDuration(row.minutos),
    }));
    rows.push({
      Profissional: 'TOTAL DO MÊS',
      Entrada: '',
      Saida: '',
      Situação: '',
      'Total do dia': formatDuration(totalMinutosMes),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ponto');
    XLSX.writeFile(wb, `relatorio-ponto_${mesRef}.xlsx`);
    notify({ kind: 'success', title: 'Excel gerado', message: 'Relatório de ponto exportado em Excel.', source: 'relatorio-ponto' });
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(textoSeguroPdf('Relatório de ponto eletrônico'), 14, 12);
    doc.setFontSize(10);
    doc.text(textoSeguroPdf(`Período: ${dataInicio} a ${dataFim}`), 14, 18);
    autoTable(doc, {
      startY: 24,
      head: [[
        textoSeguroPdf('Profissional'),
        textoSeguroPdf('Entrada'),
        textoSeguroPdf('Saída'),
        textoSeguroPdf('Situação'),
        textoSeguroPdf('Total do dia'),
      ]],
      body: linhasTabela.map((row) => [
        textoSeguroPdf(row.profissional),
        textoSeguroPdf(row.entrada),
        textoSeguroPdf(row.saida),
        textoSeguroPdf(row.atrasado ? `Atrasado (${row.minutosAtraso} min)` : 'No horário'),
        textoSeguroPdf(formatDuration(row.minutos)),
      ]),
      foot: [[
        textoSeguroPdf('TOTAL DO MÊS'),
        '',
        '',
        '',
        textoSeguroPdf(formatDuration(totalMinutosMes)),
      ]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 163, 74] },
      footStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: 'bold' },
      margin: { left: 14, right: 14, bottom: 14 },
    });
    doc.save(`relatorio-ponto_${mesRef}.pdf`);
    notify({ kind: 'success', title: 'PDF gerado', message: 'Relatório de ponto emitido em PDF.', source: 'relatorio-ponto' });
  };

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-coop-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Esta área é exclusiva para o perfil Master.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-coop-500">
        <h2 className="text-2xl font-bold text-coop-900 mb-1">Relatórios de ponto eletrônico</h2>
        <p className="text-gray-600">Consolidado mensal de entradas e saídas por profissional.</p>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-coop-900 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div>
            <label htmlFor="mesRef" className="block text-sm font-semibold text-coop-800 mb-1">
              Mês
            </label>
            <input
              id="mesRef"
              type="month"
              className="input"
              value={mesRef}
              onChange={(e) => setMesRef(e.target.value)}
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-coop-600">Registros no mês</p>
          <p className="text-2xl font-bold text-coop-900 mt-1">{linhasTabela.length}</p>
        </div>
        <div className="card border-l-4 border-coop-500">
          <p className="text-xs uppercase tracking-wide text-coop-600">Total de horas do mês</p>
          <p className="text-2xl font-bold text-coop-900 mt-1">{formatDuration(totalMinutosMes)}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-coop-900">Pontos registrados</h3>
            <p className="text-xs text-gray-600 mt-1">Profissional, entrada, saída e total do dia.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary inline-flex items-center gap-2"
              disabled={isLoading || linhasTabela.length === 0}
              onClick={exportExcel}
            >
              Exportar Excel
            </button>
            <button
              type="button"
              className="btn btn-primary inline-flex items-center gap-2"
              disabled={isLoading || linhasTabela.length === 0}
              onClick={exportPdf}
            >
              Emitir PDF
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-coop-700">Carregando registros...</p>
        ) : linhasTabela.length === 0 ? (
          <p className="text-sm text-coop-700">Nenhum ponto encontrado para os filtros selecionados.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-coop-700 border-b">
                    <th className="py-2 pr-4">Profissional</th>
                    <th className="py-2 pr-4">Hora da entrada</th>
                    <th className="py-2 pr-4">Hora da saída</th>
                    <th className="py-2 pr-4">Situação na entrada</th>
                    <th className="py-2 pr-4">Total de horas do dia</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasTabela.map((row) => (
                    <tr key={row.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 font-medium text-coop-900">{row.profissional}</td>
                      <td className="py-2 pr-4 text-coop-900">{row.entrada}</td>
                      <td className="py-2 pr-4 text-coop-900">{row.saida}</td>
                      <td className="py-2 pr-4 text-coop-900">
                        {row.atrasado ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
                            Atrasado ({row.minutosAtraso} min)
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
                            No horário
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-coop-900">{formatDuration(row.minutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 border-t border-coop-200 pt-3 flex items-center justify-end">
              <p className="text-sm font-semibold text-coop-900">
                Total de horas do mês: <span className="text-coop-700">{formatDuration(totalMinutosMes)}</span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RelatoriosPontoEletronico;
