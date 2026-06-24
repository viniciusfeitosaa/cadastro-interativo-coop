export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function maskPis(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{5})(\d)/, '$1.$2')
    .replace(/(\d{5}\.\d{2})(\d)/, '$1.$2')
    .replace(/(\d{5}\.\d{2}\.\d{2})(\d)/, '$1-$2')
}

export function maskCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.replace(/(\d{5})(\d)/, '$1-$2')
}

export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 9)
  if (digits.length <= 4) return digits
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function maskDdd(value: string): string {
  return onlyDigits(value).slice(0, 2)
}

export function maskAgencia(value: string): string {
  return onlyDigits(value).slice(0, 6)
}

export function maskConta(value: string): string {
  return onlyDigits(value).slice(0, 12)
}

export function maskDigito(value: string): string {
  return onlyDigits(value).slice(0, 2)
}
