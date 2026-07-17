#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  revenueCatV1SecretKeyFingerprint,
  revenueCatV2SecretKeyFingerprint,
} from './payments-revenuecat-access-evidence.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const checkEnvPath = resolve(scriptDir, 'check-payments-env.mjs');
const packetPath = resolve(scriptDir, 'build-payments-qa-packet.mjs');
const localContractTestPaths = [
  resolve(scriptDir, 'payments-source-contract.test.mjs'),
  resolve(scriptDir, 'payments-git-provenance.test.mjs'),
  resolve(scriptDir, 'payments-revenuecat-access-evidence.test.mjs'),
];
const accountDeletionSourcePaths = readdirSync(
  resolve(root, 'supabase/functions/account-deletion'),
  { withFileTypes: true },
)
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
  .map((entry) => `supabase/functions/account-deletion/${entry.name}`)
  .sort();

const passthroughKeys = [
  'ComSpec',
  'HOME',
  'Path',
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'WINDIR',
];

const processBaseEnv = Object.fromEntries(
  passthroughKeys
    .map((key) => [key, process.env[key]])
    .filter(([, value]) => typeof value === 'string' && value.length > 0),
);

const revenueCatProjectId = 'projlivevalue123';
const revenueCatV2SecretApiKey = 'sk_V2SmokeAccessKey2026Alpha789';
const revenueCatLegacySecretApiKey = 'sk_LegacySmokeKey2026Beta789';
const accessEvidenceReviewedAt = new Date().toISOString();
const accessEvidenceFixturePath = `docs/phase-6/revenuecat-v2-access-evidence.smoke-${process.pid}.json`;
const accessEvidenceFixtureAbsolutePath = resolve(root, accessEvidenceFixturePath);

function accessEvidenceDocument() {
  return {
    schemaVersion: 1,
    status: 'complete',
    provider: 'revenuecat',
    environment: 'production',
    projectId: revenueCatProjectId,
    legacyV1SecretKeyFingerprintSha256: revenueCatV1SecretKeyFingerprint(
      revenueCatLegacySecretApiKey,
    ),
    v2SecretKeyFingerprintSha256: revenueCatV2SecretKeyFingerprint(revenueCatV2SecretApiKey),
    permissions: [
      'customer_information:customers:read_write',
      'project_configuration:projects:read',
    ],
    observations: {
      bearerProjectListHttpStatus: 200,
      customerReadBeforeDeleteHttpStatus: 200,
      customerDeleteHttpStatus: 200,
      customerReadAfterDeleteHttpStatus: 404,
      fullFamilyAbsenceReconciled: true,
      legacyCustomerInfoReadHttpStatus: 200,
    },
    redacted: true,
    reviewedAt: accessEvidenceReviewedAt,
    reviewedBy: 'Tas Mohammed',
  };
}

function writeAccessEvidence(path, document) {
  writeFileSync(resolve(root, path), `${JSON.stringify(document, null, 2)}\n`);
}

writeAccessEvidence(accessEvidenceFixturePath, accessEvidenceDocument());
process.once('exit', () => rmSync(accessEvidenceFixtureAbsolutePath, { force: true }));

const completeEnv = {
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_livevalue123',
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_livevalue123',
  EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: 'pro',
  EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID: 'routinekind.pro.annual',
  EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID: 'routinekind.pro.monthly',
  REVENUECAT_WEBHOOK_AUTH: 'RevenueCatWebhookSharedAuth2026_AlphaBeta789',
  REVENUECAT_WEBHOOK_SIGNING_SECRET: 'whsec_RevenueCatSigning2026_AlphaBeta789',
  REVENUECAT_SECRET_API_KEY: revenueCatLegacySecretApiKey,
  REVENUECAT_PROJECT_ID: revenueCatProjectId,
  REVENUECAT_V2_SECRET_API_KEY: revenueCatV2SecretApiKey,
  PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH: accessEvidenceFixturePath,
  PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS: 'true',
  BRAND_LEGAL_CLEARANCE: 'cleared',
  EXPO_PUBLIC_PRIVACY_URL: 'https://routinekind.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://routinekind.app/terms',
  EXPO_PUBLIC_SUPPORT_URL: 'https://routinekind.app/support',
  PHASE6_RC_OFFERING_REVIEWED: ' TRUE ',
  PHASE6_IOS_SANDBOX_RESTORE_PASS: 'true',
  PHASE6_ANDROID_LICENSE_TEST_PASS: 'True',
  PHASE6_WEBHOOK_HMAC_TEST_PASS: ' true ',
  PHASE6_FINANCE_SIGNOFF: 'TRUE',
  PHASE6_SIGNED_OFF_BY: ' Tas Mohammed ',
};

function run(extraEnv) {
  return spawnSync(process.execPath, [checkEnvPath, '--strict'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...completeEnv, ...extraEnv },
  });
}

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function runPacket(extraEnv, args = []) {
  const outDir = mkdtempSync(join(tmpdir(), 'routinekind-phase6-packet-'));
  try {
    const result = spawnSync(process.execPath, [packetPath, ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...processBaseEnv, ...completeEnv, PHASE6_PACKET_OUT_DIR: outDir, ...extraEnv },
    });
    const packet = JSON.parse(readFileSync(resolve(outDir, 'payments-qa-packet.json'), 'utf8'));
    const markdown = readFileSync(resolve(outDir, 'payments-qa-packet.md'), 'utf8');
    return { ...result, markdown, packet };
  } finally {
    rmSync(outDir, { force: true, recursive: true });
  }
}

function runSourceContractTests() {
  return spawnSync(process.execPath, ['--test', ...localContractTestPaths], {
    cwd: root,
    encoding: 'utf8',
    env: processBaseEnv,
  });
}

function runPacketWithUnavailableGit(extraEnv, args = []) {
  const unavailablePath = join(tmpdir(), `routinekind-phase6-no-git-${process.pid}`);
  return runPacket({ ...extraEnv, PATH: unavailablePath, Path: unavailablePath }, args);
}

let accessEvidenceVariant = 0;
function runWithAccessEvidence(document, callback) {
  accessEvidenceVariant += 1;
  const path = `docs/phase-6/revenuecat-v2-access-evidence.smoke-${process.pid}-${accessEvidenceVariant}.json`;
  writeAccessEvidence(path, document);
  try {
    return callback(path);
  } finally {
    rmSync(resolve(root, path), { force: true });
  }
}

function runPacketWithDirtyUnrelatedGeneratedEvidence(extraEnv, args = []) {
  const path = resolve(root, 'docs/phase-3/generated/review-worklist.json');
  const original = readFileSync(path);
  writeFileSync(path, Buffer.concat([original, Buffer.from('\n')]));
  try {
    return runPacket(extraEnv, args);
  } finally {
    writeFileSync(path, original);
  }
}

function packetIncludesAvailableSiblingTests(files) {
  const packetPaths = new Set(files.map((file) => file.path));
  return [...packetPaths]
    .filter(
      (path) =>
        path.endsWith('.ts') &&
        !path.endsWith('.test.ts') &&
        (path.startsWith('supabase/functions/account-deletion/') ||
          path.startsWith('supabase/functions/_shared/')),
    )
    .every((path) => {
      const siblingTestPath = path.replace(/\.ts$/, '.test.ts');
      return !existsSync(resolve(root, siblingTestPath)) || packetPaths.has(siblingTestPath);
    });
}

function runPacketWithDirtyWorktree(extraEnv, args = []) {
  const markerPath = join(root, `.phase6-smoke-dirty-${process.pid}.tmp`);
  writeFileSync(markerPath, 'temporary Phase 6 dirty-worktree smoke marker\n');
  try {
    return runPacket(extraEnv, args);
  } finally {
    rmSync(markerPath, { force: true });
  }
}

const cases = [
  {
    name: 'durable RevenueCat deletion source contract rejects call-chain and endpoint drift',
    result: runSourceContractTests(),
    expect(result) {
      return result.status === 0;
    },
  },
  {
    name: 'iOS launch scope does not require Android RevenueCat configuration or evidence',
    result: run({
      EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: '',
      PHASE6_ANDROID_LICENSE_TEST_PASS: '',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Android RevenueCat key and license-test evidence: excluded by launch contract/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict payments env passes with production RevenueCat and policy values',
    result: run({}),
    expect(result) {
      return result.status === 0 && /Phase 6 payments baseline is present/.test(result.stdout);
    },
  },
  {
    name: 'strict payments env rejects cased placeholder RevenueCat public keys',
    result: run({ EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_XXXXXXXXXXXX' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing EXPO_PUBLIC_REVENUECAT_IOS_KEY for production/.test(output(result))
      );
    },
  },
  {
    name: 'strict payments env rejects local product ids',
    result: run({ EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID: 'routinekind_pro_annual_dev' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Production annual RevenueCat product id must be a final App Store product id/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict payments env rejects blocked webhook secrets',
    result: run({ REVENUECAT_WEBHOOK_SIGNING_SECRET: '__BLOCKED_PLACEHOLDER__' }),
    expect(result) {
      return (
        result.status === 1 &&
        /webhook signing secret must be a high-entropy whsec_ token/.test(output(result))
      );
    },
  },
  {
    name: 'strict payments env rejects low-entropy server credentials',
    result: run({
      REVENUECAT_WEBHOOK_AUTH: 'a',
      REVENUECAT_WEBHOOK_SIGNING_SECRET: 'whsec_a',
      REVENUECAT_SECRET_API_KEY: 'sk_a',
    }),
    expect(result) {
      const text = output(result);
      return (
        result.status === 1 &&
        /webhook shared auth must be a high-entropy 32-256 character token/.test(text) &&
        /webhook signing secret must be a high-entropy whsec_ token/.test(text) &&
        /REVENUECAT_SECRET_API_KEY must be a final high-entropy sk_-prefixed legacy V1 key/.test(
          text,
        )
      );
    },
  },
  {
    name: 'strict payments env rejects malformed durable RevenueCat deletion configuration',
    result: run({ REVENUECAT_PROJECT_ID: 'x', REVENUECAT_V2_SECRET_API_KEY: 'y' }),
    expect(result) {
      return (
        result.status === 1 &&
        /REVENUECAT_PROJECT_ID must be a final proj-prefixed production project ID/.test(
          output(result),
        ) &&
        /REVENUECAT_V2_SECRET_API_KEY must be a final sk_-prefixed V2 secret key/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict payments env rejects a missing RevenueCat V2 access evidence artifact',
    result: run({ PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH: '' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH/.test(output(result))
      );
    },
  },
  {
    name: 'strict payments env rejects RevenueCat V2 evidence bound to another project',
    result: runWithAccessEvidence(
      { ...accessEvidenceDocument(), projectId: 'projother12345' },
      (path) => run({ PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH: path }),
    ),
    expect(result) {
      return (
        result.status === 1 &&
        /RevenueCat V2 access evidence projectId does not match REVENUECAT_PROJECT_ID/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict payments env rejects malformed production policy URLs',
    result: run({ EXPO_PUBLIC_SUPPORT_URL: 'https://user:pass@routinekind.app/support' }),
    expect(result) {
      return (
        result.status === 1 &&
        /EXPO_PUBLIC_SUPPORT_URL must be a real production HTTPS URL/.test(output(result))
      );
    },
  },
  {
    name: 'strict payments env rejects non-true external evidence flags',
    result: run({
      PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS: 'yes',
      PHASE6_WEBHOOK_HMAC_TEST_PASS: 'yes',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing external Phase 6 evidence: PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS/.test(
          output(result),
        ) &&
        /Missing external Phase 6 evidence: PHASE6_WEBHOOK_HMAC_TEST_PASS/.test(output(result))
      );
    },
  },
  {
    name: 'strict payments env rejects placeholder signoffs',
    result: run({ PHASE6_SIGNED_OFF_BY: 'Tester Name' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing external Phase 6 evidence: PHASE6_SIGNED_OFF_BY/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 6 packet writes normalized evidence, config, and signoff',
    result: runPacket({}),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.productionConfig.annualProductIdFinal === true &&
        result.packet.productionConfig.webhookSigningSecretConfigured === true &&
        result.packet.productionConfig.revenueCatProjectIdConfigured === true &&
        result.packet.productionConfig.revenueCatV2SecretApiKeyConfigured === true &&
        result.packet.productionConfig.privacyUrlProduction === true &&
        result.packet.evidence.rcOfferingReviewed === true &&
        result.packet.evidence.revenueCatV2CustomerDeleteAccessPass === true &&
        result.packet.revenueCatV2AccessEvidence.valid === true &&
        result.packet.revenueCatV2AccessEvidence.path === accessEvidenceFixturePath &&
        result.packet.revenueCatV2AccessEvidence.projectId === revenueCatProjectId &&
        result.packet.revenueCatV2AccessEvidence.v2SecretKeyFingerprintSha256 ===
          revenueCatV2SecretKeyFingerprint(revenueCatV2SecretApiKey) &&
        result.packet.revenueCatV2AccessEvidence.legacyV1SecretKeyFingerprintSha256 ===
          revenueCatV1SecretKeyFingerprint(revenueCatLegacySecretApiKey) &&
        result.packet.revenueCatV2AccessEvidence.reviewedAt === accessEvidenceReviewedAt &&
        result.packet.revenueCatV2AccessEvidence.reviewedBy === 'Tas Mohammed' &&
        result.packet.files.some(
          (file) =>
            file.path === accessEvidenceFixturePath &&
            file.sha256 === result.packet.revenueCatV2AccessEvidence.sha256,
        ) &&
        result.packet.evidence.androidLicenseTestPass === null &&
        result.packet.platformStatus.android === 'not_applicable' &&
        result.packet.platformEvidenceStatus.androidLicenseTest === 'not_applicable' &&
        result.packet.evidence.signedOffBy === 'Tas Mohammed' &&
        result.packet.headFileTrackingCaptured === true &&
        result.packet.requiredFilesMissingFromHead.includes(accessEvidenceFixturePath) &&
        result.packet.blockers.includes(
          `Phase 6 required input is not committed at HEAD: ${accessEvidenceFixturePath}.`,
        ) &&
        /^[0-9a-f]{40}$/i.test(result.packet.gitSha) &&
        typeof result.packet.gitStatus === 'string' &&
        Array.isArray(result.packet.warnings) &&
        result.packet.files.some(
          (file) => file.path === 'scripts/phase6/build-payments-qa-packet.mjs',
        ) &&
        result.packet.files.some((file) => file.path === 'scripts/phase6/check-payments-env.mjs') &&
        result.packet.files.some(
          (file) => file.path === 'scripts/phase6/check-payments-env-smoke.mjs',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'apps/mobile/src/app/paywall/reoffer.tsx',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'apps/mobile/src/app/paywall/downgrade.tsx',
        ) &&
        result.packet.files.some(
          (file) =>
            file.path === 'apps/mobile/src/features/subscription/paywallMobileContracts.test.ts',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'apps/mobile/src/features/subscription/store.test.ts',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'apps/mobile/src/features/subscription/entitlement.test.ts',
        ) &&
        [
          'apps/mobile/src/features/subscription/entitlementEvidence.ts',
          'apps/mobile/src/features/subscription/entitlementEvidence.test.ts',
          'apps/mobile/src/lib/iap/revenuecat.test.ts',
          'apps/mobile/src/lib/iap/revenuecatPublication.test.ts',
          'supabase/functions/revenuecat-webhook/webhookCore.ts',
          'supabase/functions/revenuecat-webhook/webhookCore.test.ts',
          'supabase/functions/subscription-grants/grantErrors.ts',
          'supabase/functions/subscription-grants/grantErrors.test.ts',
          'supabase/migrations/20260612000009_entitlements.sql',
          'supabase/migrations/20260613000020_subscription_extensions.sql',
          'supabase/migrations/20260713000041_revenuecat_webhook_atomic_projection.sql',
          'supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql',
          'supabase/migrations/20260713000049_revenuecat_deletion_barrier_guard.sql',
          'supabase/migrations/20260713000050_service_writer_deletion_barriers.sql',
          'supabase/migrations/20260713000051_revenuecat_identity_tombstones.sql',
          'supabase/migrations/20260713000052_account_publication_fence.sql',
        ].every((path) => result.packet.files.some((file) => file.path === path)) &&
        result.packet.files.some(
          (file) => file.path === 'supabase/functions/account-deletion/durableDeletionRuntime.ts',
        ) &&
        result.packet.files.some(
          (file) =>
            file.path === 'supabase/functions/account-deletion/durableDeletionRuntime.test.ts',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'supabase/functions/account-deletion/durableProviderDeletion.ts',
        ) &&
        result.packet.files.some(
          (file) =>
            file.path === 'supabase/functions/account-deletion/durableProviderDeletion.test.ts',
        ) &&
        result.packet.files.some(
          (file) =>
            file.path === 'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts',
        ) &&
        result.packet.files.some(
          (file) =>
            file.path ===
            'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.test.ts',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'scripts/phase6/payments-source-contract.mjs',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'scripts/phase6/payments-source-contract.test.mjs',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'scripts/phase6/payments-git-provenance.mjs',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'scripts/phase6/payments-git-provenance.test.mjs',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'scripts/phase6/payments-revenuecat-access-evidence.mjs',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'scripts/phase6/payments-revenuecat-access-evidence.test.mjs',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'docs/phase-6/revenuecat-v2-access-evidence.template.json',
        ) &&
        accountDeletionSourcePaths.every((path) =>
          result.packet.files.some((file) => file.path === path),
        ) &&
        [
          'package-lock.json',
          'apps/mobile/package.json',
          'apps/mobile/eas.json',
          'supabase/functions/deno.lock',
          'supabase/functions/_shared/appleVault.test.ts',
          'supabase/functions/_shared/env.test.ts',
          'supabase/functions/_shared/fetch.ts',
          'supabase/functions/_shared/fetch.test.ts',
          'supabase/functions/_shared/revenueCatIdentityTombstone.test.ts',
          'supabase/functions/_shared/stagingTrafficFreeze.test.ts',
          'supabase/functions/_shared/storagePath.test.ts',
          'supabase/functions/account-deletion/durableDeletionWorker.ts',
          'supabase/functions/account-deletion/durableDeletionWorker.test.ts',
          'supabase/functions/account-deletion/durableDeletionHttpHandler.ts',
          'supabase/functions/account-deletion/durableDeletionHttpHandler.test.ts',
          'supabase/functions/account-deletion/durableDeletionDatabaseGateway.ts',
          'supabase/functions/account-deletion/durableDeletionDatabaseGateway.test.ts',
          'supabase/functions/account-deletion/durableDeletionEncryptedStateStore.ts',
          'supabase/functions/account-deletion/durableDeletionEncryptedStateStore.test.ts',
        ].every((path) => result.packet.files.some((file) => file.path === path)) &&
        packetIncludesAvailableSiblingTests(result.packet.files) &&
        result.packet.files.some((file) => file.path === 'scripts/e2e/human-e2e-manifest.mjs') &&
        result.packet.files.some((file) => file.path === 'docs/HUMAN_SIMULATED_E2E_TESTING.md') &&
        result.packet.files.some((file) => file.path === 'docs/E2E_TESTING_CHECKLIST.md') &&
        result.packet.files.some((file) => file.path === 'docs/USER_FLOW_TREE.md') &&
        result.packet.files.some(
          (file) => file.path === 'docs/e2e/generated/human-e2e-manifest.json',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'docs/e2e/generated/human-e2e-manifest.md',
        ) &&
        !result.packet.blockers.some((blocker) => /PHASE6_SIGNED_OFF_BY/.test(blocker)) &&
        !JSON.stringify(result.packet).includes(revenueCatV2SecretApiKey) &&
        !JSON.stringify(result.packet).includes(revenueCatLegacySecretApiKey) &&
        !result.markdown.includes(revenueCatV2SecretApiKey) &&
        !readFileSync(accessEvidenceFixtureAbsolutePath, 'utf8').includes(revenueCatV2SecretApiKey)
      );
    },
  },
  {
    name: 'Phase 6 packet warns when generated from a dirty worktree',
    result: runPacketWithDirtyWorktree({}),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.gitProvenanceCaptured === true &&
        result.packet.gitStatus.includes(`.phase6-smoke-dirty-${process.pid}.tmp`) &&
        result.packet.warnings.includes(
          'Phase 6 payments QA packet generated with a dirty Git worktree; do not use it as final payments evidence.',
        ) &&
        result.packet.blockers.includes(
          'Phase 6 final payments evidence requires a clean Git worktree.',
        )
      );
    },
  },
  {
    name: 'Phase 6 strict packet rejects dirty Git provenance',
    result: runPacketWithDirtyWorktree({}, ['--strict']),
    expect(result) {
      return (
        result.status === 1 &&
        result.packet.gitProvenanceCaptured === true &&
        result.packet.blockers.includes(
          'Phase 6 final payments evidence requires a clean Git worktree.',
        ) &&
        /Phase 6 strict QA packet has/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 6 strict packet rejects unavailable Git provenance',
    result: runPacketWithUnavailableGit({}, ['--strict']),
    expect(result) {
      return (
        result.status === 1 &&
        result.packet.gitProvenanceCaptured === false &&
        result.packet.gitSha === 'unknown' &&
        result.packet.gitStatus === 'unknown' &&
        result.packet.blockers.includes('Phase 6 Git provenance is unavailable or noncanonical.') &&
        /Git status: UNAVAILABLE/.test(result.markdown) &&
        /Phase 6 strict QA packet has/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 6 strict packet rejects missing RevenueCat V2 access evidence',
    result: runPacket({ PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH: '' }, ['--strict']),
    expect(result) {
      return (
        result.status === 1 &&
        result.packet.revenueCatV2AccessEvidence.valid === false &&
        result.packet.blockers.includes('Missing PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH.')
      );
    },
  },
  {
    name: 'Phase 6 strict packet ignores dirty central generated evidence',
    result: runPacketWithDirtyUnrelatedGeneratedEvidence({}, ['--strict']),
    expect(result) {
      return !result.packet.gitStatus.includes('docs/phase-3/generated/review-worklist.json');
    },
  },
  {
    name: 'Phase 6 strict packet rejects a tampered RevenueCat V2 key fingerprint',
    result: runWithAccessEvidence(
      { ...accessEvidenceDocument(), v2SecretKeyFingerprintSha256: '0'.repeat(64) },
      (path) => runPacket({ PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH: path }, ['--strict']),
    ),
    expect(result) {
      return (
        result.status === 1 &&
        result.packet.blockers.includes(
          'RevenueCat V2 access evidence key fingerprint does not match the configured V2 secret key.',
        ) &&
        !JSON.stringify(result.packet).includes(revenueCatV2SecretApiKey) &&
        !result.markdown.includes(revenueCatV2SecretApiKey)
      );
    },
  },
  {
    name: 'Phase 6 strict packet rejects a tampered legacy V1 key fingerprint',
    result: runWithAccessEvidence(
      { ...accessEvidenceDocument(), legacyV1SecretKeyFingerprintSha256: '0'.repeat(64) },
      (path) => runPacket({ PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH: path }, ['--strict']),
    ),
    expect(result) {
      return (
        result.status === 1 &&
        result.packet.blockers.includes(
          'RevenueCat access evidence legacy key fingerprint does not match REVENUECAT_SECRET_API_KEY.',
        ) &&
        !JSON.stringify(result.packet).includes(revenueCatLegacySecretApiKey) &&
        !result.markdown.includes(revenueCatLegacySecretApiKey)
      );
    },
  },
  {
    name: 'Phase 6 packet blocks placeholder production config without leaking secrets',
    result: runPacket({
      EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID: 'routinekind.pro.annual.dev',
      REVENUECAT_WEBHOOK_SIGNING_SECRET: '__BLOCKED_PLACEHOLDER__',
      REVENUECAT_PROJECT_ID: '',
      REVENUECAT_V2_SECRET_API_KEY: '__BLOCKED_PLACEHOLDER__',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.productionConfig.annualProductIdFinal === false &&
        result.packet.productionConfig.webhookSigningSecretConfigured === false &&
        result.packet.productionConfig.revenueCatProjectIdConfigured === false &&
        result.packet.productionConfig.revenueCatV2SecretApiKeyConfigured === false &&
        result.packet.blockers.includes(
          'Missing final EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID.',
        ) &&
        result.packet.blockers.includes(
          'REVENUECAT_WEBHOOK_SIGNING_SECRET must be a high-entropy whsec_ token.',
        ) &&
        result.packet.blockers.includes(
          'REVENUECAT_PROJECT_ID must be a final proj-prefixed production project ID.',
        ) &&
        result.packet.blockers.includes(
          'REVENUECAT_V2_SECRET_API_KEY must be a final sk_-prefixed V2 secret key.',
        ) &&
        !JSON.stringify(result.packet).includes('__BLOCKED_PLACEHOLDER__')
      );
    },
  },
  {
    name: 'Phase 6 packet strips placeholder signoffs',
    result: runPacket({ PHASE6_SIGNED_OFF_BY: 'tester@example.com' }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidence.signedOffBy === '' &&
        result.packet.blockers.includes('Missing PHASE6_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 6 packet strips secret-valued signoffs without leaking the key',
    result: runPacket({ PHASE6_SIGNED_OFF_BY: `Tas ${revenueCatV2SecretApiKey} Mohammed` }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidence.signedOffBy === '' &&
        result.packet.blockers.includes('Missing PHASE6_SIGNED_OFF_BY.') &&
        !JSON.stringify(result.packet).includes(revenueCatV2SecretApiKey) &&
        !result.markdown.includes(revenueCatV2SecretApiKey)
      );
    },
  },
  {
    name: 'Phase 6 packet blocks non-true evidence flags',
    result: runPacket({
      PHASE6_FINANCE_SIGNOFF: 'approved',
      PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS: 'approved',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidence.revenueCatV2CustomerDeleteAccessPass === false &&
        result.packet.evidence.financeSignoff === false &&
        result.packet.blockers.includes(
          'Missing PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS=true.',
        ) &&
        result.packet.blockers.includes('Missing PHASE6_FINANCE_SIGNOFF=true.')
      );
    },
  },
];

let failed = false;
for (const testCase of cases) {
  if (testCase.expect(testCase.result)) {
    console.log(`OK ${testCase.name}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${testCase.name}`);
  const text = output(testCase.result).trim();
  if (text) console.error(text);
}

if (failed) process.exit(1);
