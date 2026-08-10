#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  createPerformanceEvidenceTemplate,
  summarizePerformanceSamples,
} from './performance-evidence-contract.mjs';
import {
  buildGovernedEvidenceLedger,
  captureGovernedPublicationPolicy,
  governedEvidenceLedgerPath,
  governedEvidenceRoleForPath,
  renderGovernedEvidenceLedger,
} from '../launch/governed-evidence-chain.mjs';
import {
  publishGovernedFixtureTail,
  seedGovernedPublicationSourceFixture,
} from '../launch/governed-evidence-test-fixture.mjs';

const root = mkdtempSync(join(tmpdir(), 'layerwell-performance-evidence-'));
const repoRoot = resolve(import.meta.dirname, '../..');
const checker = resolve(import.meta.dirname, 'check-performance-evidence.mjs');
const evidencePath = 'docs/phase-5/evidence/performance/smoke/evidence.json';
const releaseCandidateDir = 'docs/phase-9/release-candidates/rc-performance-smoke';

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

git(root, ['init']);
git(root, ['config', 'user.email', 'performance-smoke@example.invalid']);
git(root, ['config', 'user.name', 'Performance Smoke']);
writeFileSync(resolve(root, 'source.txt'), 'performance build source\n');
seedGovernedPublicationSourceFixture({ fixtureRoot: root, sourceRoot: repoRoot });
git(root, ['add', '-A']);
git(root, ['commit', '-m', 'Performance build source S']);
const sourceGitSha = git(root, ['rev-parse', 'HEAD']).toLowerCase();

function validEvidence() {
  const evidence = createPerformanceEvidenceTemplate();
  evidence.capturedAt = '2026-07-09T16:00:00.000Z';
  evidence.gitSha = sourceGitSha;
  evidence.thresholdsDefinedAt = '2026-07-09T12:00:00.000Z';
  evidence.thresholdsDefinedBy = 'Performance Owner';
  evidence.devices.ios.buildId = '9f7b48e1-7a52-4efb-9d93-3e93a2bf13e5';
  evidence.devices.ios.deviceModel = 'iPhone 15 Pro';
  evidence.devices.ios.osVersion = 'iOS 18.5';
  evidence.photoDataset.source = 'synthetic non-sensitive encrypted test photos';
  evidence.photoDataset.zeroCrashes = true;
  evidence.photoDataset.zeroOsTerminations = true;
  for (const threshold of Object.values(evidence.thresholds)) {
    threshold.maxP95 = 2000;
    threshold.rationale = 'Owner-defined beta threshold set before physical-device testing.';
  }
  for (const measurement of evidence.measurements) {
    measurement.source =
      measurement.metric === 'photo_timeline_peak_memory_mb'
        ? 'native_profiler'
        : 'instrumented_timer';
    measurement.samples = [400, 500, 500, 900, 1000];
    Object.assign(measurement, summarizePerformanceSamples(measurement.samples));
  }
  evidence.signoff.decision = 'pass';
  evidence.signoff.signedOffBy = 'Performance Reviewer';
  evidence.signoff.signedAt = '2026-07-09T17:00:00.000Z';
  return evidence;
}

function run(
  evidence,
  { strict = true, omitPath = false, summarize = false, path = evidencePath, extraEnv = {} } = {},
) {
  if (evidence) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  const result = spawnSync(
    process.execPath,
    [checker, ...(summarize ? ['--write-summaries'] : []), ...(strict ? ['--strict'] : [])],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PHASE5_PERFORMANCE_EVIDENCE_PATH: omitPath ? '' : path,
        PHASE9_RELEASE_CANDIDATE_DIR: releaseCandidateDir,
        ...extraEnv,
      },
    },
  );
  if (summarize && result.status === 0) {
    result.summarizedEvidence = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  }
  return result;
}

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function runWithFinalGeneratedTail() {
  writeFileSync(resolve(root, evidencePath), `${JSON.stringify(committedEvidence, null, 2)}\n`);
  publishGovernedFixtureTail({ fixtureRoot: root });
  return spawnSync(process.execPath, [checker, '--strict'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PHASE5_PERFORMANCE_EVIDENCE_PATH: evidencePath,
      PHASE9_RELEASE_CANDIDATE_DIR: releaseCandidateDir,
    },
  });
}

const committedEvidence = validEvidence();
mkdirSync(dirname(resolve(root, evidencePath)), { recursive: true });
writeFileSync(resolve(root, evidencePath), `${JSON.stringify(committedEvidence, null, 2)}\n`);
const releaseCandidatePath = `${releaseCandidateDir}/manifest.md`;
mkdirSync(dirname(resolve(root, releaseCandidatePath)), { recursive: true });
writeFileSync(
  resolve(root, releaseCandidatePath),
  `Performance release candidate bound to ${sourceGitSha}\n`,
);
const directEvidencePaths = [releaseCandidatePath, evidencePath];
const ledger = buildGovernedEvidenceLedger({
  sourceGitSha,
  releaseCandidateDir,
  publicationPolicy: captureGovernedPublicationPolicy(root, sourceGitSha),
  entries: directEvidencePaths.map((path) => ({
    role: governedEvidenceRoleForPath(path, releaseCandidateDir),
    path,
    sha256: sha256(readFileSync(resolve(root, path))),
  })),
});
const ledgerPath = governedEvidenceLedgerPath(releaseCandidateDir);
writeFileSync(resolve(root, ledgerPath), renderGovernedEvidenceLedger(ledger));
git(root, ['add', 'docs/phase-5/evidence/performance', releaseCandidateDir]);
git(root, ['commit', '-m', 'Performance evidence E']);

const unsupportedDevice = validEvidence();
unsupportedDevice.devices.ios.logicalWidth = 320;

const unexpectedAndroidMeasurement = validEvidence();
unexpectedAndroidMeasurement.measurements.push({
  ...structuredClone(unexpectedAndroidMeasurement.measurements[0]),
  platform: 'android',
});

const postHocThreshold = validEvidence();
postHocThreshold.thresholdsDefinedAt = '2026-07-09T18:00:00.000Z';

const missingMeasurement = validEvidence();
missingMeasurement.measurements = missingMeasurement.measurements.slice(1);

const failedThreshold = validEvidence();
failedThreshold.measurements[0].samples = [500, 600, 700, 2100, 2500];
Object.assign(
  failedThreshold.measurements[0],
  summarizePerformanceSamples(failedThreshold.measurements[0].samples),
);

const smallSample = validEvidence();
smallSample.measurements[0].samples = [500];
Object.assign(
  smallSample.measurements[0],
  summarizePerformanceSamples(smallSample.measurements[0].samples),
);

const falsifiedSummary = validEvidence();
falsifiedSummary.measurements[0].p95 = 500;

const invalidRawSample = validEvidence();
invalidRawSample.measurements[0].samples[2] = 0;

const unsummarizedEvidence = validEvidence();
for (const measurement of unsummarizedEvidence.measurements) {
  measurement.sampleCount = null;
  measurement.p50 = null;
  measurement.p95 = null;
  measurement.max = null;
}

const template = createPerformanceEvidenceTemplate();
assert.equal(template.schemaVersion, 4);
assert.equal(Object.hasOwn(template.thresholds, 'native_ocr_recognition_ms'), true);
assert.equal(
  template.measurements.some(
    (measurement) =>
      measurement.platform === 'ios' && measurement.metric === 'native_ocr_recognition_ms',
  ),
  true,
);
assert.equal(template.platformStatus.ios, 'required');
assert.equal(template.platformStatus.android, 'not_applicable');
assert.equal(Object.hasOwn(template.devices, 'android'), false);
assert.equal(
  template.measurements.every((measurement) => measurement.platform === 'ios'),
  true,
);

const cases = [
  {
    name: 'accepts complete supported-device evidence with predeclared thresholds',
    result: run(validEvidence()),
    test: (result) => result.status === 0 && /performance evidence passed/i.test(output(result)),
  },
  {
    name: 'keeps missing evidence non-blocking outside strict mode',
    result: run(null, { strict: false, omitPath: true }),
    test: (result) => result.status === 0 && /remains externally blocked/i.test(output(result)),
  },
  {
    name: 'rejects missing evidence in strict mode',
    result: run(null, { omitPath: true }),
    test: (result) =>
      result.status === 1 && /Missing PHASE5_PERFORMANCE_EVIDENCE_PATH/.test(output(result)),
  },
  {
    name: 'rejects arbitrary absolute evidence paths',
    result: run(null, { path: 'C:/tmp/performance-evidence.json' }),
    test: (result) =>
      result.status === 1 && /normalized repo-relative JSON path/.test(output(result)),
  },
  {
    name: 'requires the explicit release-candidate selector for governed evidence',
    result: run(validEvidence(), { extraEnv: { PHASE9_RELEASE_CANDIDATE_DIR: '' } }),
    test: (result) =>
      result.status === 1 && /PHASE9_RELEASE_CANDIDATE_DIR is required/.test(output(result)),
  },
  {
    name: 'rejects devices below the accepted layout support floor',
    result: run(unsupportedDevice),
    test: (result) =>
      result.status === 1 && /logicalWidth must be at least 375/.test(output(result)),
  },
  {
    name: 'rejects Android measurements instead of accepting fake release evidence',
    result: run(unexpectedAndroidMeasurement),
    test: (result) =>
      result.status === 1 && /must be a required release platform \(ios\)/.test(output(result)),
  },
  {
    name: 'rejects thresholds defined after measurements',
    result: run(postHocThreshold),
    test: (result) => result.status === 1 && /post-hoc targets are rejected/.test(output(result)),
  },
  {
    name: 'rejects missing platform and metric coverage',
    result: run(missingMeasurement),
    test: (result) =>
      result.status === 1 && /Missing measurement for ios:app_startup_cold_ms/.test(output(result)),
  },
  {
    name: 'calculates threshold failure instead of trusting the signoff field',
    result: run(failedThreshold),
    test: (result) => result.status === 1 && /exceeds the approved/.test(output(result)),
  },
  {
    name: 'rejects one-off timing samples',
    result: run(smallSample),
    test: (result) =>
      result.status === 1 &&
      /samples must contain at least 5 raw observations/.test(output(result)),
  },
  {
    name: 'rejects declared percentiles that do not match raw samples',
    result: run(falsifiedSummary),
    test: (result) =>
      result.status === 1 && /p95 must equal the calculated p95/.test(output(result)),
  },
  {
    name: 'rejects zero or invalid raw observations',
    result: run(invalidRawSample),
    test: (result) =>
      result.status === 1 && /samples\[2\] must be a positive number/.test(output(result)),
  },
  {
    name: 'writes deterministic summaries from complete raw observations',
    result: run(unsummarizedEvidence, { strict: false, summarize: true }),
    test: (result) =>
      result.status === 0 &&
      result.summarizedEvidence?.measurements.every(
        (measurement) =>
          measurement.sampleCount === 5 &&
          measurement.p50 === 500 &&
          measurement.p95 === 1000 &&
          measurement.max === 1000,
      ),
  },
  {
    name: 'refuses to summarize incomplete raw observations',
    result: run(smallSample, { strict: false, summarize: true }),
    test: (result) =>
      result.status === 1 && /at least 5 positive raw observations/.test(output(result)),
  },
  {
    name: 'accepts Phase 7 and final readiness descendants from the central allowlist',
    result: runWithFinalGeneratedTail(),
    test: (result) => result.status === 0 && /Governed evidence chain: pass/.test(output(result)),
  },
];

let failed = false;
for (const testCase of cases) {
  const passed = testCase.test(testCase.result);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${testCase.name}`);
  if (!passed) {
    failed = true;
    console.error(output(testCase.result));
  }
}

rmSync(root, { recursive: true, force: true });
if (failed) process.exit(1);
