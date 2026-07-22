import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path';

import { normalizeNamedSignoff, placeholderEnvValue } from '../phase9/lib.mjs';

export const CAMERA_LIFECYCLE_EVIDENCE_SCHEMA_VERSION = 1;
export const CAMERA_LIFECYCLE_EVIDENCE_ROOT = 'docs/phase-5/evidence/camera-lifecycle/';
export const CAMERA_LIFECYCLE_MIN_DEVICES = 2;
export const CAMERA_LIFECYCLE_REVIEWED_IMAGE = 'macos-tahoe-26.4-xcode-26.4';
export const CAMERA_LIFECYCLE_REVIEWED_EAS_CLI = '21.0.1';
export const CAMERA_LIFECYCLE_REVIEWED_CURRENT_PUBLIC_IOS_VERSION = 'iOS 26.5.2';
export const CAMERA_LIFECYCLE_REVIEWED_CURRENT_IOS_SOURCE_URL =
  'https://support.apple.com/en-ca/100100';
export const CAMERA_LIFECYCLE_REVIEWED_CURRENT_FLAGSHIP_MODELS = Object.freeze([
  'iPhone 17 Pro',
  'iPhone 17 Pro Max',
]);
export const CAMERA_LIFECYCLE_MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
export const CAMERA_LIFECYCLE_EVIDENCE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
export const CAMERA_LIFECYCLE_MANIFEST_BYTES_MAX = 2 * 1024 * 1024;
export const CAMERA_LIFECYCLE_SOURCE_FILE_BYTES_MAX = 2 * 1024 * 1024;

export const CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES = Object.freeze([
  'package.json',
  'package-lock.json',
  'apps/mobile/app.base.json',
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
  'apps/mobile/package.json',
  'apps/mobile/src/app/_layout.tsx',
  'apps/mobile/src/app/progress/capture.tsx',
  'apps/mobile/src/app/progress/review.tsx',
  'apps/mobile/src/app/shelf/ocr.tsx',
  'apps/mobile/src/app/shelf/scan.tsx',
  'apps/mobile/src/features/native/camera/barcode.ts',
  'apps/mobile/src/features/native/camera/failureCopy.ts',
  'apps/mobile/src/features/native/camera/labelPhotoLifecycle.ts',
  'apps/mobile/src/features/native/camera/labelPhotoStartup.ts',
  'apps/mobile/src/features/native/camera/useCameraAccessLifecycle.ts',
  'apps/mobile/src/features/native/camera/useCameraAccessLifecycle.test.ts',
  'apps/mobile/src/features/photos/applyCaptureConsent.ts',
  'apps/mobile/src/features/photos/consent.ts',
  'apps/mobile/src/features/photos/PhotoStorageGate.tsx',
  'apps/mobile/src/features/photos/PhotoTimelineLockGate.tsx',
  'apps/mobile/src/features/photos/progressCapturePrivacy.ts',
  'apps/mobile/src/features/photos/progressCapturePrivacy.test.ts',
  'apps/mobile/src/features/photos/progressCaptureRouteBoundary.ts',
  'apps/mobile/src/features/photos/progressCaptureRouteBoundary.test.ts',
  'apps/mobile/src/features/photos/progressRoutes.test.ts',
  'apps/mobile/src/features/shelf/shelfRoutes.test.ts',
  'apps/mobile/src/features/navigation/sheetRouteContracts.test.ts',
  'apps/mobile/src/lib/appConfig.test.ts',
  'apps/mobile/src/lib/env.ts',
  'scripts/cat05/native-label-ocr-source-contract.test.mjs',
  'scripts/phase5/build-device-qa-packet.mjs',
  'scripts/phase5/camera-lifecycle-evidence-contract.mjs',
  'scripts/phase5/camera-lifecycle-evidence-smoke.mjs',
  'scripts/phase5/check-camera-lifecycle-evidence.mjs',
  'scripts/phase5/check-native-config.mjs',
  'scripts/phase5/device-qa-packet-smoke.mjs',
  'docs/phase-5/camera-lifecycle-evidence-runbook.md',
  'docs/phase-5/camera-lifecycle-evidence.template.json',
  'docs/phase-5/device-qa-checklist.md',
  'docs/phase-5/native-build-runbook.md',
]);

const COMMON_PERMISSION_OBSERVATIONS = Object.freeze([
  'permissionStartedUndetermined',
  'requestWasTriggeredInContext',
  'grantedStateReachedReadyCamera',
  'retryableDenialShowedRecovery',
  'retryRequestSucceeded',
  'cameraStayedUnmountedBeforeGrant',
]);

const COMMON_SETTINGS_OBSERVATIONS = Object.freeze([
  'permanentDenialUsedCanAskAgainFalse',
  'singleOpenSettingsActionVisible',
  'settingsReturnPerformedFreshPermissionQuery',
  'grantAfterSettingsReachedReadyCamera',
  'settingsOpenFailureWasVisibleAndRetryable',
  'nonCameraFallbackStayedReachable',
]);

const COMMON_LIFECYCLE_OBSERVATIONS = Object.freeze([
  'permissionPromptInactiveInvalidatedRequestResult',
  'backgroundInvalidatedCameraLease',
  'foregroundQueriedPermissionBeforeRemount',
  'foregroundPermissionQueryWasAuthoritative',
  'lateNativeCallbackWasIgnored',
  'noStateMutationOccurredAfterUnmount',
]);

const COMMON_MOUNT_OBSERVATIONS = Object.freeze([
  'onlyOneCameraPreviewWasMounted',
  'unfocusedCameraWasUnmounted',
  'cameraReadyWasRequiredBeforeOperation',
  'mountOrReadyFailureShowedStableRecovery',
  'retryCreatedFreshCameraGeneration',
  'retryRecoveredWithoutRelaunch',
]);

const COMMON_INTERRUPTION_OBSERVATIONS = Object.freeze([
  'nativeInterruptionSuspendedCameraUse',
  'inFlightLeaseWasInvalidated',
  'resumePerformedFreshPermissionQuery',
  'cameraRemountedOnceAfterRecovery',
  'staleCallbackDidNotNavigateOrMutate',
  'userCouldRetrySuccessfully',
]);

const COMMON_ACCESSIBILITY_OBSERVATIONS = Object.freeze([
  'voiceOverLabelsAndValuesPassed',
  'voiceOverFocusOrderPassed',
  'dynamicTypeTwoHundredPercentPassed',
  'minimumFortyFourPointTargetsPassed',
  'noColorOnlyStatePassed',
  'reduceMotionPassed',
  'settingsRetryAndFallbackWereReachable',
]);

function scenario(route, id, observations, options = {}) {
  return Object.freeze({
    route,
    id,
    observations: Object.freeze(observations),
    networkMode: options.networkMode ?? 'online',
    permissionBefore:
      options.permissionBefore ?? Object.freeze({ status: 'granted', canAskAgain: true }),
    permissionAfter:
      options.permissionAfter ?? Object.freeze({ status: 'granted', canAskAgain: true }),
  });
}

function routeScenarios(route, operationObservations, offlineObservations, privacyObservations) {
  return [
    scenario(route, 'permission', COMMON_PERMISSION_OBSERVATIONS, {
      permissionBefore: Object.freeze({ status: 'undetermined', canAskAgain: true }),
    }),
    scenario(route, 'settings', COMMON_SETTINGS_OBSERVATIONS, {
      permissionBefore: Object.freeze({ status: 'denied', canAskAgain: false }),
    }),
    scenario(route, 'lifecycle', COMMON_LIFECYCLE_OBSERVATIONS),
    scenario(route, 'mount', COMMON_MOUNT_OBSERVATIONS),
    scenario(route, 'camera_operation', operationObservations),
    scenario(route, 'offline', offlineObservations, { networkMode: 'offline' }),
    scenario(route, 'interruption', COMMON_INTERRUPTION_OBSERVATIONS),
    scenario(route, 'accessibility', COMMON_ACCESSIBILITY_OBSERVATIONS),
    scenario(route, 'privacy', privacyObservations),
  ];
}

export const CAMERA_LIFECYCLE_SCENARIOS = Object.freeze([
  ...routeScenarios(
    'shelf_scan',
    Object.freeze([
      'validBarcodeWasProcessedOnce',
      'invalidChecksumWasRejectedLocally',
      'duplicateReadWasSuppressed',
      'queuedBarcodeAfterInvalidationWasIgnored',
      'lookupFailureShowedSearchOcrAndManualRecovery',
      'operationFailureDidNotCrashOrHang',
    ]),
    Object.freeze([
      'offlineStateWasVerifiedOnDevice',
      'noThirdPartySourceRequestOccurred',
      'manualAndSearchRecoveryStayedReachable',
      'queuedCandidateDidNotMutateShelfWithoutConfirmation',
      'reconnectRecoveryStayedAccountAndConsentBound',
      'offlineFailureDidNotCrashOrHang',
    ]),
    Object.freeze([
      'barcodeFramesWereNeverPersisted',
      'zeroBarcodeFrameUploadsObserved',
      'zeroRawBarcodeAnalyticsObserved',
      'zeroUnexpectedCameraNetworkRequestsObserved',
      'noSensitiveCameraLogsObserved',
      'networkCaptureCoveredTheScenarioWindow',
    ]),
  ),
  ...routeScenarios(
    'shelf_ocr',
    Object.freeze([
      'shutterStayedBlockedUntilCameraReady',
      'captureFailureShowedStableRecovery',
      'captureRetrySucceeded',
      'manualIngredientFallbackStayedReachable',
      'lateCaptureResultWasIgnored',
      'lateRawPhotoCleanupWasAwaited',
    ]),
    Object.freeze([
      'offlineStateWasVerifiedOnDevice',
      'labelCaptureWorkedWithoutNetwork',
      'manualIngredientEntryWorkedWithoutNetwork',
      'zeroOcrNetworkRequestsObserved',
      'zeroImageOrTranscriptUploadsObserved',
      'offlineFailureDidNotCrashOrHang',
    ]),
    Object.freeze([
      'managedLabelPhotoWasRemovedAfterContinue',
      'managedLabelPhotoWasRemovedAfterRetake',
      'managedLabelPhotoWasRemovedAfterLeave',
      'expoCameraStartupResidueWasRemovedAfterColdRelaunch',
      'governedImageDigestWasAbsentFromImageCaches',
      'zeroImageTranscriptUploadsAndSensitiveLogsObserved',
    ]),
  ),
  ...routeScenarios(
    'progress_capture',
    Object.freeze([
      'localPhotoConsentPrecededPermissionRequest',
      'consentSaveFailureKeptCameraClosedAndRetryable',
      'shutterStayedBlockedUntilCameraReady',
      'captureFailureShowedStableRecovery',
      'captureRetrySucceeded',
      'routeExitDuringShutterDrainedBeforeRemoval',
      'gateReplacementPreservedCleanupRecovery',
    ]),
    Object.freeze([
      'offlineStateWasVerifiedOnDevice',
      'captureSaveAndTimelineViewWorkedOffline',
      'savedPhotoWasEncryptedAndDeviceOnly',
      'zeroPhotoOrMetadataUploadsObserved',
      'noCloudBackupControlWasExposed',
      'offlineFailureDidNotCrashOrHang',
    ]),
    Object.freeze([
      'rawCaptureWasRemovedAfterRetake',
      'rawCaptureWasRemovedAfterBackOrClose',
      'rawCaptureWasRemovedAfterSuccessfulSave',
      'cleanupFailureBlockedRemovalAndShowedRetry',
      'cleanupRetryDidNotDuplicateEncryptedStorage',
      'previewUsedNoImageCache',
      'zeroPhotoUploadsAndSensitiveLogsObserved',
    ]),
  ),
]);

export const CAMERA_LIFECYCLE_REQUIRED_BASE_ARTIFACTS = Object.freeze([
  { id: 'eas_build_log', mediaTypes: ['text/plain'] },
  { id: 'archive_identity_report', mediaTypes: ['application/json'] },
  { id: 'final_info_plist_report', mediaTypes: ['application/json'] },
  { id: 'device_inventory_report', mediaTypes: ['application/json'] },
  { id: 'network_privacy_report', mediaTypes: ['application/json'] },
  { id: 'privacy_cleanup_report', mediaTypes: ['application/json'] },
  { id: 'accessibility_report', mediaTypes: ['application/json'] },
  { id: 'scenario_index', mediaTypes: ['application/json'] },
]);

const SHA256 = /^[0-9a-f]{64}$/i;
const GIT_SHA = /^[0-9a-f]{40}$/i;
const EAS_BUILD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EAS_SLUG = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?$/;
const DEVICE_ID = /^ios-[a-z0-9][a-z0-9_-]{2,31}$/;
const RUN_ID = /^[a-z0-9][a-z0-9_-]{8,159}$/;
const ARTIFACT_ID = /^[a-z0-9][a-z0-9_-]{2,199}$/;
const CONTROL_CHAR = /[\u0000-\u001f\u007f-\u009f]/;
const WINDOWS_RESERVED_SEGMENT = /^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const ACCOUNTABILITY_ROLE_WORDS = new Set([
  'accessibility',
  'analyst',
  'assurance',
  'camera',
  'device',
  'demo',
  'engineer',
  'evidence',
  'example',
  'lead',
  'member',
  'owner',
  'operator',
  'person',
  'physical',
  'policy',
  'privacy',
  'qa',
  'quality',
  'raw',
  'redaction',
  'reviewer',
  'sample',
  'security',
  'team',
  'test',
  'tester',
  'unknown',
  'user',
  'staff',
]);
const BUILD_PROFILES = new Set(['staging', 'production']);
const DEVICE_ROLES = new Set(['supported_floor_class', 'current_flagship', 'additional_supported']);
const INSTALLATION_METHODS = new Set([
  'eas_internal_distribution',
  'testflight',
  'apple_configurator',
]);
const NETWORK_CAPTURE_TOOL_NAMES = new Set(['Proxyman', 'Charles Proxy', 'mitmproxy']);
const SOURCE_EVIDENCE_KINDS = new Set([
  'screen_recording',
  'screenshot_set',
  'structured_device_log',
  'network_trace',
  'filesystem_inspection',
  'accessibility_recording',
]);
const PERMISSION_STATUSES = new Set(['undetermined', 'denied', 'granted']);
const PROOF_MEDIA_TYPES = new Set(['application/json']);
export const CAMERA_LIFECYCLE_ARTIFACT_BYTE_CEILINGS = Object.freeze({
  'application/json': 512 * 1024,
  'text/plain': 8 * 1024 * 1024,
  'image/png': 2 * 1024 * 1024,
  'image/jpeg': 2 * 1024 * 1024,
  'video/mp4': 5 * 1024 * 1024,
});
export const CAMERA_LIFECYCLE_TOTAL_ARTIFACT_BYTES_MAX = 24 * 1024 * 1024;

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value, expected, prefix, errors) {
  if (!isObject(value)) return;
  const expectedSet = new Set(expected);
  for (const key of Object.keys(value)) {
    if (!expectedSet.has(key)) errors.push(`${prefix} contains unknown field ${key}.`);
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) errors.push(`${prefix}.${key} is required.`);
  }
}

function timestamp(value) {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function realText(value, minimumLength = 8) {
  const text = String(value ?? '').trim();
  return text.length >= minimumLength && !CONTROL_CHAR.test(text) && !placeholderEnvValue(text);
}

function normalizeAccountablePerson(value) {
  const normalized = normalizeNamedSignoff(value);
  if (!normalized) return null;
  const personalTokens = normalized
    .toLowerCase()
    .split(/[\s'-]+/)
    .filter(Boolean)
    .filter((token) => !ACCOUNTABILITY_ROLE_WORDS.has(token));
  return personalTokens.length >= 2 ? normalized : null;
}

export function normalizeCameraLifecycleEasBuildId(value) {
  if (typeof value !== 'string' || value !== value.trim() || placeholderEnvValue(value))
    return null;
  if (EAS_BUILD_ID.test(value)) return value.toLowerCase();
  try {
    const url = new URL(value);
    const segments = url.pathname.split('/');
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'expo.dev' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      segments.length !== 7 ||
      segments[0] !== '' ||
      segments[1] !== 'accounts' ||
      !EAS_SLUG.test(segments[2]) ||
      segments[3] !== 'projects' ||
      !EAS_SLUG.test(segments[4]) ||
      segments[5] !== 'builds' ||
      !EAS_BUILD_ID.test(segments[6])
    ) {
      return null;
    }
    return `https://expo.dev/accounts/${segments[2]}/projects/${segments[4]}/builds/${segments[6].toLowerCase()}`;
  } catch {
    return null;
  }
}

function realBuildId(value) {
  const normalized = normalizeCameraLifecycleEasBuildId(value);
  return normalized !== null && normalized === value;
}

function parseIosVersion(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^iOS\s+(\d{1,2})(?:\.(\d+)){0,2}$/i);
  if (!match) return null;
  return { text, major: Number.parseInt(match[1], 10) };
}

function physicalIphoneModel(value) {
  const text = String(value ?? '').trim();
  return (
    realText(text, 8) &&
    /^iPhone\s+(?!simulator|device|model|iOS\b)\S+/i.test(text) &&
    !/\b(?:simulator|emulator|generic)\b/i.test(text)
  );
}

function primaryAppleHttpsUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'apple.com' || url.hostname.endsWith('.apple.com')) &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function portableRepoRelativePath(value) {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    !value ||
    value.length > 512 ||
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
  if (
    normalized !== value ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.startsWith('/')
  ) {
    return null;
  }
  const segments = normalized.split('/');
  if (
    segments.some(
      (segment) =>
        !/^[A-Za-z0-9_][A-Za-z0-9._-]{0,199}$/.test(segment) ||
        segment.endsWith('.') ||
        WINDOWS_RESERVED_SEGMENT.test(segment),
    )
  ) {
    return null;
  }
  return normalized;
}

function normalizedRepoEvidencePath(value) {
  const normalized = portableRepoRelativePath(value);
  return normalized?.startsWith(CAMERA_LIFECYCLE_EVIDENCE_ROOT) ? normalized : null;
}

export function normalizeCameraLifecycleEvidencePath(value) {
  const normalized = normalizedRepoEvidencePath(value);
  return normalized?.endsWith('.json') ? normalized : null;
}

export function normalizeCameraLifecycleTemplatePath(value) {
  const normalized = portableRepoRelativePath(value);
  return normalized?.startsWith('docs/phase-5/') && normalized.endsWith('.json')
    ? normalized
    : null;
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function pathIsContained(rootPath, targetPath) {
  const child = relative(rootPath, targetPath);
  return Boolean(child) && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function inspectContainedComponents(absoluteRoot, absolutePath) {
  if (!pathIsContained(absoluteRoot, absolutePath)) return null;
  const components = relative(absoluteRoot, absolutePath).split(sep).filter(Boolean);
  let cursor = absoluteRoot;
  let finalStats = null;
  for (const [index, component] of components.entries()) {
    cursor = join(cursor, component);
    const stats = lstatSync(cursor, { bigint: true });
    if (stats.isSymbolicLink()) return null;
    if (index < components.length - 1 && !stats.isDirectory()) return null;
    if (index === components.length - 1) finalStats = stats;
  }
  return finalStats?.isFile() ? finalStats : null;
}

function sameFileSnapshot(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

export function readCameraLifecycleContainedFile(
  root,
  repoRelativePath,
  { maxBytes = CAMERA_LIFECYCLE_SOURCE_FILE_BYTES_MAX } = {},
) {
  let descriptor = null;
  try {
    const normalizedPath = portableRepoRelativePath(repoRelativePath);
    if (!normalizedPath || !Number.isInteger(maxBytes) || maxBytes < 1) return null;
    const canonicalize = realpathSync.native ?? realpathSync;
    const absoluteRoot = resolve(root);
    const rootStats = lstatSync(absoluteRoot, { bigint: true });
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) return null;
    const canonicalRoot = canonicalize(absoluteRoot);
    const absolutePath = resolve(absoluteRoot, normalizedPath);
    const beforePathStats = inspectContainedComponents(absoluteRoot, absolutePath);
    if (!beforePathStats || beforePathStats.size > BigInt(maxBytes)) return null;
    const canonicalBefore = canonicalize(absolutePath);
    if (!pathIsContained(canonicalRoot, canonicalBefore)) return null;

    const noFollow = Number.isInteger(fsConstants.O_NOFOLLOW) ? fsConstants.O_NOFOLLOW : 0;
    descriptor = openSync(absolutePath, fsConstants.O_RDONLY | noFollow);
    const beforeReadStats = fstatSync(descriptor, { bigint: true });
    if (
      !beforeReadStats.isFile() ||
      beforeReadStats.size > BigInt(maxBytes) ||
      !sameFileSnapshot(beforePathStats, beforeReadStats)
    ) {
      return null;
    }
    const bytes = readFileSync(descriptor);
    const afterReadStats = fstatSync(descriptor, { bigint: true });
    if (
      bytes.length !== Number(afterReadStats.size) ||
      bytes.length > maxBytes ||
      !sameFileSnapshot(beforeReadStats, afterReadStats)
    ) {
      return null;
    }

    const afterPathStats = inspectContainedComponents(absoluteRoot, absolutePath);
    const canonicalAfter = canonicalize(absolutePath);
    if (
      !afterPathStats ||
      !sameFileSnapshot(afterReadStats, afterPathStats) ||
      !pathIsContained(canonicalRoot, canonicalAfter) ||
      relative(canonicalBefore, canonicalAfter) !== ''
    ) {
      return null;
    }
    return {
      absolutePath,
      bytes,
      size: bytes.length,
      sha256: sha256Bytes(bytes),
    };
  } catch {
    return null;
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch {
        // Fail-closed return paths already discarded the bytes.
      }
    }
  }
}

function safeRegularFile(root, repoRelativePath, maxBytes) {
  return readCameraLifecycleContainedFile(root, repoRelativePath, { maxBytes });
}

function reviewedCameraPurpose(displayName) {
  return `Allow ${displayName} to use the camera to scan product barcodes, capture ingredient labels, and take guided progress photos. Barcode frames are processed on your device; label and progress photos remain local.`;
}

export function reviewedCameraPurposeString(displayName) {
  return reviewedCameraPurpose(displayName);
}

function permissionTemplate(status, canAskAgain) {
  return { status, canAskAgain };
}

function createDevicesTemplate() {
  return [
    {
      id: 'ios-floor-device',
      role: 'supported_floor_class',
      physical: true,
      model: null,
      hardwareModelIdentifier: null,
      osVersion: 'iOS 17.x',
      osBuild: null,
      identifierSha256: null,
      viewportWidthPoints: null,
      freshInstall: true,
      installedBundleIdentifier: null,
      installedAppVersion: null,
      installedIosBuildNumber: null,
      installedArchiveSha256: null,
      installedAt: null,
      installationMethod: null,
      installationReceiptArtifactId: 'install_receipt-ios-floor-device',
      inAppIdentityVerified: null,
    },
    {
      id: 'ios-current-device',
      role: 'current_flagship',
      physical: true,
      model: null,
      hardwareModelIdentifier: null,
      osVersion: CAMERA_LIFECYCLE_REVIEWED_CURRENT_PUBLIC_IOS_VERSION,
      osBuild: null,
      identifierSha256: null,
      viewportWidthPoints: null,
      freshInstall: true,
      installedBundleIdentifier: null,
      installedAppVersion: null,
      installedIosBuildNumber: null,
      installedArchiveSha256: null,
      installedAt: null,
      installationMethod: null,
      installationReceiptArtifactId: 'install_receipt-ios-current-device',
      inAppIdentityVerified: null,
    },
  ];
}

function createRunsTemplate(devices) {
  return devices.flatMap((device) =>
    CAMERA_LIFECYCLE_SCENARIOS.map((definition) => {
      const id = `${device.id}-${definition.route}-${definition.id}`;
      return {
        id,
        deviceId: device.id,
        route: definition.route,
        scenarioId: definition.id,
        startedAt: null,
        completedAt: null,
        permissionBefore: permissionTemplate(
          definition.permissionBefore.status,
          definition.permissionBefore.canAskAgain,
        ),
        permissionAfter: permissionTemplate(
          definition.permissionAfter.status,
          definition.permissionAfter.canAskAgain,
        ),
        networkMode: definition.networkMode,
        result: null,
        observations: Object.fromEntries(
          definition.observations.map((observation) => [observation, null]),
        ),
        proofArtifactIds: [`proof-${id}`],
        notes: null,
      };
    }),
  );
}

function artifactTemplate(id, mediaType) {
  return {
    id,
    path: null,
    sha256: null,
    bytes: null,
    mediaType,
    privacy: {
      classification: 'synthetic_or_redacted_non_sensitive',
      containsUserPhotoPixels: false,
      containsLabelPhotoPixels: false,
      containsRawBarcode: false,
      containsRawTranscript: false,
      containsRawDeviceIdentifier: false,
      containsAbsoluteLocalPath: false,
      reviewedBy: null,
      reviewedAt: null,
    },
  };
}

export function createCameraLifecycleEvidenceTemplate() {
  const devices = createDevicesTemplate();
  const runs = createRunsTemplate(devices);
  return {
    schemaVersion: CAMERA_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
    testStartedAt: null,
    completedAt: null,
    sourceGitSha: null,
    sourceHashes: Object.fromEntries(
      CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES.map((path) => [path, null]),
    ),
    build: {
      easIosBuildId: null,
      profile: null,
      appBundleIdentifier: null,
      appVersion: null,
      iosBuildNumber: null,
      displayName: null,
      archiveSha256: null,
      resolvedBuildImage: CAMERA_LIFECYCLE_REVIEWED_IMAGE,
      easCliVersion: CAMERA_LIFECYCLE_REVIEWED_EAS_CLI,
      xcodeVersion: null,
      iosSdkVersion: null,
    },
    signedArchive: {
      applicationIdentifier: null,
      bundleIdentifier: null,
      teamIdentifier: null,
      provisioningProfileUuid: null,
      signingCertificateSha256: null,
      executableSha256: null,
      codeSignatureValid: null,
      finalInfoPlist: {
        bundleIdentifier: null,
        displayName: null,
        appVersion: null,
        iosBuildNumber: null,
        cameraUsageDescription: null,
        cameraUsageDescriptionOccurrenceCount: null,
        unresolvedBuildVariablesAbsent: null,
      },
    },
    devicePolicy: {
      reviewedAt: null,
      reviewedBy: null,
      minimumIosVersion: '17.0',
      currentPublicIosVersion: CAMERA_LIFECYCLE_REVIEWED_CURRENT_PUBLIC_IOS_VERSION,
      currentIosReleaseSourceUrl: CAMERA_LIFECYCLE_REVIEWED_CURRENT_IOS_SOURCE_URL,
      supportedFloorDeviceId: 'ios-floor-device',
      currentFlagshipDeviceId: 'ios-current-device',
    },
    devices,
    runs,
    artifacts: [
      ...CAMERA_LIFECYCLE_REQUIRED_BASE_ARTIFACTS.map(({ id, mediaTypes }) =>
        artifactTemplate(id, mediaTypes[0]),
      ),
      ...devices.map((device) =>
        artifactTemplate(`install_receipt-${device.id}`, 'application/json'),
      ),
      ...runs.map((run) => artifactTemplate(`proof-${run.id}`, 'application/json')),
    ],
    knownLimitations: [],
    signoff: {
      decision: null,
      qaSignedOffBy: null,
      privacySecuritySignedOffBy: null,
      accessibilitySignedOffBy: null,
      signedAt: null,
    },
  };
}

function validateSourceHashes(sourceHashes, root, errors) {
  if (!isObject(sourceHashes)) {
    errors.push('sourceHashes must be an object.');
    return;
  }
  exactKeys(sourceHashes, CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES, 'sourceHashes', errors);
  for (const path of CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES) {
    const declared = sourceHashes[path];
    if (!SHA256.test(String(declared ?? ''))) {
      errors.push(`sourceHashes.${path} must be a SHA-256 digest.`);
      continue;
    }
    const file = safeRegularFile(root, path);
    if (!file) {
      errors.push(`Required camera lifecycle source file is missing: ${path}.`);
      continue;
    }
    if (file.sha256.toLowerCase() !== String(declared).toLowerCase()) {
      errors.push(`sourceHashes.${path} does not match the exact source file bytes.`);
    }
  }
}

function validateBuild(build, errors, options) {
  if (!isObject(build)) {
    errors.push('build must be an object.');
    return;
  }
  exactKeys(
    build,
    [
      'easIosBuildId',
      'profile',
      'appBundleIdentifier',
      'appVersion',
      'iosBuildNumber',
      'displayName',
      'archiveSha256',
      'resolvedBuildImage',
      'easCliVersion',
      'xcodeVersion',
      'iosSdkVersion',
    ],
    'build',
    errors,
  );
  if (!realBuildId(build.easIosBuildId)) {
    errors.push('build.easIosBuildId must be a real EAS build UUID or expo.dev build URL.');
  }
  if (options.expectedBuildId && String(build.easIosBuildId).trim() !== options.expectedBuildId) {
    errors.push('build.easIosBuildId must match PHASE5_IOS_BUILD_ID exactly.');
  }
  if (!BUILD_PROFILES.has(build.profile)) {
    errors.push('build.profile must be staging or production.');
  }
  if (options.expectedBuildProfile && build.profile !== options.expectedBuildProfile) {
    errors.push('build.profile must match PHASE5_IOS_BUILD_PROFILE exactly.');
  }
  if (!/^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)+$/.test(String(build.appBundleIdentifier ?? ''))) {
    errors.push('build.appBundleIdentifier must be a concrete reverse-DNS bundle identifier.');
  }
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(build.appVersion ?? ''))) {
    errors.push('build.appVersion must be a concrete semantic app version.');
  }
  if (!/^[1-9]\d{0,17}$/.test(String(build.iosBuildNumber ?? ''))) {
    errors.push('build.iosBuildNumber must be a positive App Store build number string.');
  }
  if (
    typeof build.displayName !== 'string' ||
    build.displayName !== build.displayName.trim() ||
    !realText(build.displayName, 3) ||
    build.displayName.length > 100 ||
    /\$(?:\(|\{)/.test(build.displayName)
  ) {
    errors.push(
      'build.displayName must be a concrete resolved display name without build variables.',
    );
  }
  if (!SHA256.test(String(build.archiveSha256 ?? '')) || /^0{64}$/.test(build.archiveSha256)) {
    errors.push('build.archiveSha256 must be a non-zero inspected signed archive SHA-256.');
  }
  if (build.resolvedBuildImage !== CAMERA_LIFECYCLE_REVIEWED_IMAGE) {
    errors.push(`build.resolvedBuildImage must be ${CAMERA_LIFECYCLE_REVIEWED_IMAGE}.`);
  }
  if (build.easCliVersion !== CAMERA_LIFECYCLE_REVIEWED_EAS_CLI) {
    errors.push(`build.easCliVersion must be ${CAMERA_LIFECYCLE_REVIEWED_EAS_CLI}.`);
  }
  if (
    !/^Xcode\s+\d+(?:\.\d+){1,2}(?:\s+\([A-Za-z0-9]+\))?$/.test(String(build.xcodeVersion ?? ''))
  ) {
    errors.push('build.xcodeVersion must record the resolved Xcode version and optional build.');
  }
  if (!/^iOS\s+\d+(?:\.\d+){1,2}$/.test(String(build.iosSdkVersion ?? ''))) {
    errors.push('build.iosSdkVersion must record the resolved iOS SDK version.');
  }
}

function validateFinalInfoPlist(info, build, errors) {
  if (!isObject(info)) {
    errors.push('signedArchive.finalInfoPlist must be an object.');
    return;
  }
  exactKeys(
    info,
    [
      'bundleIdentifier',
      'displayName',
      'appVersion',
      'iosBuildNumber',
      'cameraUsageDescription',
      'cameraUsageDescriptionOccurrenceCount',
      'unresolvedBuildVariablesAbsent',
    ],
    'signedArchive.finalInfoPlist',
    errors,
  );
  for (const [field, expected] of [
    ['bundleIdentifier', build?.appBundleIdentifier],
    ['displayName', build?.displayName],
    ['appVersion', build?.appVersion],
    ['iosBuildNumber', build?.iosBuildNumber],
  ]) {
    if (info[field] !== expected) {
      errors.push(
        `signedArchive.finalInfoPlist.${field} must match build.${field === 'bundleIdentifier' ? 'appBundleIdentifier' : field}.`,
      );
    }
  }
  const expectedPurpose = reviewedCameraPurpose(build?.displayName);
  if (info.cameraUsageDescription !== expectedPurpose) {
    errors.push(
      'signedArchive.finalInfoPlist.cameraUsageDescription must equal the exact reviewed purpose string resolved with build.displayName.',
    );
  }
  if (info.cameraUsageDescriptionOccurrenceCount !== 1) {
    errors.push('signedArchive.finalInfoPlist.cameraUsageDescriptionOccurrenceCount must be 1.');
  }
  if (info.unresolvedBuildVariablesAbsent !== true) {
    errors.push('signedArchive.finalInfoPlist.unresolvedBuildVariablesAbsent must be true.');
  }
}

function validateSignedArchive(signedArchive, build, errors) {
  if (!isObject(signedArchive)) {
    errors.push('signedArchive must be an object.');
    return;
  }
  exactKeys(
    signedArchive,
    [
      'applicationIdentifier',
      'bundleIdentifier',
      'teamIdentifier',
      'provisioningProfileUuid',
      'signingCertificateSha256',
      'executableSha256',
      'codeSignatureValid',
      'finalInfoPlist',
    ],
    'signedArchive',
    errors,
  );
  if (signedArchive.bundleIdentifier !== build?.appBundleIdentifier) {
    errors.push('signedArchive.bundleIdentifier must match build.appBundleIdentifier.');
  }
  if (!/^[A-Z0-9]{10}$/.test(String(signedArchive.teamIdentifier ?? ''))) {
    errors.push('signedArchive.teamIdentifier must be a concrete ten-character Apple Team ID.');
  }
  if (
    signedArchive.applicationIdentifier !==
    `${signedArchive.teamIdentifier}.${build?.appBundleIdentifier}`
  ) {
    errors.push('signedArchive.applicationIdentifier must equal Team ID plus bundle identifier.');
  }
  if (
    !/^[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}$/i.test(
      String(signedArchive.provisioningProfileUuid ?? ''),
    )
  ) {
    errors.push('signedArchive.provisioningProfileUuid must be a concrete UUID.');
  }
  for (const field of ['signingCertificateSha256', 'executableSha256']) {
    if (!SHA256.test(String(signedArchive[field] ?? '')) || /^0{64}$/.test(signedArchive[field])) {
      errors.push(`signedArchive.${field} must be a non-zero SHA-256 digest.`);
    }
  }
  if (signedArchive.codeSignatureValid !== true) {
    errors.push('signedArchive.codeSignatureValid must be true.');
  }
  validateFinalInfoPlist(signedArchive.finalInfoPlist, build, errors);
}

function validatePermissionState(value, expected, prefix, errors) {
  if (!isObject(value)) {
    errors.push(`${prefix} must be an object.`);
    return;
  }
  exactKeys(value, ['status', 'canAskAgain'], prefix, errors);
  if (!PERMISSION_STATUSES.has(value.status)) errors.push(`${prefix}.status is invalid.`);
  if (typeof value.canAskAgain !== 'boolean') errors.push(`${prefix}.canAskAgain must be Boolean.`);
  if (value.status !== expected.status || value.canAskAgain !== expected.canAskAgain) {
    errors.push(`${prefix} must match the predeclared scenario permission state.`);
  }
}

function validateDevices(devices, build, testStartedAt, errors) {
  const ids = new Set();
  const models = new Set();
  const identifierHashes = new Set();
  const byId = new Map();
  if (!Array.isArray(devices)) {
    errors.push('devices must be an array.');
    return { ids, byId };
  }
  if (devices.length < CAMERA_LIFECYCLE_MIN_DEVICES) {
    errors.push(`devices must include at least ${CAMERA_LIFECYCLE_MIN_DEVICES} physical iPhones.`);
  }
  for (const [index, device] of devices.entries()) {
    const prefix = `devices[${index}]`;
    if (!isObject(device)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    exactKeys(
      device,
      [
        'id',
        'role',
        'physical',
        'model',
        'hardwareModelIdentifier',
        'osVersion',
        'osBuild',
        'identifierSha256',
        'viewportWidthPoints',
        'freshInstall',
        'installedBundleIdentifier',
        'installedAppVersion',
        'installedIosBuildNumber',
        'installedArchiveSha256',
        'installedAt',
        'installationMethod',
        'installationReceiptArtifactId',
        'inAppIdentityVerified',
      ],
      prefix,
      errors,
    );
    if (!DEVICE_ID.test(String(device.id ?? ''))) errors.push(`${prefix}.id is invalid.`);
    else if (ids.has(device.id)) errors.push(`Duplicate device id: ${device.id}.`);
    else {
      ids.add(device.id);
      byId.set(device.id, device);
    }
    if (!DEVICE_ROLES.has(device.role)) errors.push(`${prefix}.role is invalid.`);
    if (device.physical !== true) errors.push(`${prefix}.physical must be true.`);
    if (!physicalIphoneModel(device.model)) {
      errors.push(`${prefix}.model must name a real physical iPhone model.`);
    } else if (models.has(device.model.toLowerCase())) {
      errors.push(`Physical-device matrix must use distinct iPhone models: ${device.model}.`);
    } else models.add(device.model.toLowerCase());
    if (!/^iPhone\d{1,2},\d{1,2}$/.test(String(device.hardwareModelIdentifier ?? ''))) {
      errors.push(
        `${prefix}.hardwareModelIdentifier must be a concrete iPhone hardware identifier.`,
      );
    }
    const ios = parseIosVersion(device.osVersion);
    if (!ios || ios.major < 17) errors.push(`${prefix}.osVersion must be iOS 17.0 or newer.`);
    if (!/^[0-9A-Z][0-9A-Za-z]{3,15}$/.test(String(device.osBuild ?? ''))) {
      errors.push(`${prefix}.osBuild must be a concrete Apple OS build identifier.`);
    }
    if (
      !SHA256.test(String(device.identifierSha256 ?? '')) ||
      /^0{64}$/.test(device.identifierSha256)
    ) {
      errors.push(
        `${prefix}.identifierSha256 must be a non-zero privacy-preserving device digest.`,
      );
    } else if (identifierHashes.has(device.identifierSha256.toLowerCase())) {
      errors.push(`${prefix}.identifierSha256 must identify a distinct physical device.`);
    } else identifierHashes.add(device.identifierSha256.toLowerCase());
    if (!Number.isInteger(device.viewportWidthPoints) || device.viewportWidthPoints < 375) {
      errors.push(`${prefix}.viewportWidthPoints must be at least the supported 375-point floor.`);
    }
    if (device.freshInstall !== true) errors.push(`${prefix}.freshInstall must be true.`);
    for (const [field, expected] of [
      ['installedBundleIdentifier', build?.appBundleIdentifier],
      ['installedAppVersion', build?.appVersion],
      ['installedIosBuildNumber', build?.iosBuildNumber],
      ['installedArchiveSha256', build?.archiveSha256],
    ]) {
      if (device[field] !== expected) {
        errors.push(`${prefix}.${field} must match the signed candidate build.`);
      }
    }
    const installedAt = timestamp(device.installedAt);
    if (installedAt === null) errors.push(`${prefix}.installedAt must be a valid ISO timestamp.`);
    if (installedAt !== null && testStartedAt !== null) {
      if (installedAt > testStartedAt) {
        errors.push(`${prefix}.installedAt must be before or equal to testStartedAt.`);
      }
      if (testStartedAt - installedAt > CAMERA_LIFECYCLE_EVIDENCE_MAX_AGE_MS) {
        errors.push(`${prefix}.installedAt must be within seven days before testStartedAt.`);
      }
    }
    if (!INSTALLATION_METHODS.has(device.installationMethod)) {
      errors.push(`${prefix}.installationMethod is not an approved Apple/EAS installation path.`);
    }
    if (device.installationReceiptArtifactId !== `install_receipt-${device.id}`) {
      errors.push(`${prefix}.installationReceiptArtifactId must be install_receipt-${device.id}.`);
    }
    if (device.inAppIdentityVerified !== true) {
      errors.push(`${prefix}.inAppIdentityVerified must be true.`);
    }
  }
  if (models.size < CAMERA_LIFECYCLE_MIN_DEVICES) {
    errors.push('devices must include at least two distinct physical iPhone models.');
  }
  return { ids, byId };
}

function validateDevicePolicy(policy, devicesById, testStartedAt, errors) {
  if (!isObject(policy)) {
    errors.push('devicePolicy must be an object.');
    return;
  }
  exactKeys(
    policy,
    [
      'reviewedAt',
      'reviewedBy',
      'minimumIosVersion',
      'currentPublicIosVersion',
      'currentIosReleaseSourceUrl',
      'supportedFloorDeviceId',
      'currentFlagshipDeviceId',
    ],
    'devicePolicy',
    errors,
  );
  const reviewedAt = timestamp(policy.reviewedAt);
  if (reviewedAt === null) errors.push('devicePolicy.reviewedAt must be a valid ISO timestamp.');
  if (reviewedAt !== null && testStartedAt !== null && reviewedAt > testStartedAt) {
    errors.push('devicePolicy.reviewedAt must be before or equal to testStartedAt.');
  }
  if (
    reviewedAt !== null &&
    testStartedAt !== null &&
    testStartedAt - reviewedAt > CAMERA_LIFECYCLE_EVIDENCE_MAX_AGE_MS
  ) {
    errors.push('devicePolicy.reviewedAt must be within seven days before testStartedAt.');
  }
  if (!normalizeAccountablePerson(policy.reviewedBy)) {
    errors.push('devicePolicy.reviewedBy must name an accountable person, not a role label.');
  }
  if (policy.minimumIosVersion !== '17.0') {
    errors.push('devicePolicy.minimumIosVersion must be 17.0.');
  }
  const currentVersion = parseIosVersion(policy.currentPublicIosVersion);
  if (
    !currentVersion ||
    policy.currentPublicIosVersion !== CAMERA_LIFECYCLE_REVIEWED_CURRENT_PUBLIC_IOS_VERSION
  ) {
    errors.push(
      `devicePolicy.currentPublicIosVersion must equal the reviewed current public release ${CAMERA_LIFECYCLE_REVIEWED_CURRENT_PUBLIC_IOS_VERSION}.`,
    );
  }
  if (
    !primaryAppleHttpsUrl(policy.currentIosReleaseSourceUrl) ||
    policy.currentIosReleaseSourceUrl !== CAMERA_LIFECYCLE_REVIEWED_CURRENT_IOS_SOURCE_URL
  ) {
    errors.push(
      `devicePolicy.currentIosReleaseSourceUrl must equal ${CAMERA_LIFECYCLE_REVIEWED_CURRENT_IOS_SOURCE_URL} without credentials, port, query, or fragment.`,
    );
  }
  if (policy.supportedFloorDeviceId === policy.currentFlagshipDeviceId) {
    errors.push('devicePolicy floor and current flagship device IDs must be distinct.');
  }
  const floor = devicesById.get(policy.supportedFloorDeviceId);
  const current = devicesById.get(policy.currentFlagshipDeviceId);
  if (!floor || floor.role !== 'supported_floor_class') {
    errors.push(
      'devicePolicy.supportedFloorDeviceId must identify the supported_floor_class phone.',
    );
  } else if (parseIosVersion(floor.osVersion)?.major !== 17) {
    errors.push('The supported-floor device must run an iOS 17.x build.');
  }
  if (!current || current.role !== 'current_flagship') {
    errors.push('devicePolicy.currentFlagshipDeviceId must identify the current_flagship phone.');
  } else if (current.osVersion !== policy.currentPublicIosVersion) {
    errors.push('The current flagship must run devicePolicy.currentPublicIosVersion exactly.');
  } else if (!CAMERA_LIFECYCLE_REVIEWED_CURRENT_FLAGSHIP_MODELS.includes(current.model)) {
    errors.push(
      `The current flagship model must be one of: ${CAMERA_LIFECYCLE_REVIEWED_CURRENT_FLAGSHIP_MODELS.join(', ')}.`,
    );
  }
}

function validateRuns(runs, devices, testStartedAt, completedAt, errors) {
  const validRuns = [];
  const intervalsByDevice = new Map();
  const expected = new Map();
  for (const deviceId of devices) {
    for (const definition of CAMERA_LIFECYCLE_SCENARIOS) {
      const id = `${deviceId}-${definition.route}-${definition.id}`;
      expected.set(id, { deviceId, definition });
    }
  }
  const seen = new Set();
  if (!Array.isArray(runs)) {
    errors.push('runs must be an array.');
    return { validRuns, expectedCount: expected.size, proofIds: new Set() };
  }
  const proofIds = new Set();
  for (const [index, run] of runs.entries()) {
    const prefix = `runs[${index}]`;
    if (!isObject(run)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    exactKeys(
      run,
      [
        'id',
        'deviceId',
        'route',
        'scenarioId',
        'startedAt',
        'completedAt',
        'permissionBefore',
        'permissionAfter',
        'networkMode',
        'result',
        'observations',
        'proofArtifactIds',
        'notes',
      ],
      prefix,
      errors,
    );
    if (!RUN_ID.test(String(run.id ?? ''))) errors.push(`${prefix}.id is invalid.`);
    if (seen.has(run.id)) errors.push(`Duplicate scenario run id: ${run.id}.`);
    seen.add(run.id);
    const target = expected.get(run.id);
    if (!target) {
      errors.push(`${prefix}.id is not a required device-route-scenario tuple.`);
      continue;
    }
    const { definition, deviceId } = target;
    if (
      run.deviceId !== deviceId ||
      run.route !== definition.route ||
      run.scenarioId !== definition.id
    ) {
      errors.push(`${prefix} tuple fields must agree with its canonical run id.`);
    }
    const startedAt = timestamp(run.startedAt);
    const endedAt = timestamp(run.completedAt);
    if (startedAt === null) errors.push(`${prefix}.startedAt must be a valid ISO timestamp.`);
    if (endedAt === null) errors.push(`${prefix}.completedAt must be a valid ISO timestamp.`);
    if (startedAt !== null && endedAt !== null && endedAt - startedAt < 1_000) {
      errors.push(`${prefix}.completedAt must be at least one second after startedAt.`);
    }
    if (startedAt !== null && testStartedAt !== null && startedAt < testStartedAt) {
      errors.push(`${prefix}.startedAt is before evidence.testStartedAt.`);
    }
    if (endedAt !== null && completedAt !== null && endedAt > completedAt) {
      errors.push(`${prefix}.completedAt is after evidence.completedAt.`);
    }
    if (startedAt !== null && endedAt !== null && endedAt - startedAt >= 1_000) {
      const intervals = intervalsByDevice.get(deviceId) ?? [];
      intervals.push({ id: run.id, startedAt, endedAt });
      intervalsByDevice.set(deviceId, intervals);
    }
    validatePermissionState(
      run.permissionBefore,
      definition.permissionBefore,
      `${prefix}.permissionBefore`,
      errors,
    );
    validatePermissionState(
      run.permissionAfter,
      definition.permissionAfter,
      `${prefix}.permissionAfter`,
      errors,
    );
    if (run.networkMode !== definition.networkMode) {
      errors.push(`${prefix}.networkMode must be ${definition.networkMode}.`);
    }
    if (run.result !== 'pass') errors.push(`${prefix}.result must be pass.`);
    if (!isObject(run.observations)) {
      errors.push(`${prefix}.observations must be an object.`);
    } else {
      exactKeys(run.observations, definition.observations, `${prefix}.observations`, errors);
      for (const observation of definition.observations) {
        if (run.observations[observation] !== true) {
          errors.push(`${prefix}.observations.${observation} must be true.`);
        }
      }
    }
    const canonicalProofId = `proof-${run.id}`;
    if (
      !Array.isArray(run.proofArtifactIds) ||
      run.proofArtifactIds.length !== 1 ||
      run.proofArtifactIds[0] !== canonicalProofId
    ) {
      errors.push(`${prefix}.proofArtifactIds must contain only ${canonicalProofId}.`);
    } else {
      proofIds.add(canonicalProofId);
    }
    if (run.notes !== null) {
      errors.push(`${prefix}.notes must be null for a passing canonical run.`);
    }
    validRuns.push(run);
  }
  for (const id of expected.keys()) {
    if (!seen.has(id)) errors.push(`Missing required device-route-scenario run: ${id}.`);
  }
  for (const [deviceId, intervals] of intervalsByDevice) {
    intervals.sort(
      (left, right) => left.startedAt - right.startedAt || left.endedAt - right.endedAt,
    );
    let latest = intervals[0] ?? null;
    for (const interval of intervals.slice(1)) {
      if (latest && interval.startedAt < latest.endedAt) {
        errors.push(
          `Camera lifecycle runs on ${deviceId} must not overlap: ${latest.id} overlaps ${interval.id}.`,
        );
      }
      if (!latest || interval.endedAt > latest.endedAt) latest = interval;
    }
  }
  return { validRuns, expectedCount: expected.size, proofIds };
}

function expectedExtension(mediaType) {
  return {
    'application/json': '.json',
    'text/plain': '.txt',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'video/mp4': '.mp4',
  }[mediaType];
}

function validateArtifactBytes(file, mediaType, prefix, errors) {
  const bytes = file.bytes;
  if (mediaType === 'application/json') {
    try {
      return JSON.parse(bytes.toString('utf8'));
    } catch {
      errors.push(`${prefix}.path must contain valid UTF-8 JSON.`);
    }
  } else if (mediaType === 'text/plain') {
    if (bytes.includes(0)) errors.push(`${prefix}.path text artifact contains a NUL byte.`);
  } else if (mediaType === 'image/png') {
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      errors.push(`${prefix}.path does not contain PNG magic bytes.`);
    }
  } else if (mediaType === 'image/jpeg') {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
      errors.push(`${prefix}.path does not contain a complete JPEG signature.`);
    }
  } else if (mediaType === 'video/mp4') {
    if (bytes.length < 12 || bytes.subarray(4, 8).toString('ascii') !== 'ftyp') {
      errors.push(`${prefix}.path does not contain MP4 ftyp magic bytes.`);
    }
  }
  return null;
}

function validateArtifactPrivacy(privacy, prefix, testStartedAt, completedAt, errors) {
  if (!isObject(privacy)) {
    errors.push(`${prefix}.privacy must be an object.`);
    return;
  }
  exactKeys(
    privacy,
    [
      'classification',
      'containsUserPhotoPixels',
      'containsLabelPhotoPixels',
      'containsRawBarcode',
      'containsRawTranscript',
      'containsRawDeviceIdentifier',
      'containsAbsoluteLocalPath',
      'reviewedBy',
      'reviewedAt',
    ],
    `${prefix}.privacy`,
    errors,
  );
  if (privacy.classification !== 'synthetic_or_redacted_non_sensitive') {
    errors.push(`${prefix}.privacy.classification must be synthetic_or_redacted_non_sensitive.`);
  }
  for (const field of [
    'containsUserPhotoPixels',
    'containsLabelPhotoPixels',
    'containsRawBarcode',
    'containsRawTranscript',
    'containsRawDeviceIdentifier',
    'containsAbsoluteLocalPath',
  ]) {
    if (privacy[field] !== false) errors.push(`${prefix}.privacy.${field} must be false.`);
  }
  if (!normalizeAccountablePerson(privacy.reviewedBy)) {
    errors.push(`${prefix}.privacy.reviewedBy must name an accountable person, not a role label.`);
  }
  const reviewedAt = timestamp(privacy.reviewedAt);
  if (reviewedAt === null)
    errors.push(`${prefix}.privacy.reviewedAt must be a valid ISO timestamp.`);
  if (reviewedAt !== null && testStartedAt !== null && reviewedAt < testStartedAt) {
    errors.push(`${prefix}.privacy.reviewedAt is before testStartedAt.`);
  }
  if (reviewedAt !== null && completedAt !== null && reviewedAt > completedAt) {
    errors.push(`${prefix}.privacy.reviewedAt is after completedAt.`);
  }
}

function validateArtifacts(artifacts, proofIds, devices, root, testStartedAt, completedAt, errors) {
  const validated = [];
  const byId = new Map();
  const seenPaths = new Set();
  const seenHashes = new Set();
  const baseById = new Map(
    CAMERA_LIFECYCLE_REQUIRED_BASE_ARTIFACTS.map((artifact) => [artifact.id, artifact]),
  );
  const installationReceiptIds = new Set(
    [...devices].map((deviceId) => `install_receipt-${deviceId}`),
  );
  const expectedIds = new Set([...baseById.keys(), ...installationReceiptIds, ...proofIds]);
  let totalBytes = 0;
  let declaredTotalBytes = 0;
  if (!Array.isArray(artifacts)) {
    errors.push('artifacts must be an array.');
    return { validated, byId };
  }
  for (const [index, artifact] of artifacts.entries()) {
    const prefix = `artifacts[${index}]`;
    if (!isObject(artifact)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    exactKeys(artifact, ['id', 'path', 'sha256', 'bytes', 'mediaType', 'privacy'], prefix, errors);
    if (!ARTIFACT_ID.test(String(artifact.id ?? '')) || !expectedIds.has(artifact.id)) {
      errors.push(
        `${prefix}.id is not a required camera lifecycle artifact: ${String(artifact.id)}.`,
      );
    }
    if (byId.has(artifact.id)) errors.push(`Duplicate artifact id: ${artifact.id}.`);
    const base = baseById.get(artifact.id);
    if (base && !base.mediaTypes.includes(artifact.mediaType)) {
      errors.push(`${prefix}.mediaType must be ${base.mediaTypes.join(' or ')}.`);
    }
    if (!base && !PROOF_MEDIA_TYPES.has(artifact.mediaType)) {
      errors.push(`${prefix}.mediaType is not allowed for scenario proof.`);
    }
    const normalizedPath = normalizedRepoEvidencePath(artifact.path);
    if (!normalizedPath) {
      errors.push(`${prefix}.path must be normalized under ${CAMERA_LIFECYCLE_EVIDENCE_ROOT}.`);
      continue;
    }
    const extension = expectedExtension(artifact.mediaType);
    if (extension && !normalizedPath.toLowerCase().endsWith(extension)) {
      errors.push(`${prefix}.path extension must match ${artifact.mediaType}.`);
    }
    if (seenPaths.has(normalizedPath)) errors.push(`Duplicate artifact path: ${normalizedPath}.`);
    seenPaths.add(normalizedPath);
    if (!SHA256.test(String(artifact.sha256 ?? ''))) errors.push(`${prefix}.sha256 is invalid.`);
    if (!Number.isInteger(artifact.bytes) || artifact.bytes < 32) {
      errors.push(`${prefix}.bytes must be an integer of at least 32.`);
    } else {
      declaredTotalBytes += artifact.bytes;
    }
    const byteCeiling = CAMERA_LIFECYCLE_ARTIFACT_BYTE_CEILINGS[artifact.mediaType];
    if (byteCeiling && Number.isInteger(artifact.bytes) && artifact.bytes > byteCeiling) {
      errors.push(
        `${prefix}.bytes exceeds the ${byteCeiling}-byte ceiling for ${artifact.mediaType}.`,
      );
    }
    validateArtifactPrivacy(artifact.privacy, prefix, testStartedAt, completedAt, errors);
    const file = safeRegularFile(root, normalizedPath, byteCeiling);
    if (!file) {
      errors.push(`${prefix}.path does not identify a regular non-symlink evidence file.`);
      continue;
    }
    if (file.size !== artifact.bytes) errors.push(`${prefix}.bytes does not match the file size.`);
    if (file.sha256.toLowerCase() !== String(artifact.sha256).toLowerCase()) {
      errors.push(`${prefix}.sha256 does not match the evidence file bytes.`);
    }
    if (byteCeiling && file.size > byteCeiling) {
      errors.push(`${prefix}.path exceeds the byte ceiling for ${artifact.mediaType}.`);
    }
    totalBytes += file.size;
    if (seenHashes.has(file.sha256)) errors.push(`Duplicate artifact bytes: ${normalizedPath}.`);
    seenHashes.add(file.sha256);
    const parsedJson = validateArtifactBytes(file, artifact.mediaType, prefix, errors);
    if (artifact.mediaType === 'application/json' || artifact.mediaType === 'text/plain') {
      const text = file.bytes.toString('utf8');
      if (
        /file:\/\//i.test(text) ||
        /[A-Za-z]:[\\/][^\s"']+/.test(text) ||
        /(?:^|[\s"']\s*)\/(?:Users|home|tmp|private|Volumes|var\/mobile)\//m.test(text)
      ) {
        errors.push(`${prefix}.path contains an absolute local filesystem path.`);
      }
    }
    const normalized = {
      ...artifact,
      path: normalizedPath,
      bytes: file.size,
      sha256: file.sha256,
      parsedJson,
      textContent: artifact.mediaType === 'text/plain' ? file.bytes.toString('utf8') : null,
    };
    validated.push(normalized);
    byId.set(artifact.id, normalized);
  }
  for (const id of expectedIds) {
    if (!byId.has(id)) errors.push(`Missing required camera lifecycle artifact: ${id}.`);
  }
  if (totalBytes > CAMERA_LIFECYCLE_TOTAL_ARTIFACT_BYTES_MAX) {
    errors.push(
      `Camera lifecycle artifacts total ${totalBytes} bytes, above the ${CAMERA_LIFECYCLE_TOTAL_ARTIFACT_BYTES_MAX}-byte packet ceiling.`,
    );
  }
  if (declaredTotalBytes > CAMERA_LIFECYCLE_TOTAL_ARTIFACT_BYTES_MAX) {
    errors.push(
      `Camera lifecycle artifacts declare ${declaredTotalBytes} bytes, above the ${CAMERA_LIFECYCLE_TOTAL_ARTIFACT_BYTES_MAX}-byte packet ceiling.`,
    );
  }
  return { validated, byId };
}

function reportBinding(evidence) {
  return {
    sourceGitSha: evidence.sourceGitSha,
    easIosBuildId: evidence.build?.easIosBuildId,
    archiveSha256: evidence.build?.archiveSha256,
    appBundleIdentifier: evidence.build?.appBundleIdentifier,
    appVersion: evidence.build?.appVersion,
    iosBuildNumber: evidence.build?.iosBuildNumber,
  };
}

function validateCanonicalReport(report, reportType, evidence, errors) {
  const prefix = `artifacts.${reportType}`;
  if (!isObject(report)) {
    errors.push(`${prefix} must contain a canonical JSON report.`);
    return null;
  }
  exactKeys(
    report,
    ['schemaVersion', 'reportType', 'capturedAt', 'binding', 'claims'],
    prefix,
    errors,
  );
  if (report.schemaVersion !== CAMERA_LIFECYCLE_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`${prefix}.schemaVersion is invalid.`);
  }
  if (report.reportType !== reportType) errors.push(`${prefix}.reportType must be ${reportType}.`);
  const capturedAt = timestamp(report.capturedAt);
  const startedAt = timestamp(evidence.testStartedAt);
  const completedAt = timestamp(evidence.completedAt);
  if (capturedAt === null) errors.push(`${prefix}.capturedAt must be a valid ISO timestamp.`);
  if (capturedAt !== null && startedAt !== null && capturedAt < startedAt) {
    errors.push(`${prefix}.capturedAt is before testStartedAt.`);
  }
  if (capturedAt !== null && completedAt !== null && capturedAt > completedAt) {
    errors.push(`${prefix}.capturedAt is after completedAt.`);
  }
  if (!isObject(report.binding)) {
    errors.push(`${prefix}.binding must be an object.`);
  } else {
    const expected = reportBinding(evidence);
    exactKeys(report.binding, Object.keys(expected), `${prefix}.binding`, errors);
    for (const [key, value] of Object.entries(expected)) {
      if (report.binding[key] !== value)
        errors.push(`${prefix}.binding.${key} does not cross-bind.`);
    }
  }
  if (!isObject(report.claims)) errors.push(`${prefix}.claims must be an object.`);
  return report.claims;
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requiredSourceEvidenceKinds(scenarioId) {
  if (scenarioId === 'offline') {
    return ['screen_recording', 'structured_device_log', 'network_trace'];
  }
  if (scenarioId === 'accessibility') return ['accessibility_recording'];
  if (scenarioId === 'privacy') {
    return ['screen_recording', 'structured_device_log', 'network_trace', 'filesystem_inspection'];
  }
  return ['screen_recording', 'structured_device_log'];
}

function validateSourceEvidence(
  sourceEvidence,
  prefix,
  run,
  evidence,
  expectedKind,
  seenSourceEvidenceDigests,
  seenSourceEvidenceReferences,
  errors,
) {
  if (!isObject(sourceEvidence)) {
    errors.push(`${prefix} must be an object.`);
    return;
  }
  exactKeys(
    sourceEvidence,
    ['kind', 'sha256', 'reference', 'reviewedBy', 'reviewedAt'],
    prefix,
    errors,
  );
  if (!SOURCE_EVIDENCE_KINDS.has(sourceEvidence.kind) || sourceEvidence.kind !== expectedKind) {
    errors.push(`${prefix}.kind must be ${expectedKind}.`);
  }
  if (!SHA256.test(String(sourceEvidence.sha256 ?? '')) || /^0{64}$/.test(sourceEvidence.sha256)) {
    errors.push(`${prefix}.sha256 must be a non-zero SHA-256 digest.`);
  } else if (seenSourceEvidenceDigests.has(sourceEvidence.sha256.toLowerCase())) {
    errors.push(`${prefix}.sha256 must uniquely bind this scenario run's raw source evidence.`);
  } else {
    seenSourceEvidenceDigests.add(sourceEvidence.sha256.toLowerCase());
  }
  const reference = String(sourceEvidence.reference ?? '');
  const expectedReference = `cat06/${run.deviceId}/${run.route}/${run.scenarioId}/${expectedKind}`;
  if (reference !== expectedReference) {
    errors.push(
      `${prefix}.reference must equal the derived access-controlled reference ${expectedReference}.`,
    );
  }
  if (seenSourceEvidenceReferences.has(reference)) {
    errors.push(`${prefix}.reference must be unique across the evidence packet.`);
  } else {
    seenSourceEvidenceReferences.add(reference);
  }
  if (!normalizeAccountablePerson(sourceEvidence.reviewedBy)) {
    errors.push(`${prefix}.reviewedBy must name an accountable person, not a role label.`);
  }
  const reviewedAt = timestamp(sourceEvidence.reviewedAt);
  const runCompletedAt = timestamp(run.completedAt);
  const evidenceCompletedAt = timestamp(evidence.completedAt);
  const signedAt = timestamp(evidence.signoff?.signedAt);
  if (reviewedAt === null) errors.push(`${prefix}.reviewedAt must be a canonical UTC timestamp.`);
  if (reviewedAt !== null && runCompletedAt !== null && reviewedAt < runCompletedAt) {
    errors.push(`${prefix}.reviewedAt must be after or equal to the scenario run completion.`);
  }
  if (reviewedAt !== null && evidenceCompletedAt !== null && reviewedAt > evidenceCompletedAt) {
    errors.push(`${prefix}.reviewedAt must be before or equal to evidence.completedAt.`);
  }
  if (reviewedAt !== null && signedAt !== null && reviewedAt > signedAt) {
    errors.push(`${prefix}.reviewedAt must be before or equal to signoff.signedAt.`);
  }
}

function validateReports(evidence, artifactById, validRuns, errors) {
  const devices = Array.isArray(evidence.devices) ? evidence.devices.filter(isObject) : [];
  const artifacts = Array.isArray(evidence.artifacts) ? evidence.artifacts.filter(isObject) : [];
  const build = isObject(evidence.build) ? evidence.build : {};
  const report = (id) => artifactById.get(id)?.parsedJson;
  const buildLog = artifactById.get('eas_build_log')?.textContent;
  const requiredBuildLogLines = [
    'ROUTINEKIND_CAMERA_BUILD_BINDING_V1',
    `sourceGitSha=${evidence.sourceGitSha}`,
    `easIosBuildId=${evidence.build?.easIosBuildId}`,
    `profile=${evidence.build?.profile}`,
    `resolvedBuildImage=${evidence.build?.resolvedBuildImage}`,
    `easCliVersion=${evidence.build?.easCliVersion}`,
    `xcodeVersion=${evidence.build?.xcodeVersion}`,
    `iosSdkVersion=${evidence.build?.iosSdkVersion}`,
    `appBundleIdentifier=${evidence.build?.appBundleIdentifier}`,
    `appVersion=${evidence.build?.appVersion}`,
    `iosBuildNumber=${evidence.build?.iosBuildNumber}`,
    `archiveSha256=${evidence.build?.archiveSha256}`,
  ];
  if (typeof buildLog !== 'string') {
    errors.push('eas_build_log must be a readable canonical binding excerpt.');
  } else {
    const canonicalExcerpt = requiredBuildLogLines.join('\n');
    if (buildLog !== canonicalExcerpt && buildLog !== `${canonicalExcerpt}\n`) {
      errors.push(
        'eas_build_log must contain only the 12 canonical binding lines in reviewed order, with at most one trailing newline; keep the raw EAS log access-controlled.',
      );
    }
  }
  let claims = validateCanonicalReport(
    report('archive_identity_report'),
    'archive_identity_report',
    evidence,
    errors,
  );
  if (claims) {
    exactKeys(
      claims,
      [
        'applicationIdentifier',
        'bundleIdentifier',
        'teamIdentifier',
        'provisioningProfileUuid',
        'signingCertificateSha256',
        'executableSha256',
        'codeSignatureVerifyExitCode',
        'embeddedProvisioningProfilePresent',
        'extractedFromSignedArchive',
      ],
      'artifacts.archive_identity_report.claims',
      errors,
    );
    for (const field of [
      'applicationIdentifier',
      'bundleIdentifier',
      'teamIdentifier',
      'provisioningProfileUuid',
      'signingCertificateSha256',
      'executableSha256',
    ]) {
      if (claims[field] !== evidence.signedArchive?.[field]) {
        errors.push(`archive_identity_report.claims.${field} must match signedArchive.${field}.`);
      }
    }
    if (claims.codeSignatureVerifyExitCode !== 0) {
      errors.push('archive_identity_report must record a zero codesign verification exit code.');
    }
    if (claims.embeddedProvisioningProfilePresent !== true) {
      errors.push('archive_identity_report must prove the provisioning profile is present.');
    }
    if (claims.extractedFromSignedArchive !== true) {
      errors.push('archive_identity_report must be extracted from the signed archive.');
    }
  }

  claims = validateCanonicalReport(
    report('final_info_plist_report'),
    'final_info_plist_report',
    evidence,
    errors,
  );
  if (claims) {
    exactKeys(
      claims,
      ['extractedFromSignedArchive', 'infoPlistRelativePath', 'finalInfoPlist'],
      'artifacts.final_info_plist_report.claims',
      errors,
    );
    if (claims.extractedFromSignedArchive !== true) {
      errors.push('final_info_plist_report must be extracted from the signed archive.');
    }
    if (
      !realText(claims.infoPlistRelativePath, 16) ||
      portableRepoRelativePath(claims.infoPlistRelativePath) !== claims.infoPlistRelativePath ||
      !claims.infoPlistRelativePath.endsWith('/Info.plist')
    ) {
      errors.push(
        'final_info_plist_report must name a normalized portable archive-member path ending in /Info.plist.',
      );
    }
    if (!exactJson(claims.finalInfoPlist, evidence.signedArchive?.finalInfoPlist)) {
      errors.push(
        'final_info_plist_report finalInfoPlist must exactly match signedArchive.finalInfoPlist.',
      );
    }
  }

  claims = validateCanonicalReport(
    report('device_inventory_report'),
    'device_inventory_report',
    evidence,
    errors,
  );
  if (claims) {
    exactKeys(
      claims,
      ['devices', 'allPhysical', 'installedCandidateMatched'],
      'artifacts.device_inventory_report.claims',
      errors,
    );
    if (!exactJson(claims.devices, evidence.devices)) {
      errors.push('device_inventory_report.claims.devices must exactly match evidence.devices.');
    }
    if (claims.allPhysical !== true || claims.installedCandidateMatched !== true) {
      errors.push(
        'device_inventory_report must prove physical devices and the installed candidate.',
      );
    }
  }

  for (const device of devices) {
    const artifactId = `install_receipt-${device.id}`;
    claims = validateCanonicalReport(report(artifactId), 'installation_receipt', evidence, errors);
    if (!claims) continue;
    exactKeys(
      claims,
      [
        'artifactId',
        'deviceId',
        'deviceIdentifierSha256',
        'installedAt',
        'installationMethod',
        'archiveSha256',
        'appBundleIdentifier',
        'appVersion',
        'iosBuildNumber',
        'inAppIdentityVerified',
      ],
      `artifacts.${artifactId}.claims`,
      errors,
    );
    const expected = {
      artifactId,
      deviceId: device.id,
      deviceIdentifierSha256: device.identifierSha256,
      installedAt: device.installedAt,
      installationMethod: device.installationMethod,
      archiveSha256: build.archiveSha256,
      appBundleIdentifier: build.appBundleIdentifier,
      appVersion: build.appVersion,
      iosBuildNumber: build.iosBuildNumber,
      inAppIdentityVerified: true,
    };
    for (const [field, value] of Object.entries(expected)) {
      if (claims[field] !== value) {
        errors.push(`${artifactId}.claims.${field} does not match the device/build binding.`);
      }
    }
  }

  const seenSourceEvidenceDigests = new Set();
  const seenSourceEvidenceReferences = new Set();
  for (const run of validRuns) {
    const artifactId = `proof-${run.id}`;
    claims = validateCanonicalReport(report(artifactId), 'camera_scenario_proof', evidence, errors);
    if (!claims) continue;
    exactKeys(
      claims,
      ['artifactId', 'run', 'sourceEvidence'],
      `artifacts.${artifactId}.claims`,
      errors,
    );
    if (claims.artifactId !== artifactId) {
      errors.push(`${artifactId}.claims.artifactId must match the proof artifact id.`);
    }
    if (!exactJson(claims.run, run)) {
      errors.push(`${artifactId}.claims.run must exactly cross-bind the governed scenario run.`);
    }
    const expectedKinds = requiredSourceEvidenceKinds(run.scenarioId);
    if (!Array.isArray(claims.sourceEvidence)) {
      errors.push(`${artifactId}.claims.sourceEvidence must be a bounded canonical array.`);
    } else {
      if (claims.sourceEvidence.length !== expectedKinds.length) {
        errors.push(
          `${artifactId}.claims.sourceEvidence must contain ${expectedKinds.join(', ')} in canonical order.`,
        );
      }
      for (const [index, expectedKind] of expectedKinds.entries()) {
        validateSourceEvidence(
          claims.sourceEvidence[index],
          `${artifactId}.claims.sourceEvidence[${index}]`,
          run,
          evidence,
          expectedKind,
          seenSourceEvidenceDigests,
          seenSourceEvidenceReferences,
          errors,
        );
      }
    }
  }

  const routeIds = ['progress_capture', 'shelf_ocr', 'shelf_scan'];
  const deviceIds = [...new Set(devices.map(({ id }) => id))].sort();
  const offlineRunIds = validRuns
    .filter((run) => run.scenarioId === 'offline')
    .map(({ id }) => id)
    .sort();
  claims = validateCanonicalReport(
    report('network_privacy_report'),
    'network_privacy_report',
    evidence,
    errors,
  );
  if (claims) {
    exactKeys(
      claims,
      [
        'captureTool',
        'captureStartedAt',
        'captureEndedAt',
        'deviceIds',
        'routeIds',
        'offlineRunIds',
        'zeroBarcodeFrameUploads',
        'zeroLabelPhotoUploads',
        'zeroProgressPhotoUploads',
        'zeroTranscriptUploads',
        'zeroUnexpectedCameraNetworkRequests',
        'noRawBarcodeOrSensitiveCameraLogs',
      ],
      'artifacts.network_privacy_report.claims',
      errors,
    );
    if (!isObject(claims.captureTool)) {
      errors.push('network_privacy_report.captureTool must be a structured object.');
    } else {
      exactKeys(
        claims.captureTool,
        ['name', 'version', 'mode'],
        'artifacts.network_privacy_report.claims.captureTool',
        errors,
      );
      if (!NETWORK_CAPTURE_TOOL_NAMES.has(claims.captureTool.name)) {
        errors.push('network_privacy_report.captureTool.name is not allowlisted.');
      }
      if (!/^\d{1,3}(?:\.\d{1,3}){1,3}$/.test(String(claims.captureTool.version ?? ''))) {
        errors.push(
          'network_privacy_report.captureTool.version must be a bounded numeric version.',
        );
      }
      if (claims.captureTool.mode !== 'physical_device_proxy') {
        errors.push('network_privacy_report.captureTool.mode must be physical_device_proxy.');
      }
    }
    const captureStart = timestamp(claims.captureStartedAt);
    const captureEnd = timestamp(claims.captureEndedAt);
    if (captureStart === null || captureEnd === null || captureEnd <= captureStart) {
      errors.push('network_privacy_report capture window is invalid.');
    }
    const evidenceStartedAt = timestamp(evidence.testStartedAt);
    const evidenceCompletedAt = timestamp(evidence.completedAt);
    if (captureStart !== null && evidenceStartedAt !== null && captureStart > evidenceStartedAt) {
      errors.push('network_privacy_report capture must start at or before testStartedAt.');
    }
    if (captureEnd !== null && evidenceCompletedAt !== null && captureEnd < evidenceCompletedAt) {
      errors.push('network_privacy_report capture must end at or after completedAt.');
    }
    if (!exactJson(claims.deviceIds, deviceIds) || !exactJson(claims.routeIds, routeIds)) {
      errors.push('network_privacy_report must cover every declared device and camera route.');
    }
    if (!exactJson(claims.offlineRunIds, offlineRunIds)) {
      errors.push('network_privacy_report.offlineRunIds must cover every offline scenario run.');
    }
    for (const field of [
      'zeroBarcodeFrameUploads',
      'zeroLabelPhotoUploads',
      'zeroProgressPhotoUploads',
      'zeroTranscriptUploads',
      'zeroUnexpectedCameraNetworkRequests',
      'noRawBarcodeOrSensitiveCameraLogs',
    ]) {
      if (claims[field] !== true)
        errors.push(`network_privacy_report.claims.${field} must be true.`);
    }
  }

  const privacyRunIds = validRuns
    .filter((run) => run.scenarioId === 'privacy')
    .map(({ id }) => id)
    .sort();
  claims = validateCanonicalReport(
    report('privacy_cleanup_report'),
    'privacy_cleanup_report',
    evidence,
    errors,
  );
  if (claims) {
    exactKeys(
      claims,
      [
        'artifactIds',
        'deviceIds',
        'privacyRunIds',
        'managedLabelPhotoCleanupPass',
        'expoCameraStartupCleanupPass',
        'imageCacheDigestAbsencePass',
        'progressRawCaptureCleanupPass',
        'leaveRetakeSaveCleanupPass',
        'lateCaptureCleanupPass',
        'cleanupFailureRetryPass',
        'noUserPhotoBytesCommittedToGit',
        'allArtifactsReviewed',
        'allArtifactsSyntheticOrRedacted',
        'noUserPhotoPixels',
        'noLabelPhotoPixels',
        'noRawBarcodes',
        'noRawTranscripts',
        'noRawDeviceIdentifiers',
        'noAbsoluteLocalPaths',
      ],
      'artifacts.privacy_cleanup_report.claims',
      errors,
    );
    if (
      !exactJson(claims.deviceIds, deviceIds) ||
      !exactJson(claims.privacyRunIds, privacyRunIds)
    ) {
      errors.push('privacy_cleanup_report must cover every device privacy scenario.');
    }
    const artifactIds = artifacts.map(({ id }) => id).sort();
    if (!exactJson(claims.artifactIds, artifactIds)) {
      errors.push('privacy_cleanup_report.artifactIds must enumerate every packet artifact.');
    }
    for (const field of [
      'managedLabelPhotoCleanupPass',
      'expoCameraStartupCleanupPass',
      'imageCacheDigestAbsencePass',
      'progressRawCaptureCleanupPass',
      'leaveRetakeSaveCleanupPass',
      'lateCaptureCleanupPass',
      'cleanupFailureRetryPass',
      'noUserPhotoBytesCommittedToGit',
      'allArtifactsReviewed',
      'allArtifactsSyntheticOrRedacted',
      'noUserPhotoPixels',
      'noLabelPhotoPixels',
      'noRawBarcodes',
      'noRawTranscripts',
      'noRawDeviceIdentifiers',
      'noAbsoluteLocalPaths',
    ]) {
      if (claims[field] !== true)
        errors.push(`privacy_cleanup_report.claims.${field} must be true.`);
    }
  }

  const accessibilityRunIds = validRuns
    .filter((run) => run.scenarioId === 'accessibility')
    .map(({ id }) => id)
    .sort();
  claims = validateCanonicalReport(
    report('accessibility_report'),
    'accessibility_report',
    evidence,
    errors,
  );
  if (claims) {
    exactKeys(
      claims,
      [
        'deviceIds',
        'routeIds',
        'accessibilityRunIds',
        'voiceOverPass',
        'dynamicTypeTwoHundredPercentPass',
        'minimumFortyFourPointTargetsPass',
        'reduceMotionPass',
        'noColorOnlyPass',
      ],
      'artifacts.accessibility_report.claims',
      errors,
    );
    if (
      !exactJson(claims.deviceIds, deviceIds) ||
      !exactJson(claims.routeIds, routeIds) ||
      !exactJson(claims.accessibilityRunIds, accessibilityRunIds)
    ) {
      errors.push('accessibility_report must cover every device, route, and accessibility run.');
    }
    for (const field of [
      'voiceOverPass',
      'dynamicTypeTwoHundredPercentPass',
      'minimumFortyFourPointTargetsPass',
      'reduceMotionPass',
      'noColorOnlyPass',
    ]) {
      if (claims[field] !== true) errors.push(`accessibility_report.claims.${field} must be true.`);
    }
  }

  claims = validateCanonicalReport(report('scenario_index'), 'scenario_index', evidence, errors);
  if (claims) {
    exactKeys(
      claims,
      ['runIds', 'proofArtifactIds', 'noOmittedOrDuplicateRuns'],
      'artifacts.scenario_index.claims',
      errors,
    );
    const runIds = validRuns.map(({ id }) => id).sort();
    const proofIds = validRuns.flatMap(({ proofArtifactIds }) => proofArtifactIds).sort();
    if (!exactJson(claims.runIds, runIds) || !exactJson(claims.proofArtifactIds, proofIds)) {
      errors.push('scenario_index must exactly enumerate every run and proof artifact.');
    }
    if (claims.noOmittedOrDuplicateRuns !== true) {
      errors.push('scenario_index.claims.noOmittedOrDuplicateRuns must be true.');
    }
  }
}

function validateSignoff(signoff, completedAt, now, errors) {
  if (!isObject(signoff)) {
    errors.push('signoff must be an object.');
    return;
  }
  exactKeys(
    signoff,
    [
      'decision',
      'qaSignedOffBy',
      'privacySecuritySignedOffBy',
      'accessibilitySignedOffBy',
      'signedAt',
    ],
    'signoff',
    errors,
  );
  if (signoff.decision !== 'pass') errors.push('signoff.decision must be pass.');
  const qa = normalizeAccountablePerson(signoff.qaSignedOffBy);
  const privacy = normalizeAccountablePerson(signoff.privacySecuritySignedOffBy);
  const accessibility = normalizeAccountablePerson(signoff.accessibilitySignedOffBy);
  if (!qa) errors.push('signoff.qaSignedOffBy must name an accountable person, not a role label.');
  if (!privacy)
    errors.push(
      'signoff.privacySecuritySignedOffBy must name an accountable person, not a role label.',
    );
  if (!accessibility)
    errors.push(
      'signoff.accessibilitySignedOffBy must name an accountable person, not a role label.',
    );
  if (qa && privacy && qa.toLowerCase() === privacy.toLowerCase()) {
    errors.push('QA and privacy/security signoffs must be independent named reviewers.');
  }
  const signedAt = timestamp(signoff.signedAt);
  if (signedAt === null) errors.push('signoff.signedAt must be a valid ISO timestamp.');
  if (signedAt !== null && completedAt !== null && signedAt < completedAt) {
    errors.push('signoff.signedAt must be after or equal to completedAt.');
  }
  if (signedAt !== null && signedAt > now + CAMERA_LIFECYCLE_MAX_CLOCK_SKEW_MS) {
    errors.push('signoff.signedAt cannot be in the future beyond the clock-skew allowance.');
  }
  if (signedAt !== null && now - signedAt > CAMERA_LIFECYCLE_EVIDENCE_MAX_AGE_MS) {
    errors.push('signoff.signedAt must be no more than seven days old.');
  }
}

export function validateCameraLifecycleEvidence(evidence, options = {}) {
  const errors = [];
  const warnings = [];
  const root = options.root ?? process.cwd();
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const emptySummary = {
    devices: 0,
    routes: 0,
    scenarioDefinitions: CAMERA_LIFECYCLE_SCENARIOS.length,
    runs: 0,
    requiredRuns: 0,
    artifacts: 0,
    proofArtifacts: 0,
  };
  if (!isObject(evidence)) {
    return {
      errors: ['Camera lifecycle evidence must be a JSON object.'],
      warnings,
      artifacts: [],
      summary: emptySummary,
    };
  }
  exactKeys(
    evidence,
    [
      'schemaVersion',
      'testStartedAt',
      'completedAt',
      'sourceGitSha',
      'sourceHashes',
      'build',
      'signedArchive',
      'devicePolicy',
      'devices',
      'runs',
      'artifacts',
      'knownLimitations',
      'signoff',
    ],
    'evidence',
    errors,
  );
  if (evidence.schemaVersion !== CAMERA_LIFECYCLE_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${CAMERA_LIFECYCLE_EVIDENCE_SCHEMA_VERSION}.`);
  }
  const testStartedAt = timestamp(evidence.testStartedAt);
  const completedAt = timestamp(evidence.completedAt);
  if (testStartedAt === null) errors.push('testStartedAt must be a valid ISO timestamp.');
  if (completedAt === null) errors.push('completedAt must be a valid ISO timestamp.');
  if (testStartedAt !== null && completedAt !== null && completedAt <= testStartedAt) {
    errors.push('completedAt must be after testStartedAt.');
  }
  if (testStartedAt !== null && testStartedAt > now + CAMERA_LIFECYCLE_MAX_CLOCK_SKEW_MS) {
    errors.push('testStartedAt cannot be in the future beyond the clock-skew allowance.');
  }
  if (completedAt !== null && completedAt > now + CAMERA_LIFECYCLE_MAX_CLOCK_SKEW_MS) {
    errors.push('completedAt cannot be in the future beyond the clock-skew allowance.');
  }
  if (completedAt !== null && now - completedAt > CAMERA_LIFECYCLE_EVIDENCE_MAX_AGE_MS) {
    errors.push('completedAt must be no more than seven days old.');
  }
  if (!GIT_SHA.test(String(evidence.sourceGitSha ?? ''))) {
    errors.push('sourceGitSha must be the exact 40-character source commit used by the build.');
  }
  validateSourceHashes(evidence.sourceHashes, root, errors);
  validateBuild(evidence.build, errors, options);
  validateSignedArchive(evidence.signedArchive, evidence.build, errors);
  const deviceValidation = validateDevices(evidence.devices, evidence.build, testStartedAt, errors);
  validateDevicePolicy(evidence.devicePolicy, deviceValidation.byId, testStartedAt, errors);
  const runValidation = validateRuns(
    evidence.runs,
    deviceValidation.ids,
    testStartedAt,
    completedAt,
    errors,
  );
  const artifactValidation = validateArtifacts(
    evidence.artifacts,
    runValidation.proofIds,
    deviceValidation.ids,
    root,
    testStartedAt,
    completedAt,
    errors,
  );
  validateReports(evidence, artifactValidation.byId, runValidation.validRuns, errors);
  if (!Array.isArray(evidence.knownLimitations)) {
    errors.push('knownLimitations must be an array.');
  } else {
    for (const [index, limitation] of evidence.knownLimitations.entries()) {
      if (!realText(limitation, 12)) {
        errors.push(`knownLimitations[${index}] must be meaningful text.`);
      } else {
        errors.push(
          `knownLimitations[${index}] must be resolved before a pass decision: ${String(limitation).trim()}`,
        );
      }
    }
  }
  validateSignoff(evidence.signoff, completedAt, now, errors);

  const routes = new Set(runValidation.validRuns.map(({ route }) => route));
  return {
    errors,
    warnings,
    artifacts: artifactValidation.validated.map(
      ({ parsedJson: _parsedJson, textContent: _textContent, ...artifact }) => artifact,
    ),
    summary: {
      devices: deviceValidation.ids.size,
      routes: routes.size,
      scenarioDefinitions: CAMERA_LIFECYCLE_SCENARIOS.length,
      runs: runValidation.validRuns.length,
      requiredRuns: runValidation.expectedCount,
      artifacts: artifactValidation.validated.length,
      proofArtifacts: runValidation.proofIds.size,
    },
  };
}
