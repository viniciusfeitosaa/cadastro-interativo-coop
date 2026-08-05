import { GcoopSyncStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { isGcoopEnabled } from './gcoop.config';
import { fetchGcoopPreCadastro, GcoopApiError, postGcoopPreCadastro } from './gcoop.client';
import { mapWizardToGcoopPreCadastro, type WizardGcoopJson } from './gcoop.mapper';

const GCOOP_CPF_EXISTENTE_MSG =
  'CPF já possui pré-cadastro em análise no Gcoop. Não é possível enviar um novo pedido com este CPF.';

export function parseDadosGcoopJson(raw: unknown): WizardGcoopJson | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as WizardGcoopJson;
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    try {
      const parsed = JSON.parse(t);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as WizardGcoopJson;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function sanitizeDadosGcoopForStorage(json: WizardGcoopJson): WizardGcoopJson {
  const { password, confirmPassword, ...rest } = json;
  return rest;
}

export function isGcoopCpfJaExistenteError(err: unknown): boolean {
  const msg =
    err instanceof GcoopApiError
      ? err.message
      : err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : '';
  const n = msg
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    n.includes('ja existe cooperado') ||
    n.includes('cpf ja filiado') ||
    n.includes('ja filiado') ||
    (n.includes('cpf') && (n.includes('ja cadastrado') || n.includes('cadastrado com')))
  );
}

export function gcoopPreCadastroExists(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;
  const r = response as Record<string, unknown>;

  if (typeof r.Message === 'string') {
    const msg = r.Message.toLowerCase();
    if (msg.includes('não encontrado') || msg.includes('nao encontrado') || msg.includes('not found')) {
      return false;
    }
    if (msg.includes('denied') || msg.includes('autoriz')) return false;
  }

  if (r.ID != null && Number(r.ID) > 0) return true;
  if (r.ID_Cooperado != null && Number(r.ID_Cooperado) > 0) return true;
  if (r.Matricula != null && String(r.Matricula).trim()) return true;
  if (typeof r.CPF === 'string' && r.CPF.replace(/\D/g, '').length === 11) return true;
  if (typeof r.Nome === 'string' && r.Nome.trim()) return true;

  return false;
}

export async function assertGcoopCpfDisponivel(cpf: string): Promise<void> {
  if (!isGcoopEnabled()) return;

  try {
    const data = await fetchGcoopPreCadastro(cpf);
    if (gcoopPreCadastroExists(data)) {
      throw { statusCode: 409, message: GCOOP_CPF_EXISTENTE_MSG };
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && !(err instanceof GcoopApiError)) {
      throw err;
    }
    if (err instanceof GcoopApiError) {
      if (err.statusCode === 404) return;
      // Já filiado / já cadastrado no Gcoop → bloquear novo pré-cadastro público.
      if (isGcoopCpfJaExistenteError(err)) {
        throw { statusCode: 409, message: GCOOP_CPF_EXISTENTE_MSG };
      }
      console.warn('[gcoop] GetPreCadastro indisponível no cadastro público:', err.message);
      return;
    }
    console.warn('[gcoop] Falha ao consultar GetPreCadastro:', err);
  }
}

export interface GcoopSyncResult {
  ok: boolean;
  status: GcoopSyncStatus | null;
  error?: string;
  skipped?: boolean;
}

async function loadMedicoForGcoopSync(medicoId: string, tenantId: string) {
  return prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: {
      id: true,
      tenantId: true,
      nomeCompleto: true,
      email: true,
      cpf: true,
      crm: true,
      profissao: true,
      especialidades: true,
      dadosGcoopJson: true,
      documentos: {
        select: {
          tipo: true,
          caminhoArquivo: true,
          mimeType: true,
        },
      },
    },
  });
}

export async function syncMedicoToGcoop(
  medicoId: string,
  tenantId: string
): Promise<GcoopSyncResult> {
  if (!isGcoopEnabled()) {
    return { ok: true, status: null, skipped: true };
  }

  const medico = await loadMedicoForGcoopSync(medicoId, tenantId);
  if (!medico) {
    return { ok: false, status: GcoopSyncStatus.ERRO_SYNC, error: 'Médico não encontrado' };
  }

  const wizard = parseDadosGcoopJson(medico.dadosGcoopJson);
  if (!wizard) {
    await prisma.medico.update({
      where: { id: medicoId },
      data: {
        gcoopSyncStatus: GcoopSyncStatus.ERRO_SYNC,
        gcoopSyncErro: 'Dados do formulário (dadosGcoopJson) ausentes para envio ao Gcoop',
      },
    });
    return {
      ok: false,
      status: GcoopSyncStatus.ERRO_SYNC,
      error: 'Dados do formulário ausentes',
    };
  }

  try {
    const payload = await mapWizardToGcoopPreCadastro({
      wizard,
      medico: {
        nomeCompleto: medico.nomeCompleto,
        email: medico.email,
        cpf: medico.cpf,
        crm: medico.crm,
        profissao: medico.profissao,
        especialidades: medico.especialidades,
      },
      documentos: medico.documentos,
    });

    await postGcoopPreCadastro(payload);

    await prisma.medico.update({
      where: { id: medicoId },
      data: {
        gcoopSyncStatus: GcoopSyncStatus.SINCRONIZADO,
        gcoopSyncErro: null,
        gcoopSincronizadoEm: new Date(),
      },
    });

    return { ok: true, status: GcoopSyncStatus.SINCRONIZADO };
  } catch (err: unknown) {
    if (isGcoopCpfJaExistenteError(err)) {
      // Já existe no Gcoop (pré-cadastro ou filiado) — considerar sincronizado.
      await prisma.medico.update({
        where: { id: medicoId },
        data: {
          gcoopSyncStatus: GcoopSyncStatus.SINCRONIZADO,
          gcoopSyncErro: null,
          gcoopSincronizadoEm: new Date(),
        },
      });
      console.info(
        '[gcoop] CPF já existente no Gcoop — marcado como SINCRONIZADO:',
        medicoId,
        err instanceof Error ? err.message : err
      );
      return { ok: true, status: GcoopSyncStatus.SINCRONIZADO };
    }

    const message =
      err instanceof GcoopApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Erro desconhecido ao sincronizar com Gcoop';

    const retryable = err instanceof GcoopApiError ? err.retryable : true;
    const status = retryable ? GcoopSyncStatus.PENDENTE_SYNC : GcoopSyncStatus.ERRO_SYNC;

    await prisma.medico.update({
      where: { id: medicoId },
      data: {
        gcoopSyncStatus: status,
        gcoopSyncErro: message.slice(0, 4000),
      },
    });

    console.error('[gcoop] Falha ao enviar pré-cadastro:', medicoId, message);
    return { ok: false, status, error: message };
  }
}

export async function listGcoopSyncPendentesService(tenantId: string) {
  return prisma.medico.findMany({
    where: {
      tenantId,
      gcoopSyncStatus: { in: [GcoopSyncStatus.PENDENTE_SYNC, GcoopSyncStatus.ERRO_SYNC] },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      cpf: true,
      profissao: true,
      gcoopSyncStatus: true,
      gcoopSyncErro: true,
      gcoopSincronizadoEm: true,
      updatedAt: true,
    },
  });
}

export async function retryGcoopSyncPendentesService(
  tenantId: string,
  medicoId?: string
): Promise<{ total: number; sincronizados: number; pendentes: number; erros: number }> {
  const where: Prisma.MedicoWhereInput = {
    tenantId,
    gcoopSyncStatus: { in: [GcoopSyncStatus.PENDENTE_SYNC, GcoopSyncStatus.ERRO_SYNC] },
  };
  if (medicoId) where.id = medicoId;

  const medicos = await prisma.medico.findMany({
    where,
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: medicoId ? 1 : 50,
  });

  let sincronizados = 0;
  let pendentes = 0;
  let erros = 0;

  for (const m of medicos) {
    const result = await syncMedicoToGcoop(m.id, tenantId);
    if (result.ok && result.status === GcoopSyncStatus.SINCRONIZADO) sincronizados += 1;
    else if (result.status === GcoopSyncStatus.PENDENTE_SYNC) pendentes += 1;
    else erros += 1;
  }

  return { total: medicos.length, sincronizados, pendentes, erros };
}
