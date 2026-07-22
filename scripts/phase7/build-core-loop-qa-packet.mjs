#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  command,
  evidenceFlagEnabled,
  gitStatusExcludingGeneratedEvidence,
  normalizeNamedSignoff,
} from '../phase9/lib.mjs';
import { launchContractSnapshot, loadLaunchContract } from '../launch/contract.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const launchContract = loadLaunchContract(root);
const packetOutDir = process.env.PHASE7_PACKET_OUT_DIR ?? 'docs/phase-7/generated';
const outDir = resolve(root, packetOutDir);
const packetOutputPaths = [
  `${packetOutDir}/core-loop-qa-packet.json`,
  `${packetOutDir}/core-loop-qa-packet.md`,
].map((path) => path.replace(/\\/g, '/'));

const requiredFiles = [
  'package.json',
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
  'apps/mobile/src/components/launch/DeferredSurface.tsx',
  'apps/mobile/src/components/launch/DeferredSurface.test.ts',
  'apps/mobile/src/lib/navigation/safeBack.ts',
  'apps/mobile/src/lib/navigation/safeBack.test.ts',
  'apps/mobile/src/app/(tabs)/today.tsx',
  'apps/mobile/src/app/(tabs)/progress.tsx',
  'apps/mobile/src/app/(tabs)/shelf.tsx',
  'apps/mobile/src/app/(tabs)/you.tsx',
  'apps/mobile/src/app/_layout.tsx',
  'apps/mobile/src/app/cycle/settings.tsx',
  'apps/mobile/src/app/cycle/week.tsx',
  'apps/mobile/src/app/cycle/why-tonight.tsx',
  'apps/mobile/src/app/onboarding/products.tsx',
  'apps/mobile/src/app/routine/plan.tsx',
  'apps/mobile/src/app/share/conflict/[ruleId].tsx',
  'apps/mobile/src/app/trend/_layout.tsx',
  'apps/mobile/src/app/trend/fairness.tsx',
  'apps/mobile/src/app/trend/optin.tsx',
  'apps/mobile/src/app/conflict/[ruleId].tsx',
  'apps/mobile/src/app/shelf/[id].tsx',
  'apps/mobile/src/app/shelf/_layout.tsx',
  'apps/mobile/src/app/shelf/add.tsx',
  'apps/mobile/src/app/shelf/archive.tsx',
  'apps/mobile/src/app/shelf/manual.tsx',
  'apps/mobile/src/app/shelf/no-match.tsx',
  'apps/mobile/src/app/shelf/ocr.tsx',
  'apps/mobile/src/app/shelf/opened.tsx',
  'apps/mobile/src/app/shelf/replenish.tsx',
  'apps/mobile/src/app/shelf/scan.tsx',
  'apps/mobile/src/app/shelf/search.tsx',
  'apps/mobile/src/features/ask/answer.ts',
  'apps/mobile/src/features/ask/answer.test.ts',
  'apps/mobile/src/features/ask/claimsafety.test.ts',
  'apps/mobile/src/features/ask/copy.ts',
  'apps/mobile/src/features/ask/useAsk.ts',
  'apps/mobile/src/features/catalog/client.ts',
  'apps/mobile/src/features/catalog/client.test.ts',
  'apps/mobile/src/features/commerce/WhereToBuy.tsx',
  'apps/mobile/src/features/intelligence/pao.ts',
  'apps/mobile/src/features/intelligence/pao.test.ts',
  'apps/mobile/src/features/notifications/BehaviouralTriggers.tsx',
  'apps/mobile/src/features/notifications/claimsafety.test.ts',
  'apps/mobile/src/features/notifications/copy.ts',
  'apps/mobile/src/features/notifications/store.ts',
  'apps/mobile/src/features/notifications/store.test.ts',
  'apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts',
  'apps/mobile/src/features/recommendations/claimsafety.test.ts',
  'apps/mobile/src/features/recommendations/copy.ts',
  'apps/mobile/src/features/recommendations/engine.ts',
  'apps/mobile/src/features/recommendations/engine.test.ts',
  'apps/mobile/src/features/recommendations/replenishment.ts',
  'apps/mobile/src/features/recommendations/replenishment.test.ts',
  'apps/mobile/src/features/recommendations/useRecommendations.ts',
  'apps/mobile/src/features/routine/activationAnalytics.ts',
  'apps/mobile/src/features/routine/activationAnalytics.test.ts',
  'apps/mobile/src/features/scheduler/cadence.ts',
  'apps/mobile/src/features/scheduler/customCycle.ts',
  'apps/mobile/src/features/scheduler/customCycle.test.ts',
  'apps/mobile/src/features/scheduler/cycleStore.ts',
  'apps/mobile/src/features/scheduler/cycleStore.test.ts',
  'apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts',
  'apps/mobile/src/features/scheduler/orchestrate.ts',
  'apps/mobile/src/features/scheduler/orchestrate.test.ts',
  'apps/mobile/src/features/scheduler/useCycle.ts',
  'apps/mobile/src/features/shelf/freshness.ts',
  'apps/mobile/src/features/shelf/freshness.test.ts',
  'apps/mobile/src/features/shelf/freshnessMigration.test.ts',
  'apps/mobile/src/features/shelf/paoProvenance.ts',
  'apps/mobile/src/features/shelf/paoProvenance.test.ts',
  'apps/mobile/src/features/shelf/shelfRoutes.test.ts',
  'apps/mobile/src/features/shelf/store.ts',
  'apps/mobile/src/features/shelf/store.test.ts',
  'apps/mobile/src/features/today/completionsStore.ts',
  'apps/mobile/src/features/today/completionsStore.test.ts',
  'apps/mobile/src/features/today/cycleCompletion.ts',
  'apps/mobile/src/features/today/cycleCompletion.test.ts',
  'apps/mobile/src/features/today/routineProjection.ts',
  'apps/mobile/src/features/today/routineProjection.test.ts',
  'apps/mobile/src/features/today/todayRoute.test.ts',
  'apps/mobile/src/features/trend/copy.ts',
  'apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts',
  'apps/mobile/src/features/trend/trendRoutes.test.ts',
  'apps/mobile/src/features/trend/useTrend.ts',
  'supabase/functions/catalog-lookup/index.ts',
  'supabase/functions/catalog-lookup/catalogContract.ts',
  'supabase/functions/catalog-lookup/catalogContract.test.ts',
  'supabase/functions/catalog-search/index.ts',
  'supabase/functions/catalog-search/catalogContract.ts',
  'supabase/functions/catalog-search/catalogContract.test.ts',
  'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
  'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
  'scripts/phase7/build-core-loop-qa-packet.mjs',
  'scripts/phase7/check-core-loop.mjs',
  'scripts/phase7/check-core-loop-smoke.mjs',
  'scripts/e2e/human-e2e-manifest.mjs',
  'scripts/phase9/lib.mjs',
  'docs/HUMAN_SIMULATED_E2E_TESTING.md',
  'docs/E2E_TESTING_CHECKLIST.md',
  'docs/USER_FLOW_TREE.md',
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
  'docs/phase-5/generated/device-qa-packet.json',
  'docs/phase-5/generated/device-qa-packet.md',
  'docs/phase-6/generated/payments-qa-packet.json',
  'docs/phase-6/generated/payments-qa-packet.md',
  'docs/phase-7/surface-inventory.md',
  'docs/phase-7/launch-claim-matrix.md',
  'docs/phase-7/beta-evidence-dashboard.md',
  'docs/phase-7/core-loop-qa-checklist.md',
  'docs/phase-7/phase-7-exit-review.md',
];

const scenarios = [
  {
    surface: 'Onboarding',
    scenario: 'final age/account/consent copy, policy links, and consent ledger verified',
    evidenceKey: 'onboardingConsentQaPass',
    envKey: 'PHASE7_ONBOARDING_CONSENT_QA_PASS',
  },
  {
    surface: 'Shelf intake',
    scenario:
      'add owned products via manual/search/scan-or-OCR with source/confidence visible; exact-date intake rejects impossible/future dates; label PAO requires explicit open-jar confirmation; surfaced expiry provenance matches the winning date; reload preserves the lifecycle; re-add archives the prior unit, retains product/PAO provenance, and drops its package-specific date evidence; replenishment alerts remain off until explicit opt-in',
    evidenceKey: 'shelfIntakeQaPass',
    envKey: 'PHASE7_SHELF_INTAKE_QA_PASS',
  },
  {
    surface: 'Reviewed guidance',
    scenario:
      'reviewed conflict shows evidence and sequence guidance; unreviewed conflict stays hidden',
    evidenceKey: 'reviewedGuidanceQaPass',
    envKey: 'PHASE7_REVIEWED_GUIDANCE_QA_PASS',
  },
  {
    surface: 'Routine builder',
    scenario: 'AM/PM routine persists across restart, offline, timezone rollover',
    evidenceKey: 'routineBuilderQaPass',
    envKey: 'PHASE7_ROUTINE_BUILDER_QA_PASS',
  },
  {
    surface: 'Today check-off',
    scenario: 'offline/online check-off is idempotent and append-only',
    evidenceKey: 'todayCheckoffQaPass',
    envKey: 'PHASE7_TODAY_CHECKOFF_QA_PASS',
  },
  {
    surface: 'Photos',
    scenario:
      'baseline capture renders locally; app lock gates timeline; settings and Progress show device-only storage with no backup control or automatic upload',
    evidenceKey: 'photosPrivacyQaPass',
    envKey: 'PHASE7_PHOTOS_PRIVACY_QA_PASS',
  },
  {
    surface: 'Reminders',
    scenario: 'permission, quiet hours, Android 13+ permission, timezone/DST behavior verified',
    evidenceKey: 'remindersQaPass',
    envKey: 'PHASE7_REMINDERS_QA_PASS',
  },
  {
    surface: 'Payments',
    scenario:
      'RevenueCat purchase, restore, cancellation, expiration, refund, and webhook lifecycle verified',
    evidenceKey: 'paymentsLifecycleQaPass',
    envKey: 'PHASE7_PAYMENTS_LIFECYCLE_QA_PASS',
  },
  {
    surface: 'Privacy controls',
    scenario: 'export, account deletion, health-data withdrawal, app lock, support links verified',
    evidenceKey: 'privacyControlsQaPass',
    envKey: 'PHASE7_PRIVACY_CONTROLS_QA_PASS',
  },
  {
    surface: 'Share card',
    scenario: 'exact owned reviewed conflict only; no fallback; no sensitive analytics payload',
    evidenceKey: 'shareCardQaPass',
    envKey: 'PHASE7_SHARE_CARD_QA_PASS',
  },
  {
    surface: 'Deferred surfaces',
    scenario:
      'commerce/community posting/trend/cloud Ask/widgets/share hidden unless gates enabled',
    evidenceKey: 'deferredSurfacesQaPass',
    envKey: 'PHASE7_DEFERRED_SURFACES_QA_PASS',
  },
  {
    surface: 'Analytics',
    scenario:
      'activation, retention, payment, privacy, support, and deferred-surface events visible',
    evidenceKey: 'analyticsQaPass',
    envKey: 'PHASE7_ANALYTICS_QA_PASS',
  },
];

const evidence = {
  brandReady: evidenceFlagEnabled(process.env.PHASE7_BRAND_READY),
  supabaseRlsPass: evidenceFlagEnabled(process.env.PHASE7_SUPABASE_RLS_PASS),
  clinicalReviewPass: evidenceFlagEnabled(process.env.PHASE7_CLINICAL_REVIEW_PASS),
  catalogBetaImportPass: evidenceFlagEnabled(process.env.PHASE7_CATALOG_BETA_IMPORT_PASS),
  deviceQaPass: evidenceFlagEnabled(process.env.PHASE7_DEVICE_QA_PASS),
  revenueCatQaPass: evidenceFlagEnabled(process.env.PHASE7_REVENUECAT_QA_PASS),
  privacyExportDeletePass: evidenceFlagEnabled(process.env.PHASE7_PRIVACY_EXPORT_DELETE_PASS),
  betaDashboardReady: evidenceFlagEnabled(process.env.PHASE7_BETA_DASHBOARD_READY),
  signedOffBy: normalizeNamedSignoff(process.env.PHASE7_SIGNED_OFF_BY) ?? '',
};
for (const scenario of scenarios) {
  evidence[scenario.evidenceKey] = evidenceFlagEnabled(process.env[scenario.envKey]);
}

function gitStatusExcludingGeneratedPacket() {
  return gitStatusExcludingGeneratedEvidence(packetOutputPaths);
}

function hashFile(path) {
  const abs = resolve(root, path);
  if (!existsSync(abs)) return { path, exists: false };
  const bytes = readFileSync(abs);
  return {
    path,
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

const files = requiredFiles.map(hashFile);
const blockers = [];
const warnings = [];
let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedPacket();
} catch {
  warnings.push('Git SHA/status could not be captured.');
}
if (gitStatus.length > 0) {
  warnings.push(
    'Phase 7 core-loop QA packet generated with a dirty Git worktree; do not use it as final core-loop evidence.',
  );
}
for (const file of files) if (!file.exists) blockers.push(`Missing ${file.path}.`);
for (const [key, value] of Object.entries(evidence)) {
  if (key === 'signedOffBy') {
    if (!value) blockers.push('Missing PHASE7_SIGNED_OFF_BY.');
  } else if (value !== true) {
    blockers.push(`Missing ${key} evidence.`);
  }
}

const packet = {
  generatedAt: new Date().toISOString(),
  launchContract: launchContractSnapshot(launchContract),
  purpose: 'Phase 7 closed-beta core-loop launch QA packet.',
  gitSha,
  gitStatus,
  evidence,
  scenarios: scenarios.map(({ surface, scenario, evidenceKey, envKey }) => ({
    surface,
    scenario,
    evidenceKey,
    envKey,
    evidencePass: evidence[evidenceKey],
  })),
  files,
  blockers,
  warnings,
};

mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, 'core-loop-qa-packet.json');
writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);

const scenarioRows = scenarios
  .map(
    ({ surface, scenario, evidenceKey, envKey }) =>
      `| ${surface} | ${scenario} | \`${envKey}\` | ${evidence[evidenceKey] ? 'yes' : 'BLOCKED'} |`,
  )
  .join('\n');
const fileRows = files
  .map((file) =>
    file.exists
      ? `| ${file.path} | present | ${file.bytes} | ${file.sha256} |`
      : `| ${file.path} | missing |  |  |`,
  )
  .join('\n');
const mdPath = join(outDir, 'core-loop-qa-packet.md');
writeFileSync(
  mdPath,
  [
    '# Generated Phase 7 Core Loop QA Packet',
    '',
    `Generated at: ${packet.generatedAt}`,
    `Git SHA: ${packet.gitSha}`,
    `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
    '',
    'Strict completion requires real brand/legal clearance, Supabase RLS evidence, clinical review, catalog import evidence, device QA, RevenueCat QA, privacy/export/delete QA, analytics dashboard readiness, and a named owner.',
    '',
    '## Evidence',
    '',
    `- Brand ready: ${evidence.brandReady ? 'yes' : 'BLOCKED'}`,
    `- Supabase RLS pass: ${evidence.supabaseRlsPass ? 'yes' : 'BLOCKED'}`,
    `- Clinical review pass: ${evidence.clinicalReviewPass ? 'yes' : 'BLOCKED'}`,
    `- Catalog beta import pass: ${evidence.catalogBetaImportPass ? 'yes' : 'BLOCKED'}`,
    `- Device QA pass: ${evidence.deviceQaPass ? 'yes' : 'BLOCKED'}`,
    `- RevenueCat QA pass: ${evidence.revenueCatQaPass ? 'yes' : 'BLOCKED'}`,
    `- Privacy/export/delete pass: ${evidence.privacyExportDeletePass ? 'yes' : 'BLOCKED'}`,
    `- Beta dashboard ready: ${evidence.betaDashboardReady ? 'yes' : 'BLOCKED'}`,
    `- Signed off by: ${evidence.signedOffBy || 'BLOCKED'}`,
    '',
    '## Scenario Evidence',
    '',
    ...scenarios.map(
      ({ surface, evidenceKey, envKey }) =>
        `- ${surface} (${envKey}): ${evidence[evidenceKey] ? 'yes' : 'BLOCKED'}`,
    ),
    '',
    '## Scenarios',
    '',
    '| Surface | Required scenario set | Evidence flag | Status |',
    '| --- | --- | --- | --- |',
    scenarioRows,
    '',
    '## Files',
    '',
    '| Path | Status | Bytes | SHA-256 |',
    '| --- | --- | --- | --- |',
    fileRows,
    '',
    '## Blockers',
    '',
    blockers.length > 0 ? blockers.map((blocker) => `- ${blocker}`).join('\n') : '- none',
    '',
    '## Warnings',
    '',
    warnings.length > 0 ? warnings.map((warning) => `- ${warning}`).join('\n') : '- none',
    '',
  ].join('\n'),
);

console.log(`Wrote ${relative(root, jsonPath).replaceAll('\\', '/')}`);
console.log(`Wrote ${relative(root, mdPath).replaceAll('\\', '/')}`);

if (strict && blockers.length > 0) {
  console.error(
    `\nPhase 7 strict QA packet has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}
