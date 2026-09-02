export type DiaSemanaKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** `Date` de coluna DATE (meia-noite UTC) — usa UTC para não virar o dia anterior no Brasil. */
export function diaKeyFromDateUtc(d: Date): DiaSemanaKey {
  switch (d.getUTCDay()) {
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
    case 6:
      return 'sab';
    default:
      return 'dom';
  }
}

export function pickRatePorDia(
  porDia: Record<string, unknown> | null | undefined,
  dia: DiaSemanaKey,
  fallbackGlobal: number | null | undefined
): number | null {
  const raw = porDia?.[dia];
  const n = raw != null && raw !== '' ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  const g = fallbackGlobal != null ? Number(fallbackGlobal) : NaN;
  if (Number.isFinite(g) && g > 0) return g;
  return null;
}

export type CadastroValorPlantao = {
  valorHora?: unknown;
  valorHoraCobranca?: unknown;
  valorHoraPorDia?: unknown;
  valorHoraCobrancaPorDia?: unknown;
};

export function ratesDoCadastroNoDia(
  cad: CadastroValorPlantao | null | undefined,
  dia: DiaSemanaKey
): { repasse: number | null; cobranca: number | null } {
  if (!cad) return { repasse: null, cobranca: null };
  const porDiaRep = (cad.valorHoraPorDia ?? {}) as Record<string, unknown>;
  const porDiaCob = (cad.valorHoraCobrancaPorDia ?? {}) as Record<string, unknown>;
  const gRep = cad.valorHora != null ? Number(cad.valorHora) : null;
  const gCob = cad.valorHoraCobranca != null ? Number(cad.valorHoraCobranca) : null;
  return {
    repasse: pickRatePorDia(porDiaRep, dia, Number.isFinite(gRep as number) ? gRep : null),
    cobranca: pickRatePorDia(porDiaCob, dia, Number.isFinite(gCob as number) ? gCob : null),
  };
}

/**
 * Totais de um plantão na modalidade somente escala (sem ponto):
 * horas previstas × R$/h do cadastro (dia da semana) × (1 + adicional%).
 * `valorHoraAlocacao` (EscalaMedico) tem prioridade no repasse, como no relatório com ponto.
 */
export function calcularTotaisPlantaoSomenteEscala(input: {
  horasTurno: number;
  dia: DiaSemanaKey;
  cadastro: CadastroValorPlantao | null;
  valorHoraAlocacao?: number | null;
  adicionalPercentual?: number | null;
}): {
  horasTurno: number;
  duracaoMinutos: number;
  valorHoraRepasse: number | null;
  valorHoraCobranca: number | null;
  adicionalPercentual: number;
  valorRepasse: number | null;
  valorCobranca: number | null;
} {
  const horas = Number(input.horasTurno);
  const horasOk = Number.isFinite(horas) && horas > 0 ? horas : 0;
  const adicional =
    input.adicionalPercentual != null && Number.isFinite(Number(input.adicionalPercentual))
      ? Math.max(0, Number(input.adicionalPercentual))
      : 0;
  const fator = 1 + adicional / 100;
  const rates = ratesDoCadastroNoDia(input.cadastro, input.dia);
  const vhAloc = input.valorHoraAlocacao != null ? Number(input.valorHoraAlocacao) : NaN;
  const valorHoraRepasse =
    Number.isFinite(vhAloc) && vhAloc > 0 ? vhAloc : rates.repasse;
  const valorHoraCobranca = rates.cobranca;

  const valorRepasse =
    horasOk > 0 && valorHoraRepasse != null ? round2(horasOk * valorHoraRepasse * fator) : null;
  const valorCobranca =
    horasOk > 0 && valorHoraCobranca != null ? round2(horasOk * valorHoraCobranca * fator) : null;

  return {
    horasTurno: horasOk,
    duracaoMinutos: Math.round(horasOk * 60),
    valorHoraRepasse,
    valorHoraCobranca,
    adicionalPercentual: adicional,
    valorRepasse,
    valorCobranca,
  };
}
