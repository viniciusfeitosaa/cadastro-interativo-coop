/** Agenda de plantão no cliente: usa metadados da API quando existem; fallback MT/SN. */

export type PlantaoAgendaInput = {
  gradeId: string;
  horaInicio?: string | null;
  horaFim?: string | null;
  cruzaMeiaNoite?: boolean | null;
  faixaHorario?: string | null;
};

export function inicioPlantaoCliente(dataStr: string, p: PlantaoAgendaInput): Date {
  const d = new Date(`${dataStr}T00:00:00`);
  if (p.horaInicio) {
    const [h, m] = p.horaInicio.slice(0, 5).split(':').map((x) => Number(x));
    if (!Number.isNaN(h)) d.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
    return d;
  }
  const g = (p.gradeId || '').toLowerCase();
  if (g === 'sn') {
    d.setHours(19, 0, 0, 0);
    return d;
  }
  d.setHours(7, 0, 0, 0);
  return d;
}

export function fimPlantaoCliente(dataStr: string, p: PlantaoAgendaInput): Date {
  let cruza = p.cruzaMeiaNoite === true;
  if (p.cruzaMeiaNoite !== true && p.cruzaMeiaNoite !== false && p.horaInicio && p.horaFim) {
    const [hi, mi] = p.horaInicio.slice(0, 5).split(':').map((x) => Number(x));
    const [hf, mf] = p.horaFim.slice(0, 5).split(':').map((x) => Number(x));
    if (!Number.isNaN(hi) && !Number.isNaN(hf)) {
      cruza = hf * 60 + (Number.isNaN(mf) ? 0 : mf) <= hi * 60 + (Number.isNaN(mi) ? 0 : mi);
    }
  }
  if (p.cruzaMeiaNoite === false) cruza = false;

  const d = new Date(`${dataStr}T00:00:00`);
  if (cruza) {
    d.setDate(d.getDate() + 1);
  }
  if (p.horaFim) {
    const [h, m] = p.horaFim.slice(0, 5).split(':').map((x) => Number(x));
    if (!Number.isNaN(h)) d.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
    return d;
  }
  const g = (p.gradeId || '').toLowerCase();
  if (g === 'sn') {
    const next = new Date(`${dataStr}T00:00:00`);
    next.setDate(next.getDate() + 1);
    next.setHours(7, 0, 0, 0);
    return next;
  }
  d.setHours(19, 0, 0, 0);
  return d;
}

export function faixaExibicaoPlantao(p: PlantaoAgendaInput): string {
  if (p.faixaHorario) return p.faixaHorario;
  const g = (p.gradeId || '').toLowerCase();
  if (g === 'sn') return '19h às 07h';
  return '07h às 19h';
}

export function rotuloCurtoTipo(p: { tipoNome?: string | null; gradeId: string }): string {
  const n = (p.tipoNome || '').trim();
  if (n.length >= 2) {
    const words = n.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  return (p.gradeId || '').toLowerCase() === 'sn' ? 'SN' : 'MT';
}

export function plantaoChipClassesFromOrdem(p: { tipoOrdem?: number | null; gradeId: string }): string {
  const ord = p.tipoOrdem != null ? p.tipoOrdem : (p.gradeId || '').toLowerCase() === 'sn' ? 1 : 0;
  return ord % 2 === 1
    ? 'bg-coop-200/60 text-coop-950 border-coop-400/50'
    : 'bg-coop-100/95 text-coop-900 border-coop-200/80';
}
