-- Tipos de plantão por contrato; grade_id passa a aceitar UUID (36 chars).

CREATE TABLE "tipos_plantao" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contrato_ativo_id" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fim" VARCHAR(5) NOT NULL,
    "cruza_meia_noite" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_plantao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tipos_plantao_tenant_id_contrato_ativo_id_idx" ON "tipos_plantao"("tenant_id", "contrato_ativo_id");

ALTER TABLE "tipos_plantao" ADD CONSTRAINT "tipos_plantao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tipos_plantao" ADD CONSTRAINT "tipos_plantao_contrato_ativo_id_fkey" FOREIGN KEY ("contrato_ativo_id") REFERENCES "contratos_ativos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "escala_plantoes" ALTER COLUMN "grade_id" TYPE VARCHAR(36);
ALTER TABLE "valores_plantao" ALTER COLUMN "grade_id" TYPE VARCHAR(36);
ALTER TABLE "adicionais_plantao_data" ALTER COLUMN "grade_id" TYPE VARCHAR(36);
