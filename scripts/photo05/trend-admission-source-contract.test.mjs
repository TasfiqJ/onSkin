#!/usr/bin/env node

import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  auditPhoto05aTrendSourceSnapshot,
  loadPhoto05aTrendSourceSnapshot,
  PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS,
  PHOTO05A_TREND_SOURCE_PATHS,
} from './trend-admission-source-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function mutate(snapshot, path, transform) {
  const before = snapshot[path];
  assert.equal(typeof before, 'string', `${path} must exist in the real snapshot`);
  const after = transform(before);
  assert.notEqual(after, before, `adversarial mutation must change ${path}`);
  return Object.freeze({ ...snapshot, [path]: after });
}

function replaceRequired(source, searchValue, replacement) {
  assert.ok(source.includes(searchValue), `fixture source is missing ${searchValue}`);
  return source.replace(searchValue, replacement);
}

function assertRejected(snapshot, pattern) {
  const errors = auditPhoto05aTrendSourceSnapshot(snapshot);
  assert.ok(
    errors.some((error) => pattern.test(error)),
    `expected PHOTO-05A rejection matching ${pattern}; received:\n${errors.join('\n')}`,
  );
}

test('real PHOTO-05A sources enforce immutable literal-zero Trend admission', () => {
  assert.deepEqual(auditPhoto05aTrendSourceSnapshot(loadPhoto05aTrendSourceSnapshot(root)), []);
});

test('the audit is deterministic, frozen, path-sorted, and inventory-complete', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  const first = auditPhoto05aTrendSourceSnapshot(snapshot);
  const second = auditPhoto05aTrendSourceSnapshot(Object.freeze({ ...snapshot }));
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.deepEqual(first, [...first].sort());
  for (const path of PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS) {
    assert.equal(typeof snapshot[path], 'string', `${path} must be inventoried`);
  }
});

test('missing checkpoint, runtime, contract, type, and database authority sources fail closed', () => {
  const snapshot = { ...loadPhoto05aTrendSourceSnapshot(root) };
  for (const path of [
    PHOTO05A_TREND_SOURCE_PATHS.checkpoint,
    PHOTO05A_TREND_SOURCE_PATHS.useTrend,
    PHOTO05A_TREND_SOURCE_PATHS.launchContract,
    PHOTO05A_TREND_SOURCE_PATHS.publicTypes,
    PHOTO05A_TREND_SOURCE_PATHS.photoTrendMigration,
  ]) {
    delete snapshot[path];
  }
  const errors = auditPhoto05aTrendSourceSnapshot(Object.freeze(snapshot));
  assert.equal(errors.length, 5);
  assert.ok(errors.every((error) => /required PHOTO-05A authority source is missing/u.test(error)));
});

test('capability and surface flags cannot be opened or made environment-driven', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.phase7, (source) =>
      replaceRequired(source, 'trendEngine: false', 'trendEngine: true'),
    ),
    /trendEngine must remain the literal false/u,
  );
  assertRejected(
    mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.phase7, (source) =>
      replaceRequired(source, 'trend: false', 'trend: true'),
    ),
    /phase7Flags\.trend must remain the literal false/u,
  );
  assertRejected(
    mutate(
      snapshot,
      PHOTO05A_TREND_SOURCE_PATHS.phase7,
      (source) => `${source}\nconst trendOverride = env.phase7TrendEnabled;\n`,
    ),
    /must not depend on an environment flag/u,
  );
});

test('every machine admission field is immutable false and extra keys are rejected', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  const contract = JSON.parse(snapshot[PHOTO05A_TREND_SOURCE_PATHS.launchContract]);
  for (const key of Object.keys(contract.trendInsightAdmission)) {
    const forged = structuredClone(contract);
    forged.trendInsightAdmission[key] = true;
    assertRejected(
      Object.freeze({
        ...snapshot,
        [PHOTO05A_TREND_SOURCE_PATHS.launchContract]: `${JSON.stringify(forged, null, 2)}\n`,
      }),
      /exact literal-zero PHOTO-05A machine contract/u,
    );
  }
  const extra = structuredClone(contract);
  extra.trendInsightAdmission.fixtureOverride = false;
  assertRejected(
    Object.freeze({
      ...snapshot,
      [PHOTO05A_TREND_SOURCE_PATHS.launchContract]: `${JSON.stringify(extra, null, 2)}\n`,
    }),
    /exact literal-zero PHOTO-05A machine contract/u,
  );
  assertRejected(
    Object.freeze({
      ...snapshot,
      [PHOTO05A_TREND_SOURCE_PATHS.launchContract]: '{"trendInsightAdmission":',
    }),
    /launch contract must be valid JSON/u,
  );
});

test('simulated delta, lighting, MDC, fairness, score, age, percentage, and redness output paths are rejected', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  for (const unsafe of [
    'const deltaMetric = 0.05;',
    'const lightingConsistent = true;',
    'const mdcThreshold = toneAdjustedMdc(3);',
    'const skinScore = 92;',
    'const skinAge = 21;',
    'const percentageImprovement = 15;',
    'const rednessMetric = 0.4;',
  ]) {
    assertRejected(
      mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.useTrend, (source) => `${source}\n${unsafe}\n`),
      /must not evaluate simulated metrics, MDC, fairness, scores, percentages, or redness/u,
    );
  }
});

test('isolated receipt primitives cannot add network, server writes, content telemetry, or fabricated thresholds', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  for (const unsafe of [
    "fetch('/trend')",
    "supabase.from('server_rows').insert({})",
    "track('trend_result', { state: 'consistent' })",
    'const DEFAULT_MDC_THRESHOLD = 0.12;',
  ]) {
    assertRejected(
      mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.receipt, (source) => `${source}\n${unsafe}\n`),
      /isolated Trend prerequisite must not contain|must not define a fabricated threshold/u,
    );
  }
});

test('disabled routes cannot load or invoke a dynamically required positive receipt factory', () => {
  let snapshot = loadPhoto05aTrendSourceSnapshot(root);
  snapshot = mutate(
    snapshot,
    PHOTO05A_TREND_SOURCE_PATHS.receipt,
    (source) => `${source}\nexport function issuePositiveResult() { return { kind: 'issued' }; }\n`,
  );
  snapshot = mutate(
    snapshot,
    PHOTO05A_TREND_SOURCE_PATHS.trendLayout,
    (source) => `${source}\nrequire('../../features/trend/receipt').issuePositiveResult();\n`,
  );
  assertRejected(
    snapshot,
    /reviewed prerequisite runtime surface|banned runtime identifier require|must not dynamically load/u,
  );
});

test('ordinary production surfaces cannot hide a Trend import behind a computed module specifier', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      PHOTO05A_TREND_SOURCE_PATHS.you,
      (source) =>
        `${source}\nconst trendModule = '@/features/' + 'trend/receipt'; void require(trendModule).sealTrendResultReceiptV1;\n`,
    ),
    /must not use an unresolved dynamic module specifier/u,
  );
});

test('ordinary production surfaces cannot re-export the disabled Trend receipt runtime', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  for (const declaration of [
    "export { sealTrendResultReceiptV1 } from '@/features/trend/receipt';",
    "export * from '@/features/trend/receipt';",
  ]) {
    assertRejected(
      mutate(snapshot, 'apps/mobile/src/app/index.tsx', (source) => `${source}\n${declaration}\n`),
      /must not import disabled Trend runtime module/u,
    );
  }
});

test('ordinary production surfaces cannot alias CommonJS or executable runtime loaders', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  for (const sourceLine of [
    "const loadTrendRuntime = require; void loadTrendRuntime('@/features/trend/receipt').sealTrendResultReceiptV1;",
    "const loadTrendRuntime = module.require; void loadTrendRuntime('@/features/trend/receipt').sealTrendResultReceiptV1;",
    'eval("require(\'@/features/trend/receipt\')");',
    'Function("return require(\'@/features/trend/receipt\')")();',
  ]) {
    assertRejected(
      mutate(snapshot, 'apps/mobile/src/app/index.tsx', (source) => `${source}\n${sourceLine}\n`),
      /must not expose an ungoverned runtime loader/u,
    );
  }
});

test('photo, profile, consent, classifier, query, network, analytics, and storage side effects are rejected', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  for (const unsafe of [
    "import { usePhotos } from '@/features/photos/usePhotos';",
    "import { supabase } from '@/lib/supabase/client';",
    "import { track } from '@/lib/analytics/track';",
    "import { classifyChange } from './trend';",
  ]) {
    assertRejected(
      mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.useTrend, (source) => `${unsafe}\n${source}`),
      /must not import photos, consent, profile, network, classifier, narrative, or hook dependencies/u,
    );
  }
  assertRejected(
    mutate(
      snapshot,
      PHOTO05A_TREND_SOURCE_PATHS.trendInsight,
      (source) => `${source}\nasync function unsafe() { await fetch('/trend'); }\n`,
    ),
    /banned runtime identifier fetch/u,
  );
});

test('caller, fixture, legacy, E2E, and development bypasses are rejected', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  for (const unsafe of [
    'const unsafe = __DEV__;',
    "const unsafe = process.env.EXPO_PUBLIC_E2E_TREND === 'true';",
    'const trendCallerOverride = true;',
    'const trendFixture = true;',
    'const trendLegacy = true;',
  ]) {
    assertRejected(
      mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.useTrend, (source) => `${source}\n${unsafe}\n`),
      /environment, development, E2E, fixture, legacy, or caller bypasses/u,
    );
  }
  assertRejected(
    mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.trendInsight, (source) =>
      replaceRequired(source, 'return null;', 'return _props.source ? <></> : null;'),
    ),
    /must return only null|must not inspect caller-supplied source or props/u,
  );
  assertRejected(
    mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.useTrend, (source) =>
      replaceRequired(
        source,
        'export async function readMonkBand(): Promise<number | null> {',
        'export async function readMonkBand(source: { read(): void }): Promise<number | null> { source.read();',
      ),
    ),
    /must accept no caller input|must not call a caller object/u,
  );
});

test('positive consent grants and enabled consent-choice delegation are rejected', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.consent, (source) =>
      source.replace(
        'throw new Error(TREND_ENGINE_UNAVAILABLE);',
        "await grantHealthDependentConsent('photo_trend_insights');",
      ),
    ),
    /positive consent admission|must throw TREND_ENGINE_UNAVAILABLE/u,
  );
  assertRejected(
    mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.applyConsentChoice, (source) =>
      replaceRequired(source, 'if (enabled) return false;', 'if (enabled) await deps.grant();'),
    ),
    /positive consent choice must fail closed/u,
  );
  assertRejected(
    mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.consent, (source) =>
      replaceRequired(source, "'trend_consent_revoked'", "'skin_condition_change_observed'"),
    ),
    /only the non-content withdrawal lifecycle event/u,
  );
});

test('direct route analytics and hidden enabled fairness or consent branches are rejected', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, PHOTO05A_TREND_SOURCE_PATHS.trendOptIn, (source) =>
      replaceRequired(source, 'trackView={false}', 'trackView={true}'),
    ),
    /must suppress view analytics/u,
  );
  assertRejected(
    mutate(
      snapshot,
      PHOTO05A_TREND_SOURCE_PATHS.trendFairness,
      (source) => `${source}\nfunction EnabledFairness() { return null; }\n`,
    ),
    /must not retain an enabled, fairness, metric, or consent branch/u,
  );
  assertRejected(
    mutate(
      snapshot,
      PHOTO05A_TREND_SOURCE_PATHS.trendLayout,
      (source) =>
        `import { phase7Flags } from '@/lib/launch/phase7';\n${source}\nvoid phase7Flags.trend;\n`,
    ),
    /must not retain a flag, caller, or matched-child admission branch/u,
  );
});

test('Progress and any future production consumer cannot import disabled Trend runtime code', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      PHOTO05A_TREND_SOURCE_PATHS.progress,
      (source) => `import { TrendInsight } from '@/features/trend/TrendInsight';\n${source}`,
    ),
    /Progress must not mount|production surface must not import disabled Trend runtime module/u,
  );
});

test('package verification wiring cannot omit PHOTO-05A from launch, Phase 7, or Phase 9', () => {
  const snapshot = loadPhoto05aTrendSourceSnapshot(root);
  const packageJson = JSON.parse(snapshot[PHOTO05A_TREND_SOURCE_PATHS.packageJson]);
  delete packageJson.scripts['photo05:trend-admission-source-contract:test'];
  assertRejected(
    Object.freeze({
      ...snapshot,
      [PHOTO05A_TREND_SOURCE_PATHS.packageJson]: `${JSON.stringify(packageJson, null, 2)}\n`,
    }),
    /PHOTO-05A adversarial contract command must be exact/u,
  );
});
