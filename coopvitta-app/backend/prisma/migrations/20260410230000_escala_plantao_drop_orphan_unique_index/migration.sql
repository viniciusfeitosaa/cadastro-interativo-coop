-- Índice UNIQUE legado (só escala + data + grade), sem medico_id.
-- Pode existir como CREATE UNIQUE INDEX sem entrada equivalente em pg_constraint;
-- a migração anterior só removia constraints e por isso este índice continuou a bloquear vários médicos no mesmo slot.

DROP INDEX IF EXISTS "escala_plantoes_escala_id_data_grade_id_key";
