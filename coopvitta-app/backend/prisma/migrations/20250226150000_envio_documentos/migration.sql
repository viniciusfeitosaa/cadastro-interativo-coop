-- AlterEnum
ALTER TYPE "ModuloSistema" ADD VALUE 'ENVIO_DOCUMENTOS';

-- CreateTable
CREATE TABLE "documentos_enviados" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "titulo" VARCHAR(255),
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "caminho_arquivo" TEXT NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "enviado_por_id" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_enviados_tenant_id_idx" ON "documentos_enviados"("tenant_id");

-- CreateIndex
CREATE INDEX "documentos_enviados_medico_id_idx" ON "documentos_enviados"("medico_id");

-- AddForeignKey
ALTER TABLE "documentos_enviados" ADD CONSTRAINT "documentos_enviados_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_enviados" ADD CONSTRAINT "documentos_enviados_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
