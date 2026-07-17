#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  createWidgetLifecycleEvidenceTemplate,
  WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
  WIDGET_LIFECYCLE_SUPPORTED_FAMILIES,
} from './widget-lifecycle-evidence-contract.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(scriptDir, '..', '..');
const fixtureRoot = mkdtempSync(join(tmpdir(), 'routinekind-phase5-repo-'));
const packetOutDirs = [];
process.on('exit', () => {
  for (const path of packetOutDirs) rmSync(path, { recursive: true, force: true });
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return String(result.stdout ?? '').trim();
}

git(dirname(fixtureRoot), ['clone', '--quiet', '--no-local', sourceRoot, fixtureRoot]);
const changedPaths = git(sourceRoot, [
  '-c',
  'core.quotepath=false',
  'status',
  '--short',
  '--untracked-files=all',
])
  .split(/\r?\n/)
  .filter(Boolean)
  .flatMap((line) => line.slice(3).split(' -> '))
  .map((path) => path.trim().replaceAll('\\', '/'));
for (const path of changedPaths) {
  const source = resolve(sourceRoot, path);
  if (!existsSync(source)) continue;
  const target = resolve(fixtureRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
git(fixtureRoot, ['config', 'user.email', 'phase5-smoke@example.invalid']);
git(fixtureRoot, ['config', 'user.name', 'Phase 5 Smoke']);
git(fixtureRoot, ['add', '-A']);
git(fixtureRoot, ['commit', '--quiet', '-m', 'Phase 5 smoke source']);

const root = fixtureRoot;
const packetPath = resolve(root, 'scripts/phase5/build-device-qa-packet.mjs');
const iosBuildId = '9f7b48e1-7a52-4efb-9d93-3e93a2bf13e5';
const appBundleIdentifier = 'com.routinekind.phase5smoke';
const extensionBundleIdentifier = `${appBundleIdentifier}.ExpoWidgetsTarget`;
const appGroupIdentifier = `group.${appBundleIdentifier}`;
const appleTeamId = 'ABCDE12345';
const capturedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const signedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const widgetEvidenceRelativeRoot = `docs/phase-5/evidence/widget-lifecycle/device-packet-smoke-${process.pid}`;
const widgetEvidenceAbsoluteRoot = resolve(root, widgetEvidenceRelativeRoot);
const allowedWidgetEvidenceRoot = `${resolve(
  root,
  'docs/phase-5/evidence/widget-lifecycle',
)}${sep}`;
if (!widgetEvidenceAbsoluteRoot.startsWith(allowedWidgetEvidenceRoot)) {
  throw new Error('Unsafe Phase 5 widget evidence smoke path.');
}

function currentGitSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0 || !/^[0-9a-f]{40}$/i.test(String(result.stdout).trim())) {
    throw new Error('Phase 5 smoke could not resolve the current Git SHA.');
  }
  return String(result.stdout).trim().toLowerCase();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function artifact(relativePath, bytes, mediaType) {
  writeFileSync(resolve(root, relativePath), bytes);
  return { path: relativePath, sha256: sha256(bytes), mediaType };
}

function zipArtifact(relativePath, label) {
  return artifact(
    relativePath,
    Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from(`${label}\n`.padEnd(64, '.')),
    ]),
    'application/zip',
  );
}

function jsonArtifact(relativePath, value) {
  return artifact(
    relativePath,
    Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'),
    'application/json',
  );
}

function textArtifact(relativePath, value) {
  return artifact(relativePath, Buffer.from(`${value}\n`, 'utf8'), 'text/plain');
}

function reportBinding(evidence, device) {
  return {
    sourceGitSha: evidence.sourceGitSha,
    easIosBuildId: evidence.build.easIosBuildId,
    identifiers: {
      appBundleIdentifier,
      extensionBundleIdentifier,
      appGroupIdentifier,
      teamIdentifier: appleTeamId,
    },
    rawArtifactSha256: {
      appBundle: evidence.signedArtifacts.appBundle.sha256,
      archive: evidence.signedArtifacts.archive.sha256,
      extensionBundle: evidence.signedArtifacts.extensionBundle.sha256,
    },
    device,
  };
}

function writeWidgetEvidenceFixture() {
  mkdirSync(widgetEvidenceAbsoluteRoot, { recursive: true });
  const evidence = createWidgetLifecycleEvidenceTemplate();
  evidence.capturedAt = capturedAt;
  evidence.sourceGitSha = currentGitSha();
  evidence.build.easIosBuildId = iosBuildId;
  evidence.device.model = 'iPhone 15 Pro';
  evidence.device.osVersion = 'iOS 18.5';
  evidence.identifiers.appBundleIdentifier = appBundleIdentifier;
  evidence.identifiers.extensionBundleIdentifier = extensionBundleIdentifier;
  evidence.identifiers.appGroupIdentifier = appGroupIdentifier;
  evidence.identifiers.teamIdentifier = appleTeamId;
  evidence.signoff.decision = 'pass';
  evidence.signoff.signedOffBy = 'Tas Mohammed';
  evidence.signoff.signedAt = signedAt;

  evidence.signedArtifacts.archive = zipArtifact(
    `${widgetEvidenceRelativeRoot}/candidate.xcarchive.zip`,
    `archive ${iosBuildId}`,
  );
  evidence.signedArtifacts.appBundle = zipArtifact(
    `${widgetEvidenceRelativeRoot}/candidate.app.zip`,
    `app ${iosBuildId}`,
  );
  evidence.signedArtifacts.extensionBundle = zipArtifact(
    `${widgetEvidenceRelativeRoot}/candidate.appex.zip`,
    `extension ${iosBuildId}`,
  );

  const privacyClaims = {
    accessedApiTypes: [
      { apiType: 'NSPrivacyAccessedAPICategoryUserDefaults', reasons: ['1C8F.1'] },
    ],
    collectedDataTypes: [],
    tracking: false,
    trackingDomains: [],
  };
  for (const [key, reportType, bundleIdentifier, extension] of [
    ['appEntitlements', 'app-entitlements', appBundleIdentifier, false],
    ['extensionEntitlements', 'extension-entitlements', extensionBundleIdentifier, true],
  ]) {
    evidence.signedArtifacts[key] = jsonArtifact(
      `${widgetEvidenceRelativeRoot}/${reportType}.json`,
      {
        schemaVersion: WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
        capturedAt,
        reportType,
        binding: reportBinding(evidence, null),
        claims: {
          appGroups: [appGroupIdentifier],
          applicationIdentifier: `${appleTeamId}.${bundleIdentifier}`,
          apsEnvironment: extension ? null : 'development',
          bundleIdentifier,
          codeSignatureValid: true,
          serviceCapabilityKeys: ['com.apple.security.application-groups'],
          teamIdentifier: appleTeamId,
        },
      },
    );
  }
  for (const [key, reportType] of [
    ['appPrivacyManifest', 'app-privacy-manifest'],
    ['extensionPrivacyManifest', 'extension-privacy-manifest'],
  ]) {
    evidence.signedArtifacts[key] = jsonArtifact(
      `${widgetEvidenceRelativeRoot}/${reportType}.json`,
      {
        schemaVersion: WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
        capturedAt,
        reportType,
        binding: reportBinding(evidence, null),
        claims: privacyClaims,
      },
    );
  }

  const claims = {
    archiveInspection: {
      appCodeSignatureValid: true,
      appGroupEntitlementsMatch: true,
      appPrivacyManifestEmbedded: true,
      extensionCodeSignatureValid: true,
      extensionEmbedded: true,
      extensionPrivacyManifestEmbedded: true,
      frequentUpdatesEnabled: false,
      identitiesMatch: true,
      interactivePublicationEnabled: true,
      lifecycleVersion: 1,
      liveActivityStartEnabled: true,
      sqlite3Linked: true,
      unapprovedExtensionCapabilitiesAbsent: true,
    },
    interactionPrivacy: {
      accountDeletionCleanup: true,
      accountSwitchCleanup: true,
      allOrRedactReconciliation: true,
      atomicConcurrentCheckOff: true,
      authorityNonceCas: true,
      boundedCrossProcessLock: true,
      canonicalSnapshotEquality: true,
      corruptBytesCleanup: true,
      expiredTokenNoWrite: true,
      expiryCleanup: true,
      foreignOwnerCleanup: true,
      healthConsentWithdrawalCleanup: true,
      killedAppReconciliation: true,
      lockedStateRedaction: true,
      nativeActionImplementation: 'sqlite_app_group_outbox_cas',
      outboxCommittedBeforeIntentReturn: true,
      oversizedBytesCleanup: true,
      ownerSnapshotBinding: true,
      repeatedTapIdempotent: true,
      signOutCleanup: true,
      sqliteTimelineAuthority: true,
      staleTokenNoWrite: true,
      tombstoneCleanup: true,
      twoEntryStaleTimeline: true,
      unclaimedOwnerCleanup: true,
      unknownTokenNoWrite: true,
    },
    liveActivity: {
      consentWithdrawalCleanup: true,
      deviceRestartRecovery: true,
      disablementCleanup: true,
      explicitCompletionEnd: true,
      finiteStaleDeadline: true,
      immediatePrivacyEnd: true,
      lockedStateRedaction: true,
      ownerFilteredRecovery: true,
      processDeathRecovery: true,
      startUpdateAuthorization: true,
    },
    widgetDevice: {
      accessibilityPass: true,
      coldStartDeepLinkPass: true,
      dynamicTypePass: true,
      killedAppDeepLinkPass: true,
      lockedStateRedaction: true,
      repeatedConcurrentInteractionPass: true,
      supportedFamilies: [...WIDGET_LIFECYCLE_SUPPORTED_FAMILIES],
      voiceOverPass: true,
      warmDeepLinkPass: true,
    },
  };
  for (const id of Object.keys(claims)) {
    const proof = textArtifact(
      `${widgetEvidenceRelativeRoot}/${id}-proof.txt`,
      `Typed proof transcript for ${id} and build ${iosBuildId}`,
    );
    evidence.scenarioArtifacts[id] = jsonArtifact(`${widgetEvidenceRelativeRoot}/${id}.json`, {
      schemaVersion: WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
      capturedAt,
      reportType: id,
      binding: reportBinding(evidence, id === 'archiveInspection' ? null : { ...evidence.device }),
      claims: claims[id],
      proofAttachments: [proof],
    });
  }
  const relativePath = `${widgetEvidenceRelativeRoot}/evidence.json`;
  writeFileSync(resolve(root, relativePath), `${JSON.stringify(evidence, null, 2)}\n`);
  return relativePath;
}

const widgetEvidencePath = writeWidgetEvidenceFixture();

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

const validEvidence = {
  PHASE5_IOS_BUILD_ID: iosBuildId,
  PHASE5_ANDROID_BUILD_ID:
    'https://expo.dev/accounts/routinekind/projects/mobile/builds/7a4d74ae-2acd-4af5-931f-b768565bcd64',
  PHASE5_IOS_DEVICE: 'iPhone 15 Pro / iOS 18.5',
  PHASE5_ANDROID_DEVICE: 'Pixel 8 / Android 15',
  PHASE5_QA_SIGNOFF: 'true',
  PHASE5_SIGNED_OFF_BY: 'Tas Mohammed',
  APP_IOS_BUNDLE_IDENTIFIER: appBundleIdentifier,
  APPLE_TEAM_ID: appleTeamId,
  PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH: widgetEvidencePath,
  PHASE5_DEVICE_QA_PASS: 'true',
  PHASE5_INSTALL_QA_PASS: 'true',
  PHASE5_CAMERA_PERMISSION_QA_PASS: 'true',
  PHASE5_BARCODE_QA_PASS: 'true',
  PHASE5_LABEL_CAPTURE_QA_PASS: 'true',
  PHASE5_PROGRESS_PHOTO_QA_PASS: 'true',
  PHASE5_ENCRYPTED_PHOTO_STORAGE_QA_PASS: 'true',
  PHASE5_NOTIFICATION_QA_PASS: 'true',
  PHASE5_SHARE_SHEET_QA_PASS: 'true',
  PHASE5_REVENUECAT_NATIVE_QA_PASS: 'true',
  PHASE5_SENTRY_NATIVE_QA_PASS: 'true',
  PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS: 'true',
  PHASE5_ACCESSIBILITY_QA_PASS: 'true',
  PHASE5_WIDGET_ARCHIVE_QA_PASS: 'true',
  PHASE5_WIDGET_DEVICE_QA_PASS: 'true',
  PHASE5_WIDGET_INTERACTION_PRIVACY_QA_PASS: 'true',
  PHASE5_LIVE_ACTIVITY_QA_PASS: 'true',
  PHASE5_NATIVE_OCR_QA_PASS: 'false',
};

function run(extraEnv, strict = true) {
  const outDir = mkdtempSync(join(tmpdir(), 'routinekind-phase5-qa-'));
  packetOutDirs.push(outDir);
  const result = spawnSync(process.execPath, [packetPath, ...(strict ? ['--strict'] : [])], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...processBaseEnv,
      ...validEvidence,
      ...extraEnv,
      PHASE5_QA_PACKET_OUT_DIR: outDir,
    },
  });
  result.outDir = outDir;
  return result;
}

function runWithDirtyWorktree(extraEnv, strict = true) {
  const markerPath = join(root, `.phase5-smoke-dirty-${process.pid}.tmp`);
  writeFileSync(markerPath, 'temporary Phase 5 dirty-worktree smoke marker\n');
  try {
    return run(extraEnv, strict);
  } finally {
    rmSync(markerPath, { force: true });
  }
}

function runWithDirtyGeneratedEvidence(extraEnv, strict = true) {
  const generatedPath = resolve(root, 'docs/phase-3/generated/review-worklist.json');
  const original = readFileSync(generatedPath);
  writeFileSync(generatedPath, Buffer.concat([original, Buffer.from('\n')]));
  try {
    return run(extraEnv, strict);
  } finally {
    writeFileSync(generatedPath, original);
  }
}

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

const cases = [
  {
    name: 'strict Phase 5 QA packet accepts real-looking EAS and device evidence',
    result: run({}),
    expect(result) {
      const text = output(result);
      return result.status === 0 && /device-qa-packet\.json/.test(text) && !/^FAIL /m.test(text);
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects missing granular evidence flags',
    result: run({ PHASE5_BARCODE_QA_PASS: 'yes' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE5_BARCODE_QA_PASS=true \(physical-device barcode scan and checksum matrix\)/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects missing widget interaction/privacy evidence',
    result: run({ PHASE5_WIDGET_INTERACTION_PRIVACY_QA_PASS: 'false' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE5_WIDGET_INTERACTION_PRIVACY_QA_PASS=true \(atomic widget interaction plus lock, expiry, sign-out, account-switch, and consent-withdrawal cleanup\)/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects missing Live Activity lifecycle evidence',
    result: run({ PHASE5_LIVE_ACTIVITY_QA_PASS: 'false' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE5_LIVE_ACTIVITY_QA_PASS=true \(physical-iPhone Live Activity stale, end, process-death, restart, and locked-state behavior\)/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects widget booleans without artifact-bound evidence',
    result: run({ PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH: '' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH; widget booleans do not substitute for artifact-bound archive\/device\/lifecycle evidence/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet requires native OCR evidence only when OCR is enabled',
    result: run({ EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'true', PHASE5_NATIVE_OCR_QA_PASS: 'false' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE5_NATIVE_OCR_QA_PASS=true \(native OCR real-label text recognition\)/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet accepts native OCR evidence when OCR is enabled',
    result: run({ EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'true', PHASE5_NATIVE_OCR_QA_PASS: ' TRUE ' }),
    expect(result) {
      return result.status === 0 && !/^FAIL /m.test(output(result));
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects placeholder iOS build evidence',
    result: run({ PHASE5_IOS_BUILD_ID: 'pending-ios-build' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_IOS_BUILD_ID must be a real EAS build UUID or expo\.dev build URL/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects generic iOS device labels',
    result: run({ PHASE5_IOS_DEVICE: 'iPhone model / iOS version' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_IOS_DEVICE must name a physical iPhone model and iOS version/.test(output(result))
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects iOS labels without a physical model',
    result: run({ PHASE5_IOS_DEVICE: 'iPhone / iOS 18.5' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_IOS_DEVICE must name a physical iPhone model and iOS version/.test(output(result))
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects iPad evidence outside the iPhone-only contract',
    result: run({ PHASE5_IOS_DEVICE: 'iPad Pro / iPadOS 26.0' }),
    expect(result) {
      return (
        result.status === 1 && /iPad is outside the active release contract/.test(output(result))
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet marks Android build and device evidence not applicable',
    result: run({ PHASE5_ANDROID_BUILD_ID: '', PHASE5_ANDROID_DEVICE: '' }),
    expect(result) {
      if (result.status !== 0) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.buildEvidence.platformStatus.ios === 'required' &&
        packet.buildEvidence.platformStatus.android === 'not_applicable' &&
        packet.buildEvidence.androidBuildId === null &&
        packet.buildEvidence.androidDevice === null
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects placeholder signoff names',
    result: run({ PHASE5_SIGNED_OFF_BY: 'name' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_SIGNED_OFF_BY must name a real tester\/reviewer, not a placeholder/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects generic tester-name signoffs',
    result: run({ PHASE5_SIGNED_OFF_BY: 'Tester Name' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_SIGNED_OFF_BY must name a real tester\/reviewer, not a placeholder/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet accepts case-insensitive signoff truth',
    result: run({ PHASE5_QA_SIGNOFF: ' TRUE ' }),
    expect(result) {
      const text = output(result);
      return result.status === 0 && /device-qa-packet\.json/.test(text) && !/^FAIL /m.test(text);
    },
  },
  {
    name: 'strict Phase 5 QA packet normalizes named signoff output',
    result: run({ PHASE5_SIGNED_OFF_BY: ' Tas Mohammed ' }),
    expect(result) {
      if (result.status !== 0) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.buildEvidence.signedOffBy === 'Tas Mohammed' &&
        packet.widgetLifecycleEvidence.status === 'pass' &&
        packet.widgetLifecycleEvidence.summary.artifactCount === 15 &&
        packet.widgetLifecycleEvidence.summary.baseArtifactCount === 11 &&
        packet.widgetLifecycleEvidence.summary.proofAttachmentCount === 4 &&
        packet.widgetLifecycleEvidence.summary.scenarioCount === 4 &&
        /^[0-9a-f]{64}$/i.test(packet.widgetLifecycleEvidence.sha256) &&
        /^[0-9a-f]{40}$/i.test(packet.gitSha) &&
        typeof packet.gitStatus === 'string' &&
        Array.isArray(packet.warnings) &&
        packet.files.some((file) => file.path === 'scripts/phase5/build-device-qa-packet.mjs') &&
        packet.files.some((file) => file.path === 'scripts/phase5/check-native-config.mjs') &&
        packet.files.some(
          (file) => file.path === 'scripts/phase5/check-performance-evidence.mjs',
        ) &&
        packet.files.some((file) => file.path === 'scripts/phase5/device-qa-packet-smoke.mjs') &&
        packet.files.some(
          (file) => file.path === 'scripts/phase5/performance-evidence-contract.mjs',
        ) &&
        packet.files.some(
          (file) => file.path === 'scripts/phase5/performance-evidence-smoke.mjs',
        ) &&
        packet.files.some((file) => file.path === 'docs/hugeToDo/launch-contract.json') &&
        packet.files.some((file) => file.path === 'scripts/launch/contract.mjs') &&
        packet.files.some((file) => file.path === 'scripts/e2e/human-e2e-manifest.mjs') &&
        packet.files.some((file) => file.path === 'apps/mobile/src/app/_layout.tsx') &&
        packet.files.some((file) => file.path === 'apps/mobile/src/app/(tabs)/progress.tsx') &&
        packet.files.some((file) => file.path === 'apps/mobile/src/app/(tabs)/shelf.tsx') &&
        packet.files.some((file) => file.path === 'apps/mobile/src/app/(tabs)/you.tsx') &&
        packet.files.some((file) => file.path === 'apps/mobile/src/features/shelf/freshness.ts') &&
        packet.files.some(
          (file) =>
            file.path === 'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
        ) &&
        packet.files.some(
          (file) =>
            file.path === 'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
        ) &&
        packet.files.some(
          (file) =>
            file.path === 'supabase/migrations/20260713000045_anonymous_photo_storage_guard.sql',
        ) &&
        packet.files.some((file) => file.path === 'scripts/phase9/rls-adversarial-smoke.mjs') &&
        packet.files.some((file) => file.path === 'scripts/phase2/supabase-rls-smoke.mjs') &&
        packet.files.some((file) => file.path === 'apps/mobile/src/features/photos/consent.ts') &&
        packet.files.some((file) => file.path === 'docs/HUMAN_SIMULATED_E2E_TESTING.md') &&
        packet.files.some((file) => file.path === 'docs/E2E_TESTING_CHECKLIST.md') &&
        packet.files.some((file) => file.path === 'docs/USER_FLOW_TREE.md') &&
        packet.files.some((file) => file.path === 'docs/phase-5/performance-evidence-runbook.md') &&
        packet.files.some(
          (file) => file.path === 'docs/phase-5/performance-evidence.template.json',
        ) &&
        packet.files.some((file) => file.path === 'docs/e2e/generated/human-e2e-manifest.json') &&
        packet.files.some((file) => file.path === 'docs/e2e/generated/human-e2e-manifest.md') &&
        [
          'apps/mobile/src/features/healthConsent/HealthDataActivationMount.tsx',
          'apps/mobile/src/features/healthConsent/HealthDataActivationMount.test.ts',
          'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx',
          'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.navigation.test.ts',
          'apps/mobile/src/features/healthConsent/healthLifecycleRoutes.test.ts',
          'apps/mobile/src/features/healthConsent/selectiveCleanup.ts',
          'apps/mobile/src/features/healthConsent/selectiveCleanup.test.ts',
          'apps/mobile/src/features/settings/accountDeletionRecovery.ts',
          'apps/mobile/src/features/settings/accountDeletionRecovery.test.ts',
          'apps/mobile/src/features/settings/localPrivateData.ts',
          'apps/mobile/src/features/settings/localPrivateData.test.ts',
          'apps/mobile/src/lib/auth/AuthProvider.tsx',
          'apps/mobile/src/lib/auth/authDerivedCleanupAuthProviderContracts.test.ts',
          'apps/mobile/src/lib/auth/revokedCredentialActivity.ts',
          'apps/mobile/src/lib/auth/revokedCredentialActivity.test.ts',
          'apps/mobile/src/features/widgets/nativeLifecycle.ts',
          'apps/mobile/src/features/widgets/nativeLifecycle.ios.ts',
          'apps/mobile/src/features/widgets/nativeLifecycleContract.ts',
          'apps/mobile/src/features/widgets/nativeLifecycleContract.test.ts',
          'apps/mobile/src/features/widgets/nativeLifecycleBridge.test.ts',
          'apps/mobile/src/features/widgets/nativeOutboxModel.ts',
          'apps/mobile/src/features/widgets/nativeOutboxModel.test.ts',
          'apps/mobile/src/features/widgets/ownerAuthority.ts',
          'apps/mobile/src/features/widgets/ownerAuthority.test.ts',
          'apps/mobile/src/features/widgets/lifecycleCoordinator.ts',
          'apps/mobile/src/features/widgets/lifecycleCoordinator.test.ts',
          'apps/mobile/src/features/widgets/lifecycleRuntime.ts',
          'apps/mobile/src/features/widgets/lifecycleRuntime.ios.ts',
          'apps/mobile/src/features/widgets/lifecycleRuntime.test.ts',
          'apps/mobile/src/features/widgets/RoutineWidgetLifecycleHost.tsx',
          'apps/mobile/src/features/widgets/RoutineWidgetLifecycleHost.test.ts',
          'apps/mobile/src/features/widgets/runtimeGate.ts',
          'apps/mobile/src/features/widgets/runtimeGate.test.ts',
          'apps/mobile/src/features/widgets/controllerCore.ts',
          'apps/mobile/src/features/widgets/controllerCore.test.ts',
          'scripts/phase5/expo-widgets-56.0.23/RoutineKindWidgetLifecycleStore.swift',
          'scripts/phase5/expo-widgets-56.0.23/AppIntent.swift',
          'scripts/phase5/expo-widgets-56.0.23/EntryView.swift',
          'scripts/phase5/expo-widgets-56.0.23/ExpoWidgets.podspec',
          'scripts/phase5/expo-widgets-56.0.23/LiveActivity.swift',
          'scripts/phase5/expo-widgets-56.0.23/LiveActivityFactory.swift',
          'scripts/phase5/expo-widgets-56.0.23/TimelineProvider.swift',
          'scripts/phase5/expo-widgets-56.0.23/Utils.swift',
          'scripts/phase5/expo-widgets-56.0.23/WidgetLiveActivity.swift',
          'scripts/phase5/expo-widgets-56.0.23/WidgetObject.swift',
          'scripts/phase5/expo-widgets-56.0.23/WidgetsModule.swift',
        ].every((path) =>
          packet.files.some(
            (file) => file.path === path && /^[0-9a-f]{64}$/i.test(file.sha256 ?? ''),
          ),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet ignores central generated evidence changes',
    result: runWithDirtyGeneratedEvidence({}),
    expect(result) {
      if (result.status !== 0) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        !packet.gitStatus.includes('docs/phase-3/generated/review-worklist.json') &&
        !packet.blockers.some((blocker) => /dirty Git worktree/.test(blocker))
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects a dirty source worktree',
    result: runWithDirtyWorktree({}),
    expect(result) {
      if (result.status !== 1) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.gitStatus.includes(`.phase5-smoke-dirty-${process.pid}.tmp`) &&
        packet.blockers.includes(
          'Phase 5 device QA packet generated with a dirty Git worktree outside its generated output and validated lifecycle evidence; do not use it as final native-device evidence.',
        )
      );
    },
  },
  {
    name: 'non-strict Phase 5 QA packet warns on dirty source without claiming clearance',
    result: runWithDirtyWorktree({}, false),
    expect(result) {
      if (result.status !== 0) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.gitStatus.includes(`.phase5-smoke-dirty-${process.pid}.tmp`) &&
        packet.warnings.includes(
          'Phase 5 device QA packet generated with a dirty Git worktree outside its generated output and validated lifecycle evidence; do not use it as final native-device evidence.',
        )
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
