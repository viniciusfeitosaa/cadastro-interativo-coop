const UF_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

/** Valida CPF brasileiro (dígitos verificadores). Aceita com ou sem máscara. */
export function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i), 10) * (11 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10), 10)) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i), 10) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11), 10)) return false;

  return true;
}

/** Normaliza CRM para `12345-UF`, ou null se inválido. */
export function normalizeCRM(crm: string): string | null {
  const cleanCRM = crm
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CRM:?/, '');
  const match = cleanCRM.match(/^(\d{4,6})[-/]?([A-Z]{2})$/);
  if (!match) return null;
  const numero = match[1];
  const estado = match[2];
  if (!(UF_BRASIL as readonly string[]).includes(estado)) return null;
  if (numero.length < 4 || numero.length > 6) return null;
  return `${numero}-${estado}`;
}

export function validateCRM(crm: string): boolean {
  return normalizeCRM(crm) !== null;
}

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
  return normalizeCRM(crm) || crm.trim().toUpperCase();
}
