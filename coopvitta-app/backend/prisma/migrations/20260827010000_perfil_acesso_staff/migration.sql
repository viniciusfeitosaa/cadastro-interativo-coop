-- CreateEnum
CREATE TYPE "NivelAcessoModulo" AS ENUM ('OFF', 'VER', 'EDITAR');

-- AlterTable
ALTER TABLE "usuarios_master" ADD COLUMN "perfil_acesso_id" TEXT;

-- CreateTable
CREATE TABLE "perfis_acesso" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfis_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis_acesso_modulos" (
    "id" TEXT NOT NULL,
    "perfil_acesso_id" TEXT NOT NULL,
    "modulo" "ModuloSistema" NOT NULL,
    "nivel" "NivelAcessoModulo" NOT NULL DEFAULT 'OFF',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfis_acesso_modulos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "perfis_acesso_tenant_id_idx" ON "perfis_acesso"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_acesso_tenant_id_nome_key" ON "perfis_acesso"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "perfis_acesso_modulos_perfil_acesso_id_idx" ON "perfis_acesso_modulos"("perfil_acesso_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_acesso_modulos_perfil_acesso_id_modulo_key" ON "perfis_acesso_modulos"("perfil_acesso_id", "modulo");

-- AddForeignKey
ALTER TABLE "perfis_acesso" ADD CONSTRAINT "perfis_acesso_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfis_acesso_modulos" ADD CONSTRAINT "perfis_acesso_modulos_perfil_acesso_id_fkey" FOREIGN KEY ("perfil_acesso_id") REFERENCES "perfis_acesso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_master" ADD CONSTRAINT "usuarios_master_perfil_acesso_id_fkey" FOREIGN KEY ("perfil_acesso_id") REFERENCES "perfis_acesso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
