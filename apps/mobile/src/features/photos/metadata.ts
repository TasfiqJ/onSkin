const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Map([...BASE64_ALPHABET].map((char, index) => [char, index]));

function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/^data:[^,]+,/, '').replace(/\s/g, '');
  if (clean.length % 4 !== 0) throw new Error('Invalid base64 image data.');

  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((clean.length / 4) * 3 - padding);
  let offset = 0;

  for (let index = 0; index < clean.length; index += 4) {
    const chars = clean.slice(index, index + 4);
    const values = [...chars].map((char) => (char === '=' ? 0 : BASE64_LOOKUP.get(char)));
    if (values.some((value) => value == null)) throw new Error('Invalid base64 image data.');

    const n =
      ((values[0] as number) << 18) |
      ((values[1] as number) << 12) |
      ((values[2] as number) << 6) |
      (values[3] as number);
    if (offset < out.length) out[offset++] = (n >> 16) & 0xff;
    if (offset < out.length) out[offset++] = (n >> 8) & 0xff;
    if (offset < out.length) out[offset++] = n & 0xff;
  }

  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += BASE64_ALPHABET[(n >> 18) & 63];
    out += BASE64_ALPHABET[(n >> 12) & 63];
    out += index + 1 < bytes.length ? BASE64_ALPHABET[(n >> 6) & 63] : '=';
    out += index + 2 < bytes.length ? BASE64_ALPHABET[n & 63] : '=';
  }
  return out;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;

  const chunks = [bytes.slice(0, 2)];
  let index = 2;
  while (index + 4 <= bytes.length) {
    if (bytes[index] !== 0xff) {
      chunks.push(bytes.slice(index));
      return concat(chunks);
    }

    let markerOffset = index + 1;
    while (bytes[markerOffset] === 0xff) markerOffset += 1;
    const marker = bytes[markerOffset];
    index = markerOffset + 1;

    if (marker === 0xda || marker === 0xd9) {
      chunks.push(bytes.slice(markerOffset - 1));
      return concat(chunks);
    }

    if (index + 2 > bytes.length) return concat([...chunks, bytes.slice(markerOffset - 1)]);
    const length = (bytes[index] << 8) | bytes[index + 1];
    if (length < 2 || index + length > bytes.length)
      return concat([...chunks, bytes.slice(markerOffset - 1)]);

    const segmentStart = markerOffset - 1;
    const segmentEnd = index + length;
    const isMetadata = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!isMetadata) chunks.push(bytes.slice(segmentStart, segmentEnd));
    index = segmentEnd;
  }

  return concat(chunks);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'iTXt', 'tEXt', 'zTXt', 'tIME']);

function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  if (
    bytes.length < PNG_SIGNATURE.length ||
    !PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  ) {
    return bytes;
  }

  const chunks = [bytes.slice(0, PNG_SIGNATURE.length)];
  let index = PNG_SIGNATURE.length;
  while (index + 12 <= bytes.length) {
    const length =
      ((bytes[index] << 24) |
        (bytes[index + 1] << 16) |
        (bytes[index + 2] << 8) |
        bytes[index + 3]) >>>
      0;
    const chunkEnd = index + 12 + length;
    if (chunkEnd > bytes.length) return concat([...chunks, bytes.slice(index)]);

    const type = String.fromCharCode(
      bytes[index + 4],
      bytes[index + 5],
      bytes[index + 6],
      bytes[index + 7],
    );
    if (!PNG_METADATA_CHUNKS.has(type)) chunks.push(bytes.slice(index, chunkEnd));
    index = chunkEnd;
    if (type === 'IEND') break;
  }

  return concat(chunks);
}

export function stripImageMetadataFromBase64(
  base64: string,
  mimeType: 'image/jpeg' | 'image/png',
): string {
  const bytes = base64ToBytes(base64);
  const stripped = mimeType === 'image/png' ? stripPngMetadata(bytes) : stripJpegMetadata(bytes);
  return bytesToBase64(stripped);
}
