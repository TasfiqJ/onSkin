#!/usr/bin/env node
import { isAbsolute, posix, resolve } from 'node:path';
import { evidenceFlagEnabled, normalizeNamedSignoff, placeholderEnvValue } from '../phase9/lib.mjs';
import {
  atomicWriteReleaseQaOutputs,
  canonicalReleaseRepoPath,
  captureReleaseQaSnapshot,
  hashStableRootBoundWorkingFile,
  readStableRootBoundWorkingFile,
  runTrustedGit,
  verifyReleaseQaSnapshot,
} from '../phase9/release-qa-integrity.mjs';
import {
  auditGovernedEvidenceChain,
  captureGovernedEvidenceWorkingBindings,
  GOVERNED_EVIDENCE_LEDGER_MAX_BYTES,
  validateGovernedGeneratedPublication,
  verifyGovernedEvidenceWorkingBindings,
} from '../launch/governed-evidence-chain.mjs';
import {
  isReleasePlatformRequired,
  launchContractSnapshot,
  platformRequirementStatus,
  validateLaunchContract,
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
import {
  CAMERA_LIFECYCLE_EVIDENCE_ROOT,
  CAMERA_LIFECYCLE_MANIFEST_BYTES_MAX,
  CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES,
  CAMERA_LIFECYCLE_SCENARIOS,
  normalizeCameraLifecycleEasBuildId,
  normalizeCameraLifecycleEvidencePath,
  readCameraLifecycleContainedFile,
  validateCameraLifecycleEvidence,
} from './camera-lifecycle-evidence-contract.mjs';
import {
  normalizePerformanceEvidencePath,
  validatePerformanceEvidence,
} from './performance-evidence-contract.mjs';
import {
  PHASE5_DEVICE_QA_PACKET_SCHEMA_VERSION,
  PHASE5_REQUIRED_QA_EVIDENCE,
} from './device-qa-packet-contract.mjs';
import {
  CAT07_COMMITTED_SUMMARY_PATH,
  validateCat07CommittedEvidence,
  validateCat07FullEvidenceContract,
} from '../e2e/cat07-committed-evidence.mjs';

const strict = process.argv.includes('--strict');
const checkMode = process.argv.includes('--check');
const root = process.cwd();
const defaultPacketOutDir = 'docs/phase-5/generated';
const requestedPacketOutDir = process.env.PHASE5_QA_PACKET_OUT_DIR;
const testFixtureOutput = process.argv.includes('--test-fixture-output');
let packetOutDir = defaultPacketOutDir;
if (requestedPacketOutDir !== undefined) {
  if (
    !testFixtureOutput ||
    process.env.NODE_ENV !== 'test' ||
    !/^\.tmp\/phase5-packet-fixtures\/[a-z0-9][a-z0-9-]{0,95}$/u.test(requestedPacketOutDir)
  ) {
    console.error(
      'FAIL PHASE5_QA_PACKET_OUT_DIR is reserved for an explicit repo-local Phase 5 test fixture.',
    );
    process.exit(1);
  }
  packetOutDir = requestedPacketOutDir;
} else if (testFixtureOutput) {
  console.error('FAIL --test-fixture-output requires one governed PHASE5_QA_PACKET_OUT_DIR.');
  process.exit(1);
}
const packetOutputPaths = [
  `${packetOutDir}/device-qa-packet.json`,
  `${packetOutDir}/device-qa-packet.md`,
].map((path) => path.replace(/\\/g, '/'));
const cat07ShelfFreshnessSummaryPath = CAT07_COMMITTED_SUMMARY_PATH;
let launchContract;
let androidReleaseRequired;

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
    'supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
    'supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql',
    'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
    'supabase/tests/database/catalog_import_lifecycle.test.sql',
    'supabase/tests/database/catalog_launch_curation.test.sql',
    'supabase/tests/database/catalog_serving_gate.test.sql',
    'supabase/tests/database/cat07_truthful_freshness.test.sql',
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
    'scripts/phase5/device-qa-packet-contract.mjs',
    'scripts/launch/governed-evidence-chain.mjs',
    'scripts/phase9/release-qa-integrity.mjs',
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
    'scripts/e2e/evidence-diagnostic-hygiene.mjs',
    'scripts/e2e/cat07-png-contract.mjs',
    'scripts/e2e/cat07-committed-evidence.mjs',
    'scripts/e2e/cat07-shelf-freshness-audit.mjs',
    'scripts/e2e/cat07-shelf-freshness-audit.test.mjs',
    'scripts/phase2/local-supabase-contract.mjs',
    'scripts/phase2/supabase-rls-smoke.mjs',
    'scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql',
    'scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql',
    'scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql',
    'scripts/phase9/lib.mjs',
    'scripts/phase9/live-supabase-adversarial.mjs',
    'scripts/phase9/rls-adversarial-smoke.mjs',
    'scripts/phase9/rls-adversarial.mjs',
    'docs/DEVICE_SUPPORT_POLICY.md',
    'docs/HUMAN_SIMULATED_E2E_TESTING.md',
    'docs/E2E_TESTING_CHECKLIST.md',
    'docs/USER_FLOW_TREE.md',
    'docs/hugeToDo/CAT-07-SHELF-FRESHNESS-SOURCE-CHECKPOINT-2026-07-19.md',
    'docs/hugeToDo/IOS-02-WIDGET-LIFECYCLE-SOURCE-CHECKPOINT-2026-07-16.md',
    'docs/e2e/generated/human-e2e-manifest.json',
    'docs/e2e/generated/human-e2e-manifest.md',
    cat07ShelfFreshnessSummaryPath,
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
    ...CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES,
    'scripts/phase5/camera-lifecycle-evidence-contract.mjs',
    'scripts/phase5/check-camera-lifecycle-evidence.mjs',
    'scripts/phase5/camera-lifecycle-evidence-smoke.mjs',
    'docs/phase-5/camera-lifecycle-evidence-runbook.md',
    'docs/phase-5/camera-lifecycle-evidence.template.json',
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

function hashFileFromSnapshot(path, snapshot) {
  const record = snapshot.records[path];
  if (record?.workingKind !== 'file' || !record.workingBytes) return { path, exists: false };
  return {
    path,
    exists: true,
    bytes: record.workingBytes.length,
    sha256: record.workingSha256,
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

function readJsonRecord(path, maxBytes = 2 * 1024 * 1024) {
  const normalized = canonicalReleaseRepoPath(root, path);
  const record = readStableRootBoundWorkingFile(root, normalized, { maxBytes });
  if (record.kind !== 'file' || !record.bytes) return null;
  return {
    bytes: record.bytes.length,
    path: normalized,
    sha256: record.sha256,
    value: JSON.parse(record.bytes.toString('utf8')),
  };
}

const GOVERNED_PHASE5_ROLES = Object.freeze([
  'phase5-widget-lifecycle',
  'phase5-native-ocr',
  'phase5-camera-lifecycle',
  'phase5-performance',
]);

const GOVERNED_PHASE5_ROLE_LABELS = Object.freeze({
  'phase5-widget-lifecycle': 'Widget lifecycle',
  'phase5-native-ocr': 'Native OCR',
  'phase5-camera-lifecycle': 'Camera lifecycle',
  'phase5-performance': 'Performance',
});

const governedRoleEvidence = new Map(
  GOVERNED_PHASE5_ROLES.map((role) => [
    role,
    { claimed: false, sourceGitSha: null, expectedEntries: [] },
  ]),
);

function claimGovernedRole(role, claimed) {
  governedRoleEvidence.get(role).claimed = claimed;
}

function bindGovernedRole(role, sourceGitSha, records) {
  const state = governedRoleEvidence.get(role);
  state.sourceGitSha = String(sourceGitSha ?? '').trim();
  state.expectedEntries = records.map((record) => ({
    path: canonicalReleaseRepoPath(root, record.path),
    sha256: String(record.sha256 ?? ''),
  }));
}

function governedRoleInventoryErrors(chain) {
  if (chain.status !== 'pass' || !chain.ledger) {
    return [`Governed evidence chain is invalid: ${chain.errors.join(' | ')}`];
  }
  const errors = [];
  for (const role of GOVERNED_PHASE5_ROLES) {
    const label = GOVERNED_PHASE5_ROLE_LABELS[role];
    const expected = governedRoleEvidence.get(role).expectedEntries;
    const expectedByIdentity = new Map();
    for (const entry of expected) {
      const identity = entry.path.normalize('NFC').toLowerCase();
      if (expectedByIdentity.has(identity)) {
        errors.push(`${label} evidence references duplicate governed paths.`);
      } else {
        expectedByIdentity.set(identity, entry);
      }
    }
    const ledgerEntries = chain.ledger.entries.filter((entry) => entry.role === role);
    const ledgerByIdentity = new Map(
      ledgerEntries.map((entry) => [entry.path.normalize('NFC').toLowerCase(), entry]),
    );
    for (const expectedEntry of expected) {
      const ledgerEntry = ledgerByIdentity.get(expectedEntry.path.normalize('NFC').toLowerCase());
      if (!ledgerEntry || ledgerEntry.path !== expectedEntry.path) {
        errors.push(
          `${label} evidence path is not an exact ${role} ledger entry: ${expectedEntry.path}.`,
        );
      } else if (ledgerEntry.sha256 !== expectedEntry.sha256) {
        errors.push(`${label} evidence ledger digest does not match ${expectedEntry.path}.`);
      }
    }
    for (const ledgerEntry of ledgerEntries) {
      const expectedEntry = expectedByIdentity.get(ledgerEntry.path.normalize('NFC').toLowerCase());
      if (!expectedEntry || expectedEntry.path !== ledgerEntry.path) {
        errors.push(
          `${label} evidence ledger contains an unreferenced ${role} entry: ${ledgerEntry.path}.`,
        );
      }
    }
  }
  return errors;
}

function captureEvidenceBindings(records) {
  const byPortablePath = new Map();
  let totalBytes = 0;
  for (const candidate of records) {
    const path = canonicalReleaseRepoPath(root, candidate.path);
    const portablePath = path.toLowerCase();
    const previous = byPortablePath.get(portablePath);
    if (previous) {
      if (
        previous.path !== path ||
        previous.bytes !== candidate.bytes ||
        previous.sha256 !== candidate.sha256
      ) {
        throw new Error(`conflicting evidence binding for ${path}`);
      }
      continue;
    }
    if (!Number.isSafeInteger(candidate.bytes) || candidate.bytes < 0) {
      throw new Error(`invalid evidence byte length for ${path}`);
    }
    if (candidate.bytes > 512 * 1024 * 1024) {
      throw new Error(`evidence file exceeds the 512 MiB binding ceiling: ${path}`);
    }
    totalBytes += candidate.bytes;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > 2 * 1024 * 1024 * 1024) {
      throw new Error('validated evidence exceeds the 2 GiB aggregate binding ceiling');
    }
    const observed = hashStableRootBoundWorkingFile(root, path, {
      expectedSizeBytes: candidate.bytes,
    });
    if (
      observed.kind !== 'file' ||
      observed.sha256 !== candidate.sha256 ||
      observed.sizeBytes !== candidate.bytes ||
      typeof observed.identity !== 'string'
    ) {
      throw new Error(`validated evidence changed before it could be bound: ${path}`);
    }
    byPortablePath.set(portablePath, {
      identity: observed.identity,
      path,
      sha256: observed.sha256,
      sizeBytes: observed.sizeBytes,
    });
  }
  return [...byPortablePath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function verifyEvidenceBindings(bindings) {
  const errors = [];
  for (const binding of bindings) {
    const current = hashStableRootBoundWorkingFile(root, binding.path, {
      expectedSizeBytes: binding.sizeBytes,
    });
    if (
      current.kind !== 'file' ||
      current.identity !== binding.identity ||
      current.sha256 !== binding.sha256 ||
      current.sizeBytes !== binding.sizeBytes
    ) {
      errors.push(`${binding.path} changed during Phase 5 packet assembly`);
    }
  }
  return errors;
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

const blockers = [];
const warnings = [];
let sourceSnapshot;
try {
  sourceSnapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: checkMode ? [...requiredFiles, ...packetOutputPaths] : requiredFiles,
    outputPaths: checkMode ? [] : packetOutputPaths,
    maxAggregateInputBytes: 512 * 1024 * 1024,
    maxInputBytes: 64 * 1024 * 1024,
  });
} catch (error) {
  console.error(
    `FAIL Phase 5 source snapshot could not be captured safely: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}
const gitSha = sourceSnapshot.headSha;
const files = requiredFiles.map((path) => hashFileFromSnapshot(path, sourceSnapshot));
for (const issue of sourceSnapshot.integrityIssues) {
  blockers.push(`Phase 5 source snapshot: ${issue}.`);
}
try {
  const launchContractRecord = sourceSnapshot.records['docs/hugeToDo/launch-contract.json'];
  if (launchContractRecord?.workingKind !== 'file' || !launchContractRecord.workingBytes) {
    throw new Error('launch contract is not one snapshotted regular file');
  }
  launchContract = Object.freeze(JSON.parse(launchContractRecord.workingBytes.toString('utf8')));
  const launchContractErrors = validateLaunchContract(launchContract);
  if (launchContractErrors.length > 0) {
    throw new Error(launchContractErrors.join('; '));
  }
  androidReleaseRequired = isReleasePlatformRequired('android', launchContract);
} catch (error) {
  console.error(
    `FAIL Phase 5 launch contract could not be loaded from the pinned source snapshot: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}

const rawSignedOffBy = envValue('PHASE5_SIGNED_OFF_BY');
const normalizedSignedOffBy = normalizeNamedSignoff(rawSignedOffBy) ?? '';
const eas = JSON.parse(
  sourceSnapshot.records['apps/mobile/eas.json'].workingBytes.toString('utf8'),
);
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

const rawIosBuildId = envValue('PHASE5_IOS_BUILD_ID');
const rawAndroidBuildId = androidReleaseRequired ? envValue('PHASE5_ANDROID_BUILD_ID') : '';
const buildEvidence = {
  iosBuildId: normalizeCameraLifecycleEasBuildId(rawIosBuildId),
  iosBuildProfile,
  androidBuildId: androidReleaseRequired
    ? normalizeCameraLifecycleEasBuildId(rawAndroidBuildId)
    : null,
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
  PHASE5_REQUIRED_QA_EVIDENCE.map(([key, label]) => [
    key,
    { label, required: true, passed: evidenceFlagEnabled(process.env[key]) },
  ]),
);

let gitStatus = sourceSnapshot.gitStatus;
const observedEvidenceRecords = [];
function observeEvidenceRecord(record) {
  if (
    record &&
    typeof record.path === 'string' &&
    Number.isSafeInteger(record.bytes) &&
    record.bytes >= 0 &&
    /^[0-9a-f]{64}$/u.test(String(record.sha256 ?? ''))
  ) {
    observedEvidenceRecords.push({
      bytes: record.bytes,
      path: canonicalReleaseRepoPath(root, record.path),
      sha256: record.sha256,
    });
  }
}
const rawWidgetLifecycleEvidencePath = envValue('PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH');
claimGovernedRole('phase5-widget-lifecycle', Boolean(rawWidgetLifecycleEvidencePath));
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
if (!rawWidgetLifecycleEvidencePath) {
  blockers.push(
    'Missing PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH; widget booleans do not substitute for artifact-bound archive/device/lifecycle evidence.',
  );
} else if (!normalizedWidgetLifecycleEvidencePath) {
  blockers.push(
    `PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH must be a normalized repo-relative JSON path under ${WIDGET_LIFECYCLE_EVIDENCE_ROOT}.`,
  );
} else {
  let evidenceFile = null;
  let evidenceReadError = null;
  try {
    evidenceFile = readJsonRecord(normalizedWidgetLifecycleEvidencePath);
  } catch (error) {
    evidenceReadError = error;
  }
  if (!evidenceFile && !evidenceReadError) {
    blockers.push(
      `Widget lifecycle evidence file does not exist: ${normalizedWidgetLifecycleEvidencePath}.`,
    );
  } else {
    try {
      if (evidenceReadError) throw evidenceReadError;
      const evidence = evidenceFile.value;
      observeEvidenceRecord(evidenceFile);
      const validation = validateWidgetLifecycleEvidence(evidence, {
        root,
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
      for (const artifact of validation.artifacts) observeEvidenceRecord(artifact);
      bindGovernedRole('phase5-widget-lifecycle', evidence.sourceGitSha, [
        evidenceFile,
        ...validation.artifacts,
      ]);
    } catch (error) {
      blockers.push(
        `Widget lifecycle evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
      );
    }
  }
}
const rawNativeOcrEvidencePath = envValue('PHASE5_NATIVE_OCR_EVIDENCE_PATH');
claimGovernedRole('phase5-native-ocr', Boolean(rawNativeOcrEvidencePath));
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
  let evidenceFile = null;
  let evidenceReadError = null;
  try {
    evidenceFile = readJsonRecord(normalizedNativeOcrEvidencePath);
  } catch (error) {
    evidenceReadError = error;
  }
  if (!evidenceFile && !evidenceReadError) {
    blockers.push(`Native OCR evidence file does not exist: ${normalizedNativeOcrEvidencePath}.`);
  } else {
    try {
      if (evidenceReadError) throw evidenceReadError;
      const evidence = evidenceFile.value;
      observeEvidenceRecord(evidenceFile);
      const validation = validateNativeOcrEvidence(evidence, {
        root,
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
      for (const artifact of validation.artifacts) observeEvidenceRecord(artifact);
      bindGovernedRole('phase5-native-ocr', evidence.sourceGitSha, [
        evidenceFile,
        ...validation.artifacts,
      ]);
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
const rawCameraLifecycleEvidencePath = envValue('PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH');
claimGovernedRole('phase5-camera-lifecycle', Boolean(rawCameraLifecycleEvidencePath));
const normalizedCameraLifecycleEvidencePath = normalizeCameraLifecycleEvidencePath(
  rawCameraLifecycleEvidencePath,
);
let cameraLifecycleEvidence = {
  required: true,
  path: normalizedCameraLifecycleEvidencePath,
  status: 'blocked',
  sha256: null,
  artifacts: [],
  summary: {
    devices: 0,
    routes: 0,
    scenarioDefinitions: CAMERA_LIFECYCLE_SCENARIOS.length,
    runs: 0,
    requiredRuns: 0,
    artifacts: 0,
    proofArtifacts: 0,
  },
  binding: null,
};
if (!rawCameraLifecycleEvidencePath) {
  blockers.push(
    'Missing PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH; camera QA Booleans cannot substitute for exact-build, signed-archive, two-physical-iPhone lifecycle evidence.',
  );
} else if (!normalizedCameraLifecycleEvidencePath) {
  blockers.push(
    `PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH must be a normalized repo-relative JSON path under ${CAMERA_LIFECYCLE_EVIDENCE_ROOT}.`,
  );
} else {
  const evidenceFile = readCameraLifecycleContainedFile(
    root,
    normalizedCameraLifecycleEvidencePath,
    { maxBytes: CAMERA_LIFECYCLE_MANIFEST_BYTES_MAX },
  );
  if (!evidenceFile) {
    blockers.push(
      `Camera lifecycle evidence file is missing, oversized, indirect, unreadable, or outside the canonical repository root: ${normalizedCameraLifecycleEvidencePath}.`,
    );
  } else {
    try {
      const evidence = JSON.parse(evidenceFile.bytes.toString('utf8'));
      observeEvidenceRecord({
        bytes: evidenceFile.bytes.length,
        path: normalizedCameraLifecycleEvidencePath,
        sha256: evidenceFile.sha256,
      });
      const validation = validateCameraLifecycleEvidence(evidence, {
        root,
        expectedBuildId: buildEvidence.iosBuildId || null,
        expectedBuildProfile: buildEvidence.iosBuildProfile || null,
      });
      for (const error of validation.errors) {
        blockers.push(`Camera lifecycle evidence: ${error}`);
      }
      for (const warning of validation.warnings) {
        warnings.push(`Camera lifecycle evidence: ${warning}`);
      }
      cameraLifecycleEvidence = {
        required: true,
        path: normalizedCameraLifecycleEvidencePath,
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
          cameraUsageDescription:
            evidence.signedArchive?.finalInfoPlist?.cameraUsageDescription ?? null,
          devices: evidence.devices ?? null,
          qaSignedOffBy: evidence.signoff?.qaSignedOffBy ?? null,
          privacySecuritySignedOffBy: evidence.signoff?.privacySecuritySignedOffBy ?? null,
          accessibilitySignedOffBy: evidence.signoff?.accessibilitySignedOffBy ?? null,
        },
      };
      for (const artifact of validation.artifacts) observeEvidenceRecord(artifact);
      bindGovernedRole('phase5-camera-lifecycle', evidence.sourceGitSha, [
        {
          bytes: evidenceFile.bytes.length,
          path: normalizedCameraLifecycleEvidencePath,
          sha256: evidenceFile.sha256,
        },
        ...validation.artifacts,
      ]);
    } catch (error) {
      blockers.push(
        `Camera lifecycle evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
      );
    }
  }
}
if (envValue('PHASE5_CAMERA_PERMISSION_QA_PASS')) {
  warnings.push(
    'PHASE5_CAMERA_PERMISSION_QA_PASS is ignored; only PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH can clear CAT-06 camera lifecycle QA.',
  );
}
const rawPerformanceEvidencePath = envValue('PHASE5_PERFORMANCE_EVIDENCE_PATH');
claimGovernedRole('phase5-performance', Boolean(rawPerformanceEvidencePath));
const normalizedPerformanceEvidencePath = normalizePerformanceEvidencePath(
  rawPerformanceEvidencePath,
);
let performanceEvidence = {
  required: true,
  path: normalizedPerformanceEvidencePath,
  status: 'blocked',
  sha256: null,
  summary: {
    requiredMeasurements: 0,
    found: 0,
    metrics: 0,
    platforms: 0,
  },
  binding: null,
};
if (!rawPerformanceEvidencePath) {
  blockers.push(
    'Missing PHASE5_PERFORMANCE_EVIDENCE_PATH; real supported-device performance evidence is not attached.',
  );
} else if (!normalizedPerformanceEvidencePath) {
  blockers.push(
    'PHASE5_PERFORMANCE_EVIDENCE_PATH must be a normalized repo-relative JSON path under docs/phase-5/evidence/performance/.',
  );
} else {
  let evidenceFile = null;
  let evidenceReadError = null;
  try {
    evidenceFile = readJsonRecord(normalizedPerformanceEvidencePath);
  } catch (error) {
    evidenceReadError = error;
  }
  if (!evidenceFile && !evidenceReadError) {
    blockers.push(
      `Performance evidence file does not exist: ${normalizedPerformanceEvidencePath}.`,
    );
  } else {
    try {
      if (evidenceReadError) throw evidenceReadError;
      const evidence = evidenceFile.value;
      observeEvidenceRecord(evidenceFile);
      const validation = validatePerformanceEvidence(evidence, launchContract);
      for (const error of validation.errors) blockers.push(`Performance evidence: ${error}`);
      for (const warning of validation.warnings) warnings.push(`Performance evidence: ${warning}`);
      performanceEvidence = {
        required: true,
        path: normalizedPerformanceEvidencePath,
        status: validation.errors.length === 0 ? 'pass' : 'blocked',
        sha256: evidenceFile.sha256,
        summary: validation.summary,
        binding: {
          sourceGitSha: evidence.gitSha ?? null,
          devices: evidence.devices ?? null,
          thresholdsDefinedBy: evidence.thresholdsDefinedBy ?? null,
          signedOffBy: evidence.signoff?.signedOffBy ?? null,
          signedAt: evidence.signoff?.signedAt ?? null,
        },
      };
      bindGovernedRole('phase5-performance', evidence.gitSha, [evidenceFile]);
    } catch (error) {
      blockers.push(
        `Performance evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
      );
    }
  }
}

const releaseCandidateDir = envValue('PHASE9_RELEASE_CANDIDATE_DIR');
const claimedGovernedRoles = GOVERNED_PHASE5_ROLES.filter(
  (role) => governedRoleEvidence.get(role).claimed,
);
const sourceGitShas = new Set();
let sourceBindingsValid = true;
for (const role of claimedGovernedRoles) {
  const state = governedRoleEvidence.get(role);
  if (!/^[0-9a-f]{40}$/u.test(state.sourceGitSha ?? '')) {
    sourceBindingsValid = false;
    blockers.push(
      `${GOVERNED_PHASE5_ROLE_LABELS[role]} governed evidence must bind one lowercase 40-character source Git SHA.`,
    );
  } else {
    sourceGitShas.add(state.sourceGitSha);
  }
}
let coherentSourceGitSha = null;
if (sourceBindingsValid && sourceGitShas.size === 1) {
  coherentSourceGitSha = [...sourceGitShas][0];
} else if (sourceBindingsValid && sourceGitShas.size > 1) {
  blockers.push(
    `Governed Phase 5 evidence must share one coherent source Git SHA (S); found ${[
      ...sourceGitShas,
    ].join(', ')}.`,
  );
}

let governedEvidenceChain = {
  schemaVersion: PHASE5_DEVICE_QA_PACKET_SCHEMA_VERSION,
  kind: 'phase5_governed_evidence_chain_binding',
  status: 'blocked',
  sourceGitSha: coherentSourceGitSha,
  evidenceCommitSha: null,
  currentGitSha: gitSha,
  releaseCandidateDir: null,
  ledgerPath: null,
  ledgerSha256: null,
  ledgerEntryCount: 0,
  directEvidenceCommit: false,
  evidenceOnlyCommit: false,
  cleanWorktree: false,
  normalIndexState: false,
  hashesValid: false,
  downstreamGeneratedOnly: false,
  downstreamCommitCount: 0,
  roleInventories: Object.fromEntries(
    GOVERNED_PHASE5_ROLES.map((role) => [
      role,
      {
        claimed: governedRoleEvidence.get(role).claimed,
        entries: governedRoleEvidence.get(role).expectedEntries,
        ledgerEntryCount: 0,
      },
    ]),
  ),
  errors: [],
};
let governedEvidenceAudit = null;
let governedWorkingBindings = null;

if (claimedGovernedRoles.length > 0 && !releaseCandidateDir) {
  blockers.push(
    'PHASE9_RELEASE_CANDIDATE_DIR is required whenever Phase 5 evidence is claimed so the packet can validate one governed S-to-E evidence chain.',
  );
}
if (claimedGovernedRoles.length > 0 && releaseCandidateDir && coherentSourceGitSha) {
  let chain;
  try {
    chain = auditGovernedEvidenceChain({
      root,
      sourceGitSha: coherentSourceGitSha,
      releaseCandidateDir,
      expectedHeadSha: gitSha,
    });
  } catch (error) {
    chain = {
      status: 'invalid',
      sourceGitSha: coherentSourceGitSha,
      headGitSha: gitSha,
      evidenceCommitSha: null,
      releaseCandidateDir: null,
      ledgerPath: null,
      directEvidenceCommit: false,
      evidenceOnlyCommit: false,
      cleanWorktree: false,
      normalIndexState: false,
      hashesValid: false,
      downstreamGeneratedOnly: false,
      ledger: null,
      downstreamCommits: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
  governedEvidenceAudit = chain;

  const governanceErrors = governedRoleInventoryErrors(chain);
  let ledgerRecord = null;
  if (chain.status === 'pass' && chain.ledgerPath) {
    try {
      const record = readStableRootBoundWorkingFile(root, chain.ledgerPath, {
        maxBytes: GOVERNED_EVIDENCE_LEDGER_MAX_BYTES,
      });
      if (record.kind !== 'file' || !record.bytes || !record.sha256) {
        throw new Error('governed evidence ledger is not a stable regular file');
      }
      ledgerRecord = {
        bytes: record.bytes.length,
        path: chain.ledgerPath,
        sha256: record.sha256,
      };
      observeEvidenceRecord(ledgerRecord);
    } catch (error) {
      governanceErrors.push(
        `Governed evidence ledger binding failed: ${error instanceof Error ? error.message : String(error)}.`,
      );
    }
    try {
      governedWorkingBindings = captureGovernedEvidenceWorkingBindings(chain, root);
    } catch (error) {
      governanceErrors.push(
        `Governed evidence working-file binding failed: ${
          error instanceof Error ? error.message : String(error)
        }.`,
      );
    }
  }
  const roleInventories = Object.fromEntries(
    GOVERNED_PHASE5_ROLES.map((role) => [
      role,
      {
        claimed: governedRoleEvidence.get(role).claimed,
        entries: governedRoleEvidence.get(role).expectedEntries,
        ledgerEntryCount: chain.ledger?.entries.filter((entry) => entry.role === role).length ?? 0,
      },
    ]),
  );
  governedEvidenceChain = {
    schemaVersion: PHASE5_DEVICE_QA_PACKET_SCHEMA_VERSION,
    kind: 'phase5_governed_evidence_chain_binding',
    status: governanceErrors.length === 0 ? 'pass' : 'blocked',
    sourceGitSha: coherentSourceGitSha,
    evidenceCommitSha: chain.evidenceCommitSha,
    currentGitSha: chain.headGitSha ?? gitSha,
    releaseCandidateDir: chain.releaseCandidateDir,
    ledgerPath: chain.ledgerPath,
    ledgerSha256: ledgerRecord?.sha256 ?? null,
    ledgerEntryCount: chain.ledger?.entries.length ?? 0,
    directEvidenceCommit: chain.directEvidenceCommit,
    evidenceOnlyCommit: chain.evidenceOnlyCommit,
    cleanWorktree: chain.cleanWorktree,
    normalIndexState: chain.normalIndexState,
    hashesValid: chain.hashesValid,
    downstreamGeneratedOnly: chain.downstreamGeneratedOnly,
    downstreamCommitCount: chain.downstreamCommits.length,
    roleInventories,
    errors: governanceErrors,
  };
  for (const error of governanceErrors) blockers.push(`Governed evidence chain: ${error}`);
}

gitStatus = sourceSnapshot.gitStatus;
if (gitStatus.length > 0) {
  const dirtyMessage =
    'Phase 5 device QA packet requires a clean Git worktree for governed evidence validation; do not use it as final native-device evidence.';
  if (strict) blockers.push(dirtyMessage);
  else warnings.push(dirtyMessage);
}
if (!rawIosBuildId) blockers.push('Missing PHASE5_IOS_BUILD_ID.');
else if (!buildEvidence.iosBuildId) {
  blockers.push(
    'PHASE5_IOS_BUILD_ID must be a canonical EAS UUID or strict expo.dev build URL without credentials, port, query, or fragment.',
  );
}
if (!buildEvidence.iosBuildProfile) {
  blockers.push('Missing PHASE5_IOS_BUILD_PROFILE.');
} else if (!['development', 'staging', 'production'].includes(buildEvidence.iosBuildProfile)) {
  blockers.push('PHASE5_IOS_BUILD_PROFILE must be development, staging, or production.');
}
if (androidReleaseRequired) {
  if (!rawAndroidBuildId) blockers.push('Missing PHASE5_ANDROID_BUILD_ID.');
  else if (!buildEvidence.androidBuildId) {
    blockers.push(
      'PHASE5_ANDROID_BUILD_ID must be a canonical EAS UUID or strict expo.dev build URL without credentials, port, query, or fragment.',
    );
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
let evidenceBindings;
try {
  evidenceBindings = captureEvidenceBindings(observedEvidenceRecords);
} catch (error) {
  console.error(
    `FAIL Phase 5 evidence binding could not be captured safely: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}
const cat07CommittedEvidence = validateCat07CommittedEvidence(root, { expectedHeadSha: gitSha });
for (const error of cat07CommittedEvidence.errors) {
  blockers.push(`CAT07 committed evidence: ${error}.`);
}
const cat07FullEvidenceContract = validateCat07FullEvidenceContract(root, {
  expectedHeadSha: gitSha,
});
for (const error of cat07FullEvidenceContract.errors) {
  blockers.push(`CAT07 full evidence contract: ${error}.`);
}

const packet = {
  schemaVersion: PHASE5_DEVICE_QA_PACKET_SCHEMA_VERSION,
  kind: 'phase5_device_qa_packet',
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
  cameraLifecycleEvidence,
  performanceEvidence,
  governedEvidenceChain,
  evidenceStatuses: {
    widgetLifecycle: widgetLifecycleEvidence.status,
    nativeOcr: nativeOcrEvidence.status,
    cameraLifecycle: cameraLifecycleEvidence.status,
    performance: performanceEvidence.status,
    governedEvidenceChain: governedEvidenceChain.status,
  },
  cat07CommittedEvidence,
  cat07FullEvidenceContract,
  scenarios: scenarios.map(([surface, scenario]) => ({ surface, scenario })),
  files,
  blockers,
  warnings,
};

const jsonBytes = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`, 'utf8');

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
const cameraLifecycleArtifactRows = cameraLifecycleEvidence.artifacts.map((artifact) => [
  artifact.id,
  artifact.path,
  String(artifact.bytes),
  artifact.sha256,
]);
const markdownBytes = Buffer.from(
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
    '## Governed Evidence Chain',
    '',
    `- Status: ${governedEvidenceChain.status === 'pass' ? 'PASS' : 'BLOCKED'}`,
    `- Source commit (S): ${governedEvidenceChain.sourceGitSha ?? 'BLOCKED'}`,
    `- Evidence commit (E): ${governedEvidenceChain.evidenceCommitSha ?? 'BLOCKED'}`,
    `- Current commit: ${governedEvidenceChain.currentGitSha}`,
    `- Release candidate: ${governedEvidenceChain.releaseCandidateDir ?? 'BLOCKED'}`,
    `- Evidence ledger: ${governedEvidenceChain.ledgerPath ?? 'BLOCKED'}`,
    `- Evidence ledger SHA-256: ${governedEvidenceChain.ledgerSha256 ?? 'BLOCKED'}`,
    `- Evidence ledger entries: ${governedEvidenceChain.ledgerEntryCount}`,
    `- Allowlisted downstream commits: ${governedEvidenceChain.downstreamCommitCount}`,
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
    '## CAT-06 Camera Lifecycle Evidence',
    '',
    `- Required: yes`,
    `- Status: ${cameraLifecycleEvidence.status === 'pass' ? 'PASS' : 'BLOCKED'}`,
    `- Evidence path: ${cameraLifecycleEvidence.path ?? 'BLOCKED'}`,
    `- Evidence SHA-256: ${cameraLifecycleEvidence.sha256 ?? 'BLOCKED'}`,
    `- Physical iPhones: ${cameraLifecycleEvidence.summary.devices}/2 minimum`,
    `- Camera routes: ${cameraLifecycleEvidence.summary.routes}/3`,
    `- Route-scenario definitions: ${cameraLifecycleEvidence.summary.scenarioDefinitions}/27`,
    `- Verified device-route-scenario runs: ${cameraLifecycleEvidence.summary.runs}/${cameraLifecycleEvidence.summary.requiredRuns}`,
    `- Verified proof attachments: ${cameraLifecycleEvidence.summary.proofArtifacts}`,
    `- Verified total artifacts: ${cameraLifecycleEvidence.summary.artifacts}`,
    '',
    cameraLifecycleArtifactRows.length > 0
      ? markdownTable(['Artifact', 'Path', 'Bytes', 'SHA-256'], cameraLifecycleArtifactRows)
      : 'No validated camera lifecycle artifacts attached.',
    '',
    '## Performance Evidence',
    '',
    `- Required: yes`,
    `- Status: ${performanceEvidence.status === 'pass' ? 'PASS' : 'BLOCKED'}`,
    `- Evidence path: ${performanceEvidence.path ?? 'BLOCKED'}`,
    `- Evidence SHA-256: ${performanceEvidence.sha256 ?? 'BLOCKED'}`,
    `- Required measurements: ${performanceEvidence.summary.found}/${performanceEvidence.summary.requiredMeasurements}`,
    `- Metric definitions: ${performanceEvidence.summary.metrics}`,
    `- Required release platforms measured: ${performanceEvidence.summary.platforms}`,
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
  'utf8',
);

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function decodedUtf8(bytes, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

function exactIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function replaceExactlyOnce(text, search, replacement, errors, label) {
  const first = text.indexOf(search);
  if (first < 0 || text.indexOf(search, first + search.length) >= 0) {
    errors.push(`canonical Markdown does not contain exactly one ${label}`);
    return text;
  }
  return `${text.slice(0, first)}${replacement}${text.slice(first + search.length)}`;
}

function readReplayInputBlobsAtCommit(commitSha, repoPaths) {
  if (!/^[0-9a-f]{40}$/u.test(String(commitSha ?? ''))) {
    throw new Error('recorded replay-input commit is not one lowercase full Git SHA');
  }
  const input = Buffer.from(repoPaths.map((path) => `${commitSha}:${path}\n`).join(''), 'utf8');
  const output = runTrustedGit(root, ['cat-file', '--batch'], {
    input,
    maxBuffer: 512 * 1024 * 1024 + input.length + repoPaths.length * 128,
  });
  const records = new Map();
  let offset = 0;
  let aggregateBytes = 0;
  for (const path of repoPaths) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) throw new Error('recorded replay-input Git batch header is truncated');
    const header = output.subarray(offset, newline).toString('utf8');
    offset = newline + 1;
    if (header.endsWith(' missing')) {
      records.set(path, null);
      continue;
    }
    const match = /^([0-9a-f]{40,64}) blob ([0-9]+)$/u.exec(header);
    const size = Number(match?.[2] ?? Number.NaN);
    if (!match || !Number.isSafeInteger(size) || size < 0 || size > 64 * 1024 * 1024) {
      throw new Error(`recorded replay input is not one bounded normal blob: ${path}`);
    }
    aggregateBytes += size;
    if (aggregateBytes > 512 * 1024 * 1024 || offset + size >= output.length) {
      throw new Error('recorded replay inputs exceed their aggregate byte ceiling');
    }
    const bytes = Buffer.from(output.subarray(offset, offset + size));
    offset += size;
    if (output[offset] !== 0x0a) {
      throw new Error('recorded replay-input Git batch body is truncated');
    }
    offset += 1;
    records.set(path, bytes);
  }
  if (offset !== output.length) {
    throw new Error('recorded replay-input Git batch contains trailing bytes');
  }
  return records;
}

function validateCommittedPacketReplay({ snapshot, freshPacket, freshMarkdown, chainAudit }) {
  const errors = [];
  const jsonRecord = snapshot.records[packetOutputPaths[0]];
  const markdownRecord = snapshot.records[packetOutputPaths[1]];
  for (const [path, record] of [
    [packetOutputPaths[0], jsonRecord],
    [packetOutputPaths[1], markdownRecord],
  ]) {
    if (
      record?.workingKind !== 'file' ||
      !record.workingBytes ||
      !record.workingTreeMatchesHead ||
      !record.headBytes?.equals(record.workingBytes)
    ) {
      errors.push(`${path} must be one committed regular file whose working bytes match HEAD`);
    }
  }
  if (!jsonRecord?.workingBytes || !markdownRecord?.workingBytes) return errors;

  let recordedPacket;
  try {
    recordedPacket = JSON.parse(decodedUtf8(jsonRecord.workingBytes, packetOutputPaths[0]));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return errors;
  }
  if (!canonicalJsonBytes(recordedPacket).equals(jsonRecord.workingBytes)) {
    errors.push(`${packetOutputPaths[0]} is not canonical generated JSON`);
  }
  if (!exactIsoTimestamp(recordedPacket?.generatedAt)) {
    errors.push('committed Phase 5 packet generatedAt must be one canonical ISO timestamp');
  }
  if (freshPacket.blockers.length > 0) {
    errors.push(
      `replay inputs/environment did not reproduce a blocker-free Phase 5 packet: ${freshPacket.blockers.join(
        ' | ',
      )}`,
    );
  }
  if (chainAudit?.status !== 'pass' || !chainAudit.ledger) {
    errors.push('fresh governed evidence audit did not pass during Phase 5 packet replay');
    return errors;
  }

  const recordedChain = recordedPacket?.governedEvidenceChain;
  const freshChain = freshPacket.governedEvidenceChain;
  if (recordedPacket?.schemaVersion !== PHASE5_DEVICE_QA_PACKET_SCHEMA_VERSION) {
    errors.push('committed Phase 5 packet schemaVersion is unsupported');
  }
  if (recordedPacket?.kind !== 'phase5_device_qa_packet') {
    errors.push('committed Phase 5 packet kind is invalid');
  }
  if (!recordedChain || typeof recordedChain !== 'object' || Array.isArray(recordedChain)) {
    errors.push('committed Phase 5 packet governedEvidenceChain is missing');
    return errors;
  }
  const publication = validateGovernedGeneratedPublication(
    recordedChain,
    chainAudit,
    packetOutputPaths,
  );
  for (const error of publication.errors) {
    errors.push(`committed Phase 5 governed publication: ${error}`);
  }
  for (const [field, label] of [
    ['sourceGitSha', 'source commit S'],
    ['evidenceCommitSha', 'evidence commit E'],
    ['releaseCandidateDir', 'selected release-candidate directory'],
    ['ledgerPath', 'governed ledger path'],
    ['ledgerSha256', 'governed ledger SHA-256'],
    ['ledgerEntryCount', 'governed ledger entry count'],
  ]) {
    if (recordedChain[field] !== freshChain[field]) {
      errors.push(`committed Phase 5 packet ${label} does not match the fresh governed audit`);
    }
  }
  if (recordedChain.status !== 'pass') {
    errors.push('committed Phase 5 packet governedEvidenceChain status must be pass');
  }
  if (recordedPacket.gitSha !== recordedChain.currentGitSha) {
    errors.push('committed packet gitSha and governed currentGitSha must be identical');
  }
  const recordedDownstreamCount = recordedChain.downstreamCommitCount;
  const prefixShas = [
    chainAudit.evidenceCommitSha,
    ...chainAudit.downstreamCommits.map(({ commitSha }) => commitSha),
  ];
  if (
    !Number.isSafeInteger(recordedDownstreamCount) ||
    recordedDownstreamCount < 0 ||
    recordedDownstreamCount >= prefixShas.length
  ) {
    errors.push(
      'committed packet downstreamCommitCount is not one valid prefix of the fresh governed audit',
    );
  } else if (recordedChain.currentGitSha !== prefixShas[recordedDownstreamCount]) {
    errors.push(
      'committed packet currentGitSha is not the exact commit at its recorded governed prefix',
    );
  }
  if (recordedPacket?.cat07CommittedEvidence?.headSha !== recordedPacket.gitSha) {
    errors.push('committed CAT07 evidence headSha must match the packet gitSha prefix');
  }
  if (recordedPacket?.cat07FullEvidenceContract?.headSha !== recordedPacket.gitSha) {
    errors.push('committed full CAT07 contract headSha must match the packet gitSha prefix');
  }
  try {
    const replayInputs = readReplayInputBlobsAtCommit(recordedChain.currentGitSha, requiredFiles);
    for (const path of requiredFiles) {
      const recordedPrefixBytes = replayInputs.get(path);
      const freshHeadBytes = snapshot.records[path]?.headBytes ?? null;
      if (!recordedPrefixBytes || !freshHeadBytes || !recordedPrefixBytes.equals(freshHeadBytes)) {
        errors.push(`${path} fresh replay input does not match recorded currentGitSha`);
      }
    }
  } catch (error) {
    errors.push(
      `recorded-current replay input comparison failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const projectedPacket = JSON.parse(JSON.stringify(freshPacket));
  const comparableRecordedPacket = JSON.parse(JSON.stringify(recordedPacket));
  projectedPacket.generatedAt = '<generatedAt>';
  comparableRecordedPacket.generatedAt = '<generatedAt>';
  projectedPacket.gitSha = recordedPacket.gitSha;
  projectedPacket.governedEvidenceChain.currentGitSha = recordedChain.currentGitSha;
  projectedPacket.governedEvidenceChain.downstreamCommitCount = recordedDownstreamCount;
  projectedPacket.cat07CommittedEvidence.headSha = recordedPacket.gitSha;
  projectedPacket.cat07FullEvidenceContract.headSha = recordedPacket.gitSha;
  if (JSON.stringify(projectedPacket) !== JSON.stringify(comparableRecordedPacket)) {
    errors.push(
      'committed Phase 5 packet JSON does not match canonical replay inputs and its validated governed prefix',
    );
  }

  let expectedMarkdown = decodedUtf8(freshMarkdown, 'fresh canonical Phase 5 Markdown');
  let recordedMarkdown = decodedUtf8(
    markdownRecord.workingBytes,
    'committed Phase 5 packet Markdown',
  );
  expectedMarkdown = replaceExactlyOnce(
    expectedMarkdown,
    `Generated at: ${freshPacket.generatedAt}`,
    'Generated at: <generatedAt>',
    errors,
    'fresh generatedAt line',
  );
  recordedMarkdown = replaceExactlyOnce(
    recordedMarkdown,
    `Generated at: ${recordedPacket.generatedAt}`,
    'Generated at: <generatedAt>',
    errors,
    'committed generatedAt line',
  );
  expectedMarkdown = replaceExactlyOnce(
    expectedMarkdown,
    `Git SHA: ${freshPacket.gitSha}`,
    `Git SHA: ${recordedPacket.gitSha}`,
    errors,
    'fresh Git SHA line',
  );
  expectedMarkdown = replaceExactlyOnce(
    expectedMarkdown,
    `- Current commit: ${freshChain.currentGitSha}`,
    `- Current commit: ${recordedChain.currentGitSha}`,
    errors,
    'fresh governed current-commit line',
  );
  expectedMarkdown = replaceExactlyOnce(
    expectedMarkdown,
    `- Allowlisted downstream commits: ${freshChain.downstreamCommitCount}`,
    `- Allowlisted downstream commits: ${recordedDownstreamCount}`,
    errors,
    'fresh governed downstream-count line',
  );
  if (expectedMarkdown !== recordedMarkdown) {
    errors.push(
      'committed Phase 5 packet Markdown does not match canonical replay inputs and its validated governed prefix',
    );
  }
  return errors;
}

const initialCommittedEvidenceJson = JSON.stringify(cat07CommittedEvidence);
const initialFullEvidenceJson = JSON.stringify(cat07FullEvidenceContract);

function verifyPhase5AssemblyBindings({ includeSourceSnapshot }) {
  const errors = [];
  if (includeSourceSnapshot) {
    errors.push(...verifyReleaseQaSnapshot(sourceSnapshot).errors);
  }
  errors.push(...verifyEvidenceBindings(evidenceBindings));
  if (governedWorkingBindings) {
    errors.push(
      ...verifyGovernedEvidenceWorkingBindings(governedWorkingBindings, root, {
        context: 'Phase 5 packet assembly',
      }),
    );
  } else if (governedEvidenceChain.status === 'pass') {
    errors.push('Phase 5 packet assembly has no retained governed evidence working bindings');
  }
  const committed = validateCat07CommittedEvidence(root, { expectedHeadSha: gitSha });
  const full = validateCat07FullEvidenceContract(root, { expectedHeadSha: gitSha });
  if (JSON.stringify(committed) !== initialCommittedEvidenceJson) {
    errors.push('CAT07 committed evidence result changed during Phase 5 packet assembly');
  }
  if (JSON.stringify(full) !== initialFullEvidenceJson) {
    errors.push('CAT07 full evidence result changed during Phase 5 packet assembly');
  }
  return errors;
}

async function waitForCheckDriftTestWindow(errors) {
  if (!process.argv.includes('--test-check-drift-window')) return;
  const rawMilliseconds = String(process.env.PHASE5_QA_PACKET_CHECK_TEST_PAUSE_MS ?? '');
  const milliseconds = Number(rawMilliseconds);
  if (
    process.env.NODE_ENV !== 'test' ||
    !/^[1-9][0-9]{2,4}$/u.test(rawMilliseconds) ||
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 100 ||
    milliseconds > 10_000
  ) {
    errors.push('Phase 5 check drift window is restricted to one bounded test-only pause');
    return;
  }
  console.log('PHASE5_QA_PACKET_CHECK_COMPARISON_COMPLETE');
  await new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));
}

if (checkMode) {
  const checkErrors = validateCommittedPacketReplay({
    snapshot: sourceSnapshot,
    freshPacket: packet,
    freshMarkdown: markdownBytes,
    chainAudit: governedEvidenceAudit,
  });
  if (checkErrors.length === 0) {
    await waitForCheckDriftTestWindow(checkErrors);
  }
  checkErrors.push(...verifyPhase5AssemblyBindings({ includeSourceSnapshot: true }));
  if (checkErrors.length > 0) {
    for (const error of checkErrors) console.error(`FAIL ${error}`);
    console.error(
      `\nPhase 5 committed QA packet check has ${checkErrors.length} failure${
        checkErrors.length === 1 ? '' : 's'
      }.`,
    );
    process.exit(1);
  }
  console.log(
    `PASS committed Phase 5 QA packet matches canonical replay inputs at governed prefix ${packetOutputPaths[0]}.`,
  );
  process.exit(0);
}

try {
  atomicWriteReleaseQaOutputs({
    root,
    snapshot: sourceSnapshot,
    outputs: [
      { path: packetOutputPaths[0], bytes: jsonBytes },
      { path: packetOutputPaths[1], bytes: markdownBytes },
    ],
    verifyAdditional() {
      return verifyPhase5AssemblyBindings({ includeSourceSnapshot: false });
    },
  });
} catch (error) {
  console.error(
    `FAIL Phase 5 packet publication was rejected: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}

console.log(`Wrote ${packetOutputPaths[0]}`);
console.log(`Wrote ${packetOutputPaths[1]}`);

if (strict && blockers.length > 0) {
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
  console.error(
    `\nPhase 5 strict QA packet has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}
