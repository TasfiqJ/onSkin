#!/usr/bin/env node
import { block, evidenceFlagEnabled, printResult, read } from './lib.mjs';

const errors = [];
const warnings = [];

const evidenceGates = [
  {
    file: 'scripts/phase9/rls-adversarial.mjs',
    keys: ['PHASE9_RLS_STAGING_PASS', 'PHASE9_RLS_PRODUCTION_PASS'],
  },
  {
    file: 'scripts/phase9/edge-auth-smoke.mjs',
    keys: ['PHASE9_EDGE_AUTH_PASS'],
  },
  {
    file: 'scripts/phase9/data-rights-smoke.mjs',
    keys: ['PHASE9_DATA_EXPORT_DELETE_PASS'],
  },
  {
    file: 'scripts/phase9/consent-withdrawal-smoke.mjs',
    keys: ['PHASE9_CONSENT_WITHDRAWAL_PASS'],
  },
  {
    file: 'scripts/phase9/privacy-payload-audit.mjs',
    keys: ['PHASE9_OBSERVABILITY_PAYLOAD_PASS'],
  },
  {
    file: 'scripts/phase9/dependency-sbom.mjs',
    keys: ['PHASE9_DEPENDENCY_AUDIT_PASS'],
  },
  {
    file: 'scripts/phase9/store-build-inspect.mjs',
    keys: [
      'PHASE9_IOS_TESTFLIGHT_PASS',
      'PHASE9_ANDROID_CLOSED_TEST_PASS',
      'PHASE9_ANDROID_TARGET_API_PASS',
      'PHASE9_ANDROID_16KB_PASS',
      'PHASE9_IOS_PRIVACY_REPORT_PASS',
      'PHASE9_APP_STORE_PACKET_PASS',
      'PHASE9_PLAY_PACKET_PASS',
    ],
  },
  {
    file: 'scripts/phase10/beta-analytics-audit.mjs',
    keys: ['PHASE10_DASHBOARDS_PASS', 'PHASE10_PRIVACY_PAYLOAD_PASS'],
  },
];

const accessFor = (key) => String.raw`(?:process\.env|env)\.${key}`;

for (const { file, keys } of evidenceGates) {
  const source = read(file);
  block(
    errors,
    source.includes('evidenceFlagEnabled'),
    `${file} must import/use evidenceFlagEnabled for external evidence pass flags.`,
  );

  for (const key of keys) {
    const access = accessFor(key);
    block(
      errors,
      new RegExp(String.raw`evidenceFlagEnabled\(${access}\)`).test(source),
      `${file} must normalize ${key} with evidenceFlagEnabled.`,
    );
    block(
      errors,
      !new RegExp(String.raw`${access}\s*={2,3}\s*['"]true['"]`).test(source),
      `${file} must not raw-compare ${key} to true.`,
    );
    block(
      errors,
      !new RegExp(String.raw`['"]true['"]\s*={2,3}\s*${access}`).test(source),
      `${file} must not raw-compare true to ${key}.`,
    );
  }
}

for (const [value, expected] of [
  ['true', true],
  [' TRUE ', true],
  ['TrUe', true],
  ['false', false],
  ['1', false],
  ['', false],
  [undefined, false],
]) {
  block(
    errors,
    evidenceFlagEnabled(value) === expected,
    `evidenceFlagEnabled(${JSON.stringify(value)}) must be ${expected}.`,
  );
}

printResult('Phase 9/10 evidence normalization smoke', errors, warnings);
