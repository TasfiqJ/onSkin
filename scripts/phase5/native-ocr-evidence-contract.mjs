import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, posix, resolve, sep } from 'node:path';

import { normalizeNamedSignoff, placeholderEnvValue } from '../phase9/lib.mjs';

export const NATIVE_OCR_EVIDENCE_SCHEMA_VERSION = 2;
export const NATIVE_OCR_EVIDENCE_ROOT = 'docs/phase-5/evidence/native-ocr/';
export const NATIVE_OCR_MIN_DEVICES = 2;
export const NATIVE_OCR_MIN_ITEMS_PER_CLASS = 5;
export const NATIVE_OCR_MIN_RTL_ITEMS = 2;
export const NATIVE_OCR_TIMEOUT_MS = 12_000;

export const NATIVE_OCR_LABEL_CLASSES = Object.freeze([
  'clear',
  'curved',
  'tiny',
  'multilingual',
  'glare_heavy',
]);

export const NATIVE_OCR_REQUIRED_ARTIFACTS = Object.freeze([
  { id: 'eas_build_log', mediaTypes: ['text/plain', 'application/json'] },
  { id: 'archive_inspection', mediaTypes: ['text/plain', 'application/json'] },
  { id: 'raw_run_export', mediaTypes: ['application/json', 'text/csv'] },
  { id: 'network_capture', mediaTypes: ['application/json', 'text/plain'] },
  { id: 'accessibility_report', mediaTypes: ['application/json', 'text/plain'] },
  { id: 'cleanup_report', mediaTypes: ['application/json', 'text/plain'] },
  { id: 'corpus_provenance_report', mediaTypes: ['application/json', 'text/plain'] },
]);

// These are the release-behavior inputs that a completed physical-device
// artifact must hash. Tests and this validator are packet inputs separately;
// the evidence binding itself stays focused on the code shipped to the phone.
export const NATIVE_OCR_REQUIRED_SOURCE_FILES = Object.freeze([
  'apps/mobile/app.base.json',
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
  'apps/mobile/package.json',
  'apps/mobile/src/app/_layout.tsx',
  'apps/mobile/src/app/progress/capture.tsx',
  'apps/mobile/src/app/progress/review.tsx',
  'apps/mobile/src/app/shelf/ocr.tsx',
  'apps/mobile/src/app/shelf/scan.tsx',
  'apps/mobile/src/features/catalog/normalization.ts',
  'apps/mobile/src/features/catalog/ingredientParser.ts',
  'apps/mobile/src/features/native/camera/labelPhotoLifecycle.ts',
  'apps/mobile/src/features/native/camera/labelPhotoStartup.ts',
  'apps/mobile/src/features/native/ocr/accessibility.ts',
  'apps/mobile/src/features/native/ocr/analytics.ts',
  'apps/mobile/src/features/native/ocr/contract.ts',
  'apps/mobile/src/features/native/ocr/coordinator.ts',
  'apps/mobile/src/features/native/ocr/index.ts',
  'apps/mobile/src/features/native/ocr/nativeAdapter.ios.ts',
  'apps/mobile/src/features/native/ocr/nativeAdapter.ts',
  'apps/mobile/src/features/native/ocr/reviewState.ts',
  'apps/mobile/src/features/native/ocr/transcript.ts',
  'apps/mobile/src/features/photos/progressCapturePrivacy.ts',
  'apps/mobile/src/lib/env.ts',
  'apps/mobile/modules/native-label-ocr/expo-module.config.json',
  'apps/mobile/modules/native-label-ocr/index.ts',
  'apps/mobile/modules/native-label-ocr/package.json',
  'apps/mobile/modules/native-label-ocr/ios/NativeLabelOcr.podspec',
  'apps/mobile/modules/native-label-ocr/ios/NativeLabelOcrModule.swift',
  'apps/mobile/modules/native-label-ocr/src/NativeLabelOcr.types.ts',
  'apps/mobile/modules/native-label-ocr/src/NativeLabelOcrModule.ts',
]);

const SHA256 = /^[0-9a-f]{64}$/i;
const GIT_SHA = /^[0-9a-f]{40}$/i;
const EAS_BUILD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EAS_BUILD_URL =
  /^https:\/\/expo\.dev\/accounts\/[^/\s]+\/projects\/[^/\s]+\/builds\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:[?#].*)?$/i;
const BCP47 = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const CORPUS_ID = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const DEVICE_ID = /^ios-[a-z0-9][a-z0-9_-]{2,31}$/;
const BUILD_PROFILES = new Set(['development', 'staging', 'production']);
const RIGHTS_BASES = new Set([
  'owned_physical_product',
  'licensed_test_asset',
  'synthetic_original',
]);
const RTL_LANGUAGE_BASES = new Set(['ar', 'fa', 'he', 'ur']);

function hasRtlLanguage(languageTags) {
  return (
    Array.isArray(languageTags) &&
    languageTags.some((tag) => RTL_LANGUAGE_BASES.has(String(tag).toLowerCase().split('-')[0]))
  );
}

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
  if (typeof value !== 'string' || value !== value.trim() || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function realText(value, minimumLength = 8) {
  const text = String(value ?? '').trim();
  return text.length >= minimumLength && !placeholderEnvValue(text);
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function boundedRate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function nearlyEqual(left, right) {
  return (
    typeof left === 'number' &&
    Number.isFinite(left) &&
    typeof right === 'number' &&
    Number.isFinite(right) &&
    Math.abs(left - right) <= 0.000001
  );
}

function roundRate(value) {
  return Number(value.toFixed(6));
}

function nearestRank(samples, percentile) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)];
}

function realBuildId(value) {
  const text = String(value ?? '').trim();
  return !placeholderEnvValue(text) && (EAS_BUILD_ID.test(text) || EAS_BUILD_URL.test(text));
}

function supportedIosVersion(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^iOS\s+(\d{1,2})(?:\.\d+){0,2}$/i);
  return match ? Number.parseInt(match[1], 10) >= 17 : false;
}

function physicalIphoneModel(value) {
  const text = String(value ?? '').trim();
  return (
    realText(text, 8) &&
    /^iPhone\s+(?!simulator|device|model|iOS\b)\S+/i.test(text) &&
    !/\b(?:simulator|emulator|generic)\b/i.test(text)
  );
}

function normalizedRepoEvidencePath(value) {
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
    normalized.startsWith(NATIVE_OCR_EVIDENCE_ROOT)
    ? normalized
    : null;
}

export function normalizeNativeOcrEvidencePath(value) {
  const normalized = normalizedRepoEvidencePath(value);
  return normalized?.endsWith('.json') ? normalized : null;
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function safeRegularFile(root, repoRelativePath) {
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, repoRelativePath);
  const rootPrefix = `${absoluteRoot}${sep}`;
  if (!absolutePath.startsWith(rootPrefix) || !existsSync(absolutePath)) return null;
  const stats = lstatSync(absolutePath);
  if (!stats.isFile() || stats.isSymbolicLink()) return null;
  return { absolutePath, bytes: stats.size, sha256: sha256File(absolutePath) };
}

function createCorpusTemplate() {
  return NATIVE_OCR_LABEL_CLASSES.flatMap((labelClass) =>
    Array.from({ length: NATIVE_OCR_MIN_ITEMS_PER_CLASS }, (_, index) => ({
      id: `${labelClass.replace('_', '-')}-${index + 1}`,
      labelClass,
      languageTags:
        labelClass === 'multilingual'
          ? index < NATIVE_OCR_MIN_RTL_ITEMS
            ? ['en', 'ar']
            : ['en', null]
          : ['en'],
      rightsBasis: null,
      provenanceNote: null,
      groundTruthSha256: null,
      expectedTokenCount: null,
    })),
  );
}

function createDevicesTemplate() {
  return Array.from({ length: NATIVE_OCR_MIN_DEVICES }, (_, index) => ({
    id: `ios-device-${index + 1}`,
    physical: true,
    model: null,
    osVersion: 'iOS 17.0 or newer',
  }));
}

function createRunsTemplate(corpus, devices) {
  return devices.flatMap((device) =>
    corpus.map((item) => ({
      id: `${device.id}-${item.id}`,
      deviceId: device.id,
      corpusItemId: item.id,
      capturedAt: null,
      recognitionMs: null,
      expectedTokenCount: null,
      matchedTokenCount: null,
      outputTokenCount: null,
      insertedTokenCount: null,
      sequenceEditDistance: null,
      lowConfidenceTokenCount: null,
      editable: null,
      manualRecoveryAvailable: null,
      uncertaintyCuesVisible: null,
      transcriptNfc: null,
      multilingualGlyphsPreserved: null,
      readingOrderReviewed: null,
      rtlReadingOrderPass: null,
      completedWithoutCrashOrHang: null,
      timedOut: null,
    })),
  );
}

function blankSummary() {
  return {
    runCount: null,
    expectedTokens: null,
    matchedTokens: null,
    outputTokens: null,
    insertedTokens: null,
    sequenceEdits: null,
    tokenRecall: null,
    insertedTokenRate: null,
    orderedSequenceSimilarity: null,
    p95RecognitionMs: null,
  };
}

export function createNativeOcrEvidenceTemplate() {
  const corpus = createCorpusTemplate();
  const devices = createDevicesTemplate();
  return {
    schemaVersion: NATIVE_OCR_EVIDENCE_SCHEMA_VERSION,
    testStartedAt: null,
    completedAt: null,
    sourceGitSha: null,
    sourceHashes: Object.fromEntries(NATIVE_OCR_REQUIRED_SOURCE_FILES.map((path) => [path, null])),
    build: {
      easIosBuildId: null,
      profile: null,
      appBundleIdentifier: null,
      appVersion: null,
      iosBuildNumber: null,
      nativeOcrEnabled: true,
      engine: 'apple_vision_legacy',
      requestRevision: 3,
      recognitionLevel: 'accurate',
      usesLanguageCorrection: false,
      runsOnDevice: true,
      archiveSha256: null,
    },
    thresholds: {
      definedAt: null,
      definedBy: null,
      minimumTokenRecallByClass: {
        clear: 0.95,
        curved: 0.85,
        tiny: 0.85,
        multilingual: 0.85,
        glare_heavy: 0.85,
      },
      minimumOrderedSequenceSimilarityByClass: {
        clear: 0.95,
        curved: 0.85,
        tiny: 0.85,
        multilingual: 0.85,
        glare_heavy: 0.85,
      },
      maximumInsertedTokenRateByClass: Object.fromEntries(
        NATIVE_OCR_LABEL_CLASSES.map((labelClass) => [labelClass, 0.05]),
      ),
      maximumP95RecognitionMs: 5_000,
      applicationTimeoutMs: NATIVE_OCR_TIMEOUT_MS,
      rationale: null,
    },
    devices,
    corpus,
    runs: createRunsTemplate(corpus, devices),
    results: {
      totalRuns: null,
      totalDevices: null,
      totalCorpusItems: null,
      classSummaries: Object.fromEntries(
        NATIVE_OCR_LABEL_CLASSES.map((labelClass) => [labelClass, blankSummary()]),
      ),
      overallP95RecognitionMs: null,
      allRunsCompleted: null,
      thresholdDecision: null,
    },
    accessibility: {
      testedDeviceIds: devices.map(({ id }) => id),
      voiceOverEditingPass: null,
      statusAnnouncementsPass: null,
      noFocusStealPass: null,
      dynamicType200Pass: null,
      minimum48PointTargetsPass: null,
      noColorOnlyUncertaintyPass: null,
      manualFallbackReachablePass: null,
      proofArtifactId: 'accessibility_report',
    },
    cleanup: {
      cancellationDrainPass: null,
      lateResultIgnoredPass: null,
      temporaryPhotoRemovedAfterContinue: null,
      temporaryPhotoRemovedAfterRetake: null,
      temporaryPhotoRemovedAfterLeave: null,
      noOrphanedManagedPhotos: null,
      noOrphanedExpoCameraPhotosAfterColdRelaunch: null,
      noLabelPhotoInImageCaches: null,
      startupSnapshotRetryBeforeSuccessPass: null,
      startupSnapshotFrozenAfterSuccessPass: null,
      combinedStartupDrainCoordinationPass: null,
      staleRawCaptureRemovedAfterLeaseInvalidation: null,
      progressReviewRawCaptureLifecyclePass: null,
      proofArtifactId: 'cleanup_report',
    },
    privacyNetwork: {
      networkCaptureTool: null,
      captureStartedAt: null,
      captureEndedAt: null,
      zeroOcrNetworkRequests: null,
      zeroImageUploads: null,
      zeroTranscriptUploads: null,
      imagesRemainOnDevice: null,
      transcriptsRemainOnDevice: null,
      noSensitiveLogs: null,
      proofArtifactId: 'network_capture',
    },
    provenance: {
      reviewedAt: null,
      reviewedBy: null,
      allItemsHaveDocumentedRightsBasis: null,
      noThirdPartyLabelImagesCommitted: null,
      proofArtifactId: 'corpus_provenance_report',
    },
    artifacts: NATIVE_OCR_REQUIRED_ARTIFACTS.map(({ id, mediaTypes }) => ({
      id,
      path: null,
      sha256: null,
      bytes: null,
      mediaType: mediaTypes[0],
    })),
    knownLimitations: [],
    signoff: {
      decision: null,
      qaSignedOffBy: null,
      privacySignedOffBy: null,
      signedAt: null,
    },
  };
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
      'nativeOcrEnabled',
      'engine',
      'requestRevision',
      'recognitionLevel',
      'usesLanguageCorrection',
      'runsOnDevice',
      'archiveSha256',
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
    errors.push('build.profile must be development, staging, or production.');
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
  if (!/^\d+$/.test(String(build.iosBuildNumber ?? '')) || Number(build.iosBuildNumber) < 1) {
    errors.push('build.iosBuildNumber must be a positive App Store build number string.');
  }
  if (build.nativeOcrEnabled !== true) errors.push('build.nativeOcrEnabled must be true.');
  if (build.engine !== 'apple_vision_legacy') {
    errors.push('build.engine must be apple_vision_legacy for the reviewed CAT-05 implementation.');
  }
  if (build.requestRevision !== 3) errors.push('build.requestRevision must be 3.');
  if (build.recognitionLevel !== 'accurate') {
    errors.push('build.recognitionLevel must be accurate.');
  }
  if (build.usesLanguageCorrection !== false) {
    errors.push('build.usesLanguageCorrection must be false for the reviewed INCI policy.');
  }
  if (build.runsOnDevice !== true) errors.push('build.runsOnDevice must be true.');
  if (!SHA256.test(String(build.archiveSha256 ?? ''))) {
    errors.push('build.archiveSha256 must be the inspected signed archive SHA-256.');
  }
}

function validateThresholds(thresholds, testStartedAt, errors) {
  if (!isObject(thresholds)) {
    errors.push('thresholds must be an object.');
    return;
  }
  exactKeys(
    thresholds,
    [
      'definedAt',
      'definedBy',
      'minimumTokenRecallByClass',
      'minimumOrderedSequenceSimilarityByClass',
      'maximumInsertedTokenRateByClass',
      'maximumP95RecognitionMs',
      'applicationTimeoutMs',
      'rationale',
    ],
    'thresholds',
    errors,
  );
  const definedAt = timestamp(thresholds.definedAt);
  if (definedAt === null) errors.push('thresholds.definedAt must be a valid ISO timestamp.');
  if (definedAt !== null && testStartedAt !== null && definedAt > testStartedAt) {
    errors.push(
      'thresholds.definedAt must be before or equal to testStartedAt; post-hoc thresholds are rejected.',
    );
  }
  if (!normalizeNamedSignoff(thresholds.definedBy)) {
    errors.push('thresholds.definedBy must name a real owner, not a placeholder.');
  }
  if (!realText(thresholds.rationale, 30)) {
    errors.push('thresholds.rationale must explain the predeclared release targets.');
  }

  for (const [field, floorOrCeiling] of [
    ['minimumTokenRecallByClass', 'minimum'],
    ['minimumOrderedSequenceSimilarityByClass', 'minimum'],
    ['maximumInsertedTokenRateByClass', 'maximum'],
  ]) {
    const values = thresholds[field];
    if (!isObject(values)) {
      errors.push(`thresholds.${field} must be an object.`);
      continue;
    }
    exactKeys(values, NATIVE_OCR_LABEL_CLASSES, `thresholds.${field}`, errors);
    for (const labelClass of NATIVE_OCR_LABEL_CLASSES) {
      if (!boundedRate(values[labelClass])) {
        errors.push(`thresholds.${field}.${labelClass} must be between 0 and 1.`);
        continue;
      }
      const required =
        field === 'maximumInsertedTokenRateByClass' ? 0.05 : labelClass === 'clear' ? 0.95 : 0.85;
      if (
        (floorOrCeiling === 'minimum' && values[labelClass] < required) ||
        (floorOrCeiling === 'maximum' && values[labelClass] > required)
      ) {
        errors.push(
          `thresholds.${field}.${labelClass} must be ${floorOrCeiling === 'minimum' ? 'at least' : 'at most'} ${required}.`,
        );
      }
    }
  }
  if (
    !positiveInteger(thresholds.maximumP95RecognitionMs) ||
    thresholds.maximumP95RecognitionMs > 5_000
  ) {
    errors.push(
      'thresholds.maximumP95RecognitionMs must be a positive value no greater than 5000.',
    );
  }
  if (thresholds.applicationTimeoutMs !== NATIVE_OCR_TIMEOUT_MS) {
    errors.push(`thresholds.applicationTimeoutMs must be ${NATIVE_OCR_TIMEOUT_MS}.`);
  }
}

function validateSourceHashes(sourceHashes, root, errors) {
  if (!isObject(sourceHashes)) {
    errors.push('sourceHashes must be an object.');
    return;
  }
  exactKeys(sourceHashes, NATIVE_OCR_REQUIRED_SOURCE_FILES, 'sourceHashes', errors);
  for (const path of NATIVE_OCR_REQUIRED_SOURCE_FILES) {
    const declared = sourceHashes[path];
    if (!SHA256.test(String(declared ?? ''))) {
      errors.push(`sourceHashes.${path} must be a SHA-256 digest.`);
      continue;
    }
    const file = safeRegularFile(root, path);
    if (!file) {
      errors.push(`Required native OCR source file is missing or not a regular file: ${path}.`);
      continue;
    }
    if (file.sha256.toLowerCase() !== String(declared).toLowerCase()) {
      errors.push(`sourceHashes.${path} does not match the exact source file bytes.`);
    }
  }
}

function validateDevices(devices, errors) {
  const deviceIds = new Set();
  const deviceModels = new Set();
  if (!Array.isArray(devices)) {
    errors.push('devices must be an array.');
    return deviceIds;
  }
  if (devices.length < NATIVE_OCR_MIN_DEVICES) {
    errors.push(`devices must include at least ${NATIVE_OCR_MIN_DEVICES} physical iPhones.`);
  }
  for (const [index, device] of devices.entries()) {
    const prefix = `devices[${index}]`;
    if (!isObject(device)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    exactKeys(device, ['id', 'physical', 'model', 'osVersion'], prefix, errors);
    if (!DEVICE_ID.test(String(device.id ?? ''))) errors.push(`${prefix}.id is invalid.`);
    else if (deviceIds.has(device.id)) errors.push(`Duplicate device id: ${device.id}.`);
    else deviceIds.add(device.id);
    if (device.physical !== true) errors.push(`${prefix}.physical must be true.`);
    if (!physicalIphoneModel(device.model)) {
      errors.push(`${prefix}.model must name a real physical iPhone model.`);
    } else {
      deviceModels.add(String(device.model).trim().toLowerCase());
    }
    if (!supportedIosVersion(device.osVersion)) {
      errors.push(`${prefix}.osVersion must be iOS 17.0 or newer.`);
    }
  }
  if (deviceModels.size < NATIVE_OCR_MIN_DEVICES) {
    errors.push(
      `devices must include at least ${NATIVE_OCR_MIN_DEVICES} distinct physical iPhone models.`,
    );
  }
  return deviceIds;
}

function validateCorpus(corpus, errors) {
  const corpusById = new Map();
  const rtlCorpusIds = new Set();
  const classCounts = Object.fromEntries(
    NATIVE_OCR_LABEL_CLASSES.map((labelClass) => [labelClass, 0]),
  );
  if (!Array.isArray(corpus)) {
    errors.push('corpus must be an array.');
    return { corpusById, classCounts, rtlCorpusIds };
  }
  for (const [index, item] of corpus.entries()) {
    const prefix = `corpus[${index}]`;
    if (!isObject(item)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    exactKeys(
      item,
      [
        'id',
        'labelClass',
        'languageTags',
        'rightsBasis',
        'provenanceNote',
        'groundTruthSha256',
        'expectedTokenCount',
      ],
      prefix,
      errors,
    );
    if (!CORPUS_ID.test(String(item.id ?? ''))) errors.push(`${prefix}.id is invalid.`);
    else if (corpusById.has(item.id)) errors.push(`Duplicate corpus item id: ${item.id}.`);
    else corpusById.set(item.id, item);
    if (!NATIVE_OCR_LABEL_CLASSES.includes(item.labelClass)) {
      errors.push(`${prefix}.labelClass is invalid.`);
    } else {
      classCounts[item.labelClass] += 1;
    }
    if (
      !Array.isArray(item.languageTags) ||
      item.languageTags.length === 0 ||
      !item.languageTags.every((tag) => typeof tag === 'string' && BCP47.test(tag))
    ) {
      errors.push(`${prefix}.languageTags must contain valid BCP-47 language tags.`);
    }
    if (
      item.labelClass === 'multilingual' &&
      Array.isArray(item.languageTags) &&
      new Set(item.languageTags.map((tag) => String(tag).toLowerCase())).size < 2
    ) {
      errors.push(
        `${prefix}.languageTags must contain at least two languages for multilingual labels.`,
      );
    }
    if (item.labelClass === 'multilingual' && hasRtlLanguage(item.languageTags)) {
      rtlCorpusIds.add(item.id);
    }
    if (!RIGHTS_BASES.has(item.rightsBasis)) errors.push(`${prefix}.rightsBasis is invalid.`);
    if (!realText(item.provenanceNote, 20)) {
      errors.push(`${prefix}.provenanceNote must document the image/test-label rights basis.`);
    }
    if (!SHA256.test(String(item.groundTruthSha256 ?? ''))) {
      errors.push(`${prefix}.groundTruthSha256 must hash the reviewed reference transcript.`);
    }
    if (!positiveInteger(item.expectedTokenCount)) {
      errors.push(`${prefix}.expectedTokenCount must be a positive integer.`);
    }
  }
  for (const labelClass of NATIVE_OCR_LABEL_CLASSES) {
    if (classCounts[labelClass] < NATIVE_OCR_MIN_ITEMS_PER_CLASS) {
      errors.push(
        `corpus must include at least ${NATIVE_OCR_MIN_ITEMS_PER_CLASS} ${labelClass} labels.`,
      );
    }
  }
  if (rtlCorpusIds.size < NATIVE_OCR_MIN_RTL_ITEMS) {
    errors.push(
      `corpus must include at least ${NATIVE_OCR_MIN_RTL_ITEMS} multilingual labels with an Arabic, Persian, Hebrew, or Urdu language tag for RTL reading-order review.`,
    );
  }
  return { corpusById, classCounts, rtlCorpusIds };
}

function calculateClassSummary(runs) {
  const expectedTokens = runs.reduce((sum, run) => sum + run.expectedTokenCount, 0);
  const matchedTokens = runs.reduce((sum, run) => sum + run.matchedTokenCount, 0);
  const outputTokens = runs.reduce((sum, run) => sum + run.outputTokenCount, 0);
  const insertedTokens = runs.reduce((sum, run) => sum + run.insertedTokenCount, 0);
  const sequenceEdits = runs.reduce((sum, run) => sum + run.sequenceEditDistance, 0);
  const sequenceTokenFloor = runs.reduce(
    (sum, run) => sum + Math.max(run.expectedTokenCount, run.outputTokenCount),
    0,
  );
  return {
    runCount: runs.length,
    expectedTokens,
    matchedTokens,
    outputTokens,
    insertedTokens,
    sequenceEdits,
    tokenRecall: roundRate(matchedTokens / expectedTokens),
    insertedTokenRate: roundRate(insertedTokens / Math.max(1, outputTokens)),
    orderedSequenceSimilarity: roundRate(
      Math.max(0, 1 - sequenceEdits / Math.max(1, sequenceTokenFloor)),
    ),
    p95RecognitionMs: nearestRank(
      runs.map((run) => run.recognitionMs),
      0.95,
    ),
  };
}

function validateRuns(runs, deviceIds, corpusById, testStartedAt, completedAt, errors) {
  const validRuns = [];
  const seenPairs = new Set();
  if (!Array.isArray(runs)) {
    errors.push('runs must be an array.');
    return { validRuns, seenPairs };
  }
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
        'corpusItemId',
        'capturedAt',
        'recognitionMs',
        'expectedTokenCount',
        'matchedTokenCount',
        'outputTokenCount',
        'insertedTokenCount',
        'sequenceEditDistance',
        'lowConfidenceTokenCount',
        'editable',
        'manualRecoveryAvailable',
        'uncertaintyCuesVisible',
        'transcriptNfc',
        'multilingualGlyphsPreserved',
        'readingOrderReviewed',
        'rtlReadingOrderPass',
        'completedWithoutCrashOrHang',
        'timedOut',
      ],
      prefix,
      errors,
    );
    if (!CORPUS_ID.test(String(run.id ?? ''))) errors.push(`${prefix}.id is invalid.`);
    if (!deviceIds.has(run.deviceId)) errors.push(`${prefix}.deviceId is unknown.`);
    const item = corpusById.get(run.corpusItemId);
    if (!item) errors.push(`${prefix}.corpusItemId is unknown.`);
    const pair = `${run.deviceId}:${run.corpusItemId}`;
    if (seenPairs.has(pair)) errors.push(`Duplicate device/corpus run: ${pair}.`);
    seenPairs.add(pair);
    const capturedAt = timestamp(run.capturedAt);
    if (capturedAt === null) errors.push(`${prefix}.capturedAt must be a valid ISO timestamp.`);
    if (capturedAt !== null && testStartedAt !== null && capturedAt < testStartedAt) {
      errors.push(`${prefix}.capturedAt must be after or equal to testStartedAt.`);
    }
    if (capturedAt !== null && completedAt !== null && capturedAt > completedAt) {
      errors.push(`${prefix}.capturedAt must be before or equal to completedAt.`);
    }
    if (!positiveInteger(run.recognitionMs) || run.recognitionMs >= NATIVE_OCR_TIMEOUT_MS) {
      errors.push(`${prefix}.recognitionMs must be positive and below ${NATIVE_OCR_TIMEOUT_MS}.`);
    }
    for (const field of [
      'expectedTokenCount',
      'matchedTokenCount',
      'outputTokenCount',
      'insertedTokenCount',
      'sequenceEditDistance',
      'lowConfidenceTokenCount',
    ]) {
      if (!nonnegativeInteger(run[field]))
        errors.push(`${prefix}.${field} must be a nonnegative integer.`);
    }
    if (!positiveInteger(run.expectedTokenCount)) {
      errors.push(`${prefix}.expectedTokenCount must be positive.`);
    }
    if (item && run.expectedTokenCount !== item.expectedTokenCount) {
      errors.push(`${prefix}.expectedTokenCount must match the corpus ground truth token count.`);
    }
    if (
      nonnegativeInteger(run.expectedTokenCount) &&
      nonnegativeInteger(run.matchedTokenCount) &&
      nonnegativeInteger(run.outputTokenCount)
    ) {
      if (run.matchedTokenCount > Math.min(run.expectedTokenCount, run.outputTokenCount)) {
        errors.push(
          `${prefix}.matchedTokenCount cannot exceed either expectedTokenCount or outputTokenCount.`,
        );
      }
      if (
        nonnegativeInteger(run.insertedTokenCount) &&
        run.insertedTokenCount > run.outputTokenCount - run.matchedTokenCount
      ) {
        errors.push(
          `${prefix}.insertedTokenCount cannot exceed output tokens left unmatched by the alignment.`,
        );
      }
      if (nonnegativeInteger(run.sequenceEditDistance)) {
        const minimumAlignmentDistance = Math.max(
          Math.abs(run.expectedTokenCount - run.outputTokenCount),
          run.expectedTokenCount - run.matchedTokenCount,
          run.outputTokenCount - run.matchedTokenCount,
        );
        if (run.sequenceEditDistance < minimumAlignmentDistance) {
          errors.push(
            `${prefix}.sequenceEditDistance cannot be below the reconciled alignment floor ${minimumAlignmentDistance}.`,
          );
        }
        if (run.sequenceEditDistance > Math.max(run.expectedTokenCount, run.outputTokenCount)) {
          errors.push(
            `${prefix}.sequenceEditDistance cannot exceed the longer expected/output token sequence.`,
          );
        }
      }
    }
    if (
      nonnegativeInteger(run.lowConfidenceTokenCount) &&
      nonnegativeInteger(run.outputTokenCount) &&
      run.lowConfidenceTokenCount > run.outputTokenCount
    ) {
      errors.push(`${prefix}.lowConfidenceTokenCount cannot exceed outputTokenCount.`);
    }
    for (const field of [
      'editable',
      'manualRecoveryAvailable',
      'uncertaintyCuesVisible',
      'transcriptNfc',
      'readingOrderReviewed',
      'completedWithoutCrashOrHang',
    ]) {
      if (run[field] !== true) errors.push(`${prefix}.${field} must be true.`);
    }
    if (run.timedOut !== false) errors.push(`${prefix}.timedOut must be false.`);
    if (item?.labelClass === 'multilingual' && run.multilingualGlyphsPreserved !== true) {
      errors.push(`${prefix}.multilingualGlyphsPreserved must be true for multilingual labels.`);
    }
    if (item && hasRtlLanguage(item.languageTags)) {
      if (run.rtlReadingOrderPass !== true) {
        errors.push(`${prefix}.rtlReadingOrderPass must be true for RTL corpus labels.`);
      }
    } else if (run.rtlReadingOrderPass !== null) {
      errors.push(`${prefix}.rtlReadingOrderPass must be null outside the RTL corpus.`);
    }
    if (
      item &&
      capturedAt !== null &&
      positiveInteger(run.recognitionMs) &&
      positiveInteger(run.expectedTokenCount) &&
      nonnegativeInteger(run.matchedTokenCount) &&
      nonnegativeInteger(run.outputTokenCount) &&
      nonnegativeInteger(run.insertedTokenCount) &&
      nonnegativeInteger(run.sequenceEditDistance)
    ) {
      validRuns.push({ ...run, labelClass: item.labelClass });
    }
  }
  for (const deviceId of deviceIds) {
    for (const corpusItemId of corpusById.keys()) {
      const pair = `${deviceId}:${corpusItemId}`;
      if (!seenPairs.has(pair)) errors.push(`Missing physical-device OCR run for ${pair}.`);
    }
  }
  if (seenPairs.size > deviceIds.size * corpusById.size) {
    errors.push('runs contains extra device/corpus combinations.');
  }
  return { validRuns, seenPairs };
}

function validateResults(results, validRuns, deviceCount, corpusCount, thresholds, errors) {
  if (!isObject(results)) {
    errors.push('results must be an object.');
    return {};
  }
  exactKeys(
    results,
    [
      'totalRuns',
      'totalDevices',
      'totalCorpusItems',
      'classSummaries',
      'overallP95RecognitionMs',
      'allRunsCompleted',
      'thresholdDecision',
    ],
    'results',
    errors,
  );
  if (results.totalRuns !== validRuns.length) {
    errors.push(`results.totalRuns must equal the ${validRuns.length} valid raw runs.`);
  }
  if (results.totalDevices !== deviceCount) {
    errors.push(`results.totalDevices must equal ${deviceCount}.`);
  }
  if (results.totalCorpusItems !== corpusCount) {
    errors.push(`results.totalCorpusItems must equal ${corpusCount}.`);
  }
  if (results.allRunsCompleted !== true) errors.push('results.allRunsCompleted must be true.');
  if (results.thresholdDecision !== 'pass') {
    errors.push('results.thresholdDecision must be pass only after calculated thresholds pass.');
  }
  const calculated = {};
  if (!isObject(results.classSummaries)) {
    errors.push('results.classSummaries must be an object.');
  } else {
    exactKeys(results.classSummaries, NATIVE_OCR_LABEL_CLASSES, 'results.classSummaries', errors);
  }
  for (const labelClass of NATIVE_OCR_LABEL_CLASSES) {
    const classRuns = validRuns.filter((run) => run.labelClass === labelClass);
    if (classRuns.length === 0) continue;
    const summary = calculateClassSummary(classRuns);
    calculated[labelClass] = summary;
    const declared = results.classSummaries?.[labelClass];
    if (!isObject(declared)) {
      errors.push(`results.classSummaries.${labelClass} must be an object.`);
      continue;
    }
    exactKeys(
      declared,
      [
        'runCount',
        'expectedTokens',
        'matchedTokens',
        'outputTokens',
        'insertedTokens',
        'sequenceEdits',
        'tokenRecall',
        'insertedTokenRate',
        'orderedSequenceSimilarity',
        'p95RecognitionMs',
      ],
      `results.classSummaries.${labelClass}`,
      errors,
    );
    for (const field of [
      'runCount',
      'expectedTokens',
      'matchedTokens',
      'outputTokens',
      'insertedTokens',
      'sequenceEdits',
      'p95RecognitionMs',
    ]) {
      if (declared[field] !== summary[field]) {
        errors.push(
          `results.classSummaries.${labelClass}.${field} must equal the calculated value ${summary[field]}.`,
        );
      }
    }
    for (const field of ['tokenRecall', 'insertedTokenRate', 'orderedSequenceSimilarity']) {
      if (!nearlyEqual(declared[field], summary[field])) {
        errors.push(
          `results.classSummaries.${labelClass}.${field} must equal the calculated value ${summary[field]}.`,
        );
      }
    }
    if (
      isObject(thresholds?.minimumTokenRecallByClass) &&
      summary.tokenRecall < thresholds.minimumTokenRecallByClass[labelClass]
    ) {
      errors.push(
        `${labelClass} calculated token recall ${summary.tokenRecall} is below the predeclared ${thresholds.minimumTokenRecallByClass[labelClass]} threshold.`,
      );
    }
    if (
      isObject(thresholds?.maximumInsertedTokenRateByClass) &&
      summary.insertedTokenRate > thresholds.maximumInsertedTokenRateByClass[labelClass]
    ) {
      errors.push(
        `${labelClass} calculated inserted-token rate ${summary.insertedTokenRate} exceeds the predeclared ${thresholds.maximumInsertedTokenRateByClass[labelClass]} threshold.`,
      );
    }
    if (
      isObject(thresholds?.minimumOrderedSequenceSimilarityByClass) &&
      summary.orderedSequenceSimilarity <
        thresholds.minimumOrderedSequenceSimilarityByClass[labelClass]
    ) {
      errors.push(
        `${labelClass} calculated ordered-sequence similarity ${summary.orderedSequenceSimilarity} is below the predeclared ${thresholds.minimumOrderedSequenceSimilarityByClass[labelClass]} threshold.`,
      );
    }
    if (
      positiveInteger(thresholds?.maximumP95RecognitionMs) &&
      summary.p95RecognitionMs > thresholds.maximumP95RecognitionMs
    ) {
      errors.push(
        `${labelClass} calculated p95 recognition time ${summary.p95RecognitionMs} ms exceeds the predeclared ${thresholds.maximumP95RecognitionMs} ms threshold.`,
      );
    }
  }
  const overallP95 = nearestRank(
    validRuns.map((run) => run.recognitionMs),
    0.95,
  );
  if (results.overallP95RecognitionMs !== overallP95) {
    errors.push(`results.overallP95RecognitionMs must equal the calculated value ${overallP95}.`);
  }
  return calculated;
}

function validateAllTrueSection(section, prefix, fields, proofArtifactId, errors) {
  if (!isObject(section)) {
    errors.push(`${prefix} must be an object.`);
    return;
  }
  exactKeys(section, [...fields, 'proofArtifactId'], prefix, errors);
  for (const field of fields) {
    if (section[field] !== true) errors.push(`${prefix}.${field} must be true.`);
  }
  if (section.proofArtifactId !== proofArtifactId) {
    errors.push(`${prefix}.proofArtifactId must be ${proofArtifactId}.`);
  }
}

function validateGovernanceSections(evidence, deviceIds, testStartedAt, completedAt, errors) {
  const accessibility = evidence.accessibility;
  if (!isObject(accessibility)) {
    errors.push('accessibility must be an object.');
  } else {
    exactKeys(
      accessibility,
      [
        'testedDeviceIds',
        'voiceOverEditingPass',
        'statusAnnouncementsPass',
        'noFocusStealPass',
        'dynamicType200Pass',
        'minimum48PointTargetsPass',
        'noColorOnlyUncertaintyPass',
        'manualFallbackReachablePass',
        'proofArtifactId',
      ],
      'accessibility',
      errors,
    );
    const tested = Array.isArray(accessibility.testedDeviceIds)
      ? new Set(accessibility.testedDeviceIds)
      : new Set();
    if (!Array.isArray(accessibility.testedDeviceIds)) {
      errors.push('accessibility.testedDeviceIds must be an array.');
    }
    if (tested.size !== accessibility.testedDeviceIds?.length) {
      errors.push('accessibility.testedDeviceIds must not contain duplicates.');
    }
    for (const deviceId of deviceIds) {
      if (!tested.has(deviceId)) errors.push(`accessibility is missing device ${deviceId}.`);
    }
    for (const field of [
      'voiceOverEditingPass',
      'statusAnnouncementsPass',
      'noFocusStealPass',
      'dynamicType200Pass',
      'minimum48PointTargetsPass',
      'noColorOnlyUncertaintyPass',
      'manualFallbackReachablePass',
    ]) {
      if (accessibility[field] !== true) errors.push(`accessibility.${field} must be true.`);
    }
    if (accessibility.proofArtifactId !== 'accessibility_report') {
      errors.push('accessibility.proofArtifactId must be accessibility_report.');
    }
  }

  validateAllTrueSection(
    evidence.cleanup,
    'cleanup',
    [
      'cancellationDrainPass',
      'lateResultIgnoredPass',
      'temporaryPhotoRemovedAfterContinue',
      'temporaryPhotoRemovedAfterRetake',
      'temporaryPhotoRemovedAfterLeave',
      'noOrphanedManagedPhotos',
      'noOrphanedExpoCameraPhotosAfterColdRelaunch',
      'noLabelPhotoInImageCaches',
      'startupSnapshotRetryBeforeSuccessPass',
      'startupSnapshotFrozenAfterSuccessPass',
      'combinedStartupDrainCoordinationPass',
      'staleRawCaptureRemovedAfterLeaseInvalidation',
      'progressReviewRawCaptureLifecyclePass',
    ],
    'cleanup_report',
    errors,
  );

  const privacyNetwork = evidence.privacyNetwork;
  if (!isObject(privacyNetwork)) {
    errors.push('privacyNetwork must be an object.');
  } else {
    exactKeys(
      privacyNetwork,
      [
        'networkCaptureTool',
        'captureStartedAt',
        'captureEndedAt',
        'zeroOcrNetworkRequests',
        'zeroImageUploads',
        'zeroTranscriptUploads',
        'imagesRemainOnDevice',
        'transcriptsRemainOnDevice',
        'noSensitiveLogs',
        'proofArtifactId',
      ],
      'privacyNetwork',
      errors,
    );
    if (!realText(privacyNetwork.networkCaptureTool, 5)) {
      errors.push(
        'privacyNetwork.networkCaptureTool must name the physical-device capture method.',
      );
    }
    const captureStartedAt = timestamp(privacyNetwork.captureStartedAt);
    const captureEndedAt = timestamp(privacyNetwork.captureEndedAt);
    if (captureStartedAt === null) {
      errors.push('privacyNetwork.captureStartedAt must be a valid ISO timestamp.');
    }
    if (captureEndedAt === null) {
      errors.push('privacyNetwork.captureEndedAt must be a valid ISO timestamp.');
    }
    if (
      captureStartedAt !== null &&
      captureEndedAt !== null &&
      captureEndedAt <= captureStartedAt
    ) {
      errors.push('privacyNetwork.captureEndedAt must be after captureStartedAt.');
    }
    if (captureStartedAt !== null && testStartedAt !== null && captureStartedAt < testStartedAt) {
      errors.push('privacyNetwork.captureStartedAt must be inside the test window.');
    }
    if (captureEndedAt !== null && completedAt !== null && captureEndedAt > completedAt) {
      errors.push('privacyNetwork.captureEndedAt must be inside the test window.');
    }
    for (const field of [
      'zeroOcrNetworkRequests',
      'zeroImageUploads',
      'zeroTranscriptUploads',
      'imagesRemainOnDevice',
      'transcriptsRemainOnDevice',
      'noSensitiveLogs',
    ]) {
      if (privacyNetwork[field] !== true) errors.push(`privacyNetwork.${field} must be true.`);
    }
    if (privacyNetwork.proofArtifactId !== 'network_capture') {
      errors.push('privacyNetwork.proofArtifactId must be network_capture.');
    }
  }

  const provenance = evidence.provenance;
  if (!isObject(provenance)) {
    errors.push('provenance must be an object.');
  } else {
    exactKeys(
      provenance,
      [
        'reviewedAt',
        'reviewedBy',
        'allItemsHaveDocumentedRightsBasis',
        'noThirdPartyLabelImagesCommitted',
        'proofArtifactId',
      ],
      'provenance',
      errors,
    );
    const reviewedAt = timestamp(provenance.reviewedAt);
    if (reviewedAt === null) errors.push('provenance.reviewedAt must be a valid ISO timestamp.');
    if (reviewedAt !== null && completedAt !== null && reviewedAt > completedAt) {
      errors.push('provenance.reviewedAt must be before or equal to completedAt.');
    }
    if (!normalizeNamedSignoff(provenance.reviewedBy)) {
      errors.push('provenance.reviewedBy must name a real reviewer, not a placeholder.');
    }
    if (provenance.allItemsHaveDocumentedRightsBasis !== true) {
      errors.push('provenance.allItemsHaveDocumentedRightsBasis must be true.');
    }
    if (provenance.noThirdPartyLabelImagesCommitted !== true) {
      errors.push('provenance.noThirdPartyLabelImagesCommitted must be true.');
    }
    if (provenance.proofArtifactId !== 'corpus_provenance_report') {
      errors.push('provenance.proofArtifactId must be corpus_provenance_report.');
    }
  }
}

function validateArtifacts(artifacts, root, errors) {
  const validated = [];
  const seenIds = new Set();
  const seenPaths = new Set();
  const seenHashes = new Set();
  const expectedById = new Map(
    NATIVE_OCR_REQUIRED_ARTIFACTS.map((artifact) => [artifact.id, artifact]),
  );
  if (!Array.isArray(artifacts)) {
    errors.push('artifacts must be an array.');
    return validated;
  }
  for (const [index, artifact] of artifacts.entries()) {
    const prefix = `artifacts[${index}]`;
    if (!isObject(artifact)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    exactKeys(artifact, ['id', 'path', 'sha256', 'bytes', 'mediaType'], prefix, errors);
    const expected = expectedById.get(artifact.id);
    if (!expected) errors.push(`${prefix}.id is unknown: ${String(artifact.id)}.`);
    if (seenIds.has(artifact.id)) errors.push(`Duplicate artifact id: ${artifact.id}.`);
    seenIds.add(artifact.id);
    const normalizedPath = normalizedRepoEvidencePath(artifact.path);
    if (!normalizedPath) {
      errors.push(`${prefix}.path must be normalized and under ${NATIVE_OCR_EVIDENCE_ROOT}.`);
      continue;
    }
    if (seenPaths.has(normalizedPath)) errors.push(`Duplicate artifact path: ${normalizedPath}.`);
    seenPaths.add(normalizedPath);
    if (!SHA256.test(String(artifact.sha256 ?? ''))) errors.push(`${prefix}.sha256 is invalid.`);
    if (!positiveInteger(artifact.bytes) || artifact.bytes < 32) {
      errors.push(`${prefix}.bytes must be at least 32.`);
    }
    if (expected && !expected.mediaTypes.includes(artifact.mediaType)) {
      errors.push(`${prefix}.mediaType must be ${expected.mediaTypes.join(' or ')}.`);
    }
    const file = safeRegularFile(root, normalizedPath);
    if (!file) {
      errors.push(`${prefix}.path does not identify a regular non-symlink evidence file.`);
      continue;
    }
    if (file.bytes !== artifact.bytes) errors.push(`${prefix}.bytes does not match the file size.`);
    if (file.sha256.toLowerCase() !== String(artifact.sha256).toLowerCase()) {
      errors.push(`${prefix}.sha256 does not match the evidence file bytes.`);
    }
    if (seenHashes.has(file.sha256)) errors.push(`Duplicate artifact bytes: ${normalizedPath}.`);
    seenHashes.add(file.sha256);
    validated.push({ ...artifact, path: normalizedPath, sha256: file.sha256, bytes: file.bytes });
  }
  for (const { id } of NATIVE_OCR_REQUIRED_ARTIFACTS) {
    if (!seenIds.has(id)) errors.push(`Missing required artifact: ${id}.`);
  }
  return validated;
}

function validateSignoff(signoff, completedAt, errors) {
  if (!isObject(signoff)) {
    errors.push('signoff must be an object.');
    return;
  }
  exactKeys(
    signoff,
    ['decision', 'qaSignedOffBy', 'privacySignedOffBy', 'signedAt'],
    'signoff',
    errors,
  );
  if (signoff.decision !== 'pass') errors.push('signoff.decision must be pass.');
  if (!normalizeNamedSignoff(signoff.qaSignedOffBy)) {
    errors.push('signoff.qaSignedOffBy must name a real QA reviewer, not a placeholder.');
  }
  if (!normalizeNamedSignoff(signoff.privacySignedOffBy)) {
    errors.push('signoff.privacySignedOffBy must name a real privacy reviewer, not a placeholder.');
  }
  const signedAt = timestamp(signoff.signedAt);
  if (signedAt === null) errors.push('signoff.signedAt must be a valid ISO timestamp.');
  if (signedAt !== null && completedAt !== null && signedAt < completedAt) {
    errors.push('signoff.signedAt must be after or equal to completedAt.');
  }
}

export function validateNativeOcrEvidence(evidence, options = {}) {
  const errors = [];
  const warnings = [];
  const root = options.root ?? process.cwd();
  if (!isObject(evidence)) {
    return {
      errors: ['Native OCR evidence must be a JSON object.'],
      warnings,
      artifacts: [],
      summary: {
        devices: 0,
        corpusItems: 0,
        rtlCorpusItems: 0,
        runs: 0,
        requiredRuns: 0,
        labelClasses: 0,
      },
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
      'thresholds',
      'devices',
      'corpus',
      'runs',
      'results',
      'accessibility',
      'cleanup',
      'privacyNetwork',
      'provenance',
      'artifacts',
      'knownLimitations',
      'signoff',
    ],
    'evidence',
    errors,
  );
  if (evidence.schemaVersion !== NATIVE_OCR_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${NATIVE_OCR_EVIDENCE_SCHEMA_VERSION}.`);
  }
  const testStartedAt = timestamp(evidence.testStartedAt);
  const completedAt = timestamp(evidence.completedAt);
  if (testStartedAt === null) errors.push('testStartedAt must be a valid ISO timestamp.');
  if (completedAt === null) errors.push('completedAt must be a valid ISO timestamp.');
  if (testStartedAt !== null && completedAt !== null && completedAt <= testStartedAt) {
    errors.push('completedAt must be after testStartedAt.');
  }
  if (!GIT_SHA.test(String(evidence.sourceGitSha ?? ''))) {
    errors.push('sourceGitSha must be the exact 40-character source commit used by the build.');
  }
  validateSourceHashes(evidence.sourceHashes, root, errors);
  validateBuild(evidence.build, errors, options);
  validateThresholds(evidence.thresholds, testStartedAt, errors);
  const deviceIds = validateDevices(evidence.devices, errors);
  const { corpusById, rtlCorpusIds } = validateCorpus(evidence.corpus, errors);
  const { validRuns } = validateRuns(
    evidence.runs,
    deviceIds,
    corpusById,
    testStartedAt,
    completedAt,
    errors,
  );
  const calculatedClassSummaries = validateResults(
    evidence.results,
    validRuns,
    deviceIds.size,
    corpusById.size,
    evidence.thresholds,
    errors,
  );
  validateGovernanceSections(evidence, deviceIds, testStartedAt, completedAt, errors);
  const artifacts = validateArtifacts(evidence.artifacts, root, errors);
  if (!Array.isArray(evidence.knownLimitations)) {
    errors.push('knownLimitations must be an array.');
  } else {
    for (const [index, limitation] of evidence.knownLimitations.entries()) {
      if (!realText(limitation, 12))
        errors.push(`knownLimitations[${index}] must be meaningful text.`);
    }
  }
  validateSignoff(evidence.signoff, completedAt, errors);

  return {
    errors,
    warnings,
    artifacts,
    calculatedClassSummaries,
    summary: {
      devices: deviceIds.size,
      corpusItems: corpusById.size,
      rtlCorpusItems: rtlCorpusIds.size,
      runs: validRuns.length,
      requiredRuns: deviceIds.size * corpusById.size,
      labelClasses: Object.keys(calculatedClassSummaries).length,
    },
  };
}
