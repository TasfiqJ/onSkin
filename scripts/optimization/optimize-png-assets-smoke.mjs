#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { optimizePngBuffer, PNG_ASSET_PATHS } from './optimize-png-assets.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunks(buffer) {
  const result = [];
  let offset = signature.length;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + length + 12;
    result.push({
      type: buffer.toString('ascii', offset + 4, offset + 8),
      data: buffer.subarray(offset + 8, offset + 8 + length),
      raw: buffer.subarray(offset, end),
    });
    offset = end;
  }
  return result;
}

function scanlines(buffer) {
  return inflateSync(
    Buffer.concat(
      chunks(buffer)
        .filter((chunk) => chunk.type === 'IDAT')
        .map((chunk) => chunk.data),
    ),
  );
}

function nonIdatChunks(buffer) {
  return chunks(buffer)
    .filter((chunk) => chunk.type !== 'IDAT')
    .map((chunk) => chunk.raw);
}

for (const path of PNG_ASSET_PATHS) {
  const source = readFileSync(resolve(repositoryRoot, path));
  const optimized = optimizePngBuffer(source);

  assert.ok(optimized.afterBytes <= optimized.beforeBytes, `${path} must not grow.`);
  assert.deepEqual(scanlines(optimized.buffer), scanlines(source), `${path} pixels changed.`);
  assert.deepEqual(
    nonIdatChunks(optimized.buffer),
    nonIdatChunks(source),
    `${path} metadata changed.`,
  );
  const repeated = optimizePngBuffer(optimized.buffer);
  assert.equal(repeated.savedBytes, 0, `${path} optimization must be idempotent.`);
  assert.deepEqual(repeated.buffer, optimized.buffer, `${path} output must be deterministic.`);
}
console.log('OK PNG optimization is lossless, metadata-preserving, deterministic, and idempotent');

assert.throws(() => optimizePngBuffer(Buffer.from('not a png')), /not a PNG/);
assert.throws(
  () =>
    optimizePngBuffer(readFileSync(resolve(repositoryRoot, PNG_ASSET_PATHS[0])).subarray(0, 32)),
  /truncated/,
);
console.log('OK invalid and truncated PNG inputs fail closed');
