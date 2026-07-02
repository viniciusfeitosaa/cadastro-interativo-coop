-- Permuta de plantão: plantão do colega que o solicitante assume em troca do próprio.
ALTER TABLE "solicitacoes_troca_plantao" ADD COLUMN "contrapartida_plantao_id" TEXT;

CREATE INDEX "solicitacoes_troca_plantao_contrapartida_plantao_id_idx" ON "solicitacoes_troca_plantao"("contrapartida_plantao_id");

ALTER TABLE "solicitacoes_troca_plantao" ADD CONSTRAINT "solicitacoes_troca_plantao_contrapartida_plantao_id_fkey" FOREIGN KEY ("contrapartida_plantao_id") REFERENCES "escala_plantoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
