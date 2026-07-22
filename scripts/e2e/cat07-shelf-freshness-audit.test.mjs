import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CAT07_AUDIT_LIMITATIONS,
  CAT07_EVIDENCE_RELATIVE_DIR,
  CAT07_REQUIRED_VIEWPORTS,
  CAT07_VERIFIED_OUTCOMES,
  assertCat07SourceProvenance,
  assertCat07SourceSafetyContract,
  collectCat07UndeclaredDirtyPaths,
  validateCat07AuditConfiguration,
} from './cat07-shelf-freshness-audit.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const runnerPath = fileURLToPath(new URL('./cat07-shelf-freshness-audit.mjs', import.meta.url));
const cat04RunnerPath = fileURLToPath(
  new URL('./cat04-catalog-recovery-audit.mjs', import.meta.url),
);
const packagePath = path.join(repoRoot, 'package.json');
const runnerSource = readFileSync(runnerPath, 'utf8');
const cat04RunnerSource = readFileSync(cat04RunnerPath, 'utf8');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

test('CAT07 audit covers every supported iPhone-class Expo-web viewport', () => {
  const configuration = validateCat07AuditConfiguration();
  assert.deepEqual(
    CAT07_REQUIRED_VIEWPORTS.map(({ width, height }) => `${width}x${height}`),
    ['375x667', '390x844', '430x932'],
  );
  assert.equal(configuration.viewportCount, 3);
  assert.equal(configuration.executionCount, 3);
  assert.equal(CAT07_VERIFIED_OUTCOMES.length, 10);
  assert.equal(CAT07_AUDIT_LIMITATIONS.length >= 4, true);
  assert.equal(
    CAT07_AUDIT_LIMITATIONS.every((limitation) => typeof limitation === 'string'),
    true,
  );
  assert.match(CAT07_EVIDENCE_RELATIVE_DIR, /2026-07-22\/cat07-shelf-freshness-current$/u);
});

test('CAT07 source contract rejects missing fail-closed freshness boundaries', () => {
  const valid = {
    catalogClient:
      `const PRODUCT_SPECIFIC_PAO_SOURCES = new Set(); ` +
      `if (productSpecific.length !== 1) return { months: null, source: 'unknown' }; expiryDate: null;`,
    detailRoute:
      'Older data is not tied to this exact package and is not used for freshness reminders.',
    freshness:
      `const PAO_SOURCES = new Set(['category_default']); ` +
      `candidatePaoSource === 'category_default'; ` +
      `if (computed.source === 'unknown') return 'unknown';`,
    openedRoute: `const canSave = mode != null; if (mode === 'unopened') return; 'Choose the state that matches this package';`,
    replenishRoute:
      'New unit is unopened. No PAO clock; add a printed date from the pack later. No urgency is added.',
    shelfRoute: `i.badge.kind === 'countdown' || i.badge.kind === 'expired'; 'Nothing needs replacing right now';`,
    store: `const replacementId = operationId; expiryDate: null; legacyUnverifiedExpiryDate: null; replacesProductId: prev.id;`,
  };

  assert.equal(assertCat07SourceSafetyContract(valid), true);
  for (const key of Object.keys(valid)) {
    assert.throws(
      () => assertCat07SourceSafetyContract({ ...valid, [key]: '' }),
      /CAT07/u,
      `Missing ${key} contract should fail.`,
    );
  }
});

test('current CAT07 source satisfies its exact static safety contract', () => {
  assert.equal(assertCat07SourceSafetyContract(), true);
});

test('CAT07 provenance permits only its evidence folder and scratch output', () => {
  const allowed = [
    ' M test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current/summary.json',
    '?? test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current/new.png',
    '?? .tmp/cat07/browser-profile/file',
  ];
  assert.deepEqual(collectCat07UndeclaredDirtyPaths(allowed), []);
  assert.deepEqual(
    collectCat07UndeclaredDirtyPaths([
      ...allowed,
      ' M apps/mobile/src/features/shelf/store.ts',
      '?? scripts/e2e/uncommitted-runner.mjs',
    ]),
    ['apps/mobile/src/features/shelf/store.ts', 'scripts/e2e/uncommitted-runner.mjs'],
  );
});

test('CAT07 provenance binds a requested full SHA to HEAD', () => {
  const actual = assertCat07SourceProvenance({ statusText: '' });
  assert.match(actual, /^[0-9a-f]{40}$/u);
  assert.equal(
    assertCat07SourceProvenance({
      expectedSourceGitSha: actual,
      statusText: '',
    }),
    actual,
  );
  assert.throws(
    () =>
      assertCat07SourceProvenance({
        expectedSourceGitSha: '0'.repeat(40),
        statusText: '',
      }),
    /expected source/u,
  );
  assert.throws(
    () =>
      assertCat07SourceProvenance({
        expectedSourceGitSha: 'not-a-sha',
        statusText: '',
      }),
    /40-character Git SHA/u,
  );
});

test('CAT07 runner drives the full truthful replacement lifecycle', () => {
  for (const required of [
    "fillByLabel(client, 'Exact opened date', localDatePlusDays(1))",
    "waitForText(client, 'Enter a real date no later than today')",
    "clickByText(client, '12 mo')",
    "fillByLabel(client, 'Exact package date', localDatePlusDays(7))",
    "'I opened a new unit today'",
    "'New unit was opened earlier'",
    "'New unit is unopened'",
    "assertDisabledControl(futureReplacement, 'Save replacement with this date')",
    'originalDetailPath !== replacementDetailPath',
    "clickByText(client, 'Expiring')",
    "waitForText(client, 'Nothing needs replacing right now.')",
    'archivedDetailPath === originalDetailPath',
  ]) {
    assert.ok(runnerSource.includes(required), `Missing CAT07 interaction: ${required}`);
  }
  assert.match(runnerSource, /nativeDeviceProof:\s*false/gu);
  assert.doesNotMatch(runnerSource, /nativeDeviceProof:\s*true/gu);
});

test('CAT07 audit inherits the stable local-only browser and consent harness', () => {
  for (const exportedHelper of [
    'export function startBrowser',
    'export async function connectToPage',
    'export async function establishLocalHealthConsent',
    'export async function captureStep',
    'export async function navigate',
  ]) {
    assert.match(cat04RunnerSource, new RegExp(exportedHelper.replaceAll(' ', '\\s+'), 'u'));
  }
  assert.match(cat04RunnerSource, /--headless=old/u);
  assert.match(cat04RunnerSource, /--disable-gpu-sandbox/u);
  assert.match(cat04RunnerSource, /--in-process-gpu/u);
  assert.doesNotMatch(cat04RunnerSource, /--headless=new/u);
  assert.match(runnerSource, /classifyBrowserFailures\(client\.events\.slice\(eventStart\)/u);
  assert.match(runnerSource, /assertPacketHygiene\(evidenceDir, summary\.artifacts\)/u);
  assert.match(cat04RunnerSource, /EXPO_PUBLIC_SUPABASE_URL/u);
});

test('package scripts expose CAT07 audit and its contract suite', () => {
  assert.equal(
    packageJson.scripts['e2e:cat07-shelf-freshness'],
    'node scripts/e2e/cat07-shelf-freshness-audit.mjs',
  );
  assert.equal(
    packageJson.scripts['e2e:cat07-shelf-freshness:test'],
    'node --test scripts/e2e/cat07-shelf-freshness-audit.test.mjs',
  );
});
