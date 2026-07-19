#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, posix, relative, resolve } from 'node:path';
import {
  command,
  evidenceFlagEnabled,
  gitStatusExcludingGeneratedEvidence,
  normalizeNamedSignoff,
  placeholderEnvValue,
} from '../phase9/lib.mjs';
import {
  isReleasePlatformRequired,
  launchContractSnapshot,
  loadLaunchContract,
  platformRequirementStatus,
} from '../launch/contract.mjs';
import {
  validateWidgetLifecycleEvidence,
  WIDGET_LIFECYCLE_EVIDENCE_ROOT,
} from './widget-lifecycle-evidence-contract.mjs';
import {
  NATIVE_OCR_EVIDENCE_ROOT,
  NATIVE_OCR_REQUIRED_SOURCE_FILES,
  normalizeNativeOcrEvidencePath,
  validateNativeOcrEvidence,
} from './native-ocr-evidence-contract.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const launchContract = loadLaunchContract(root);
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);
const packetOutDir = process.env.PHASE5_QA_PACKET_OUT_DIR ?? 'docs/phase-5/generated';
const outDir = resolve(root, packetOutDir);
const packetOutputPaths = [
  `${packetOutDir}/device-qa-packet.json`,
  `${packetOutDir}/device-qa-packet.md`,
].map((path) => path.replace(/\\/g, '/'));

const requiredFiles = Array.from(
  new Set([
    '.env.example',
    'package.json',
    'package-lock.json',
    'docs/hugeToDo/launch-contract.json',
    'scripts/launch/contract.mjs',
    'apps/mobile/app.base.json',
    'apps/mobile/app.config.js',
    'apps/mobile/plugins/withRoutineKindWidgetPrivacyManifest.js',
    'apps/mobile/eas.json',
    'apps/mobile/package.json',
    'apps/mobile/src/app/_layout.tsx',
    'apps/mobile/src/lib/appConfig.test.ts',
    'apps/mobile/src/lib/launch/phase7.ts',
    'apps/mobile/src/lib/launch/phase7.test.ts',
    'apps/mobile/src/app/(tabs)/progress.tsx',
    'apps/mobile/src/app/(tabs)/shelf.tsx',
    'apps/mobile/src/app/(tabs)/you.tsx',
    'apps/mobile/src/app/onboarding/products.tsx',
    'apps/mobile/src/app/shelf/[id].tsx',
    'apps/mobile/src/app/shelf/_layout.tsx',
    'apps/mobile/src/app/shelf/opened.tsx',
    'apps/mobile/src/app/shelf/replenish.tsx',
    'apps/mobile/src/app/shelf/scan.tsx',
    'apps/mobile/src/app/shelf/search.tsx',
    'apps/mobile/src/app/shelf/ocr.tsx',
    'apps/mobile/src/app/progress/capture.tsx',
    'apps/mobile/src/app/progress/review.tsx',
    'apps/mobile/src/app/progress/[id].tsx',
    'apps/mobile/src/features/catalog/client.ts',
    'apps/mobile/src/features/catalog/client.test.ts',
    'apps/mobile/src/features/intelligence/pao.ts',
    'apps/mobile/src/features/intelligence/pao.test.ts',
    'apps/mobile/src/features/native/camera/barcode.ts',
    'apps/mobile/src/features/native/camera/labelPhotoStartup.ts',
    'apps/mobile/src/features/notifications/BehaviouralTriggers.tsx',
    'apps/mobile/src/features/notifications/claimsafety.test.ts',
    'apps/mobile/src/features/notifications/copy.ts',
    'apps/mobile/src/features/notifications/store.ts',
    'apps/mobile/src/features/notifications/store.test.ts',
    'apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts',
    'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
    'apps/mobile/src/features/today/completionsStore.ts',
    'apps/mobile/src/features/today/completionsStore.test.ts',
    'apps/mobile/src/features/today/routineProjection.ts',
    'apps/mobile/src/features/today/routineProjection.test.ts',
    'apps/mobile/src/features/widgets/actionRegistry.ts',
    'apps/mobile/src/features/widgets/actionRegistry.test.ts',
    'apps/mobile/src/features/widgets/contract.ts',
    'apps/mobile/src/features/widgets/contract.test.ts',
    'apps/mobile/src/features/widgets/controllerCore.ts',
    'apps/mobile/src/features/widgets/controllerCore.test.ts',
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
    'apps/mobile/src/features/widgets/TodayWidget.ios.tsx',
    'apps/mobile/src/features/widgets/TonightActivity.ios.tsx',
    'apps/mobile/src/features/widgets/widgetViews.test.ts',
    'apps/mobile/src/features/photos/analyzePhotoLighting.ts',
    'apps/mobile/src/features/photos/CaptureAnalysisProvider.native.tsx',
    'apps/mobile/src/features/photos/CaptureAnalysisProvider.tsx',
    'apps/mobile/src/features/photos/captureAnalysis.ts',
    'apps/mobile/src/features/photos/consent.ts',
    'apps/mobile/src/features/photos/encryptedStorage.ts',
    'apps/mobile/src/features/photos/PhotoTimelineLockGate.tsx',
    'apps/mobile/src/features/photos/PhotoStorageGate.tsx',
    'apps/mobile/src/features/photos/store.ts',
    'apps/mobile/src/features/photos/usePhotos.ts',
    'apps/mobile/src/features/photos/useCaptureAnalysis.ts',
    'apps/mobile/src/features/photos/useDetectedFaces.native.ts',
    'apps/mobile/src/features/photos/useDetectedFaces.ts',
    'apps/mobile/src/features/recommendations/replenishment.ts',
    'apps/mobile/src/features/recommendations/replenishment.test.ts',
    'apps/mobile/src/features/shelf/IntakeContext.tsx',
    'apps/mobile/src/features/shelf/LocalDateField.tsx',
    'apps/mobile/src/features/shelf/freshness.ts',
    'apps/mobile/src/features/shelf/freshness.test.ts',
    'apps/mobile/src/features/shelf/freshnessMigration.test.ts',
    'apps/mobile/src/features/shelf/mutations.ts',
    'apps/mobile/src/features/shelf/paoProvenance.ts',
    'apps/mobile/src/features/shelf/paoProvenance.test.ts',
    'apps/mobile/src/features/shelf/shelfRoutes.test.ts',
    'apps/mobile/src/features/shelf/store.ts',
    'apps/mobile/src/features/shelf/store.test.ts',
    'apps/mobile/src/features/shelf/useShelf.ts',
    'apps/mobile/src/features/shelf/useShelf.test.ts',
    'packages/types/src/database.types.ts',
    'supabase/migrations/20260710000036_photo_quality_provenance.sql',
    'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
    'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
    'supabase/migrations/20260713000045_anonymous_photo_storage_guard.sql',
    'apps/mobile/src/features/notifications/deliver.ts',
    'apps/mobile/src/lib/iap/revenuecat.ts',
    'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts',
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
    'scripts/postinstall.mjs',
    'scripts/phase5/patch-expo-widgets-lifecycle.mjs',
    'scripts/phase5/patch-expo-widgets-lifecycle.test.mjs',
    'scripts/phase5/expo-widgets-lifecycle-source.test.mjs',
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
    'apps/mobile/src/lib/applock/AppLockProvider.tsx',
    'apps/mobile/src/lib/applock/authenticate.ts',
    'scripts/phase5/build-device-qa-packet.mjs',
    'scripts/phase5/check-native-config.mjs',
    'scripts/phase5/ios-extension-contract.mjs',
    'scripts/phase5/ios-extension-contract.test.mjs',
    'scripts/phase5/widget-privacy-manifest.test.mjs',
    'scripts/phase5/widget-lifecycle-evidence-contract.mjs',
    'scripts/phase5/check-widget-lifecycle-evidence.mjs',
    'scripts/phase5/widget-lifecycle-evidence-smoke.mjs',
    'scripts/phase5/resolve-ios-extension-config.mjs',
    'scripts/phase5/check-performance-evidence.mjs',
    'scripts/phase5/device-qa-packet-smoke.mjs',
    'scripts/phase5/performance-evidence-contract.mjs',
    'scripts/phase5/performance-evidence-smoke.mjs',
    'scripts/e2e/human-e2e-manifest.mjs',
    'scripts/phase2/supabase-rls-smoke.mjs',
    'scripts/phase9/lib.mjs',
    'scripts/phase9/live-supabase-adversarial.mjs',
    'scripts/phase9/rls-adversarial-smoke.mjs',
    'scripts/phase9/rls-adversarial.mjs',
    'docs/DEVICE_SUPPORT_POLICY.md',
    'docs/HUMAN_SIMULATED_E2E_TESTING.md',
    'docs/E2E_TESTING_CHECKLIST.md',
    'docs/USER_FLOW_TREE.md',
    'docs/hugeToDo/IOS-02-WIDGET-LIFECYCLE-SOURCE-CHECKPOINT-2026-07-16.md',
    'docs/e2e/generated/human-e2e-manifest.json',
    'docs/e2e/generated/human-e2e-manifest.md',
    'docs/phase-5/native-build-runbook.md',
    'docs/phase-5/widget-lifecycle-evidence.template.json',
    'docs/phase-5/device-qa-checklist.md',
    'docs/phase-5/performance-evidence-runbook.md',
    'docs/phase-5/performance-evidence.template.json',
    'docs/phase-5/phase-5-exit-review.md',
    ...NATIVE_OCR_REQUIRED_SOURCE_FILES,
    'scripts/cat05/native-label-ocr-source-contract.test.mjs',
    'scripts/e2e/cat05-native-ocr-ui-audit.mjs',
    'scripts/e2e/cat05-native-ocr-ui-audit.test.mjs',
    'scripts/phase5/check-native-ocr-evidence.mjs',
    'scripts/phase5/native-ocr-evidence-contract.mjs',
    'scripts/phase5/native-ocr-evidence-smoke.mjs',
    'docs/phase-5/native-ocr-evidence-runbook.md',
    'docs/phase-5/native-ocr-evidence.template.json',
  ]),
);

const scenarios = [
  ['Install', 'fresh install, update, reinstall, side-by-side dev/staging variants'],
  [
    'Permissions',
    'camera granted/denied, notification granted/denied/swiped away, biometric unavailable',
  ],
  ['Barcode', 'EAN-13, UPC-A, UPC-E, EAN-8, low light, glare, invalid checksum, duplicate read'],
  ['Label capture', 'clear INCI label, curved tube, tiny text, glare, manual correction'],
  [
    'Shelf freshness',
    'onboarding-origin exact-date entry, impossible/future-date rejection, explicit open-jar label confirmation, winning expiry source, reload, re-add, and replenishment-alert opt-in',
  ],
  [
    'Photos',
    'first capture, retake, reference ghost, measured framing/light, device-only storage/no backup control, no/multiple faces, analyzer unavailable, delete',
  ],
  [
    'Encryption and app lock',
    'restart, key present/missing simulation, direct Progress routes, prompt ordering, background relock, delete, share/export',
  ],
  ['Reminders', 'AM/PM, quiet hours, timezone, reboot, app killed, battery saver, Focus mode'],
  ['Share', 'native share sheet, cancel path, long names, no sharing available'],
  ['RevenueCat', 'configure, fetch offerings, Test Store purchase, restore from user action'],
  ['Offline', 'manual add, timeline view, no-match fallback, queued metadata'],
  ['Observability', 'native crash captured, no sensitive event payloads'],
  [
    'Performance',
    'predeclared thresholds plus supported-device startup, intake, barcode, routine, and encrypted-photo load/memory evidence',
  ],
  [
    'Widget archive',
    'macOS archive contains the signed extension, expected App Group entitlement, target privacy manifest, final identities, and no unapproved capabilities',
  ],
  [
    'Widget families and deep links',
    'small, medium, inline, and rectangular families render and redact correctly; final-brand Today deep links survive cold start and recovery',
  ],
  [
    'Widget interaction and privacy lifecycle',
    'concurrent/repeated check-offs, app killed/relaunched, lock state, stale/unknown tokens, sign-out, account switch, consent withdrawal, expiry, and corrupt shared bytes',
  ],
  [
    'Live Activity lifecycle',
    'start, update, stale, complete, explicit end, app process death, device restart, lock-screen redaction, and disabled-state cleanup',
  ],
];

const requiredQaEvidenceFlags = [
  ['PHASE5_DEVICE_QA_PASS', 'overall native-device QA matrix'],
  ['PHASE5_INSTALL_QA_PASS', 'fresh install, update, reinstall, and dev/staging variants'],
  [
    'PHASE5_CAMERA_PERMISSION_QA_PASS',
    'native camera permission denial, retry, and settings recovery',
  ],
  ['PHASE5_BARCODE_QA_PASS', 'physical-device barcode scan and checksum matrix'],
  ['PHASE5_LABEL_CAPTURE_QA_PASS', 'real label capture, editable text, and manual fallback'],
  ['PHASE5_PROGRESS_PHOTO_QA_PASS', 'progress still capture, retake, review, and recovery'],
  [
    'PHASE5_ENCRYPTED_PHOTO_STORAGE_QA_PASS',
    'encrypted photo save, restart, key-missing recovery, and delete',
  ],
  ['PHASE5_NOTIFICATION_QA_PASS', 'iOS reminder delivery and permission behavior'],
  ['PHASE5_SHARE_SHEET_QA_PASS', 'native share sheet success, cancel, and unavailable states'],
  [
    'PHASE5_REVENUECAT_NATIVE_QA_PASS',
    'RevenueCat native configure, offering, purchase, and restore smoke',
  ],
  ['PHASE5_SENTRY_NATIVE_QA_PASS', 'Sentry native crash/source-map smoke'],
  [
    'PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS',
    'native Supabase catalog lookup and no-match/error fallback',
  ],
  ['PHASE5_ACCESSIBILITY_QA_PASS', 'VoiceOver labels, traversal, and 44 pt controls'],
  [
    'PHASE5_WIDGET_ARCHIVE_QA_PASS',
    'signed archive extension, App Group entitlement, target privacy manifest, and capability inspection',
  ],
  [
    'PHASE5_WIDGET_DEVICE_QA_PASS',
    'physical-iPhone widget families, cold-start deep links, process death, and accessibility',
  ],
  [
    'PHASE5_WIDGET_INTERACTION_PRIVACY_QA_PASS',
    'atomic widget interaction plus lock, expiry, sign-out, account-switch, and consent-withdrawal cleanup',
  ],
  [
    'PHASE5_LIVE_ACTIVITY_QA_PASS',
    'physical-iPhone Live Activity stale, end, process-death, restart, and locked-state behavior',
  ],
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

function markdownTable(headers, tableRows) {
  const rows = [headers, ...tableRows];
  const widths = headers.map((_, index) =>
    Math.max(...rows.map((row) => String(row[index] ?? '').length), 3),
  );
  const formatRow = (row) =>
    `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  const separator = widths.map((width) => '-'.repeat(width));
  return [formatRow(headers), formatRow(separator), ...tableRows.map(formatRow)].join('\n');
}

function envValue(name) {
  return String(process.env[name] ?? '').trim();
}

function normalizedWidgetEvidencePath(value) {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    !value ||
    value.includes('\\') ||
    value.includes('%') ||
    /\s/.test(value) ||
    isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return null;
  }
  const normalized = posix.normalize(value);
  return normalized === value &&
    !normalized.startsWith('../') &&
    !normalized.includes('/../') &&
    normalized.startsWith(WIDGET_LIFECYCLE_EVIDENCE_ROOT)
    ? normalized
    : null;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function nativeOcrSourceLineage(sourceGitSha, currentGitSha) {
  if (
    !/^[0-9a-f]{40}$/i.test(String(sourceGitSha ?? '')) ||
    !/^[0-9a-f]{40}$/i.test(String(currentGitSha ?? ''))
  ) {
    return { isAncestor: false, changedPaths: null };
  }
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', sourceGitSha, currentGitSha], {
    cwd: root,
    encoding: 'utf8',
  });
  if (ancestor.status !== 0) return { isAncestor: false, changedPaths: null };
  const diff = spawnSync(
    'git',
    ['-c', 'core.quotepath=false', 'diff', '--name-only', `${sourceGitSha}..${currentGitSha}`],
    { cwd: root, encoding: 'utf8' },
  );
  if (diff.status !== 0) return { isAncestor: true, changedPaths: null };
  return {
    isAncestor: true,
    changedPaths: String(diff.stdout ?? '')
      .split(/\r?\n/)
      .map((path) => path.trim().replaceAll('\\', '/'))
      .filter(Boolean),
  };
}

function gitStatusExcludingGeneratedPacket(validatedEvidencePaths = []) {
  return gitStatusExcludingGeneratedEvidence([...packetOutputPaths, ...validatedEvidencePaths]);
}

function looksLikeEasBuildEvidence(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed) || /\b(local|simulator|emulator|fake|mock)\b/i.test(trimmed)) {
    return false;
  }
  const easBuildId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const easBuildUrl =
    /^https:\/\/expo\.dev\/accounts\/[^/\s]+\/projects\/[^/\s]+\/builds\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:[?#].*)?$/i;
  return easBuildId.test(trimmed) || easBuildUrl.test(trimmed);
}

function looksLikePhysicalIosDevice(value) {
  const trimmed = String(value ?? '').trim();
  if (
    placeholderEnvValue(trimmed) ||
    /\b(simulator|emulator)\b/i.test(trimmed) ||
    /\bmodel\s*\//i.test(trimmed)
  ) {
    return false;
  }
  const supportedDevice = launchContract.release.supportsIpad
    ? /\b(?:iPhone|iPad)\s+(?!\/|(?:iOS|iPadOS)\b)\S+/i
    : /\biPhone\s+(?!\/|iOS\b)\S+/i;
  const supportedOs = launchContract.release.supportsIpad
    ? /\b(?:iOS|iPadOS)\s+\d{1,2}(?:\.\d+){0,2}\b/i
    : /\biOS\s+\d{1,2}(?:\.\d+){0,2}\b/i;
  return supportedDevice.test(trimmed) && supportedOs.test(trimmed);
}

function looksLikePhysicalAndroidDevice(value) {
  const trimmed = String(value ?? '').trim();
  if (
    placeholderEnvValue(trimmed) ||
    /\b(simulator|emulator)\b/i.test(trimmed) ||
    /\bmodel\s*\//i.test(trimmed) ||
    /^(?:android|phone|device)(?:\s+(?:model|phone|device))?\s*(?:\/|$)/i.test(trimmed)
  ) {
    return false;
  }
  return /\bAndroid(?:\s+OS)?\s+\d{1,2}(?:\.\d+){0,2}\b/i.test(trimmed);
}

const rawSignedOffBy = envValue('PHASE5_SIGNED_OFF_BY');
const normalizedSignedOffBy = normalizeNamedSignoff(rawSignedOffBy) ?? '';
const eas = readJson('apps/mobile/eas.json');
const iosBuildProfile = envValue('PHASE5_IOS_BUILD_PROFILE');
const nativeOcrEnabledInAnyBuild = Object.values(eas.build ?? {}).some((profile) =>
  evidenceFlagEnabled(profile?.env?.EXPO_PUBLIC_NATIVE_OCR_ENABLED),
);
const selectedBuildProfile = eas.build?.[iosBuildProfile];
const nativeOcrEnabled =
  evidenceFlagEnabled(process.env.EXPO_PUBLIC_NATIVE_OCR_ENABLED) ||
  (selectedBuildProfile
    ? evidenceFlagEnabled(selectedBuildProfile.env?.EXPO_PUBLIC_NATIVE_OCR_ENABLED)
    : nativeOcrEnabledInAnyBuild);

const buildEvidence = {
  iosBuildId: envValue('PHASE5_IOS_BUILD_ID'),
  iosBuildProfile,
  androidBuildId: androidReleaseRequired ? envValue('PHASE5_ANDROID_BUILD_ID') : null,
  iosDevice: envValue('PHASE5_IOS_DEVICE'),
  androidDevice: androidReleaseRequired ? envValue('PHASE5_ANDROID_DEVICE') : null,
  platformStatus: {
    ios: platformRequirementStatus('ios', launchContract),
    android: platformRequirementStatus('android', launchContract),
  },
  qaSignedOff: evidenceFlagEnabled(process.env.PHASE5_QA_SIGNOFF),
  signedOffBy: normalizedSignedOffBy,
};

const qaEvidence = Object.fromEntries(
  requiredQaEvidenceFlags.map(([key, label]) => [
    key,
    { label, required: true, passed: evidenceFlagEnabled(process.env[key]) },
  ]),
);

const files = requiredFiles.map(hashFile);
const blockers = [];
const warnings = [];
let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
} catch {
  warnings.push('Git SHA could not be captured.');
}
const rawWidgetLifecycleEvidencePath = envValue('PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH');
const normalizedWidgetLifecycleEvidencePath = normalizedWidgetEvidencePath(
  rawWidgetLifecycleEvidencePath,
);
let widgetLifecycleEvidence = {
  path: normalizedWidgetLifecycleEvidencePath,
  status: 'blocked',
  sha256: null,
  artifacts: [],
  summary: {
    artifactCount: 0,
    baseArtifactCount: 0,
    requiredBaseArtifactCount: 11,
    minimumProofAttachmentCount: 4,
    proofAttachmentCount: 0,
    scenarioCount: 0,
  },
  binding: null,
};
let validatedWidgetEvidencePaths = [];
if (!rawWidgetLifecycleEvidencePath) {
  blockers.push(
    'Missing PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH; widget booleans do not substitute for artifact-bound archive/device/lifecycle evidence.',
  );
} else if (!normalizedWidgetLifecycleEvidencePath) {
  blockers.push(
    `PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH must be a normalized repo-relative JSON path under ${WIDGET_LIFECYCLE_EVIDENCE_ROOT}.`,
  );
} else {
  const evidenceFile = hashFile(normalizedWidgetLifecycleEvidencePath);
  if (!evidenceFile.exists) {
    blockers.push(
      `Widget lifecycle evidence file does not exist: ${normalizedWidgetLifecycleEvidencePath}.`,
    );
  } else {
    try {
      const evidence = readJson(normalizedWidgetLifecycleEvidencePath);
      const validation = validateWidgetLifecycleEvidence(evidence, {
        root,
        expectedGitSha: gitSha,
        expectedBuildId: buildEvidence.iosBuildId,
        expectedSignedOffBy: rawSignedOffBy,
        expectedAppBundleIdentifier: envValue('APP_IOS_BUNDLE_IDENTIFIER'),
        expectedTeamIdentifier: envValue('APPLE_TEAM_ID'),
      });
      for (const error of validation.errors) {
        blockers.push(`Widget lifecycle evidence: ${error}`);
      }
      for (const warning of validation.warnings) {
        warnings.push(`Widget lifecycle evidence: ${warning}`);
      }
      widgetLifecycleEvidence = {
        path: normalizedWidgetLifecycleEvidencePath,
        status: validation.errors.length === 0 ? 'pass' : 'blocked',
        sha256: evidenceFile.sha256,
        artifacts: validation.artifacts,
        summary: validation.summary,
        binding: {
          sourceGitSha: evidence.sourceGitSha ?? null,
          easIosBuildId: evidence.build?.easIosBuildId ?? null,
          appBundleIdentifier: evidence.identifiers?.appBundleIdentifier ?? null,
          extensionBundleIdentifier: evidence.identifiers?.extensionBundleIdentifier ?? null,
          appGroupIdentifier: evidence.identifiers?.appGroupIdentifier ?? null,
          teamIdentifier: evidence.identifiers?.teamIdentifier ?? null,
          device: evidence.device ?? null,
          signedOffBy: evidence.signoff?.signedOffBy ?? null,
        },
      };
      if (validation.errors.length === 0) {
        validatedWidgetEvidencePaths = [
          normalizedWidgetLifecycleEvidencePath,
          ...validation.artifacts.map(({ path }) => path),
        ];
      }
    } catch (error) {
      blockers.push(
        `Widget lifecycle evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
      );
    }
  }
}
const rawNativeOcrEvidencePath = envValue('PHASE5_NATIVE_OCR_EVIDENCE_PATH');
const normalizedNativeOcrEvidencePath = normalizeNativeOcrEvidencePath(rawNativeOcrEvidencePath);
let nativeOcrEvidence = {
  required: nativeOcrEnabled,
  path: normalizedNativeOcrEvidencePath,
  status: nativeOcrEnabled ? 'blocked' : 'not_required_not_attached',
  sha256: null,
  artifacts: [],
  summary: {
    devices: 0,
    corpusItems: 0,
    rtlCorpusItems: 0,
    runs: 0,
    requiredRuns: 0,
    labelClasses: 0,
  },
  binding: null,
};
let validatedNativeOcrEvidencePaths = [];
if (!rawNativeOcrEvidencePath) {
  const message =
    'Missing PHASE5_NATIVE_OCR_EVIDENCE_PATH; a Boolean pass flag cannot substitute for exact-build physical-iPhone OCR evidence.';
  if (nativeOcrEnabled) blockers.push(message);
  else warnings.push(`${message} Native OCR must remain disabled for production claims.`);
} else if (!normalizedNativeOcrEvidencePath) {
  blockers.push(
    `PHASE5_NATIVE_OCR_EVIDENCE_PATH must be a normalized repo-relative JSON path under ${NATIVE_OCR_EVIDENCE_ROOT}.`,
  );
} else {
  const evidenceFile = hashFile(normalizedNativeOcrEvidencePath);
  if (!evidenceFile.exists) {
    blockers.push(`Native OCR evidence file does not exist: ${normalizedNativeOcrEvidencePath}.`);
  } else {
    try {
      const evidence = readJson(normalizedNativeOcrEvidencePath);
      const lineage = nativeOcrSourceLineage(evidence.sourceGitSha, gitSha);
      const validation = validateNativeOcrEvidence(evidence, {
        root,
        currentGitSha: gitSha,
        sourceGitShaIsAncestor: lineage.isAncestor,
        changedPathsSinceSource: lineage.changedPaths,
        evidencePath: normalizedNativeOcrEvidencePath,
        expectedBuildId: buildEvidence.iosBuildId || null,
        expectedBuildProfile: buildEvidence.iosBuildProfile || null,
      });
      for (const error of validation.errors) blockers.push(`Native OCR evidence: ${error}`);
      for (const warning of validation.warnings) warnings.push(`Native OCR evidence: ${warning}`);
      nativeOcrEvidence = {
        required: nativeOcrEnabled,
        path: normalizedNativeOcrEvidencePath,
        status: validation.errors.length === 0 ? 'pass' : 'blocked',
        sha256: evidenceFile.sha256,
        artifacts: validation.artifacts,
        summary: validation.summary,
        binding: {
          sourceGitSha: evidence.sourceGitSha ?? null,
          easIosBuildId: evidence.build?.easIosBuildId ?? null,
          profile: evidence.build?.profile ?? null,
          appBundleIdentifier: evidence.build?.appBundleIdentifier ?? null,
          archiveSha256: evidence.build?.archiveSha256 ?? null,
          devices: evidence.devices ?? null,
          qaSignedOffBy: evidence.signoff?.qaSignedOffBy ?? null,
          privacySignedOffBy: evidence.signoff?.privacySignedOffBy ?? null,
        },
      };
      if (validation.errors.length === 0) {
        validatedNativeOcrEvidencePaths = [
          normalizedNativeOcrEvidencePath,
          ...validation.artifacts.map(({ path }) => path),
        ];
      }
    } catch (error) {
      blockers.push(
        `Native OCR evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
      );
    }
  }
}
if (envValue('PHASE5_NATIVE_OCR_QA_PASS')) {
  warnings.push(
    'PHASE5_NATIVE_OCR_QA_PASS is ignored; only PHASE5_NATIVE_OCR_EVIDENCE_PATH can provide native OCR QA evidence.',
  );
}
try {
  gitStatus = gitStatusExcludingGeneratedPacket([
    ...validatedWidgetEvidencePaths,
    ...validatedNativeOcrEvidencePaths,
  ]);
} catch {
  warnings.push('Git status could not be captured.');
}
if (gitStatus.length > 0) {
  const dirtyMessage =
    'Phase 5 device QA packet generated with a dirty Git worktree outside its generated output and validated lifecycle/OCR evidence; do not use it as final native-device evidence.';
  if (strict) blockers.push(dirtyMessage);
  else warnings.push(dirtyMessage);
}
if (!buildEvidence.iosBuildId) blockers.push('Missing PHASE5_IOS_BUILD_ID.');
else if (!looksLikeEasBuildEvidence(buildEvidence.iosBuildId)) {
  blockers.push('PHASE5_IOS_BUILD_ID must be a real EAS build UUID or expo.dev build URL.');
}
if (!buildEvidence.iosBuildProfile) {
  blockers.push('Missing PHASE5_IOS_BUILD_PROFILE.');
} else if (!['development', 'staging', 'production'].includes(buildEvidence.iosBuildProfile)) {
  blockers.push('PHASE5_IOS_BUILD_PROFILE must be development, staging, or production.');
}
if (androidReleaseRequired) {
  if (!buildEvidence.androidBuildId) blockers.push('Missing PHASE5_ANDROID_BUILD_ID.');
  else if (!looksLikeEasBuildEvidence(buildEvidence.androidBuildId)) {
    blockers.push('PHASE5_ANDROID_BUILD_ID must be a real EAS build UUID or expo.dev build URL.');
  }
}
if (!buildEvidence.iosDevice) blockers.push('Missing PHASE5_IOS_DEVICE.');
else if (!looksLikePhysicalIosDevice(buildEvidence.iosDevice)) {
  blockers.push(
    launchContract.release.supportsIpad
      ? 'PHASE5_IOS_DEVICE must name a physical iPhone/iPad model and iOS/iPadOS version.'
      : 'PHASE5_IOS_DEVICE must name a physical iPhone model and iOS version; iPad is outside the active release contract.',
  );
}
if (androidReleaseRequired) {
  if (!buildEvidence.androidDevice) blockers.push('Missing PHASE5_ANDROID_DEVICE.');
  else if (!looksLikePhysicalAndroidDevice(buildEvidence.androidDevice)) {
    blockers.push(
      'PHASE5_ANDROID_DEVICE must name a physical Android model and Android OS version.',
    );
  }
}
if (!buildEvidence.qaSignedOff) blockers.push('Missing PHASE5_QA_SIGNOFF=true.');
if (!rawSignedOffBy) blockers.push('Missing PHASE5_SIGNED_OFF_BY.');
else if (!buildEvidence.signedOffBy) {
  blockers.push('PHASE5_SIGNED_OFF_BY must name a real tester/reviewer, not a placeholder.');
}
for (const [key, evidence] of Object.entries(qaEvidence)) {
  if (evidence.required && !evidence.passed) {
    blockers.push(`Missing ${key}=true (${evidence.label}).`);
  }
}
for (const file of files) if (!file.exists) blockers.push(`Missing ${file.path}.`);

const packet = {
  generatedAt: new Date().toISOString(),
  purpose: 'Phase 5 native device QA packet for contract-required release platforms.',
  launchContract: launchContractSnapshot(launchContract),
  gitSha,
  gitStatus,
  buildEvidence,
  qaEvidence,
  widgetLifecycleEvidence,
  nativeOcr: {
    enabledInAnyBuild: nativeOcrEnabledInAnyBuild,
    enabledInCandidateBuild: nativeOcrEnabled,
    qaRequired: nativeOcrEnabled,
    evidence: nativeOcrEvidence,
  },
  scenarios: scenarios.map(([surface, scenario]) => ({ surface, scenario })),
  files,
  blockers,
  warnings,
};

mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, 'device-qa-packet.json');
writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);

const fileRows = files.map((file) =>
  file.exists
    ? [file.path, 'present', String(file.bytes), file.sha256]
    : [file.path, 'missing', '', ''],
);
const scenarioRows = scenarios.map(([surface, scenario]) => [surface, scenario]);
const evidenceRows = Object.entries(qaEvidence).map(([key, evidence]) => [
  key,
  evidence.required ? 'required' : 'not required',
  evidence.passed ? 'PASS' : 'BLOCKED',
  evidence.label,
]);
const widgetArtifactRows = widgetLifecycleEvidence.artifacts.map((artifact) => [
  artifact.id,
  artifact.path,
  String(artifact.bytes),
  artifact.sha256,
]);
const nativeOcrArtifactRows = nativeOcrEvidence.artifacts.map((artifact) => [
  artifact.id,
  artifact.path,
  String(artifact.bytes),
  artifact.sha256,
]);
const mdPath = join(outDir, 'device-qa-packet.md');
writeFileSync(
  mdPath,
  [
    '# Generated Phase 5 Device QA Packet',
    '',
    `Generated at: ${packet.generatedAt}`,
    `Git SHA: ${packet.gitSha}`,
    `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
    '',
    'This file is generated by `npm run phase5:qa-packet`. Strict completion',
    'requires real EAS build IDs and physical devices for every contract-required platform, plus a named QA signoff.',
    '',
    '## Build Evidence',
    '',
    `- iOS build ID: ${buildEvidence.iosBuildId || 'BLOCKED'}`,
    `- iOS build profile: ${buildEvidence.iosBuildProfile || 'BLOCKED'}`,
    `- Android build ID: ${buildEvidence.androidBuildId || 'NOT APPLICABLE'}`,
    `- iOS device: ${buildEvidence.iosDevice || 'BLOCKED'}`,
    `- Android device: ${buildEvidence.androidDevice || 'NOT APPLICABLE'}`,
    `- QA signoff: ${buildEvidence.qaSignedOff ? 'yes' : 'BLOCKED'}`,
    `- Signed off by: ${buildEvidence.signedOffBy || 'BLOCKED'}`,
    `- Native OCR QA required: ${packet.nativeOcr.qaRequired ? 'yes' : 'no'}`,
    '',
    '## QA Evidence',
    '',
    markdownTable(['Key', 'Requirement', 'Status', 'Evidence scope'], evidenceRows),
    '',
    '## Widget Lifecycle Evidence',
    '',
    `- Status: ${widgetLifecycleEvidence.status === 'pass' ? 'PASS' : 'BLOCKED'}`,
    `- Evidence path: ${widgetLifecycleEvidence.path ?? 'BLOCKED'}`,
    `- Evidence SHA-256: ${widgetLifecycleEvidence.sha256 ?? 'BLOCKED'}`,
    `- Verified base artifacts/reports: ${widgetLifecycleEvidence.summary.baseArtifactCount}/${widgetLifecycleEvidence.summary.requiredBaseArtifactCount}`,
    `- Verified proof attachments: ${widgetLifecycleEvidence.summary.proofAttachmentCount} (minimum ${widgetLifecycleEvidence.summary.minimumProofAttachmentCount})`,
    `- Verified scenarios: ${widgetLifecycleEvidence.summary.scenarioCount}/4`,
    '',
    widgetArtifactRows.length > 0
      ? markdownTable(['Artifact', 'Path', 'Bytes', 'SHA-256'], widgetArtifactRows)
      : 'No verified widget lifecycle artifacts attached.',
    '',
    '## Native OCR Evidence',
    '',
    `- Required for this build: ${nativeOcrEvidence.required ? 'yes' : 'no'}`,
    `- Status: ${nativeOcrEvidence.status === 'pass' ? 'PASS' : nativeOcrEvidence.status === 'not_required_not_attached' ? 'NOT ATTACHED / OCR DISABLED' : 'BLOCKED'}`,
    `- Evidence path: ${nativeOcrEvidence.path ?? 'BLOCKED'}`,
    `- Evidence SHA-256: ${nativeOcrEvidence.sha256 ?? 'BLOCKED'}`,
    `- Physical iPhones: ${nativeOcrEvidence.summary.devices}`,
    `- Governed corpus: ${nativeOcrEvidence.summary.corpusItems} labels across ${nativeOcrEvidence.summary.labelClasses}/5 classes`,
    `- RTL reading-order corpus: ${nativeOcrEvidence.summary.rtlCorpusItems} labels (minimum 2)`,
    `- Verified device-label runs: ${nativeOcrEvidence.summary.runs}/${nativeOcrEvidence.summary.requiredRuns}`,
    `- Verified proof attachments: ${nativeOcrEvidence.artifacts.length}/7`,
    '',
    nativeOcrArtifactRows.length > 0
      ? markdownTable(['Artifact', 'Path', 'Bytes', 'SHA-256'], nativeOcrArtifactRows)
      : 'No verified native OCR artifacts attached.',
    '',
    '## Scenarios',
    '',
    markdownTable(['Surface', 'Required scenario set'], scenarioRows),
    '',
    '## Files',
    '',
    markdownTable(['Path', 'Status', 'Bytes', 'SHA-256'], fileRows),
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
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
  console.error(
    `\nPhase 5 strict QA packet has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}
