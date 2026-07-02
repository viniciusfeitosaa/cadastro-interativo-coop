-- CreateTable
CREATE TABLE "adicionais_plantao_data" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contrato_ativo_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "grade_id" VARCHAR(20) NOT NULL,
    "percentual" DECIMAL(6,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adicionais_plantao_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adicionais_plantao_data_tenant_id_contrato_ativo_id_data_grade_id_key"
ON "adicionais_plantao_data"("tenant_id", "contrato_ativo_id", "data", "grade_id");

-- CreateIndex
CREATE INDEX "adicionais_plantao_data_tenant_id_idx" ON "adicionais_plantao_data"("tenant_id");

-- CreateIndex
CREATE INDEX "adicionais_plantao_data_contrato_ativo_id_idx" ON "adicionais_plantao_data"("contrato_ativo_id");

-- CreateIndex
CREATE INDEX "adicionais_plantao_data_data_idx" ON "adicionais_plantao_data"("data");

-- AddForeignKey
ALTER TABLE "adicionais_plantao_data" ADD CONSTRAINT "adicionais_plantao_data_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adicionais_plantao_data" ADD CONSTRAINT "adicionais_plantao_data_contrato_ativo_id_fkey"
FOREIGN KEY ("contrato_ativo_id") REFERENCES "contratos_ativos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

