# DocuSeal COOPVITTA — Segurança e validade jurídica

Guia operacional para assinatura eletrônica **avançada** (Lei nº 14.063/2020) no ambiente self-hosted.

> **Importante:** Este documento não substitui assessoria jurídica. A COOPVITTA deve manter política interna sobre quais documentos podem ser assinados eletronicamente.

## Nível de assinatura

| Nível | DocuSeal self-hosted | Uso COOPVITTA |
|-------|---------------------|---------------|
| Simples | Parcial | Evitar para contratos críticos |
| **Avançada** | **Sim** (com config abaixo) | Termos de adesão, contratos B2B, RH interno |
| Qualificada (ICP-Brasil) | Não nativo | Imóveis, atos públicos — usar e-CPF/e-CNPJ |

## Pilares já configurados na VPS

### 1. Trilha de auditoria (Audit Trail)

O DocuSeal anexa ao PDF final um **Certificado de Auditoria** com:

- IP do signatário
- E-mail e data/hora (timestamp)
- Hash do documento (integridade)

**Ação:** Após cada assinatura, baixe e arquive o PDF completo + certificado na pasta do cooperado.

### 2. Verificação de identidade por e-mail (2FA)

Todas as submissões criadas pela plataforma AppVS usam:

```env
DOCUSEAL_REQUIRE_EMAIL_2FA=true
```

O signatário recebe um **código OTP por e-mail** antes de abrir o documento — reforço da associação unívoca (Lei 14.063/2020, art. 4º, II).

### 3. E-mail transacional dedicado

| Conta | Uso |
|-------|-----|
| `assinaturas@coopvitta.cloud` | Convites DocuSeal |
| `noreply@coopvitta.cloud` | Cadastro / notificações app |

Remetente configurado: `COOPVITTA Assinaturas <assinaturas@coopvitta.cloud>`  
Reply-To: `contato@coopvitta.org`

### 4. HTTPS e instância isolada

- URL pública: https://assinaturas.coopvitta.cloud
- `FORCE_SSL` + certificado Let's Encrypt
- Banco PostgreSQL apenas na rede interna Docker

### 5. Integração AppVS

- API token em `DOCUSEAL_API_KEY` (rotacionar periodicamente)
- Template **Termo de adesão** (id 2): cooperado + COOPVITTA (dois signatários)
- Template **Termo de responsabilidade — viaturas/equipamentos SAMU** (id 4): **só o cooperado** preenche e assina (`singleSubmitter: true`)

## DNS obrigatório (anti-spoofing / entregabilidade)

Sem SPF + DKIM + DMARC, terceiros podem questionar a autenticidade dos e-mails de convite.

Execute na VPS:

```bash
sudo bash /opt/coopvitta/infra/scripts/check-email-dns.sh
```

### Registros a criar no painel DNS de `coopvitta.cloud`

| Tipo | Nome | Valor |
|------|------|-------|
| A | `mail` | `187.127.35.253` |
| MX | `@` | `10 mail.coopvitta.cloud` |
| TXT | `@` | `v=spf1 ip4:187.127.35.253 -all` |
| TXT | `default._domainkey` | *(ver saída do script ou `docker exec maddy cat /data/dkim_keys/coopvitta.cloud_default.dns`)* |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:contato@coopvitta.org; pct=100; adkim=s; aspf=s` |

**PTR (rDNS):** solicitar ao provedor da VPS: `187.127.35.253` → `mail.coopvitta.cloud`

## Checklist administrador DocuSeal

Faça em https://assinaturas.coopvitta.cloud (conta admin):

- [ ] **Ativar 2FA TOTP** na sua conta (Settings → Security) — protege criação de templates e API
- [ ] **Não compartilhar** links de assinatura por WhatsApp sem o OTP por e-mail
- [ ] **Desativar/arquivar** templates obsoletos (ex.: template id 1 arquivado)
- [ ] **Revisar** campos de assinatura nos PDFs (nome, CPF, data)
- [ ] **Rotacionar** API token anualmente (Settings → API)
- [ ] **Backup** semanal: `/opt/coopvitta/docuseal/docuseal_data` + `pg_data`

## Fluxo recomendado COOPVITTA

```
Cadastro aprovado (AppVS)
    → Master envia template DocuSeal (automático ou manual)
    → Cooperado recebe e-mail de assinaturas@coopvitta.cloud
    → Cooperado informa código OTP (2FA e-mail)
    → Assina documento
    → COOPVITTA (Segunda Parte) assina com 2FA
    → PDF + Audit Trail arquivados
```

## Documentos adequados vs inadequados

### Adequados (assinatura avançada DocuSeal)

- Termo de adesão / aceite digital do cooperado
- Contratos de prestação de serviços
- Termos internos de RH
- Acordos comerciais B2B

### Inadequados (exigem ICP-Brasil / cartório)

- Transferência de imóveis
- Atos oficiais de autoridades
- Procedimentos que exijam e-CPF/e-CNPJ qualificado

## Manutenção

```bash
# Renovar cert TLS do Maddy após renovação NPM
sudo bash /opt/coopvitta/infra/scripts/sync-maddy-certs.sh

# Verificar DNS
sudo bash /opt/coopvitta/infra/scripts/check-email-dns.sh

# Logs DocuSeal
sudo docker logs docuseal-app --tail 100
sudo docker logs docuseal-sidekiq --tail 100
```

## Referências

- [Lei 14.063/2020](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm)
- [DocuSeal API — require_email_2fa](https://www.docuseal.com/docs/api)
- [DocuSeal self-hosting](https://www.docuseal.com/docs/hosting)
