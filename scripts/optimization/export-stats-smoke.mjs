#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const analyzerPath = resolve(scriptDirectory, 'export-stats.mjs');
const fixedMetadata = [
  '--generated-at',
  '2026-07-12T16:30:00.000Z',
  '--source-sha',
  '0123456789abcdef0123456789abcdef01234567',
];

function writeFixtureFile(root, relativePath, content) {
  const path = resolve(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return Buffer.byteLength(content);
}

function runAnalyzer(args) {
  return spawnSync(process.execPath, [analyzerPath, ...args], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      Path: process.env.Path,
      PATHEXT: process.env.PATHEXT,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
    },
  });
}

function expectSuccess(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

function assertSorted(values, compare) {
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(compare(values[index - 1], values[index]) <= 0, 'Expected deterministic order.');
  }
}

function allReportedPaths(stats) {
  return [
    ...stats.bundles.files.map((file) => file.path),
    ...stats.sourceMaps.files.map((file) => file.path),
    ...stats.fonts.files.map((file) => file.path),
    ...stats.largestFiles.map((file) => file.path),
  ];
}

const temporaryRoot = mkdtempSync(join(tmpdir(), 'layerwell-export-stats-smoke-'));
try {
  const exportRoot = resolve(temporaryRoot, 'expo-export');
  const outputRoot = resolve(temporaryRoot, 'stats');
  mkdirSync(exportRoot, { recursive: true });

  const sizes = [];
  sizes.push(
    writeFixtureFile(exportRoot, '_expo/static/js/ios/main.hbc', Buffer.from('HERMES'.repeat(128))),
  );
  sizes.push(
    writeFixtureFile(
      exportRoot,
      '_expo/static/js/ios/vendor.js',
      Buffer.from('console.log("fixture");'.repeat(64)),
    ),
  );
  const sourceMapSizes = [
    writeFixtureFile(exportRoot, '_expo/static/js/ios/main.hbc.map', Buffer.alloc(17, 1)),
    writeFixtureFile(exportRoot, '_expo/static/js/ios/vendor.js.map', Buffer.alloc(19, 2)),
  ];
  sizes.push(...sourceMapSizes);
  const ttfHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const otfHash = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  sizes.push(writeFixtureFile(exportRoot, `assets/${ttfHash}`, Buffer.alloc(7, 3)));
  sizes.push(writeFixtureFile(exportRoot, `assets/${otfHash}`, Buffer.alloc(11, 4)));
  sizes.push(writeFixtureFile(exportRoot, 'assets/data.bin', Buffer.alloc(5, 5)));
  sizes.push(writeFixtureFile(exportRoot, 'assets/image.PNG', Buffer.alloc(13, 6)));
  const privateSourceSentinel = 'C:/private-user/skincare/private-font-name.ttf';
  const assetMap = {
    aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: {
      type: 'ttf',
      fileHashes: [ttfHash],
      files: [privateSourceSentinel],
    },
    bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb: {
      type: 'otf',
      fileHashes: [otfHash],
      files: ['/private-user/skincare/private-font-name.otf'],
    },
  };
  sizes.push(
    writeFixtureFile(exportRoot, 'assetmap.json', `${JSON.stringify(assetMap, null, 2)}\n`),
  );
  sizes.push(writeFixtureFile(exportRoot, 'metadata.json', '{}\n'));
  for (let index = 0; index < 55; index += 1) {
    sizes.push(
      writeFixtureFile(
        exportRoot,
        `other/file-${String(index).padStart(2, '0')}.dat`,
        Buffer.alloc(index + 1, index),
      ),
    );
  }

  const jsonPath = resolve(outputRoot, 'ios.json');
  const markdownPath = resolve(outputRoot, 'ios.md');
  const args = [
    '--input',
    exportRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
    '--json',
    jsonPath,
    '--markdown',
    markdownPath,
  ];

  const first = runAnalyzer(args);
  expectSuccess(first);
  const firstJson = readFileSync(jsonPath, 'utf8');
  const firstMarkdown = readFileSync(markdownPath, 'utf8');
  const stats = JSON.parse(firstJson);

  assert.equal(stats.files.totalCount, sizes.length);
  assert.equal(
    stats.files.totalBytes,
    sizes.reduce((total, size) => total + size, 0),
  );
  assert.deepEqual(stats.sourceMaps, {
    shipped: false,
    count: 2,
    bytes: 36,
    files: [
      { path: '_expo/static/js/ios/main.hbc.map', bytes: 17 },
      { path: '_expo/static/js/ios/vendor.js.map', bytes: 19 },
    ],
  });
  console.log('OK export and source-map counts');

  assert.equal(stats.bundles.count, 2);
  assert.equal(stats.bundles.javascript.count, 1);
  assert.equal(stats.bundles.hermes.count, 1);
  assert.ok(stats.bundles.gzipBytes > 0);
  assert.ok(stats.bundles.brotliBytes > 0);
  assert.equal(
    stats.bundles.gzipBytes,
    stats.bundles.files.reduce((total, file) => total + file.gzipBytes, 0),
  );
  assert.equal(
    stats.bundles.brotliBytes,
    stats.bundles.files.reduce((total, file) => total + file.brotliBytes, 0),
  );
  assert.ok(
    stats.bundles.files.every(
      (file) => file.gzipBytes > 0 && file.brotliBytes > 0 && file.bytes > 0,
    ),
  );
  console.log('OK bundle classification and compression stats');

  assert.deepEqual(stats.assets.byExtension, [
    { extension: '.bin', count: 1, bytes: 5 },
    { extension: '.otf', count: 1, bytes: 11 },
    { extension: '.png', count: 1, bytes: 13 },
    { extension: '.ttf', count: 1, bytes: 7 },
  ]);
  assert.deepEqual(stats.fonts, {
    count: 2,
    bytes: 18,
    files: [
      { path: `assets/${ttfHash}`, bytes: 7 },
      { path: `assets/${otfHash}`, bytes: 11 },
    ],
  });
  console.log('OK extension groups and font manifest');

  assert.equal(stats.largestFiles.length, 50);
  assertSorted(
    stats.bundles.files.map((file) => file.path),
    (left, right) => (left < right ? -1 : left > right ? 1 : 0),
  );
  assertSorted(
    stats.assets.byExtension.map((group) => group.extension),
    (left, right) => (left < right ? -1 : left > right ? 1 : 0),
  );
  assertSorted(
    stats.largestFiles,
    (left, right) =>
      right.bytes - left.bytes || (left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
  );
  console.log('OK deterministic sorted output and largest-50 limit');

  for (const path of allReportedPaths(stats)) {
    assert.equal(isAbsolute(path), false);
    assert.equal(path.includes('\\'), false);
    assert.equal(path.split('/').includes('..'), false);
  }
  assert.equal(firstJson.includes(temporaryRoot), false);
  assert.equal(firstMarkdown.includes(temporaryRoot), false);
  assert.equal(firstJson.includes(privateSourceSentinel), false);
  assert.equal(firstMarkdown.includes(privateSourceSentinel), false);
  console.log('OK reported paths are sanitized and relative');

  const second = runAnalyzer(args);
  expectSuccess(second);
  assert.equal(readFileSync(jsonPath, 'utf8'), firstJson);
  assert.equal(readFileSync(markdownPath, 'utf8'), firstMarkdown);
  const stdoutResult = runAnalyzer(['--input', exportRoot, '--platform', 'ios', ...fixedMetadata]);
  expectSuccess(stdoutResult);
  assert.deepEqual(JSON.parse(stdoutResult.stdout), stats);
  console.log('OK repeated files and stdout JSON are byte-stable');

  const missingInput = resolve(temporaryRoot, 'missing-export');
  const invalidResult = runAnalyzer([
    '--input',
    missingInput,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(invalidResult.status, 0);
  assert.match(invalidResult.stderr, /existing export directory/);
  assert.equal(invalidResult.stderr.includes(missingInput), false);

  const nestedOutput = resolve(exportRoot, 'stats.json');
  const contaminatingOutputResult = runAnalyzer([
    '--input',
    exportRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
    '--json',
    nestedOutput,
  ]);
  assert.notEqual(contaminatingOutputResult.status, 0);
  assert.match(contaminatingOutputResult.stderr, /outside the export directory/);
  console.log('OK invalid and self-contaminating inputs fail safely');
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
