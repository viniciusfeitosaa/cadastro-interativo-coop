import fs from 'fs';
import path from 'path';

const uploadsRoot = () => path.resolve(process.cwd(), 'uploads');

/**
 * Resolve caminho absoluto seguro dentro de `uploads/` a partir do valor gravado no banco
 * (caminho absoluto antigo, ou relativo tipo `uploads/...` ou `documentos-enviados/...`).
 */
export function assertPathInsideUploads(absolutePath: string): string {
  const resolved = path.resolve(absolutePath);
  const root = uploadsRoot();
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw { statusCode: 400, message: 'Caminho de arquivo inválido' };
  }
  return resolved;
}

export function resolveStoredFileToAbsolute(caminhoStored: string): string {
  const normalized = caminhoStored.replace(/\\/g, '/').trim();
  let full: string;
  if (path.isAbsolute(normalized)) {
    full = path.resolve(normalized);
  } else if (normalized.startsWith('uploads/')) {
    full = path.resolve(process.cwd(), normalized);
  } else {
    full = path.resolve(uploadsRoot(), normalized);
  }
  return assertPathInsideUploads(full);
}

export function fileExistsSafe(absolutePath: string): boolean {
  return fs.existsSync(absolutePath);
}
