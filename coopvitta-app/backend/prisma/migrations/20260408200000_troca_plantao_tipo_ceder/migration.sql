-- PERMUTA = troca bilateral; CEDER = transferência unilateral do plantão ao aceitante.
ALTER TABLE "solicitacoes_troca_plantao" ADD COLUMN "tipo_solicitacao" VARCHAR(20) NOT NULL DEFAULT 'PERMUTA';
