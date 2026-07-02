import path from 'path';
import { assertPathInsideUploads, resolveStoredFileToAbsolute } from './upload-path.util';

describe('upload-path.util', () => {
  it('bloqueia path traversal fora de uploads', () => {
    const outside = path.resolve(process.cwd(), '..', 'secret.txt');
    expect(() => assertPathInsideUploads(outside)).toThrow();
  });

  it('resolve caminho relativo para dentro de uploads', () => {
    const abs = resolveStoredFileToAbsolute('documentos-enviados/file.pdf');
    expect(abs).toContain(path.resolve(process.cwd(), 'uploads'));
  });

  it('aceita caminho armazenado começando com uploads/', () => {
    const abs = resolveStoredFileToAbsolute('uploads/ponto/foto.jpg');
    expect(abs).toContain(path.resolve(process.cwd(), 'uploads'));
  });
});

