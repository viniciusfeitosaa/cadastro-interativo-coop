/**
 * Formata CPF para exibição
 */
export function formatCPF(cpf: string): string {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Corrige mojibake de encoding (ex.: "Clï¿½nica" -> "Clínica") na exibição
 */
export function fixMojibake(text: string | null | undefined): string {
  if (text == null || typeof text !== 'string') return '';
  return text
    .replace(/Clï¿½nica/gi, 'Clínica')
    .replace(/Mï¿½dica/gi, 'Médica')
    .replace(/\uFFFD/g, 'í') // caractere de substituição UTF-8
    .replace(/ï¿½/g, 'í');   // mojibake do mesmo quando lido como Latin1
}

/**
 * Formata CRM para exibição
 */
export function formatCRM(crm: string): string {
  if (!crm) return '';
  const clean = crm.trim().toUpperCase();
  const match = clean.match(/^(\d{4,6})[-/]?([A-Z]{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return clean;
}
