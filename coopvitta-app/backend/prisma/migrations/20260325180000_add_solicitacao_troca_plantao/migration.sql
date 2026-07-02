-- CreateTable
CREATE TABLE "solicitacoes_troca_plantao" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "escala_plantao_id" TEXT NOT NULL,
    "medico_solicitante_id" TEXT NOT NULL,
    "medico_destino_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_troca_plantao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitacoes_troca_plantao_tenant_id_medico_solicitante_id_idx" ON "solicitacoes_troca_plantao"("tenant_id", "medico_solicitante_id");

-- CreateIndex
CREATE INDEX "solicitacoes_troca_plantao_escala_plantao_id_idx" ON "solicitacoes_troca_plantao"("escala_plantao_id");

-- AddForeignKey
ALTER TABLE "solicitacoes_troca_plantao" ADD CONSTRAINT "solicitacoes_troca_plantao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_troca_plantao" ADD CONSTRAINT "solicitacoes_troca_plantao_escala_plantao_id_fkey" FOREIGN KEY ("escala_plantao_id") REFERENCES "escala_plantoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_troca_plantao" ADD CONSTRAINT "solicitacoes_troca_plantao_medico_solicitante_id_fkey" FOREIGN KEY ("medico_solicitante_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_troca_plantao" ADD CONSTRAINT "solicitacoes_troca_plantao_medico_destino_id_fkey" FOREIGN KEY ("medico_destino_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
