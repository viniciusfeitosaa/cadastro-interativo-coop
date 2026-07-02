-- Garante remoção da UNIQUE legada (tenant, contrato, subgrupo, grade) sem equipe_id,
-- que impede INSERT com equipe_id preenchido. Recria índices únicos parciais.

DROP INDEX IF EXISTS "valores_plantao_default_por_grade";
DROP INDEX IF EXISTS "valores_plantao_por_equipe";

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    INNER JOIN pg_class t ON c.conrelid = t.oid
    INNER JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'valores_plantao'
      AND c.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.valores_plantao DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.valores_plantao
  ADD COLUMN IF NOT EXISTS equipe_id TEXT;

ALTER TABLE public.valores_plantao DROP CONSTRAINT IF EXISTS valores_plantao_equipe_id_fkey;
ALTER TABLE public.valores_plantao
  ADD CONSTRAINT valores_plantao_equipe_id_fkey
  FOREIGN KEY (equipe_id) REFERENCES public.equipes(id) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS valores_plantao_default_por_grade
  ON public.valores_plantao (tenant_id, contrato_ativo_id, subgrupo_id, grade_id)
  WHERE equipe_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS valores_plantao_por_equipe
  ON public.valores_plantao (tenant_id, contrato_ativo_id, subgrupo_id, grade_id, equipe_id)
  WHERE equipe_id IS NOT NULL;
