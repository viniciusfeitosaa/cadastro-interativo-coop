const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);

/** Markdown básico → HTML seguro (headings, parágrafos, negrito, itálico, links). */
export const markdownToHtml = (markdown: string): string => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const inline = formatInline(paragraph.join(' ').trim());
    if (inline) htmlParts.push(`<p>${inline}</p>`);
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      flushParagraph();
      htmlParts.push(`<h2>${formatInline(h2[1])}</h2>`);
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      flushParagraph();
      htmlParts.push(`<h3>${formatInline(h3[1])}</h3>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return htmlParts.join('\n');
};

const formatInline = (text: string): string => {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>'
  );
  return out;
};

export const formatPostPublic = (post: {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  capaUrl: string | null;
  publicadoEm: Date | null;
  seoTitle: string | null;
  seoDescription: string | null;
  category: { slug: string; nome: string };
}) => ({
  id: post.id,
  slug: post.slug,
  titulo: post.titulo,
  resumo: post.resumo,
  conteudo: post.conteudo,
  conteudoHtml: markdownToHtml(post.conteudo),
  capaUrl: post.capaUrl,
  publicadoEm: post.publicadoEm,
  seoTitle: post.seoTitle,
  seoDescription: post.seoDescription,
  categoria: {
    slug: post.category.slug,
    nome: post.category.nome,
  },
});
