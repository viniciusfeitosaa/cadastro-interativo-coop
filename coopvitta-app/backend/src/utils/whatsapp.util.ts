/** Gera link wa.me a partir do telefone cadastrado (apenas dígitos; assume BR 55 se faltar DDI). */
export function whatsappHrefFromTelefone(telefone: string | null | undefined): string | null {
  if (!telefone || typeof telefone !== 'string') return null;
  let d = telefone.replace(/\D/g, '');
  if (d.length < 10) return null;
  if (!d.startsWith('55')) d = `55${d}`;
  return `https://wa.me/${d}`;
}
