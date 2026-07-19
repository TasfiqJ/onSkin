#!/usr/bin/env node
import {
  block,
  abs,
  command,
  envSnapshot,
  evidenceFlagEnabled,
  exists,
  gitStatusExcludingGeneratedEvidence,
  hash,
  listFiles,
  markdownList,
  normalizeNamedSignoff,
  normalizeProductionDomain,
  normalizeProductionSupportEmail,
  normalizeProductionUrl,
  notApplicablePhase9EvidenceKeys,
  printResult,
  requiredPhase9EvidenceKeys,
  warn,
  write,
} from './lib.mjs';
import {
  isReleasePlatformRequired,
  launchContractSnapshot,
  loadLaunchContract,
  platformRequirementStatus,
} from '../launch/contract.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const launchContract = loadLaunchContract();
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);
const packetOutDir = String(env.PHASE9_PACKET_OUT_DIR ?? '').trim();
const outDir = packetOutDir || 'docs/phase-9/generated';
const packetOutputPaths = [
  `${outDir}/release-engineering-qa-packet.json`,
  `${outDir}/release-engineering-qa-packet.md`,
].map((path) => path.replace(/\\/g, '/'));

function gitStatusExcludingGeneratedPacket() {
  return gitStatusExcludingGeneratedEvidence(packetOutputPaths);
}

const sourceFiles = [
  '.env.example',
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  'package.json',
  'package-lock.json',
  '.github/workflows/security.yml',
  'apps/mobile/app.base.json',
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
  'apps/mobile/src/lib/env.ts',
  'apps/mobile/src/lib/env.test.ts',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
  'apps/mobile/src/lib/analytics/eventRegistry.ts',
  'apps/mobile/src/lib/analytics/track.ts',
  'apps/mobile/src/app/community/ask.tsx',
  'apps/mobile/src/app/community/people-like-you.tsx',
  'apps/mobile/src/app/trend/optin.tsx',
  'apps/mobile/src/app/routine/widgets.tsx',
  'apps/mobile/src/app/routine/_layout.tsx',
  'apps/mobile/src/features/subscription/gatedRoutes.ts',
  'apps/mobile/src/features/subscription/copy.ts',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'apps/mobile/src/lib/observability/scrub.ts',
  'apps/mobile/src/lib/observability/sentry.ts',
  'apps/mobile/src/app/(tabs)/you.tsx',
  'apps/mobile/src/app/(tabs)/progress.tsx',
  'apps/mobile/src/app/progress/capture.tsx',
  'apps/mobile/src/app/progress/review.tsx',
  'apps/mobile/src/app/progress/[id].tsx',
  'apps/mobile/src/features/photos/PhotoTimelineLockGate.tsx',
  'apps/mobile/src/features/photos/PhotoStorageGate.tsx',
  'apps/mobile/src/features/photos/encryptedStorage.ts',
  'apps/mobile/src/features/photos/encryptedStorage.test.ts',
  'apps/mobile/src/features/photos/store.ts',
  'apps/mobile/src/features/photos/store.test.ts',
  'apps/mobile/src/features/photos/usePhotos.ts',
  'apps/mobile/src/features/settings/actions.ts',
  'apps/mobile/src/features/settings/localDeviceExport.ts',
  'apps/mobile/src/features/settings/localDeviceExport.test.ts',
  'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
  'apps/mobile/src/features/settings/localPrivateData.ts',
  'apps/mobile/src/lib/storage/privateKV.ts',
  'apps/mobile/src/lib/storage/privateKV.test.ts',
  'apps/mobile/src/lib/supabase/largeSecureStore.ts',
  'apps/mobile/src/lib/supabase/largeSecureStore.test.ts',
  'apps/mobile/src/lib/applock/AppLockProvider.tsx',
  'apps/mobile/src/lib/applock/authenticate.ts',
  'apps/mobile/src/lib/applock/authenticate.test.ts',
  'apps/mobile/src/lib/applock/singleFlight.ts',
  'apps/mobile/src/lib/applock/singleFlight.test.ts',
  'apps/mobile/src/lib/auth/accountGeneration.ts',
  'apps/mobile/src/lib/auth/accountGeneration.test.ts',
  'apps/mobile/src/lib/auth/localAccountIsolation.ts',
  'apps/mobile/src/lib/auth/localAccountIsolation.test.ts',
  'apps/mobile/src/lib/auth/apple.ts',
  'apps/mobile/src/lib/auth/apple.test.ts',
  'apps/mobile/src/features/settings/actions.ts',
  'apps/mobile/src/features/settings/actions.test.ts',
  'supabase/functions/account-deletion/index.ts',
  'supabase/functions/account-deletion/deletionCore.ts',
  'supabase/functions/account-deletion/deletionCore.test.ts',
  'supabase/functions/account-deletion/supabaseDeletionState.ts',
  'supabase/functions/account-deletion/supabaseDeletionState.test.ts',
  'supabase/functions/account-deletion/deletionMigrationContract.test.ts',
  'supabase/functions/account-deletion/photoStorageCleanup.ts',
  'supabase/functions/account-deletion/photoStorageCleanup.test.ts',
  'supabase/functions/account-deletion/RECOVERY.md',
  'supabase/migrations/20260713000043_account_deletion_resumable.sql',
  'supabase/functions/_shared/body.ts',
  'supabase/functions/_shared/fetch.ts',
  'supabase/functions/_shared/storagePath.ts',
  'supabase/functions/_shared/storagePath.test.ts',
  'supabase/functions/data-export/index.ts',
  'supabase/functions/consent-withdrawal/index.ts',
  'supabase/functions/subscription-grants/index.ts',
  'supabase/functions/catalog-search/index.ts',
  'supabase/functions/catalog-search/catalogContract.ts',
  'supabase/functions/catalog-search/catalogContract.test.ts',
  'supabase/functions/catalog-lookup/index.ts',
  'supabase/functions/catalog-lookup/catalogContract.ts',
  'supabase/functions/catalog-lookup/catalogContract.test.ts',
  'supabase/functions/catalog-report/index.ts',
  'supabase/functions/catalog-report/privacy.ts',
  'supabase/functions/catalog-report/privacy.test.ts',
  'supabase/functions/revenuecat-webhook/index.ts',
  'supabase/migrations/20260705000034_phase9_security_definer_hardening.sql',
  'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
  'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
  'scripts/phase9/lib.mjs',
  'scripts/phase9/release-contact-smoke.mjs',
  'scripts/phase9/evidence-normalization-smoke.mjs',
  'scripts/phase9/release-artifact-contract.mjs',
  'scripts/phase9/release-artifact-contract-smoke.mjs',
  'scripts/phase9/ios-artifact-inspection.mjs',
  'scripts/phase9/ios-artifact-inspection-smoke.mjs',
  'scripts/phase9/sentry-recovery-verification.mjs',
  'scripts/phase9/sentry-recovery-verification-smoke.mjs',
  'scripts/phase9/release-smoke.mjs',
  'scripts/phase9/rls-adversarial.mjs',
  'scripts/phase9/build-release-qa-packet.mjs',
  'scripts/phase9/live-supabase-adversarial.mjs',
  'scripts/phase9/live-edge-auth.mjs',
  'scripts/phase9/live-data-rights.mjs',
  'scripts/phase9/live-consent-withdrawal.mjs',
  'scripts/phase9/live-public-forms.mjs',
  'scripts/phase9/live-catalog-rate-limit.mjs',
  'scripts/phase9/live-order-report-poll.mjs',
  'scripts/phase9/live-revenuecat-webhook.mjs',
  'scripts/phase9/edge-auth-smoke.mjs',
  'scripts/phase9/edge-functions-check.mjs',
  'scripts/phase9/data-rights-smoke.mjs',
  'scripts/phase9/consent-withdrawal-smoke.mjs',
  'scripts/phase9/supabase-policy-lint.mjs',
  'scripts/phase9/security-ci-smoke.mjs',
  'scripts/phase9/privacy-payload-audit.mjs',
  'scripts/phase9/dependency-sbom.mjs',
  'scripts/phase9/store-build-inspect.mjs',
  'docs/phase-9/source-of-truth.md',
  'docs/phase-9/data-inventory.md',
  'docs/phase-9/edge-function-auth-matrix.md',
  'docs/phase-9/observability-payload-audit.md',
  'docs/phase-9/security-scanner-evidence.md',
  'docs/phase-9/rollout-rollback-plan.md',
  'docs/phase-9/incident-response-plan.md',
  'docs/phase-9/beta-evidence-summary.md',
  'docs/phase-9/dependency-sbom.md',
  'docs/phase-9/release-artifact-evidence.md',
  'docs/phase-9/release-candidates/README.md',
  'docs/phase-9/release-candidates/_template/manifest.md',
  'docs/phase-9/release-candidates/_template/release-artifacts.json',
  'docs/phase-9/release-candidates/_template/commands.md',
  'docs/phase-9/release-candidates/_template/automated-verification.md',
  'docs/phase-9/release-candidates/_template/manual-qa-matrix.md',
  'docs/phase-9/release-candidates/_template/security-review.md',
  'docs/phase-9/release-candidates/_template/privacy-review.md',
  'docs/phase-9/release-candidates/_template/payments-review.md',
  'docs/phase-9/release-candidates/_template/observability-review.md',
  'docs/phase-9/release-candidates/_template/store-review-packet.md',
  'docs/phase-9/release-candidates/_template/rollout-plan.md',
  'docs/phase-9/release-candidates/_template/incident-plan.md',
  'docs/phase-9/release-candidates/_template/signoff.md',
];

for (const file of sourceFiles)
  block(errors, exists(file), `${file} is missing from QA packet inputs.`);

let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedPacket();
} catch {
  warn(warnings, false, 'Git SHA/status could not be captured.');
}
warn(
  warnings,
  gitStatus.length === 0,
  'Release QA packet generated with a dirty Git worktree; do not use it as final RC evidence.',
);

const evidence = Object.fromEntries(
  requiredPhase9EvidenceKeys().map((key) => [key, evidenceFlagEnabled(env[key])]),
);
const notApplicableEvidence = Object.fromEntries(
  notApplicablePhase9EvidenceKeys(launchContract).map((key) => [key, 'not_applicable']),
);
for (const [key, passed] of Object.entries(evidence)) {
  warn(warnings, passed, `External RC evidence missing: ${key}=true.`);
}
warn(
  warnings,
  Boolean(normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY)),
  'External RC evidence missing: PHASE9_SIGNED_OFF_BY.',
);

const releaseCandidateDir = String(env.PHASE9_RELEASE_CANDIDATE_DIR ?? '')
  .replace(/\\/g, '/')
  .replace(/\/+$/g, '');
const releaseCandidateFiles =
  releaseCandidateDir && exists(releaseCandidateDir)
    ? listFiles(releaseCandidateDir).map((file) =>
        file.replace(abs('.'), '').replace(/\\/g, '/').replace(/^\/+/, ''),
      )
    : [];

const linkedEvidenceHashes = Object.fromEntries(
  [
    ['performanceEvidence', 'PHASE5_PERFORMANCE_EVIDENCE_PATH'],
    ['iosBinary', 'PHASE9_IOS_ARTIFACT'],
    ['iosDsymArchive', 'PHASE9_IOS_DSYM_ARCHIVE'],
    ['iosHermesSourceMap', 'PHASE9_IOS_HERMES_SOURCE_MAP'],
    ['iosBinaryUuidEvidence', 'PHASE9_IOS_BINARY_UUID_EVIDENCE'],
    ['iosDsymUuidEvidence', 'PHASE9_IOS_DSYM_UUID_EVIDENCE'],
    ['iosHermesDebugIdEvidence', 'PHASE9_IOS_HERMES_DEBUG_ID_EVIDENCE'],
    ['iosSentryUploadReceipt', 'PHASE9_SENTRY_IOS_UPLOAD_RECEIPT'],
    ['iosSentryRecoveryReceipt', 'PHASE9_SENTRY_IOS_RECOVERY_RECEIPT'],
  ].map(([label, key]) => {
    const path = String(env[key] ?? '').trim();
    return [label, path && exists(path) ? hash(path) : null];
  }),
);
const signedOffBy = normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY) ?? '';
const exactReleaseClaimed = Object.values(evidence).some(Boolean) || Boolean(signedOffBy);
if (exactReleaseClaimed) {
  for (const [label, value] of Object.entries(linkedEvidenceHashes)) {
    block(errors, Boolean(value), `Claimed release evidence requires ${label}.`);
  }
  try {
    command(process.execPath, ['scripts/phase9/release-smoke.mjs', '--strict']);
  } catch {
    block(errors, false, 'Claimed release evidence must pass the exact-release artifact gate.');
  }
}

const packet = {
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 && warnings.length === 0 ? 'ready' : 'blocked',
  launchContract: launchContractSnapshot(launchContract),
  platformStatus: {
    ios: platformRequirementStatus('ios', launchContract),
    android: platformRequirementStatus('android', launchContract),
  },
  gitSha,
  gitStatus,
  releaseIdentity: {
    appEnvironment: env.EXPO_PUBLIC_APP_ENV ?? null,
    finalBrandDomain: normalizeProductionDomain(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
    marketingUrl: normalizeProductionUrl(env.EXPO_PUBLIC_MARKETING_URL),
    appStoreUrl: normalizeProductionUrl(env.EXPO_PUBLIC_APP_STORE_URL),
    playStoreUrl: androidReleaseRequired
      ? normalizeProductionUrl(env.EXPO_PUBLIC_PLAY_STORE_URL)
      : null,
    supportEmail: normalizeProductionSupportEmail(env.EXPO_PUBLIC_SUPPORT_EMAIL),
  },
  releaseCandidate: {
    dir: releaseCandidateDir || null,
    files: releaseCandidateFiles,
  },
  evidence,
  notApplicableEvidence,
  signedOffBy,
  linkedEvidenceHashes,
  sourceHashes: Object.fromEntries(
    [...sourceFiles, ...releaseCandidateFiles].filter(exists).map((file) => [file, hash(file)]),
  ),
  blockers: errors,
  warnings,
};

write(`${outDir}/release-engineering-qa-packet.json`, `${JSON.stringify(packet, null, 2)}\n`);
write(
  `${outDir}/release-engineering-qa-packet.md`,
  [
    '# Phase 9 Release Engineering QA Packet',
    '',
    `Generated: ${packet.generatedAt}`,
    `Status: ${packet.status}`,
    `Git SHA: ${packet.gitSha}`,
    `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
    '',
    '## Release Identity',
    '',
    `- Environment: ${packet.releaseIdentity.appEnvironment || 'BLOCKED'}`,
    `- Final domain: ${packet.releaseIdentity.finalBrandDomain || 'BLOCKED'}`,
    `- Marketing URL: ${packet.releaseIdentity.marketingUrl || 'BLOCKED'}`,
    `- App Store URL: ${packet.releaseIdentity.appStoreUrl || 'BLOCKED'}`,
    `- Play Store URL: ${androidReleaseRequired ? packet.releaseIdentity.playStoreUrl || 'BLOCKED' : 'NOT APPLICABLE'}`,
    `- Support email: ${packet.releaseIdentity.supportEmail || 'BLOCKED'}`,
    `- Signed off by: ${packet.signedOffBy || 'BLOCKED'}`,
    `- Release candidate folder: ${packet.releaseCandidate.dir || 'BLOCKED'}`,
    '',
    '## Blockers',
    '',
    ...markdownList(errors, '- None from packet inputs.'),
    '',
    '## Warnings',
    '',
    ...markdownList(warnings),
    '',
    '## Evidence',
    '',
    ...Object.entries(evidence).map(([key, value]) => `- ${key}: ${value ? 'PASS' : 'BLOCKED'}`),
    ...Object.entries(notApplicableEvidence).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Linked Exact-Release Evidence Hashes',
    '',
    ...Object.entries(linkedEvidenceHashes).map(
      ([label, value]) => `- ${label}: ${value ? `\`${value}\`` : 'BLOCKED'}`,
    ),
    '',
    '## Source Hashes',
    '',
    ...Object.entries(packet.sourceHashes).map(([file, value]) => `- \`${file}\`: \`${value}\``),
    '',
  ].join('\n'),
);

printResult('Phase 9 release QA packet', errors, warnings);
