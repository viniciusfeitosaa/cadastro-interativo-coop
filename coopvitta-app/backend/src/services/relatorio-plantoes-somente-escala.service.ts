import { prisma } from '../config/database';
import {
  duracaoPlantaoHorasUtc,
  scheduleFromLegacyGradeId,
  scheduleFromTipoRow,
} from '../utils/plantao-horario';
import {
  calcularTotaisPlantaoSomenteEscala,
  diaKeyFromDateUtc,
  type CadastroValorPlantao,
} from '../utils/valor-plantao-dia.util';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type RelatorioPlantaoSomenteEscalaItem = {
  id: string;
  data: string;
  gradeId: string;
  horasTurno: number;
  duracaoMinutos: number;
  medico: { id: string; nomeCompleto: string };
  escala: { id: string; nome: string; contratoAtivoId: string };
  subgrupoId: string | null;
  equipeId: string | null;
  valorHoraRepasse: number | null;
  valorHoraCobranca: number | null;
  adicionalPercentual: number;
  valorRepasse: number | null;
  valorCobranca: number | null;
  resumo: string;
};

export type RelatorioPlantaoSomenteEscalaResult = {
  itens: RelatorioPlantaoSomenteEscalaItem[];
  totais: { minutos: number; plantoes: number; repasse: number | null; cobranca: number | null };
};

function parseDateOnlyUtc(s?: string): Date | undefined {
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function ymdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function escolherValorPlantaoRow<
  T extends { contratoAtivoId: string; subgrupoId: string; equipeId: string | null; gradeId: string },
>(
  rows: T[],
  keys: { contratoAtivoId: string; subgrupoId: string; equipeId: string | null; gradeId: string }
): T | null {
  const same = rows.filter(
    (r) =>
      r.contratoAtivoId === keys.contratoAtivoId &&
      r.subgrupoId === keys.subgrupoId &&
      r.gradeId === keys.gradeId
  );
  if (keys.equipeId) {
    const eq = same.find((r) => r.equipeId === keys.equipeId);
    if (eq) return eq;
  }
  return same.find((r) => r.equipeId == null) ?? null;
}

function escalaEhSomenteEscala(
  equipes: Array<{ id: string; subgrupoId: string | null; usaEscala: boolean; usaPonto: boolean }>
): boolean {
  if (equipes.length === 0) return false;
  return equipes.every((e) => e.usaEscala && !e.usaPonto);
}

/**
 * Plantões alocados em escalas cuja produção é somente escala (usaEscala e não usaPonto).
 * Fonte do relatório financeiro quando não há RegistroPonto.
 */
export async function listPlantoesSomenteEscalaRelatorioService(
  tenantId: string,
  filters: {
    contratoAtivoId?: string;
    subgrupoId?: string;
    equipeId?: string;
    dataInicio?: string;
    dataFim?: string;
  }
): Promise<RelatorioPlantaoSomenteEscalaResult> {
  const dataInicio = parseDateOnlyUtc(filters.dataInicio);
  const dataFim = parseDateOnlyUtc(filters.dataFim);

  const links = await prisma.escalaEquipe.findMany({
    where: {
      tenantId,
      ...(filters.equipeId ? { equipeId: filters.equipeId } : {}),
      escala: {
        tenantId,
        ativo: true,
        ...(filters.contratoAtivoId ? { contratoAtivoId: filters.contratoAtivoId } : {}),
      },
    },
    select: {
      escalaId: true,
      equipeId: true,
      escala: { select: { id: true, nome: true, contratoAtivoId: true, ativo: true } },
      equipe: {
        select: {
          id: true,
          subgrupoId: true,
          subgrupo: { select: { usaEscala: true, usaPonto: true } },
        },
      },
    },
  });

  type EscMeta = {
    id: string;
    nome: string;
    contratoAtivoId: string;
    equipes: Array<{ id: string; subgrupoId: string | null; usaEscala: boolean; usaPonto: boolean }>;
  };
  const porEscala = new Map<string, EscMeta>();
  for (const row of links) {
    const sg = row.equipe.subgrupo;
    const eq = {
      id: row.equipe.id,
      subgrupoId: row.equipe.subgrupoId,
      usaEscala: sg?.usaEscala === true,
      usaPonto: sg?.usaPonto === true,
    };
    if (filters.subgrupoId && eq.subgrupoId !== filters.subgrupoId) continue;
    const prev = porEscala.get(row.escalaId);
    if (prev) {
      prev.equipes.push(eq);
    } else {
      porEscala.set(row.escalaId, {
        id: row.escala.id,
        nome: row.escala.nome,
        contratoAtivoId: row.escala.contratoAtivoId,
        equipes: [eq],
      });
    }
  }

  const escalasOk = [...porEscala.values()].filter((e) => escalaEhSomenteEscala(e.equipes));
  const escalaIds = escalasOk.map((e) => e.id);
  if (escalaIds.length === 0) {
    return { itens: [], totais: { minutos: 0, plantoes: 0, repasse: null, cobranca: null } };
  }

  const whereData: { gte?: Date; lte?: Date } = {};
  if (dataInicio) whereData.gte = dataInicio;
  if (dataFim) whereData.lte = dataFim;

  const plantoes = await prisma.escalaPlantao.findMany({
    where: {
      tenantId,
      escalaId: { in: escalaIds },
      ...(Object.keys(whereData).length > 0 ? { data: whereData } : {}),
    },
    select: {
      id: true,
      data: true,
      gradeId: true,
      medicoId: true,
      escalaId: true,
      horasTurnoSnapshot: true,
      medico: { select: { id: true, nomeCompleto: true } },
    },
    orderBy: [{ data: 'asc' }, { gradeId: 'asc' }, { medicoId: 'asc' }],
  });

  if (plantoes.length === 0) {
    return { itens: [], totais: { minutos: 0, plantoes: 0, repasse: null, cobranca: null } };
  }

  const contratoIds = [...new Set(escalasOk.map((e) => e.contratoAtivoId))];
  const [tipos, valores, adicionais, alocacoes] = await Promise.all([
    prisma.tipoPlantao.findMany({
      where: { tenantId, contratoAtivoId: { in: contratoIds } },
      select: { id: true, contratoAtivoId: true, horaInicio: true, horaFim: true, cruzaMeiaNoite: true },
    }),
    prisma.valorPlantao.findMany({
      where: { tenantId, contratoAtivoId: { in: contratoIds } },
      select: {
        contratoAtivoId: true,
        subgrupoId: true,
        equipeId: true,
        gradeId: true,
        valorHora: true,
        valorHoraCobranca: true,
        valorHoraPorDia: true,
        valorHoraCobrancaPorDia: true,
      },
    }),
    prisma.adicionalPlantaoData.findMany({
      where: {
        tenantId,
        contratoAtivoId: { in: contratoIds },
        ...(Object.keys(whereData).length > 0 ? { data: whereData } : {}),
      },
      select: { contratoAtivoId: true, data: true, gradeId: true, percentual: true },
    }),
    prisma.escalaMedico.findMany({
      where: { tenantId, escalaId: { in: escalaIds } },
      select: { escalaId: true, medicoId: true, valorHora: true },
    }),
  ]);

  const horasPorContratoGrade = new Map<string, number>();
  for (const t of tipos) {
    const sch = scheduleFromTipoRow(t);
    horasPorContratoGrade.set(
      `${t.contratoAtivoId}::${String(t.id).toLowerCase()}`,
      Math.round(duracaoPlantaoHorasUtc(sch) * 10000) / 10000
    );
  }

  const adicionalMap = new Map<string, number>();
  for (const a of adicionais) {
    const pct = Number(a.percentual);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    adicionalMap.set(`${a.contratoAtivoId}::${ymdUtc(a.data)}::${String(a.gradeId).toLowerCase()}`, pct);
  }

  const alocMap = new Map<string, number>();
  for (const a of alocacoes) {
    if (a.valorHora == null) continue;
    const n = Number(a.valorHora);
    if (Number.isFinite(n) && n > 0) alocMap.set(`${a.escalaId}::${a.medicoId}`, n);
  }

  const itens: RelatorioPlantaoSomenteEscalaItem[] = [];
  for (const p of plantoes) {
    const esc = porEscala.get(p.escalaId);
    if (!esc || !escalaEhSomenteEscala(esc.equipes)) continue;
    const equipe =
      (filters.equipeId ? esc.equipes.find((e) => e.id === filters.equipeId) : null) ?? esc.equipes[0] ?? null;
    const subgrupoId = equipe?.subgrupoId ?? null;
    const equipeId = equipe?.id ?? null;
    const dia = diaKeyFromDateUtc(p.data instanceof Date ? p.data : new Date(p.data));
    const dataStr = ymdUtc(p.data instanceof Date ? p.data : new Date(p.data));
    const gk = String(p.gradeId).toLowerCase();
    const snapH = p.horasTurnoSnapshot != null ? Number(p.horasTurnoSnapshot) : NaN;
    let horasTurno = Number.isFinite(snapH) && snapH > 0 ? snapH : 0;
    if (!(horasTurno > 0)) {
      horasTurno =
        horasPorContratoGrade.get(`${esc.contratoAtivoId}::${gk}`) ??
        duracaoPlantaoHorasUtc(scheduleFromLegacyGradeId(p.gradeId));
    }
    const cadRow =
      subgrupoId
        ? escolherValorPlantaoRow(valores, {
            contratoAtivoId: esc.contratoAtivoId,
            subgrupoId,
            equipeId,
            gradeId: p.gradeId,
          })
        : null;
    const cadastro: CadastroValorPlantao | null = cadRow
      ? {
          valorHora: cadRow.valorHora,
          valorHoraCobranca: cadRow.valorHoraCobranca,
          valorHoraPorDia: cadRow.valorHoraPorDia,
          valorHoraCobrancaPorDia: cadRow.valorHoraCobrancaPorDia,
        }
      : null;
    const adicionalPercentual =
      adicionalMap.get(`${esc.contratoAtivoId}::${dataStr}::${gk}`) ?? 0;
    const calc = calcularTotaisPlantaoSomenteEscala({
      horasTurno,
      dia,
      cadastro,
      valorHoraAlocacao: alocMap.get(`${p.escalaId}::${p.medicoId}`) ?? null,
      adicionalPercentual,
    });
    const resumo =
      calc.valorRepasse != null || calc.valorCobranca != null
        ? `Plantão ${dataStr}: ${calc.horasTurno.toFixed(2)} h × ` +
          `repasse ${calc.valorHoraRepasse != null ? calc.valorHoraRepasse.toFixed(2) : '—'}/h, ` +
          `cobrança ${calc.valorHoraCobranca != null ? calc.valorHoraCobranca.toFixed(2) : '—'}/h` +
          (adicionalPercentual > 0 ? ` + adicional ${adicionalPercentual}%` : '') +
          '.'
        : `Plantão ${dataStr}: ${calc.horasTurno.toFixed(2)} h sem valor cadastrado.`;

    itens.push({
      id: p.id,
      data: dataStr,
      gradeId: p.gradeId,
      horasTurno: calc.horasTurno,
      duracaoMinutos: calc.duracaoMinutos,
      medico: { id: p.medico.id, nomeCompleto: p.medico.nomeCompleto },
      escala: { id: esc.id, nome: esc.nome, contratoAtivoId: esc.contratoAtivoId },
      subgrupoId,
      equipeId,
      valorHoraRepasse: calc.valorHoraRepasse,
      valorHoraCobranca: calc.valorHoraCobranca,
      adicionalPercentual: calc.adicionalPercentual,
      valorRepasse: calc.valorRepasse,
      valorCobranca: calc.valorCobranca,
      resumo,
    });
  }

  let minutos = 0;
  let repasse: number | null = null;
  let cobranca: number | null = null;
  for (const it of itens) {
    minutos += it.duracaoMinutos;
    if (it.valorRepasse != null) repasse = round2((repasse ?? 0) + it.valorRepasse);
    if (it.valorCobranca != null) cobranca = round2((cobranca ?? 0) + it.valorCobranca);
  }

  return {
    itens,
    totais: { minutos, plantoes: itens.length, repasse, cobranca },
  };
}
