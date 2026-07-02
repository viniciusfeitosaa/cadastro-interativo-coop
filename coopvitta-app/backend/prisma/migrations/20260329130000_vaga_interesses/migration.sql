-- CreateEnum
CREATE TYPE "StatusInteresseVaga" AS ENUM ('PENDENTE', 'ACEITO', 'RECUSADO');

-- CreateTable
CREATE TABLE "vaga_interesses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vaga_id" TEXT NOT NULL,
    "candidato_medico_id" TEXT NOT NULL,
    "status" "StatusInteresseVaga" NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaga_interesses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vaga_interesses_vaga_id_candidato_medico_id_key" ON "vaga_interesses"("vaga_id", "candidato_medico_id");
CREATE INDEX "vaga_interesses_tenant_id_idx" ON "vaga_interesses"("tenant_id");
CREATE INDEX "vaga_interesses_vaga_id_idx" ON "vaga_interesses"("vaga_id");
CREATE INDEX "vaga_interesses_candidato_medico_id_idx" ON "vaga_interesses"("candidato_medico_id");
CREATE INDEX "vaga_interesses_status_idx" ON "vaga_interesses"("status");

ALTER TABLE "vaga_interesses" ADD CONSTRAINT "vaga_interesses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vaga_interesses" ADD CONSTRAINT "vaga_interesses_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vaga_interesses" ADD CONSTRAINT "vaga_interesses_candidato_medico_id_fkey" FOREIGN KEY ("candidato_medico_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
