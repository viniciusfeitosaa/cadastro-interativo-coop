import { useMemo, useState } from 'react';

type Props = {
  selected: string[];
  onChange: (dates: string[]) => void;
};

const pad = (n: number) => n.toString().padStart(2, '0');

function parseISO(dateStr: string): Date {
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day);
}

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MiniCalendarioDias = ({ selected, onChange }: Props) => {
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();
    const cells: ({ kind: 'empty' } | { kind: 'day'; n: number })[] = [];
    for (let i = 0; i < startPad; i++) cells.push({ kind: 'empty' });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ kind: 'day', n: d });
    while (cells.length % 7 !== 0) cells.push({ kind: 'empty' });
    return cells;
  }, [year, month]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (day: number) => {
    const key = `${year}-${pad(month + 1)}-${pad(day)}`;
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next].sort());
  };

  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));

  const monthLabel = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-2xl border border-coop-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={goPrev}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-coop-800 hover:bg-coop-100"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <span className="text-sm font-bold capitalize text-coop-950 font-display">{monthLabel}</span>
        <button
          type="button"
          onClick={goNext}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-coop-800 hover:bg-coop-100"
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-coop-600 mb-1">
        {weekDays.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, i) => {
          if (cell.kind === 'empty') {
            return <div key={`e-${i}`} className="aspect-square" />;
          }
          const key = `${year}-${pad(month + 1)}-${pad(cell.n)}`;
          const isOn = selectedSet.has(key);
          const isPast = parseISO(key) < new Date(new Date().setHours(0, 0, 0, 0));
          return (
            <button
              key={key}
              type="button"
              disabled={isPast}
              onClick={() => !isPast && toggle(cell.n)}
              className={`aspect-square rounded-xl text-xs font-semibold transition ${
                isPast
                  ? 'cursor-not-allowed text-coop-300 bg-coop-50/50'
                  : isOn
                    ? 'bg-coop-900 text-white shadow-sm'
                    : 'text-coop-800 hover:bg-coop-100'
              }`}
            >
              {cell.n}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-coop-600 font-serif">Toque nos dias em que a cobertura será necessária.</p>
    </div>
  );
};

export default MiniCalendarioDias;
