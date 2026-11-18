import { extensionFor, inspectImage } from '../src/modules/listings/infrastructure/media-inspector.js';

/** PNG mínimo: firma + IHDR con las dimensiones indicadas. */
function png(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = 6;
  return buffer;
}

/** JPEG mínimo con un segmento SOF0. */
function jpeg(width: number, height: number): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x00, 0x00, 0x00, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);

  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}

/** WebP mínimo en formato VP8X (dimensiones en 24 bits little endian). */
function webp(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(40);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(32, 4);
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8X', 12, 'ascii');
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);

  return buffer;
}

describe('inspectImage · validación por magic bytes', () => {
  it('detecta PNG y sus dimensiones', () => {
    expect(inspectImage(png(800, 600))).toEqual({ mimeType: 'image/png', width: 800, height: 600 });
  });

  it('detecta JPEG y sus dimensiones', () => {
    expect(inspectImage(jpeg(1024, 768))).toEqual({ mimeType: 'image/jpeg', width: 1024, height: 768 });
  });

  it('detecta WebP VP8X y sus dimensiones', () => {
    expect(inspectImage(webp(320, 240))).toEqual({ mimeType: 'image/webp', width: 320, height: 240 });
  });

  it('rechaza archivos que no son imágenes reales', () => {
    expect(inspectImage(Buffer.from('GIF89a pero con extensión .png'))).toBeNull();
    expect(inspectImage(Buffer.alloc(0))).toBeNull();
    expect(inspectImage(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
  });

  it('no se deja engañar por la extensión o el Content-Type declarado', () => {
    // Un ejecutable con cabecera MZ no es una imagen, aunque se llame foto.png.
    const fake = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]);
    expect(inspectImage(fake)).toBeNull();
  });

  it('asigna una extensión canónica por tipo detectado', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
  });
});
