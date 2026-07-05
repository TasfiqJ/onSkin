import { describe, expect, it } from 'vitest';

import { stripImageMetadataFromBase64 } from './metadata';

function b64(bytes: number[]): string {
  return Buffer.from(bytes).toString('base64');
}

function text(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('latin1');
}

function decode(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function pngChunk(type: string, data: number[]): number[] {
  const length = data.length;
  return [
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
    ...[...type].map((char) => char.charCodeAt(0)),
    ...data,
    0,
    0,
    0,
    0,
  ];
}

describe('photo metadata stripping', () => {
  it('removes JPEG EXIF, IPTC, and comment segments before storage/share', () => {
    const jpeg = [
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x00,
      0x04,
      0x01,
      0x02,
      0xff,
      0xe1,
      0x00,
      0x10,
      ...Buffer.from('Exif\0\0GPSDATA1', 'latin1'),
      0xff,
      0xed,
      0x00,
      0x06,
      ...Buffer.from('IPTC', 'latin1'),
      0xff,
      0xfe,
      0x00,
      0x05,
      ...Buffer.from('GEO', 'latin1'),
      0xff,
      0xda,
      0x00,
      0x04,
      0x00,
      0x3f,
      0x11,
      0x22,
      0xff,
      0xd9,
    ];

    const stripped = decode(stripImageMetadataFromBase64(b64(jpeg), 'image/jpeg'));
    const raw = text(stripped);

    expect([...stripped.slice(0, 2)]).toEqual([0xff, 0xd8]);
    expect([...stripped.slice(-2)]).toEqual([0xff, 0xd9]);
    expect(raw).not.toContain('Exif');
    expect(raw).not.toContain('GPSDATA1');
    expect(raw).not.toContain('IPTC');
    expect(raw).not.toContain('GEO');
  });

  it('removes PNG EXIF/text metadata chunks and keeps image chunks', () => {
    const png = [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...pngChunk('IHDR', [1, 2, 3, 4]),
      ...pngChunk('eXIf', [...Buffer.from('GPS')]),
      ...pngChunk('tEXt', [...Buffer.from('comment')]),
      ...pngChunk('IDAT', [9, 8, 7]),
      ...pngChunk('IEND', []),
    ];

    const raw = text(decode(stripImageMetadataFromBase64(b64(png), 'image/png')));

    expect(raw).toContain('IHDR');
    expect(raw).toContain('IDAT');
    expect(raw).toContain('IEND');
    expect(raw).not.toContain('eXIf');
    expect(raw).not.toContain('GPS');
    expect(raw).not.toContain('tEXt');
    expect(raw).not.toContain('comment');
  });
});
