import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pontoService } from '../services/ponto.service';

const formatMonthInput = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatDateTime = (iso: string | null | undefined) => {
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

const formatDuration = (minutes: number | null | undefined) => {
  const total = Math.max(0, Number(minutes ?? 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
};

const formatCurrency = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const HistoricoPontos = () => {
  const [mesRef, setMesRef] = useState(() => formatMonthInput(new Date()));
  const [ano, mes] = useMemo(() => {
    const [y, m] = mesRef.split('-').map(Number);
    return [y, m];
  }, [mesRef]);

  const { data, isLoading } = useQuery({
    queryKey: ['ponto', 'historico', ano, mes],
    queryFn: () => pontoService.getHistorico({ ano, mes }),
    enabled: !!ano && !!mes,
  });

  const payload = data?.data;
  const registros = payload?.registros ?? [];

  return (
    <div className="space-y-6">
      <div className="card dashboard-hero py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-coop-600 mb-2 font-display">
          Ponto eletrônico
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-coop-900 font-display leading-tight mb-2">
          Histórico de pontos e valores
        </h1>
        <p className="text-coop-700 font-serif text-base">
          Veja seus registros por mês e o acumulado de valor previsto.
        </p>
      </div>

      <div className="card">
        <label htmlFor="mesRefHistorico" className="block text-sm font-semibold text-coop-800 mb-1">
          Mês de referência
        </label>
        <input
          id="mesRefHistorico"
          type="month"
          className="input max-w-xs"
          value={mesRef}
          onChange={(e) => setMesRef(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-coop-600">Registros no mês</p>
          <p className="text-2xl font-bold text-coop-900 mt-1">{payload?.totalRegistros ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-coop-600">Total de horas</p>
          <p className="text-2xl font-bold text-coop-900 mt-1">{formatDuration(payload?.totalMinutos ?? 0)}</p>
        </div>
        <div className="card border-l-4 border-coop-500">
          <p className="text-xs uppercase tracking-wide text-coop-600">Valor acumulado do mês</p>
          <p className="text-2xl font-bold text-coop-900 mt-1">{formatCurrency(payload?.totalValor)}</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-coop-900">Registros do mês</h2>
          <p className="text-xs text-coop-600 mt-1">
            O valor considera a mesma base de cálculo exibida ao Master.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-coop-700">Carregando histórico...</p>
        ) : registros.length === 0 ? (
          <p className="text-sm text-coop-700">Nenhum registro encontrado para este mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-coop-700 border-b">
                  <th className="py-2 pr-4">Escala</th>
                  <th className="py-2 pr-4">Equipe</th>
                  <th className="py-2 pr-4">Entrada</th>
                  <th className="py-2 pr-4">Saída</th>
                  <th className="py-2 pr-4">Situação</th>
                  <th className="py-2 pr-4">Horas</th>
                  <th className="py-2 pr-4">Valor</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 text-coop-900 font-medium">{r.escala?.nome ?? 'Ponto sem escala'}</td>
                    <td className="py-2 pr-4 text-coop-900">{r.equipe ?? '—'}</td>
                    <td className="py-2 pr-4 text-coop-900">{formatDateTime(r.checkInAt)}</td>
                    <td className="py-2 pr-4 text-coop-900">{formatDateTime(r.checkOutAt)}</td>
                    <td className="py-2 pr-4">
                      {r.checkInAtrasado ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
                          Atrasado ({r.minutosAtrasoCheckin ?? 0} min)
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
                          No horário
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-coop-900">{formatDuration(r.duracaoMinutos)}</td>
                    <td className="py-2 pr-4 text-coop-900 font-semibold">{formatCurrency(r.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricoPontos;
