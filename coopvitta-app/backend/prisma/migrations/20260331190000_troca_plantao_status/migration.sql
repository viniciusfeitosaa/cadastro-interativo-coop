ALTER TABLE "solicitacoes_troca_plantao"
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS "respondida_em" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "solicitacoes_troca_plantao_tenant_id_medico_destino_id_status_idx"
  ON "solicitacoes_troca_plantao"("tenant_id", "medico_destino_id", "status");

