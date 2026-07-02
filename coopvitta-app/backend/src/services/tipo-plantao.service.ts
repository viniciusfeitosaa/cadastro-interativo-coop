import type { TipoPlantao } from '@prisma/client';
import { prisma } from '../config/database';
import { createAuditLog } from './auditoria.service';
import {
  faixaHorarioCurta,
  faixaHorarioLabelExibicao,
  inferCruzaMeiaNoite,
  parseHmToMinutes,
  scheduleFromLegacyGradeId,
  scheduleFromTipoRow,
  type PlantaoSchedule,
} from '../utils/plantao-horario';

export { faixaHorarioLabelExibicao };

const HORARIO_RE = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export function normalizarHorarioPlantao(v: string | null | undefined): string | null {
  if (v == null || typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (!HORARIO_RE.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function isLegacyGradeId(gradeId: string): boolean {
  const g = (gradeId || '').toLowerCase();
  return g === 'mt' || g === 'sn';
}

/** Par de inteiros para pg_advisory_xact_lock (evita corrida entre requisições paralelas). */
function tiposPlantaoAdvisoryKeys(tenantId: string, contratoAtivoId: string): [number, number] {
  const fold = (s: string, seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
    }
    return h & 0x7fffffff;
  };
  return [fold(tenantId, 0x9e3779b9), fold(contratoAtivoId, 0x85ebca6b)];
}

/** Evita reabrir transação + advisory lock em toda leitura de plantão (dashboard / meu-dia). */
const ENSURE_TIPOS_WARM_MS = Math.max(
  0,
  parseInt(process.env.TIPOS_ENSURE_WARM_MS || '', 10) || 120_000
);
const ensureTiposWarmUntil = new Map<string, number>();

export function invalidateEnsureTiposWarmCache(tenantId: string, contratoAtivoId: string) {
  ensureTiposWarmUntil.delete(`${tenantId}:${contratoAtivoId}`);
}

/** Cache curto por contrato: dashboard/meu-dia chamavam loadTiposMapPorContratoLeitura várias vezes no mesmo request. */
const TIPOS_LEITURA_TTL_MS = Math.max(
  0,
  parseInt(process.env.TIPOS_LEITURA_CACHE_MS || '', 10) || 20_000
);
const tiposLeituraPorContrato = new Map<string, { exp: number; map: Map<string, TipoPlantao> }>();

/** Pedidos paralelos com o mesmo conjunto de contratos (ex.: dashboard) partilham um único findMany. */
const inflightTiposLeituraFetch = new Map<string, Promise<Map<string, Map<string, TipoPlantao>>>>();

export function invalidateTiposLeituraCache(tenantId: string, contratoAtivoId: string) {
  tiposLeituraPorContrato.delete(`${tenantId}:${contratoAtivoId}`);
}

/**
 * Garante tipos padrão MT/SN e migra grade_id legado (mt/sn) para UUIDs do contrato.
 * Idempotente: seguro chamar antes de listar valores ou plantões.
 *
 * Caminho rápido: se já existem tipos e não há grade legada (mt/sn), não abre transação.
 * Cache em memória por contrato reduz trabalho em leituras repetidas (ex.: dashboard).
 */
export async function ensureTiposLegadoMigrados(tenantId: string, contratoAtivoId: string): Promise<void> {
  const cacheKey = `${tenantId}:${contratoAtivoId}`;
  const warmUntil = ensureTiposWarmUntil.get(cacheKey);
  if (warmUntil != null && warmUntil > Date.now()) {
    return;
  }

  const contrato = await prisma.contratoAtivo.findFirst({
    where: { id: contratoAtivoId, tenantId },
    select: { id: true },
  });
  if (!contrato) return;

  const legacyGrades = ['mt', 'sn', 'MT', 'SN'] as const;

  const [tiposCount, nValLeg, nAdLeg] = await Promise.all([
    prisma.tipoPlantao.count({ where: { tenantId, contratoAtivoId } }),
    prisma.valorPlantao.count({
      where: { tenantId, contratoAtivoId, gradeId: { in: [...legacyGrades] } },
    }),
    prisma.adicionalPlantaoData.count({
      where: { tenantId, contratoAtivoId, gradeId: { in: [...legacyGrades] } },
    }),
  ]);

  let nPlLeg = 0;
  if (tiposCount > 0 && nValLeg === 0 && nAdLeg === 0) {
    const escalaIds = await prisma.escala.findMany({
      where: { tenantId, contratoAtivoId },
      select: { id: true },
    });
    if (escalaIds.length > 0) {
      nPlLeg = await prisma.escalaPlantao.count({
        where: {
          tenantId,
          escalaId: { in: escalaIds.map((e) => e.id) },
          gradeId: { in: [...legacyGrades] },
        },
      });
    }
  }

  if (tiposCount > 0 && nValLeg === 0 && nAdLeg === 0 && nPlLeg === 0) {
    ensureTiposWarmUntil.set(cacheKey, Date.now() + ENSURE_TIPOS_WARM_MS);
    return;
  }

  await prisma.$transaction(
    async (tx) => {
    const [lockK1, lockK2] = tiposPlantaoAdvisoryKeys(tenantId, contratoAtivoId);
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
      lockK1,
      lockK2
    );

    let tipos = await tx.tipoPlantao.findMany({
      where: { tenantId, contratoAtivoId },
      orderBy: [{ horaInicio: 'asc' }, { nome: 'asc' }],
    });

    const legacyGradesTx = ['mt', 'sn', 'MT', 'SN'] as const;
    const escalasContrato = await tx.escala.findMany({
      where: { tenantId, contratoAtivoId },
      select: { id: true },
    });
    const escalaIds = escalasContrato.map((e) => e.id);

    const [nValLegTx, nAdLegTx, nPlLegTx] = await Promise.all([
      tx.valorPlantao.count({
        where: { tenantId, contratoAtivoId, gradeId: { in: [...legacyGradesTx] } },
      }),
      tx.adicionalPlantaoData.count({
        where: { tenantId, contratoAtivoId, gradeId: { in: [...legacyGradesTx] } },
      }),
      escalaIds.length
        ? tx.escalaPlantao.count({
            where: { tenantId, escalaId: { in: escalaIds }, gradeId: { in: [...legacyGradesTx] } },
          })
        : Promise.resolve(0),
    ]);
    const aindaTemLegado = nValLegTx + nAdLegTx + nPlLegTx > 0;

    if (tipos.length === 0) {
      const [mt, sn] = await Promise.all([
        tx.tipoPlantao.create({
          data: {
            tenantId,
            contratoAtivoId,
            nome: 'MT – Plantão diurno (07h–19h)',
            horaInicio: '07:00',
            horaFim: '19:00',
            cruzaMeiaNoite: false,
            ordem: 0,
          },
        }),
        tx.tipoPlantao.create({
          data: {
            tenantId,
            contratoAtivoId,
            nome: 'SN – Plantão noturno (19h–07h)',
            horaInicio: '19:00',
            horaFim: '07:00',
            cruzaMeiaNoite: true,
            ordem: 1,
          },
        }),
      ]);
      tipos = [mt, sn];
    }

    let mtTipo = tipos.find(
      (t) => t.horaInicio === '07:00' && t.horaFim === '19:00' && !t.cruzaMeiaNoite
    );
    let snTipo = tipos.find(
      (t) => t.horaInicio === '19:00' && t.horaFim === '07:00' && t.cruzaMeiaNoite
    );

    if (aindaTemLegado) {
      const maxOrd =
        (
          await tx.tipoPlantao.aggregate({
            where: { tenantId, contratoAtivoId },
            _max: { ordem: true },
          })
        )._max.ordem ?? -1;
      let nextOrd = maxOrd + 1;
      if (!mtTipo) {
        mtTipo = await tx.tipoPlantao.create({
          data: {
            tenantId,
            contratoAtivoId,
            nome: 'MT – Plantão diurno (07h–19h)',
            horaInicio: '07:00',
            horaFim: '19:00',
            cruzaMeiaNoite: false,
            ordem: nextOrd++,
          },
        });
        tipos = [...tipos, mtTipo];
      }
      if (!snTipo) {
        snTipo = await tx.tipoPlantao.create({
          data: {
            tenantId,
            contratoAtivoId,
            nome: 'SN – Plantão noturno (19h–07h)',
            horaInicio: '19:00',
            horaFim: '07:00',
            cruzaMeiaNoite: true,
            ordem: nextOrd++,
          },
        });
        tipos = [...tipos, snTipo];
      }
    }

    if (!mtTipo || !snTipo) return;

    await tx.valorPlantao.updateMany({
      where: { tenantId, contratoAtivoId, gradeId: 'mt' },
      data: { gradeId: mtTipo.id },
    });
    await tx.valorPlantao.updateMany({
      where: { tenantId, contratoAtivoId, gradeId: 'MT' },
      data: { gradeId: mtTipo.id },
    });
    await tx.valorPlantao.updateMany({
      where: { tenantId, contratoAtivoId, gradeId: 'sn' },
      data: { gradeId: snTipo.id },
    });
    await tx.valorPlantao.updateMany({
      where: { tenantId, contratoAtivoId, gradeId: 'SN' },
      data: { gradeId: snTipo.id },
    });

    await tx.adicionalPlantaoData.updateMany({
      where: { tenantId, contratoAtivoId, gradeId: 'mt' },
      data: { gradeId: mtTipo.id },
    });
    await tx.adicionalPlantaoData.updateMany({
      where: { tenantId, contratoAtivoId, gradeId: 'MT' },
      data: { gradeId: mtTipo.id },
    });
    await tx.adicionalPlantaoData.updateMany({
      where: { tenantId, contratoAtivoId, gradeId: 'sn' },
      data: { gradeId: snTipo.id },
    });
    await tx.adicionalPlantaoData.updateMany({
      where: { tenantId, contratoAtivoId, gradeId: 'SN' },
      data: { gradeId: snTipo.id },
    });

    if (escalaIds.length > 0) {
      await tx.escalaPlantao.updateMany({
        where: { tenantId, escalaId: { in: escalaIds }, gradeId: 'mt' },
        data: { gradeId: mtTipo.id },
      });
      await tx.escalaPlantao.updateMany({
        where: { tenantId, escalaId: { in: escalaIds }, gradeId: 'MT' },
        data: { gradeId: mtTipo.id },
      });
      await tx.escalaPlantao.updateMany({
        where: { tenantId, escalaId: { in: escalaIds }, gradeId: 'sn' },
        data: { gradeId: snTipo.id },
      });
      await tx.escalaPlantao.updateMany({
        where: { tenantId, escalaId: { in: escalaIds }, gradeId: 'SN' },
        data: { gradeId: snTipo.id },
      });
    }
    },
    {
      maxWait: 20_000,
      timeout: 120_000,
    }
  );

  ensureTiposWarmUntil.set(cacheKey, Date.now() + ENSURE_TIPOS_WARM_MS);
}

export async function listTiposPlantaoService(tenantId: string, contratoAtivoId: string): Promise<TipoPlantao[]> {
  await ensureTiposLegadoMigrados(tenantId, contratoAtivoId);
  return prisma.tipoPlantao.findMany({
    where: { tenantId, contratoAtivoId },
    orderBy: [{ horaInicio: 'asc' }, { nome: 'asc' }],
  });
}

export async function createTipoPlantaoService(input: {
  tenantId: string;
  masterId: string;
  contratoAtivoId: string;
  nome: string;
  horaInicio: string;
  horaFim: string;
  cruzaMeiaNoite?: boolean;
}) {
  const nome = input.nome?.trim();
  if (!nome) {
    throw { statusCode: 400, message: 'Nome do tipo de plantão é obrigatório' };
  }
  const hi = normalizarHorarioPlantao(input.horaInicio);
  const hf = normalizarHorarioPlantao(input.horaFim);
  if (!hi || !hf) {
    throw { statusCode: 400, message: 'Horários devem estar no formato HH:mm' };
  }
  const hiMin = parseHmToMinutes(hi);
  const hfMin = parseHmToMinutes(hf);
  if (hiMin == null || hfMin == null || hiMin === hfMin) {
    throw { statusCode: 400, message: 'Início e fim do plantão devem ser horários distintos' };
  }
  const cruza = inferCruzaMeiaNoite(hi, hf, input.cruzaMeiaNoite);

  const contrato = await prisma.contratoAtivo.findFirst({
    where: { id: input.contratoAtivoId, tenantId: input.tenantId },
  });
  if (!contrato) {
    throw { statusCode: 404, message: 'Contrato ativo não encontrado' };
  }

  const maxOrdem = await prisma.tipoPlantao.aggregate({
    where: { tenantId: input.tenantId, contratoAtivoId: input.contratoAtivoId },
    _max: { ordem: true },
  });
  const ordem = (maxOrdem._max.ordem ?? -1) + 1;

  const row = await prisma.tipoPlantao.create({
    data: {
      tenantId: input.tenantId,
      contratoAtivoId: input.contratoAtivoId,
      nome,
      horaInicio: hi,
      horaFim: hf,
      cruzaMeiaNoite: cruza,
      ordem,
    },
  });

  await createAuditLog({
    acao: 'CRIAR_TIPO_PLANTAO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { tipoPlantaoId: row.id, contratoAtivoId: input.contratoAtivoId, nome },
  });

  invalidateTiposLeituraCache(input.tenantId, input.contratoAtivoId);
  return row;
}

export async function updateTipoPlantaoService(input: {
  tenantId: string;
  masterId: string;
  id: string;
  nome?: string;
  horaInicio?: string;
  horaFim?: string;
  cruzaMeiaNoite?: boolean;
}) {
  const existing = await prisma.tipoPlantao.findFirst({
    where: { id: input.id, tenantId: input.tenantId },
  });
  if (!existing) {
    throw { statusCode: 404, message: 'Tipo de plantão não encontrado' };
  }

  if (
    input.nome === undefined &&
    input.horaInicio === undefined &&
    input.horaFim === undefined &&
    input.cruzaMeiaNoite === undefined
  ) {
    throw { statusCode: 400, message: 'Informe ao menos um campo para atualizar' };
  }

  const data: {
    nome?: string;
    horaInicio?: string;
    horaFim?: string;
    cruzaMeiaNoite?: boolean;
  } = {};

  if (input.nome !== undefined) {
    const n = input.nome.trim();
    if (!n) throw { statusCode: 400, message: 'Nome inválido' };
    data.nome = n;
  }
  let hi = existing.horaInicio;
  let hf = existing.horaFim;
  if (input.horaInicio !== undefined) {
    const x = normalizarHorarioPlantao(input.horaInicio);
    if (!x) throw { statusCode: 400, message: 'horaInicio inválida' };
    data.horaInicio = x;
    hi = x;
  }
  if (input.horaFim !== undefined) {
    const x = normalizarHorarioPlantao(input.horaFim);
    if (!x) throw { statusCode: 400, message: 'horaFim inválida' };
    data.horaFim = x;
    hf = x;
  }
  if (input.horaInicio !== undefined || input.horaFim !== undefined || input.cruzaMeiaNoite !== undefined) {
    const hiMin = parseHmToMinutes(hi);
    const hfMin = parseHmToMinutes(hf);
    if (hiMin == null || hfMin == null || hiMin === hfMin) {
      throw { statusCode: 400, message: 'Início e fim do plantão devem ser horários distintos' };
    }
    data.cruzaMeiaNoite = inferCruzaMeiaNoite(hi, hf, input.cruzaMeiaNoite);
  }

  const row = await prisma.tipoPlantao.update({
    where: { id: input.id },
    data,
  });

  await createAuditLog({
    acao: 'ATUALIZAR_TIPO_PLANTAO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { tipoPlantaoId: row.id, contratoAtivoId: existing.contratoAtivoId },
  });

  invalidateTiposLeituraCache(input.tenantId, existing.contratoAtivoId);
  return row;
}

export async function deleteTipoPlantaoService(tenantId: string, masterId: string, id: string) {
  const existing = await prisma.tipoPlantao.findFirst({
    where: { id, tenantId },
  });
  if (!existing) {
    throw { statusCode: 404, message: 'Tipo de plantão não encontrado' };
  }

  const nPlant = await prisma.escalaPlantao.count({ where: { tenantId, gradeId: id } });
  if (nPlant > 0) {
    throw {
      statusCode: 400,
      message: `Não é possível excluir: ainda há ${nPlant} plantão(ões) na escala usando este tipo. Remova ou troque essas alocações antes.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.valorPlantao.deleteMany({ where: { tenantId, gradeId: id } });
    await tx.adicionalPlantaoData.deleteMany({ where: { tenantId, gradeId: id } });
    await tx.tipoPlantao.delete({ where: { id } });
  });

  await createAuditLog({
    acao: 'EXCLUIR_TIPO_PLANTAO',
    tenantId,
    masterId,
    detalhes: {
      tipoPlantaoId: id,
      contratoAtivoId: existing.contratoAtivoId,
      removeuValoresEAdicionais: true,
    },
  });

  invalidateEnsureTiposWarmCache(tenantId, existing.contratoAtivoId);
  invalidateTiposLeituraCache(tenantId, existing.contratoAtivoId);
  return { ok: true as const };
}

export async function loadTiposMapPorContrato(
  tenantId: string,
  contratoAtivoIds: string[]
): Promise<Map<string, Map<string, TipoPlantao>>> {
  const ids = [...new Set(contratoAtivoIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  await Promise.all(ids.map((cid) => ensureTiposLegadoMigrados(tenantId, cid)));

  const tipos = await prisma.tipoPlantao.findMany({
    where: { tenantId, contratoAtivoId: { in: ids } },
  });

  const out = new Map<string, Map<string, TipoPlantao>>();
  for (const t of tipos) {
    if (!out.has(t.contratoAtivoId)) {
      out.set(t.contratoAtivoId, new Map());
    }
    out.get(t.contratoAtivoId)!.set(t.id, t);
  }
  return out;
}

/**
 * Só leitura: um `findMany` de tipos, **sem** ensure/migração (admin e jobs continuam usando `loadTiposMapPorContrato`).
 * Rotas do médico (ponto/dashboard) — evita dezenas de queries e transações por request.
 */
export async function loadTiposMapPorContratoLeitura(
  tenantId: string,
  contratoAtivoIds: string[]
): Promise<Map<string, Map<string, TipoPlantao>>> {
  const ids = [...new Set(contratoAtivoIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const out = new Map<string, Map<string, TipoPlantao>>();
  const missing: string[] = [];
  const now = Date.now();

  if (TIPOS_LEITURA_TTL_MS > 0) {
    for (const cid of ids) {
      const ck = `${tenantId}:${cid}`;
      const hit = tiposLeituraPorContrato.get(ck);
      if (hit && hit.exp > now) {
        out.set(cid, hit.map);
      } else {
        missing.push(cid);
      }
    }
  } else {
    missing.push(...ids);
  }

  if (missing.length > 0) {
    const fetchKey = `${tenantId}|${[...missing].sort().join(',')}`;
    let fetchP = inflightTiposLeituraFetch.get(fetchKey);
    if (!fetchP) {
      fetchP = (async () => {
        try {
          const tipos = await prisma.tipoPlantao.findMany({
            where: { tenantId, contratoAtivoId: { in: missing } },
          });
          const freshByCid = new Map<string, Map<string, TipoPlantao>>();
          for (const t of tipos) {
            if (!freshByCid.has(t.contratoAtivoId)) {
              freshByCid.set(t.contratoAtivoId, new Map());
            }
            freshByCid.get(t.contratoAtivoId)!.set(t.id, t);
          }
          return freshByCid;
        } finally {
          inflightTiposLeituraFetch.delete(fetchKey);
        }
      })();
      inflightTiposLeituraFetch.set(fetchKey, fetchP);
    }

    const freshByCid = await fetchP;
    const exp = now + TIPOS_LEITURA_TTL_MS;
    for (const cid of missing) {
      const map = freshByCid.get(cid) ?? new Map<string, TipoPlantao>();
      if (TIPOS_LEITURA_TTL_MS > 0) {
        tiposLeituraPorContrato.set(`${tenantId}:${cid}`, { exp, map });
      }
      out.set(cid, map);
    }
  }

  return out;
}

export function scheduleForGradeId(
  gradeId: string,
  tipoMap: Map<string, TipoPlantao> | undefined
): PlantaoSchedule {
  if (isLegacyGradeId(gradeId)) {
    return scheduleFromLegacyGradeId(gradeId);
  }
  const tipo = tipoMap?.get(gradeId);
  if (tipo) {
    return scheduleFromTipoRow(tipo);
  }
  return scheduleFromLegacyGradeId('mt');
}

function minutosParaHm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function enrichPlantaoComTipo(
  p: { gradeId: string },
  contratoAtivoId: string,
  tipoMapPorContrato: Map<string, Map<string, TipoPlantao>>
) {
  const map = tipoMapPorContrato.get(contratoAtivoId);
  const tipo = map?.get(p.gradeId);
  const schedule = scheduleForGradeId(p.gradeId, map);
  return {
    ...p,
    tipoNome: tipo?.nome ?? null,
    faixaHorarioCurta: tipo ? faixaHorarioCurta(tipo) : faixaHorarioCurtaFromLegacy(p.gradeId),
    faixaHorario: tipo
      ? faixaHorarioLabelExibicao(p.gradeId, tipo)
      : faixaHorarioLabelExibicao(p.gradeId, null),
    horaInicio: tipo ? tipo.horaInicio : minutosParaHm(schedule.horaInicioMin),
    horaFim: tipo ? tipo.horaFim : minutosParaHm(schedule.horaFimMin),
    cruzaMeiaNoite: schedule.cruzaMeiaNoite,
    tipoOrdem: tipo?.ordem ?? null,
  };
}

function faixaHorarioCurtaFromLegacy(gradeId: string): string {
  const g = (gradeId || '').toLowerCase();
  return g === 'sn' ? '19h–07h' : '07h–19h';
}

/** Normaliza mt/sn legados para UUID após migração; valida UUID contra o contrato. */
export async function resolveGradeIdParaContrato(
  tenantId: string,
  contratoAtivoId: string,
  gradeId: string
): Promise<string> {
  await ensureTiposLegadoMigrados(tenantId, contratoAtivoId);
  const g = (gradeId || '').toLowerCase();
  if (g === 'mt' || g === 'sn') {
    const tipos = await prisma.tipoPlantao.findMany({
      where: { tenantId, contratoAtivoId },
      orderBy: [{ horaInicio: 'asc' }, { nome: 'asc' }],
    });
    const mtTipo =
      tipos.find((t) => t.horaInicio === '07:00' && t.horaFim === '19:00' && !t.cruzaMeiaNoite) ?? tipos[0];
    const snTipo =
      tipos.find((t) => t.horaInicio === '19:00' && t.horaFim === '07:00' && t.cruzaMeiaNoite) ?? tipos[1] ?? tipos[0];
    const chosen = g === 'sn' ? snTipo : mtTipo;
    if (!chosen?.id) {
      throw { statusCode: 500, message: 'Tipos de plantão não configurados para este contrato' };
    }
    return chosen.id;
  }
  const ok = await prisma.tipoPlantao.findFirst({
    where: { id: gradeId, tenantId, contratoAtivoId },
    select: { id: true },
  });
  if (!ok) {
    throw { statusCode: 400, message: 'Tipo de plantão inválido para este contrato' };
  }
  return gradeId;
}
