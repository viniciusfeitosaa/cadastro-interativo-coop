-- AlterTable
ALTER TABLE "valores_plantao"
ADD COLUMN     "valor_hora_cobranca" DECIMAL(10,2),
ADD COLUMN     "valor_hora_por_dia" JSONB,
ADD COLUMN     "valor_hora_cobranca_por_dia" JSONB;

