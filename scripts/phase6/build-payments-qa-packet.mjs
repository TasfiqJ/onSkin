#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  command,
  evidenceFlagEnabled,
  normalizeNamedSignoff,
  placeholderEnvValue,
  productionUrl,
} from '../phase9/lib.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const packetOutDir = process.env.PHASE6_PACKET_OUT_DIR ?? 'docs/phase-6/generated';
const outDir = resolve(root, packetOutDir);
const packetOutputPaths = [
  `${packetOutDir}/payments-qa-packet.json`,
  `${packetOutDir}/payments-qa-packet.md`,
].map((path) => path.replace(/\\/g, '/'));

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

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    out[key] = rest.join('=').trim();
  }
  return out;
}

function envFile(path) {
  const abs = resolve(root, path);
  return existsSync(abs) ? parseEnv(readFileSync(abs, 'utf8')) : {};
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function gitStatusExcludingGeneratedPacket() {
  const excluded = new Set(packetOutputPaths);
  return command('git', ['status', '--short'])
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const statusPath = line.slice(3).replace(/\\/g, '/');
      return !excluded.has(statusPath);
    })
    .join('\n')
    .trim();
}

function revenueCatPublicKey(value, prefix) {
  const trimmed = String(value ?? '').trim();
  return !placeholderEnvValue(trimmed) && new RegExp(`^${prefix}_[A-Za-z0-9]{8,}$`).test(trimmed);
}

function finalProductId(value) {
  const trimmed = String(value ?? '').trim();
  return (
    !placeholderEnvValue(trimmed) &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{2,119}$/.test(trimmed) &&
    !/(^|[._-])(dev|local|placeholder|example)([._-]|$)/i.test(trimmed)
  );
}

const exampleEnv = envFile('.env.example');
const localEnv = envFile('.env');
const eas = readJson('apps/mobile/eas.json');
const productionEasEnv = eas.build?.production?.env ?? {};
const prodEnv = { ...exampleEnv, ...localEnv, ...productionEasEnv, ...process.env };

const productionConfig = {
  productionAppEnvironment: productionEasEnv.EXPO_PUBLIC_APP_ENV === 'production',
  productionHasNoTestStoreKey: !productionEasEnv.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY,
  entitlementIdIsPro: prodEnv.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID === 'pro',
  iosPublicKeyConfigured: revenueCatPublicKey(prodEnv.EXPO_PUBLIC_REVENUECAT_IOS_KEY, 'appl'),
  androidPublicKeyConfigured: revenueCatPublicKey(
    prodEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    'goog',
  ),
  annualProductIdFinal: finalProductId(prodEnv.EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID),
  monthlyProductIdFinal: finalProductId(prodEnv.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID),
  reverseTrialProductIdFinal: finalProductId(
    prodEnv.EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID,
  ),
  webhookSharedAuthConfigured: !placeholderEnvValue(prodEnv.REVENUECAT_WEBHOOK_AUTH),
  webhookSigningSecretConfigured: !placeholderEnvValue(prodEnv.REVENUECAT_WEBHOOK_SIGNING_SECRET),
  secretApiKeyConfigured: !placeholderEnvValue(prodEnv.REVENUECAT_SECRET_API_KEY),
  brandLegalClearanceRecorded: prodEnv.BRAND_LEGAL_CLEARANCE === 'cleared',
  privacyUrlProduction: productionUrl(prodEnv.EXPO_PUBLIC_PRIVACY_URL),
  termsUrlProduction: productionUrl(prodEnv.EXPO_PUBLIC_TERMS_URL),
  supportUrlProduction: productionUrl(prodEnv.EXPO_PUBLIC_SUPPORT_URL),
};

const productionConfigBlockers = [
  ['productionAppEnvironment', 'EAS production profile must set EXPO_PUBLIC_APP_ENV=production.'],
  [
    'productionHasNoTestStoreKey',
    'EAS production profile must not include RevenueCat Test Store key.',
  ],
  ['entitlementIdIsPro', 'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID must be `pro`.'],
  ['iosPublicKeyConfigured', 'Missing final EXPO_PUBLIC_REVENUECAT_IOS_KEY.'],
  ['androidPublicKeyConfigured', 'Missing final EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.'],
  ['annualProductIdFinal', 'Missing final EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID.'],
  ['monthlyProductIdFinal', 'Missing final EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID.'],
  ['reverseTrialProductIdFinal', 'Missing final EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID.'],
  ['webhookSharedAuthConfigured', 'Missing production REVENUECAT_WEBHOOK_AUTH.'],
  ['webhookSigningSecretConfigured', 'Missing production REVENUECAT_WEBHOOK_SIGNING_SECRET.'],
  ['secretApiKeyConfigured', 'Missing production REVENUECAT_SECRET_API_KEY.'],
  ['brandLegalClearanceRecorded', 'BRAND_LEGAL_CLEARANCE must be cleared for production.'],
  ['privacyUrlProduction', 'EXPO_PUBLIC_PRIVACY_URL must be a production HTTPS URL.'],
  ['termsUrlProduction', 'EXPO_PUBLIC_TERMS_URL must be a production HTTPS URL.'],
  ['supportUrlProduction', 'EXPO_PUBLIC_SUPPORT_URL must be a production HTTPS URL.'],
];

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
    'Phase 6 payments QA packet generated with a dirty Git worktree; do not use it as final payments evidence.',
  );
}
for (const file of files) if (!file.exists) blockers.push(`Missing ${file.path}.`);
for (const [key, message] of productionConfigBlockers) {
  if (!productionConfig[key]) blockers.push(message);
}
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
  gitSha,
  gitStatus,
  productionConfig,
  evidence,
  scenarios: scenarios.map(([surface, scenario]) => ({ surface, scenario })),
  files,
  blockers,
  warnings,
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
    `Git SHA: ${packet.gitSha}`,
    `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
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
    '## Production Config',
    '',
    `- EAS production app environment: ${productionConfig.productionAppEnvironment ? 'yes' : 'BLOCKED'}`,
    `- Production excludes RevenueCat Test Store key: ${productionConfig.productionHasNoTestStoreKey ? 'yes' : 'BLOCKED'}`,
    `- Entitlement ID is pro: ${productionConfig.entitlementIdIsPro ? 'yes' : 'BLOCKED'}`,
    `- iOS RevenueCat public key configured: ${productionConfig.iosPublicKeyConfigured ? 'yes' : 'BLOCKED'}`,
    `- Android RevenueCat public key configured: ${productionConfig.androidPublicKeyConfigured ? 'yes' : 'BLOCKED'}`,
    `- Annual product ID final: ${productionConfig.annualProductIdFinal ? 'yes' : 'BLOCKED'}`,
    `- Monthly product ID final: ${productionConfig.monthlyProductIdFinal ? 'yes' : 'BLOCKED'}`,
    `- Reverse-trial product ID final: ${productionConfig.reverseTrialProductIdFinal ? 'yes' : 'BLOCKED'}`,
    `- Webhook shared auth configured: ${productionConfig.webhookSharedAuthConfigured ? 'yes' : 'BLOCKED'}`,
    `- Webhook signing secret configured: ${productionConfig.webhookSigningSecretConfigured ? 'yes' : 'BLOCKED'}`,
    `- RevenueCat secret API key configured: ${productionConfig.secretApiKeyConfigured ? 'yes' : 'BLOCKED'}`,
    `- Brand legal clearance recorded: ${productionConfig.brandLegalClearanceRecorded ? 'yes' : 'BLOCKED'}`,
    `- Privacy URL production: ${productionConfig.privacyUrlProduction ? 'yes' : 'BLOCKED'}`,
    `- Terms URL production: ${productionConfig.termsUrlProduction ? 'yes' : 'BLOCKED'}`,
    `- Support URL production: ${productionConfig.supportUrlProduction ? 'yes' : 'BLOCKED'}`,
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
    `\nPhase 6 strict QA packet has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}
