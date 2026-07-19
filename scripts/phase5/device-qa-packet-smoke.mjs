#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  rmdirSync,
  symlinkSync,
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
import {
  createNativeOcrEvidenceTemplate,
  NATIVE_OCR_LABEL_CLASSES,
  NATIVE_OCR_REQUIRED_SOURCE_FILES,
} from './native-ocr-evidence-contract.mjs';
import {
  CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES,
  CAMERA_LIFECYCLE_REVIEWED_CURRENT_IOS_SOURCE_URL,
  CAMERA_LIFECYCLE_REVIEWED_CURRENT_PUBLIC_IOS_VERSION,
  createCameraLifecycleEvidenceTemplate,
} from './camera-lifecycle-evidence-contract.mjs';

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
const filteredChangedPaths = changedPaths.filter((path) => !path.startsWith('.tmp/'));
for (const path of filteredChangedPaths) {
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
  mkdirSync(dirname(resolve(root, relativePath)), { recursive: true });
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

const nativeOcrEvidenceRelativeRoot = `docs/phase-5/evidence/native-ocr/device-packet-smoke-${process.pid}`;

function nearestRank(samples, percentile) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)];
}

function roundedRate(value) {
  return Number(value.toFixed(6));
}

function fillNativeOcrResults(evidence) {
  const classSummaries = {};
  for (const labelClass of NATIVE_OCR_LABEL_CLASSES) {
    const itemIds = new Set(
      evidence.corpus.filter((item) => item.labelClass === labelClass).map((item) => item.id),
    );
    const runs = evidence.runs.filter((run) => itemIds.has(run.corpusItemId));
    const expectedTokens = runs.reduce((sum, run) => sum + run.expectedTokenCount, 0);
    const matchedTokens = runs.reduce((sum, run) => sum + run.matchedTokenCount, 0);
    const outputTokens = runs.reduce((sum, run) => sum + run.outputTokenCount, 0);
    const insertedTokens = runs.reduce((sum, run) => sum + run.insertedTokenCount, 0);
    const sequenceEdits = runs.reduce((sum, run) => sum + run.sequenceEditDistance, 0);
    const sequenceTokenFloor = runs.reduce(
      (sum, run) => sum + Math.max(run.expectedTokenCount, run.outputTokenCount),
      0,
    );
    classSummaries[labelClass] = {
      runCount: runs.length,
      expectedTokens,
      matchedTokens,
      outputTokens,
      insertedTokens,
      sequenceEdits,
      tokenRecall: roundedRate(matchedTokens / expectedTokens),
      insertedTokenRate: roundedRate(insertedTokens / Math.max(1, outputTokens)),
      orderedSequenceSimilarity: roundedRate(
        Math.max(0, 1 - sequenceEdits / Math.max(1, sequenceTokenFloor)),
      ),
      p95RecognitionMs: nearestRank(
        runs.map((run) => run.recognitionMs),
        0.95,
      ),
    };
  }
  evidence.results = {
    totalRuns: evidence.runs.length,
    totalDevices: evidence.devices.length,
    totalCorpusItems: evidence.corpus.length,
    classSummaries,
    overallP95RecognitionMs: nearestRank(
      evidence.runs.map((run) => run.recognitionMs),
      0.95,
    ),
    allRunsCompleted: true,
    thresholdDecision: 'pass',
  };
}

function writeNativeOcrEvidenceFixture() {
  const evidence = createNativeOcrEvidenceTemplate();
  evidence.testStartedAt = '2026-07-18T12:00:00.000Z';
  evidence.completedAt = '2026-07-18T16:00:00.000Z';
  evidence.sourceGitSha = currentGitSha();
  evidence.sourceHashes = Object.fromEntries(
    NATIVE_OCR_REQUIRED_SOURCE_FILES.map((path) => [
      path,
      sha256(readFileSync(resolve(root, path))),
    ]),
  );
  Object.assign(evidence.build, {
    easIosBuildId: iosBuildId,
    profile: 'staging',
    appBundleIdentifier,
    appVersion: '1.0.0',
    iosBuildNumber: '42',
    archiveSha256: 'a'.repeat(64),
  });
  Object.assign(evidence.thresholds, {
    definedAt: '2026-07-18T11:00:00.000Z',
    definedBy: 'Performance Owner',
    rationale:
      'Predeclared beta thresholds balance accurate editable INCI capture with bounded physical-device latency.',
  });
  evidence.devices = [
    {
      id: 'ios-floor-device',
      physical: true,
      model: 'iPhone SE 3rd generation',
      osVersion: 'iOS 17.7',
    },
    {
      id: 'ios-current-device',
      physical: true,
      model: 'iPhone 15 Pro',
      osVersion: 'iOS 18.5',
    },
  ];
  evidence.corpus.forEach((item, index) => {
    item.languageTags =
      item.labelClass === 'multilingual'
        ? /-(?:1|2)$/.test(item.id)
          ? ['en', 'ar']
          : ['en', 'fr']
        : ['en'];
    item.rightsBasis = 'owned_physical_product';
    item.provenanceNote = `Owned physical product label documented for device packet item ${index + 1}.`;
    item.groundTruthSha256 = sha256(`reviewed-ground-truth-${item.id}`);
    item.expectedTokenCount = 20;
  });
  evidence.runs = evidence.devices.flatMap((device, deviceIndex) =>
    evidence.corpus.map((item, itemIndex) => ({
      id: `${device.id}-${item.id}`,
      deviceId: device.id,
      corpusItemId: item.id,
      capturedAt: `2026-07-18T1${2 + deviceIndex}:${String(itemIndex).padStart(2, '0')}:00.000Z`,
      recognitionMs: 900 + deviceIndex * 100 + itemIndex * 20,
      expectedTokenCount: 20,
      matchedTokenCount: item.labelClass === 'clear' ? 20 : 18,
      outputTokenCount: item.labelClass === 'clear' ? 20 : 19,
      insertedTokenCount: 0,
      sequenceEditDistance: item.labelClass === 'clear' ? 0 : 2,
      lowConfidenceTokenCount: item.labelClass === 'clear' ? 0 : 2,
      editable: true,
      manualRecoveryAvailable: true,
      uncertaintyCuesVisible: true,
      transcriptNfc: true,
      multilingualGlyphsPreserved: true,
      readingOrderReviewed: true,
      rtlReadingOrderPass: item.languageTags.some((tag) => tag === 'ar') ? true : null,
      completedWithoutCrashOrHang: true,
      timedOut: false,
    })),
  );
  fillNativeOcrResults(evidence);
  evidence.accessibility = {
    testedDeviceIds: evidence.devices.map(({ id }) => id),
    voiceOverEditingPass: true,
    statusAnnouncementsPass: true,
    noFocusStealPass: true,
    dynamicType200Pass: true,
    minimum48PointTargetsPass: true,
    noColorOnlyUncertaintyPass: true,
    manualFallbackReachablePass: true,
    proofArtifactId: 'accessibility_report',
  };
  evidence.cleanup = {
    cancellationDrainPass: true,
    lateResultIgnoredPass: true,
    temporaryPhotoRemovedAfterContinue: true,
    temporaryPhotoRemovedAfterRetake: true,
    temporaryPhotoRemovedAfterLeave: true,
    noOrphanedManagedPhotos: true,
    noOrphanedExpoCameraPhotosAfterColdRelaunch: true,
    noLabelPhotoInImageCaches: true,
    startupSnapshotRetryBeforeSuccessPass: true,
    startupSnapshotFrozenAfterSuccessPass: true,
    combinedStartupDrainCoordinationPass: true,
    staleRawCaptureRemovedAfterLeaseInvalidation: true,
    progressReviewRawCaptureLifecyclePass: true,
    proofArtifactId: 'cleanup_report',
  };
  evidence.privacyNetwork = {
    networkCaptureTool: 'Proxyman physical iPhone capture',
    captureStartedAt: '2026-07-18T12:00:00.000Z',
    captureEndedAt: '2026-07-18T15:30:00.000Z',
    zeroOcrNetworkRequests: true,
    zeroImageUploads: true,
    zeroTranscriptUploads: true,
    imagesRemainOnDevice: true,
    transcriptsRemainOnDevice: true,
    noSensitiveLogs: true,
    proofArtifactId: 'network_capture',
  };
  evidence.provenance = {
    reviewedAt: '2026-07-18T15:45:00.000Z',
    reviewedBy: 'Corpus Rights Reviewer',
    allItemsHaveDocumentedRightsBasis: true,
    noThirdPartyLabelImagesCommitted: true,
    proofArtifactId: 'corpus_provenance_report',
  };
  evidence.artifacts = [
    ['eas_build_log', 'text/plain'],
    ['archive_inspection', 'application/json'],
    ['raw_run_export', 'application/json'],
    ['network_capture', 'text/plain'],
    ['accessibility_report', 'application/json'],
    ['cleanup_report', 'text/plain'],
    ['corpus_provenance_report', 'application/json'],
  ].map(([id, mediaType]) => {
    const path = `${nativeOcrEvidenceRelativeRoot}/${id}.${mediaType === 'application/json' ? 'json' : 'txt'}`;
    const attached =
      mediaType === 'application/json'
        ? jsonArtifact(path, {
            id,
            sourceGitSha: evidence.sourceGitSha,
            easIosBuildId: iosBuildId,
            proof: `${id} physical-device proof`,
          })
        : textArtifact(path, `${id} physical-device proof for ${iosBuildId}`);
    return { id, ...attached, bytes: readFileSync(resolve(root, path)).length };
  });
  evidence.knownLimitations = [
    'Vision confidence is not a calibrated probability; every transcript remains editable.',
  ];
  evidence.signoff = {
    decision: 'pass',
    qaSignedOffBy: 'Physical Device Reviewer',
    privacySignedOffBy: 'Privacy Evidence Reviewer',
    signedAt: '2026-07-18T17:00:00.000Z',
  };
  const relativePath = `${nativeOcrEvidenceRelativeRoot}/evidence.json`;
  writeFileSync(resolve(root, relativePath), `${JSON.stringify(evidence, null, 2)}\n`);
  return relativePath;
}

const nativeOcrEvidencePath = writeNativeOcrEvidenceFixture();

const cameraEvidenceRelativeRoot = `docs/phase-5/evidence/camera-lifecycle/device-packet-smoke-${process.pid}`;

function cameraSourceKindsForScenario(scenarioId) {
  if (scenarioId === 'offline') {
    return ['screen_recording', 'structured_device_log', 'network_trace'];
  }
  if (scenarioId === 'accessibility') return ['accessibility_recording'];
  if (scenarioId === 'privacy') {
    return ['screen_recording', 'structured_device_log', 'network_trace', 'filesystem_inspection'];
  }
  return ['screen_recording', 'structured_device_log'];
}

function writeCameraLifecycleEvidenceFixture() {
  const evidence = createCameraLifecycleEvidenceTemplate();
  const testStartedAt = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const completedAt = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  const installedAt = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
  evidence.testStartedAt = testStartedAt;
  evidence.completedAt = completedAt;
  evidence.sourceGitSha = currentGitSha();
  evidence.sourceHashes = Object.fromEntries(
    CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES.map((path) => [
      path,
      sha256(readFileSync(resolve(root, path))),
    ]),
  );
  Object.assign(evidence.build, {
    easIosBuildId: iosBuildId,
    profile: 'staging',
    appBundleIdentifier,
    appVersion: '1.0.0',
    iosBuildNumber: '42',
    displayName: 'RoutineKind Staging',
    archiveSha256: '9'.repeat(64),
    xcodeVersion: 'Xcode 26.4 (17E202)',
    iosSdkVersion: 'iOS 26.4',
  });
  evidence.signedArchive = {
    applicationIdentifier: `${appleTeamId}.${appBundleIdentifier}`,
    bundleIdentifier: appBundleIdentifier,
    teamIdentifier: appleTeamId,
    provisioningProfileUuid: '3F2504E0-4F89-41D3-9A0C-0305E82C3301',
    signingCertificateSha256: '8'.repeat(64),
    executableSha256: '7'.repeat(64),
    codeSignatureValid: true,
    finalInfoPlist: {
      bundleIdentifier: appBundleIdentifier,
      displayName: 'RoutineKind Staging',
      appVersion: '1.0.0',
      iosBuildNumber: '42',
      cameraUsageDescription:
        'Allow RoutineKind Staging to use the camera to scan product barcodes, capture ingredient labels, and take guided progress photos. Barcode frames are processed on your device; label and progress photos remain local.',
      cameraUsageDescriptionOccurrenceCount: 1,
      unresolvedBuildVariablesAbsent: true,
    },
  };
  evidence.devicePolicy = {
    reviewedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    reviewedBy: 'Jordan Lee',
    minimumIosVersion: '17.0',
    currentPublicIosVersion: CAMERA_LIFECYCLE_REVIEWED_CURRENT_PUBLIC_IOS_VERSION,
    currentIosReleaseSourceUrl: CAMERA_LIFECYCLE_REVIEWED_CURRENT_IOS_SOURCE_URL,
    supportedFloorDeviceId: 'ios-floor-device',
    currentFlagshipDeviceId: 'ios-current-device',
  };
  evidence.devices = [
    {
      id: 'ios-floor-device',
      role: 'supported_floor_class',
      physical: true,
      model: 'iPhone SE 3rd generation',
      hardwareModelIdentifier: 'iPhone14,6',
      osVersion: 'iOS 17.7',
      osBuild: '21H221',
      identifierSha256: '6'.repeat(64),
      viewportWidthPoints: 375,
      freshInstall: true,
      installedBundleIdentifier: appBundleIdentifier,
      installedAppVersion: '1.0.0',
      installedIosBuildNumber: '42',
      installedArchiveSha256: evidence.build.archiveSha256,
      installedAt,
      installationMethod: 'eas_internal_distribution',
      installationReceiptArtifactId: 'install_receipt-ios-floor-device',
      inAppIdentityVerified: true,
    },
    {
      id: 'ios-current-device',
      role: 'current_flagship',
      physical: true,
      model: 'iPhone 17 Pro',
      hardwareModelIdentifier: 'iPhone18,1',
      osVersion: CAMERA_LIFECYCLE_REVIEWED_CURRENT_PUBLIC_IOS_VERSION,
      osBuild: '23F5050',
      identifierSha256: '5'.repeat(64),
      viewportWidthPoints: 393,
      freshInstall: true,
      installedBundleIdentifier: appBundleIdentifier,
      installedAppVersion: '1.0.0',
      installedIosBuildNumber: '42',
      installedArchiveSha256: evidence.build.archiveSha256,
      installedAt,
      installationMethod: 'eas_internal_distribution',
      installationReceiptArtifactId: 'install_receipt-ios-current-device',
      inAppIdentityVerified: true,
    },
  ];
  evidence.runs = createCameraLifecycleEvidenceTemplate().runs.map((run, index) => ({
    ...run,
    startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000 + index * 60_000).toISOString(),
    completedAt: new Date(Date.now() - 3 * 60 * 60 * 1000 + index * 60_000 + 30_000).toISOString(),
    result: 'pass',
    observations: Object.fromEntries(Object.keys(run.observations).map((key) => [key, true])),
    notes: null,
  }));

  const binding = {
    sourceGitSha: evidence.sourceGitSha,
    easIosBuildId: iosBuildId,
    archiveSha256: evidence.build.archiveSha256,
    appBundleIdentifier,
    appVersion: '1.0.0',
    iosBuildNumber: '42',
  };
  const cameraReport = (reportType, claims) => ({
    schemaVersion: 1,
    reportType,
    capturedAt,
    binding,
    claims,
  });
  const privacy = () => ({
    classification: 'synthetic_or_redacted_non_sensitive',
    containsUserPhotoPixels: false,
    containsLabelPhotoPixels: false,
    containsRawBarcode: false,
    containsRawTranscript: false,
    containsRawDeviceIdentifier: false,
    containsAbsoluteLocalPath: false,
    reviewedBy: 'Alex Morgan',
    reviewedAt: capturedAt,
  });
  const deviceIds = evidence.devices.map(({ id }) => id).sort();
  const routeIds = ['progress_capture', 'shelf_ocr', 'shelf_scan'];
  const offlineRunIds = evidence.runs
    .filter(({ scenarioId }) => scenarioId === 'offline')
    .map(({ id }) => id)
    .sort();
  const privacyRunIds = evidence.runs
    .filter(({ scenarioId }) => scenarioId === 'privacy')
    .map(({ id }) => id)
    .sort();
  const accessibilityRunIds = evidence.runs
    .filter(({ scenarioId }) => scenarioId === 'accessibility')
    .map(({ id }) => id)
    .sort();
  const artifactIds = createCameraLifecycleEvidenceTemplate()
    .artifacts.map(({ id }) => id)
    .sort();
  const claimsById = {
    archive_identity_report: {
      applicationIdentifier: evidence.signedArchive.applicationIdentifier,
      bundleIdentifier: appBundleIdentifier,
      teamIdentifier: appleTeamId,
      provisioningProfileUuid: evidence.signedArchive.provisioningProfileUuid,
      signingCertificateSha256: evidence.signedArchive.signingCertificateSha256,
      executableSha256: evidence.signedArchive.executableSha256,
      codeSignatureVerifyExitCode: 0,
      embeddedProvisioningProfilePresent: true,
      extractedFromSignedArchive: true,
    },
    final_info_plist_report: {
      extractedFromSignedArchive: true,
      infoPlistRelativePath:
        'RoutineKind.xcarchive/Products/Applications/RoutineKind.app/Info.plist',
      finalInfoPlist: evidence.signedArchive.finalInfoPlist,
    },
    device_inventory_report: {
      devices: evidence.devices,
      allPhysical: true,
      installedCandidateMatched: true,
    },
    network_privacy_report: {
      captureTool: { name: 'Proxyman', version: '5.17.0', mode: 'physical_device_proxy' },
      captureStartedAt: testStartedAt,
      captureEndedAt: completedAt,
      deviceIds,
      routeIds,
      offlineRunIds,
      zeroBarcodeFrameUploads: true,
      zeroLabelPhotoUploads: true,
      zeroProgressPhotoUploads: true,
      zeroTranscriptUploads: true,
      zeroUnexpectedCameraNetworkRequests: true,
      noRawBarcodeOrSensitiveCameraLogs: true,
    },
    privacy_cleanup_report: {
      artifactIds,
      deviceIds,
      privacyRunIds,
      managedLabelPhotoCleanupPass: true,
      expoCameraStartupCleanupPass: true,
      imageCacheDigestAbsencePass: true,
      progressRawCaptureCleanupPass: true,
      leaveRetakeSaveCleanupPass: true,
      lateCaptureCleanupPass: true,
      cleanupFailureRetryPass: true,
      noUserPhotoBytesCommittedToGit: true,
      allArtifactsReviewed: true,
      allArtifactsSyntheticOrRedacted: true,
      noUserPhotoPixels: true,
      noLabelPhotoPixels: true,
      noRawBarcodes: true,
      noRawTranscripts: true,
      noRawDeviceIdentifiers: true,
      noAbsoluteLocalPaths: true,
    },
    accessibility_report: {
      deviceIds,
      routeIds,
      accessibilityRunIds,
      voiceOverPass: true,
      dynamicTypeTwoHundredPercentPass: true,
      minimumFortyFourPointTargetsPass: true,
      reduceMotionPass: true,
      noColorOnlyPass: true,
    },
    scenario_index: {
      runIds: evidence.runs.map(({ id }) => id).sort(),
      proofArtifactIds: evidence.runs.flatMap(({ proofArtifactIds }) => proofArtifactIds).sort(),
      noOmittedOrDuplicateRuns: true,
    },
  };

  const attach = (id, attached) => ({
    id,
    ...attached,
    bytes: readFileSync(resolve(root, attached.path)).length,
    privacy: privacy(),
  });
  evidence.artifacts = [
    attach(
      'eas_build_log',
      textArtifact(
        `${cameraEvidenceRelativeRoot}/eas-build-log.txt`,
        [
          'ROUTINEKIND_CAMERA_BUILD_BINDING_V1',
          `sourceGitSha=${evidence.sourceGitSha}`,
          `easIosBuildId=${iosBuildId}`,
          'profile=staging',
          'resolvedBuildImage=macos-tahoe-26.4-xcode-26.4',
          'easCliVersion=21.0.1',
          'xcodeVersion=Xcode 26.4 (17E202)',
          'iosSdkVersion=iOS 26.4',
          `appBundleIdentifier=${appBundleIdentifier}`,
          'appVersion=1.0.0',
          'iosBuildNumber=42',
          `archiveSha256=${evidence.build.archiveSha256}`,
        ].join('\n'),
      ),
    ),
    ...Object.entries(claimsById).map(([id, claims]) =>
      attach(
        id,
        jsonArtifact(`${cameraEvidenceRelativeRoot}/${id}.json`, cameraReport(id, claims)),
      ),
    ),
    ...evidence.devices.map((device) => {
      const id = `install_receipt-${device.id}`;
      return attach(
        id,
        jsonArtifact(
          `${cameraEvidenceRelativeRoot}/${id}.json`,
          cameraReport('installation_receipt', {
            artifactId: id,
            deviceId: device.id,
            deviceIdentifierSha256: device.identifierSha256,
            installedAt: device.installedAt,
            installationMethod: device.installationMethod,
            archiveSha256: evidence.build.archiveSha256,
            appBundleIdentifier,
            appVersion: '1.0.0',
            iosBuildNumber: '42',
            inAppIdentityVerified: true,
          }),
        ),
      );
    }),
    ...evidence.runs.map((run) => {
      const id = run.proofArtifactIds[0];
      return attach(
        id,
        jsonArtifact(
          `${cameraEvidenceRelativeRoot}/${id}.json`,
          cameraReport('camera_scenario_proof', {
            artifactId: id,
            run,
            sourceEvidence: cameraSourceKindsForScenario(run.scenarioId).map((kind) => ({
              kind,
              sha256: sha256(`access-controlled-camera-source-${id}-${kind}`),
              reference: `cat06/${run.deviceId}/${run.route}/${run.scenarioId}/${kind}`,
              reviewedBy: 'Taylor Rivera',
              reviewedAt: capturedAt,
            })),
          }),
        ),
      );
    }),
  ];
  evidence.knownLimitations = [];
  evidence.signoff = {
    decision: 'pass',
    qaSignedOffBy: 'Morgan Patel',
    privacySecuritySignedOffBy: 'Casey Nguyen',
    accessibilitySignedOffBy: 'Riley Thompson',
    signedAt,
  };
  const relativePath = `${cameraEvidenceRelativeRoot}/evidence.json`;
  writeFileSync(resolve(root, relativePath), `${JSON.stringify(evidence, null, 2)}\n`);
  return relativePath;
}

const cameraLifecycleEvidencePath = writeCameraLifecycleEvidenceFixture();

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
  PHASE5_IOS_BUILD_PROFILE: 'staging',
  PHASE5_ANDROID_BUILD_ID:
    'https://expo.dev/accounts/routinekind/projects/mobile/builds/7a4d74ae-2acd-4af5-931f-b768565bcd64',
  PHASE5_IOS_DEVICE: 'iPhone 17 Pro / iOS 26.5.2',
  PHASE5_ANDROID_DEVICE: 'Pixel 8 / Android 15',
  PHASE5_QA_SIGNOFF: 'true',
  PHASE5_SIGNED_OFF_BY: 'Tas Mohammed',
  APP_IOS_BUNDLE_IDENTIFIER: appBundleIdentifier,
  APPLE_TEAM_ID: appleTeamId,
  PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH: widgetEvidencePath,
  PHASE5_NATIVE_OCR_EVIDENCE_PATH: nativeOcrEvidencePath,
  PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH: cameraLifecycleEvidencePath,
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

function runWithCameraEvidenceJunctionEscape() {
  const outside = mkdtempSync(join(tmpdir(), 'routinekind-camera-packet-outside-'));
  const linkRelative = `docs/phase-5/evidence/camera-lifecycle/packet-escape-${process.pid}`;
  const link = resolve(root, linkRelative);
  copyFileSync(resolve(root, cameraLifecycleEvidencePath), resolve(outside, 'evidence.json'));
  let created = false;
  try {
    symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    created = true;
    return run({ PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH: `${linkRelative}/evidence.json` });
  } catch (error) {
    return {
      indirectionUnsupported: ['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error?.code),
      status: null,
      stdout: '',
      stderr: '',
    };
  } finally {
    if (created) {
      try {
        rmdirSync(link);
      } catch {
        // The case assertion covers a supported indirection that was not rejected.
      }
    }
    rmSync(outside, { recursive: true, force: true });
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
    name: 'strict Phase 5 QA packet rejects Boolean-only native OCR clearance',
    result: run({
      EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'true',
      PHASE5_NATIVE_OCR_EVIDENCE_PATH: '',
      PHASE5_NATIVE_OCR_QA_PASS: 'true',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE5_NATIVE_OCR_EVIDENCE_PATH; a Boolean pass flag cannot substitute/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet accepts validated native OCR evidence when OCR is enabled',
    result: run({ EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'true' }),
    expect(result) {
      if (result.status !== 0 || /^FAIL /m.test(output(result))) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.nativeOcr.enabledInAnyBuild === true &&
        packet.nativeOcr.qaRequired === true &&
        packet.nativeOcr.evidence.status === 'pass' &&
        packet.nativeOcr.evidence.summary.devices === 2 &&
        packet.nativeOcr.evidence.summary.corpusItems === 25 &&
        packet.nativeOcr.evidence.summary.rtlCorpusItems === 2 &&
        packet.nativeOcr.evidence.summary.runs === 50 &&
        packet.nativeOcr.evidence.artifacts.length === 7
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects Boolean-only CAT-06 camera clearance',
    result: run({
      PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH: '',
      PHASE5_CAMERA_PERMISSION_QA_PASS: 'true',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH; camera QA Booleans cannot substitute/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet accepts validated CAT-06 camera lifecycle evidence',
    result: run({}),
    expect(result) {
      if (result.status !== 0 || /^FAIL /m.test(output(result))) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.cameraLifecycleEvidence.required === true &&
        packet.cameraLifecycleEvidence.status === 'pass' &&
        packet.cameraLifecycleEvidence.summary.devices === 2 &&
        packet.cameraLifecycleEvidence.summary.routes === 3 &&
        packet.cameraLifecycleEvidence.summary.scenarioDefinitions === 27 &&
        packet.cameraLifecycleEvidence.summary.runs === 54 &&
        packet.cameraLifecycleEvidence.summary.requiredRuns === 54 &&
        packet.cameraLifecycleEvidence.summary.proofArtifacts === 54 &&
        packet.cameraLifecycleEvidence.summary.artifacts === 64 &&
        packet.cameraLifecycleEvidence.artifacts.length === 64
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects CAT-06 evidence through a junction escape',
    result: runWithCameraEvidenceJunctionEscape(),
    expect(result) {
      return (
        result.indirectionUnsupported === true ||
        (result.status === 1 &&
          /Camera lifecycle evidence file is missing, oversized, indirect, unreadable, or outside/.test(
            output(result),
          ))
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects and does not echo a secret-bearing EAS URL',
    result: run({
      PHASE5_IOS_BUILD_ID: `https://expo.dev/accounts/routinekind/projects/mobile/builds/${iosBuildId}?token=packet-secret-value`,
    }),
    expect(result) {
      const text = output(result);
      const packetText = existsSync(join(result.outDir, 'device-qa-packet.json'))
        ? readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8')
        : '';
      return (
        result.status === 1 &&
        /strict expo\.dev build URL without credentials, port, query, or fragment/.test(text) &&
        !text.includes('packet-secret-value') &&
        !packetText.includes('packet-secret-value')
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects placeholder iOS build evidence',
    result: run({ PHASE5_IOS_BUILD_ID: 'pending-ios-build' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_IOS_BUILD_ID must be a canonical EAS UUID or strict expo\.dev build URL/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet requires the exact iOS build profile',
    result: run({ PHASE5_IOS_BUILD_PROFILE: '' }),
    expect(result) {
      return result.status === 1 && /Missing PHASE5_IOS_BUILD_PROFILE/.test(output(result));
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
        packet.buildEvidence.iosBuildProfile === 'staging' &&
        packet.widgetLifecycleEvidence.status === 'pass' &&
        packet.widgetLifecycleEvidence.summary.artifactCount === 15 &&
        packet.widgetLifecycleEvidence.summary.baseArtifactCount === 11 &&
        packet.widgetLifecycleEvidence.summary.proofAttachmentCount === 4 &&
        packet.widgetLifecycleEvidence.summary.scenarioCount === 4 &&
        /^[0-9a-f]{64}$/i.test(packet.widgetLifecycleEvidence.sha256) &&
        packet.nativeOcr.evidence.status === 'pass' &&
        packet.nativeOcr.evidence.summary.runs === 50 &&
        packet.nativeOcr.evidence.artifacts.length === 7 &&
        /^[0-9a-f]{64}$/i.test(packet.nativeOcr.evidence.sha256) &&
        packet.cameraLifecycleEvidence.status === 'pass' &&
        packet.cameraLifecycleEvidence.summary.runs === 54 &&
        packet.cameraLifecycleEvidence.summary.artifacts === 64 &&
        /^[0-9a-f]{64}$/i.test(packet.cameraLifecycleEvidence.sha256) &&
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
        packet.files.some(
          (file) => file.path === 'scripts/phase5/native-ocr-evidence-contract.mjs',
        ) &&
        packet.files.some((file) => file.path === 'scripts/phase5/check-native-ocr-evidence.mjs') &&
        packet.files.some(
          (file) => file.path === 'docs/phase-5/native-ocr-evidence.template.json',
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
          ...NATIVE_OCR_REQUIRED_SOURCE_FILES,
          ...CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES,
          'scripts/cat05/native-label-ocr-source-contract.test.mjs',
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
          'Phase 5 device QA packet generated with a dirty Git worktree outside its generated output and validated widget/OCR/camera evidence; do not use it as final native-device evidence.',
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
          'Phase 5 device QA packet generated with a dirty Git worktree outside its generated output and validated widget/OCR/camera evidence; do not use it as final native-device evidence.',
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
