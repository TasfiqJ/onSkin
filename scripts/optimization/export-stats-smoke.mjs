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
const sourceMapBase64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function checkedInPackageNames() {
  const lockfile = JSON.parse(
    readFileSync(resolve(scriptDirectory, '../../package-lock.json'), 'utf8'),
  );
  return [
    ...new Set(
      Object.keys(lockfile.packages)
        .map((packagePath) =>
          packagePath
            .replaceAll('\\', '/')
            .match(/(?:^|\/)node_modules\/(@[^/]+\/[^/]+|[^/]+)$/u)?.[1]
            ?.toLowerCase(),
        )
        .filter(Boolean),
    ),
  ].sort();
}

function encodeVlq(value) {
  let encodedValue = Math.abs(value) * 2 + (value < 0 ? 1 : 0);
  let result = '';
  do {
    let digit = encodedValue % 32;
    encodedValue = Math.floor(encodedValue / 32);
    if (encodedValue > 0) digit |= 32;
    result += sourceMapBase64Alphabet[digit];
  } while (encodedValue > 0);
  return result;
}

function completeMappings(sourceCount) {
  return Array.from({ length: sourceCount }, (_, index) =>
    [0, index === 0 ? 0 : 1, 0, 0].map(encodeVlq).join(''),
  ).join(';');
}

function sourceMapFixture(sources, sourcesContent, sourceRoot, mappings) {
  return `${JSON.stringify({
    version: 3,
    names: [],
    mappings: mappings ?? completeMappings(sources.length),
    ...(sourceRoot === undefined ? {} : { sourceRoot }),
    sources,
    sourcesContent,
  })}\n`;
}

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

const temporaryRoot = mkdtempSync(join(tmpdir(), 'routinekind-export-stats-smoke-'));
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

  const allowedPackages = checkedInPackageNames();
  assert.ok(allowedPackages.length >= 55, 'Expected at least 55 checked-in package names.');
  const packageFixtures = allowedPackages.slice(0, 55);
  const privateSourceSentinel = 'C:/private-user/skincare/secret-source.ts';
  const privatePackageSentinel = 'private-secret-package';
  assert.equal(allowedPackages.includes(privatePackageSentinel), false);
  const privateContentSentinel = 'PRIVATE_SOURCE_CONTENT_MUST_NOT_LEAK';
  const duplicateSource = `/node_modules/${packageFixtures[0]}/duplicate.js`;
  const duplicateContent = 'D'.repeat(12_000);
  const firstMapSources = [
    duplicateSource,
    '/apps/mobile/src/app?ctx=private-route-hash',
    '/apps/mobile/src/components/Card.tsx',
    '/apps/mobile/src/features/shelf/index.ts',
    '/apps/mobile/src/lib/crypto.ts',
    '/apps/mobile/src/theme/index.ts',
    '/packages/types/src/index.ts',
    '\0polyfill:assets-registry',
    '\0polyfill:external-require',
    `/node_modules/${privatePackageSentinel}/index.js`,
    'https://private-host.invalid/private-user/source.ts',
    privateSourceSentinel,
    ...packageFixtures.map((packageName, index) => `/node_modules/${packageName}/file-${index}.js`),
  ];
  const firstMapContents = [
    duplicateContent,
    'A'.repeat(9_000),
    'C'.repeat(8_000),
    'F'.repeat(7_000),
    'L'.repeat(6_000),
    'T'.repeat(5_000),
    'P'.repeat(4_000),
    'polyfill-assets',
    'polyfill-require',
    privateContentSentinel,
    'private URI content',
    'private external content',
    ...packageFixtures.map((_, index) => String(index).repeat(100 + index)),
  ];
  const secondMapSources = [
    duplicateSource,
    '/apps/mobile/src/app?ctx=second-private-route-hash',
    `C:\\private-user\\node_modules\\${packageFixtures[1]}\\windows.js`,
    `webpack:///node_modules/${packageFixtures[2]}/webpack.js`,
    `file:///private-user/node_modules/${packageFixtures[3]}/file-url.js`,
    'relative/private-source.ts',
    'empty-source.ts',
    'unicode-source.ts',
  ];
  const secondMapContents = [
    duplicateContent,
    'A'.repeat(9_000),
    'W'.repeat(3_000),
    'K'.repeat(3_000),
    'U'.repeat(3_000),
    'relative',
    '',
    'é🙂',
  ];
  const sourceMapSizes = [
    writeFixtureFile(
      exportRoot,
      '_expo/static/js/ios/main.hbc.map',
      sourceMapFixture(firstMapSources, firstMapContents),
    ),
    writeFixtureFile(
      exportRoot,
      '_expo/static/js/ios/vendor.js.map',
      sourceMapFixture(secondMapSources, secondMapContents, 'webpack:///'),
    ),
  ];
  sizes.push(...sourceMapSizes);
  const ttfHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const otfHash = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  sizes.push(writeFixtureFile(exportRoot, `assets/${ttfHash}`, Buffer.alloc(7, 3)));
  sizes.push(writeFixtureFile(exportRoot, `assets/${otfHash}`, Buffer.alloc(11, 4)));
  sizes.push(writeFixtureFile(exportRoot, 'assets/data.bin', Buffer.alloc(5, 5)));
  sizes.push(writeFixtureFile(exportRoot, 'assets/image.PNG', Buffer.alloc(13, 6)));
  const privateAssetSentinel = 'C:/private-user/skincare/private-font-name.ttf';
  const assetMap = {
    aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: {
      type: 'ttf',
      fileHashes: [ttfHash],
      files: [privateAssetSentinel],
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
  assert.equal(stats.schemaVersion, 2);
  assert.deepEqual(stats.sourceMaps, {
    shipped: false,
    count: 2,
    bytes: sourceMapSizes[0] + sourceMapSizes[1],
    files: [
      { path: '_expo/static/js/ios/main.hbc.map', bytes: sourceMapSizes[0] },
      { path: '_expo/static/js/ios/vendor.js.map', bytes: sourceMapSizes[1] },
    ],
  });
  const expectedSourceOccurrenceCount = firstMapSources.length + secondMapSources.length;
  const expectedSourceContentBytes = [...firstMapContents, ...secondMapContents].reduce(
    (total, content) => total + Buffer.byteLength(content),
    0,
  );
  assert.equal(stats.sourceGroups.basis, 'utf8_sources_content');
  assert.equal(stats.sourceGroups.complete, true);
  assert.equal(stats.sourceGroups.mapCount, 2);
  assert.equal(stats.sourceGroups.sourceOccurrenceCount, expectedSourceOccurrenceCount);
  assert.equal(stats.sourceGroups.referencedSourceCount, expectedSourceOccurrenceCount);
  assert.equal(stats.sourceGroups.uniqueSourceCount, expectedSourceOccurrenceCount - 1);
  assert.equal(stats.sourceGroups.sourceContentBytes, expectedSourceContentBytes);
  assert.equal(stats.sourceGroups.totalGroupCount, 66);
  assert.equal(stats.sourceGroups.reportedGroupCount, 50);
  assert.equal(stats.sourceGroups.omittedGroupCount, 16);
  assert.equal(stats.sourceGroups.groups.length, 50);
  assert.equal(
    stats.sourceGroups.reportedSourceContentBytes + stats.sourceGroups.omittedSourceContentBytes,
    expectedSourceContentBytes,
  );
  assert.equal(stats.sourceGroups.unattributedSourceCount, 6);
  assert.ok(stats.sourceGroups.unattributedSourceContentBytes > 0);
  const duplicateGroup = stats.sourceGroups.groups.find(
    (group) => group.group === `npm:${packageFixtures[0]}`,
  );
  assert.deepEqual(duplicateGroup, {
    group: `npm:${packageFixtures[0]}`,
    sourceOccurrenceCount: 3,
    uniqueSourceCount: 2,
    sourceContentBytes: duplicateContent.length * 2 + 100,
  });
  assert.deepEqual(
    stats.sourceGroups.groups.find((group) => group.group === 'workspace:mobile/app'),
    {
      group: 'workspace:mobile/app',
      sourceOccurrenceCount: 2,
      uniqueSourceCount: 2,
      sourceContentBytes: 18_000,
    },
  );
  for (const [fixtureIndex, extraBytes] of [
    [1, 3_000],
    [2, 3_000],
    [3, 3_000],
  ]) {
    const fixtureContentBytes = Buffer.byteLength(String(fixtureIndex).repeat(100 + fixtureIndex));
    assert.deepEqual(
      stats.sourceGroups.groups.find(
        (group) => group.group === `npm:${packageFixtures[fixtureIndex]}`,
      ),
      {
        group: `npm:${packageFixtures[fixtureIndex]}`,
        sourceOccurrenceCount: 2,
        uniqueSourceCount: 2,
        sourceContentBytes: fixtureContentBytes + extraBytes,
      },
    );
  }
  console.log('OK complete privacy-safe source-map attribution and largest-50 groups');

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
  assertSorted(
    stats.sourceGroups.groups,
    (left, right) =>
      right.sourceContentBytes - left.sourceContentBytes ||
      right.sourceOccurrenceCount - left.sourceOccurrenceCount ||
      (left.group < right.group ? -1 : left.group > right.group ? 1 : 0),
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
  assert.equal(firstJson.includes(privateAssetSentinel), false);
  assert.equal(firstMarkdown.includes(privateAssetSentinel), false);
  assert.equal(firstJson.includes(privateContentSentinel), false);
  assert.equal(firstMarkdown.includes(privateContentSentinel), false);
  assert.equal(firstJson.includes(privatePackageSentinel), false);
  assert.equal(firstMarkdown.includes(privatePackageSentinel), false);
  assert.equal(firstJson.includes('private-host.invalid'), false);
  assert.equal(firstMarkdown.includes('private-host.invalid'), false);
  assert.equal(firstJson.includes('private-route-hash'), false);
  assert.equal(firstMarkdown.includes('private-route-hash'), false);
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

  const emptyExportRoot = resolve(temporaryRoot, 'empty-export');
  mkdirSync(emptyExportRoot, { recursive: true });
  const noMapResult = runAnalyzer([
    '--input',
    emptyExportRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(noMapResult.status, 0);
  assert.match(noMapResult.stderr, /SOURCE_MAP_REQUIRED/);

  const uncoveredBundleRoot = resolve(temporaryRoot, 'uncovered-bundle');
  writeFixtureFile(uncoveredBundleRoot, 'main.hbc', Buffer.from('bundle'));
  const uncoveredBundleResult = runAnalyzer([
    '--input',
    uncoveredBundleRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(uncoveredBundleResult.status, 0);
  assert.match(uncoveredBundleResult.stderr, /SOURCE_MAP_COVERAGE_INCOMPLETE/);

  const uncoveredMapRoot = resolve(temporaryRoot, 'uncovered-map');
  writeFixtureFile(
    uncoveredMapRoot,
    'stale.hbc.map',
    sourceMapFixture(['private-source.ts'], ['private-content']),
  );
  const uncoveredMapResult = runAnalyzer([
    '--input',
    uncoveredMapRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(uncoveredMapResult.status, 0);
  assert.match(uncoveredMapResult.stderr, /SOURCE_MAP_COVERAGE_INCOMPLETE/);
  assert.equal(uncoveredMapResult.stderr.includes('private-source'), false);
  assert.equal(uncoveredMapResult.stderr.includes('private-content'), false);

  const malformedMapRoot = resolve(temporaryRoot, 'malformed-map');
  writeFixtureFile(malformedMapRoot, 'main.hbc', Buffer.from('bundle'));
  writeFixtureFile(malformedMapRoot, 'main.hbc.map', '{private-invalid-json');
  const malformedMapResult = runAnalyzer([
    '--input',
    malformedMapRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(malformedMapResult.status, 0);
  assert.match(malformedMapResult.stderr, /SOURCE_MAP_INVALID_JSON/);
  assert.equal(malformedMapResult.stderr.includes('private-invalid-json'), false);

  const missingContentRoot = resolve(temporaryRoot, 'missing-content-map');
  writeFixtureFile(missingContentRoot, 'main.hbc', Buffer.from('bundle'));
  writeFixtureFile(
    missingContentRoot,
    'main.hbc.map',
    `${JSON.stringify({
      version: 3,
      names: [],
      mappings: '',
      sources: ['private-source.ts'],
    })}\n`,
  );
  const missingContentResult = runAnalyzer([
    '--input',
    missingContentRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(missingContentResult.status, 0);
  assert.match(missingContentResult.stderr, /SOURCE_MAP_CONTENT_UNAVAILABLE/);
  assert.equal(missingContentResult.stderr.includes('private-source'), false);

  const zeroSourceRoot = resolve(temporaryRoot, 'zero-source-map');
  writeFixtureFile(zeroSourceRoot, 'main.hbc', Buffer.from('bundle'));
  writeFixtureFile(zeroSourceRoot, 'main.hbc.map', sourceMapFixture([], []));
  const zeroSourceResult = runAnalyzer([
    '--input',
    zeroSourceRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(zeroSourceResult.status, 0);
  assert.match(zeroSourceResult.stderr, /SOURCE_MAP_CONTENT_UNAVAILABLE/);

  const mixedEmptyMapRoot = resolve(temporaryRoot, 'mixed-empty-source-map');
  writeFixtureFile(mixedEmptyMapRoot, 'main.hbc', Buffer.from('bundle'));
  writeFixtureFile(
    mixedEmptyMapRoot,
    'main.hbc.map',
    sourceMapFixture(['mapped-source.ts'], ['mapped content']),
  );
  writeFixtureFile(mixedEmptyMapRoot, 'vendor.js', Buffer.from('vendor'));
  writeFixtureFile(mixedEmptyMapRoot, 'vendor.js.map', sourceMapFixture([], []));
  const mixedEmptyMapResult = runAnalyzer([
    '--input',
    mixedEmptyMapRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(mixedEmptyMapResult.status, 0);
  assert.match(mixedEmptyMapResult.stderr, /SOURCE_MAP_CONTENT_UNAVAILABLE/);

  const unmappedSourceRoot = resolve(temporaryRoot, 'unmapped-source-map');
  writeFixtureFile(unmappedSourceRoot, 'main.hbc', Buffer.from('bundle'));
  writeFixtureFile(
    unmappedSourceRoot,
    'main.hbc.map',
    sourceMapFixture(
      ['mapped-source.ts', 'private-unrelated-source.ts'],
      ['mapped content', 'private unrelated content'],
      undefined,
      [0, 0, 0, 0].map(encodeVlq).join(''),
    ),
  );
  const unmappedSourceResult = runAnalyzer([
    '--input',
    unmappedSourceRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(unmappedSourceResult.status, 0);
  assert.match(unmappedSourceResult.stderr, /SOURCE_MAP_COVERAGE_INCOMPLETE/);
  assert.equal(unmappedSourceResult.stderr.includes('private-unrelated'), false);

  const invalidSourceIndexRoot = resolve(temporaryRoot, 'invalid-source-index-map');
  writeFixtureFile(invalidSourceIndexRoot, 'main.hbc', Buffer.from('bundle'));
  writeFixtureFile(
    invalidSourceIndexRoot,
    'main.hbc.map',
    sourceMapFixture(
      ['private-source.ts'],
      ['private content'],
      undefined,
      [0, 1, 0, 0].map(encodeVlq).join(''),
    ),
  );
  const invalidSourceIndexResult = runAnalyzer([
    '--input',
    invalidSourceIndexRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(invalidSourceIndexResult.status, 0);
  assert.match(invalidSourceIndexResult.stderr, /SOURCE_MAP_INVALID_STRUCTURE/);
  assert.equal(invalidSourceIndexResult.stderr.includes('private-source'), false);

  const indexedMapRoot = resolve(temporaryRoot, 'indexed-map');
  writeFixtureFile(indexedMapRoot, 'main.hbc', Buffer.from('bundle'));
  writeFixtureFile(
    indexedMapRoot,
    'main.hbc.map',
    `${JSON.stringify({ version: 3, sections: [] })}\n`,
  );
  const indexedMapResult = runAnalyzer([
    '--input',
    indexedMapRoot,
    '--platform',
    'ios',
    ...fixedMetadata,
  ]);
  assert.notEqual(indexedMapResult.status, 0);
  assert.match(indexedMapResult.stderr, /SOURCE_MAP_INDEX_UNSUPPORTED/);
  console.log('OK invalid, incomplete, and content-free source maps fail closed');
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
