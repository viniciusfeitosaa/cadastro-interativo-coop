import type { jsPDF } from 'jspdf';

/** Logo horizontal (PNG — compatível com jsPDF). */
const PDF_LOGO_SRC = `${import.meta.env.BASE_URL}assets/logo-coopvitta.png`;

type LogoCache = { dataUrl: string; width: number; height: number };

let cachedLogo: LogoCache | null = null;

async function loadPdfLogo(): Promise<LogoCache | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(PDF_LOGO_SRC);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler logo'));
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Falha ao decodificar logo'));
      img.src = dataUrl;
    });
    cachedLogo = { dataUrl, width: dims.width, height: dims.height };
    return cachedLogo;
  } catch {
    return null;
  }
}

export type PdfHeaderLogoOptions = {
  marginLeft?: number;
  marginTop?: number;
  maxWidthMm?: number;
  maxHeightMm?: number;
};

/**
 * Desenha a logo da COOPVITTA no topo do PDF.
 * Retorna a coordenada Y (mm) onde o título/conteúdo deve começar.
 */
export async function addPdfBrandHeader(
  doc: jsPDF,
  options: PdfHeaderLogoOptions = {},
): Promise<number> {
  const marginLeft = options.marginLeft ?? 10;
  const marginTop = options.marginTop ?? 6;
  const maxWidthMm = options.maxWidthMm ?? 52;
  const maxHeightMm = options.maxHeightMm ?? 16;

  const logo = await loadPdfLogo();
  if (!logo) return marginTop;

  let w = maxWidthMm;
  let h = (logo.height / logo.width) * w;
  if (h > maxHeightMm) {
    h = maxHeightMm;
    w = (logo.width / logo.height) * h;
  }
  doc.addImage(logo.dataUrl, 'PNG', marginLeft, marginTop, w, h);
  return marginTop + h + 5;
}
