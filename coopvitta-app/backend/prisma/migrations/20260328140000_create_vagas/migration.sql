-- CreateTable
CREATE TABLE "vagas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "medico_publicador_id" TEXT NOT NULL,
    "tipo_atendimento" VARCHAR(120) NOT NULL,
    "setor" VARCHAR(200) NOT NULL,
    "valor_a_combinar" BOOLEAN NOT NULL,
    "valor_centavos" INTEGER,
    "valor_liquido_bruto" VARCHAR(10),
    "pagamento" VARCHAR(20) NOT NULL,
    "quantidade_vagas" INTEGER NOT NULL,
    "prazo_publicacao_dias" INTEGER NOT NULL,
    "categoria_profissional" VARCHAR(40) NOT NULL DEFAULT 'MEDICO',
    "dias_vaga" JSONB NOT NULL,
    "descricao" TEXT NOT NULL,
    "confirmacao_responsavel" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vagas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vagas_tenant_id_expires_at_idx" ON "vagas"("tenant_id", "expires_at");
CREATE INDEX "vagas_medico_publicador_id_idx" ON "vagas"("medico_publicador_id");

ALTER TABLE "vagas" ADD CONSTRAINT "vagas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_medico_publicador_id_fkey" FOREIGN KEY ("medico_publicador_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
