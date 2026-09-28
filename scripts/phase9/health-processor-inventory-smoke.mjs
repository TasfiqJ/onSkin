#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const inventoryPath = 'docs/hugeToDo/health-processor-inventory-v1.json';
const matrixPath =
  'docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md';
const migrationPath = 'supabase/migrations/20260715000054_health_consent_withdrawal_lifecycle.sql';

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

let inventory;
try {
  inventory = JSON.parse(read(inventoryPath));
} catch (error) {
  fail(
    `${inventoryPath} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (inventory) {
  if (inventory.schemaVersion !== 1) fail('health processor schemaVersion must remain 1.');
  if (inventory.inventoryVersion !== 'health-processors-v1') {
    fail('health processor inventoryVersion must match migration 0054.');
  }
  if (inventory.status !== 'source-candidate-not-production-cleared') {
    fail('inventory must not claim production or legal clearance.');
  }
  if (
    inventory.hashContract?.field !== 'separatelyReconciledExternalHealthProcessors' ||
    inventory.hashContract?.canonicalEncoding !== 'JSON.stringify(value)'
  ) {
    fail('inventory must preserve the explicit external-processor hash contract.');
  }

  const external = inventory.separatelyReconciledExternalHealthProcessors;
  if (!Array.isArray(external)) {
    fail('separatelyReconciledExternalHealthProcessors must be an array.');
  } else {
    const canonical = JSON.stringify(external);
    const digest = createHash('sha256').update(canonical).digest('hex');
    if (canonical !== '[]') {
      fail(
        'health-processors-v1 is the empty separately reconciled provider list; issue a new version before adding a provider.',
      );
    }
    if (digest !== inventory.hashContract?.sha256) {
      fail(
        `processor inventory digest drifted: expected ${inventory.hashContract?.sha256}, got ${digest}.`,
      );
    }
  }

  const primary = inventory.primaryInfrastructureProcessors ?? [];
  if (
    primary.length !== 1 ||
    primary[0]?.id !== 'supabase' ||
    primary[0]?.mayProcessHealthPurposeData !== true ||
    !primary[0]?.purpose?.includes('stable product identity/tombstone') ||
    !primary[0]?.purpose?.includes('minimized sync replay receipts') ||
    !primary[0]?.withdrawalLane?.includes('database-cleanup') ||
    !primary[0]?.withdrawalLane?.includes('Storage') ||
    !primary[0]?.withdrawalLane?.includes('both minimized replay ledgers') ||
    !primary[0]?.withdrawalLane?.includes('Account deletion')
  ) {
    fail(
      'Supabase must remain explicitly classified as the primary health-data infrastructure processor.',
    );
  }

  const excludedIds = (inventory.purposeExcludedOrUnconfiguredProviders ?? []).map(
    (provider) => provider.id,
  );
  if (new Set(excludedIds).size !== excludedIds.length) {
    fail('purposeExcludedOrUnconfiguredProviders contains a duplicate provider ID.');
  }
  for (const required of ['posthog', 'sentry', 'revenuecat', 'apple', 'google']) {
    if (!excludedIds.includes(required)) fail(`provider classification is missing ${required}.`);
  }
  const openBeautyFacts = (inventory.purposeExcludedOrUnconfiguredProviders ?? []).find(
    (provider) => provider.id === 'open_beauty_facts',
  );
  if (
    !openBeautyFacts ||
    !/request-time lookup.*disabled/i.test(openBeautyFacts.reason ?? '') ||
    !/offline artifacts/i.test(openBeautyFacts.reason ?? '')
  ) {
    fail(
      'Open Beauty Facts must be classified as offline-artifact-only with request-time lookup disabled.',
    );
  }
}

const migration = read(migrationPath);
const expectedVersion = inventory?.inventoryVersion ?? 'health-processors-v1';
const expectedDigest = inventory?.hashContract?.sha256 ?? '';
if (!migration.includes(`processor_inventory_version text not null default '${expectedVersion}'`)) {
  fail('migration 0054 does not bind withdrawal operations to the inventory version.');
}
if (!expectedDigest || !migration.includes(`default '${expectedDigest}'`)) {
  fail('migration 0054 does not bind withdrawal operations to the inventory digest.');
}
if (!migration.includes("result_code = 'PROCESSOR_INVENTORY_RECONCILED'")) {
  fail('migration 0054 lost its typed processor-inventory reconciliation result.');
}

const matrix = read(matrixPath);
for (const required of [
  inventoryPath.split('/').at(-1),
  expectedVersion,
  expectedDigest,
  'Supabase',
  'PostHog',
  'Sentry',
  'RevenueCat',
  'Apple App Review Guidelines',
  'RCW 19.373.040',
  'Nevada NRS Chapter 603A',
  'Connecticut Chapter 743jj',
  'California Civil Code sections 56.05-56.06',
  'GDPR Article 7(3)',
  'FTC HBNR',
  'Open Beauty Facts network transport',
  'P0 inventory mismatch',
  'launch-blocked',
]) {
  if (!matrix.includes(required))
    fail(`${matrixPath} is missing required evidence text: ${required}.`);
}

const catalogLookup = read('supabase/functions/catalog-lookup/index.ts');
for (const forbidden of [
  'fetchOpenBeautyFacts',
  'fetchWithTimeout',
  'world.openbeautyfacts.org',
  'OBF_API_ENABLED',
  'OBF_USER_AGENT',
  'external_candidate',
]) {
  if (catalogLookup.includes(forbidden)) {
    fail(`catalog-lookup contains retired live Open Beauty Facts surface: ${forbidden}.`);
  }
}
if (!catalogLookup.includes("return json({ result: 'no_match', manualFallback: true });")) {
  fail('catalog-lookup must preserve manual fallback when the reviewed local catalog misses.');
}

const edgeManifest = JSON.parse(read('supabase/functions/manifest.json'));
const lookupManifest = edgeManifest.functions?.['catalog-lookup'];
const serializedLookupManifest = JSON.stringify(lookupManifest);
if (
  /OBF_API_ENABLED|OBF_USER_AGENT|EDGE_EXTERNAL_(?:FETCH|RESPONSE)/.test(serializedLookupManifest)
) {
  fail('catalog-lookup manifest must not declare retired external lookup configuration.');
}

const envExample = read('.env.example');
if (/^OBF_(?:API_ENABLED|USER_AGENT)=/m.test(envExample)) {
  fail('.env.example must not advertise retired live Open Beauty Facts lookup configuration.');
}

for (const offlineArtifactPath of [
  'apps/mobile/src/features/catalog/obf.ts',
  'scripts/phase4/import-obf-snapshot.mjs',
]) {
  const offlineArtifactSource = read(offlineArtifactPath);
  if (/\bfetch\s*\(|fetchWithTimeout|axios\s*\.|\bky\s*\(/.test(offlineArtifactSource)) {
    fail(`${offlineArtifactPath} must remain an offline artifact transformer with no transport.`);
  }
}

const analyticsSource = read('apps/mobile/src/lib/analytics/track.ts');
if (!analyticsSource.includes('Direct mobile vendor capture is intentionally disabled')) {
  fail('analytics source no longer declares direct vendor capture disabled.');
}
if (analyticsSource.includes('.capture(')) {
  fail(
    'analytics source now contains direct vendor capture; reclassify PostHog and version the inventory.',
  );
}

const sentrySource = read('apps/mobile/src/lib/observability/sentry.ts');
for (const required of [
  'sendDefaultPii: false',
  'attachScreenshot: false',
  'attachViewHierarchy: false',
  'user: undefined',
  'beforeSend: sanitizeSentryEvent',
]) {
  if (!sentrySource.includes(required)) {
    fail(`Sentry source contract is missing ${required}; re-review processor classification.`);
  }
}

if (!process.exitCode) {
  console.log(
    `PASS ${expectedVersion} ${expectedDigest} matches the empty separate-provider list; Supabase remains explicitly classified in the in-line database/Storage lanes.`,
  );
}
