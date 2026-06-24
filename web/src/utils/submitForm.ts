import { FILE_FIELDS } from '../data/fieldLabels'
import type { FormData } from '../schemas/formSchema'

function getFile(value: FormData[keyof FormData]): File | null {
  if (!value) return null
  if (value instanceof FileList) return value[0] ?? null
  if (value instanceof File) return value
  return null
}

export function buildCadastroFormData(values: FormData): globalThis.FormData {
  const payload = new globalThis.FormData()
  const dados: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(values)) {
    if (FILE_FIELDS.includes(key as (typeof FILE_FIELDS)[number])) continue
    dados[key] = value
  }

  payload.append('dados', JSON.stringify(dados))

  for (const field of FILE_FIELDS) {
    const file = getFile(values[field as keyof FormData])
    if (file) payload.append(field, file)
  }

  return payload
}
