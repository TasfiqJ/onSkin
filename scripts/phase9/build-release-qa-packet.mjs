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
  printResult,
  requiredPhase9EvidenceKeys,
  warn,
  write,
} from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
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
  'apps/mobile/src/features/photos/store.ts',
  'apps/mobile/src/features/photos/usePhotos.ts',
  'apps/mobile/src/features/settings/actions.ts',
  'apps/mobile/src/features/settings/localDeviceExport.ts',
  'apps/mobile/src/features/settings/localDeviceExport.test.ts',
  'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
  'apps/mobile/src/features/settings/localPrivateData.ts',
  'apps/mobile/src/lib/storage/privateKV.ts',
  'apps/mobile/src/lib/storage/privateKV.test.ts',
  'apps/mobile/src/lib/applock/AppLockProvider.tsx',
  'apps/mobile/src/lib/applock/authenticate.ts',
  'apps/mobile/src/lib/applock/authenticate.test.ts',
  'apps/mobile/src/lib/auth/apple.ts',
  'supabase/functions/account-deletion/index.ts',
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
  'docs/phase-9/release-candidates/README.md',
  'docs/phase-9/release-candidates/_template/manifest.md',
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

const packet = {
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 && warnings.length === 0 ? 'ready' : 'blocked',
  gitSha,
  gitStatus,
  releaseIdentity: {
    appEnvironment: env.EXPO_PUBLIC_APP_ENV ?? null,
    finalBrandDomain: normalizeProductionDomain(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
    marketingUrl: normalizeProductionUrl(env.EXPO_PUBLIC_MARKETING_URL),
    appStoreUrl: normalizeProductionUrl(env.EXPO_PUBLIC_APP_STORE_URL),
    playStoreUrl: normalizeProductionUrl(env.EXPO_PUBLIC_PLAY_STORE_URL),
    supportEmail: normalizeProductionSupportEmail(env.EXPO_PUBLIC_SUPPORT_EMAIL),
  },
  releaseCandidate: {
    dir: releaseCandidateDir || null,
    files: releaseCandidateFiles,
  },
  evidence,
  signedOffBy: normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY) ?? '',
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
    `- Play Store URL: ${packet.releaseIdentity.playStoreUrl || 'BLOCKED'}`,
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
    '',
    '## Source Hashes',
    '',
    ...Object.entries(packet.sourceHashes).map(([file, value]) => `- \`${file}\`: \`${value}\``),
    '',
  ].join('\n'),
);

printResult('Phase 9 release QA packet', errors, warnings);
