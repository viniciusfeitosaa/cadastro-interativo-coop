import { ChevronLeft, ChevronRight, Download, LogOut, Search, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BrandLogo } from '../components/brand/BrandLogo'
import { FIELD_GROUPS, FIELD_LABELS, FILE_FIELDS } from '../data/fieldLabels'
import {
  clearToken,
  fetchCadastroById,
  fetchCadastroStats,
  fetchCadastros,
  downloadArquivo,
  getToken,
  verifyAdmin,
  type CadastroDetalhe,
  type CadastroResumo,
} from '../services/api'
import './AdminDashboard.css'

const PAGE_SIZE = 25

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'termoConsentimento') return value ? 'Autorizado' : 'Não autorizado'
  return String(value)
}

function filterCadastros(cadastros: CadastroResumo[], search: string) {
  const term = search.trim().toLowerCase()
  if (!term) return cadastros

  return cadastros.filter((c) => {
    const nome = String(c.nome_completo ?? '').toLowerCase()
    const email = String(c.email ?? '').toLowerCase()
    const cpf = String(c.cpf ?? '').toLowerCase()
    return nome.includes(term) || email.includes(term) || cpf.includes(term)
  })
}

export function AdminDashboard() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [allCadastros, setAllCadastros] = useState<CadastroResumo[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<CadastroDetalhe | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const filteredCadastros = useMemo(
    () => filterCadastros(allCadastros, search),
    [allCadastros, search],
  )

  const totalPages = Math.max(1, Math.ceil(filteredCadastros.length / PAGE_SIZE))

  const pageCadastros = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredCadastros.slice(start, start + PAGE_SIZE)
  }, [filteredCadastros, page])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, stats] = await Promise.all([fetchCadastros(), fetchCadastroStats()])
      setAllCadastros(list)
      setTotal(stats.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar cadastros'
      if (message === 'Não autorizado') {
        clearToken()
        setAuthorized(false)
        return
      }
      setError(
        message === 'Failed to fetch'
          ? 'Não foi possível conectar à API. Verifique se o servidor está rodando (cd server && npm run dev).'
          : message,
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!getToken()) {
      setAuthorized(false)
      return
    }

    verifyAdmin()
      .then(() => setAuthorized(true))
      .catch(() => {
        clearToken()
        setAuthorized(false)
      })
  }, [])

  useEffect(() => {
    if (!authorized) return
    void loadData()
  }, [authorized, loadData])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  async function openDetail(id: number) {
    setDetailLoading(true)
    setSelected(null)
    try {
      const detail = await fetchCadastroById(id)
      setSelected(detail)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar detalhes'
      if (message === 'Não autorizado') {
        clearToken()
        setAuthorized(false)
        return
      }
      alert(message)
    } finally {
      setDetailLoading(false)
    }
  }

  function logout() {
    clearToken()
    window.location.href = '/admin/login'
  }

  if (authorized === false) {
    return <Navigate to="/admin/login" replace />
  }

  if (authorized === null) {
    return <div className="admin-loading">Carregando painel...</div>
  }

  const pageStart = filteredCadastros.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(page * PAGE_SIZE, filteredCadastros.length)

  return (
    <div className="admin-page">
      <header className="admin-header">
        <BrandLogo tagline="Painel de cadastros" />
        <div className="admin-header-actions">
          <a href="/">Ver formulário</a>
          <button type="button" onClick={logout} className="btn-logout">
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-stats">
          <div className="stat-card">
            <Users size={22} />
            <div>
              <strong>{total}</strong>
              <span>Cadastros recebidos</span>
            </div>
          </div>
        </div>

        <div className="admin-toolbar">
          <div className="admin-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Buscar por nome, e-mail ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="admin-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void loadData()}>
              Tentar novamente
            </button>
          </div>
        )}

        <div className="admin-table-wrap">
          {loading ? (
            <p className="admin-empty">Carregando cadastros...</p>
          ) : filteredCadastros.length === 0 ? (
            <p className="admin-empty">
              {search ? 'Nenhum cadastro encontrado para esta busca.' : 'Nenhum cadastro encontrado.'}
            </p>
          ) : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>CPF</th>
                      <th>Data</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageCadastros.map((c) => (
                      <tr key={c.id}>
                        <td>{c.id}</td>
                        <td>{c.nome_completo}</td>
                        <td>{c.email}</td>
                        <td>{c.cpf}</td>
                        <td>{formatDate(c.created_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-view"
                            onClick={() => void openDetail(c.id)}
                          >
                            Ver detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="admin-pagination">
                <span>
                  Mostrando {pageStart}–{pageEnd} de {filteredCadastros.length}
                  {search ? ` (filtrado de ${allCadastros.length})` : ''}
                </span>
                <div className="admin-pagination-actions">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span>
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      </main>

      {(selected || detailLoading) && (
        <div className="admin-modal-overlay" onClick={() => !detailLoading && setSelected(null)}>
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {detailLoading ? (
              <p className="admin-empty">Carregando detalhes...</p>
            ) : selected ? (
              <>
                <header className="admin-modal-header">
                  <div>
                    <span className="modal-eyebrow">Cadastro #{selected.id}</span>
                    <h2>{selected.nome_completo}</h2>
                    <p>{formatDate(selected.created_at)}</p>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setSelected(null)}>
                    <X size={20} />
                  </button>
                </header>

                <div className="admin-modal-body">
                  {FIELD_GROUPS.map((group) => (
                    <section key={group.title} className="detail-group">
                      <h3>{group.title}</h3>
                      <dl className="detail-grid">
                        {group.fields.map((field) => {
                          const isFile = FILE_FIELDS.includes(
                            field as (typeof FILE_FIELDS)[number],
                          )
                          const arquivo = isFile ? selected.arquivos?.[field] : null

                          return (
                            <div key={field} className="detail-item">
                              <dt>{FIELD_LABELS[field] ?? field}</dt>
                              <dd>
                                {isFile && arquivo ? (
                                  <button
                                    type="button"
                                    className="file-link"
                                    onClick={() =>
                                      void downloadArquivo(
                                        selected.id,
                                        field,
                                        arquivo.originalName,
                                      ).catch(() => alert('Erro ao baixar arquivo'))
                                    }
                                  >
                                    <Download size={14} />
                                    {arquivo.originalName}
                                  </button>
                                ) : isFile ? (
                                  '—'
                                ) : (
                                  formatValue(field, selected.dados?.[field])
                                )}
                              </dd>
                            </div>
                          )
                        })}
                      </dl>
                    </section>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
