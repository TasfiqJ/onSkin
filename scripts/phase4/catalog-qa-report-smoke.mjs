#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const reportPath = resolve(scriptDir, 'catalog-qa-report.mjs');
const obfImporterPath = resolve(scriptDir, 'import-obf-snapshot.mjs');
const cosingImporterPath = resolve(scriptDir, 'import-cosing-dictionary.mjs');
const obfFixturePath = resolve(root, 'scripts/phase4/fixtures/obf-sample.jsonl');
const cosingFixturePath = resolve(root, 'scripts/phase4/fixtures/cosing-sample.csv');

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

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: processBaseEnv,
  });
}

const artifactRoot = resolve(root, 'artifacts/phase4');
mkdirSync(artifactRoot, { recursive: true });
const outDir = mkdtempSync(join(artifactRoot, 'qa-report-smoke-'));

function importFixture(importerPath, fixturePath, outputPath) {
  const result = runNode([importerPath, '--fixture', fixturePath, outputPath]);
  if (result.status !== 0) throw new Error(`Fixture import failed:\n${output(result)}`);
  return JSON.parse(readFileSync(outputPath, 'utf8'));
}

function runReport({ manifest, name, dirtyMarker = false }) {
  const inputPath = resolve(outDir, `${name}-input.json`);
  const outputPath = resolve(outDir, `${name}-report.json`);
  const markerPath = resolve(root, `.phase4-qa-report-smoke-dirty-${process.pid}.tmp`);
  writeFileSync(inputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  if (dirtyMarker) writeFileSync(markerPath, 'temporary dirty-worktree marker\n', { flag: 'wx' });
  try {
    const result = runNode([reportPath, inputPath, outputPath]);
    const packet = JSON.parse(readFileSync(outputPath, 'utf8'));
    const markdown = readFileSync(outputPath.replace(/\.json$/i, '.md'), 'utf8');
    return { ...result, packet, markdown };
  } finally {
    if (dirtyMarker) rmSync(markerPath, { force: true });
  }
}

try {
  const obfFixtureOutput = resolve(outDir, 'obf-fixture.json');
  const cosingFixtureOutput = resolve(outDir, 'cosing-fixture.json');
  const obfManifest = importFixture(obfImporterPath, obfFixturePath, obfFixtureOutput);
  const cosingManifest = importFixture(cosingImporterPath, cosingFixturePath, cosingFixtureOutput);

  const cases = [
    {
      name: 'OBF fixture QA validates exact transform/source hashes',
      result: runReport({ manifest: obfManifest, name: 'obf-valid' }),
      expect(result) {
        const paths = new Set(result.packet.sourceHashes.map((entry) => entry.path));
        return (
          result.status === 0 &&
          result.packet.source === 'open_beauty_facts' &&
          result.packet.blockers.length === 0 &&
          result.packet.transformedPayloadContract?.contractId ===
            'catalog-transformed-payload-v1' &&
          result.packet.transformedPayloadSha256 === result.packet.recomputedTransformSha256 &&
          paths.has('docs/phase-4/catalog-source-trust-registry.json') &&
          paths.has('docs/phase-4/catalog-release-scope.json') &&
          paths.has('supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql') &&
          result.markdown.includes('## Source Hashes')
        );
      },
    },
    {
      name: 'CosIng fixture QA validates provenance and glossary scope',
      result: runReport({ manifest: cosingManifest, name: 'cosing-valid' }),
      expect(result) {
        return (
          result.status === 0 &&
          result.packet.source === 'cosing' &&
          result.packet.blockers.length === 0 &&
          result.packet.totals.records === 3 &&
          result.packet.transformedPayloadSha256 === result.packet.recomputedTransformSha256
        );
      },
    },
    {
      name: 'QA report records dirty-worktree provenance without clearing launch',
      result: runReport({ manifest: obfManifest, name: 'dirty', dirtyMarker: true }),
      expect(result) {
        return (
          result.status === 0 &&
          result.packet.gitStatus.includes(`.phase4-qa-report-smoke-dirty-${process.pid}.tmp`) &&
          result.packet.warnings.some((warning) => warning.includes('dirty Git worktree')) &&
          result.packet.launchClear === false &&
          result.markdown.includes('Git status: DIRTY')
        );
      },
    },
    {
      name: 'missing transformed-payload contract is a hard nonzero QA blocker',
      result: runReport({
        name: 'missing-payload-contract',
        manifest: { ...obfManifest, transformedPayloadContract: undefined },
      }),
      expect(result) {
        return (
          result.status !== 0 &&
          result.packet.blockers.includes(
            'Import manifest transformed-payload contract is missing or unsupported.',
          )
        );
      },
    },
    {
      name: 'snapshot-date enrichment remains separately bound outside the payload digest',
      result: runReport({
        name: 'snapshot-date-drift',
        manifest: {
          ...obfManifest,
          products: [
            { ...obfManifest.products[0], sourceSnapshotDate: '2026-07-16' },
            ...obfManifest.products.slice(1),
          ],
        },
      }),
      expect(result) {
        return (
          result.status !== 0 &&
          result.packet.transformedPayloadSha256 === result.packet.recomputedTransformSha256 &&
          result.packet.blockers.some((blocker) =>
            blocker.includes('records violate the exact content/provenance contract'),
          )
        );
      },
    },
    {
      name: 'duplicate OBF barcode is a hard nonzero QA blocker',
      result: runReport({
        name: 'duplicate-obf',
        manifest: {
          ...obfManifest,
          totals: {
            ...obfManifest.totals,
            acceptedProducts: obfManifest.totals.acceptedProducts + 1,
          },
          products: [...obfManifest.products, { ...obfManifest.products[0] }],
        },
      }),
      expect(result) {
        return (
          result.status !== 0 &&
          result.packet.blockers.some((blocker) => blocker.includes('Duplicate barcodes')) &&
          result.packet.localQaClear === false &&
          result.markdown.includes('Duplicate barcodes')
        );
      },
    },
    {
      name: 'unsigned candidate manifest is a hard nonzero promotion blocker',
      result: runReport({
        name: 'candidate-obf',
        manifest: {
          ...obfManifest,
          status: 'candidate_transform_not_approved',
          importMode: 'candidate_hash_only',
          transformerCandidate: { sha256: 'a'.repeat(64) },
        },
      }),
      expect(result) {
        return (
          result.status !== 0 &&
          result.packet.blockers.includes(
            'Unsigned candidate transforms can never pass catalog QA or promotion.',
          )
        );
      },
    },
    {
      name: 'forged approved status is revalidated against current trust and release scope',
      result: runReport({
        name: 'forged-approved',
        manifest: {
          ...obfManifest,
          status: 'approved_transform',
          importMode: 'approved_offline_export',
          sourceApproval: {
            manifest: {},
            manifestBytesBase64: Buffer.from('{}\n').toString('base64'),
            manifestSha256: '0'.repeat(64),
            releaseScopeSnapshot: {},
            transformerSnapshot: {},
            trustRegistrySnapshot: {},
          },
        },
      }),
      expect(result) {
        return (
          result.status !== 0 &&
          result.packet.blockers.some((blocker) =>
            /retained exact bytes|revalidation|trust-registry snapshot|release-scope snapshot/i.test(
              blocker,
            ),
          )
        );
      },
    },
    {
      name: 'prototype-like source names become blockers instead of inherited contracts',
      result: runReport({
        name: 'prototype-source',
        manifest: { ...obfManifest, source: '__proto__' },
      }),
      expect(result) {
        return (
          result.status !== 0 &&
          result.packet.blockers.includes('Import manifest source is unsupported.')
        );
      },
    },
    {
      name: 'malformed CosIng record shapes become blockers instead of crashing QA',
      result: runReport({
        name: 'cosing-null-record',
        manifest: { ...cosingManifest, ingredients: [null] },
      }),
      expect(result) {
        return (
          result.status !== 0 &&
          result.packet.blockers.some((blocker) => blocker.includes('content/provenance contract'))
        );
      },
    },
  ];

  let failed = false;
  for (const testCase of cases) {
    if (testCase.expect(testCase.result)) {
      console.log(`OK ${testCase.name}`);
    } else {
      failed = true;
      console.error(`FAIL ${testCase.name}`);
      console.error(output(testCase.result));
      console.error(JSON.stringify(testCase.result.packet, null, 2));
    }
  }
  if (failed) process.exitCode = 1;
} finally {
  rmSync(outDir, { force: true, recursive: true });
}
