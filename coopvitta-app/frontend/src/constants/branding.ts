export const BRAND_NAME = 'COOPVITTA';
export const BRAND_SITE_URL = 'https://coopvitta.org';
export const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}assets/logo-coopvitta.png`;

/** Rótulos exibidos na interface (evitar "Master" e "Médicos" na UI). */
export const LABEL_ASSOCIADOS = 'Associados';
export const LABEL_ASSOCIADO = 'Associado';
export const LABEL_ADMINISTRADOR = 'Administrador';
export const LABEL_PROFISSIONAL = 'Profissional';
export const LABEL_PAINEL_ADMIN = 'Painel administrativo';

/** Remove sufixo "Master" do nome exibido na interface. */
export function displayNomeUsuario(nome?: string | null): string {
  const trimmed = (nome ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+master\b/gi, '').trim() || trimmed;
}
