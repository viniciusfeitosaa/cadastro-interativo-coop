-- AlterTable
ALTER TABLE "config_ponto_eletronico"
  ADD COLUMN "horario_entrada" VARCHAR(5),
  ADD COLUMN "horario_saida" VARCHAR(5),
  ADD COLUMN "tolerancia_minutos" INTEGER;
