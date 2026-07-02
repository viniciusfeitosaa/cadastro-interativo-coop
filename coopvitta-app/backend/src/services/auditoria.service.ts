import { prisma } from '../config/database';
import { scrubSensitiveData } from '../utils/log-scrub.util';
import { safeLogger } from '../utils/safe-logger';

interface CreateAuditLogInput {
  acao: string;
  medicoId?: string | null;
  masterId?: string | null;
  tenantId?: string;
  detalhes?: any;
  ipAddress?: string;
  userAgent?: string;
}

// Allow passing a Prisma TransactionClient so audit logs can be written atomically.
export const createAuditLog = async (input: CreateAuditLogInput, prismaClient: any = prisma) => {
  try {
    const detalhesSanitizados = input.detalhes
      ? scrubSensitiveData({ ...input.detalhes, tenantId: input.tenantId })
      : input.tenantId
        ? { tenantId: input.tenantId }
        : null;

    await prismaClient.auditoria.create({
      data: {
        medicoId: input.medicoId || undefined,
        masterId: input.masterId || undefined,
        acao: input.acao,
        detalhes: detalhesSanitizados ? JSON.parse(JSON.stringify(detalhesSanitizados)) : null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    safeLogger.error('Erro ao criar log de auditoria:', error);
  }
};
