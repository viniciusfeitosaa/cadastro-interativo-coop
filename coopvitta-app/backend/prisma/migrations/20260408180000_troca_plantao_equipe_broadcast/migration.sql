-- Troca aberta à equipe: destinatário definido só no aceite (primeiro que aceitar).
ALTER TABLE "solicitacoes_troca_plantao" ALTER COLUMN "medico_destino_id" DROP NOT NULL;
