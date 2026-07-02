import fs from 'fs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { DOCUMENTO_TIPO_BY_FIELD, DOCUMENTOS_PERFIL_FIELDS } from '../constants/documentos.const';
import { fileExistsSafe, resolveStoredFileToAbsolute } from '../utils/upload-path.util';
import { comparePassword } from '../utils/password.util';
import { createAuditLog } from './auditoria.service';

function safeUnlinkStoredPath(caminhoStored: string | null | undefined) {
  if (!caminhoStored?.trim()) return;
  try {
    const full = resolveStoredFileToAbsolute(caminhoStored.trim());
    if (fileExistsSafe(full)) fs.unlinkSync(full);
  } catch {
    // caminho inválido ou fora de uploads — ignorar
  }
}

interface UpdatePerfilInput {
  especialidades?: string[];
  telefone?: string;
  estadoCivil?: string;
  enderecoResidencial?: string;
  dadosBancarios?: string;
  chavePix?: string;
}

/** Grava ficheiros de perfil (multer) em `medico_documentos` — usado no update de perfil e no cadastro público. */
export async function upsertMedicoDocumentosFromMulter(
  prismaClient: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
  medicoId: string,
  files: Record<string, Express.Multer.File[] | undefined> | undefined | null
) {
  if (!files) return;
  await Promise.all(
    DOCUMENTOS_PERFIL_FIELDS.map(async (fieldName) => {
      const file = files[fieldName]?.[0];
      if (!file) return;
      await prismaClient.medicoDocumento.upsert({
        where: {
          tenantId_medicoId_tipo: {
            tenantId,
            medicoId,
            tipo: DOCUMENTO_TIPO_BY_FIELD[fieldName],
          },
        },
        update: {
          nomeArquivo: file.originalname,
          caminhoArquivo: file.path.replace(/\\/g, '/'),
          mimeType: file.mimetype,
          tamanhoBytes: file.size,
        },
        create: {
          tenantId,
          medicoId,
          tipo: DOCUMENTO_TIPO_BY_FIELD[fieldName],
          nomeArquivo: file.originalname,
          caminhoArquivo: file.path.replace(/\\/g, '/'),
          mimeType: file.mimetype,
          tamanhoBytes: file.size,
        },
      });
    })
  );
}

const perfilSelectSemDocumentos = {
  id: true,
  tenantId: true,
  nomeCompleto: true,
  profissao: true,
  crm: true,
  email: true,
  especialidades: true,
  vinculo: true,
  telefone: true,
  estadoCivil: true,
  enderecoResidencial: true,
  dadosBancarios: true,
  chavePix: true,
  ativo: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Perfil sem join em documentos (dashboard — documentos vêm de outra query). */
export const getPerfilResumoDashboardService = async (medicoId: string, tenantId: string) => {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: perfilSelectSemDocumentos,
  });
  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }
  return { ...medico, documentos: [] as never[] };
};

export const getPerfilService = async (medicoId: string, tenantId: string) => {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: {
      ...perfilSelectSemDocumentos,
      documentos: {
        select: {
          id: true,
          tipo: true,
          nomeArquivo: true,
          caminhoArquivo: true,
          mimeType: true,
          tamanhoBytes: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
    },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  return {
    ...medico,
    documentos: medico.documentos.map((doc) => ({
      ...doc,
      /** Download apenas via GET /api/medico/perfil/documentos/:id/download (autenticado). */
    })),
  };
};

export async function getMedicoDocumentoPerfilForDownload(
  medicoId: string,
  tenantId: string,
  documentoId: string
) {
  const doc = await prisma.medicoDocumento.findFirst({
    where: { id: documentoId, medicoId, tenantId },
  });
  if (!doc) {
    throw { statusCode: 404, message: 'Documento não encontrado' };
  }
  const fullPath = resolveStoredFileToAbsolute(doc.caminhoArquivo);
  if (!fileExistsSafe(fullPath)) {
    throw { statusCode: 404, message: 'Arquivo não encontrado no servidor' };
  }
  return { path: fullPath, nomeArquivo: doc.nomeArquivo, mimeType: doc.mimeType };
}

export const updatePerfilService = async (
  medicoId: string,
  tenantId: string,
  input: UpdatePerfilInput,
  files: Record<string, Express.Multer.File[]>
) => {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: { id: true },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  await prisma.medico.update({
    where: { id: medico.id },
    data: {
      especialidades: input.especialidades?.length
        ? input.especialidades.map((e) => (e || '').trim()).filter(Boolean)
        : undefined,
      telefone: input.telefone?.trim() || undefined,
      estadoCivil: input.estadoCivil?.trim() || undefined,
      enderecoResidencial: input.enderecoResidencial?.trim() || undefined,
      dadosBancarios: input.dadosBancarios?.trim() || undefined,
      chavePix: input.chavePix?.trim() || undefined,
    },
  });

  await upsertMedicoDocumentosFromMulter(prisma, tenantId, medico.id, files);

  return getPerfilService(medico.id, tenantId);
};

/** Exclusão permanente da conta do associado (Apple Guideline 5.1.1(v)). */
export async function deleteSelfAccountService(
  medicoId: string,
  tenantId: string,
  senha: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null }
) {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: {
      id: true,
      email: true,
      nomeCompleto: true,
      senhaHash: true,
      documentos: { select: { caminhoArquivo: true } },
      documentosEnviados: { select: { caminhoArquivo: true } },
      registrosPonto: {
        where: { fotoCheckinCaminho: { not: null } },
        select: { fotoCheckinCaminho: true },
      },
    },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Conta não encontrada' };
  }

  const senhaOk = await comparePassword(senha, medico.senhaHash);
  if (!senhaOk) {
    throw { statusCode: 401, message: 'Senha incorreta' };
  }

  await createAuditLog({
    acao: 'EXCLUIR_CONTA_PROPRIA',
    tenantId,
    medicoId: medico.id,
    ipAddress: meta?.ipAddress ?? undefined,
    userAgent: meta?.userAgent ?? undefined,
    detalhes: {
      email: medico.email,
      nomeCompleto: medico.nomeCompleto,
    },
  });

  for (const doc of medico.documentos) {
    safeUnlinkStoredPath(doc.caminhoArquivo);
  }
  for (const doc of medico.documentosEnviados) {
    safeUnlinkStoredPath(doc.caminhoArquivo);
  }
  for (const ponto of medico.registrosPonto) {
    safeUnlinkStoredPath(ponto.fotoCheckinCaminho);
  }

  await prisma.medico.delete({ where: { id: medico.id } });

  return {
    message:
      'Sua conta foi excluída permanentemente. Você pode criar um novo cadastro no futuro, se desejar.',
  };
}
