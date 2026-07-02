import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database';
import { fileExistsSafe, resolveStoredFileToAbsolute } from '../utils/upload-path.util';
import { documentosEnviadosHasAceitoEmColumn } from '../utils/documentos-enviados-schema.util';

export async function listDocumentosEnviadosAdmin(tenantId: string, medicoId?: string) {
  const hasAceitoEm = await documentosEnviadosHasAceitoEmColumn();
  const list = await prisma.documentoEnviado.findMany({
    where: {
      tenantId,
      ...(medicoId ? { medicoId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      medicoId: true,
      titulo: true,
      nomeArquivo: true,
      caminhoArquivo: true,
      mimeType: true,
      tamanhoBytes: true,
      enviadoPorId: true,
      createdAt: true,
      ...(hasAceitoEm ? { aceitoEm: true } : {}),
      medico: {
        select: { id: true, nomeCompleto: true, crm: true, email: true },
      },
    },
  });
  if (!hasAceitoEm) {
    return list.map((row) => ({ ...row, aceitoEm: null }));
  }
  return list;
}

export async function uploadAndSendDocumento(
  tenantId: string,
  masterId: string,
  medicoId: string,
  file: Express.Multer.File,
  titulo?: string | null
) {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, ativo: true },
    select: { id: true },
  });
  if (!medico) {
    throw { statusCode: 404, message: 'Profissional não encontrado' };
  }

  const relativePath = path.relative(path.resolve(process.cwd(), 'uploads'), file.path);
  const normalizedPath = relativePath.split(path.sep).join('/');

  const data = {
    tenantId,
    medicoId,
    titulo: titulo?.trim() || null,
    nomeArquivo: file.originalname || path.basename(file.filename),
    caminhoArquivo: normalizedPath,
    mimeType: file.mimetype || 'application/octet-stream',
    tamanhoBytes: file.size,
    enviadoPorId: masterId,
  };
  const medicoInc = { medico: { select: { id: true, nomeCompleto: true, crm: true } as const } } as const;
  const hasAceitoEm = await documentosEnviadosHasAceitoEmColumn();
  if (hasAceitoEm) {
    return prisma.documentoEnviado.create({ data, include: medicoInc });
  }
  const row = await prisma.documentoEnviado.create({
    data,
    select: {
      id: true,
      tenantId: true,
      medicoId: true,
      titulo: true,
      nomeArquivo: true,
      caminhoArquivo: true,
      mimeType: true,
      tamanhoBytes: true,
      enviadoPorId: true,
      createdAt: true,
      medico: medicoInc.medico,
    },
  });
  return { ...row, aceitoEm: null };
}

export async function deleteDocumentoEnviado(tenantId: string, id: string) {
  const doc = await prisma.documentoEnviado.findFirst({
    where: { id, tenantId },
    select: { id: true, caminhoArquivo: true },
  });
  if (!doc) {
    throw { statusCode: 404, message: 'Documento não encontrado' };
  }
  const fullPath = resolveStoredFileToAbsolute(doc.caminhoArquivo);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
  await prisma.documentoEnviado.delete({ where: { id } });
}

export async function listMeusDocumentos(medicoId: string, tenantId: string) {
  const hasAceitoEm = await documentosEnviadosHasAceitoEmColumn();
  const where = { medicoId, tenantId };
  const orderBy = { createdAt: 'desc' as const };
  if (hasAceitoEm) {
    return prisma.documentoEnviado.findMany({
      where,
      orderBy,
      select: {
        id: true,
        titulo: true,
        nomeArquivo: true,
        mimeType: true,
        tamanhoBytes: true,
        aceitoEm: true,
        createdAt: true,
      },
    });
  }
  const rows = await prisma.documentoEnviado.findMany({
    where,
    orderBy,
    select: {
      id: true,
      titulo: true,
      nomeArquivo: true,
      mimeType: true,
      tamanhoBytes: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({ ...r, aceitoEm: null as Date | null }));
}

/** Regista ciência do profissional sobre o documento (uma vez; idempotente). */
export async function confirmarCienciaDocumentoEnviado(medicoId: string, tenantId: string, id: string) {
  const hasAceitoEm = await documentosEnviadosHasAceitoEmColumn();
  if (!hasAceitoEm) {
    throw {
      statusCode: 503,
      message:
        'Assinatura de ciência indisponível: a base de dados ainda não foi atualizada. Peça ao administrador para executar as migrações (coluna aceito_em).',
    };
  }
  const doc = await prisma.documentoEnviado.findFirst({
    where: { id, medicoId, tenantId },
    select: { id: true, aceitoEm: true },
  });
  if (!doc) {
    throw { statusCode: 404, message: 'Documento não encontrado' };
  }
  if (doc.aceitoEm) {
    return { id: doc.id, aceitoEm: doc.aceitoEm, jaRegistrado: true as const };
  }
  const updated = await prisma.documentoEnviado.update({
    where: { id: doc.id },
    data: { aceitoEm: new Date() },
    select: { id: true, aceitoEm: true },
  });
  return { ...updated, jaRegistrado: false as const };
}

export async function getDocumentoForDownload(medicoId: string, tenantId: string, id: string) {
  const doc = await prisma.documentoEnviado.findFirst({
    where: { id, medicoId, tenantId },
    select: { id: true, caminhoArquivo: true, nomeArquivo: true, mimeType: true },
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
