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

/**
 * Grava no banco caminho relativo a `process.cwd()` (ex.: `uploads/medicos/x.pdf`),
 * para sobreviver a mudanças de layout e bater com `resolveStoredFileToAbsolute`.
 */
export function toStoredUploadPath(absoluteOrRelativePath: string): string {
  const normalized = absoluteOrRelativePath.replace(/\\/g, '/').trim();
  if (!normalized) {
    throw { statusCode: 400, message: 'Caminho de arquivo inválido' };
  }
  const abs = path.isAbsolute(normalized)
    ? path.resolve(normalized)
    : path.resolve(process.cwd(), normalized);
  assertPathInsideUploads(abs);
  const rel = path.relative(process.cwd(), abs).split(path.sep).join('/');
  return rel.startsWith('uploads/') ? rel : path.posix.join('uploads', rel);
}

export function fileExistsSafe(absolutePath: string): boolean {
  return fs.existsSync(absolutePath);
}
