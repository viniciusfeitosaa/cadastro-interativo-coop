# Landing Page – Seja Viva Saúde

Pasta isolada do projeto. A landing page usa o **design.json** como norte para conteúdo e identidade visual.

## Estrutura

```
landing/
├── index.html        # Página principal (conteúdo baseado no design.json)
├── design.json       # Fonte de verdade: site, identidade visual, textos, serviços
├── css/
│   └── style.css     # Estilos (variáveis CSS para cores/tipografia)
├── js/
│   └── design-loader.js   # Aplica cores e tipografia do design.json na página
├── assets/           # Imagens (logo, rodapé, etc.)
└── README.md
```

## design.json

- **site**: nome, URL, descrição, contato (e-mail, telefone, endereço), redes sociais.
- **identity_visual**: logo, imagens, cores (primary, secondary, background, text), tipografia.
- **pages.home**: texto do hero, sobre, lista de serviços, depoimentos, FAQ, rodapé.

Quando você preencher as cores em `identity_visual.colors` (ex.: `"#0d9488"` em vez de `"#______"`), o **design-loader.js** aplica elas na página automaticamente (use um servidor local para o `fetch` do JSON funcionar).

## Imagens

Coloque em **assets/**:

- **logo.png** – logomarca principal (ex.: usar “PRIME LOC (3).png” renomeado).
- **logo-rodape.png** – ícone/logo do rodapé (ex.: “PRIME LOC (5).png”).

Se os arquivos tiverem outros nomes, ajuste os `src` em `index.html`.

## Como ver a página

1. Abra **index.html** no navegador (duplo clique), ou  
2. Use um servidor local (ex.: extensão **Live Server** no VS Code) para que o **design.json** seja carregado e as cores/tipografia do JSON sejam aplicadas.

## Próximos passos possíveis

- Preencher cores e fontes no **design.json**.
- Adicionar textos reais dos depoimentos e itens de FAQ.
- Criar páginas “Política de Privacidade” e “Política de Cookies”.
- Incluir link para o app (área do médico) no header ou no CTA.
