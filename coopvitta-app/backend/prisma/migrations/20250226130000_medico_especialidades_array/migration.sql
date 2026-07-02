-- AlterTable: substituir especialidade (única) por especialidades (array)
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "especialidades" TEXT[] DEFAULT '{}';

-- Migrar dados: um valor em especialidade vira um elemento; vazio = Clínica Médica
UPDATE "medicos"
SET "especialidades" = CASE
  WHEN "especialidade" IS NOT NULL AND TRIM("especialidade") != '' THEN ARRAY[TRIM("especialidade")]
  ELSE ARRAY['Clínica Médica']
END
WHERE "especialidades" = '{}' OR "especialidades" IS NULL;

-- Garantir default para coluna
ALTER TABLE "medicos" ALTER COLUMN "especialidades" SET DEFAULT '{}';

-- Remover coluna antiga
ALTER TABLE "medicos" DROP COLUMN IF EXISTS "especialidade";
