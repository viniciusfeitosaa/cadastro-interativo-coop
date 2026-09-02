/** Margem de lucro sobre o preço de cobrança (não markup sobre o custo). */

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Cobrança a partir do repasse e da margem %.
 * Ex.: 100 e 25 → 133.33 (100 / 0.75).
 * Retorna null se inputs inválidos (margem ≥ 100 ou &lt; 0, repasse não finito).
 */
export function cobrancaFromMargem(repasse: number, margemPct: number): number | null {
  if (!Number.isFinite(repasse) || repasse < 0) return null;
  if (!Number.isFinite(margemPct) || margemPct < 0 || margemPct >= 100) return null;
  return roundMoney(repasse / (1 - margemPct / 100));
}

/**
 * Margem % a partir de repasse e cobrança.
 * Retorna null se cobrança ≤ 0, repasse inválido, ou cobrança &lt; repasse (margem negativa).
 */
export function margemFromCobranca(repasse: number, cobranca: number): number | null {
  if (!Number.isFinite(repasse) || repasse < 0) return null;
  if (!Number.isFinite(cobranca) || cobranca <= 0) return null;
  if (cobranca < repasse) return null;
  if (repasse === 0) return null;
  const m = (1 - repasse / cobranca) * 100;
  if (!Number.isFinite(m) || m < 0 || m >= 100) return null;
  return roundMoney(m);
}

/** Formata margem para input (até 2 casas, pt-BR friendly via caller). */
export function formatMargemNumber(m: number): string {
  return roundMoney(m).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
