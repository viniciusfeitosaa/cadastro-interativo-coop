/**
 * Lógica pura para escolher configuração de geolocalização do ponto (testável sem Prisma).
 * Espelha a ordem do antigo loop de findFirst por equipe.
 */

export type MedicoEquipeGeoLinha = { equipeId: string; subgrupoId: string | null };

export type ConfigGeoRow = {
  equipeId: string | null;
  subgrupoId: string;
  latitude: unknown;
  longitude: unknown;
  raioMetros: number | null;
};

export function normalizarGeoConfig(c: {
  latitude: unknown;
  longitude: unknown;
  raioMetros: number | null;
}): { latitude: number; longitude: number; raioMetros: number } | null {
  const lat = Number(c.latitude);
  const lon = Number(c.longitude);
  const raio = c.raioMetros ?? 0;
  if (Number.isNaN(lat) || Number.isNaN(lon) || raio <= 0) return null;
  return { latitude: lat, longitude: lon, raioMetros: raio };
}

/** Primeiro candidato (equipe+subgrupo na escala) com config geo válida — mesma ordem do loop legado. */
export function pickGeoConfigParaEscala(
  candidatos: MedicoEquipeGeoLinha[],
  configs: ConfigGeoRow[]
): { latitude: number; longitude: number; raioMetros: number } | null {
  for (const em of candidatos) {
    if (!em.subgrupoId) continue;
    const c = configs.find((x) => x.equipeId === em.equipeId && x.subgrupoId === em.subgrupoId);
    if (!c) continue;
    const n = normalizarGeoConfig(c);
    if (n) return n;
  }
  return null;
}

/** Sem escala: percorre equipes do médico na ordem; primeiro geo válido (como findFirst por equipe). */
export function pickGeoConfigSemEscala(
  medicoEquipes: MedicoEquipeGeoLinha[],
  configs: ConfigGeoRow[]
): { latitude: number; longitude: number; raioMetros: number } | null {
  for (const em of medicoEquipes) {
    const doEquipe = configs.filter((c) => c.equipeId === em.equipeId);
    for (const c of doEquipe) {
      const n = normalizarGeoConfig(c);
      if (n) return n;
    }
  }
  return null;
}
