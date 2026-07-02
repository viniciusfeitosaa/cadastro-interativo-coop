-- Marca se o profissional chegou atrasado no check-in e quantos minutos passou da tolerância.
ALTER TABLE "registros_ponto"
ADD COLUMN "checkin_atrasado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "minutos_atraso_checkin" INTEGER;
