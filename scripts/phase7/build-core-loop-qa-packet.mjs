#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { evidenceFlagEnabled, normalizeNamedSignoff } from '../phase9/lib.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const outDir = resolve(root, process.env.PHASE7_PACKET_OUT_DIR ?? 'docs/phase-7/generated');

const requiredFiles = [
  'package.json',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
  'apps/mobile/src/components/launch/DeferredSurface.tsx',
  'apps/mobile/src/app/(tabs)/today.tsx',
  'apps/mobile/src/app/(tabs)/progress.tsx',
  'apps/mobile/src/app/(tabs)/you.tsx',
  'apps/mobile/src/app/share/conflict/[ruleId].tsx',
  'apps/mobile/src/app/conflict/[ruleId].tsx',
  'apps/mobile/src/features/commerce/WhereToBuy.tsx',
  'scripts/phase7/build-core-loop-qa-packet.mjs',
  'scripts/phase7/check-core-loop.mjs',
  'scripts/phase7/check-core-loop-smoke.mjs',
  'scripts/phase9/lib.mjs',
  'docs/phase-7/surface-inventory.md',
  'docs/phase-7/launch-claim-matrix.md',
  'docs/phase-7/beta-evidence-dashboard.md',
  'docs/phase-7/core-loop-qa-checklist.md',
  'docs/phase-7/phase-7-exit-review.md',
];

const scenarios = [
  ['Onboarding', 'final age/account/consent copy, policy links, and consent ledger verified'],
  [
    'Shelf intake',
    'add 3 real owned products via manual/search/scan-or-OCR fallback; source/confidence visible',
  ],
  [
    'Reviewed guidance',
    'reviewed conflict shows evidence and sequence guidance; unreviewed conflict stays hidden',
  ],
  ['Routine builder', 'AM/PM routine persists across restart, offline, timezone rollover'],
  ['Today check-off', 'offline/online check-off is idempotent and append-only'],
  [
    'Photos',
    'baseline capture renders locally; app lock gates timeline; cloud backup remains off by default',
  ],
  ['Reminders', 'permission, quiet hours, Android 13+ permission, timezone/DST behavior verified'],
  [
    'Payments',
    'RevenueCat purchase, restore, cancellation, expiration, refund, and webhook lifecycle verified',
  ],
  [
    'Privacy controls',
    'export, account deletion, health-data withdrawal, app lock, support links verified',
  ],
  ['Share card', 'exact owned reviewed conflict only; no fallback; no sensitive analytics payload'],
  [
    'Deferred surfaces',
    'commerce/community posting/trend/cloud Ask/widgets/share hidden unless gates enabled',
  ],
  [
    'Analytics',
    'activation, retention, payment, privacy, support, and deferred-surface events visible',
  ],
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
  purpose: 'Phase 7 closed-beta core-loop launch QA packet.',
  evidence,
  scenarios: scenarios.map(([surface, scenario]) => ({ surface, scenario })),
  files,
  blockers,
};

mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, 'core-loop-qa-packet.json');
writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);

const scenarioRows = scenarios
  .map(([surface, scenario]) => `| ${surface} | ${scenario} |`)
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
    '## Scenarios',
    '',
    '| Surface | Required scenario set |',
    '| --- | --- |',
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
