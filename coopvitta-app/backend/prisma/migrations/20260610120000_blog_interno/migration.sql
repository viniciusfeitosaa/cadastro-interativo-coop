-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('RASCUNHO', 'PUBLICADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "BlogCommentStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "resumo" VARCHAR(320) NOT NULL,
    "conteudo" TEXT NOT NULL,
    "capa_url" VARCHAR(500),
    "status" "BlogPostStatus" NOT NULL DEFAULT 'RASCUNHO',
    "publicado_em" TIMESTAMP(3),
    "autor_id" TEXT NOT NULL,
    "seo_title" VARCHAR(255),
    "seo_description" VARCHAR(320),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_comments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "autor_nome" VARCHAR(120) NOT NULL,
    "autor_email" VARCHAR(255) NOT NULL,
    "conteudo" TEXT NOT NULL,
    "status" "BlogCommentStatus" NOT NULL DEFAULT 'PENDENTE',
    "resposta_texto" TEXT,
    "respondido_por_id" TEXT,
    "respondido_em" TIMESTAMP(3),
    "consentimento_lgpd" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blog_categories_tenant_id_ordem_idx" ON "blog_categories"("tenant_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_tenant_id_slug_key" ON "blog_categories"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "blog_posts_tenant_id_status_publicado_em_idx" ON "blog_posts"("tenant_id", "status", "publicado_em");

-- CreateIndex
CREATE INDEX "blog_posts_category_id_idx" ON "blog_posts"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_tenant_id_slug_key" ON "blog_posts"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "blog_comments_tenant_id_status_created_at_idx" ON "blog_comments"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "blog_comments_post_id_status_idx" ON "blog_comments"("post_id", "status");

-- AddForeignKey
ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_respondido_por_id_fkey" FOREIGN KEY ("respondido_por_id") REFERENCES "usuarios_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
