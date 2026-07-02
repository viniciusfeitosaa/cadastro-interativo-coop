-- AlterTable
ALTER TABLE "config_ponto_eletronico"
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7),
  ADD COLUMN "raio_metros" INTEGER;
