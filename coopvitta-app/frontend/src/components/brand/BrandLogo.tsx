import { BRAND_LOGO_SRC, BRAND_NAME, BRAND_SITE_URL } from '../../constants/branding';

type BrandLogoProps = {
  className?: string;
  linkToSite?: boolean;
};

export function BrandLogo({ className = 'h-12 w-auto', linkToSite = false }: BrandLogoProps) {
  const image = (
    <img src={BRAND_LOGO_SRC} alt={BRAND_NAME} className={`object-contain ${className}`.trim()} />
  );

  if (!linkToSite) return image;

  return (
    <a
      href={BRAND_SITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${BRAND_NAME} — site oficial`}
      className="inline-flex shrink-0"
    >
      {image}
    </a>
  );
}
