/**
 * Valida CPF brasileiro
 * @param cpf - CPF com ou sem formatação
 * @returns true se válido
 */
export function validateCPF(cpf: string): boolean {
  // Remove formatação
  const cleanCPF = cpf.replace(/\D/g, '');

  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  // Validação dos dígitos verificadores
  let sum = 0;
  let remainder: number;

  // Valida primeiro dígito
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  // Valida segundo dígito
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
}

/**
 * Valida CRM (Conselho Regional de Medicina)
 * @param crm - CRM no formato "12345-SP" ou "12345/SP"
 * @returns true se válido
 */
export function validateCRM(crm: string): boolean {
  return normalizeCRM(crm) !== null;
}

/**
 * Normaliza CRM para o formato canônico "12345-UF"
 * Aceita entradas como:
 * - "12345-CE"
 * - "12345/CE"
 * - "12345CE"
 * - "CRM : 12345CE"
 */
export function normalizeCRM(crm: string): string | null {
  // Estados válidos
  const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  // Remove espaços e converte para maiúsculo
  const cleanCRM = crm
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CRM:?/, '');

  // Padrões aceitos: "12345-SP" ou "12345/SP"
  const regex = /^(\d{4,6})[-/]?([A-Z]{2})$/;
  const match = cleanCRM.match(regex);

  if (!match) return null;

  const numero = match[1];
  const estado = match[2];

  // Verifica se o estado é válido
  if (!estados.includes(estado)) return null;

  // Verifica se o número tem entre 4 e 6 dígitos
  if (numero.length < 4 || numero.length > 6) return null;

  return `${numero}-${estado}`;
}

/**
 * Formata CPF para exibição
 */
export function formatCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, '');
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CRM para exibição
 */
export function formatCRM(crm: string): string {
  const normalized = normalizeCRM(crm);
  return normalized || crm.trim().toUpperCase();
}
