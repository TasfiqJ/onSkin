#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const reportPath = resolve(scriptDir, 'catalog-qa-report.mjs');

const passthroughKeys = [
  'ComSpec',
  'HOME',
  'Path',
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'WINDIR',
];

const processBaseEnv = Object.fromEntries(
  passthroughKeys
    .map((key) => [key, process.env[key]])
    .filter(([, value]) => typeof value === 'string' && value.length > 0),
);

const validManifest = {
  generatedAt: '2026-07-08T00:00:00.000Z',
  inputPath: 'fixture',
  source: 'open_beauty_facts',
  importMode: 'export_or_fixture',
  totals: {
    inputRecords: 2,
  },
  products: [
    {
      barcode: '1234567890123',
      name: 'Fixture Cleanser',
      category: 'cleanser',
      ingredientsText: 'Aqua, Glycerin',
    },
  ],
  rejected: [
    {
      code: '3234567890123',
      reason: 'not_skin_care_category',
    },
  ],
};

function runReport({ manifest = validManifest, dirtyMarker = false } = {}) {
  const outDir = mkdtempSync(join(tmpdir(), 'routinekind-phase4-qa-report-'));
  const inputPath = resolve(outDir, 'obf-fixture-import.json');
  const outputPath = resolve(outDir, 'catalog-qa-report.json');
  const markerPath = resolve(root, `.phase4-qa-report-smoke-dirty-${process.pid}.tmp`);

  writeFileSync(inputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (dirtyMarker) writeFileSync(markerPath, 'temporary Phase 4 dirty-worktree smoke marker\n');

  try {
    const result = spawnSync(process.execPath, [reportPath, inputPath, outputPath], {
      cwd: root,
      encoding: 'utf8',
      env: processBaseEnv,
    });
    const packet = JSON.parse(readFileSync(outputPath, 'utf8'));
    const markdown = readFileSync(outputPath.replace(/\.json$/i, '.md'), 'utf8');
    return { ...result, packet, markdown };
  } finally {
    if (dirtyMarker) rmSync(markerPath, { force: true });
    rmSync(outDir, { force: true, recursive: true });
  }
}

const requiredSourceHashes = [
  'package.json',
  'scripts/phase4/catalog-qa-report.mjs',
  'scripts/phase4/import-obf-snapshot.mjs',
  'scripts/phase4/import-cosing-dictionary.mjs',
  'scripts/phase4/import-fixture-smoke.mjs',
  'scripts/phase4/check-source-env.mjs',
  'scripts/phase4/check-source-env-smoke.mjs',
  'scripts/phase4/catalog-qa-report-smoke.mjs',
  'scripts/phase9/lib.mjs',
  'docs/FOR_TAS_TO_DO.md',
  'docs/phase-4/catalog-source-memo-cosing.md',
  'docs/phase-4/catalog-source-memo-open-beauty-facts.md',
  'docs/phase-4/odbl-compliance-memo.md',
  'docs/phase-4/phase-4-exit-review.md',
];

const cases = [
  {
    name: 'catalog QA report writes Git provenance and source hashes',
    result: runReport(),
    expect(result) {
      const sourceHashes = Object.fromEntries(
        result.packet.sourceHashes.map((sourceHash) => [sourceHash.path, sourceHash]),
      );
      return (
        result.status === 0 &&
        /^[0-9a-f]{40}$/i.test(result.packet.gitSha) &&
        typeof result.packet.gitStatus === 'string' &&
        result.packet.inputArtifact.exists === true &&
        requiredSourceHashes.every((path) => sourceHashes[path]?.exists === true) &&
        result.markdown.includes('Git status:') &&
        result.markdown.includes('## Source Hashes')
      );
    },
  },
  {
    name: 'catalog QA report warns when generated from a dirty worktree',
    result: runReport({ dirtyMarker: true }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.gitStatus.includes(`.phase4-qa-report-smoke-dirty-${process.pid}.tmp`) &&
        result.packet.warnings.includes(
          'Catalog QA report generated with a dirty Git worktree; do not use it as final catalog-source evidence.',
        ) &&
        result.markdown.includes('Git status: DIRTY')
      );
    },
  },
  {
    name: 'catalog QA report keeps duplicate barcode blockers',
    result: runReport({
      manifest: {
        ...validManifest,
        products: [
          ...validManifest.products,
          {
            barcode: '1234567890123',
            name: 'Duplicate Cleanser',
            category: 'cleanser',
            ingredientsText: 'Aqua',
          },
        ],
      },
    }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.blockers.includes('Duplicate barcodes: 1234567890123') &&
        result.markdown.includes('Duplicate barcodes: 1234567890123')
      );
    },
  },
];

let failed = false;
for (const testCase of cases) {
  if (testCase.expect(testCase.result)) {
    console.log(`OK ${testCase.name}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${testCase.name}`);
  const output = `${testCase.result.stdout ?? ''}\n${testCase.result.stderr ?? ''}`.trim();
  if (output) console.error(output);
}

if (failed) process.exit(1);
