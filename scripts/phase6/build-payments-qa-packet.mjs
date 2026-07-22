#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import {
  command,
  evidenceFlagEnabled,
  gitStatusExcludingPaths,
  placeholderEnvValue,
  productionUrl,
} from '../phase9/lib.mjs';
import {
  isReleasePlatformRequired,
  launchContractSnapshot,
  loadLaunchContract,
  platformEvidenceStatus,
  platformRequirementStatus,
} from '../launch/contract.mjs';
import { auditPhase6GitProvenance } from './payments-git-provenance.mjs';
import {
  auditRevenueCatV2AccessEvidence,
  normalizePhase6Reviewer,
} from './payments-revenuecat-access-evidence.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const packetGeneratedAt = new Date().toISOString();
const packetNowMs = Date.parse(packetGeneratedAt);
const launchContract = loadLaunchContract(root);
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);
const packetOutDir = process.env.PHASE6_PACKET_OUT_DIR ?? 'docs/phase-6/generated';
const outDir = resolve(root, packetOutDir);
const packetOutputPaths = [
  `${packetOutDir}/payments-qa-packet.json`,
  `${packetOutDir}/payments-qa-packet.md`,
].map((path) => path.replace(/\\/g, '/'));
const SERVER_SECRET_ENV_NAMES = Object.freeze([
  'REVENUECAT_WEBHOOK_AUTH',
  'REVENUECAT_WEBHOOK_SIGNING_SECRET',
  'REVENUECAT_SECRET_API_KEY',
  'REVENUECAT_V2_SECRET_API_KEY',
]);

function repoPath(absolutePath) {
  const path = relative(root, absolutePath).replaceAll('\\', '/');
  if (path.length === 0 || path === '..' || path.startsWith('../') || isAbsolute(path)) {
    throw new Error('Phase 6 dependency closure escaped the repository root.');
  }
  return path;
}

function localTypeScriptFiles(directoryPath) {
  const absoluteDirectory = resolve(root, directoryPath);
  const files = [];
  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const absolutePath = resolve(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...localTypeScriptFiles(repoPath(absolutePath)));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      files.push(repoPath(absolutePath));
    }
  }
  return files.sort();
}

function resolveLocalTypeScriptImport(fromPath, specifier) {
  if (!specifier.startsWith('.')) return null;
  const unresolved = resolve(root, dirname(fromPath), specifier);
  const candidates = [
    unresolved,
    `${unresolved}.ts`,
    `${unresolved}.tsx`,
    unresolved.endsWith('.js') ? `${unresolved.slice(0, -3)}.ts` : null,
    unresolved.endsWith('.js') ? `${unresolved.slice(0, -3)}.tsx` : null,
    resolve(unresolved, 'index.ts'),
    resolve(unresolved, 'index.tsx'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const rootPrefix = `${resolve(root)}${sep}`.toLowerCase();
    const normalized = resolve(candidate);
    if (!normalized.toLowerCase().startsWith(rootPrefix)) {
      throw new Error('Phase 6 dependency closure found an out-of-repository import.');
    }
    if (existsSync(normalized) && statSync(normalized).isFile()) return repoPath(normalized);
  }
  throw new Error(`Phase 6 dependency closure cannot resolve ${specifier} from ${fromPath}.`);
}

function collectLocalTypeScriptDependencyClosure(seedPaths) {
  const pending = [...seedPaths];
  const collected = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (collected.has(path)) continue;
    const absolutePath = resolve(root, path);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      throw new Error(`Phase 6 dependency closure is missing ${path}.`);
    }
    collected.add(path);
    const source = readFileSync(absolutePath, 'utf8');
    const imports = ts.preProcessFile(source, true, true).importedFiles;
    for (const imported of imports) {
      const dependency = resolveLocalTypeScriptImport(path, imported.fileName);
      if (dependency !== null && !collected.has(dependency)) pending.push(dependency);
    }
  }
  return [...collected].sort();
}

function collectLocalTypeScriptDependencyAndTestClosure(seedPaths) {
  let collected = collectLocalTypeScriptDependencyClosure(seedPaths);
  while (true) {
    const siblingTests = collected.flatMap((path) => {
      if (!/\.tsx?$/.test(path) || /\.test\.tsx?$/.test(path)) return [];
      const stem = path.replace(/\.tsx?$/, '');
      return [`${stem}.test.ts`, `${stem}.test.tsx`].filter((candidate) =>
        existsSync(resolve(root, candidate)),
      );
    });
    const expanded = collectLocalTypeScriptDependencyClosure([...collected, ...siblingTests]);
    if (expanded.length === collected.length) return expanded;
    collected = expanded;
  }
}

const durableDeletionDependencyFiles = collectLocalTypeScriptDependencyAndTestClosure([
  ...localTypeScriptFiles('supabase/functions/account-deletion'),
  'supabase/functions/_shared/fetch.test.ts',
]);
const paymentDependencyFiles = collectLocalTypeScriptDependencyAndTestClosure([
  ...localTypeScriptFiles('apps/mobile/src/features/subscription'),
  ...localTypeScriptFiles('apps/mobile/src/lib/iap'),
  ...localTypeScriptFiles('supabase/functions/revenuecat-webhook'),
  ...localTypeScriptFiles('supabase/functions/subscription-grants'),
  ...localTypeScriptFiles('supabase/functions/subscription-reconciliation'),
  ...localTypeScriptFiles('supabase/functions/order-report-poll'),
]);

const fixedRequiredFiles = [
  '.env.example',
  'package.json',
  'package-lock.json',
  'apps/mobile/package.json',
  'apps/mobile/eas.json',
  'supabase/functions/deno.lock',
  'docs/hugeToDo/launch-contract.json',
  'docs/hugeToDo/PAY-06-ENTITLEMENT-AUTHORITY-LANES-2026-07-14.md',
  'scripts/launch/contract.mjs',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'apps/mobile/src/lib/iap/revenuecat.test.ts',
  'apps/mobile/src/lib/iap/revenuecatPublication.test.ts',
  'apps/mobile/src/lib/env.ts',
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
  'supabase/functions/subscription-reconciliation/index.ts',
  'supabase/functions/subscription-reconciliation/publicationLease.ts',
  'supabase/functions/subscription-reconciliation/publicationLease.test.ts',
  'supabase/functions/subscription-reconciliation/reconciliationCore.ts',
  'supabase/functions/subscription-reconciliation/reconciliationCore.test.ts',
  'supabase/functions/subscription-reconciliation/reconciliationContract.test.ts',
  'supabase/functions/_shared/verifiedAuthSessionClaims.ts',
  'supabase/functions/account-deletion/index.ts',
  'supabase/functions/account-deletion/durableDeletionRuntime.ts',
  'supabase/functions/account-deletion/durableDeletionRuntime.test.ts',
  'supabase/functions/account-deletion/durableProviderDeletion.ts',
  'supabase/functions/account-deletion/durableProviderDeletion.test.ts',
  'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts',
  'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.test.ts',
  'supabase/functions/account-deletion/providerDeletion.ts',
  'supabase/functions/account-deletion/providerDeletion.test.ts',
  'supabase/functions/account-deletion/serviceRoleCleanup.ts',
  'supabase/functions/account-deletion/serviceRoleCleanup.test.ts',
  'supabase/functions/order-report-poll/index.ts',
  'supabase/functions/order-report-poll/orderAttributionCore.ts',
  'supabase/functions/order-report-poll/orderAttributionCore.test.ts',
  'supabase/migrations/20260615000027_phase6_payments.sql',
  'supabase/migrations/20260612000009_entitlements.sql',
  'supabase/migrations/20260613000020_subscription_extensions.sql',
  'supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql',
  'supabase/migrations/20260713000041_revenuecat_webhook_atomic_projection.sql',
  'supabase/migrations/20260713000044_reverse_trial_no_store_identity.sql',
  'supabase/migrations/20260713000046_account_service_row_scrub.sql',
  'supabase/migrations/20260713000047_account_obf_contribution_erasure.sql',
  'supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql',
  'supabase/migrations/20260713000049_revenuecat_deletion_barrier_guard.sql',
  'supabase/migrations/20260713000050_service_writer_deletion_barriers.sql',
  'supabase/migrations/20260713000051_revenuecat_identity_tombstones.sql',
  'supabase/migrations/20260713000052_account_publication_fence.sql',
  'supabase/migrations/20260714000053_entitlement_authority_lanes.sql',
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
  'scripts/phase2/check-env.mjs',
  'scripts/phase2/check-env-smoke.mjs',
  'scripts/phase9/supabase-policy-lint.mjs',
  'scripts/phase9/account-service-scrub-postgres-rehearsal.sql',
  'scripts/phase9/live-data-rights.mjs',
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
];
const baseRequiredFiles = [
  ...new Set([...fixedRequiredFiles, ...durableDeletionDependencyFiles, ...paymentDependencyFiles]),
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
    'authenticated Edge Function atomically grants exactly once in the app lane with null provider identity; access expires from the immutable grant window without mutating the store lane',
  ],
  [
    'Win-back',
    'approved commercial state is exact: no-offer launch returns unavailable and standard fallback; any later native Apple offer proves eligibility, localized price, purchase, renewal, and fallback',
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
  return gitStatusExcludingPaths(packetOutputPaths);
}

function trackedSecretEnvironmentFile(path) {
  return /(^|\/)\.env(?:\.|$)/.test(path) && path !== '.env.example';
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

const exampleEnv = envFile('.env.example');
const localEnv = envFile('.env');
const eas = readJson('apps/mobile/eas.json');
const productionEasEnv = eas.build?.production?.env ?? {};
const trackedSecretLeaks = trackedServerSecretLeaks(exampleEnv, productionEasEnv);
const prodEnv = mergeProductionEnvironment(exampleEnv, localEnv, productionEasEnv, process.env);

const productionConfig = {
  productionAppEnvironment: productionEasEnv.EXPO_PUBLIC_APP_ENV === 'production',
  productionHasNoTestStoreKey: !productionEasEnv.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY,
  entitlementIdIsPro: prodEnv.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID === 'pro',
  iosPublicKeyConfigured: revenueCatPublicKey(prodEnv.EXPO_PUBLIC_REVENUECAT_IOS_KEY, 'appl'),
  androidPublicKeyConfigured: androidReleaseRequired
    ? revenueCatPublicKey(prodEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, 'goog')
    : null,
  annualProductIdFinal: finalProductId(prodEnv.EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID),
  monthlyProductIdFinal: finalProductId(prodEnv.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID),
  trackedServerSecretsAbsent: trackedSecretLeaks.length === 0,
  webhookSharedAuthConfigured: webhookSharedAuth(prodEnv.REVENUECAT_WEBHOOK_AUTH),
  webhookSigningSecretConfigured: webhookSigningSecret(prodEnv.REVENUECAT_WEBHOOK_SIGNING_SECRET),
  secretApiKeyConfigured: revenueCatV1SecretKey(prodEnv.REVENUECAT_SECRET_API_KEY),
  revenueCatProjectIdConfigured: revenueCatProjectId(prodEnv.REVENUECAT_PROJECT_ID),
  revenueCatV2SecretApiKeyConfigured: revenueCatV2SecretKey(prodEnv.REVENUECAT_V2_SECRET_API_KEY),
  brandLegalClearanceRecorded: prodEnv.BRAND_LEGAL_CLEARANCE === 'cleared',
  privacyUrlProduction: productionUrl(prodEnv.EXPO_PUBLIC_PRIVACY_URL),
  termsUrlProduction: productionUrl(prodEnv.EXPO_PUBLIC_TERMS_URL),
  supportUrlProduction: productionUrl(prodEnv.EXPO_PUBLIC_SUPPORT_URL),
};

const productionConfigBlockers = [
  [
    'trackedServerSecretsAbsent',
    'Tracked templates/build config must not contain production server secrets.',
  ],
  ['productionAppEnvironment', 'EAS production profile must set EXPO_PUBLIC_APP_ENV=production.'],
  [
    'productionHasNoTestStoreKey',
    'EAS production profile must not include RevenueCat Test Store key.',
  ],
  ['entitlementIdIsPro', 'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID must be `pro`.'],
  ['iosPublicKeyConfigured', 'Missing final EXPO_PUBLIC_REVENUECAT_IOS_KEY.'],
  ...(androidReleaseRequired
    ? [['androidPublicKeyConfigured', 'Missing final EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.']]
    : []),
  ['annualProductIdFinal', 'Missing final EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID.'],
  ['monthlyProductIdFinal', 'Missing final EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID.'],
  [
    'webhookSharedAuthConfigured',
    'REVENUECAT_WEBHOOK_AUTH must be a high-entropy 32-256 character token.',
  ],
  [
    'webhookSigningSecretConfigured',
    'REVENUECAT_WEBHOOK_SIGNING_SECRET must be a high-entropy whsec_ token.',
  ],
  [
    'secretApiKeyConfigured',
    'REVENUECAT_SECRET_API_KEY must be a final high-entropy sk_-prefixed legacy V1 key.',
  ],
  [
    'revenueCatProjectIdConfigured',
    'REVENUECAT_PROJECT_ID must be a final proj-prefixed production project ID.',
  ],
  [
    'revenueCatV2SecretApiKeyConfigured',
    'REVENUECAT_V2_SECRET_API_KEY must be a final sk_-prefixed V2 secret key.',
  ],
  ['brandLegalClearanceRecorded', 'BRAND_LEGAL_CLEARANCE must be cleared for production.'],
  ['privacyUrlProduction', 'EXPO_PUBLIC_PRIVACY_URL must be a production HTTPS URL.'],
  ['termsUrlProduction', 'EXPO_PUBLIC_TERMS_URL must be a production HTTPS URL.'],
  ['supportUrlProduction', 'EXPO_PUBLIC_SUPPORT_URL must be a production HTTPS URL.'],
];

const evidence = {
  rcOfferingReviewed: evidenceFlagEnabled(process.env.PHASE6_RC_OFFERING_REVIEWED),
  iosSandboxRestorePass: evidenceFlagEnabled(process.env.PHASE6_IOS_SANDBOX_RESTORE_PASS),
  androidLicenseTestPass: androidReleaseRequired
    ? evidenceFlagEnabled(process.env.PHASE6_ANDROID_LICENSE_TEST_PASS)
    : null,
  revenueCatV2CustomerDeleteAccessPass: evidenceFlagEnabled(
    process.env.PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS,
  ),
  webhookHmacTestPass: evidenceFlagEnabled(process.env.PHASE6_WEBHOOK_HMAC_TEST_PASS),
  financeSignoff: evidenceFlagEnabled(process.env.PHASE6_FINANCE_SIGNOFF),
  signedOffBy: normalizePhase6Reviewer(process.env.PHASE6_SIGNED_OFF_BY, prodEnv),
};

const revenueCatV2AccessEvidence = auditRevenueCatV2AccessEvidence({
  root,
  evidencePath: String(process.env.PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH ?? ''),
  nowMs: packetNowMs,
  projectId: String(prodEnv.REVENUECAT_PROJECT_ID ?? ''),
  v2SecretKey: String(prodEnv.REVENUECAT_V2_SECRET_API_KEY ?? ''),
  legacySecretKey: String(prodEnv.REVENUECAT_SECRET_API_KEY ?? ''),
  signedOffBy: evidence.signedOffBy,
});
const requiredFiles = [
  ...new Set([
    ...baseRequiredFiles,
    ...(revenueCatV2AccessEvidence.path ? [revenueCatV2AccessEvidence.path] : []),
  ]),
];
const files = requiredFiles.map(hashFile);
const blockers = [];
const warnings = [];
const revenueCatV2AccessEvidenceFile = files.find(
  (file) => file.path === revenueCatV2AccessEvidence.path,
);
if (
  revenueCatV2AccessEvidence.path &&
  revenueCatV2AccessEvidenceFile?.exists &&
  revenueCatV2AccessEvidenceFile?.sha256 !== revenueCatV2AccessEvidence.artifactSha256
) {
  blockers.push('RevenueCat V2 access evidence changed while the QA packet was built.');
}
let capturedGitSha = '';
let capturedGitStatus = '';
let capturedGitProvenance = false;
let capturedHeadFileTracking = false;
let requiredFilesMissingFromHead = [...requiredFiles];
let requiredFilesDifferFromHead = [];
let trackedSecretEnvironmentFiles = [];
try {
  capturedGitSha = command('git', ['rev-parse', 'HEAD']).trim();
  capturedGitStatus = gitStatusExcludingGeneratedPacket();
  capturedGitProvenance = true;
  const headEntries = new Map();
  for (let index = 0; index < requiredFiles.length; index += 40) {
    const chunk = requiredFiles.slice(index, index + 40);
    for (const line of command('git', ['ls-tree', '-r', 'HEAD', '--', ...chunk])
      .split(/\r?\n/)
      .filter(Boolean)) {
      const [metadata, rawPath] = line.split('\t');
      const objectName = metadata?.split(' ')[2] ?? '';
      const path = rawPath?.replaceAll('\\', '/') ?? '';
      if (path && /^[0-9a-f]{40,64}$/.test(objectName)) headEntries.set(path, objectName);
    }
  }
  requiredFilesMissingFromHead = requiredFiles.filter((path) => !headEntries.has(path));
  const hashablePaths = requiredFiles.filter(
    (path) => headEntries.has(path) && existsSync(resolve(root, path)),
  );
  const worktreeObjects = command('git', ['hash-object', '--stdin-paths'], {
    input: `${hashablePaths.join('\n')}\n`,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
    .split(/\r?\n/)
    .filter(Boolean);
  if (worktreeObjects.length !== hashablePaths.length) {
    throw new Error('Phase 6 worktree object hashing returned an incomplete result.');
  }
  requiredFilesDifferFromHead = hashablePaths.filter(
    (path, index) => worktreeObjects[index] !== headEntries.get(path),
  );
  trackedSecretEnvironmentFiles = command('git', ['ls-tree', '-r', '--name-only', 'HEAD'], {
    maxBuffer: 16 * 1024 * 1024,
  })
    .split(/\r?\n/)
    .map((path) => path.replaceAll('\\', '/').trim())
    .filter(trackedSecretEnvironmentFile)
    .sort();
  capturedHeadFileTracking = true;
} catch {
  capturedGitProvenance = false;
  capturedHeadFileTracking = false;
}
const gitProvenance = auditPhase6GitProvenance({
  captured: capturedGitProvenance,
  sha: capturedGitSha,
  status: capturedGitStatus,
});
blockers.push(...gitProvenance.blockers);
warnings.push(...gitProvenance.warnings);
if (!capturedHeadFileTracking) {
  blockers.push('Phase 6 required-file Git tracking could not be verified against HEAD.');
} else {
  for (const path of requiredFilesMissingFromHead) {
    blockers.push(`Phase 6 required input is not committed at HEAD: ${path}.`);
  }
  for (const path of requiredFilesDifferFromHead) {
    blockers.push(`Phase 6 required input bytes differ from HEAD: ${path}.`);
  }
  for (const path of trackedSecretEnvironmentFiles) {
    blockers.push(`Tracked secret environment file is forbidden: ${path}.`);
  }
}
for (const file of files) if (!file.exists) blockers.push(`Missing ${file.path}.`);
blockers.push(...revenueCatV2AccessEvidence.errors);
for (const [key, message] of productionConfigBlockers) {
  if (!productionConfig[key]) blockers.push(message);
}
if (!evidence.rcOfferingReviewed) blockers.push('Missing PHASE6_RC_OFFERING_REVIEWED=true.');
if (!evidence.iosSandboxRestorePass) blockers.push('Missing PHASE6_IOS_SANDBOX_RESTORE_PASS=true.');
if (androidReleaseRequired && !evidence.androidLicenseTestPass)
  blockers.push('Missing PHASE6_ANDROID_LICENSE_TEST_PASS=true.');
if (!evidence.revenueCatV2CustomerDeleteAccessPass)
  blockers.push('Missing PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS=true.');
if (!evidence.webhookHmacTestPass) blockers.push('Missing PHASE6_WEBHOOK_HMAC_TEST_PASS=true.');
if (!evidence.financeSignoff) blockers.push('Missing PHASE6_FINANCE_SIGNOFF=true.');
if (!evidence.signedOffBy) blockers.push('Missing PHASE6_SIGNED_OFF_BY.');

const packet = {
  generatedAt: packetGeneratedAt,
  purpose: 'Phase 6 payments, entitlements, restore, webhook, and account-deletion QA packet.',
  launchContract: launchContractSnapshot(launchContract),
  platformStatus: {
    ios: platformRequirementStatus('ios', launchContract),
    android: platformRequirementStatus('android', launchContract),
  },
  platformEvidenceStatus: {
    iosSandboxRestore: platformEvidenceStatus(
      'ios',
      evidence.iosSandboxRestorePass,
      launchContract,
    ),
    androidLicenseTest: platformEvidenceStatus(
      'android',
      evidence.androidLicenseTestPass,
      launchContract,
    ),
  },
  gitSha: gitProvenance.gitSha,
  gitStatus: gitProvenance.gitStatus,
  gitProvenanceCaptured: gitProvenance.captured,
  headFileTrackingCaptured: capturedHeadFileTracking,
  requiredFilesMissingFromHead,
  requiredFilesDifferFromHead,
  trackedSecretEnvironmentFiles,
  revenueCatV2AccessEvidence: {
    valid: revenueCatV2AccessEvidence.valid,
    path: revenueCatV2AccessEvidence.path,
    sha256: revenueCatV2AccessEvidence.artifactSha256,
    projectId: revenueCatV2AccessEvidence.projectId,
    v2SecretKeyFingerprintSha256: revenueCatV2AccessEvidence.v2SecretKeyFingerprintSha256,
    legacyV1SecretKeyFingerprintSha256:
      revenueCatV2AccessEvidence.legacyV1SecretKeyFingerprintSha256,
    reviewedAt: revenueCatV2AccessEvidence.reviewedAt,
    reviewedBy: revenueCatV2AccessEvidence.reviewedBy,
  },
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
    `Git status: ${packet.gitProvenanceCaptured ? (packet.gitStatus ? 'DIRTY' : 'clean') : 'UNAVAILABLE'}`,
    `Required inputs committed and byte-matched to HEAD: ${packet.headFileTrackingCaptured && packet.requiredFilesMissingFromHead.length === 0 && packet.requiredFilesDifferFromHead.length === 0 ? 'yes' : 'BLOCKED'}`,
    `Tracked secret environment files absent: ${packet.headFileTrackingCaptured && packet.trackedSecretEnvironmentFiles.length === 0 ? 'yes' : 'BLOCKED'}`,
    '',
    'Strict completion requires real RevenueCat offering review and store restore evidence for every contract-required platform, webhook HMAC replay evidence, finance signoff, and a named owner.',
    '',
    '## Evidence',
    '',
    `- RevenueCat offering reviewed: ${evidence.rcOfferingReviewed ? 'yes' : 'BLOCKED'}`,
    `- iOS sandbox restore pass: ${evidence.iosSandboxRestorePass ? 'yes' : 'BLOCKED'}`,
    `- Android license test pass: ${packet.platformEvidenceStatus.androidLicenseTest === 'not_applicable' ? 'NOT APPLICABLE' : evidence.androidLicenseTestPass ? 'yes' : 'BLOCKED'}`,
    `- Retained RevenueCat V2 production project/access evidence attested: ${evidence.revenueCatV2CustomerDeleteAccessPass ? 'yes' : 'BLOCKED'} (the flag records that retained evidence was reviewed; it does not itself prove access or permissions)`,
    `- RevenueCat V2 redacted access evidence valid: ${packet.revenueCatV2AccessEvidence.valid ? 'yes' : 'BLOCKED'}`,
    `- RevenueCat V2 access evidence path: ${packet.revenueCatV2AccessEvidence.path || 'BLOCKED'}`,
    `- RevenueCat V2 access evidence SHA-256: ${packet.revenueCatV2AccessEvidence.sha256 || 'BLOCKED'}`,
    `- RevenueCat V2 evidence project ID: ${packet.revenueCatV2AccessEvidence.projectId || 'BLOCKED'}`,
    `- RevenueCat V2 key binding fingerprint (SHA-256; not proof of access): ${packet.revenueCatV2AccessEvidence.v2SecretKeyFingerprintSha256 || 'BLOCKED'}`,
    `- RevenueCat legacy V1 key binding fingerprint (SHA-256; not proof of access): ${packet.revenueCatV2AccessEvidence.legacyV1SecretKeyFingerprintSha256 || 'BLOCKED'}`,
    `- RevenueCat V2 access evidence reviewed at: ${packet.revenueCatV2AccessEvidence.reviewedAt || 'BLOCKED'}`,
    `- RevenueCat V2 access evidence reviewed by: ${packet.revenueCatV2AccessEvidence.reviewedBy || 'BLOCKED'}`,
    `- Webhook HMAC test pass: ${evidence.webhookHmacTestPass ? 'yes' : 'BLOCKED'}`,
    `- Finance signoff: ${evidence.financeSignoff ? 'yes' : 'BLOCKED'}`,
    `- Signed off by: ${evidence.signedOffBy || 'BLOCKED'}`,
    '',
    '## Production Config',
    '',
    `- EAS production app environment: ${productionConfig.productionAppEnvironment ? 'yes' : 'BLOCKED'}`,
    `- Tracked templates/build config exclude server secrets: ${productionConfig.trackedServerSecretsAbsent ? 'yes' : 'BLOCKED'}`,
    `- Production excludes RevenueCat Test Store key: ${productionConfig.productionHasNoTestStoreKey ? 'yes' : 'BLOCKED'}`,
    `- Entitlement ID is pro: ${productionConfig.entitlementIdIsPro ? 'yes' : 'BLOCKED'}`,
    `- iOS RevenueCat public key configured: ${productionConfig.iosPublicKeyConfigured ? 'yes' : 'BLOCKED'}`,
    `- Android RevenueCat public key configured: ${androidReleaseRequired ? (productionConfig.androidPublicKeyConfigured ? 'yes' : 'BLOCKED') : 'NOT APPLICABLE'}`,
    `- Annual product ID final: ${productionConfig.annualProductIdFinal ? 'yes' : 'BLOCKED'}`,
    `- Monthly product ID final: ${productionConfig.monthlyProductIdFinal ? 'yes' : 'BLOCKED'}`,
    `- Webhook shared auth configured: ${productionConfig.webhookSharedAuthConfigured ? 'yes' : 'BLOCKED'}`,
    `- Webhook signing secret configured: ${productionConfig.webhookSigningSecretConfigured ? 'yes' : 'BLOCKED'}`,
    `- RevenueCat secret API key configured: ${productionConfig.secretApiKeyConfigured ? 'yes' : 'BLOCKED'}`,
    `- RevenueCat project ID configured: ${productionConfig.revenueCatProjectIdConfigured ? 'yes' : 'BLOCKED'}`,
    `- RevenueCat V2 secret API key configured: ${productionConfig.revenueCatV2SecretApiKeyConfigured ? 'yes' : 'BLOCKED'}`,
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
