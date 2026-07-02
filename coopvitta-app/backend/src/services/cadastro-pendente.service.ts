import { StatusCadastroMedico } from '@prisma/client';
import { prisma } from '../config/database';
import { createAuditLog } from './auditoria.service';
import { getMedicoDocumentoPerfilForDownload } from './medico.service';

export async function listCadastrosPendentesService(tenantId: string) {
  return prisma.medico.findMany({
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
      createdAt: true,
    },
  });
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

  return { ok: true as const };
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
