import { detectImageKindFromBuffer } from './image-magic-bytes.util';

describe('detectImageKindFromBuffer', () => {
  it('detecta JPEG por assinatura', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11]);
    expect(detectImageKindFromBuffer(buf)).toBe('jpeg');
  });

  it('detecta PNG por assinatura', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectImageKindFromBuffer(buf)).toBe('png');
  });

  it('detecta WebP por assinatura RIFF/WEBP', () => {
    const buf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(detectImageKindFromBuffer(buf)).toBe('webp');
  });

  it('retorna null para conteúdo inválido', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(detectImageKindFromBuffer(buf)).toBeNull();
  });
});

