#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  evidenceFlagEnabled,
  normalizeNamedSignoff,
  placeholderEnvValue,
  productionUrl,
} from '../phase9/lib.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const errors = [];
const warnings = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
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

function envFile() {
  const path = resolve(root, '.env');
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}

function require(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function has(path, pattern) {
  return pattern.test(read(path));
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

const pkg = readJson('apps/mobile/package.json');
const rootPkg = readJson('package.json');
const eas = readJson('apps/mobile/eas.json');
const exampleEnv = parseEnv(read('.env.example'));
const localEnv = envFile();
const productionEasEnv = eas.build?.production?.env ?? {};
const prodEnv = { ...exampleEnv, ...localEnv, ...productionEasEnv, ...process.env };

require(Boolean(
  pkg.dependencies?.['react-native-purchases'],
), 'react-native-purchases dependency is missing.');
require(Boolean(
  rootPkg.scripts?.['phase6:check-payments-env'],
), 'Root package is missing phase6:check-payments-env.');
require(Boolean(
  rootPkg.scripts?.['phase6:qa-packet'],
), 'Root package is missing phase6:qa-packet.');
require(Boolean(rootPkg.scripts?.['phase6:verify']), 'Root package is missing phase6:verify.');

const qaPacketBuilder = read('scripts/phase6/build-payments-qa-packet.mjs');
require(
  /function gitStatusExcludingGeneratedPacket\(\)/.test(qaPacketBuilder) &&
    /payments-qa-packet\.json/.test(qaPacketBuilder) &&
    /payments-qa-packet\.md/.test(qaPacketBuilder) &&
    /gitStatus = gitStatusExcludingGeneratedPacket\(\)/.test(qaPacketBuilder),
  'Phase 6 payments QA packet must ignore only its own generated outputs when recording Git status.',
);
require(
  /Phase 6 payments QA packet generated with a dirty Git worktree/.test(qaPacketBuilder) &&
    /Git status: \$\{packet\.gitStatus \? 'DIRTY' : 'clean'\}/.test(qaPacketBuilder),
  'Phase 6 payments QA packet must warn on dirty worktrees and expose Git status in Markdown.',
);
for (const file of [
  'package.json',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'apps/mobile/src/features/subscription/store.ts',
  'apps/mobile/src/features/subscription/useEntitlement.ts',
  'supabase/functions/revenuecat-webhook/index.ts',
  'supabase/functions/subscription-grants/index.ts',
  'supabase/functions/account-deletion/index.ts',
  'scripts/phase6/build-payments-qa-packet.mjs',
  'scripts/phase6/check-payments-env.mjs',
  'scripts/phase6/check-payments-env-smoke.mjs',
  'scripts/phase9/lib.mjs',
  'docs/phase-6/payments-runbook.md',
  'docs/phase-6/payments-qa-checklist.md',
  'docs/phase-6/phase-6-exit-review.md',
]) {
  require(
    qaPacketBuilder.includes(`'${file}'`) || qaPacketBuilder.includes(`"${file}"`),
    `Phase 6 payments QA packet must hash ${file}.`,
  );
}

require(existsSync(
  resolve(root, 'supabase/functions/subscription-grants/index.ts'),
), 'subscription-grants Edge Function is missing.');
require(existsSync(
  resolve(root, 'supabase/migrations/20260615000027_phase6_payments.sql'),
), 'Phase 6 payments migration is missing.');

require(has(
  'supabase/functions/revenuecat-webhook/index.ts',
  /X-RevenueCat-Webhook-Signature/,
), 'RevenueCat webhook does not verify the HMAC signature header.');
require(has(
  'supabase/functions/revenuecat-webhook/index.ts',
  /readLimitedText\(req,\s*maxBodyBytes\)/,
) &&
  has(
    'supabase/functions/revenuecat-webhook/index.ts',
    /JSON\.parse\(rawBody\s*\|\|\s*'\{\}'\)/,
  ), 'RevenueCat webhook must read the bounded raw request body before JSON parsing.');
require(has(
  'supabase/functions/account-deletion/index.ts',
  /DELETE/,
), 'Account deletion does not call RevenueCat customer deletion.');
require(has(
  'supabase/functions/account-deletion/index.ts',
  /api\.revenuecat\.com\/v1\/subscribers/,
), 'Account deletion is missing RevenueCat subscriber deletion endpoint.');

const forbiddenLocalGrants = [
  [
    'apps/mobile/src/features/subscription/store.ts',
    /grantTrial|grantReverseTrial|setActivePaid|stubbed/i,
  ],
  [
    'apps/mobile/src/features/subscription/useEntitlement.ts',
    /grantTrial|grantReverseTrial|setActivePaid|stub:\s*true/i,
  ],
  ['apps/mobile/src/lib/iap/revenuecat.ts', /stub:\s*true/i],
  ['apps/mobile/src/app/paywall/winback.tsx', /WINBACK/],
];
for (const [path, pattern] of forbiddenLocalGrants) {
  require(!pattern.test(
    read(path),
  ), `${path} still contains a forbidden local payment stub/grant.`);
}

for (const path of [
  'apps/mobile/src/app/onboarding/paywall.tsx',
  'apps/mobile/src/app/paywall/upsell.tsx',
  'apps/mobile/src/app/paywall/reoffer.tsx',
  'apps/mobile/src/features/subscription/ProGate.tsx',
]) {
  require(has(
    path,
    /useSubscriptionOffering/,
  ), `${path} does not use RevenueCat offering pricing.`);
}

require(productionEasEnv.EXPO_PUBLIC_APP_ENV ===
  'production', 'EAS production profile must set EXPO_PUBLIC_APP_ENV=production.');
require(!productionEasEnv.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY, 'EAS production profile must not set a RevenueCat Test Store key.');

warn(
  prodEnv.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID === 'pro',
  'Production RevenueCat entitlement id should be `pro`.',
);
warn(
  revenueCatPublicKey(prodEnv.EXPO_PUBLIC_REVENUECAT_IOS_KEY, 'appl'),
  'Missing EXPO_PUBLIC_REVENUECAT_IOS_KEY for production.',
);
warn(
  revenueCatPublicKey(prodEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, 'goog'),
  'Missing EXPO_PUBLIC_REVENUECAT_ANDROID_KEY for production.',
);
warn(
  finalProductId(prodEnv.EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID),
  'Production annual RevenueCat product id must be a final App Store/Play product id.',
);
warn(
  finalProductId(prodEnv.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID),
  'Production monthly RevenueCat product id must be a final App Store/Play product id.',
);
warn(
  finalProductId(prodEnv.EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID),
  'Production reverse-trial RevenueCat product id must be final or intentionally app-granted in the dashboard/runbook.',
);
warn(
  Boolean(exampleEnv.REVENUECAT_WEBHOOK_SIGNING_SECRET),
  '.env.example must document REVENUECAT_WEBHOOK_SIGNING_SECRET.',
);
warn(
  Boolean(exampleEnv.REVENUECAT_SECRET_API_KEY),
  '.env.example must document REVENUECAT_SECRET_API_KEY.',
);
warn(
  !placeholderEnvValue(prodEnv.REVENUECAT_WEBHOOK_AUTH),
  'Missing production RevenueCat webhook shared auth.',
);
warn(
  !placeholderEnvValue(prodEnv.REVENUECAT_WEBHOOK_SIGNING_SECRET),
  'Missing production RevenueCat webhook signing secret.',
);
warn(
  !placeholderEnvValue(prodEnv.REVENUECAT_SECRET_API_KEY),
  'Missing production RevenueCat secret API key.',
);
warn(
  prodEnv.BRAND_LEGAL_CLEARANCE === 'cleared',
  'BRAND_LEGAL_CLEARANCE is not cleared for production.',
);

for (const key of ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_TERMS_URL', 'EXPO_PUBLIC_SUPPORT_URL']) {
  warn(productionUrl(prodEnv[key]), `${key} must be a real production HTTPS URL.`);
}

const externalEvidence = [
  'PHASE6_RC_OFFERING_REVIEWED',
  'PHASE6_IOS_SANDBOX_RESTORE_PASS',
  'PHASE6_ANDROID_LICENSE_TEST_PASS',
  'PHASE6_WEBHOOK_HMAC_TEST_PASS',
  'PHASE6_FINANCE_SIGNOFF',
];
for (const key of externalEvidence) {
  warn(evidenceFlagEnabled(process.env[key]), `Missing external Phase 6 evidence: ${key}.`);
}
warn(
  Boolean(normalizeNamedSignoff(process.env.PHASE6_SIGNED_OFF_BY)),
  'Missing external Phase 6 evidence: PHASE6_SIGNED_OFF_BY.',
);

console.log('Phase 6 payments/entitlements check');
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`FAIL ${error}`);

if (errors.length > 0) {
  console.error(
    `\nPhase 6 payments baseline has ${errors.length} blocker${errors.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

if (warnings.length > 0 && strict) {
  console.error(
    `\nPhase 6 strict mode failed on ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log('\nPhase 6 payments baseline is present.');
