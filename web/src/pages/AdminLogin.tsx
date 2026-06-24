import { useState } from 'react'
import { BrandLogo } from '../components/brand/BrandLogo'
import { loginAdmin } from '../services/api'
import './AdminLogin.css'

export function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await loginAdmin(password)
      window.location.href = '/admin'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={(e) => void handleSubmit(e)}>
        <BrandLogo tagline="Painel administrativo" />

        <h1>Acesso restrito</h1>
        <p>Informe a senha de administrador para visualizar os cadastros.</p>

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        {error && <p className="admin-login-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <a href="/" className="admin-login-back">
          ← Voltar ao formulário
        </a>
      </form>
    </div>
  )
}
