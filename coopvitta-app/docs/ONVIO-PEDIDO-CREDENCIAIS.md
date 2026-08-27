# Pedido de credenciais Onvio BR API

Enviar para: **api.dominio@tr.com**

Não incluir a integration key no corpo do e-mail (nem em anexos versionados). Se for preciso mencioná-la, diga apenas que a cooperativa já possui uma *integration key* e peça confirmação do header/uso correto.

---

**Assunto:** Solicitação de credenciais OAuth e consulta sobre API de partner-registration — COOPVITTA

Prezada equipe Onvio BR API,

Somos a **COOPVITTA** e estamos integrando nosso sistema interno de gestão de associados (`https://app.coopvitta.cloud`) com o Onvio.

### 1. Credenciais OAuth 2.0

Solicitamos as credenciais para integração com a **Onvio BR Accounting API**, conforme a documentação do Developer Portal:

- **Empresa:** COOPVITTA
- **Contato principal:** [Nome completo]
- **Telefone:** [DDD + número]
- **E-mail:** [e-mail institucional]
- **Callback URL (redirect_uri):** `https://app.coopvitta.cloud/api/integrations/onvio/callback`

Pedimos o envio de **client_id** e **client_secret**, e a confirmação do ambiente (homologação/produção) e do audience padrão a utilizar.

### 2. API de cadastro (partner-registration)

Nosso objetivo de produto é, a partir do cadastro de um associado no COOPVITTA, **criar automaticamente um novo registro** na área do Client Center equivalente a:

`https://onvio.com.br/clientcenter/pt/actions/service-request/partner-registration`

Pela documentação pública da Accounting API, identificamos recursos de autenticação OAuth, listagem de clientes (`ClientInfoResource`) e integração de documentos fiscais (`InvoiceIntegrationResource`), mas **não encontramos** um endpoint REST documentado para criar/preencher esse cadastro de *partner-registration*.

Perguntamos:

1. Existe **API oficial** (pública ou privada) para criar esse tipo de cadastro/service request a partir de um sistema externo?
2. Se sim, poderiam compartilhar: URL base, método, autenticação necessária (Bearer / integration key / outros), contrato do payload e se há ambiente de homologação?
3. Se não, qual o caminho suportado pela Thomson Reuters para esse caso de uso (ou se está no roadmap)?

Ficamos à disposição para alinhamento técnico.

Atenciosamente,  
[Nome]  
[Cargo]  
COOPVITTA  
[Telefone] | [E-mail]
