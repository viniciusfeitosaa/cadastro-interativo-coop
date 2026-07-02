import { OrigemRegistroPonto, Prisma, type TipoPlantao } from '@prisma/client';
import { prisma } from '../config/database';
import { PONTO_SEM_ESCALA_ESCALA_ID } from '../constants/ponto.const';
import { fileExistsSafe, resolveStoredFileToAbsolute } from '../utils/upload-path.util';
import { createAuditLog } from './auditoria.service';
import { fimPlantaoAsDate, inicioPlantaoAsDate } from '../utils/plantao-horario';
import {
  enrichPlantaoComTipo,
  faixaHorarioLabelExibicao,
  loadTiposMapPorContratoLeitura,
  scheduleForGradeId,
} from './tipo-plantao.service';
import { calcularRepasseCongeladoCheckout } from './repasse-registro-ponto.service';
import { getValoresPlantaoService, listRegistrosPontoAdminService } from './admin.service';
import { isMissingDatabaseColumnError } from '../utils/prisma-column-error';
import {
  pickGeoConfigParaEscala,
  pickGeoConfigSemEscala,
  type MedicoEquipeGeoLinha,
} from '../utils/ponto-geo-config.util';
import { batchResolveProducaoMedicoNasEscalas, resolveProducaoMedicoNaEscala } from '../utils/producao-subgrupo.util';

function isPontoSemEscalaEscalaId(escalaId: string) {
  return escalaId === PONTO_SEM_ESCALA_ESCALA_ID;
}

/** Subgrupo com ponto habilitado e sem escala de plantão (ponto sem grade). */
export async function medicoTemContratoSoPonto(tenantId: string, medicoId: string): Promise<boolean> {
  const row = await prisma.equipeMedico.findFirst({
    where: {
      tenantId,
      medicoId,
      equipe: {
        subgrupo: {
          AND: [{ usaPonto: true }, { usaEscala: false }],
        },
      },
    },
    select: { id: true },
  });
  return !!row;
}

/** Pelo menos uma equipe do médico está em subgrupo que usa escala de plantão. */
export async function medicoTemContratoComEscala(tenantId: string, medicoId: string): Promise<boolean> {
  const row = await prisma.equipeMedico.findFirst({
    where: {
      tenantId,
      medicoId,
      equipe: {
        subgrupo: { usaEscala: true },
      },
    },
    select: { id: true },
  });
  return !!row;
}

/** Distância em metros entre dois pontos (fórmula de Haversine). */
function distanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // raio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type PreloadedMedicoEquipesGeo = MedicoEquipeGeoLinha[];

/** Retorna a config de ponto (com geolocalização) que se aplica ao médico, ou null. */
async function getConfigPontoParaMedico(
  tenantId: string,
  medicoId: string,
  escalaId: string | null,
  preloadedMedicoEquipes?: PreloadedMedicoEquipesGeo
): Promise<{ latitude: number; longitude: number; raioMetros: number } | null> {
  const medicoEquipes: MedicoEquipeGeoLinha[] =
    preloadedMedicoEquipes ??
    (
      await prisma.equipeMedico.findMany({
        where: { tenantId, medicoId },
        select: { equipeId: true, equipe: { select: { subgrupoId: true } } },
      })
    ).map((r) => ({ equipeId: r.equipeId, subgrupoId: r.equipe.subgrupoId ?? null }));

  if (medicoEquipes.length === 0) return null;

  if (escalaId) {
    const [escala, equipesNaEscala] = await Promise.all([
      prisma.escala.findFirst({
        where: { id: escalaId, tenantId },
        select: { contratoAtivoId: true },
      }),
      prisma.escalaEquipe.findMany({
        where: { tenantId, escalaId },
        select: { equipeId: true },
      }),
    ]);
    if (!escala?.contratoAtivoId) return null;
    const equipeIdsEscala = new Set(equipesNaEscala.map((e) => e.equipeId));
    const candidatos = medicoEquipes.filter(
      (em) => equipeIdsEscala.has(em.equipeId) && em.subgrupoId
    );
    if (candidatos.length === 0) return null;

    const configs = await prisma.configPontoEletronico.findMany({
      where: {
        tenantId,
        contratoAtivoId: escala.contratoAtivoId,
        OR: candidatos.map((em) => ({
          equipeId: em.equipeId,
          subgrupoId: em.subgrupoId!,
        })),
        latitude: { not: null },
        longitude: { not: null },
        raioMetros: { not: null },
      },
      select: {
        equipeId: true,
        subgrupoId: true,
        latitude: true,
        longitude: true,
        raioMetros: true,
      },
    });
    return pickGeoConfigParaEscala(candidatos, configs);
  }

  const equipeIdsList = medicoEquipes.map((e) => e.equipeId);
  const configs = await prisma.configPontoEletronico.findMany({
    where: {
      tenantId,
      equipeId: { in: equipeIdsList },
      latitude: { not: null },
      longitude: { not: null },
      raioMetros: { not: null },
    },
    select: {
      equipeId: true,
      subgrupoId: true,
      latitude: true,
      longitude: true,
      raioMetros: true,
    },
  });
  return pickGeoConfigSemEscala(medicoEquipes, configs);
}

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

/** Contratos com escala + ponto: check-in só entre (início − 10 min) e o fim do plantão do dia. */
const MINUTOS_ANTES_INICIO_CHECKIN_PONTO_ESCALA = 10;
const TOLERANCIA_PADRAO_ATRASO_CHECKIN_MINUTOS = 30;

type ResultadoJanelaCheckinEscala = { ok: true } | { ok: false; message: string };

type LinhaPlantaoJanelaCheckin = {
  id: string;
  data: Date;
  gradeId: string;
  escala: { contratoAtivoId: string | null };
};

type ResultadoAtrasoCheckin = {
  checkInAtrasado: boolean;
  minutosAtrasoCheckin: number | null;
  minutosTolerancia: number;
};

/**
 * Mesma prioridade que `escolherPlantaoMaisRelevante` no app (em andamento → próximo → último que acabou).
 * Evita `findFirst` sem ordem quando há mais de um grade no mesmo dia na escala.
 */
function escolherPlantaoParaJanelaCheckinHoje(
  lista: LinhaPlantaoJanelaCheckin[],
  tipoMaps: Awaited<ReturnType<typeof loadTiposMapPorContratoLeitura>>,
  at: Date
): LinhaPlantaoJanelaCheckin | null {
  if (lista.length === 0) return null;
  if (lista.length === 1) return lista[0];

  const scored = lista.map((p) => {
    const cid = p.escala?.contratoAtivoId ?? '';
    const schedule = scheduleForGradeId(p.gradeId, tipoMaps.get(cid));
    const dataStr = p.data.toISOString().slice(0, 10);
    const inicio = inicioPlantaoAsDate(dataStr, schedule);
    const fim = fimPlantaoAsDate(dataStr, schedule);
    return { p, inicio, fim };
  });

  const t = at.getTime();
  const emAndamento = scored.find((s) => t >= s.inicio.getTime() && t <= s.fim.getTime());
  if (emAndamento) return emAndamento.p;

  const futuros = scored
    .filter((s) => s.inicio.getTime() > t)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  if (futuros.length > 0) return futuros[0].p;

  const passados = scored
    .filter((s) => s.fim.getTime() < t)
    .sort((a, b) => b.fim.getTime() - a.fim.getTime());
  return passados[0]?.p ?? lista[0];
}

async function validarJanelaCheckinPlantaoEscalaHoje(
  tenantId: string,
  medicoId: string,
  escalaId: string
): Promise<ResultadoJanelaCheckinEscala> {
  const plantoesHoje = await prisma.escalaPlantao.findMany({
    where: {
      tenantId,
      escalaId,
      medicoId,
      data: { gte: startOfToday(), lte: endOfToday() },
    },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escala: { select: { contratoAtivoId: true } },
    },
  });
  if (!plantoesHoje.length) {
    return { ok: false, message: 'Você não possui plantão nesta escala para hoje' };
  }
  const cid = plantoesHoje[0].escala?.contratoAtivoId;
  if (!cid) {
    return { ok: false, message: 'Escala sem contrato vinculado para calcular o horário do plantão.' };
  }
  const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, [cid]);
  const plantaoHoje = escolherPlantaoParaJanelaCheckinHoje(plantoesHoje, tipoMaps, new Date());
  if (!plantaoHoje) {
    return { ok: false, message: 'Você não possui plantão nesta escala para hoje' };
  }
  const schedule = scheduleForGradeId(plantaoHoje.gradeId, tipoMaps.get(cid));
  const dataStr = plantaoHoje.data.toISOString().slice(0, 10);
  const inicio = inicioPlantaoAsDate(dataStr, schedule);
  const fim = fimPlantaoAsDate(dataStr, schedule);
  const now = new Date();
  const abertura = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_CHECKIN_PONTO_ESCALA * 60 * 1000);
  if (now.getTime() < abertura.getTime()) {
    const hm = abertura.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return {
      ok: false,
      message: `Check-in liberado a partir das ${hm}.`,
    };
  }
  if (now.getTime() > fim.getTime()) {
    return { ok: false, message: 'Entrada não permitida neste horário.' };
  }
  return { ok: true };
}

async function calcularAtrasoCheckinPlantaoEscalaHoje(
  tenantId: string,
  medicoId: string,
  escalaId: string,
  instanteCheckIn: Date
): Promise<ResultadoAtrasoCheckin> {
  const plantoesHoje = await prisma.escalaPlantao.findMany({
    where: {
      tenantId,
      escalaId,
      medicoId,
      data: { gte: startOfToday(), lte: endOfToday() },
    },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escala: { select: { contratoAtivoId: true } },
    },
  });
  if (!plantoesHoje.length) {
    return {
      checkInAtrasado: false,
      minutosAtrasoCheckin: null,
      minutosTolerancia: TOLERANCIA_PADRAO_ATRASO_CHECKIN_MINUTOS,
    };
  }
  const cid = plantoesHoje[0].escala?.contratoAtivoId;
  if (!cid) {
    return {
      checkInAtrasado: false,
      minutosAtrasoCheckin: null,
      minutosTolerancia: TOLERANCIA_PADRAO_ATRASO_CHECKIN_MINUTOS,
    };
  }

  const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, [cid]);
  const plantaoHoje = escolherPlantaoParaJanelaCheckinHoje(plantoesHoje, tipoMaps, instanteCheckIn);
  if (!plantaoHoje) {
    return {
      checkInAtrasado: false,
      minutosAtrasoCheckin: null,
      minutosTolerancia: TOLERANCIA_PADRAO_ATRASO_CHECKIN_MINUTOS,
    };
  }

  const equipeIdsRows = await prisma.escalaEquipe.findMany({
    where: {
      tenantId,
      escalaId,
      equipe: {
        equipeMedicos: {
          some: { tenantId, medicoId },
        },
      },
    },
    select: { equipeId: true },
  });
  const equipeIds = equipeIdsRows.map((r) => r.equipeId);
  const configTolerancia = equipeIds.length
    ? await prisma.configPontoEletronico.findFirst({
        where: {
          tenantId,
          equipeId: { in: equipeIds },
          toleranciaMinutos: { not: null },
        },
        select: { toleranciaMinutos: true },
      })
    : null;
  const minutosTolerancia = Math.max(
    0,
    configTolerancia?.toleranciaMinutos ?? TOLERANCIA_PADRAO_ATRASO_CHECKIN_MINUTOS
  );

  const schedule = scheduleForGradeId(plantaoHoje.gradeId, tipoMaps.get(cid));
  const dataStr = plantaoHoje.data.toISOString().slice(0, 10);
  const inicio = inicioPlantaoAsDate(dataStr, schedule);
  const limiteSemAtraso = new Date(inicio.getTime() + minutosTolerancia * 60 * 1000);
  const minutosAtraso =
    instanteCheckIn.getTime() > limiteSemAtraso.getTime()
      ? Math.floor((instanteCheckIn.getTime() - limiteSemAtraso.getTime()) / 60000)
      : 0;

  return {
    checkInAtrasado: minutosAtraso > 0,
    minutosAtrasoCheckin: minutosAtraso > 0 ? minutosAtraso : null,
    minutosTolerancia,
  };
}

const startOfWeek = () => {
  const date = new Date();
  const day = date.getDay(); // 0 domingo, 1 segunda...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfWeek = () => {
  const date = startOfWeek();
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
};

type CacheEntry<T> = { exp: number; value: T };
const CACHE_TTL_MS = Math.max(0, parseInt(process.env.PONTO_CACHE_TTL_MS || '', 10) || 10_000);
const meuDiaCache = new Map<string, CacheEntry<unknown>>();
const minhasEscalasCache = new Map<string, CacheEntry<unknown>>();

function cacheKey(tenantId: string, medicoId: string) {
  return `${tenantId}:${medicoId}`;
}

function getCached<T>(m: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = m.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    m.delete(key);
    return null;
  }
  return hit.value;
}

function setCached<T>(m: Map<string, CacheEntry<T>>, key: string, value: T) {
  m.set(key, { exp: Date.now() + CACHE_TTL_MS, value });
}

export function clearPontoCaches(tenantId: string, medicoId: string) {
  const key = cacheKey(tenantId, medicoId);
  meuDiaCache.delete(key);
  minhasEscalasCache.delete(key);
}

export async function checkInService(
  tenantId: string,
  medicoId: string,
  escalaId: string,
  observacao?: string,
  latitude?: number | null,
  longitude?: number | null,
  fotoCheckinCaminho?: string | null,
  motivoCheckinSemFoto?: string | null
) {
  const hasFoto = !!fotoCheckinCaminho?.trim();
  const motivo = motivoCheckinSemFoto?.trim();
  if (hasFoto && motivo) {
    throw { statusCode: 400, message: 'Não envie motivo quando houver foto de check-in.' };
  }
  if (!hasFoto) {
    if (!motivo || motivo.length < 15) {
      throw {
        statusCode: 400,
        message:
          'Sem foto é obrigatório informar o motivo (mínimo 15 caracteres). Ex.: permissão de câmera negada no navegador.',
      };
    }
    if (motivo.length > 500) {
      throw { statusCode: 400, message: 'O motivo deve ter no máximo 500 caracteres.' };
    }
  }
  const instanteCheckIn = new Date();
  const registroAberto = await prisma.registroPonto.findFirst({
    where: { tenantId, medicoId, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
    select: { id: true, escalaId: true, checkInAt: true },
  });

  if (registroAberto) {
    throw { statusCode: 409, message: 'Já existe um check-in em aberto para este médico' };
  }

  if (isPontoSemEscalaEscalaId(escalaId)) {
    const pode = await medicoTemContratoSoPonto(tenantId, medicoId);
    if (!pode) {
      throw {
        statusCode: 403,
        message: 'Ponto sem escala de plantão não está disponível para o seu vínculo com o contrato.',
      };
    }
    const configGeoSemEscala = await getConfigPontoParaMedico(tenantId, medicoId, null);
    if (configGeoSemEscala) {
      if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
        throw {
          statusCode: 400,
          message:
            'É necessário informar sua localização para bater ponto neste local. Permita o acesso à localização no navegador ou no app.',
        };
      }
      const dist = distanciaMetros(
        configGeoSemEscala.latitude,
        configGeoSemEscala.longitude,
        latitude,
        longitude
      );
      if (dist > configGeoSemEscala.raioMetros) {
        throw {
          statusCode: 400,
          message: `Você está fora do raio permitido para bater ponto (distância: ${Math.round(dist)} m, raio: ${configGeoSemEscala.raioMetros} m).`,
        };
      }
    }

    return prisma.$transaction(async (tx: any) => {
      const registroAbertoTx = await tx.registroPonto.findFirst({
        where: { tenantId, medicoId, checkOutAt: null },
        orderBy: { checkInAt: 'desc' },
        select: { id: true },
      });
      if (registroAbertoTx) {
        throw { statusCode: 409, message: 'Já existe um check-in em aberto para este médico' };
      }
      const registro = await tx.registroPonto.create({
        data: {
          tenantId,
          escalaId: null,
          medicoId,
          checkInAt: instanteCheckIn,
          origem: OrigemRegistroPonto.APP_MEDICO,
          observacao: observacao?.trim() || null,
          checkInAtrasado: false,
          minutosAtrasoCheckin: null,
          fotoCheckinCaminho: hasFoto ? fotoCheckinCaminho!.trim() : null,
          motivoCheckinSemFoto: hasFoto ? null : motivo!,
        },
      });
      await createAuditLog(
        {
          acao: 'CHECKIN_MEDICO',
          tenantId,
          medicoId,
          detalhes: {
            escalaId: null,
            pontoSemEscala: true,
            registroPontoId: registro.id,
            checkInSemFoto: !hasFoto,
            ...(hasFoto ? {} : { motivoResumo: motivo!.slice(0, 120) }),
          },
        },
        tx
      );
      clearPontoCaches(tenantId, medicoId);
      return registro;
    });
  }

  // Com escala real: regras por subgrupo das equipes do médico nesta escala.
  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId, ativo: true },
    select: { id: true, nome: true },
  });
  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada ou inativa' };
  }
  const prod = await resolveProducaoMedicoNaEscala(tenantId, medicoId, escalaId);
  if (!prod.allowPonto) {
    throw { statusCode: 403, message: 'Ponto eletrônico não está habilitado para o seu vínculo nesta escala' };
  }

  if (prod.requireJanelaPlantao) {
    const janela = await validarJanelaCheckinPlantaoEscalaHoje(tenantId, medicoId, escalaId);
    if (!janela.ok) {
      throw { statusCode: 403, message: janela.message };
    }
  }
  const atrasoCheckin = await calcularAtrasoCheckinPlantaoEscalaHoje(
    tenantId,
    medicoId,
    escalaId,
    instanteCheckIn
  );

  const configGeo = await getConfigPontoParaMedico(tenantId, medicoId, escalaId);
  if (configGeo) {
    if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw { statusCode: 400, message: 'É necessário informar sua localização para bater ponto neste local. Permita o acesso à localização no navegador ou no app.' };
    }
    const dist = distanciaMetros(configGeo.latitude, configGeo.longitude, latitude, longitude);
    if (dist > configGeo.raioMetros) {
      throw { statusCode: 400, message: `Você está fora do raio permitido para bater ponto (distância: ${Math.round(dist)} m, raio: ${configGeo.raioMetros} m).` };
    }
  }

  return prisma.$transaction(async (tx: any) => {
    // Revalida em transação para evitar race condition (dois check-ins simultâneos)
    const registroAbertoTx = await tx.registroPonto.findFirst({
      where: { tenantId, medicoId, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
      select: { id: true },
    });

    if (registroAbertoTx) {
      throw { statusCode: 409, message: 'Já existe um check-in em aberto para este médico' };
    }

    const registro = await tx.registroPonto.create({
      data: {
        tenantId,
        escalaId,
        medicoId,
        checkInAt: instanteCheckIn,
        origem: OrigemRegistroPonto.APP_MEDICO,
        observacao: observacao?.trim() || null,
        checkInAtrasado: atrasoCheckin.checkInAtrasado,
        minutosAtrasoCheckin: atrasoCheckin.minutosAtrasoCheckin,
        fotoCheckinCaminho: hasFoto ? fotoCheckinCaminho!.trim() : null,
        motivoCheckinSemFoto: hasFoto ? null : motivo!,
      },
    });

    await createAuditLog(
      {
        acao: 'CHECKIN_MEDICO',
        tenantId,
        medicoId,
        detalhes: {
          escalaId: registro.escalaId,
          registroPontoId: registro.id,
          checkInAtrasado: atrasoCheckin.checkInAtrasado,
          minutosAtrasoCheckin: atrasoCheckin.minutosAtrasoCheckin,
          minutosToleranciaCheckin: atrasoCheckin.minutosTolerancia,
          checkInSemFoto: !hasFoto,
          ...(hasFoto ? {} : { motivoResumo: motivo!.slice(0, 120) }),
        },
      },
      tx
    );

    clearPontoCaches(tenantId, medicoId);
    return registro;
  });
}

export async function checkOutService(
  tenantId: string,
  medicoId: string,
  observacao?: string,
  latitude?: number | null,
  longitude?: number | null
) {
  const registroAberto = await prisma.registroPonto.findFirst({
    where: { tenantId, medicoId, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });

  if (!registroAberto) {
    throw { statusCode: 404, message: 'Não existe check-in em aberto para checkout' };
  }

  const configGeo = await getConfigPontoParaMedico(tenantId, medicoId, registroAberto.escalaId);
  if (configGeo) {
    if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw { statusCode: 400, message: 'É necessário informar sua localização para bater ponto neste local. Permita o acesso à localização no navegador ou no app.' };
    }
    const dist = distanciaMetros(configGeo.latitude, configGeo.longitude, latitude, longitude);
    if (dist > configGeo.raioMetros) {
      throw { statusCode: 400, message: `Você está fora do raio permitido para bater ponto (distância: ${Math.round(dist)} m, raio: ${configGeo.raioMetros} m).` };
    }
  }

  const checkoutTime = new Date();
  if (checkoutTime <= registroAberto.checkInAt) {
    throw { statusCode: 400, message: 'Horário de checkout inválido' };
  }

  const duracaoMs = checkoutTime.getTime() - registroAberto.checkInAt.getTime();
  const duracaoMinutos = Math.max(1, Math.floor(duracaoMs / 60000));

  let repasseValorCongelado: number | null = null;
  if (registroAberto.escalaId) {
    try {
      repasseValorCongelado = await calcularRepasseCongeladoCheckout(tenantId, {
        escalaId: registroAberto.escalaId,
        medicoId,
        checkInAt: new Date(registroAberto.checkInAt),
        duracaoMinutos,
      });
    } catch (e) {
      console.warn('[ponto] checkout: cálculo de repasse congelado ignorado:', (e as Error)?.message ?? e);
    }
  }

  return prisma.$transaction(async (tx: any) => {
    const baseCheckoutData = {
      checkOutAt: checkoutTime,
      observacao: observacao?.trim() || registroAberto.observacao,
      duracaoMinutos,
    };
    let updated;
    try {
      updated = await tx.registroPonto.updateMany({
        where: { id: registroAberto.id, tenantId, medicoId, checkOutAt: null },
        data: {
          ...baseCheckoutData,
          ...(repasseValorCongelado != null ? { repasseValorCongelado } : {}),
        },
      });
    } catch (e) {
      if (
        isMissingDatabaseColumnError(e, 'repasse_valor_congelado') &&
        repasseValorCongelado != null
      ) {
        updated = await tx.registroPonto.updateMany({
          where: { id: registroAberto.id, tenantId, medicoId, checkOutAt: null },
          data: baseCheckoutData,
        });
      } else {
        throw e;
      }
    }

    if (updated.count !== 1) {
      throw { statusCode: 409, message: 'Checkout já foi processado ou não existe check-in em aberto.' };
    }

    const registro = await tx.registroPonto.findFirst({
      where: { id: registroAberto.id },
      select: { id: true, escalaId: true },
    });

    if (!registro) {
      throw { statusCode: 404, message: 'Registro de ponto não encontrado após update.' };
    }

    await createAuditLog(
      {
        acao: 'CHECKOUT_MEDICO',
        tenantId,
        medicoId,
        detalhes: { escalaId: registro.escalaId, registroPontoId: registro.id, duracaoMinutos },
      },
      tx
    );

    clearPontoCaches(tenantId, medicoId);
    return registro;
  });
}

export async function getMeuDiaPontoService(tenantId: string, medicoId: string) {
  if (CACHE_TTL_MS > 0) {
    const hit = getCached(meuDiaCache, cacheKey(tenantId, medicoId));
    if (hit) return hit as any;
  }

  const now = new Date();
  const hojeInicio = startOfToday();
  const hojeFim = endOfToday();
  const semanaInicio = startOfWeek();
  const semanaFim = endOfWeek();

  const [aberto, registrosSemanaCompletos, ultimoRegistro, temContratoComEscala] = await Promise.all([
    prisma.registroPonto.findFirst({
      where: { tenantId, medicoId, checkOutAt: null },
      include: {
        escala: { select: { id: true, nome: true } },
      },
      orderBy: { checkInAt: 'desc' },
    }),
    prisma.registroPonto.findMany({
      where: {
        tenantId,
        medicoId,
        checkInAt: {
          gte: semanaInicio,
          lte: semanaFim,
        },
      },
      include: {
        escala: { select: { id: true, nome: true } },
      },
      orderBy: { checkInAt: 'desc' },
    }),
    prisma.registroPonto.findFirst({
      where: { tenantId, medicoId },
      select: { id: true, checkInAt: true, checkOutAt: true },
      orderBy: { checkInAt: 'desc' },
    }),
    medicoTemContratoComEscala(tenantId, medicoId),
  ]);

  const registros = registrosSemanaCompletos.filter(
    (r) => r.checkInAt >= hojeInicio && r.checkInAt <= hojeFim
  );
  const registrosSemana = registrosSemanaCompletos.map((r) => ({
    id: r.id,
    checkInAt: r.checkInAt,
    checkOutAt: r.checkOutAt,
    duracaoMinutos: r.duracaoMinutos,
  }));

  const totalMinutosHojeFechado = registros.reduce((acc, item) => acc + (item.duracaoMinutos || 0), 0);
  const minutosEmAbertoHoje =
    aberto && aberto.checkInAt >= hojeInicio
      ? Math.max(0, Math.floor((now.getTime() - new Date(aberto.checkInAt).getTime()) / 60000))
      : 0;
  const totalMinutos = totalMinutosHojeFechado + minutosEmAbertoHoje;

  const totalSemanaFechado = registrosSemana.reduce((acc, item) => acc + (item.duracaoMinutos || 0), 0);
  const minutosEmAbertoSemana = aberto
    ? Math.max(
        0,
        Math.floor(
          (now.getTime() - Math.max(new Date(aberto.checkInAt).getTime(), semanaInicio.getTime())) / 60000
        )
      )
    : 0;
  const totalMinutosSemana = totalSemanaFechado + minutosEmAbertoSemana;

  const escalaEquipeDoDiaP = aberto?.escalaId
    ? prisma.escalaEquipe.findMany({
        where: { tenantId, escalaId: aberto.escalaId },
        select: { equipeId: true },
      })
    : Promise.resolve([] as Array<{ equipeId: string }>);

  const minhasEquipesP = prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: {
      equipeId: true,
      equipe: { select: { nome: true, subgrupoId: true } },
    },
    orderBy: { equipe: { nome: 'asc' } },
  });

  const plantoesHojeRowsP = prisma.escalaPlantao.findMany({
    where: {
      tenantId,
      medicoId,
      data: { gte: hojeInicio, lte: hojeFim },
      escala: escalaWhereMedicoNaEquipe(tenantId, medicoId),
    },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escalaId: true,
      escala: { select: { contratoAtivoId: true } },
    },
  });

  const [equipesNaEscalaRows, minhasEquipes, plantoesHojeRows] = await Promise.all([
    escalaEquipeDoDiaP,
    minhasEquipesP,
    plantoesHojeRowsP,
  ]);

  const equipeIdsNaEscala = new Set(equipesNaEscalaRows.map((e) => e.equipeId));
  const equipeDoDia: string[] =
    aberto?.escalaId != null
      ? minhasEquipes.filter((em) => equipeIdsNaEscala.has(em.equipeId)).map((em) => em.equipe.nome)
      : [];

  const minhasEquipesNomes = minhasEquipes.map((em) => em.equipe.nome);
  const equipeIds = minhasEquipes.map((em) => em.equipeId);
  const medicoEquipesGeo: MedicoEquipeGeoLinha[] = minhasEquipes.map((em) => ({
    equipeId: em.equipeId,
    subgrupoId: em.equipe.subgrupoId ?? null,
  }));

  const configHorarioP =
    equipeIds.length > 0
      ? prisma.configPontoEletronico.findFirst({
          where: { tenantId, equipeId: { in: equipeIds } },
          select: { horarioEntrada: true, horarioSaida: true },
        })
      : Promise.resolve(null);

  const configGeoP = getConfigPontoParaMedico(
    tenantId,
    medicoId,
    aberto?.escalaId ?? null,
    medicoEquipesGeo
  );

  const [configRow, configGeo] = await Promise.all([configHorarioP, configGeoP]);

  let configHorario: { horarioEntrada: string | null; horarioSaida: string | null } = {
    horarioEntrada: null,
    horarioSaida: null,
  };
  if (configRow) {
    configHorario = {
      horarioEntrada: configRow.horarioEntrada ?? null,
      horarioSaida: configRow.horarioSaida ?? null,
    };
  }

  const exigeGeolocalizacao = configGeo != null;
  const cidsHoje = [...new Set(plantoesHojeRows.map((p) => p.escala?.contratoAtivoId).filter(Boolean) as string[])];
  const tipoMapsHoje = await loadTiposMapPorContratoLeitura(tenantId, cidsHoje);
  const plantoesHoje = plantoesHojeRows.map((p) => {
    const cid = p.escala?.contratoAtivoId ?? '';
    const base = {
      id: p.id,
      data: p.data.toISOString().slice(0, 10),
      gradeId: p.gradeId,
      escalaId: p.escalaId,
    };
    return enrichPlantaoComTipo(base, cid, tipoMapsHoje);
  });

  const payload = {
    registroAberto: aberto,
    registrosHoje: registros,
    totalMinutosHoje: totalMinutos,
    totalMinutosSemana,
    ultimoRegistroPonto: ultimoRegistro,
    equipeDoDia,
    minhasEquipes: minhasEquipesNomes,
    configHorario,
    exigeGeolocalizacao,
    temContratoComEscala,
    plantoesHoje,
  };
  if (CACHE_TTL_MS > 0) {
    setCached(meuDiaCache, cacheKey(tenantId, medicoId), payload);
  }
  return payload;
}

export async function listMinhasEscalasService(tenantId: string, medicoId: string) {
  if (CACHE_TTL_MS > 0) {
    const hit = getCached(minhasEscalasCache, cacheKey(tenantId, medicoId));
    if (hit) return hit as any;
  }

  const alocacoesP = prisma.escalaMedico.findMany({
    where: {
      tenantId,
      medicoId,
      ativo: true,
      escala: escalaWhereMedicoNaEquipe(tenantId, medicoId),
    },
    select: {
      escala: {
        select: {
          id: true,
          nome: true,
          dataInicio: true,
          dataFim: true,
          ativo: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  /** groupBy evita varrer todos os plantões do médico (findMany+distinct ficava O(n) com histórico grande). */
  const plantoesEscalaIdsP = prisma.escalaPlantao.groupBy({
    by: ['escalaId'],
    where: {
      tenantId,
      medicoId,
      escala: escalaWhereMedicoNaEquipe(tenantId, medicoId),
    },
  });

  const equipesDoMedicoP = prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: { equipeId: true },
  });

  const temSoPontoP = medicoTemContratoSoPonto(tenantId, medicoId);

  const [alocacoes, plantoesEscalaIds, equipesDoMedico, temContratoSoPontoFlag] = await Promise.all([
    alocacoesP,
    plantoesEscalaIdsP,
    equipesDoMedicoP,
    temSoPontoP,
  ]);

  const uniqueByEscala = new Map<string, any>();
  for (const item of alocacoes) {
    if (!uniqueByEscala.has(item.escala.id)) {
      uniqueByEscala.set(item.escala.id, { ...item.escala, equipes: [] as string[] });
    }
  }

  const escalaIdsDePlantoes = plantoesEscalaIds.map((r) => r.escalaId).filter(Boolean) as string[];
  if (escalaIdsDePlantoes.length > 0) {
    const escalasDePlantoes = await prisma.escala.findMany({
      where: { tenantId, id: { in: escalaIdsDePlantoes }, ativo: true },
      select: { id: true, nome: true, dataInicio: true, dataFim: true, ativo: true },
    });
    for (const e of escalasDePlantoes) {
      if (!uniqueByEscala.has(e.id)) {
        uniqueByEscala.set(e.id, { ...e, equipes: [] as string[] });
      }
    }
  }

  const meuEquipeIds = [...new Set(equipesDoMedico.map((e) => e.equipeId))];
  if (meuEquipeIds.length > 0) {
    const escalasPorEquipe = await prisma.escalaEquipe.findMany({
      where: { tenantId, equipeId: { in: meuEquipeIds } },
      select: {
        equipe: { select: { subgrupo: { select: { usaPonto: true } } } },
        escala: {
          select: {
            id: true,
            nome: true,
            dataInicio: true,
            dataFim: true,
            ativo: true,
          },
        },
      },
    });
    for (const row of escalasPorEquipe) {
      const e = row.escala;
      const podePonto = row.equipe?.subgrupo?.usaPonto === true;
      if (!e?.ativo || !podePonto) continue;
      if (!uniqueByEscala.has(e.id)) {
        uniqueByEscala.set(e.id, {
          id: e.id,
          nome: e.nome,
          dataInicio: e.dataInicio,
          dataFim: e.dataFim,
          ativo: e.ativo,
          equipes: [] as string[],
        });
      }
    }
  }

  const escalaIds = Array.from(uniqueByEscala.keys());
  const escalasMeta =
    escalaIds.length > 0
      ? await prisma.escala.findMany({
          where: { id: { in: escalaIds }, tenantId },
          select: { id: true, contratoAtivoId: true },
        })
      : [];
  const contratoPorEscala = new Map(escalasMeta.map((e) => [e.id, e.contratoAtivoId]));
  const contratoIdsUnicos = [...new Set(escalasMeta.map((e) => e.contratoAtivoId))];
  const tipoMapsPorContrato =
    contratoIdsUnicos.length > 0
      ? await loadTiposMapPorContratoLeitura(tenantId, contratoIdsUnicos)
      : new Map<string, Map<string, TipoPlantao>>();

  // Evita N+1: buscar equipes/grades em lote para todas as escalas do médico.
  const [equipesNaEscalaRows, plantoesGradeRows] = await Promise.all([
    escalaIds.length > 0
      ? prisma.escalaEquipe.findMany({
          where: { tenantId, escalaId: { in: escalaIds } },
          select: { escalaId: true, equipeId: true },
        })
      : Promise.resolve([] as Array<{ escalaId: string; equipeId: string }>),
    escalaIds.length > 0
      ? prisma.escalaPlantao.findMany({
          where: { tenantId, medicoId, escalaId: { in: escalaIds } },
          select: { escalaId: true, gradeId: true },
        })
      : Promise.resolve([] as Array<{ escalaId: string; gradeId: string }>),
  ]);

  const equipeIdsAll = Array.from(new Set(equipesNaEscalaRows.map((r) => r.equipeId)));
  const minhasEquipesRows =
    equipeIdsAll.length > 0
      ? await prisma.equipeMedico.findMany({
          where: { tenantId, medicoId, equipeId: { in: equipeIdsAll } },
          select: { equipeId: true, equipe: { select: { nome: true } } },
        })
      : [];
  const equipeNomePorId = new Map(minhasEquipesRows.map((r) => [r.equipeId, r.equipe.nome]));

  const equipeIdsPorEscala = new Map<string, Set<string>>();
  for (const row of equipesNaEscalaRows) {
    let set = equipeIdsPorEscala.get(row.escalaId);
    if (!set) {
      set = new Set<string>();
      equipeIdsPorEscala.set(row.escalaId, set);
    }
    set.add(row.equipeId);
  }

  const gradeIdsPorEscala = new Map<string, Set<string>>();
  for (const row of plantoesGradeRows) {
    const gid = (row.gradeId || '').toLowerCase().trim();
    if (!gid) continue;
    let set = gradeIdsPorEscala.get(row.escalaId);
    if (!set) {
      set = new Set<string>();
      gradeIdsPorEscala.set(row.escalaId, set);
    }
    set.add(gid);
  }

  for (const escalaId of escalaIds) {
    const entry = uniqueByEscala.get(escalaId);
    if (!entry) continue;

    const eids = Array.from(equipeIdsPorEscala.get(escalaId) ?? []);
    entry.equipes = eids.map((id) => equipeNomePorId.get(id)).filter(Boolean);

    const gids = Array.from(gradeIdsPorEscala.get(escalaId) ?? []);
    entry.gradeIds = gids;

    const cid = contratoPorEscala.get(escalaId);
    const tmap = cid ? tipoMapsPorContrato.get(cid) : undefined;
    entry.gradeFaixas = gids.map((gid) => {
      const t = tmap?.get(gid);
      return faixaHorarioLabelExibicao(gid, t ?? null);
    });
  }

  const result = Array.from(uniqueByEscala.values());
  if (temContratoSoPontoFlag && !result.some((e) => e.id === PONTO_SEM_ESCALA_ESCALA_ID)) {
    result.push({
      id: PONTO_SEM_ESCALA_ESCALA_ID,
      nome: 'Ponto (sem escala de plantão)',
      dataInicio: null,
      dataFim: null,
      ativo: true,
      equipes: [],
      gradeIds: [],
      gradeFaixas: [],
    });
  }

  /** Ponto de referência GPS (igual ao usado no check-in) para o app escolher a escala mais próxima. */
  const preloadedMedicoEquipes: PreloadedMedicoEquipesGeo = (
    await prisma.equipeMedico.findMany({
      where: { tenantId, medicoId },
      select: { equipeId: true, equipe: { select: { subgrupoId: true } } },
    })
  ).map((r) => ({ equipeId: r.equipeId, subgrupoId: r.equipe.subgrupoId ?? null }));

  await Promise.all(
    result.map(async (entry: (typeof result)[number] & { referenciaGeo?: unknown }) => {
      const escalaIdParam = entry.id === PONTO_SEM_ESCALA_ESCALA_ID ? null : entry.id;
      const raw = await getConfigPontoParaMedico(tenantId, medicoId, escalaIdParam, preloadedMedicoEquipes);
      entry.referenciaGeo = raw
        ? {
            latitude: Number(raw.latitude),
            longitude: Number(raw.longitude),
            raioMetros: Number(raw.raioMetros),
          }
        : null;
    })
  );

  if (CACHE_TTL_MS > 0) {
    setCached(minhasEscalasCache, cacheKey(tenantId, medicoId), result);
  }
  return result;
}

/**
 * Uma ida ao banco em paralelo: dados do dia + escalas (tela Ponto Eletrônico).
 * Reduz round-trips HTTP quando o cliente usa um único GET.
 */
const painelTiming = process.env.MEDICO_DASHBOARD_TIMING === '1';

export async function getPainelPontoEletronicoInicialService(tenantId: string, medicoId: string) {
  const t0 = Date.now();
  const [meuDia, escalas] = await Promise.all([
    (async () => {
      const t = Date.now();
      const r = await getMeuDiaPontoService(tenantId, medicoId);
      if (painelTiming) console.log(`[medico/dashboard]   └ meuDia ${Date.now() - t}ms`);
      return r;
    })(),
    (async () => {
      const t = Date.now();
      const r = await listMinhasEscalasService(tenantId, medicoId);
      if (painelTiming) console.log(`[medico/dashboard]   └ minhasEscalas ${Date.now() - t}ms`);
      return r;
    })(),
  ]);
  if (painelTiming) {
    console.log(`[medico/dashboard] painel interno ${Date.now() - t0}ms (paralelo meuDia+escalas)`);
  }
  return { meuDia, escalas };
}

export async function getHistoricoPontosMedicoService(
  tenantId: string,
  medicoId: string,
  ano?: number,
  mes?: number
) {
  const now = new Date();
  const anoRef = Number.isInteger(ano) && (ano as number) >= 2000 ? (ano as number) : now.getFullYear();
  const mesRef = Number.isInteger(mes) && (mes as number) >= 1 && (mes as number) <= 12 ? (mes as number) : now.getMonth() + 1;

  const inicioMes = new Date(anoRef, mesRef - 1, 1, 0, 0, 0, 0);
  const fimMes = new Date(anoRef, mesRef, 0, 23, 59, 59, 999);

  const relatorio = (await listRegistrosPontoAdminService(tenantId, {
    medicoId,
    dataInicio: inicioMes.toISOString(),
    dataFim: fimMes.toISOString(),
  })) as any;

  const registros = (Array.isArray(relatorio?.data) ? relatorio.data : []) as Array<any>;
  const escalaIds = [...new Set(registros.map((r) => r.escalaId).filter(Boolean))] as string[];

  const escalas = escalaIds.length
    ? await prisma.escala.findMany({
        where: { tenantId, id: { in: escalaIds } },
        select: { id: true, contratoAtivoId: true, nome: true },
      })
    : [];
  const escalaById = new Map(escalas.map((e) => [e.id, e]));

  const [equipesEscala, equipesMedico] = await Promise.all([
    escalaIds.length
      ? prisma.escalaEquipe.findMany({
          where: { tenantId, escalaId: { in: escalaIds } },
          select: {
            escalaId: true,
            equipeId: true,
            equipe: { select: { id: true, nome: true, subgrupoId: true } },
          },
        })
      : Promise.resolve([] as Array<any>),
    prisma.equipeMedico.findMany({
      where: { tenantId, medicoId },
      select: { equipeId: true },
    }),
  ]);
  const equipeIdsDoMedico = new Set(equipesMedico.map((x) => x.equipeId));
  const contextoEscala = new Map<
    string,
    { equipeId: string; equipeNome: string; subgrupoId: string; contratoAtivoId: string }
  >();
  for (const row of equipesEscala) {
    if (!equipeIdsDoMedico.has(row.equipeId)) continue;
    if (!row.equipe?.subgrupoId) continue;
    const escala = escalaById.get(row.escalaId);
    if (!escala?.contratoAtivoId) continue;
    if (!contextoEscala.has(row.escalaId)) {
      contextoEscala.set(row.escalaId, {
        equipeId: row.equipe.id,
        equipeNome: row.equipe.nome,
        subgrupoId: row.equipe.subgrupoId,
        contratoAtivoId: escala.contratoAtivoId,
      });
    }
  }

  const valoresPorContexto = new Map<string, Map<string, { global: number | null; porDia: Record<string, number | null> }>>();
  for (const ctx of contextoEscala.values()) {
    const k = `${ctx.contratoAtivoId}::${ctx.subgrupoId}::${ctx.equipeId}`;
    if (valoresPorContexto.has(k)) continue;
    const rows = await getValoresPlantaoService(tenantId, ctx.contratoAtivoId, ctx.subgrupoId, ctx.equipeId);
    const gradeMap = new Map<string, { global: number | null; porDia: Record<string, number | null> }>();
    for (const r of rows as any[]) {
      const gradeId = String(r.gradeId ?? '').trim().toLowerCase();
      if (!gradeId) continue;
      const global =
        r.valorHora != null && Number.isFinite(Number(r.valorHora)) ? Number(r.valorHora) : null;
      const porDia = (r.valorHoraPorDia ?? {}) as Record<string, number | null>;
      gradeMap.set(gradeId, { global, porDia });
    }
    valoresPorContexto.set(k, gradeMap);
  }

  const diaKeyFromIso = (iso: string): 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom' => {
    const d = new Date(iso);
    switch (d.getDay()) {
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
  };

  const valorPorRegistro = (r: any): number | null => {
    if (r.repasseValorCongelado != null) return Number(r.repasseValorCongelado);
    const duracaoHoras = Math.max(0, Number(r.duracaoMinutos ?? 0)) / 60;
    if (duracaoHoras <= 0) return null;

    const valorHoraDireto =
      (r.id ? relatorio?.valorHoraPorRegistroPontoId?.[r.id] : undefined) ??
      (r.medicoId && r.escalaId ? relatorio?.valorHoraPorMedicoEscala?.[`${r.medicoId}::${r.escalaId}`] : undefined) ??
      (r.escalaId == null && r.medicoId ? relatorio?.valorHoraPorMedico?.[r.medicoId] : undefined);
    if (valorHoraDireto != null && Number.isFinite(Number(valorHoraDireto))) {
      return Math.round(Number(valorHoraDireto) * duracaoHoras * 100) / 100;
    }

    if (r.escalaId) {
      const ctx = contextoEscala.get(r.escalaId);
      if (ctx) {
        const gradeId = r.id ? relatorio?.gradeIdPlantaoPorRegistroPontoId?.[r.id] : undefined;
        if (gradeId) {
          const ctxKey = `${ctx.contratoAtivoId}::${ctx.subgrupoId}::${ctx.equipeId}`;
          const gradeMap = valoresPorContexto.get(ctxKey);
          const row = gradeMap?.get(String(gradeId).toLowerCase());
          if (row) {
            const dk = diaKeyFromIso(r.checkInAt instanceof Date ? r.checkInAt.toISOString() : String(r.checkInAt));
            const byDay = row.porDia?.[dk];
            const rate = byDay != null && Number.isFinite(Number(byDay)) ? Number(byDay) : row.global;
            if (rate != null && Number.isFinite(rate) && rate > 0) {
              return Math.round(rate * duracaoHoras * 100) / 100;
            }
          }
        }
      }
    }
    return null;
  };

  const registrosComValor = registros.map((r) => ({
    ...r,
    valorCalculado: valorPorRegistro(r),
  }));

  const totalValorCentavos = registrosComValor.reduce((acc, item) => {
    const v = item.valorCalculado != null ? Number(item.valorCalculado) : 0;
    return acc + Math.round(v * 100);
  }, 0);

  return {
    referencia: { ano: anoRef, mes: mesRef },
    totalRegistros: registrosComValor.length,
    totalMinutos: registrosComValor.reduce((acc, item) => acc + (item.duracaoMinutos || 0), 0),
    totalValorCentavos,
    totalValor: totalValorCentavos / 100,
    registros: registrosComValor.map((r) => ({
      id: r.id,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      duracaoMinutos: r.duracaoMinutos,
      checkInAtrasado: !!r.checkInAtrasado,
      minutosAtrasoCheckin: r.minutosAtrasoCheckin ?? null,
      valor: r.valorCalculado,
      escalaId: r.escalaId,
      escala: r.escala,
      equipe: r.escalaId ? (contextoEscala.get(r.escalaId)?.equipeNome ?? null) : null,
    })),
  };
}

/** Lista colegas (outros médicos) das mesmas equipes do médico na escala informada, para troca de plantão. */
export async function listEquipeColegasService(
  tenantId: string,
  medicoId: string,
  escalaId: string
) {
  // Fail-closed: se a escala/contrato não permite troca, não expor lista de colegas.
  const escala = await prisma.escala.findFirst({
    where: { tenantId, id: escalaId, ativo: true },
    select: { id: true, contratoAtivo: { select: { permiteTrocaPlantao: true } } },
  });
  if (!escala?.contratoAtivo?.permiteTrocaPlantao) return [];

  const equipesNaEscala = await prisma.escalaEquipe.findMany({
    where: { tenantId, escalaId },
    select: { equipeId: true },
  });
  const equipeIds = equipesNaEscala.map((e) => e.equipeId);
  const meuEquipeIds = await prisma.equipeMedico.findMany({
    where: { tenantId, medicoId, equipeId: { in: equipeIds } },
    select: { equipeId: true },
  });
  const idsEquipesQueParticipo = new Set(meuEquipeIds.map((e) => e.equipeId));
  if (idsEquipesQueParticipo.size === 0) return [];

  const colegas = await prisma.equipeMedico.findMany({
    where: {
      tenantId,
      equipeId: { in: Array.from(idsEquipesQueParticipo) },
      medicoId: { not: medicoId },
      medico: { ativo: true },
    },
    select: {
      medicoId: true,
      medico: {
        select: { id: true, nomeCompleto: true, crm: true },
      },
    },
    distinct: ['medicoId'],
  });

  return colegas
    .filter((c) => c.medico)
    .map((c) => ({
      id: c.medico!.id,
      nomeCompleto: c.medico!.nomeCompleto,
      crm: c.medico!.crm,
    }));
}

/** Colega = mesmas equipes na escala (regra de troca). */
async function medicoEhColegaDoSolicitanteNaEscala(
  tenantId: string,
  solicitanteId: string,
  medicoCandidatoId: string,
  escalaId: string
): Promise<boolean> {
  if (solicitanteId === medicoCandidatoId) return false;
  const colegas = await listEquipeColegasService(tenantId, solicitanteId, escalaId);
  return colegas.some((c) => c.id === medicoCandidatoId);
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/**
 * Escala onde o médico ainda participa de alguma equipe ligada à escala.
 * Evita exibir plantões/alocações de escalas das quais já foi removido (linhas órfãs em escala_plantoes / escala_medicos).
 */
function escalaWhereMedicoNaEquipe(tenantId: string, medicoId: string) {
  return {
    ativo: true,
    escalaEquipes: {
      some: {
        equipe: {
          equipeMedicos: { some: { tenantId, medicoId } },
        },
      },
    },
  };
}

/** Próximos plantões do médico (data >= hoje), ordenados por data, no máximo 2. Apenas escalas ativas. */
export async function listProximosPlantoesService(tenantId: string, medicoId: string, limit = 2) {
  const hoje = startOfDay(new Date());
  const plantoes = await prisma.escalaPlantao.findMany({
    where: {
      tenantId,
      medicoId,
      data: { gte: hoje },
      escala: escalaWhereMedicoNaEquipe(tenantId, medicoId),
    },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escalaId: true,
      escala: {
        select: {
          nome: true,
          contratoAtivoId: true,
          contratoAtivo: { select: { permiteTrocaPlantao: true } },
        },
      },
    },
    orderBy: { data: 'asc' },
    take: limit,
  });

  const cids = [...new Set(plantoes.map((p) => p.escala?.contratoAtivoId).filter(Boolean) as string[])];
  const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, cids);
  const escalaIds = [...new Set(plantoes.map((p) => p.escalaId))];
  const prodMap = await batchResolveProducaoMedicoNasEscalas(tenantId, medicoId, escalaIds);

  return plantoes.map((p) => {
    const cid = p.escala?.contratoAtivoId ?? '';
    const prod = prodMap.get(p.escalaId) ?? { allowPonto: false, requireJanelaPlantao: false };
    const base = {
      id: p.id,
      data: p.data.toISOString().slice(0, 10),
      gradeId: p.gradeId,
      escalaId: p.escalaId,
      escalaNome: p.escala?.nome ?? null,
      permiteTrocaPlantao: !!p.escala?.contratoAtivo?.permiteTrocaPlantao,
      usaPonto: prod.allowPonto,
      /** UI: true = respeita janela do plantão para o link “Bater ponto”; false = fluxo só ponto na escala. */
      usaEscala: prod.requireJanelaPlantao,
    };
    return enrichPlantaoComTipo(base, cid, tipoMaps);
  });
}

/** Plantões do médico em um mês (calendário). Escala ativa. */
export async function listMeusPlantoesMesCalendarioService(
  tenantId: string,
  medicoId: string,
  ano: number,
  mes: number,
  equipeIds?: string[]
) {
  if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
    throw { statusCode: 400, message: 'Período inválido' };
  }
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);

  let escalaIdFilter: string[] | undefined = undefined;
  if (equipeIds && equipeIds.length > 0) {
    // Fail-closed: só considera equipeIds em que o médico realmente participa.
    const equipesDoMedico = await prisma.equipeMedico.findMany({
      where: { tenantId, medicoId, equipeId: { in: equipeIds } },
      select: { equipeId: true },
    });

    const allowedEquipeIds = equipesDoMedico.map((e) => e.equipeId);
    if (allowedEquipeIds.length === 0) {
      return [];
    }

    const escalasPorEquipe = await prisma.escalaEquipe.findMany({
      where: { tenantId, equipeId: { in: allowedEquipeIds } },
      select: { escalaId: true },
    });

    const allowedEscalaIds = Array.from(new Set(escalasPorEquipe.map((e) => e.escalaId)));
    if (allowedEscalaIds.length === 0) {
      return [];
    }

    escalaIdFilter = allowedEscalaIds;
  }

  const plantoes = await prisma.escalaPlantao.findMany({
    where: {
      tenantId,
      medicoId,
      data: { gte: inicio, lte: fim },
      escala: escalaWhereMedicoNaEquipe(tenantId, medicoId),
      ...(escalaIdFilter ? { escalaId: { in: escalaIdFilter } } : {}),
    },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escalaId: true,
      escala: {
        select: {
          nome: true,
          contratoAtivoId: true,
          contratoAtivo: { select: { permiteTrocaPlantao: true } },
        },
      },
    },
    orderBy: [{ data: 'asc' }, { gradeId: 'asc' }],
  });

  const cids = [...new Set(plantoes.map((p) => p.escala?.contratoAtivoId).filter(Boolean) as string[])];
  const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, cids);

  return plantoes.map((p) => {
    const cid = p.escala?.contratoAtivoId ?? '';
    const base = {
      id: p.id,
      data: p.data.toISOString().slice(0, 10),
      gradeId: p.gradeId,
      escalaId: p.escalaId,
      escalaNome: p.escala?.nome ?? null,
      permiteTrocaPlantao: !!p.escala?.contratoAtivo?.permiteTrocaPlantao,
    };
    return enrichPlantaoComTipo(base, cid, tipoMaps);
  });
}

/** Lista as equipes em que o médico participa (para o filtro do calendário). */
export async function listMinhasEquipesCalendarioService(tenantId: string, medicoId: string) {
  const rows = await prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: {
      equipeId: true,
      equipe: { select: { nome: true } },
    },
    orderBy: { equipe: { nome: 'asc' } },
  });

  return rows
    .filter((r) => !!r.equipeId && !!r.equipe?.nome)
    .map((r) => ({
      id: r.equipeId,
      nome: r.equipe.nome,
    }));
}

const MINUTOS_ANTES_INICIO_PARA_TROCA = 10;
const STATUS_TROCA_PENDENTE = 'PENDENTE';
const STATUS_TROCA_ACEITA = 'ACEITA';
const STATUS_TROCA_RECUSADA = 'RECUSADA';

function plantaoAindaNoPrazoParaTroca(
  dataPlantao: Date,
  gradeId: string,
  contratoAtivoId: string,
  tipoMaps: Awaited<ReturnType<typeof loadTiposMapPorContratoLeitura>>
): boolean {
  const dataStr = dataPlantao.toISOString().slice(0, 10);
  const schedule = scheduleForGradeId(gradeId, tipoMaps.get(contratoAtivoId));
  const inicio = inicioPlantaoAsDate(dataStr, schedule);
  const limiteTroca = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_TROCA * 60 * 1000);
  return new Date() < limiteTroca;
}

/** Plantões futuros de um médico na escala, dentro do prazo de troca (núcleo compartilhado). */
async function listPlantoesDoMedicoNaEscalaElegiveisParaTroca(
  tenantId: string,
  escalaId: string,
  medicoTargetId: string
): Promise<Array<{ id: string; data: string; gradeId: string; gradeLabel: string }>> {
  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId, ativo: true },
    select: {
      id: true,
      contratoAtivo: { select: { id: true, permiteTrocaPlantao: true } },
    },
  });
  if (!escala?.contratoAtivo?.permiteTrocaPlantao) {
    return [];
  }

  const plantoes = await prisma.escalaPlantao.findMany({
    where: {
      tenantId,
      escalaId,
      medicoId: medicoTargetId,
      data: { gte: startOfToday() },
    },
    orderBy: [{ data: 'asc' }, { gradeId: 'asc' }],
    select: { id: true, data: true, gradeId: true },
  });

  const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, [escala.contratoAtivo.id]);
  const tipoMap = tipoMaps.get(escala.contratoAtivo.id);

  const out: Array<{ id: string; data: string; gradeId: string; gradeLabel: string }> = [];
  for (const pl of plantoes) {
    if (
      !plantaoAindaNoPrazoParaTroca(pl.data, pl.gradeId, escala.contratoAtivo.id, tipoMaps)
    ) {
      continue;
    }
    const tipoRow = tipoMap?.get(pl.gradeId);
    out.push({
      id: pl.id,
      data: pl.data.toISOString().slice(0, 10),
      gradeId: pl.gradeId,
      gradeLabel: faixaHorarioLabelExibicao(pl.gradeId, tipoRow ?? null),
    });
  }
  return out;
}

/**
 * Plantões futuros do colega na mesma escala, ainda dentro do prazo para solicitar troca (permuta).
 */
export async function listPlantoesColegaParaTrocaService(
  tenantId: string,
  medicoSolicitanteId: string,
  escalaId: string,
  medicoDestinoId: string
) {
  const colegas = await listEquipeColegasService(tenantId, medicoSolicitanteId, escalaId);
  if (!colegas.some((c) => c.id === medicoDestinoId)) {
    throw { statusCode: 403, message: 'Profissional não pertence às mesmas equipes nesta escala' };
  }
  return listPlantoesDoMedicoNaEscalaElegiveisParaTroca(tenantId, escalaId, medicoDestinoId);
}

/** Plantões do próprio médico na escala (para aceitar permuta aberta à equipe e escolher contrapartida). */
export async function listMeusPlantoesParaTrocaService(
  tenantId: string,
  medicoId: string,
  escalaId: string
) {
  return listPlantoesDoMedicoNaEscalaElegiveisParaTroca(tenantId, escalaId, medicoId);
}

const TROCA_SOLIC_TIPO_PERMUTA = 'PERMUTA' as const;
const TROCA_SOLIC_TIPO_CEDER = 'CEDER' as const;

export type SolicitarTrocaPlantaoInput =
  | { tipo?: typeof TROCA_SOLIC_TIPO_PERMUTA; modo: 'equipe' }
  | {
      tipo?: typeof TROCA_SOLIC_TIPO_PERMUTA;
      modo: 'colega';
      medicoDestinoId: string;
      plantaoContrapartidaId: string;
    }
  | { tipo: typeof TROCA_SOLIC_TIPO_CEDER; modo: 'equipe' }
  | { tipo: typeof TROCA_SOLIC_TIPO_CEDER; modo: 'colega'; medicoDestinoId: string };

/**
 * Permuta (troca bilateral) ou cessão (cede o plantão ao aceitante). Equipe ou colega direto.
 */
export async function solicitarTrocaPlantaoService(
  tenantId: string,
  medicoSolicitanteId: string,
  plantaoId: string,
  input: SolicitarTrocaPlantaoInput
) {
  const plantao = await prisma.escalaPlantao.findFirst({
    where: { id: plantaoId, tenantId, medicoId: medicoSolicitanteId },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escalaId: true,
      escala: {
        select: {
          nome: true,
          ativo: true,
          contratoAtivoId: true,
          contratoAtivo: { select: { permiteTrocaPlantao: true } },
        },
      },
    },
  });

  if (!plantao) {
    throw { statusCode: 404, message: 'Plantão não encontrado' };
  }
  if (!plantao.escala.ativo) {
    throw { statusCode: 400, message: 'Escala inativa' };
  }
  if (!plantao.escala.contratoAtivo?.permiteTrocaPlantao) {
    throw { statusCode: 403, message: 'Troca de plantão não permitida para este contrato' };
  }

  const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, [plantao.escala.contratoAtivoId]);
  if (
    !plantaoAindaNoPrazoParaTroca(plantao.data, plantao.gradeId, plantao.escala.contratoAtivoId, tipoMaps)
  ) {
    throw { statusCode: 400, message: 'Período para solicitar troca encerrado' };
  }

  const tipoMap = tipoMaps.get(plantao.escala.contratoAtivoId);
  const tipoRow = tipoMap?.get(plantao.gradeId);
  const gradeLabel = faixaHorarioLabelExibicao(plantao.gradeId, tipoRow ?? null);
  const dataStr = plantao.data.toISOString().slice(0, 10);
  const tipoSol =
    input.tipo === TROCA_SOLIC_TIPO_CEDER ? TROCA_SOLIC_TIPO_CEDER : TROCA_SOLIC_TIPO_PERMUTA;

  if (input.modo === 'equipe') {
    const pendenteOutra = await prisma.solicitacaoTrocaPlantao.findFirst({
      where: {
        tenantId,
        status: STATUS_TROCA_PENDENTE,
        OR: [{ escalaPlantaoId: plantao.id }, { contrapartidaPlantaoId: plantao.id }],
      },
    });
    if (pendenteOutra) {
      throw {
        statusCode: 409,
        message: 'Já existe solicitação pendente envolvendo este plantão',
      };
    }

    const colegas = await listEquipeColegasService(tenantId, medicoSolicitanteId, plantao.escalaId);
    if (colegas.length === 0) {
      throw { statusCode: 403, message: 'Não há colegas na equipe nesta escala para receber o pedido' };
    }

    const solicitante = await prisma.medico.findFirst({
      where: { id: medicoSolicitanteId, tenantId, ativo: true },
      select: { nomeCompleto: true },
    });
    if (!solicitante) {
      throw { statusCode: 404, message: 'Profissional não encontrado' };
    }

    const solicitacao = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const row = await tx.solicitacaoTrocaPlantao.create({
        data: {
          tenantId,
          escalaPlantaoId: plantao.id,
          contrapartidaPlantaoId: null,
          medicoSolicitanteId,
          medicoDestinoId: null,
          tipoSolicitacao: tipoSol,
          status: STATUS_TROCA_PENDENTE,
        } as Parameters<Prisma.TransactionClient['solicitacaoTrocaPlantao']['create']>[0]['data'],
      });
      await createAuditLog(
        {
          acao: 'SOLICITAR_TROCA_PLANTAO',
          tenantId,
          medicoId: medicoSolicitanteId,
          detalhes: {
            solicitacaoId: row.id,
            plantaoId: plantao.id,
            escalaId: plantao.escalaId,
            paraEquipeInteira: true,
            tipoSolicitacao: tipoSol,
          },
        },
        tx
      );
      return row;
    });

    try {
      const nm = await import('./notificacao-medico.service');
      if (tipoSol === TROCA_SOLIC_TIPO_CEDER) {
        await nm.notificarCederPlantaoAbertaEquipe(tenantId, {
          solicitacaoId: solicitacao.id,
          medicoSolicitanteId,
          colegaMedicoIds: colegas.map((c) => c.id),
          solicitanteNome: solicitante.nomeCompleto.trim(),
          plantaoId: plantao.id,
          escalaId: plantao.escalaId,
          escalaNome: plantao.escala.nome,
          dataPlantaoIso: dataStr,
          gradeLabel,
        });
      } else {
        await nm.notificarTrocaPlantaoAbertaEquipe(tenantId, {
          solicitacaoId: solicitacao.id,
          medicoSolicitanteId,
          colegaMedicoIds: colegas.map((c) => c.id),
          solicitanteNome: solicitante.nomeCompleto.trim(),
          plantaoId: plantao.id,
          escalaId: plantao.escalaId,
          escalaNome: plantao.escala.nome,
          dataPlantaoIso: dataStr,
          gradeLabel,
        });
      }
    } catch (e) {
      console.error('[troca-plantao] Falha ao enviar notificações (registro persistido):', e);
    }

    return { ok: true as const, solicitacaoId: solicitacao.id };
  }

  const { medicoDestinoId, plantaoContrapartidaId } = input as {
    medicoDestinoId: string;
    plantaoContrapartidaId?: string;
  };
  if (medicoSolicitanteId === medicoDestinoId) {
    throw { statusCode: 400, message: 'Selecione outro profissional' };
  }

  if (tipoSol === TROCA_SOLIC_TIPO_CEDER) {
    const pendenteCeder = await prisma.solicitacaoTrocaPlantao.findFirst({
      where: {
        tenantId,
        status: STATUS_TROCA_PENDENTE,
        OR: [{ escalaPlantaoId: plantao.id }, { contrapartidaPlantaoId: plantao.id }],
      },
    });
    if (pendenteCeder) {
      throw {
        statusCode: 409,
        message: 'Já existe solicitação pendente envolvendo este plantão',
      };
    }
    const colegasCeder = await listEquipeColegasService(tenantId, medicoSolicitanteId, plantao.escalaId);
    if (!colegasCeder.some((c) => c.id === medicoDestinoId)) {
      throw { statusCode: 403, message: 'Profissional não pertence às mesmas equipes nesta escala' };
    }
    const [solicitanteCeder, destinoCeder] = await Promise.all([
      prisma.medico.findFirst({
        where: { id: medicoSolicitanteId, tenantId, ativo: true },
        select: { nomeCompleto: true },
      }),
      prisma.medico.findFirst({
        where: { id: medicoDestinoId, tenantId, ativo: true },
        select: { nomeCompleto: true },
      }),
    ]);
    if (!solicitanteCeder || !destinoCeder) {
      throw { statusCode: 404, message: 'Profissional não encontrado' };
    }

    const solicitacaoCeder = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const row = await tx.solicitacaoTrocaPlantao.create({
        data: {
          tenantId,
          escalaPlantaoId: plantao.id,
          contrapartidaPlantaoId: null,
          medicoSolicitanteId,
          medicoDestinoId,
          tipoSolicitacao: TROCA_SOLIC_TIPO_CEDER,
          status: STATUS_TROCA_PENDENTE,
        },
      });
      await createAuditLog(
        {
          acao: 'SOLICITAR_TROCA_PLANTAO',
          tenantId,
          medicoId: medicoSolicitanteId,
          detalhes: {
            solicitacaoId: row.id,
            plantaoId: plantao.id,
            escalaId: plantao.escalaId,
            medicoDestinoId,
            tipoSolicitacao: TROCA_SOLIC_TIPO_CEDER,
            ceder: true,
          },
        },
        tx
      );
      return row;
    });

    try {
      const { notificarCederPlantaoParaColega } = await import('./notificacao-medico.service');
      await notificarCederPlantaoParaColega(tenantId, {
        solicitacaoId: solicitacaoCeder.id,
        medicoSolicitanteId,
        medicoDestinoId,
        solicitanteNome: solicitanteCeder.nomeCompleto.trim(),
        destinoNome: destinoCeder.nomeCompleto.trim(),
        plantaoId: plantao.id,
        escalaId: plantao.escalaId,
        escalaNome: plantao.escala.nome,
        dataPlantaoIso: dataStr,
        gradeLabel,
      });
    } catch (e) {
      console.error('[troca-plantao] Falha ao enviar notificações (registro persistido):', e);
    }

    return { ok: true as const, solicitacaoId: solicitacaoCeder.id };
  }

  const pidContra = (plantaoContrapartidaId ?? '').trim();
  if (!pidContra) {
    throw { statusCode: 400, message: 'Informe o plantão do colega para permutar' };
  }
  if (plantaoId === pidContra) {
    throw { statusCode: 400, message: 'Selecione um plantão diferente do seu para permutar' };
  }

  const plantaoContra = await prisma.escalaPlantao.findFirst({
    where: { id: pidContra, tenantId, medicoId: medicoDestinoId },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escalaId: true,
    },
  });
  if (!plantaoContra) {
    throw { statusCode: 404, message: 'Plantão do colega não encontrado' };
  }
  if (plantaoContra.escalaId !== plantao.escalaId) {
    throw { statusCode: 400, message: 'Os dois plantões devem ser da mesma escala' };
  }
  if (
    !plantaoAindaNoPrazoParaTroca(
      plantaoContra.data,
      plantaoContra.gradeId,
      plantao.escala.contratoAtivoId,
      tipoMaps
    )
  ) {
    throw {
      statusCode: 400,
      message: 'O plantão escolhido do colega já não está no período para troca',
    };
  }

  const tipoRowContra = tipoMap?.get(plantaoContra.gradeId);
  const gradeLabelContra = faixaHorarioLabelExibicao(plantaoContra.gradeId, tipoRowContra ?? null);
  const dataStrContra = plantaoContra.data.toISOString().slice(0, 10);

  const pendenteOutra = await prisma.solicitacaoTrocaPlantao.findFirst({
    where: {
      tenantId,
      status: STATUS_TROCA_PENDENTE,
      OR: [
        { escalaPlantaoId: plantao.id },
        { escalaPlantaoId: plantaoContra.id },
        { contrapartidaPlantaoId: plantao.id },
        { contrapartidaPlantaoId: plantaoContra.id },
      ],
    },
  });
  if (pendenteOutra) {
    throw {
      statusCode: 409,
      message: 'Já existe solicitação pendente envolvendo um destes plantões',
    };
  }

  const colegas = await listEquipeColegasService(tenantId, medicoSolicitanteId, plantao.escalaId);
  if (!colegas.some((c) => c.id === medicoDestinoId)) {
    throw { statusCode: 403, message: 'Profissional não pertence às mesmas equipes nesta escala' };
  }

  const [solicitante, destino] = await Promise.all([
    prisma.medico.findFirst({
      where: { id: medicoSolicitanteId, tenantId, ativo: true },
      select: { nomeCompleto: true },
    }),
    prisma.medico.findFirst({
      where: { id: medicoDestinoId, tenantId, ativo: true },
      select: { nomeCompleto: true },
    }),
  ]);

  if (!solicitante || !destino) {
    throw { statusCode: 404, message: 'Profissional não encontrado' };
  }

  const solicitacao = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const row = await tx.solicitacaoTrocaPlantao.create({
      data: {
        tenantId,
        escalaPlantaoId: plantao.id,
        contrapartidaPlantaoId: plantaoContra.id,
        medicoSolicitanteId,
        medicoDestinoId,
        tipoSolicitacao: TROCA_SOLIC_TIPO_PERMUTA,
        status: STATUS_TROCA_PENDENTE,
      },
    });
    await createAuditLog(
      {
        acao: 'SOLICITAR_TROCA_PLANTAO',
        tenantId,
        medicoId: medicoSolicitanteId,
        detalhes: {
          solicitacaoId: row.id,
          plantaoId: plantao.id,
          plantaoContrapartidaId: plantaoContra.id,
          escalaId: plantao.escalaId,
          medicoDestinoId,
          tipoSolicitacao: TROCA_SOLIC_TIPO_PERMUTA,
        },
      },
      tx
    );
    return row;
  });

  try {
    const { notificarTrocaPlantaoSolicitada } = await import('./notificacao-medico.service');
    await notificarTrocaPlantaoSolicitada(tenantId, {
      solicitacaoId: solicitacao.id,
      medicoSolicitanteId,
      medicoDestinoId,
      solicitanteNome: solicitante.nomeCompleto.trim(),
      destinoNome: destino.nomeCompleto.trim(),
      plantaoId: plantao.id,
      escalaId: plantao.escalaId,
      escalaNome: plantao.escala.nome,
      dataPlantaoIso: dataStr,
      gradeLabel,
      contrapartidaPlantaoId: plantaoContra.id,
      dataContrapartidaIso: dataStrContra,
      gradeLabelContrapartida: gradeLabelContra,
    });
  } catch (e) {
    console.error('[troca-plantao] Falha ao enviar notificações (registro persistido):', e);
  }

  return { ok: true as const, solicitacaoId: solicitacao.id };
}

export async function listTrocasPlantaoPendentesService(tenantId: string, medicoId: string) {
  const includeBlock = {
    solicitante: { select: { id: true, nomeCompleto: true } },
    destino: { select: { id: true, nomeCompleto: true } },
    plantao: {
      select: {
        id: true,
        data: true,
        gradeId: true,
        escalaId: true,
        escala: { select: { nome: true } },
      },
    },
    plantaoContrapartida: {
      select: {
        id: true,
        data: true,
        gradeId: true,
        escalaId: true,
      },
    },
  } as const;

  const baseRows = await prisma.solicitacaoTrocaPlantao.findMany({
    where: {
      tenantId,
      status: STATUS_TROCA_PENDENTE,
      OR: [{ medicoDestinoId: medicoId }, { medicoSolicitanteId: medicoId }],
    },
    orderBy: { createdAt: 'desc' },
    include: includeBlock,
  });

  const broadcastExtras = (await prisma.solicitacaoTrocaPlantao.findMany({
    where: {
      tenantId,
      status: STATUS_TROCA_PENDENTE,
      medicoDestinoId: null,
      medicoSolicitanteId: { not: medicoId },
    },
    orderBy: { createdAt: 'desc' },
    include: includeBlock,
  } as Parameters<typeof prisma.solicitacaoTrocaPlantao.findMany>[0])) as typeof baseRows;

  const baseIds = new Set(baseRows.map((r) => r.id));
  const extras: typeof baseRows = [];
  for (const r of broadcastExtras) {
    if (baseIds.has(r.id)) continue;
    const ok = await medicoEhColegaDoSolicitanteNaEscala(
      tenantId,
      r.medicoSolicitanteId,
      medicoId,
      r.plantao.escalaId
    );
    if (ok) extras.push(r);
  }

  const mapRow = (r: (typeof baseRows)[number]) => ({
    id: r.id,
    createdAt: r.createdAt,
    plantaoId: r.plantao.id,
    dataPlantao: r.plantao.data,
    escalaId: r.plantao.escalaId,
    escalaNome: r.plantao.escala?.nome ?? null,
    gradeId: r.plantao.gradeId,
    contrapartidaPlantaoId: r.plantaoContrapartida?.id ?? null,
    dataPlantaoContrapartida: r.plantaoContrapartida?.data ?? null,
    gradeIdContrapartida: r.plantaoContrapartida?.gradeId ?? null,
    solicitante: { id: r.solicitante.id, nomeCompleto: r.solicitante.nomeCompleto },
    destino: r.destino
      ? { id: r.destino.id, nomeCompleto: r.destino.nomeCompleto }
      : null,
    paraEquipeInteira: r.medicoDestinoId === null,
    tipoSolicitacao:
      String((r as { tipoSolicitacao?: string }).tipoSolicitacao ?? TROCA_SOLIC_TIPO_PERMUTA).toUpperCase() ===
      TROCA_SOLIC_TIPO_CEDER
        ? TROCA_SOLIC_TIPO_CEDER
        : TROCA_SOLIC_TIPO_PERMUTA,
  });

  const recebidasDiretas = baseRows
    .filter((r) => r.medicoDestinoId === medicoId)
    .map(mapRow);
  const recebidasEquipe = extras.map(mapRow);
  const recebidas = [...recebidasDiretas, ...recebidasEquipe].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const enviadas = baseRows
    .filter((r) => r.medicoSolicitanteId === medicoId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(mapRow);

  return { recebidas, enviadas };
}

export async function aceitarTrocaPlantaoService(
  tenantId: string,
  medicoId: string,
  solicitacaoId: string,
  plantaoContrapartidaIdNoAceite?: string | null
) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const solic = await tx.solicitacaoTrocaPlantao.findFirst({
      where: { id: solicitacaoId, tenantId, status: STATUS_TROCA_PENDENTE },
      include: {
        plantao: { include: { escala: { select: { contratoAtivoId: true } } } },
        plantaoContrapartida: {
          select: { id: true, data: true, gradeId: true, medicoId: true, escalaId: true },
        },
      },
    });
    if (!solic) throw { statusCode: 404, message: 'Solicitação não encontrada' };

    if (solic.medicoSolicitanteId === medicoId) {
      throw { statusCode: 400, message: 'Você não pode aceitar o próprio pedido' };
    }

    const abertaEquipe = solic.medicoDestinoId === null;
    if (abertaEquipe) {
      const okColega = await medicoEhColegaDoSolicitanteNaEscala(
        tenantId,
        solic.medicoSolicitanteId,
        medicoId,
        solic.plantao.escalaId
      );
      if (!okColega) throw { statusCode: 404, message: 'Solicitação não encontrada' };
    } else if (solic.medicoDestinoId !== medicoId) {
      throw { statusCode: 404, message: 'Solicitação não encontrada' };
    }

    const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, [solic.plantao.escala.contratoAtivoId]);
    const cid = solic.plantao.escala.contratoAtivoId;
    if (!plantaoAindaNoPrazoParaTroca(solic.plantao.data, solic.plantao.gradeId, cid, tipoMaps)) {
      throw { statusCode: 400, message: 'Período para aceitar troca encerrado' };
    }

    const tipoSolicNorm = String(
      (solic as { tipoSolicitacao?: string | null }).tipoSolicitacao ?? TROCA_SOLIC_TIPO_PERMUTA
    ).toUpperCase();
    const ehCeder = tipoSolicNorm === TROCA_SOLIC_TIPO_CEDER;

    if (ehCeder) {
      const pendCeder = await tx.solicitacaoTrocaPlantao.findFirst({
        where: {
          tenantId,
          status: STATUS_TROCA_PENDENTE,
          id: { not: solic.id },
          OR: [
            { escalaPlantaoId: solic.escalaPlantaoId },
            { contrapartidaPlantaoId: solic.escalaPlantaoId },
          ],
        },
      });
      if (pendCeder) {
        throw {
          statusCode: 409,
          message: 'Outro pedido pendente envolve este plantão; não é possível aceitar agora',
        };
      }
      const upCeder = await tx.escalaPlantao.updateMany({
        where: { id: solic.escalaPlantaoId, tenantId, medicoId: solic.medicoSolicitanteId },
        data: { medicoId },
      });
      if (upCeder.count === 0) {
        throw { statusCode: 409, message: 'Plantão já não pertence mais ao solicitante' };
      }
      await tx.solicitacaoTrocaPlantao.update({
        where: { id: solic.id },
        data: {
          status: STATUS_TROCA_ACEITA,
          respondidaEm: now,
          medicoDestinoId: medicoId,
        },
      });
      await tx.solicitacaoTrocaPlantao.updateMany({
        where: {
          tenantId,
          status: STATUS_TROCA_PENDENTE,
          id: { not: solic.id },
          OR: [
            { escalaPlantaoId: solic.escalaPlantaoId },
            { contrapartidaPlantaoId: solic.escalaPlantaoId },
          ],
        },
        data: { status: STATUS_TROCA_RECUSADA, respondidaEm: now },
      });
      return { ...solic, contrapartidaPlantaoId: null as string | null, medicoDestinoId: medicoId };
    }

    let contrapartidaId = solic.contrapartidaPlantaoId;
    let bRow: {
      id: string;
      data: Date;
      gradeId: string;
      medicoId: string;
      escalaId: string;
    } | null = solic.plantaoContrapartida;

    if (abertaEquipe) {
      const pid = (plantaoContrapartidaIdNoAceite ?? '').trim();
      if (!pid) {
        throw {
          statusCode: 400,
          message: 'Informe o plantão seu que você oferece na permuta (plantaoContrapartidaId)',
        };
      }
      const b = await tx.escalaPlantao.findFirst({
        where: { id: pid, tenantId, medicoId, escalaId: solic.plantao.escalaId },
        select: { id: true, data: true, gradeId: true, medicoId: true, escalaId: true },
      });
      if (!b) {
        throw { statusCode: 404, message: 'Plantão não encontrado ou não é seu nesta escala' };
      }
      if (b.id === solic.escalaPlantaoId) {
        throw { statusCode: 400, message: 'Escolha outro plantão para permutar' };
      }
      if (!plantaoAindaNoPrazoParaTroca(b.data, b.gradeId, cid, tipoMaps)) {
        throw { statusCode: 400, message: 'O plantão que você escolheu já não está no período para troca' };
      }
      contrapartidaId = b.id;
      bRow = b;
    }

    if (!contrapartidaId || !bRow) {
      if (abertaEquipe) {
        throw { statusCode: 400, message: 'Solicitação sem contrapartida definida' };
      }
      const destId = solic.medicoDestinoId;
      if (!destId) {
        throw { statusCode: 400, message: 'Solicitação sem contrapartida definida' };
      }
      const updatedPlantao = await tx.escalaPlantao.updateMany({
        where: { id: solic.escalaPlantaoId, tenantId, medicoId: solic.medicoSolicitanteId },
        data: { medicoId: destId },
      });
      if (updatedPlantao.count === 0) {
        throw { statusCode: 409, message: 'Plantão já não pertence mais ao solicitante' };
      }
      const idsLegado = [solic.escalaPlantaoId];
      await tx.solicitacaoTrocaPlantao.update({
        where: { id: solic.id },
        data: { status: STATUS_TROCA_ACEITA, respondidaEm: now },
      });
      await tx.solicitacaoTrocaPlantao.updateMany({
        where: {
          tenantId,
          status: STATUS_TROCA_PENDENTE,
          id: { not: solic.id },
          OR: [
            { escalaPlantaoId: { in: idsLegado } },
            { contrapartidaPlantaoId: { in: idsLegado } },
          ],
        },
        data: { status: STATUS_TROCA_RECUSADA, respondidaEm: now },
      });
      return { ...solic, contrapartidaPlantaoId: null as string | null, medicoDestinoId: destId };
    }

    if (bRow.escalaId !== solic.plantao.escalaId) {
      throw { statusCode: 400, message: 'Plantões de permuta devem ser da mesma escala' };
    }
    if (!abertaEquipe && bRow.medicoId !== solic.medicoDestinoId) {
      throw { statusCode: 409, message: 'Plantão do colega já não está mais com o destinatário' };
    }
    if (abertaEquipe && bRow.medicoId !== medicoId) {
      throw { statusCode: 409, message: 'Plantão inválido para aceitar este pedido' };
    }
    if (!plantaoAindaNoPrazoParaTroca(bRow.data, bRow.gradeId, cid, tipoMaps)) {
      throw { statusCode: 400, message: 'Período para aceitar troca encerrado (plantão do colega)' };
    }

    const pendenteOutra = await tx.solicitacaoTrocaPlantao.findFirst({
      where: {
        tenantId,
        status: STATUS_TROCA_PENDENTE,
        id: { not: solic.id },
        OR: [
          { escalaPlantaoId: solic.escalaPlantaoId },
          { escalaPlantaoId: bRow.id },
          { contrapartidaPlantaoId: solic.escalaPlantaoId },
          { contrapartidaPlantaoId: bRow.id },
        ],
      },
    });
    if (pendenteOutra) {
      throw {
        statusCode: 409,
        message: 'Outro pedido pendente envolve um destes plantões; não é possível aceitar agora',
      };
    }

    const upA = await tx.escalaPlantao.updateMany({
      where: { id: solic.escalaPlantaoId, tenantId, medicoId: solic.medicoSolicitanteId },
      data: { medicoId },
    });
    const upB = await tx.escalaPlantao.updateMany({
      where: { id: bRow.id, tenantId, medicoId },
      data: { medicoId: solic.medicoSolicitanteId },
    });
    if (upA.count === 0 || upB.count === 0) {
      throw { statusCode: 409, message: 'Não foi possível permutar: um dos plantões já foi alterado' };
    }

    const idsEnvolvidos = [solic.escalaPlantaoId, contrapartidaId];

    await tx.solicitacaoTrocaPlantao.update({
      where: { id: solic.id },
      data: {
        status: STATUS_TROCA_ACEITA,
        respondidaEm: now,
        medicoDestinoId: medicoId,
        contrapartidaPlantaoId: contrapartidaId,
      },
    });

    await tx.solicitacaoTrocaPlantao.updateMany({
      where: {
        tenantId,
        status: STATUS_TROCA_PENDENTE,
        id: { not: solic.id },
        OR: [
          { escalaPlantaoId: { in: idsEnvolvidos } },
          { contrapartidaPlantaoId: { in: idsEnvolvidos } },
        ],
      },
      data: { status: STATUS_TROCA_RECUSADA, respondidaEm: now },
    });

    return { ...solic, contrapartidaPlantaoId: contrapartidaId, medicoDestinoId: medicoId };
  });

  await createAuditLog({
    acao: 'ACEITAR_TROCA_PLANTAO',
    tenantId,
    medicoId,
    detalhes: {
      solicitacaoId,
      plantaoId: result.escalaPlantaoId,
      plantaoContrapartidaId: result.contrapartidaPlantaoId ?? undefined,
      medicoSolicitanteId: result.medicoSolicitanteId,
      medicoDestinoId: result.medicoDestinoId,
    },
  });

  return { ok: true as const };
}

export async function recusarTrocaPlantaoService(tenantId: string, medicoId: string, solicitacaoId: string) {
  const row = await prisma.solicitacaoTrocaPlantao.findFirst({
    where: { id: solicitacaoId, tenantId },
    select: { id: true, status: true, escalaPlantaoId: true, medicoSolicitanteId: true, medicoDestinoId: true },
  });
  if (!row) throw { statusCode: 404, message: 'Solicitação não encontrada' };
  if (row.status !== STATUS_TROCA_PENDENTE) throw { statusCode: 400, message: 'Solicitação já respondida' };
  if (row.medicoDestinoId === null) {
    throw {
      statusCode: 400,
      message: 'Pedidos abertos à equipe não podem ser recusados; apenas o primeiro aceite encerra o pedido',
    };
  }
  if (row.medicoDestinoId !== medicoId) {
    throw { statusCode: 404, message: 'Solicitação não encontrada' };
  }

  await prisma.solicitacaoTrocaPlantao.update({
    where: { id: row.id },
    data: { status: STATUS_TROCA_RECUSADA, respondidaEm: new Date() },
  });

  await createAuditLog({
    acao: 'RECUSAR_TROCA_PLANTAO',
    tenantId,
    medicoId,
    detalhes: {
      solicitacaoId,
      plantaoId: row.escalaPlantaoId,
      medicoSolicitanteId: row.medicoSolicitanteId,
      medicoDestinoId: row.medicoDestinoId,
    },
  });

  return { ok: true as const };
}

function mimeFromFotoPath(fotoPath: string): string {
  const lower = fotoPath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Foto de check-in: apenas o próprio médico (mesmo tenant). */
export async function getFotoCheckinRegistroForMedico(tenantId: string, medicoId: string, registroId: string) {
  const r = await prisma.registroPonto.findFirst({
    where: { id: registroId, tenantId, medicoId },
    select: { fotoCheckinCaminho: true },
  });
  if (!r?.fotoCheckinCaminho?.trim()) {
    throw { statusCode: 404, message: 'Registro sem foto de check-in' };
  }
  const fullPath = resolveStoredFileToAbsolute(r.fotoCheckinCaminho);
  if (!fileExistsSafe(fullPath)) {
    throw { statusCode: 404, message: 'Arquivo não encontrado no servidor' };
  }
  return { path: fullPath, mimeType: mimeFromFotoPath(r.fotoCheckinCaminho) };
}

/** Foto de check-in: master com acesso ao relatório (tenant). */
export async function getFotoCheckinRegistroForAdmin(tenantId: string, registroId: string) {
  const r = await prisma.registroPonto.findFirst({
    where: { id: registroId, tenantId },
    select: { fotoCheckinCaminho: true },
  });
  if (!r?.fotoCheckinCaminho?.trim()) {
    throw { statusCode: 404, message: 'Registro sem foto de check-in' };
  }
  const fullPath = resolveStoredFileToAbsolute(r.fotoCheckinCaminho);
  if (!fileExistsSafe(fullPath)) {
    throw { statusCode: 404, message: 'Arquivo não encontrado no servidor' };
  }
  return { path: fullPath, mimeType: mimeFromFotoPath(r.fotoCheckinCaminho) };
}

export async function canCheckInService(tenantId: string, medicoId: string, escalaId: string) {
  if (isPontoSemEscalaEscalaId(escalaId)) {
    const ok = await medicoTemContratoSoPonto(tenantId, medicoId);
    return {
      allowed: ok,
      reason: ok
        ? null
        : ('Ponto sem escala de plantão não está disponível para o seu vínculo com o contrato.' as const),
    };
  }

  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId, ativo: true },
    select: { id: true },
  });
  if (!escala) {
    return { allowed: false, reason: 'Escala não encontrada ou inativa' as const };
  }
  const prod = await resolveProducaoMedicoNaEscala(tenantId, medicoId, escalaId);
  if (!prod.allowPonto) {
    return { allowed: false, reason: 'Ponto eletrônico não está habilitado para o seu vínculo nesta escala' as const };
  }
  if (prod.requireJanelaPlantao) {
    const janela = await validarJanelaCheckinPlantaoEscalaHoje(tenantId, medicoId, escalaId);
    if (!janela.ok) {
      return { allowed: false, reason: janela.message };
    }
  }
  return { allowed: true, reason: null };
}
