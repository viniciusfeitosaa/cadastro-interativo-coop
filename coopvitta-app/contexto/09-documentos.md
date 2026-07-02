# 09 — Documentos

**Status:** ✅ Implementado  
**Última atualização:** 2026-05-28

## Tipos

### Documentos de perfil do médico

Enum `DocumentoPerfilTipo` (CRM, diploma, RQE, PIX, etc.) — modelo `MedicoDocumento`.

### Documentos enviados (fluxo administrativo)

- `DocumentoEnviado` — upload pelo master, aceite pelo médico
- Campo `aceitoEm` (migration `documento_enviado_aceito_em`)
- `documentosenviados.service.ts`, `documentos.const.ts`

## Integração DocuSeal

- `docuseal.service.ts` — quando `DOCUSEAL_*` configurado no env

## Upload

- Middleware `upload.middleware.ts`
- Path seguro: `upload-path.util.ts` (+ testes)
- Validação magic bytes de imagem: `image-magic-bytes.util.ts`

## Rotas

**Médico:** `/api/medico/documentos-enviados` (listar, upload próprio onde aplicável)

**Admin:** `/api/admin/documentos-enviados` (módulo `ENVIO_DOCUMENTOS`)

## Frontend

- `EnvioDocumentos.tsx` — envio (gestão)
- `MeusDocumentos.tsx` — médico visualiza/aceita

## Pendências

- [ ] Atualizar este doc quando novos tipos de documento forem adicionados ao enum
