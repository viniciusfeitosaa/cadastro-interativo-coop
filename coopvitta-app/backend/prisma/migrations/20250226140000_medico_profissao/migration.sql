-- Adicionar profissão (default Médico) e tornar CRM opcional
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "profissao" VARCHAR(80) NOT NULL DEFAULT 'Médico';
ALTER TABLE "medicos" ALTER COLUMN "crm" DROP NOT NULL;
