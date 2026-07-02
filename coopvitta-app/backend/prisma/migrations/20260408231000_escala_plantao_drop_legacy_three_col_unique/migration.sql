-- Corrige bases onde a unique antiga (apenas escala_id + data + grade_id) permaneceu
-- porque o nome da constraint no PostgreSQL não coincidia com o DROP IF EXISTS da migração anterior.
-- Sem remover essa constraint, só é permitido um médico por slot.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'escala_plantoes'
      AND c.contype = 'u'
      AND (
        SELECT COUNT(DISTINCT a.attname)::int
        FROM unnest(c.conkey) AS u(attnum)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum AND NOT a.attisdropped
      ) = 3
      AND (
        SELECT COALESCE(array_agg(DISTINCT a.attname), ARRAY[]::name[])
        FROM unnest(c.conkey) AS u(attnum)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum AND NOT a.attisdropped
      ) @> ARRAY['escala_id', 'data', 'grade_id']::name[]
  LOOP
    EXECUTE format('ALTER TABLE escala_plantoes DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Garante a unique esperada pelo Prisma (idempotente se já existir).
DO $$
BEGIN
  ALTER TABLE escala_plantoes
    ADD CONSTRAINT escala_plantoes_escala_id_data_grade_id_medico_id_key
    UNIQUE (escala_id, data, grade_id, medico_id);
EXCEPTION
  WHEN SQLSTATE '42P07' THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
