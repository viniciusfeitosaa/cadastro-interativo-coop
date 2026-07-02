import { getPerfilResumoDashboardService } from './medico.service';
import { listMeusDocumentos } from './documentosenviados.service';
import { getPainelPontoEletronicoInicialService, listProximosPlantoesService } from './ponto.service';

const dashboardTiming = process.env.MEDICO_DASHBOARD_TIMING === '1';

async function timeSlice<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    if (dashboardTiming) {
      console.log(`[medico/dashboard] ${label} ${Date.now() - t0}ms`);
    }
  }
}

export async function getDashboardMedicoService(tenantId: string, medicoId: string) {
  const tAll = Date.now();
  const [perfil, painel, proximosPlantoes, documentosEnviados] = await Promise.all([
    timeSlice('perfil', () => getPerfilResumoDashboardService(medicoId, tenantId)),
    timeSlice('painel(meuDia+escalas)', () => getPainelPontoEletronicoInicialService(tenantId, medicoId)),
    timeSlice('proximosPlantoes', () => listProximosPlantoesService(tenantId, medicoId, 2)),
    timeSlice('documentosEnviados', () => listMeusDocumentos(medicoId, tenantId)),
  ]);

  if (dashboardTiming) {
    console.log(`[medico/dashboard] total ${Date.now() - tAll}ms (tenant=${tenantId.slice(0, 8)}… medico=${medicoId.slice(0, 8)}…)`);
  }

  return {
    perfil,
    meuDia: painel.meuDia,
    escalas: painel.escalas,
    proximosPlantoes,
    documentosEnviados,
  };
}

