#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isReleasePlatformRequired, loadLaunchContract } from '../launch/contract.mjs';

import {
  command,
  evidenceFlagEnabled,
  placeholderEnvValue,
  productionUrl,
} from '../phase9/lib.mjs';
import { auditRevenueCatDeletionSourceContract } from './payments-source-contract.mjs';
import {
  auditRevenueCatV2AccessEvidence,
  normalizePhase6Reviewer,
} from './payments-revenuecat-access-evidence.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const checkNowMs = Date.now();
const launchContract = loadLaunchContract(root);
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);
const errors = [];
const warnings = [];
const SERVER_SECRET_ENV_NAMES = Object.freeze([
  'REVENUECAT_WEBHOOK_AUTH',
  'REVENUECAT_WEBHOOK_SIGNING_SECRET',
  'REVENUECAT_SECRET_API_KEY',
  'REVENUECAT_V2_SECRET_API_KEY',
]);

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

function exactProductionValue(value) {
  const exact = String(value ?? '');
  return exact.length > 0 && exact === exact.trim() && !placeholderEnvValue(exact) ? exact : null;
}

function revenueCatProjectId(value) {
  const exact = exactProductionValue(value);
  return exact !== null && /^proj[A-Za-z0-9]{5,251}$/.test(exact);
}

function revenueCatV2SecretKey(value) {
  const exact = exactProductionValue(value);
  return (
    exact !== null && /^sk_[A-Za-z0-9]{20,997}$/.test(exact) && new Set(exact.slice(3)).size >= 8
  );
}

function revenueCatV1SecretKey(value) {
  const exact = exactProductionValue(value);
  return (
    exact !== null && /^sk_[A-Za-z0-9]{20,509}$/.test(exact) && new Set(exact.slice(3)).size >= 8
  );
}

function webhookSharedAuth(value) {
  const exact = exactProductionValue(value);
  return exact !== null && /^[A-Za-z0-9_-]{32,256}$/.test(exact) && new Set(exact).size >= 8;
}

function webhookSigningSecret(value) {
  const exact = exactProductionValue(value);
  return (
    exact !== null &&
    /^whsec_[A-Za-z0-9_-]{32,256}$/.test(exact) &&
    new Set(exact.slice(6)).size >= 8
  );
}

function trackedServerSecretLeaks(...environments) {
  return SERVER_SECRET_ENV_NAMES.filter((name) =>
    environments.some(
      (environment) => Object.hasOwn(environment, name) && !placeholderEnvValue(environment[name]),
    ),
  );
}

function mergeProductionEnvironment(example, local, easEnvironment, processEnvironment) {
  const merged = { ...example, ...easEnvironment, ...local, ...processEnvironment };
  for (const name of SERVER_SECRET_ENV_NAMES) {
    merged[name] = Object.hasOwn(processEnvironment, name)
      ? processEnvironment[name]
      : Object.hasOwn(local, name)
        ? local[name]
        : '';
  }
  return merged;
}

const pkg = readJson('apps/mobile/package.json');
const rootPkg = readJson('package.json');
const eas = readJson('apps/mobile/eas.json');
const exampleEnv = parseEnv(read('.env.example'));
const localEnv = envFile();
const productionEasEnv = eas.build?.production?.env ?? {};
const trackedSecretLeaks = trackedServerSecretLeaks(exampleEnv, productionEasEnv);
const prodEnv = mergeProductionEnvironment(exampleEnv, localEnv, productionEasEnv, process.env);
let trackedSecretEnvironmentFiles = null;
try {
  trackedSecretEnvironmentFiles = command('git', ['ls-tree', '-r', '--name-only', 'HEAD'])
    .split(/\r?\n/)
    .map((path) => path.replaceAll('\\', '/').trim())
    .filter((path) => /(^|\/)\.env(?:\.|$)/.test(path) && path !== '.env.example');
} catch {
  trackedSecretEnvironmentFiles = null;
}

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
const gitProvenanceContract = read('scripts/phase6/payments-git-provenance.mjs');
const sharedLaunchLibrary = read('scripts/phase9/lib.mjs');
require(/function gitStatusExcludingGeneratedPacket\(\)/.test(qaPacketBuilder) &&
  /payments-qa-packet\.json/.test(qaPacketBuilder) &&
  /payments-qa-packet\.md/.test(qaPacketBuilder) &&
  /gitStatusExcludingPaths\(packetOutputPaths\)/.test(qaPacketBuilder) &&
  !/gitStatusExcludingGeneratedEvidence/.test(qaPacketBuilder) &&
  /capturedGitStatus = gitStatusExcludingGeneratedPacket\(\)/.test(
    qaPacketBuilder,
  ), 'Phase 6 payments QA packet must ignore only its own generated outputs when recording Git status.');
require(/--porcelain=v1/.test(sharedLaunchLibrary) &&
  /--untracked-files=all/.test(sharedLaunchLibrary) &&
  /--ignore-submodules=none/.test(
    sharedLaunchLibrary,
  ), 'Phase 6 Git status must force porcelain output, all untracked files, and submodule inspection regardless of local Git config.');
require(/auditPhase6GitProvenance/.test(qaPacketBuilder) &&
  /blockers\.push\(\.\.\.gitProvenance\.blockers\)/.test(qaPacketBuilder) &&
  /warnings\.push\(\.\.\.gitProvenance\.warnings\)/.test(qaPacketBuilder) &&
  /gitProvenanceCaptured: gitProvenance\.captured/.test(qaPacketBuilder) &&
  /'UNAVAILABLE'/.test(qaPacketBuilder) &&
  /Phase 6 payments QA packet generated with a dirty Git worktree/.test(gitProvenanceContract) &&
  /Phase 6 final payments evidence requires a clean Git worktree/.test(gitProvenanceContract) &&
  /Phase 6 Git provenance is unavailable or noncanonical/.test(
    gitProvenanceContract,
  ), 'Phase 6 payments QA packet must block unavailable, noncanonical, or dirty Git provenance and expose truthful status.');
require(/requiredFilesMissingFromHead/.test(qaPacketBuilder) &&
  /requiredFilesDifferFromHead/.test(qaPacketBuilder) &&
  /git', \['hash-object'/.test(qaPacketBuilder) &&
  /trackedSecretEnvironmentFiles/.test(
    qaPacketBuilder,
  ), 'Phase 6 payments QA packet must require every input to be committed and byte-matched to HEAD and reject tracked secret env files.');
require(/collectLocalTypeScriptDependencyAndTestClosure/.test(qaPacketBuilder) &&
  /paymentDependencyFiles/.test(qaPacketBuilder) &&
  /localTypeScriptFiles\('apps\/mobile\/src\/features\/subscription'\)/.test(qaPacketBuilder) &&
  /localTypeScriptFiles\('supabase\/functions\/revenuecat-webhook'\)/.test(
    qaPacketBuilder,
  ), 'Phase 6 payments QA packet must include source and sibling-test dependency closures for durable deletion and every payment domain.');
require(/auditRevenueCatV2AccessEvidence/.test(qaPacketBuilder) &&
  /revenueCatV2AccessEvidence\.artifactSha256/.test(qaPacketBuilder) &&
  /revenueCatV2AccessEvidence\.v2SecretKeyFingerprintSha256/.test(qaPacketBuilder) &&
  /revenueCatV2AccessEvidence\.legacyV1SecretKeyFingerprintSha256/.test(qaPacketBuilder) &&
  /revenueCatV2AccessEvidence\.errors/.test(
    qaPacketBuilder,
  ), 'Phase 6 payments QA packet must hash and cross-bind exact project/key redacted RevenueCat access evidence.');
for (const file of [
  'package.json',
  'package-lock.json',
  'apps/mobile/package.json',
  'apps/mobile/eas.json',
  'supabase/functions/deno.lock',
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'apps/mobile/src/lib/iap/revenuecat.test.ts',
  'apps/mobile/src/lib/iap/revenuecatPublication.test.ts',
  'apps/mobile/src/features/subscription/store.ts',
  'apps/mobile/src/features/subscription/entitlement.ts',
  'apps/mobile/src/features/subscription/entitlementEvidence.ts',
  'apps/mobile/src/features/subscription/entitlementEvidence.test.ts',
  'apps/mobile/src/features/subscription/useEntitlement.ts',
  'apps/mobile/src/features/subscription/useSubscriptionOffering.ts',
  'apps/mobile/src/app/onboarding/paywall.tsx',
  'apps/mobile/src/app/paywall/upsell.tsx',
  'apps/mobile/src/app/paywall/reoffer.tsx',
  'apps/mobile/src/app/paywall/downgrade.tsx',
  'apps/mobile/src/app/paywall/winback.tsx',
  'apps/mobile/src/app/settings/subscription.tsx',
  'supabase/functions/revenuecat-webhook/index.ts',
  'supabase/functions/revenuecat-webhook/webhookCore.ts',
  'supabase/functions/revenuecat-webhook/webhookCore.test.ts',
  'supabase/functions/subscription-grants/index.ts',
  'supabase/functions/subscription-grants/grantErrors.ts',
  'supabase/functions/subscription-grants/grantErrors.test.ts',
  'supabase/functions/account-deletion/index.ts',
  'supabase/functions/account-deletion/durableDeletionRuntime.ts',
  'supabase/functions/account-deletion/durableDeletionRuntime.test.ts',
  'supabase/functions/account-deletion/durableProviderDeletion.ts',
  'supabase/functions/account-deletion/durableProviderDeletion.test.ts',
  'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts',
  'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.test.ts',
  'supabase/migrations/20260615000027_phase6_payments.sql',
  'supabase/migrations/20260612000009_entitlements.sql',
  'supabase/migrations/20260613000020_subscription_extensions.sql',
  'supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql',
  'supabase/migrations/20260713000041_revenuecat_webhook_atomic_projection.sql',
  'supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql',
  'supabase/migrations/20260713000049_revenuecat_deletion_barrier_guard.sql',
  'supabase/migrations/20260713000050_service_writer_deletion_barriers.sql',
  'supabase/migrations/20260713000051_revenuecat_identity_tombstones.sql',
  'supabase/migrations/20260713000052_account_publication_fence.sql',
  'apps/mobile/src/features/subscription/paywallMobileContracts.test.ts',
  'apps/mobile/src/features/subscription/store.test.ts',
  'apps/mobile/src/features/subscription/entitlement.test.ts',
  'apps/mobile/src/features/subscription/serverContracts.test.ts',
  'scripts/phase6/build-payments-qa-packet.mjs',
  'scripts/phase6/check-payments-env.mjs',
  'scripts/phase6/check-payments-env-smoke.mjs',
  'scripts/phase6/payments-git-provenance.mjs',
  'scripts/phase6/payments-git-provenance.test.mjs',
  'scripts/phase6/payments-revenuecat-access-evidence.mjs',
  'scripts/phase6/payments-revenuecat-access-evidence.test.mjs',
  'scripts/phase6/payments-source-contract.mjs',
  'scripts/phase6/payments-source-contract.test.mjs',
  'scripts/e2e/human-e2e-manifest.mjs',
  'scripts/phase9/lib.mjs',
  'docs/HUMAN_SIMULATED_E2E_TESTING.md',
  'docs/E2E_TESTING_CHECKLIST.md',
  'docs/USER_FLOW_TREE.md',
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
  'docs/phase-6/payments-runbook.md',
  'docs/phase-6/payments-qa-checklist.md',
  'docs/phase-6/phase-6-exit-review.md',
  'docs/phase-6/revenuecat-v2-access-evidence.template.json',
]) {
  require(qaPacketBuilder.includes(`'${file}'`) ||
    qaPacketBuilder.includes(`"${file}"`), `Phase 6 payments QA packet must hash ${file}.`);
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
const revenueCatDeletionSourceContract = auditRevenueCatDeletionSourceContract({
  entrypoint: read('supabase/functions/account-deletion/index.ts'),
  runtime: read('supabase/functions/account-deletion/durableDeletionRuntime.ts'),
  executor: read('supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts'),
  providerDeletion: read('supabase/functions/account-deletion/durableProviderDeletion.ts'),
});
for (const error of revenueCatDeletionSourceContract.errors) require(false, error);
require(has(
  'apps/mobile/src/features/subscription/useEntitlement.ts',
  /if \(env\.appEnvironment !== 'development'\) return null;/,
), 'Entitlement E2E fixture grants must be ignored outside development builds.');
require(has(
  'apps/mobile/src/features/subscription/useEntitlement.ts',
  /if \(env\.appEnvironment !== 'development'\) return 0;/,
), 'Entitlement E2E delay fixture must be ignored outside development builds.');

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
if (androidReleaseRequired) {
  warn(
    revenueCatPublicKey(prodEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, 'goog'),
    'Missing EXPO_PUBLIC_REVENUECAT_ANDROID_KEY for production.',
  );
}
warn(
  finalProductId(prodEnv.EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID),
  'Production annual RevenueCat product id must be a final App Store product id.',
);
warn(
  finalProductId(prodEnv.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID),
  'Production monthly RevenueCat product id must be a final App Store product id.',
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
  Object.hasOwn(exampleEnv, 'REVENUECAT_PROJECT_ID'),
  '.env.example must document REVENUECAT_PROJECT_ID.',
);
warn(
  Object.hasOwn(exampleEnv, 'REVENUECAT_V2_SECRET_API_KEY'),
  '.env.example must document REVENUECAT_V2_SECRET_API_KEY.',
);
warn(
  Object.hasOwn(exampleEnv, 'PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS'),
  '.env.example must document PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS.',
);
warn(
  Object.hasOwn(exampleEnv, 'PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH'),
  '.env.example must document PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH.',
);
warn(
  trackedSecretLeaks.length === 0,
  'Tracked templates/build config must not contain production server secrets.',
);
warn(
  trackedSecretEnvironmentFiles !== null && trackedSecretEnvironmentFiles.length === 0,
  'Git HEAD must be inspectable and must not contain a tracked secret .env file.',
);
warn(
  webhookSharedAuth(prodEnv.REVENUECAT_WEBHOOK_AUTH),
  'Production RevenueCat webhook shared auth must be a high-entropy 32-256 character token.',
);
warn(
  webhookSigningSecret(prodEnv.REVENUECAT_WEBHOOK_SIGNING_SECRET),
  'Production RevenueCat webhook signing secret must be a high-entropy whsec_ token.',
);
warn(
  revenueCatV1SecretKey(prodEnv.REVENUECAT_SECRET_API_KEY),
  'REVENUECAT_SECRET_API_KEY must be a final high-entropy sk_-prefixed legacy V1 key.',
);
warn(
  revenueCatProjectId(prodEnv.REVENUECAT_PROJECT_ID),
  'REVENUECAT_PROJECT_ID must be a final proj-prefixed production project ID.',
);
warn(
  revenueCatV2SecretKey(prodEnv.REVENUECAT_V2_SECRET_API_KEY),
  'REVENUECAT_V2_SECRET_API_KEY must be a final sk_-prefixed V2 secret key.',
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
  ...(androidReleaseRequired ? ['PHASE6_ANDROID_LICENSE_TEST_PASS'] : []),
  'PHASE6_WEBHOOK_HMAC_TEST_PASS',
  'PHASE6_FINANCE_SIGNOFF',
];
for (const key of externalEvidence) {
  warn(evidenceFlagEnabled(process.env[key]), `Missing external Phase 6 evidence: ${key}.`);
}
const signedOffBy = normalizePhase6Reviewer(process.env.PHASE6_SIGNED_OFF_BY, prodEnv);
const revenueCatV2AccessEvidence = auditRevenueCatV2AccessEvidence({
  root,
  evidencePath: String(process.env.PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH ?? ''),
  nowMs: checkNowMs,
  projectId: String(prodEnv.REVENUECAT_PROJECT_ID ?? ''),
  v2SecretKey: String(prodEnv.REVENUECAT_V2_SECRET_API_KEY ?? ''),
  legacySecretKey: String(prodEnv.REVENUECAT_SECRET_API_KEY ?? ''),
  signedOffBy,
});
for (const evidenceError of revenueCatV2AccessEvidence.errors) warn(false, evidenceError);
warn(
  evidenceFlagEnabled(process.env.PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS),
  'Missing external Phase 6 evidence: PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS=true. The flag only records review of retained production project/access evidence; it does not itself prove access or permissions.',
);
warn(Boolean(signedOffBy), 'Missing external Phase 6 evidence: PHASE6_SIGNED_OFF_BY.');

console.log('Phase 6 payments/entitlements check');
if (!androidReleaseRequired) {
  console.log('N/A Android RevenueCat key and license-test evidence: excluded by launch contract.');
}
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
