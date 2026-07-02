/** Regras de início/fim de plantão para troca de turno e exibição (timezone local do servidor/cliente na string YYYY-MM-DD). */

export type PlantaoSchedule = {
  horaInicioMin: number;
  horaFimMin: number;
  cruzaMeiaNoite: boolean;
};

const LEGACY_MT = { horaInicioMin: 7 * 60, horaFimMin: 19 * 60, cruzaMeiaNoite: false };
const LEGACY_SN = { horaInicioMin: 19 * 60, horaFimMin: 7 * 60, cruzaMeiaNoite: true };

export function scheduleFromLegacyGradeId(gradeId: string): PlantaoSchedule {
  const g = (gradeId || '').toLowerCase();
  if (g === 'sn') return { ...LEGACY_SN };
  return { ...LEGACY_MT };
}

export function parseHmToMinutes(s: string): number | null {
  const m = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/.exec((s || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h * 60 + min;
}

export function scheduleFromTipoRow(row: {
  horaInicio: string;
  horaFim: string;
  cruzaMeiaNoite: boolean;
}): PlantaoSchedule {
  const hi = parseHmToMinutes(row.horaInicio);
  const hf = parseHmToMinutes(row.horaFim);
  if (hi == null || hf == null) return { ...LEGACY_MT };
  let cruza = row.cruzaMeiaNoite;
  if (hi === hf) return { ...LEGACY_MT };
  if (!cruza && hf <= hi) cruza = true;
  return { horaInicioMin: hi, horaFimMin: hf, cruzaMeiaNoite: cruza };
}

export function inferCruzaMeiaNoite(horaInicio: string, horaFim: string, explicit?: boolean): boolean {
  if (explicit === true || explicit === false) return explicit;
  const hi = parseHmToMinutes(horaInicio);
  const hf = parseHmToMinutes(horaFim);
  if (hi == null || hf == null) return false;
  if (hi === hf) return false;
  return hf <= hi;
}

export function inicioPlantaoAsDate(dataStr: string, s: PlantaoSchedule): Date {
  const d = new Date(`${dataStr}T00:00:00`);
  const h = Math.floor(s.horaInicioMin / 60);
  const m = s.horaInicioMin % 60;
  d.setHours(h, m, 0, 0);
  return d;
}

export function fimPlantaoAsDate(dataStr: string, s: PlantaoSchedule): Date {
  const d = new Date(`${dataStr}T00:00:00`);
  if (s.cruzaMeiaNoite) {
    d.setDate(d.getDate() + 1);
  }
  const h = Math.floor(s.horaFimMin / 60);
  const m = s.horaFimMin % 60;
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Verifica se o instante do check-in cai na janela [início, fim) do plantão,
 * usando a data do slot em UTC (alinhado a @db.Date + timestamptz do registro).
 */
export function instanteDentroDaJanelaPlantaoUtc(
  instante: Date,
  dataPlantaoUtcDate: Date,
  s: PlantaoSchedule
): boolean {
  const y = dataPlantaoUtcDate.getUTCFullYear();
  const mo = dataPlantaoUtcDate.getUTCMonth();
  const d = dataPlantaoUtcDate.getUTCDate();
  const hi = s.horaInicioMin;
  const hf = s.horaFimMin;
  const start = Date.UTC(y, mo, d, Math.floor(hi / 60), hi % 60, 0, 0);
  const end = s.cruzaMeiaNoite
    ? Date.UTC(y, mo, d + 1, Math.floor(hf / 60), hf % 60, 0, 0)
    : Date.UTC(y, mo, d, Math.floor(hf / 60), hf % 60, 0, 0);
  const t = instante.getTime();
  if (!(end > start)) return false;
  return t >= start && t < end;
}

/**
 * Duração do turno em horas (fração decimal), mesma geometria UTC da janela do plantão.
 * Usado para converter "valor total do turno" em valor/hora no faturamento.
 */
export function duracaoPlantaoHorasUtc(s: PlantaoSchedule): number {
  const y = 2020;
  const mo = 5;
  const d = 10;
  const start = Date.UTC(y, mo, d, Math.floor(s.horaInicioMin / 60), s.horaInicioMin % 60, 0, 0);
  const end = s.cruzaMeiaNoite
    ? Date.UTC(y, mo, d + 1, Math.floor(s.horaFimMin / 60), s.horaFimMin % 60, 0, 0)
    : Date.UTC(y, mo, d, Math.floor(s.horaFimMin / 60), s.horaFimMin % 60, 0, 0);
  const ms = end - start;
  if (!(ms > 0)) return 12;
  return ms / 3600000;
}

/** Rótulo curto tipo "07h–19h" ou "19h–07h". */
export function faixaHorarioCurta(row: {
  horaInicio: string;
  horaFim: string;
  cruzaMeiaNoite: boolean;
}): string {
  const hi = (row.horaInicio || '').slice(0, 5);
  const hf = (row.horaFim || '').slice(0, 5);
  const fmt = (x: string) => {
    const [h, m] = x.split(':');
    return m === '00' ? `${Number(h)}h` : `${h}h${m}`;
  };
  return `${fmt(hi)}–${fmt(hf)}`;
}

/** Ex.: "07h às 19h" ou "19h às 07h". */
export function faixaHorarioLabelExibicao(
  gradeId: string,
  tipo?: { horaInicio: string; horaFim: string } | null
): string {
  if (tipo?.horaInicio && tipo?.horaFim) {
    const fmt = (s: string) => {
      const [h, m] = s.slice(0, 5).split(':').map((x) => Number(x));
      if (Number.isNaN(h)) return s;
      if (m === 0) return `${h}h`;
      return `${h}h${String(m).padStart(2, '0')}`;
    };
    return `${fmt(tipo.horaInicio)} às ${fmt(tipo.horaFim)}`;
  }
  const g = (gradeId || '').toLowerCase();
  if (g === 'sn') return '19h às 07h';
  return '07h às 19h';
}
