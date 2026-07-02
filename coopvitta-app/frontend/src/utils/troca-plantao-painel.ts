import type { TrocaPlantaoPendenteItem } from '../services/ponto.service';
import { fimPlantaoCliente, inicioPlantaoCliente, type PlantaoAgendaInput } from './plantao-agenda';

/** Limite para troca: até 10 min antes do início do plantão. */
export const MINUTOS_ANTES_INICIO_PARA_TROCA = 10;

/** O plantão da troca já terminou (mesma regra de fim que a agenda no cliente). */
export function periodoPlantaoTrocaJaPassou(dataPlantao: string | Date, gradeId: string, agora: Date): boolean {
  const dataStr = String(dataPlantao).slice(0, 10);
  const fim = fimPlantaoCliente(dataStr, { gradeId });
  return agora.getTime() > fim.getTime();
}

export function canTrocarPlantaoAgendaEm(dataStr: string, p: PlantaoAgendaInput, at: Date): boolean {
  const inicio = inicioPlantaoCliente(dataStr, p);
  const limite = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_TROCA * 60 * 1000);
  return at.getTime() < limite.getTime();
}

/** Permuta bilateral: ambos os plantões na janela. Cessão ou pedido à equipe: só o plantão cedido/ofertado. */
export function trocaPendenteVisivelNoPainel(t: TrocaPlantaoPendenteItem, relogioUi: Date): boolean {
  const ehCeder = (t.tipoSolicitacao ?? 'PERMUTA') === 'CEDER';
  if (t.paraEquipeInteira || ehCeder) {
    const d1 = String(t.dataPlantao).slice(0, 10);
    return canTrocarPlantaoAgendaEm(d1, { gradeId: t.gradeId }, relogioUi);
  }
  if (t.contrapartidaPlantaoId && t.dataPlantaoContrapartida != null && t.gradeIdContrapartida) {
    const d1 = String(t.dataPlantao).slice(0, 10);
    const d2 = String(t.dataPlantaoContrapartida).slice(0, 10);
    return (
      canTrocarPlantaoAgendaEm(d1, { gradeId: t.gradeId }, relogioUi) &&
      canTrocarPlantaoAgendaEm(d2, { gradeId: t.gradeIdContrapartida }, relogioUi)
    );
  }
  return !periodoPlantaoTrocaJaPassou(t.dataPlantao, t.gradeId, relogioUi);
}
