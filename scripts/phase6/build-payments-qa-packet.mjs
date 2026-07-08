#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { evidenceFlagEnabled, normalizeNamedSignoff } from '../phase9/lib.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const outDir = resolve(root, process.env.PHASE6_PACKET_OUT_DIR ?? 'docs/phase-6/generated');

const requiredFiles = [
  'package.json',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'apps/mobile/src/features/subscription/store.ts',
  'apps/mobile/src/features/subscription/useEntitlement.ts',
  'apps/mobile/src/features/subscription/useSubscriptionOffering.ts',
  'apps/mobile/src/app/onboarding/paywall.tsx',
  'apps/mobile/src/app/paywall/upsell.tsx',
  'apps/mobile/src/app/paywall/winback.tsx',
  'apps/mobile/src/app/settings/subscription.tsx',
  'supabase/functions/revenuecat-webhook/index.ts',
  'supabase/functions/subscription-grants/index.ts',
  'supabase/functions/account-deletion/index.ts',
  'supabase/migrations/20260615000027_phase6_payments.sql',
  'supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql',
  'apps/mobile/src/features/subscription/serverContracts.test.ts',
  'scripts/phase6/build-payments-qa-packet.mjs',
  'scripts/phase6/check-payments-env.mjs',
  'scripts/phase6/check-payments-env-smoke.mjs',
  'scripts/phase9/lib.mjs',
  'docs/phase-6/payments-runbook.md',
  'docs/phase-6/payments-qa-checklist.md',
  'docs/phase-6/phase-6-exit-review.md',
];

const scenarios = [
  [
    'Offering load',
    'current RevenueCat offering returns annual and monthly packages with localized prices',
  ],
  ['Missing offering', 'paywall disables purchase and shows unavailable state; no Pro grant'],
  [
    'Trial purchase',
    'eligible annual trial opens store sheet, grants Pro only from CustomerInfo, schedules reminder',
  ],
  [
    'Paid purchase',
    'ineligible/no-trial annual purchase grants Pro only from CustomerInfo and cancels trial reminder',
  ],
  ['Cancellation', 'webhook sets will_renew=false but keeps access until expiration'],
  [
    'Expiration/refund',
    'webhook deactivates entitlement and lifecycle screen downgrades gracefully',
  ],
  ['Restore', 'new install restores active subscription and writes verified local cache'],
  [
    'Reverse trial',
    'authenticated Edge Function atomically grants exactly once, server expiry RPC deactivates after 7 days',
  ],
  [
    'Win-back',
    'native eligible win-back offer purchases on iOS; unavailable offers are hidden/rerouted',
  ],
  ['Webhook auth', 'bad HMAC rejected, stale timestamp rejected, duplicate event id idempotent'],
  [
    'Account deletion',
    'mobile copy says deletion does not cancel store billing; server calls RevenueCat delete customer',
  ],
  ['Finance', '$49.99 annual model, refund/churn assumptions, entitlement denial/leakage reviewed'],
];

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

const evidence = {
  rcOfferingReviewed: evidenceFlagEnabled(process.env.PHASE6_RC_OFFERING_REVIEWED),
  iosSandboxRestorePass: evidenceFlagEnabled(process.env.PHASE6_IOS_SANDBOX_RESTORE_PASS),
  androidLicenseTestPass: evidenceFlagEnabled(process.env.PHASE6_ANDROID_LICENSE_TEST_PASS),
  webhookHmacTestPass: evidenceFlagEnabled(process.env.PHASE6_WEBHOOK_HMAC_TEST_PASS),
  financeSignoff: evidenceFlagEnabled(process.env.PHASE6_FINANCE_SIGNOFF),
  signedOffBy: normalizeNamedSignoff(process.env.PHASE6_SIGNED_OFF_BY) ?? '',
};

const files = requiredFiles.map(hashFile);
const blockers = [];
for (const file of files) if (!file.exists) blockers.push(`Missing ${file.path}.`);
if (!evidence.rcOfferingReviewed) blockers.push('Missing PHASE6_RC_OFFERING_REVIEWED=true.');
if (!evidence.iosSandboxRestorePass) blockers.push('Missing PHASE6_IOS_SANDBOX_RESTORE_PASS=true.');
if (!evidence.androidLicenseTestPass)
  blockers.push('Missing PHASE6_ANDROID_LICENSE_TEST_PASS=true.');
if (!evidence.webhookHmacTestPass) blockers.push('Missing PHASE6_WEBHOOK_HMAC_TEST_PASS=true.');
if (!evidence.financeSignoff) blockers.push('Missing PHASE6_FINANCE_SIGNOFF=true.');
if (!evidence.signedOffBy) blockers.push('Missing PHASE6_SIGNED_OFF_BY.');

const packet = {
  generatedAt: new Date().toISOString(),
  purpose: 'Phase 6 payments, entitlements, restore, webhook, and account-deletion QA packet.',
  evidence,
  scenarios: scenarios.map(([surface, scenario]) => ({ surface, scenario })),
  files,
  blockers,
};

mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, 'payments-qa-packet.json');
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
const mdPath = join(outDir, 'payments-qa-packet.md');
writeFileSync(
  mdPath,
  [
    '# Generated Phase 6 Payments QA Packet',
    '',
    `Generated at: ${packet.generatedAt}`,
    '',
    'Strict completion requires real RevenueCat offering review, iOS sandbox restore, Android license-test restore, webhook HMAC replay evidence, finance signoff, and a named owner.',
    '',
    '## Evidence',
    '',
    `- RevenueCat offering reviewed: ${evidence.rcOfferingReviewed ? 'yes' : 'BLOCKED'}`,
    `- iOS sandbox restore pass: ${evidence.iosSandboxRestorePass ? 'yes' : 'BLOCKED'}`,
    `- Android license test pass: ${evidence.androidLicenseTestPass ? 'yes' : 'BLOCKED'}`,
    `- Webhook HMAC test pass: ${evidence.webhookHmacTestPass ? 'yes' : 'BLOCKED'}`,
    `- Finance signoff: ${evidence.financeSignoff ? 'yes' : 'BLOCKED'}`,
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
    `\nPhase 6 strict QA packet has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}
