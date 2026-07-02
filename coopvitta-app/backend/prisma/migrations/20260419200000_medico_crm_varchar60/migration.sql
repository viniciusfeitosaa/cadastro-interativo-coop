-- Alarga registro profissional (coluna `crm`) para acomodar COREN, CRP, CRO, etc.
ALTER TABLE "medicos" ALTER COLUMN "crm" TYPE VARCHAR(60);
