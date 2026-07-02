-- Cadastro público passa por análise (módulo Avaliação) antes de ativar o acesso.
CREATE TYPE "StatusCadastroMedico" AS ENUM ('PENDENTE_ANALISE', 'ATIVO', 'REJEITADO');

ALTER TABLE "medicos" ADD COLUMN "status_cadastro" "StatusCadastroMedico" NOT NULL DEFAULT 'ATIVO';

CREATE INDEX "medicos_tenant_id_status_cadastro_idx" ON "medicos" ("tenant_id", "status_cadastro");
