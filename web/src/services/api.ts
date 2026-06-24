const TOKEN_KEY = 'coopvitta_admin_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(path, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    const message = body.error ?? `Erro ${res.status}`
    if (res.status === 401) throw new Error('Não autorizado')
    throw new Error(message)
  }

  return res.json() as Promise<T>
}

export async function loginAdmin(password: string) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Senha incorreta' }))
    throw new Error(body.error ?? 'Senha incorreta')
  }

  const data = await res.json()
  setToken(data.token)
  return data
}

export async function verifyAdmin() {
  return request<{ ok: boolean }>('/api/admin/me')
}

export type CadastroResumo = {
  id: number
  created_at: string
  nome_completo: string
  email: string
  cpf: string
}

export type ArquivoInfo = {
  filename: string
  originalName: string
  mimetype: string
  size: number
}

export type CadastroDetalhe = CadastroResumo & {
  dados: Record<string, unknown>
  arquivos: Record<string, ArquivoInfo>
}

export async function fetchCadastros(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return request<CadastroResumo[]>(`/api/cadastros${query}`)
}

export async function fetchCadastroStats() {
  return request<{ total: number }>('/api/cadastros/stats')
}

export async function fetchCadastroById(id: number) {
  return request<CadastroDetalhe>(`/api/cadastros/${id}`)
}

export function getArquivoUrl(cadastroId: number, campo: string) {
  return `/api/cadastros/${cadastroId}/arquivos/${campo}`
}

export async function downloadArquivo(cadastroId: number, campo: string, filename: string) {
  const token = getToken()
  const res = await fetch(getArquivoUrl(cadastroId, campo), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) throw new Error('Erro ao baixar arquivo')

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function submitCadastro(formData: FormData) {
  const res = await fetch('/api/cadastros', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro ao enviar cadastro' }))
    throw new Error(body.error ?? 'Erro ao enviar cadastro')
  }

  return res.json()
}
