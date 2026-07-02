-- Estilo de produção (escala / ponto) por subgrupo; copia do contrato vinculado para migração.

ALTER TABLE "subgrupos" ADD COLUMN "usa_escala" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subgrupos" ADD COLUMN "usa_ponto" BOOLEAN NOT NULL DEFAULT true;

UPDATE "subgrupos" s
SET
  "usa_escala" = COALESCE(x."usa_escala", true),
  "usa_ponto" = COALESCE(x."usa_ponto", true)
FROM (
  SELECT DISTINCT ON (cs."subgrupo_id")
    cs."subgrupo_id" AS "subgrupo_id",
    ca."usa_escala" AS "usa_escala",
    ca."usa_ponto" AS "usa_ponto"
  FROM "contrato_subgrupos" cs
  INNER JOIN "contratos_ativos" ca ON ca."id" = cs."contrato_ativo_id"
  ORDER BY cs."subgrupo_id", ca."created_at" DESC
) x
WHERE s."id" = x."subgrupo_id";
