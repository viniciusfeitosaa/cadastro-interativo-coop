import fs from 'fs';
import { DocumentoRevisaoStatus, GcoopSyncStatus, StatusCadastroMedico } from '@prisma/client';
import { prisma } from '../config/database';
import { DOCUMENTO_LABEL_BY_TIPO } from '../constants/documentos.const';
import {
  fileExistsSafe,
  resolveStoredFileToAbsolute,
  toStoredUploadPath,
} from '../utils/upload-path.util';
import { createAuditLog } from './auditoria.service';
import { getMedicoDocumentoPerfilForDownload } from './medico.service';
import { isGcoopEnabled } from './gcoop/gcoop.config';
import { syncMedicoToGcoop } from './gcoop/gcoop.service';

function unlinkStoredPathQuiet(caminhoStored: string | null | undefined) {
  if (!caminhoStored?.trim()) return;
  try {
    const full = resolveStoredFileToAbsolute(caminhoStored.trim());
    if (fileExistsSafe(full)) fs.unlinkSync(full);
  } catch {
    // caminho inválido ou fora de uploads — ignorar
  }
}

export interface ListCadastrosPendentesFilters {
  nome?: string;
  profissao?: string;
  especialidade?: string;
}

export async function listCadastrosPendentesService(tenantId: string, filters?: ListCadastrosPendentesFilters) {
  const qNome = filters?.nome?.trim().toLowerCase();
  const qProf = filters?.profissao?.trim().toLowerCase();
  const qEsp = filters?.especialidade?.trim().toLowerCase();

  const itens = await prisma.medico.findMany({
    where: { tenantId, statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      profissao: true,
      crm: true,
      cpf: true,
      telefone: true,
      especialidades: true,
      createdAt: true,
    },
  });

  const filtrados = itens.filter((m) => {
    if (qNome && !m.nomeCompleto.toLowerCase().includes(qNome)) return false;
    if (qProf && !m.profissao.toLowerCase().includes(qProf)) return false;
    if (qEsp) {
      const especialidades = m.especialidades ?? [];
      const ok = especialidades.some((e) => e?.toLowerCase().includes(qEsp));
      return ok;
    }
    return true;
  });

  // Mantemos a resposta compatível com a interface do frontend (CadastroPendenteListItem)
  return filtrados.map(({ especialidades: _ignored, ...rest }) => rest);
}

export async function getCadastroPendenteDetalheService(tenantId: string, medicoId: string) {
  const m = await prisma.medico.findFirst({
    where: {
      id: medicoId,
      tenantId,
      statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE,
    },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      profissao: true,
      crm: true,
      cpf: true,
      telefone: true,
      especialidades: true,
      vinculo: true,
      estadoCivil: true,
      enderecoResidencial: true,
      dadosBancarios: true,
      chavePix: true,
      createdAt: true,
      updatedAt: true,
      documentos: {
        select: {
          id: true,
          tipo: true,
          nomeArquivo: true,
          mimeType: true,
          tamanhoBytes: true,
          revisaoStatus: true,
          revisaoMensagem: true,
          revisaoEm: true,
          createdAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
  if (!m) {
    throw { statusCode: 404, message: 'Cadastro pendente não encontrado ou já processado' };
  }
  return m;
}

export async function downloadCadastroPendenteDocumentoService(
  tenantId: string,
  medicoId: string,
  documentoId: string
) {
  const m = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE },
    select: { id: true },
  });
  if (!m) {
    throw { statusCode: 404, message: 'Cadastro pendente não encontrado' };
  }
  return getMedicoDocumentoPerfilForDownload(medicoId, tenantId, documentoId);
}

export async function aprovarCadastroPendenteService(tenantId: string, masterId: string, medicoId: string) {
  const m = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE },
    select: { id: true, nomeCompleto: true, email: true },
  });
  if (!m) {
    throw { statusCode: 404, message: 'Cadastro pendente não encontrado ou já processado' };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nome: true },
  });
  const nomeInstituicao = tenant?.nome?.trim() || null;

  await prisma.medico.update({
    where: { id: medicoId },
    data: {
      statusCadastro: StatusCadastroMedico.ATIVO,
      ativo: true,
    },
  });

  await createAuditLog({
    acao: 'APROVAR_CADASTRO_PUBLICO_MEDICO',
    tenantId,
    masterId,
    medicoId,
    detalhes: { medicoId },
  });

  try {
    const { notificarBoasVindasMedico } = await import('./notificacao-medico.service');
    await notificarBoasVindasMedico(tenantId, medicoId, m.nomeCompleto);
  } catch (err) {
    console.error('[notificacao] boas-vindas (aprovação cadastro):', err);
  }

  try {
    const emailTo = (m.email ?? '').trim().toLowerCase();
    if (!emailTo) throw new Error('Médico sem e-mail');
    const { enqueueEmailJob } = await import('../jobs/email-queue');
    const queued = await enqueueEmailJob({
      type: 'cadastro-aprovado',
      to: emailTo,
      nomeCompleto: m.nomeCompleto,
      nomeInstituicao,
    });
    if (!queued) {
      const { enviarEmailCadastroAprovado } = await import('./cadastro-publico-email.service');
      await enviarEmailCadastroAprovado({
        to: m.email,
        nomeCompleto: m.nomeCompleto,
        nomeInstituicao,
      });
    }
    console.log('[cadastro-pendente] E-mail de cadastro aprovado enfileirado/enviado para:', emailTo);
  } catch (err) {
    console.error('[cadastro-pendente] Falha no e-mail de cadastro aprovado (SMTP/Resend não configurado ou erro de envio):', err);
  }

  let gcoopSync: {
    status: GcoopSyncStatus | null;
    ok: boolean;
    error?: string;
    skipped?: boolean;
  } = { status: null, ok: true, skipped: !isGcoopEnabled() };

  if (isGcoopEnabled()) {
    gcoopSync = await syncMedicoToGcoop(medicoId, tenantId);
    if (!gcoopSync.ok) {
      console.warn(
        '[cadastro-pendente] Cadastro aprovado localmente; sync Gcoop pendente:',
        medicoId,
        gcoopSync.error
      );
    }
  }

  return {
    ok: true as const,
    gcoopSync: {
      status: gcoopSync.status,
      ok: gcoopSync.ok,
      error: gcoopSync.error,
      skipped: gcoopSync.skipped,
    },
  };
}

export async function rejeitarCadastroPendenteService(tenantId: string, masterId: string, medicoId: string) {
  const m = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE },
    select: { id: true },
  });
  if (!m) {
    throw { statusCode: 404, message: 'Cadastro pendente não encontrado ou já processado' };
  }

  await prisma.medico.update({
    where: { id: medicoId },
    data: {
      statusCadastro: StatusCadastroMedico.REJEITADO,
      ativo: false,
    },
  });

  await createAuditLog({
    acao: 'REJEITAR_CADASTRO_PUBLICO_MEDICO',
    tenantId,
    masterId,
    medicoId,
    detalhes: { medicoId },
  });

  return { ok: true as const };
}

async function assertCadastroPendenteComDocumento(
  tenantId: string,
  medicoId: string,
  documentoId: string
) {
  const m = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      documentos: {
        where: { id: documentoId },
        select: {
          id: true,
          tipo: true,
          nomeArquivo: true,
          caminhoArquivo: true,
          mimeType: true,
          revisaoStatus: true,
        },
      },
    },
  });
  if (!m) {
    throw { statusCode: 404, message: 'Cadastro pendente não encontrado ou já processado' };
  }
  const doc = m.documentos[0];
  if (!doc) {
    throw { statusCode: 404, message: 'Documento não encontrado neste cadastro' };
  }
  return { medico: m, doc };
}

export async function marcarDocumentoRevisaoOkService(
  tenantId: string,
  masterId: string,
  medicoId: string,
  documentoId: string
) {
  const { doc } = await assertCadastroPendenteComDocumento(tenantId, medicoId, documentoId);
  const updated = await prisma.medicoDocumento.update({
    where: { id: doc.id },
    data: {
      revisaoStatus: DocumentoRevisaoStatus.OK,
      revisaoMensagem: null,
      revisaoEm: new Date(),
      revisaoPorId: masterId,
    },
    select: {
      id: true,
      tipo: true,
      nomeArquivo: true,
      mimeType: true,
      tamanhoBytes: true,
      revisaoStatus: true,
      revisaoMensagem: true,
      revisaoEm: true,
      createdAt: true,
    },
  });
  await createAuditLog({
    acao: 'REVISAR_DOCUMENTO_CADASTRO_OK',
    tenantId,
    masterId,
    medicoId,
    detalhes: { documentoId: doc.id, tipo: doc.tipo },
  });
  return updated;
}

export async function solicitarDocumentoNovamenteService(
  tenantId: string,
  masterId: string,
  medicoId: string,
  documentoId: string,
  mensagem: string
) {
  const msg = (mensagem || '').trim();
  if (msg.length < 5) {
    throw { statusCode: 400, message: 'Informe o motivo (mínimo 5 caracteres) para solicitar o reenvio' };
  }
  if (msg.length > 2000) {
    throw { statusCode: 400, message: 'Mensagem demasiado longa (máx. 2000 caracteres)' };
  }

  const { medico, doc } = await assertCadastroPendenteComDocumento(tenantId, medicoId, documentoId);
  const emailTo = (medico.email ?? '').trim().toLowerCase();
  if (!emailTo) {
    throw { statusCode: 400, message: 'Cadastro sem e-mail — não é possível solicitar o documento por e-mail' };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nome: true },
  });
  const nomeInstituicao = tenant?.nome?.trim() || null;
  const documentoLabel = DOCUMENTO_LABEL_BY_TIPO[doc.tipo] || String(doc.tipo);

  try {
    const { enqueueEmailJob } = await import('../jobs/email-queue');
    const queued = await enqueueEmailJob({
      type: 'documento-reenvio-solicitado',
      to: emailTo,
      nomeCompleto: medico.nomeCompleto,
      documentoLabel,
      mensagem: msg,
      nomeInstituicao,
    });
    if (!queued) {
      const { enviarEmailDocumentoReenvioSolicitado } = await import('./cadastro-publico-email.service');
      await enviarEmailDocumentoReenvioSolicitado({
        to: emailTo,
        nomeCompleto: medico.nomeCompleto,
        documentoLabel,
        mensagem: msg,
        nomeInstituicao,
      });
    }
  } catch (err) {
    console.error('[cadastro-pendente] Falha ao enviar e-mail de reenvio de documento:', err);
    throw {
      statusCode: 502,
      message: 'Não foi possível enviar o e-mail de solicitação. Tente novamente.',
    };
  }

  const updated = await prisma.medicoDocumento.update({
    where: { id: doc.id },
    data: {
      revisaoStatus: DocumentoRevisaoStatus.SOLICITADO_NOVAMENTE,
      revisaoMensagem: msg,
      revisaoEm: new Date(),
      revisaoPorId: masterId,
    },
    select: {
      id: true,
      tipo: true,
      nomeArquivo: true,
      mimeType: true,
      tamanhoBytes: true,
      revisaoStatus: true,
      revisaoMensagem: true,
      revisaoEm: true,
      createdAt: true,
    },
  });

  await createAuditLog({
    acao: 'SOLICITAR_DOCUMENTO_CADASTRO_NOVAMENTE',
    tenantId,
    masterId,
    medicoId,
    detalhes: { documentoId: doc.id, tipo: doc.tipo },
  });

  return updated;
}

export async function substituirDocumentoCadastroPendenteService(
  tenantId: string,
  masterId: string,
  medicoId: string,
  documentoId: string,
  file: Express.Multer.File | undefined
) {
  if (!file) {
    throw { statusCode: 400, message: 'Envie o ficheiro no campo "arquivo"' };
  }

  const { doc } = await assertCadastroPendenteComDocumento(tenantId, medicoId, documentoId);
  const oldPath = doc.caminhoArquivo;
  const storedPath = toStoredUploadPath(file.path);

  const updated = await prisma.medicoDocumento.update({
    where: { id: doc.id },
    data: {
      nomeArquivo: file.originalname || doc.nomeArquivo,
      caminhoArquivo: storedPath,
      mimeType: file.mimetype || 'application/octet-stream',
      tamanhoBytes: file.size,
      revisaoStatus: DocumentoRevisaoStatus.OK,
      revisaoMensagem: null,
      revisaoEm: new Date(),
      revisaoPorId: masterId,
    },
    select: {
      id: true,
      tipo: true,
      nomeArquivo: true,
      mimeType: true,
      tamanhoBytes: true,
      revisaoStatus: true,
      revisaoMensagem: true,
      revisaoEm: true,
      createdAt: true,
    },
  });

  if (oldPath && oldPath !== storedPath) {
    unlinkStoredPathQuiet(oldPath);
  }

  await createAuditLog({
    acao: 'SUBSTITUIR_DOCUMENTO_CADASTRO_PENDENTE',
    tenantId,
    masterId,
    medicoId,
    detalhes: { documentoId: doc.id, tipo: doc.tipo, nomeArquivo: updated.nomeArquivo },
  });

  return updated;
}
