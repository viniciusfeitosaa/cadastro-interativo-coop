-- Performance indexes for Ponto Eletrônico (Dashboard/PontoEletronico)
-- Safe to apply multiple times (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS "config_ponto_eletronico_tenant_id_equipe_id_idx"
  ON "config_ponto_eletronico" ("tenant_id", "equipe_id");

CREATE INDEX IF NOT EXISTS "registros_ponto_tenant_medico_checkout_checkin_idx"
  ON "registros_ponto" ("tenant_id", "medico_id", "checkout_at", "checkin_at");

CREATE INDEX IF NOT EXISTS "equipe_medicos_tenant_medico_idx"
  ON "equipe_medicos" ("tenant_id", "medico_id");

CREATE INDEX IF NOT EXISTS "escala_equipes_tenant_escala_idx"
  ON "escala_equipes" ("tenant_id", "escala_id");

CREATE INDEX IF NOT EXISTS "escala_medicos_tenant_medico_ativo_idx"
  ON "escala_medicos" ("tenant_id", "medico_id", "ativo");

CREATE INDEX IF NOT EXISTS "escala_plantoes_tenant_medico_data_idx"
  ON "escala_plantoes" ("tenant_id", "medico_id", "data");

