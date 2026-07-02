-- Valor por plantão: opcionalmente por equipe (além do subgrupo).
-- Unicidade parcial: no máximo uma linha (tenant, contrato, subgrupo, grade) com equipe_id NULL;
-- no máximo uma por (tenant, contrato, subgrupo, grade, equipe) quando equipe_id não é NULL.

ALTER TABLE "valores_plantao" ADD COLUMN IF NOT EXISTS "equipe_id" TEXT;

ALTER TABLE "valores_plantao" DROP CONSTRAINT IF EXISTS "valores_plantao_tenant_id_contrato_ativo_id_subgrupo_id_grade_id_key";

ALTER TABLE "valores_plantao"
  ADD CONSTRAINT "valores_plantao_equipe_id_fkey"
  FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "valores_plantao_default_por_grade"
  ON "valores_plantao" ("tenant_id", "contrato_ativo_id", "subgrupo_id", "grade_id")
  WHERE "equipe_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "valores_plantao_por_equipe"
  ON "valores_plantao" ("tenant_id", "contrato_ativo_id", "subgrupo_id", "grade_id", "equipe_id")
  WHERE "equipe_id" IS NOT NULL;
