-- CreateEnum
CREATE TYPE "GcoopSyncStatus" AS ENUM ('PENDENTE_SYNC', 'SINCRONIZADO', 'ERRO_SYNC');

-- AlterTable
ALTER TABLE "medicos" ADD COLUMN "dados_gcoop_json" JSONB,
ADD COLUMN "gcoop_sync_status" "GcoopSyncStatus",
ADD COLUMN "gcoop_sync_erro" TEXT,
ADD COLUMN "gcoop_sincronizado_em" TIMESTAMP(3);
