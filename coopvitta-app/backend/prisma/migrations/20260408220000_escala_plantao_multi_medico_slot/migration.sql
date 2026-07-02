-- Permitir mais de um médico no mesmo dia/turno da escala (um registro por médico).
ALTER TABLE "escala_plantoes" DROP CONSTRAINT IF EXISTS "escala_plantoes_escala_id_data_grade_id_key";
ALTER TABLE "escala_plantoes" DROP CONSTRAINT IF EXISTS "EscalaPlantao_escalaId_data_gradeId_key";

ALTER TABLE "escala_plantoes" ADD CONSTRAINT "escala_plantoes_escala_id_data_grade_id_medico_id_key" UNIQUE ("escala_id", "data", "grade_id", "medico_id");
