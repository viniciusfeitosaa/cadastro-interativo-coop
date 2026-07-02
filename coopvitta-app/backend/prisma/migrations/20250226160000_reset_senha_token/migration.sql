-- CreateTable
CREATE TABLE "reset_senha_tokens" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reset_senha_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reset_senha_tokens_token_hash_idx" ON "reset_senha_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "reset_senha_tokens_tenant_id_email_idx" ON "reset_senha_tokens"("tenant_id", "email");

-- AddForeignKey
ALTER TABLE "reset_senha_tokens" ADD CONSTRAINT "reset_senha_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
