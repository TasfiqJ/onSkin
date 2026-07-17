#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { constants, deflateSync, inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
const DEFLATE_STRATEGIES = [
  constants.Z_DEFAULT_STRATEGY,
  constants.Z_FILTERED,
  constants.Z_HUFFMAN_ONLY,
  constants.Z_RLE,
  constants.Z_FIXED,
];
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..', '..');

export const PNG_ASSET_PATHS = [
  'apps/mobile/assets/images/icon.png',
  'apps/mobile/assets/images/splash-icon.png',
  'apps/mobile/assets/images/android-icon-foreground.png',
  'apps/mobile/assets/images/android-icon-background.png',
  'apps/mobile/assets/images/android-icon-monochrome.png',
  'apps/mobile/assets/images/favicon.png',
  'apps/mobile/assets/expo.icon/Assets/grid.png',
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.allocUnsafe(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return chunk;
}

function parsePng(buffer) {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Asset is not a PNG file.');
  }

  const chunks = [];
  let offset = PNG_SIGNATURE.length;
  let sawEnd = false;
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new Error('PNG contains a truncated chunk header.');
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new Error('PNG contains a truncated chunk body.');

    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(buffer.subarray(offset + 4, offset + 8 + length));
    if (expectedCrc !== actualCrc) throw new Error(`PNG ${type} chunk has an invalid CRC.`);

    chunks.push({ type, data, raw: buffer.subarray(offset, end) });
    offset = end;
    if (type === 'IEND') {
      sawEnd = true;
      break;
    }
  }

  if (!sawEnd || offset !== buffer.length) throw new Error('PNG must end exactly after IEND.');
  if (chunks[0]?.type !== 'IHDR') throw new Error('PNG must begin with IHDR.');
  if (!chunks.some((chunk) => chunk.type === 'IDAT')) throw new Error('PNG has no IDAT data.');

  const firstIdat = chunks.findIndex((chunk) => chunk.type === 'IDAT');
  const lastIdat = chunks.findLastIndex((chunk) => chunk.type === 'IDAT');
  if (chunks.slice(firstIdat, lastIdat + 1).some((chunk) => chunk.type !== 'IDAT')) {
    throw new Error('PNG IDAT chunks must be consecutive.');
  }

  return chunks;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function optimizePngBuffer(source) {
  const chunks = parsePng(source);
  const originalIdat = Buffer.concat(
    chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data),
  );
  const scanlines = inflateSync(originalIdat);
  let optimizedIdat = originalIdat;
  let strategy = null;

  for (const candidateStrategy of DEFLATE_STRATEGIES) {
    const candidate = deflateSync(scanlines, { level: 9, strategy: candidateStrategy });
    if (candidate.length < optimizedIdat.length) {
      optimizedIdat = candidate;
      strategy = candidateStrategy;
    }
  }

  if (strategy === null) {
    return {
      buffer: source,
      beforeBytes: source.length,
      afterBytes: source.length,
      savedBytes: 0,
      originalIdatBytes: originalIdat.length,
      optimizedIdatBytes: originalIdat.length,
      scanlineSha256: sha256(scanlines),
      strategy,
    };
  }

  const outputChunks = [];
  let wroteIdat = false;
  for (const chunk of chunks) {
    if (chunk.type !== 'IDAT') {
      outputChunks.push(chunk.raw);
    } else if (!wroteIdat) {
      outputChunks.push(pngChunk('IDAT', optimizedIdat));
      wroteIdat = true;
    }
  }

  const output = Buffer.concat([PNG_SIGNATURE, ...outputChunks]);
  const outputScanlines = inflateSync(
    Buffer.concat(
      parsePng(output)
        .filter((chunk) => chunk.type === 'IDAT')
        .map((chunk) => chunk.data),
    ),
  );
  if (!outputScanlines.equals(scanlines)) {
    throw new Error('Lossless PNG verification failed: decoded scanlines changed.');
  }

  return {
    buffer: output,
    beforeBytes: source.length,
    afterBytes: output.length,
    savedBytes: source.length - output.length,
    originalIdatBytes: originalIdat.length,
    optimizedIdatBytes: optimizedIdat.length,
    scanlineSha256: sha256(scanlines),
    strategy,
  };
}

function usage() {
  return 'Usage: node scripts/optimization/optimize-png-assets.mjs (--check | --write) [--json]';
}

export function run(argv) {
  const write = argv.includes('--write');
  const check = argv.includes('--check');
  const json = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--check', '--json'].includes(argument));
  if (write === check || unknown.length > 0) throw new Error(usage());

  const results = PNG_ASSET_PATHS.map((path) => {
    const absolutePath = resolve(REPOSITORY_ROOT, path);
    const repositoryPath = relative(REPOSITORY_ROOT, absolutePath).replaceAll('\\', '/');
    if (repositoryPath !== path) throw new Error(`Asset escaped the repository root: ${path}`);

    const result = optimizePngBuffer(readFileSync(absolutePath));
    if (write && result.savedBytes > 0) writeFileSync(absolutePath, result.buffer);
    return {
      path,
      beforeBytes: result.beforeBytes,
      afterBytes: result.afterBytes,
      savedBytes: result.savedBytes,
      scanlineSha256: result.scanlineSha256,
      strategy: result.strategy,
    };
  });

  const summary = {
    mode: write ? 'write' : 'check',
    assets: results,
    beforeBytes: results.reduce((total, result) => total + result.beforeBytes, 0),
    afterBytes: results.reduce((total, result) => total + result.afterBytes, 0),
    savedBytes: results.reduce((total, result) => total + result.savedBytes, 0),
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    for (const result of results) {
      const status = result.savedBytes > 0 ? `save ${result.savedBytes} B` : 'optimal';
      process.stdout.write(`${status.padEnd(14)} ${result.path}\n`);
    }
    process.stdout.write(
      `${summary.savedBytes > 0 ? 'Available' : 'Verified'}: ${summary.savedBytes} B across ${results.length} PNG assets.\n`,
    );
  }

  if (check && summary.savedBytes > 0) {
    throw new Error(
      `${summary.savedBytes} lossless PNG bytes can still be removed; run with --write.`,
    );
  }
  return summary;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
