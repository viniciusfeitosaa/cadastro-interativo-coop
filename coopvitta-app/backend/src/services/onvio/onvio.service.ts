import { OnvioSyncStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { postOnvioPartnerRegistration } from './onvio.client';
import {
  getOnvioConfig,
  getOnvioStatusPublic,
  isOnvioPartnerCreateConfigured,
} from './onvio.config';
import { formatMedicoOnvioClipboard, mapMedicoToOnvioPartnerPayload } from './onvio.mapper';

const medicoOnvioSelect = {
  id: true,
  nomeCompleto: true,
  cpf: true,
  email: true,
  telefone: true,
  profissao: true,
  crm: true,
  especialidades: true,
  estadoCivil: true,
  enderecoResidencial: true,
  dadosBancarios: true,
  chavePix: true,
  dadosGcoopJson: true,
  onvioSyncStatus: true,
  onvioSyncErro: true,
  onvioSincronizadoEm: true,
  onvioExternalId: true,
} as const;

function extractExternalId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  for (const key of ['id', 'Id', 'ID', 'externalId', 'partnerId', 'requestId']) {
    const v = o[key];
    if (typeof v === 'string' || typeof v === 'number') return String(v);
  }
  return null;
}

export function getOnvioIntegrationStatusService() {
  return getOnvioStatusPublic();
}

export async function getMedicoOnvioPrepService(tenantId: string, medicoId: string) {
  const m = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: medicoOnvioSelect,
  });
  if (!m) {
    throw Object.assign(new Error('Profissional não encontrado'), { statusCode: 404 });
  }
  const status = getOnvioStatusPublic();
  return {
    ...status,
    medico: {
      id: m.id,
      nomeCompleto: m.nomeCompleto,
      onvioSyncStatus: m.onvioSyncStatus,
      onvioSyncErro: m.onvioSyncErro,
      onvioSincronizadoEm: m.onvioSincronizadoEm,
      onvioExternalId: m.onvioExternalId,
    },
    clipboardText: formatMedicoOnvioClipboard(m),
    partnerRegistrationUrl: getOnvioConfig().partnerRegistrationUrl,
  };
}

/**
 * Envia associado ao endpoint de partner-registration quando configurado.
 * Sem ONVIO_PARTNER_CREATE_PATH + OAuth, retorna 503 (ver docs/ONVIO-INTEGRACAO.md).
 */
export async function syncMedicoToOnvioService(tenantId: string, medicoId: string) {
  if (!isOnvioPartnerCreateConfigured()) {
    throw Object.assign(
      new Error(
        'Integração Onvio partner-registration ainda não disponível: falta OAuth e/ou ONVIO_PARTNER_CREATE_PATH confirmado pelo Onvio. Use Abrir Onvio + copiar dados enquanto isso. Ver docs/ONVIO-INTEGRACAO.md.'
      ),
      { statusCode: 503 }
    );
  }

  const m = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: medicoOnvioSelect,
  });
  if (!m) {
    throw Object.assign(new Error('Profissional não encontrado'), { statusCode: 404 });
  }

  const payload = mapMedicoToOnvioPartnerPayload(m);

  try {
    const result = await postOnvioPartnerRegistration(payload);
    if (result.status < 200 || result.status >= 300) {
      const detail =
        typeof result.body === 'string'
          ? result.body.slice(0, 2000)
          : JSON.stringify(result.body).slice(0, 2000);
      throw Object.assign(new Error(`Onvio HTTP ${result.status}: ${detail}`), { statusCode: 502 });
    }

    const externalId = extractExternalId(result.body);
    const updated = await prisma.medico.update({
      where: { id: m.id },
      data: {
        onvioSyncStatus: OnvioSyncStatus.SINCRONIZADO,
        onvioSyncErro: null,
        onvioSincronizadoEm: new Date(),
        onvioExternalId: externalId,
      },
      select: {
        id: true,
        onvioSyncStatus: true,
        onvioExternalId: true,
        onvioSincronizadoEm: true,
      },
    });
    return { success: true, medico: updated, onvioResponse: result.body };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao sincronizar com Onvio';
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 503) throw err;

    await prisma.medico.update({
      where: { id: m.id },
      data: {
        onvioSyncStatus: OnvioSyncStatus.ERRO_SYNC,
        onvioSyncErro: message.slice(0, 4000),
      },
    });
    throw Object.assign(new Error(message), { statusCode: statusCode || 502 });
  }
}
