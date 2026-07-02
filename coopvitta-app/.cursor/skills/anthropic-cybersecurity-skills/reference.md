# Anthropic Cybersecurity Skills — referência consolidada

**Repositório:** [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)  
**README raw:** `https://raw.githubusercontent.com/mukul975/Anthropic-Cybersecurity-Skills/main/README.md`  
**Aviso legal do upstream:** projeto **comunitário independente** — **não afiliado** à Anthropic PBC.

**Licença:** Apache-2.0 (ver `LICENSE` no repositório).

---

## Escopo (README)

- **754+** skills de cibersegurança orientadas a agentes.  
- **26** domínios de segurança.  
- Cada skill mapeada a **cinco** referências: **MITRE ATT&CK**, **NIST CSF 2.0**, **MITRE ATLAS**, **MITRE D3FEND**, **NIST AI RMF**.  
- Compatível com plataformas **agentskills.io** (Claude Code, Copilot, **Cursor**, Codex CLI, Gemini CLI, etc.).

---

## Cinco frameworks (resumo)

| Framework | Versão (README) | Papel no repo |
|-----------|-----------------|---------------|
| MITRE ATT&CK | v18 (nota: v19 prevista no README com alterações a táticas) | TTPs de adversário |
| NIST CSF | 2.0 | Postura organizacional (6 funções) |
| MITRE ATLAS | v5.4 | Ameaças a AI/ML |
| MITRE D3FEND | v1.3 | Contramedidas defensivas |
| NIST AI RMF | 1.0 | Risco de AI (subcategorias + perfil GenAI citado no README) |

**Exemplo de skill cruzada (README):** `analyzing-network-traffic-of-malware` ↔ T1071, DE.CM, AML.T0047, D3-NTA, MEASURE-2.6.

---

## Quick start (README)

```bash
npx skills add mukul975/Anthropic-Cybersecurity-Skills
```

```bash
git clone https://github.com/mukul975/Anthropic-Cybersecurity-Skills.git
cd Anthropic-Cybersecurity-Skills
```

---

## Os 26 domínios (tabela do README)

| Domain | Skills (aprox.) | Capacidades-chave (resumo README) |
|--------|-----------------|-----------------------------------|
| Cloud Security | 60 | AWS/Azure/GCP, CSPM, forensics cloud |
| Threat Hunting | 55 | Hipóteses, LOTL, analytics |
| Threat Intelligence | 50 | STIX/TAXII, MISP, feeds |
| Web Application Security | 42 | OWASP Top 10, SQLi, XSS, SSRF |
| Network Security | 40 | IDS/IPS, firewalls, tráfego |
| Malware Analysis | 39 | Estático/dinâmico, RE, sandbox |
| Digital Forensics | 37 | Imagem disco, memória, timeline |
| Security Operations | 36 | SIEM, logs, triage |
| Identity & Access Management | 35 | IAM, PAM, zero trust, Okta… |
| SOC Operations | 33 | Playbooks, métricas, tabletop |
| Container Security | 30 | K8s RBAC, Falco, imagens |
| OT/ICS Security | 28 | Modbus, DNP3, IEC 62443 |
| API Security | 28 | GraphQL, REST, OWASP API |
| Vulnerability Management | 25 | Nessus, CVSS, priorização |
| Incident Response | 25 | Contenção, ransomware, IR |
| Red Teaming | 24 | Engagements, AD, phishing sim |
| Penetration Testing | 23 | Rede, web, cloud, mobile, wireless |
| Endpoint Security | 17 | EDR, fileless, persistência |
| DevSecOps | 17 | CI/CD, signing, Terraform |
| Phishing Defense | 16 | SPF/DKIM/DMARC, BEC |
| Cryptography | 14 | TLS, CT, gestão de chaves |
| Zero Trust Architecture | 13 | BeyondCorp, CISA, microsegmentação |
| Mobile Security | 12 | Android/iOS, MDM |
| Ransomware Defense | 7 | Precursores, resposta, recovery |
| Compliance & Governance | 5 | CIS, SOC 2 |
| Deception Technology | 2 | Honeytokens, canários |

---

## Como os agentes usam as skills (progressive disclosure, README)

- **~30 tokens** por skill para **varrer só o frontmatter** (descoberta).  
- **~500–2000 tokens** para carregar o corpo completo quando a skill é escolhida.  
- Fluxo típico: prompt do utilizador → match por tags/description/domain → carregar top N skills → executar secção **Workflow** → validar com **Verification**.

---

## Anatomia de cada skill (README)

```
skills/<skill-name>/
├── SKILL.md
├── references/
│   ├── standards.md
│   └── workflows.md
├── scripts/
└── assets/
```

### Secções habituais do corpo Markdown

1. **When to Use** — condições de ativação.  
2. **Prerequisites** — ferramentas, acessos, ambiente.  
3. **Workflow** — passos, comandos, decisões.  
4. **Verification** — como confirmar sucesso.

### Frontmatter (campos citados no README)

- `name` — kebab-case, 1–64 caracteres.  
- `description` — rico em palavras-chave para descoberta.  
- `domain`, `subdomain`, `tags`.  
- `atlas_techniques`, `d3fend_techniques`, `nist_ai_rmf`, `nist_csf`.  
- Mapeamentos **ATT&CK** em `references/standards.md` (e camada Navigator nas releases, v1.0.0).

Campos opcionais no exemplo README: `version`, `author`, `license`.

---

## Índice e cobertura ATT&CK

- **`index.json`** no raiz do repo (~200 KB+) — catálogo máquina-legível; usar no upstream após clone.  
- **`ATTACK_COVERAGE.md`** — cobertura detalhada por tática/técnica.  
- **Release v1.0.0** — camada MITRE ATT&CK Navigator nos assets (README).

---

## NIST CSF 2.0 (README — funções)

Govern (GV), Identify (ID), Protect (PR), Detect (DE), Respond (RS), Recover (RC) — skills distribuídas por função; números aproximados no README por função.

---

## ATLAS, D3FEND, AI RMF (README — uma frase cada)

- **ATLAS** — táticas/técnicas contra sistemas AI/ML (inclui vetores a agentes, MCP, etc., conforme texto README).  
- **D3FEND** — grafo de contramedidas (7 categorias táticas).  
- **AI RMF** — Govern/Map/Measure/Manage + perfil GenAI; ligação a compliance citada no README (ex.: Colorado AI Act).

---

## Plataformas compatíveis (lista README)

Assistentes de código (Claude Code, Copilot, **Cursor**, Windsurf, Cline, …), CLIs (Codex, Gemini), agentes autónomos, frameworks (LangChain, CrewAI, …), agentes com MCP — desde que suportem **agentskills.io**.

---

## Contribuir e citação

- Ver [CONTRIBUTING.md](https://github.com/mukul975/Anthropic-Cybersecurity-Skills/blob/main/CONTRIBUTING.md) no upstream.  
- BibTeX no README do repo (autor Mahipal Jangra, título Anthropic Cybersecurity Skills, 2026).

---

## Conteúdo fora do âmbito técnico no README original

- Inquérito **GARS-2026**, **Casky.ai** playground, badges de comunidade — são iniciativas do autor; não fazem parte do contrato técnico das skills.

---

## Uso responsável (para o agente)

Aplicar apenas em **ambientes autorizados**, **políticas internas** e **lei aplicável**. Skills de red team / pentest descrevem capacidades sensíveis: tratar como conhecimento para **defesa**, **teste autorizado** e **IR**, não para acesso ilegítimo a sistemas.
