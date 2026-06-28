import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, 'data')
const dbPath = join(dataDir, 'cadastros.json')

mkdirSync(dataDir, { recursive: true })

function loadAll() {
  if (!existsSync(dbPath)) return []
  try {
    return JSON.parse(readFileSync(dbPath, 'utf-8'))
  } catch (error) {
    console.error('Erro ao ler cadastros.json:', error)
    throw new Error('Falha ao carregar cadastros')
  }
}

function saveAll(cadastros) {
  const tmp = `${dbPath}.tmp`
  writeFileSync(tmp, JSON.stringify(cadastros, null, 2), 'utf-8')
  renameSync(tmp, dbPath)
}

export function insertCadastro({
  nomeCompleto,
  email,
  cpf,
  dados,
  arquivos,
  createdAt,
  appvsMedicoId = null,
  appvsSyncStatus = null,
}) {
  const cadastros = loadAll()
  const id = cadastros.length > 0 ? Math.max(...cadastros.map((c) => c.id)) + 1 : 1

  const dadosSeguros = { ...dados }
  delete dadosSeguros.password
  delete dadosSeguros.confirmPassword

  const entry = {
    id,
    created_at: createdAt || new Date().toISOString(),
    nome_completo: nomeCompleto,
    email,
    cpf,
    dados: dadosSeguros,
    arquivos,
    appvs_medico_id: appvsMedicoId,
    appvs_sync_status: appvsSyncStatus,
  }

  cadastros.unshift(entry)
  saveAll(cadastros)
  return id
}

export function listCadastros({ search = '' } = {}) {
  const cadastros = loadAll()
  const term = search.trim().toLowerCase()

  const filtered = term
    ? cadastros.filter((c) => {
        const nome = String(c.nome_completo ?? '').toLowerCase()
        const email = String(c.email ?? '').toLowerCase()
        const cpf = String(c.cpf ?? '').toLowerCase()
        return nome.includes(term) || email.includes(term) || cpf.includes(term)
      })
    : cadastros

  return filtered.map(({ id, created_at, nome_completo, email, cpf }) => ({
    id,
    created_at,
    nome_completo,
    email,
    cpf,
  }))
}

export function getCadastroById(id) {
  return loadAll().find((c) => c.id === Number(id)) ?? null
}

export function countCadastros() {
  return loadAll().length
}
