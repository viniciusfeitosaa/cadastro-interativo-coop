-- Índice para filtros tenant + médico + intervalo em checkin_at (meu dia / semana no ponto).
CREATE INDEX IF NOT EXISTS "registros_ponto_tenant_id_medico_id_checkin_at_idx"
  ON "registros_ponto" ("tenant_id", "medico_id", "checkin_at");
