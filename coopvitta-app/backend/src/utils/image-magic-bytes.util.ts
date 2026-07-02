import fs from 'fs';

export type ImageKind = 'jpeg' | 'png' | 'webp';

/**
 * Detecta o tipo real da imagem pelos primeiros bytes (assinatura),
 * independentemente do MIME enviado pelo cliente (que pode ser falsificado).
 */
export function detectImageKindFromBuffer(buf: Buffer): ImageKind | null {
  if (buf.length < 3) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg';
  }
  // PNG
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }
  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

/**
 * Lê o início do arquivo e garante que o conteúdo é JPEG, PNG ou WebP válido.
 */
export async function assertFileIsAllowedImage(filePath: string): Promise<ImageKind> {
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    const { bytesRead } = await fd.read(buf, 0, 16, 0);
    if (bytesRead < 3) {
      throw new Error('Arquivo muito pequeno ou não é imagem.');
    }
    const kind = detectImageKindFromBuffer(buf.subarray(0, bytesRead));
    if (!kind) {
      throw new Error('Arquivo não é uma imagem JPEG, PNG ou WebP válida (conteúdo inválido).');
    }
    return kind;
  } finally {
    await fd.close();
  }
}
