#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { createPerformanceEvidenceTemplate } from './performance-evidence-contract.mjs';

const root = resolve(import.meta.dirname, '..', '..');
const checker = resolve(import.meta.dirname, 'check-performance-evidence.mjs');
const tempDir = mkdtempSync(join(tmpdir(), 'routinekind-performance-evidence-'));
const evidencePath = join(tempDir, 'performance-evidence.json');

function validEvidence() {
  const evidence = createPerformanceEvidenceTemplate();
  evidence.capturedAt = '2026-07-09T16:00:00.000Z';
  evidence.gitSha = '1234567890abcdef1234567890abcdef12345678';
  evidence.thresholdsDefinedAt = '2026-07-09T12:00:00.000Z';
  evidence.thresholdsDefinedBy = 'Performance Owner';
  evidence.devices.ios.buildId = '9f7b48e1-7a52-4efb-9d93-3e93a2bf13e5';
  evidence.devices.ios.deviceModel = 'iPhone 15 Pro';
  evidence.devices.ios.osVersion = 'iOS 18.5';
  evidence.devices.android.buildId =
    'https://expo.dev/accounts/routinekind/projects/mobile/builds/7a4d74ae-2acd-4af5-931f-b768565bcd64';
  evidence.devices.android.deviceModel = 'Pixel 8';
  evidence.devices.android.osVersion = 'Android 15';
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
    measurement.sampleCount = 5;
    measurement.p50 = 500;
    measurement.p95 = 900;
    measurement.max = 1000;
  }
  evidence.signoff.decision = 'pass';
  evidence.signoff.signedOffBy = 'Performance Reviewer';
  evidence.signoff.signedAt = '2026-07-09T17:00:00.000Z';
  return evidence;
}

function run(evidence, { strict = true, omitPath = false } = {}) {
  if (evidence) writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return spawnSync(process.execPath, [checker, ...(strict ? ['--strict'] : [])], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PHASE5_PERFORMANCE_EVIDENCE_PATH: omitPath ? '' : evidencePath,
    },
  });
}

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

const unsupportedDevice = validEvidence();
unsupportedDevice.devices.android.logicalWidth = 320;

const postHocThreshold = validEvidence();
postHocThreshold.thresholdsDefinedAt = '2026-07-09T18:00:00.000Z';

const missingMeasurement = validEvidence();
missingMeasurement.measurements = missingMeasurement.measurements.slice(1);

const failedThreshold = validEvidence();
failedThreshold.measurements[0].p95 = 2500;
failedThreshold.measurements[0].max = 2600;

const smallSample = validEvidence();
smallSample.measurements[0].sampleCount = 1;

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
    name: 'rejects devices below the accepted layout support floor',
    result: run(unsupportedDevice),
    test: (result) =>
      result.status === 1 && /logicalWidth must be at least 360/.test(output(result)),
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
    test: (result) => result.status === 1 && /sampleCount must be at least 5/.test(output(result)),
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

rmSync(tempDir, { recursive: true, force: true });
if (failed) process.exit(1);
