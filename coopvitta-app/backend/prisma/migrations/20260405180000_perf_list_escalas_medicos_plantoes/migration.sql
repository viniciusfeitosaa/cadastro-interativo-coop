-- Índices para listagens frequentes (admin / grade de escalas).
-- IF NOT EXISTS: seguro em re-execução.

CREATE INDEX IF NOT EXISTS "medicos_tenant_id_nome_completo_idx"
  ON "medicos" ("tenant_id", "nomeCompleto");

CREATE INDEX IF NOT EXISTS "medicos_tenant_id_ativo_idx"
  ON "medicos" ("tenant_id", "ativo");

CREATE INDEX IF NOT EXISTS "escalas_tenant_id_ativo_data_inicio_idx"
  ON "escalas" ("tenant_id", "ativo", "data_inicio");

CREATE INDEX IF NOT EXISTS "escala_plantoes_escala_id_data_idx"
  ON "escala_plantoes" ("escala_id", "data");
