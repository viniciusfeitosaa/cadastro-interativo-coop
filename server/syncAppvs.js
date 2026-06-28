import { readFileSync } from 'fs'
import { File } from 'node:buffer'
import { FILE_FIELD_MAP, mapCadastroToAppvsPayload } from './mapToAppvs.js'

function getAppvsRegisterUrl() {
  const base = (process.env.APPVS_API_URL || '').trim().replace(/\/$/, '')
  if (!base) return null
  return `${base}/api/auth/register`
}

function parseAppvsError(data, status) {
  if (!data || typeof data !== 'object') {
    return status === 409
      ? 'Já existe cadastro com estes dados (CPF, e-mail ou registro profissional).'
      : 'Não foi possível registrar no sistema principal.'
  }

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim()
  }

  if (Array.isArray(data.errors)) {
    const parts = data.errors
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : null))
      .filter(Boolean)
    if (parts.length) return parts.join(' · ')
  }

  return 'Não foi possível registrar no sistema principal.'
}

/**
 * Encaminha o cadastro para o backend AppVS (fila de aprovação do master).
 * @param {Record<string, unknown>} dados
 * @param {Record<string, import('multer').File[] | undefined> | undefined} multerFiles
 */
export async function syncCadastroToAppvs(dados, multerFiles) {
  const url = getAppvsRegisterUrl()
  if (!url) {
    return { skipped: true, reason: 'APPVS_API_URL não configurada' }
  }

  const payload = mapCadastroToAppvsPayload(dados)
  const form = new FormData()

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'especialidades' && Array.isArray(value)) {
      for (const item of value) form.append('especialidades', item)
      continue
    }
    if (value !== undefined && value !== null) {
      form.append(key, String(value))
    }
  }

  for (const [sourceField, targetField] of Object.entries(FILE_FIELD_MAP)) {
    const file = multerFiles?.[sourceField]?.[0]
    if (!file?.path) continue
    const buffer = readFileSync(file.path)
    form.append(
      targetField,
      new File([buffer], file.originalname, { type: file.mimetype || 'application/octet-stream' }),
    )
  }

  const res = await fetch(url, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = parseAppvsError(data, res.status)
    const err = new Error(message)
    err.statusCode = res.status
    throw err
  }

  const medicoId = data?.data?.medico?.id ?? null
  return {
    skipped: false,
    medicoId,
    message: data?.data?.message ?? 'Cadastro enviado para análise.',
  }
}

export function isAppvsSyncEnabled() {
  return Boolean(getAppvsRegisterUrl())
}
