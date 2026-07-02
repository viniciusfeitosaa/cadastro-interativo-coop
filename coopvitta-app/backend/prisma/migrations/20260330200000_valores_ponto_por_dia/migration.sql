-- Valores Ponto por dia da semana (seg-dom)
-- Safe to apply multiple times (IF NOT EXISTS).

ALTER TABLE "config_ponto_eletronico"
  ADD COLUMN IF NOT EXISTS "valor_hora_por_dia" JSONB;

ALTER TABLE "config_ponto_eletronico"
  ADD COLUMN IF NOT EXISTS "valor_hora_cobranca_por_dia" JSONB;

