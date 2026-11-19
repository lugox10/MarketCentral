export type AllowedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageInfo {
  mimeType: AllowedImageType;
  width: number | null;
  height: number | null;
}

/**
 * Detecta el tipo real de una imagen por sus bytes iniciales (magic bytes) y
 * extrae sus dimensiones de la cabecera. El `Content-Type` que envía el cliente
 * nunca se usa como fuente de verdad.
 *
 * Devuelve `null` cuando el contenido no es JPEG, PNG ni WebP.
 */
export function inspectImage(buffer: Buffer): ImageInfo | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', ...jpegSize(buffer) };
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngSignature.every((byte, index) => buffer[index] === byte)) {
    return {
      mimeType: 'image/png',
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', ...webpSize(buffer) };
  }

  return null;
}

function jpegSize(buffer: Buffer): { width: number | null; height: number | null } {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1] ?? 0;
    const length = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return { width: null, height: null };
}

function webpSize(buffer: Buffer): { width: number | null; height: number | null } {
  const format = buffer.subarray(12, 16).toString('ascii');
  if (format === 'VP8X' && buffer.length >= 30) {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  }
  if (format === 'VP8 ' && buffer.length >= 30) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (format === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { width: null, height: null };
}

/** Extensión canónica por tipo detectado (se usa en la clave del objeto). */
export function extensionFor(mimeType: AllowedImageType): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}
