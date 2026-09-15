import type { RegisterDocumentFiles } from '../../../services/auth.service';
import type { DocumentoPerfilField } from '../../../constants/documentosPerfil';

const MAX_EDGE_PX = 1920;
const JPEG_QUALITY = 0.72;

const COMPRESSIBLE = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function isCompressibleImage(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (COMPRESSIBLE.has(type)) return true;
  // Alguns browsers não preenchem type em HEIC/fotos da câmera
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
}

function loadImageBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => loadViaImg(file));
  }
  return loadViaImg(file);
}

function loadViaImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob failed'));
      },
      'image/jpeg',
      quality
    );
  });
}

async function compressOneImage(file: File): Promise<File> {
  if (!isCompressibleImage(file)) return file;

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await loadImageBitmap(file);
  } catch {
    return file;
  }

  const srcW = 'naturalWidth' in source ? source.naturalWidth || source.width : source.width;
  const srcH = 'naturalHeight' in source ? source.naturalHeight || source.height : source.height;
  if (!srcW || !srcH) {
    if ('close' in source && typeof source.close === 'function') source.close();
    return file;
  }

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if ('close' in source && typeof source.close === 'function') source.close();
    return file;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  if ('close' in source && typeof source.close === 'function') source.close();

  let blob: Blob;
  try {
    blob = await canvasToJpegBlob(canvas, JPEG_QUALITY);
  } catch {
    return file;
  }

  if (blob.size >= file.size) return file;

  const base = file.name.replace(/\.[^.]+$/, '') || 'anexo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

/** Comprime imagens do cadastro (silencioso). PDF/DOC intactos. */
export async function compressRegisterFiles(
  files: RegisterDocumentFiles
): Promise<RegisterDocumentFiles> {
  const entries = Object.entries(files) as [DocumentoPerfilField, File | undefined][];
  const out: RegisterDocumentFiles = {};

  await Promise.all(
    entries.map(async ([key, file]) => {
      if (!(file instanceof File)) return;
      out[key] = await compressOneImage(file);
    })
  );

  return out;
}
