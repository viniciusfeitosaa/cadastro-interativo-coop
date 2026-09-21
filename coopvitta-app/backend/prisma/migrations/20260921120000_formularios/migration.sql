-- AlterEnum
ALTER TYPE "ModuloSistema" ADD VALUE 'FORMULARIOS';

-- CreateEnum
CREATE TYPE "FormularioCampoTipo" AS ENUM ('TEXTO', 'TELEFONE', 'ESCOLHA_UNICA', 'FICHEIRO');
CREATE TYPE "FormularioIdentificacaoModo" AS ENUM ('ANONIMO', 'LEVE', 'FORTE');
CREATE TYPE "FormularioRespostaStatus" AS ENUM ('NOVA', 'EM_ANALISE', 'PRE_SELECIONADA', 'REJEITADA', 'ARQUIVADA');

-- CreateTable
CREATE TABLE "formularios" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "slug" VARCHAR(80) NOT NULL,
    "publico" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "identificacao_modo" "FormularioIdentificacaoModo" NOT NULL DEFAULT 'LEVE',
    "criado_por_id" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formularios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "formulario_campos" (
    "id" TEXT NOT NULL,
    "formulario_id" TEXT NOT NULL,
    "chave" VARCHAR(80) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "tipo" "FormularioCampoTipo" NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "opcoes_json" JSONB,
    "validacao_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formulario_campos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "formulario_respostas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "formulario_id" TEXT NOT NULL,
    "status" "FormularioRespostaStatus" NOT NULL DEFAULT 'NOVA',
    "remetente_nome" VARCHAR(255) NOT NULL,
    "remetente_telefone" VARCHAR(40) NOT NULL,
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formulario_respostas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "formulario_resposta_valores" (
    "id" TEXT NOT NULL,
    "resposta_id" TEXT NOT NULL,
    "campo_id" TEXT NOT NULL,
    "valor_texto" TEXT,
    "valor_json" JSONB,
    "nome_arquivo" VARCHAR(255),
    "caminho_arquivo" TEXT,
    "mime_type" VARCHAR(120),
    "tamanho_bytes" INTEGER,

    CONSTRAINT "formulario_resposta_valores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "formularios_tenant_id_slug_key" ON "formularios"("tenant_id", "slug");
CREATE INDEX "formularios_tenant_id_idx" ON "formularios"("tenant_id");
CREATE INDEX "formularios_slug_idx" ON "formularios"("slug");
CREATE UNIQUE INDEX "formulario_campos_formulario_id_chave_key" ON "formulario_campos"("formulario_id", "chave");
CREATE INDEX "formulario_campos_formulario_id_idx" ON "formulario_campos"("formulario_id");
CREATE INDEX "formulario_respostas_tenant_id_idx" ON "formulario_respostas"("tenant_id");
CREATE INDEX "formulario_respostas_formulario_id_created_at_idx" ON "formulario_respostas"("formulario_id", "created_at");
CREATE INDEX "formulario_respostas_status_idx" ON "formulario_respostas"("status");
CREATE UNIQUE INDEX "formulario_resposta_valores_resposta_id_campo_id_key" ON "formulario_resposta_valores"("resposta_id", "campo_id");
CREATE INDEX "formulario_resposta_valores_resposta_id_idx" ON "formulario_resposta_valores"("resposta_id");

ALTER TABLE "formularios" ADD CONSTRAINT "formularios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "formulario_campos" ADD CONSTRAINT "formulario_campos_formulario_id_fkey" FOREIGN KEY ("formulario_id") REFERENCES "formularios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "formulario_respostas" ADD CONSTRAINT "formulario_respostas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "formulario_respostas" ADD CONSTRAINT "formulario_respostas_formulario_id_fkey" FOREIGN KEY ("formulario_id") REFERENCES "formularios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "formulario_resposta_valores" ADD CONSTRAINT "formulario_resposta_valores_resposta_id_fkey" FOREIGN KEY ("resposta_id") REFERENCES "formulario_respostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "formulario_resposta_valores" ADD CONSTRAINT "formulario_resposta_valores_campo_id_fkey" FOREIGN KEY ("campo_id") REFERENCES "formulario_campos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
