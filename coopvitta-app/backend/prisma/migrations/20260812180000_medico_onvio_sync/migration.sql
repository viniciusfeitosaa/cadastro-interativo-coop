-- CreateEnum
CREATE TYPE "OnvioSyncStatus" AS ENUM ('PENDENTE_SYNC', 'SINCRONIZADO', 'ERRO_SYNC');

-- AlterTable
ALTER TABLE "medicos" ADD COLUMN "onvio_sync_status" "OnvioSyncStatus",
ADD COLUMN "onvio_sync_erro" TEXT,
ADD COLUMN "onvio_sincronizado_em" TIMESTAMP(3),
ADD COLUMN "onvio_external_id" VARCHAR(120);
