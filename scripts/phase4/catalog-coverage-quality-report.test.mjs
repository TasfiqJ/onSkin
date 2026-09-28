import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  CATALOG_CURATION_ENVELOPE_USAGE,
  parseCatalogCurationEnvelopeArgs,
} from './build-catalog-curation-envelope.mjs';
import {
  CATALOG_COVERAGE_REPORT_USAGE,
  parseCatalogCoverageReportArgs,
} from './catalog-coverage-quality-report.mjs';

const root = resolve(import.meta.dirname, '../..');
const buildCli = resolve(import.meta.dirname, 'build-catalog-curation-envelope.mjs');
const reportCli = resolve(import.meta.dirname, 'catalog-coverage-quality-report.mjs');

test('envelope CLI exports an exact flag-only interface and operational help', () => {
  assert.deepEqual(
    parseCatalogCurationEnvelopeArgs([
      '--target-policy',
      'policy.json',
      '--cat02-membership-proof',
      'cat02-membership-proof.json',
      '--corpus',
      'corpus.json',
      '--review',
      'review.json',
      '--trust-registry',
      'trust.json',
      '--generated-at',
      '2026-09-10T15:00:00.000Z',
      '--output',
      'artifacts/phase4/catalog-curation-envelope.release.digest.json',
    ]),
    {
      targetPolicyPath: 'policy.json',
      cat02MembershipProofPath: 'cat02-membership-proof.json',
      betaShelfCorpusPath: 'corpus.json',
      curationReviewPath: 'review.json',
      trustRegistryPath: 'trust.json',
      generatedAt: '2026-09-10T15:00:00.000Z',
      outputPath: 'artifacts/phase4/catalog-curation-envelope.release.digest.json',
    },
  );
  assert.match(CATALOG_CURATION_ENVELOPE_USAGE, /There are no positional inputs or defaults/u);
  assert.match(CATALOG_CURATION_ENVELOPE_USAGE, /CATALOG_TRUST_REGISTRY_SHA256/u);
  assert.match(CATALOG_CURATION_ENVELOPE_USAGE, /never overwritten/u);
});

test('report CLI exports exact inputs, output naming, trust-root requirements, and exit semantics', () => {
  assert.deepEqual(
    parseCatalogCoverageReportArgs([
      '--envelope',
      'artifacts/phase4/catalog-curation-envelope.release.digest.json',
      '--preactivation',
      '--trust-registry',
      'docs/phase-4/catalog-source-trust-registry.json',
      '--output',
      'artifacts/phase4/catalog-coverage-quality-report.release.digest.json',
    ]),
    {
      phase: 'preactivation',
      envelopePath: 'artifacts/phase4/catalog-curation-envelope.release.digest.json',
      databaseReadbackPath: null,
      trustRegistryPath: 'docs/phase-4/catalog-source-trust-registry.json',
      outputPath: 'artifacts/phase4/catalog-coverage-quality-report.release.digest.json',
    },
  );
  assert.deepEqual(
    parseCatalogCoverageReportArgs([
      '--envelope',
      'artifacts/phase4/catalog-curation-envelope.release.digest.json',
      '--database-readback',
      'artifacts/phase4/catalog-curation-database-readback.release.digest.json',
      '--trust-registry',
      'docs/phase-4/catalog-source-trust-registry.json',
      '--output',
      'artifacts/phase4/catalog-coverage-quality-report.release.digest.json',
    ]),
    {
      phase: 'final',
      envelopePath: 'artifacts/phase4/catalog-curation-envelope.release.digest.json',
      databaseReadbackPath:
        'artifacts/phase4/catalog-curation-database-readback.release.digest.json',
      trustRegistryPath: 'docs/phase-4/catalog-source-trust-registry.json',
      outputPath: 'artifacts/phase4/catalog-coverage-quality-report.release.digest.json',
    },
  );
  assert.match(CATALOG_COVERAGE_REPORT_USAGE, /CATALOG_TRUST_ROOT_PUBLIC_KEY_SPKI_BASE64/u);
  assert.match(CATALOG_COVERAGE_REPORT_USAGE, /Exit codes: 0 requested phase passed, 2/u);
  assert.match(CATALOG_COVERAGE_REPORT_USAGE, /point-in-time/u);
  assert.match(CATALOG_COVERAGE_REPORT_USAGE, /participant-level marginal Wilson/u);
  assert.match(CATALOG_COVERAGE_REPORT_USAGE, /HMAC\/suppression\/overlap/u);
  assert.match(
    CATALOG_COVERAGE_REPORT_USAGE,
    /catalog-coverage-quality-report\.<release-id>\.<digest>\.json/u,
  );
});

test('both CLIs provide help without evidence files, network, or trust-root environment', () => {
  for (const [cli, expected] of [
    [buildCli, /--target-policy/u],
    [reportCli, /--envelope/u],
  ]) {
    for (const helpFlag of ['--help', '-h']) {
      const result = spawnSync(process.execPath, [cli, helpFlag], {
        cwd: root,
        encoding: 'utf8',
        env: {},
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, expected);
      assert.equal(result.stderr, '');
    }
  }
});

test('invalid or incomplete CLI invocations fail closed', () => {
  const build = spawnSync(process.execPath, [buildCli], { cwd: root, encoding: 'utf8' });
  assert.equal(build.status, 1);
  assert.match(build.stderr, /missing required flag/u);
  const report = spawnSync(process.execPath, [reportCli, '--unknown', 'value'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(report.status, 1);
  assert.match(report.stderr, /unknown/u);

  assert.throws(
    () =>
      parseCatalogCoverageReportArgs([
        '--envelope',
        'envelope.json',
        '--trust-registry',
        'trust.json',
        '--output',
        'report.json',
      ]),
    /exactly one mode/u,
  );
  assert.throws(
    () =>
      parseCatalogCoverageReportArgs([
        '--envelope',
        'envelope.json',
        '--preactivation',
        '--database-readback',
        'readback.json',
        '--trust-registry',
        'trust.json',
        '--output',
        'report.json',
      ]),
    /exactly one mode/u,
  );
});

test('malformed evidence cannot create even a partial quality report', (t) => {
  const directory = mkdtempSync(join(resolve(root, 'artifacts/phase4'), 'cat03-report-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const envelopePath = join(directory, 'malformed-envelope.json');
  const trustPath = join(directory, 'malformed-trust.json');
  const outputPath = join(directory, 'must-not-exist.json');
  writeFileSync(envelopePath, '{"schemaVersion":1}\n');
  writeFileSync(trustPath, '{"status":"active"}\n');
  const result = spawnSync(
    process.execPath,
    [
      reportCli,
      '--envelope',
      envelopePath,
      '--preactivation',
      '--trust-registry',
      trustPath,
      '--output',
      outputPath,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing or unknown fields/u);
  assert.equal(result.stdout, '');
});
