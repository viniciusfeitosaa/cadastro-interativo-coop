-- CreateEnum
CREATE TYPE "DocumentoRevisaoStatus" AS ENUM ('PENDENTE', 'OK', 'SOLICITADO_NOVAMENTE');

-- AlterTable
ALTER TABLE "medico_documentos" ADD COLUMN "revisao_status" "DocumentoRevisaoStatus" NOT NULL DEFAULT 'PENDENTE';
ALTER TABLE "medico_documentos" ADD COLUMN "revisao_mensagem" TEXT;
ALTER TABLE "medico_documentos" ADD COLUMN "revisao_em" TIMESTAMP(3);
ALTER TABLE "medico_documentos" ADD COLUMN "revisao_por_id" VARCHAR(36);

-- CreateIndex
CREATE INDEX "medico_documentos_revisao_status_idx" ON "medico_documentos"("revisao_status");
