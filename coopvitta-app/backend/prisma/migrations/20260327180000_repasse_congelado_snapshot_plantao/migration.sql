-- Congelar duração do turno no slot (histórico) e valor de repasse no fechamento do ponto.
ALTER TABLE "escala_plantoes" ADD COLUMN "horas_turno_snapshot" DECIMAL(10,4);
ALTER TABLE "registros_ponto" ADD COLUMN "repasse_valor_congelado" DECIMAL(12,2);
