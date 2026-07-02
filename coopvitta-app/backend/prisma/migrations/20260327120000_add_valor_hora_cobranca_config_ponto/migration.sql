-- AlterTable
ALTER TABLE "config_ponto_eletronico" ADD COLUMN IF NOT EXISTS "valor_hora_cobranca" DECIMAL(10,2);
