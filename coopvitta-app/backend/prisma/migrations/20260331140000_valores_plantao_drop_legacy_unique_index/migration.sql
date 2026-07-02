-- Remove índices UNIQUE legados em valores_plantao (sem equipe_id),
-- que ainda bloqueiam inserts por equipe. Mantém apenas os índices parciais atuais.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'valores_plantao'
      AND indexdef ILIKE '%unique%'
      AND indexname NOT IN ('valores_plantao_default_por_grade', 'valores_plantao_por_equipe')
      AND indexname <> 'valores_plantao_pkey'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
  END LOOP;
END $$;

-- Recria (idempotente) os índices únicos esperados.
CREATE UNIQUE INDEX IF NOT EXISTS valores_plantao_default_por_grade
  ON public.valores_plantao (tenant_id, contrato_ativo_id, subgrupo_id, grade_id)
  WHERE equipe_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS valores_plantao_por_equipe
  ON public.valores_plantao (tenant_id, contrato_ativo_id, subgrupo_id, grade_id, equipe_id)
  WHERE equipe_id IS NOT NULL;

