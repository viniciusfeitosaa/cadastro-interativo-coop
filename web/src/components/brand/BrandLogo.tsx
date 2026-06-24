import './BrandLogo.css'

type BrandLogoProps = {
  variant?: 'default' | 'compact'
  showTagline?: boolean
  tagline?: string
  className?: string
}

export function BrandLogo({
  variant = 'default',
  showTagline = true,
  tagline = 'Pré-cadastro cooperativo',
  className = '',
}: BrandLogoProps) {
  return (
    <a
      href="https://coopvitta.org"
      target="_blank"
      rel="noopener noreferrer"
      className={`brand-logo ${variant} ${className}`.trim()}
      aria-label="COOPVITTA — site oficial"
    >
      <img src="/logo-coopvitta.png" alt="COOPVITTA" className="brand-logo-image" />
      {showTagline && variant === 'default' && (
        <span className="brand-logo-tagline">{tagline}</span>
      )}
    </a>
  )
}
