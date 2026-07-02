import { prisma } from '../config/database';

export type ProducaoMedicoNaEscala = {
  /** Alguma equipe do médico nesta escala pertence a subgrupo com ponto habilitado. */
  allowPonto: boolean;
  /** Alguma dessas equipes exige janela de plantão (escala + ponto) no check-in. */
  requireJanelaPlantao: boolean;
};

/**
 * Resolve uso de escala/ponto para o par médico + escala, pelas equipes do médico vinculadas à escala
 * e ao subgrupo (fonte de verdade após migração de contrato → subgrupo).
 */
export async function resolveProducaoMedicoNaEscala(
  tenantId: string,
  medicoId: string,
  escalaId: string
): Promise<ProducaoMedicoNaEscala> {
  const [links, meuRows] = await Promise.all([
    prisma.escalaEquipe.findMany({
      where: { tenantId, escalaId },
      select: {
        equipeId: true,
        equipe: {
          select: {
            subgrupo: { select: { usaEscala: true, usaPonto: true } },
          },
        },
      },
    }),
    prisma.equipeMedico.findMany({
      where: { tenantId, medicoId },
      select: { equipeId: true },
    }),
  ]);
  const meu = new Set(meuRows.map((r) => r.equipeId));
  let allowPonto = false;
  let requireJanelaPlantao = false;
  for (const row of links) {
    if (!meu.has(row.equipeId)) continue;
    const sg = row.equipe.subgrupo;
    if (!sg) continue;
    if (sg.usaPonto) allowPonto = true;
    if (sg.usaPonto && sg.usaEscala) requireJanelaPlantao = true;
  }
  return { allowPonto, requireJanelaPlantao };
}

/** Mapa escalaId → flags (batch para listagens de plantões). */
export async function batchResolveProducaoMedicoNasEscalas(
  tenantId: string,
  medicoId: string,
  escalaIds: string[]
): Promise<Map<string, ProducaoMedicoNaEscala>> {
  const out = new Map<string, ProducaoMedicoNaEscala>();
  const uniq = [...new Set(escalaIds.filter(Boolean))];
  for (const id of uniq) {
    out.set(id, { allowPonto: false, requireJanelaPlantao: false });
  }
  if (uniq.length === 0) return out;

  const meuRows = await prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: { equipeId: true },
  });
  const meu = new Set(meuRows.map((r) => r.equipeId));

  const links = await prisma.escalaEquipe.findMany({
    where: { tenantId, escalaId: { in: uniq } },
    select: {
      escalaId: true,
      equipeId: true,
      equipe: {
        select: {
          subgrupo: { select: { usaEscala: true, usaPonto: true } },
        },
      },
    },
  });

  for (const row of links) {
    if (!meu.has(row.equipeId)) continue;
    const sg = row.equipe.subgrupo;
    if (!sg) continue;
    const cur = out.get(row.escalaId);
    if (!cur) continue;
    if (sg.usaPonto) cur.allowPonto = true;
    if (sg.usaPonto && sg.usaEscala) cur.requireJanelaPlantao = true;
  }
  return out;
}
