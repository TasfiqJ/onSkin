import { createHash } from 'node:crypto';

import { PNG } from 'pngjs';

export const CAT07_MAX_SCREENSHOT_BYTES = 16 * 1024 * 1024;
export const CAT07_MAX_DECODED_PIXEL_BYTES = 16 * 1024 * 1024;
export const CAT07_CAPTURE_MARKER_SIZE = 18;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_PNG_CHUNKS = 4_096;

const CAT07_CAPTURE_MARKER_BORDER = Object.freeze([13, 71, 199, 255]);
const CAT07_CAPTURE_MARKER_ZERO = Object.freeze([28, 32, 39, 255]);
const CAT07_CAPTURE_MARKER_ONE = Object.freeze([229, 53, 83, 255]);

export function cat07CaptureBindingDigest(runId, viewportId, artifact) {
  return createHash('sha256')
    .update('routinekind-cat07-capture-binding-v1\0', 'utf8')
    .update(String(runId), 'utf8')
    .update('\0', 'utf8')
    .update(String(viewportId), 'utf8')
    .update('\0', 'utf8')
    .update(String(artifact), 'utf8')
    .digest();
}

export function buildCat07CaptureMarkerRgba(runId, viewportId, artifact) {
  const digest = cat07CaptureBindingDigest(runId, viewportId, artifact);
  const size = CAT07_CAPTURE_MARKER_SIZE;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const isBorder = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      let color = CAT07_CAPTURE_MARKER_BORDER;
      if (!isBorder) {
        const bitIndex = (y - 1) * 16 + (x - 1);
        const bit = (digest[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
        color = bit === 1 ? CAT07_CAPTURE_MARKER_ONE : CAT07_CAPTURE_MARKER_ZERO;
      }
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }
  return pixels;
}

export function applyCat07CaptureMarkerToRgba(data, width, height, runId, viewportId, artifact) {
  if (!Buffer.isBuffer(data) || data.length !== width * height * 4) {
    throw new Error('CAT07 marker target must be one exact RGBA image buffer');
  }
  if (width < CAT07_CAPTURE_MARKER_SIZE || height < CAT07_CAPTURE_MARKER_SIZE) {
    throw new Error('CAT07 marker target is smaller than the capture marker');
  }
  const marker = buildCat07CaptureMarkerRgba(runId, viewportId, artifact);
  const startX = width - CAT07_CAPTURE_MARKER_SIZE;
  const startY = height - CAT07_CAPTURE_MARKER_SIZE;
  for (let y = 0; y < CAT07_CAPTURE_MARKER_SIZE; y += 1) {
    const sourceOffset = y * CAT07_CAPTURE_MARKER_SIZE * 4;
    const targetOffset = ((startY + y) * width + startX) * 4;
    marker.copy(data, targetOffset, sourceOffset, sourceOffset + CAT07_CAPTURE_MARKER_SIZE * 4);
  }
  return data;
}

export function assertCat07CaptureMarker(decoded, { artifact, runId, viewportId }) {
  const expected = buildCat07CaptureMarkerRgba(runId, viewportId, artifact);
  const startX = decoded.width - CAT07_CAPTURE_MARKER_SIZE;
  const startY = decoded.height - CAT07_CAPTURE_MARKER_SIZE;
  if (startX < 0 || startY < 0) throw new Error('CAT07 screenshot is smaller than its marker');
  for (let y = 0; y < CAT07_CAPTURE_MARKER_SIZE; y += 1) {
    const actualOffset = ((startY + y) * decoded.width + startX) * 4;
    const expectedOffset = y * CAT07_CAPTURE_MARKER_SIZE * 4;
    if (
      !decoded.data
        .subarray(actualOffset, actualOffset + CAT07_CAPTURE_MARKER_SIZE * 4)
        .equals(expected.subarray(expectedOffset, expectedOffset + CAT07_CAPTURE_MARKER_SIZE * 4))
    ) {
      throw new Error('CAT07 screenshot capture marker does not match its run, viewport, and step');
    }
  }
  return true;
}

export function decodeStrictCat07Png(bytes, { maxBytes = CAT07_MAX_SCREENSHOT_BYTES } = {}) {
  if (!Buffer.isBuffer(bytes)) throw new Error('PNG is not available as bytes');
  if (bytes.length > maxBytes) throw new Error(`PNG exceeds ${maxBytes} bytes`);
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('invalid PNG signature');
  }

  let offset = PNG_SIGNATURE.length;
  let chunkCount = 0;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;
  let headerDimensions = null;
  while (offset < bytes.length) {
    if (chunkCount >= MAX_PNG_CHUNKS) throw new Error('PNG contains too many chunks');
    if (offset + 12 > bytes.length) throw new Error('truncated PNG chunk header');
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const nextOffset = offset + 12 + length;
    if (!/^[A-Za-z]{4}$/u.test(type) || nextOffset > bytes.length) {
      throw new Error('invalid or truncated PNG chunk');
    }

    if (type === 'IHDR') {
      if (chunkCount !== 0 || sawHeader || length !== 13) {
        throw new Error('PNG must contain one leading 13-byte IHDR chunk');
      }
      const width = bytes.readUInt32BE(offset + 8);
      const height = bytes.readUInt32BE(offset + 12);
      if (width < 1 || height < 1 || width > 4_096 || height > 4_096) {
        throw new Error('invalid or unsafe PNG dimensions');
      }
      const bitDepth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      const compressionMethod = bytes[offset + 18];
      const filterMethod = bytes[offset + 19];
      const interlaceMethod = bytes[offset + 20];
      if (
        bitDepth !== 8 ||
        colorType !== 6 ||
        compressionMethod !== 0 ||
        filterMethod !== 0 ||
        interlaceMethod !== 0
      ) {
        throw new Error(
          'PNG IHDR must use 8-bit RGBA, compression/filter method 0, and no interlace',
        );
      }
      const decodedPixelBytes = width * height * 4;
      if (
        !Number.isSafeInteger(decodedPixelBytes) ||
        decodedPixelBytes > CAT07_MAX_DECODED_PIXEL_BYTES
      ) {
        throw new Error(`PNG decoded pixels exceed ${CAT07_MAX_DECODED_PIXEL_BYTES} bytes`);
      }
      headerDimensions = { height, width };
      sawHeader = true;
    } else if (type === 'IDAT') {
      if (!sawHeader || sawEnd) throw new Error('PNG IDAT appears outside the image stream');
      sawImageData = true;
    } else if (type === 'IEND') {
      if (!sawHeader || !sawImageData || sawEnd || length !== 0 || nextOffset !== bytes.length) {
        throw new Error('PNG must end with one terminal zero-byte IEND chunk');
      }
      sawEnd = true;
    } else {
      throw new Error(`PNG contains disallowed ${type} chunk`);
    }
    offset = nextOffset;
    chunkCount += 1;
  }
  if (!sawHeader || !sawImageData || !sawEnd || !headerDimensions) {
    throw new Error('PNG is missing IHDR, IDAT, or IEND');
  }

  let decoded;
  try {
    decoded = PNG.sync.read(bytes, { checkCRC: true });
  } catch (error) {
    throw new Error(
      `PNG decode or CRC validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    decoded.width !== headerDimensions.width ||
    decoded.height !== headerDimensions.height ||
    !decoded.data ||
    decoded.data.length !== decoded.width * decoded.height * 4
  ) {
    throw new Error('decoded PNG pixels do not match the declared IHDR dimensions');
  }
  return decoded;
}
