-- Registo do aceite dos termos no cadastro público (auditoria / conformidade).
ALTER TABLE "medicos" ADD COLUMN "termos_cadastro_aceitos_em" TIMESTAMPTZ;
ALTER TABLE "medicos" ADD COLUMN "termos_cadastro_versao" VARCHAR(24);
