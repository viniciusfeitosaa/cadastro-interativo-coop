import { prisma } from '../config/database';
import {
  duracaoPlantaoHorasUtc,
  instanteDentroDaJanelaPlantaoUtc,
  scheduleFromLegacyGradeId,
  scheduleFromTipoRow,
} from '../utils/plantao-horario';
import { isMissingDatabaseColumnError } from '../utils/prisma-column-error';
import { resolveProducaoMedicoNaEscala } from '../utils/producao-subgrupo.util';

const round2 = (n: number) => Math.round(n * 100) / 100;

function inferLegacyGradeFromCheckIn(d: Date): 'mt' | 'sn' {
  const h = d.getHours();
  return h >= 7 && h < 19 ? 'mt' : 'sn';
}

type PlantaoRow = {
  escalaId: string;
  medicoId: string;
  data: Date;
  gradeId: string;
  valorHora: unknown;
  horasTurnoSnapshot?: unknown;
};

/**
 * Calcula o valor de repasse (escala + ponto) no fechamento do ponto, alinhado à regra do relatório naquele
 * instante, para gravar em repasseValorCongelado — alterações futuras em tipos/valores não mudam o histórico.
 */
export async function calcularRepasseCongeladoCheckout(
  tenantId: string,
  input: {
    escalaId: string;
    medicoId: string;
    checkInAt: Date;
    duracaoMinutos: number;
  }
): Promise<number | null> {
  const { escalaId, medicoId, checkInAt, duracaoMinutos } = input;
  if (duracaoMinutos <= 0) return null;

  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId },
    select: {
      contratoAtivo: { select: { id: true } },
    },
  });
  const c = escala?.contratoAtivo;
  if (!c?.id) return null;

  const prod = await resolveProducaoMedicoNaEscala(tenantId, medicoId, escalaId);
  if (!prod.allowPonto || !prod.requireJanelaPlantao) return null;

  const aloc = await prisma.escalaMedico.findFirst({
    where: { tenantId, escalaId, medicoId },
    select: { valorHora: true },
  });
  const vhAloc = aloc?.valorHora != null ? Number(aloc.valorHora) : NaN;
  if (Number.isFinite(vhAloc) && vhAloc > 0) {
    return round2((duracaoMinutos / 60) * vhAloc);
  }

  const tipos = await prisma.tipoPlantao.findMany({
    where: { tenantId, contratoAtivoId: c.id },
    select: { id: true, horaInicio: true, horaFim: true, cruzaMeiaNoite: true },
  });
  const tipoScheduleByGradeId = new Map(tipos.map((t) => [t.id, scheduleFromTipoRow(t)] as const));
  const scheduleForPlantaoGrade = (gradeId: string) => {
    const fromTipo = tipoScheduleByGradeId.get(gradeId);
    if (fromTipo) return fromTipo;
    return scheduleFromLegacyGradeId(gradeId);
  };

  const horasTurnoPorGradeId: Record<string, number> = { mt: 12, sn: 12 };
  for (const t of tipos) {
    const sch = scheduleFromTipoRow(t);
    horasTurnoPorGradeId[String(t.id).toLowerCase()] =
      Math.round(duracaoPlantaoHorasUtc(sch) * 10000) / 10000;
  }

  const d0 = new Date(checkInAt);
  d0.setHours(0, 0, 0, 0);
  const d1 = new Date(checkInAt);
  d1.setHours(23, 59, 59, 999);

  const plantaoSelectBase = {
    escalaId: true,
    medicoId: true,
    data: true,
    gradeId: true,
    valorHora: true,
  } as const;
  let plantoes: PlantaoRow[];
  try {
    plantoes = (await prisma.escalaPlantao.findMany({
      where: {
        tenantId,
        escalaId,
        medicoId,
        data: { gte: d0, lte: d1 },
      },
      select: { ...plantaoSelectBase, horasTurnoSnapshot: true } as any,
    })) as unknown as PlantaoRow[];
  } catch (e) {
    if (isMissingDatabaseColumnError(e, 'horas_turno_snapshot')) {
      plantoes = (await prisma.escalaPlantao.findMany({
        where: {
          tenantId,
          escalaId,
          medicoId,
          data: { gte: d0, lte: d1 },
        },
        select: { ...plantaoSelectBase },
      })) as unknown as PlantaoRow[];
    } else {
      throw e;
    }
  }

  if (plantoes.length === 0) return null;

  const matches = plantoes.filter((p) =>
    instanteDentroDaJanelaPlantaoUtc(checkInAt, p.data, scheduleForPlantaoGrade(p.gradeId))
  );

  let chosen: PlantaoRow | null = null;
  if (matches.length === 1) {
    chosen = matches[0];
  } else if (matches.length > 1) {
    chosen = [...matches].sort((a, b) => {
      const da = duracaoPlantaoHorasUtc(scheduleForPlantaoGrade(a.gradeId));
      const db = duracaoPlantaoHorasUtc(scheduleForPlantaoGrade(b.gradeId));
      if (da !== db) return da - db;
      return a.gradeId.localeCompare(b.gradeId);
    })[0];
  } else if (plantoes.length === 1) {
    chosen = plantoes[0];
  } else {
    const leg = inferLegacyGradeFromCheckIn(checkInAt);
    const legacyHits = plantoes.filter((p) => String(p.gradeId).toLowerCase() === leg);
    chosen = legacyHits.length === 1 ? legacyHits[0] : null;
  }

  if (!chosen) return null;

  const gk = String(chosen.gradeId).toLowerCase();
  const snapH = chosen.horasTurnoSnapshot != null ? Number(chosen.horasTurnoSnapshot) : NaN;
  const horasDivisor = (() => {
    if (Number.isFinite(snapH) && snapH > 0) return snapH;
    const h = horasTurnoPorGradeId[gk];
    if (Number.isFinite(h) && h > 0) return h;
    return Math.round(duracaoPlantaoHorasUtc(scheduleForPlantaoGrade(chosen.gradeId)) * 10000) / 10000;
  })();
  if (!(horasDivisor > 0)) return null;

  let total12h: number | null = null;
  const vPl = chosen.valorHora != null ? Number(chosen.valorHora) : NaN;
  if (Number.isFinite(vPl) && vPl > 0) {
    total12h = vPl;
  } else {
    const vals = await prisma.valorPlantao.findMany({
      where: {
        tenantId,
        contratoAtivoId: c.id,
        gradeId: chosen.gradeId,
      },
      select: { valorHora: true },
    });
    for (const row of vals) {
      if (row.valorHora == null) continue;
      const n = Number(row.valorHora);
      if (Number.isFinite(n) && n > 0) {
        total12h = total12h == null ? n : Math.max(total12h, n);
      }
    }
    if (total12h == null) {
      const leg = inferLegacyGradeFromCheckIn(checkInAt);
      const valsLeg = await prisma.valorPlantao.findMany({
        where: {
          tenantId,
          contratoAtivoId: c.id,
          gradeId: { in: [leg, leg.toUpperCase()] },
        },
        select: { valorHora: true },
      });
      for (const row of valsLeg) {
        if (row.valorHora == null) continue;
        const n = Number(row.valorHora);
        if (Number.isFinite(n) && n > 0) {
          total12h = total12h == null ? n : Math.max(total12h, n);
        }
      }
    }
  }

  if (total12h == null || total12h <= 0) return null;

  return round2(total12h * (duracaoMinutos / 60 / horasDivisor));
}

/**
 * Duração do turno (h) para gravar no slot ao criar/atualizar plantão — congelada no registro do dia.
 */
export async function resolverHorasTurnoSnapshotParaGrade(
  tenantId: string,
  contratoAtivoId: string,
  gradeId: string
): Promise<number | null> {
  const tipos = await prisma.tipoPlantao.findMany({
    where: { tenantId, contratoAtivoId },
    select: { id: true, horaInicio: true, horaFim: true, cruzaMeiaNoite: true },
  });
  const tipoScheduleByGradeId = new Map(tipos.map((t) => [t.id, scheduleFromTipoRow(t)] as const));
  const scheduleForPlantaoGrade = (g: string) => {
    const fromTipo = tipoScheduleByGradeId.get(g);
    if (fromTipo) return fromTipo;
    return scheduleFromLegacyGradeId(g);
  };
  const gk = String(gradeId).toLowerCase();
  const horasTurnoPorGradeId: Record<string, number> = { mt: 12, sn: 12 };
  for (const t of tipos) {
    const sch = scheduleFromTipoRow(t);
    horasTurnoPorGradeId[String(t.id).toLowerCase()] =
      Math.round(duracaoPlantaoHorasUtc(sch) * 10000) / 10000;
  }
  const h = horasTurnoPorGradeId[gk];
  if (Number.isFinite(h) && h > 0) return h;
  const computed = Math.round(duracaoPlantaoHorasUtc(scheduleForPlantaoGrade(gradeId)) * 10000) / 10000;
  return computed > 0 ? computed : null;
}
