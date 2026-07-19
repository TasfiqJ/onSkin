#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import {
  CAMERA_LIFECYCLE_ARTIFACT_BYTE_CEILINGS,
  CAMERA_LIFECYCLE_EVIDENCE_MAX_AGE_MS,
  CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES,
  CAMERA_LIFECYCLE_REVIEWED_CURRENT_IOS_SOURCE_URL,
  CAMERA_LIFECYCLE_REVIEWED_CURRENT_PUBLIC_IOS_VERSION,
  CAMERA_LIFECYCLE_TOTAL_ARTIFACT_BYTES_MAX,
  createCameraLifecycleEvidenceTemplate,
  normalizeCameraLifecycleEasBuildId,
  normalizeCameraLifecycleEvidencePath,
  normalizeCameraLifecycleTemplatePath,
  readCameraLifecycleContainedFile,
  validateCameraLifecycleEvidence,
} from './camera-lifecycle-evidence-contract.mjs';

const root = mkdtempSync(join(tmpdir(), 'routinekind-camera-lifecycle-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function write(relativePath, bytes) {
  const absolutePath = resolve(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, bytes);
  return {
    path: relativePath,
    sha256: sha256(bytes),
    bytes: bytes.length,
  };
}

for (const path of CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES) {
  write(path, Buffer.from(`camera lifecycle source fixture: ${path}\n`.padEnd(96, '.'), 'utf8'));
}

const evidenceRoot = 'docs/phase-5/evidence/camera-lifecycle/smoke';
const sourceGitSha = '1'.repeat(40);
const easIosBuildId = '9f7b48e1-7a52-4efb-9d93-3e93a2bf13e5';
const archiveSha256 = 'a'.repeat(64);
const appBundleIdentifier = 'com.routinekind.staging';
const appVersion = '1.0.0';
const iosBuildNumber = '42';
const executableSha256 = 'c'.repeat(64);
const fixtureNow = Date.parse('2026-07-18T20:00:00.000Z');

function binding() {
  return {
    sourceGitSha,
    easIosBuildId,
    archiveSha256,
    appBundleIdentifier,
    appVersion,
    iosBuildNumber,
  };
}

function report(reportType, claims) {
  return {
    schemaVersion: 1,
    reportType,
    capturedAt: '2026-07-18T17:00:00.000Z',
    binding: binding(),
    claims,
  };
}

function privacy() {
  return {
    classification: 'synthetic_or_redacted_non_sensitive',
    containsUserPhotoPixels: false,
    containsLabelPhotoPixels: false,
    containsRawBarcode: false,
    containsRawTranscript: false,
    containsRawDeviceIdentifier: false,
    containsAbsoluteLocalPath: false,
    reviewedBy: 'Alex Morgan',
    reviewedAt: '2026-07-18T17:45:00.000Z',
  };
}

function sourceKindsForScenario(scenarioId) {
  if (scenarioId === 'offline') {
    return ['screen_recording', 'structured_device_log', 'network_trace'];
  }
  if (scenarioId === 'accessibility') return ['accessibility_recording'];
  if (scenarioId === 'privacy') {
    return ['screen_recording', 'structured_device_log', 'network_trace', 'filesystem_inspection'];
  }
  return ['screen_recording', 'structured_device_log'];
}

function createValidFixture() {
  const evidence = createCameraLifecycleEvidenceTemplate();
  evidence.testStartedAt = '2026-07-18T12:00:00.000Z';
  evidence.completedAt = '2026-07-18T18:00:00.000Z';
  evidence.sourceGitSha = sourceGitSha;
  evidence.sourceHashes = Object.fromEntries(
    CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES.map((path) => [
      path,
      sha256(readFileSync(resolve(root, path))),
    ]),
  );
  Object.assign(evidence.build, {
    easIosBuildId,
    profile: 'staging',
    appBundleIdentifier,
    appVersion,
    iosBuildNumber,
    displayName: 'RoutineKind Staging',
    archiveSha256,
    xcodeVersion: 'Xcode 26.4 (17E202)',
    iosSdkVersion: 'iOS 26.4',
  });
  evidence.signedArchive = {
    applicationIdentifier: `ABCDE12345.${appBundleIdentifier}`,
    bundleIdentifier: appBundleIdentifier,
    teamIdentifier: 'ABCDE12345',
    provisioningProfileUuid: '3F2504E0-4F89-41D3-9A0C-0305E82C3301',
    signingCertificateSha256: 'b'.repeat(64),
    executableSha256,
    codeSignatureValid: true,
    finalInfoPlist: {
      bundleIdentifier: appBundleIdentifier,
      displayName: 'RoutineKind Staging',
      appVersion,
      iosBuildNumber,
      cameraUsageDescription:
        'Allow RoutineKind Staging to use the camera to scan product barcodes, capture ingredient labels, and take guided progress photos. Barcode frames are processed on your device; label and progress photos remain local.',
      cameraUsageDescriptionOccurrenceCount: 1,
      unresolvedBuildVariablesAbsent: true,
    },
  };
  evidence.devicePolicy = {
    reviewedAt: '2026-07-18T11:00:00.000Z',
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
      identifierSha256: 'd'.repeat(64),
      viewportWidthPoints: 375,
      freshInstall: true,
      installedBundleIdentifier: appBundleIdentifier,
      installedAppVersion: appVersion,
      installedIosBuildNumber: iosBuildNumber,
      installedArchiveSha256: archiveSha256,
      installedAt: '2026-07-18T11:30:00.000Z',
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
      identifierSha256: 'e'.repeat(64),
      viewportWidthPoints: 402,
      freshInstall: true,
      installedBundleIdentifier: appBundleIdentifier,
      installedAppVersion: appVersion,
      installedIosBuildNumber: iosBuildNumber,
      installedArchiveSha256: archiveSha256,
      installedAt: '2026-07-18T11:40:00.000Z',
      installationMethod: 'eas_internal_distribution',
      installationReceiptArtifactId: 'install_receipt-ios-current-device',
      inAppIdentityVerified: true,
    },
  ];
  evidence.runs = createCameraLifecycleEvidenceTemplate().runs.map((run, index) => ({
    ...run,
    startedAt: `2026-07-18T${String(12 + Math.floor(index / 18)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00.000Z`,
    completedAt: `2026-07-18T${String(12 + Math.floor(index / 18)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:30.000Z`,
    result: 'pass',
    observations: Object.fromEntries(Object.keys(run.observations).map((key) => [key, true])),
    notes: null,
  }));

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

  const reportClaims = {
    archive_identity_report: {
      applicationIdentifier: evidence.signedArchive.applicationIdentifier,
      bundleIdentifier: evidence.signedArchive.bundleIdentifier,
      teamIdentifier: evidence.signedArchive.teamIdentifier,
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
      captureStartedAt: '2026-07-18T12:00:00.000Z',
      captureEndedAt: '2026-07-18T18:00:00.000Z',
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

  evidence.artifacts = [];
  const buildLog = write(
    `${evidenceRoot}/eas-build-log.txt`,
    Buffer.from(
      [
        'ROUTINEKIND_CAMERA_BUILD_BINDING_V1',
        `sourceGitSha=${sourceGitSha}`,
        `easIosBuildId=${easIosBuildId}`,
        'profile=staging',
        'resolvedBuildImage=macos-tahoe-26.4-xcode-26.4',
        'easCliVersion=21.0.1',
        'xcodeVersion=Xcode 26.4 (17E202)',
        'iosSdkVersion=iOS 26.4',
        `appBundleIdentifier=${appBundleIdentifier}`,
        `appVersion=${appVersion}`,
        `iosBuildNumber=${iosBuildNumber}`,
        `archiveSha256=${archiveSha256}`,
        '',
      ].join('\n'),
      'utf8',
    ),
  );
  evidence.artifacts.push({
    id: 'eas_build_log',
    ...buildLog,
    mediaType: 'text/plain',
    privacy: privacy(),
  });
  for (const [id, claims] of Object.entries(reportClaims)) {
    const bytes = Buffer.from(`${JSON.stringify(report(id, claims), null, 2)}\n`, 'utf8');
    const attached = write(`${evidenceRoot}/${id}.json`, bytes);
    evidence.artifacts.push({
      id,
      ...attached,
      mediaType: 'application/json',
      privacy: privacy(),
    });
  }
  for (const device of evidence.devices) {
    const id = `install_receipt-${device.id}`;
    const receipt = report('installation_receipt', {
      artifactId: id,
      deviceId: device.id,
      deviceIdentifierSha256: device.identifierSha256,
      installedAt: device.installedAt,
      installationMethod: device.installationMethod,
      archiveSha256,
      appBundleIdentifier,
      appVersion,
      iosBuildNumber,
      inAppIdentityVerified: true,
    });
    const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    const attached = write(`${evidenceRoot}/${id}.json`, bytes);
    evidence.artifacts.push({
      id,
      ...attached,
      mediaType: 'application/json',
      privacy: privacy(),
    });
  }
  for (const run of evidence.runs) {
    const id = run.proofArtifactIds[0];
    const bytes = Buffer.from(
      `${JSON.stringify(
        report('camera_scenario_proof', {
          artifactId: id,
          run,
          sourceEvidence: sourceKindsForScenario(run.scenarioId).map((kind) => ({
            kind,
            sha256: sha256(`access-controlled-source-${id}-${kind}`),
            reference: `cat06/${run.deviceId}/${run.route}/${run.scenarioId}/${kind}`,
            reviewedBy: 'Taylor Rivera',
            reviewedAt: '2026-07-18T17:30:00.000Z',
          })),
        }),
        null,
        2,
      )}\n`,
      'utf8',
    );
    const attached = write(`${evidenceRoot}/${id}.json`, bytes);
    evidence.artifacts.push({
      id,
      ...attached,
      mediaType: 'application/json',
      privacy: privacy(),
    });
  }
  evidence.knownLimitations = [];
  evidence.signoff = {
    decision: 'pass',
    qaSignedOffBy: 'Morgan Patel',
    privacySecuritySignedOffBy: 'Casey Nguyen',
    accessibilitySignedOffBy: 'Riley Thompson',
    signedAt: '2026-07-18T19:00:00.000Z',
  };
  return evidence;
}

const validEvidence = createValidFixture();

function validate(evidence, overrides = {}) {
  return validateCameraLifecycleEvidence(evidence, {
    root,
    currentGitSha: sourceGitSha,
    sourceGitShaIsAncestor: true,
    changedPathsSinceSource: [],
    evidencePath: `${evidenceRoot}/evidence.json`,
    expectedBuildId: easIosBuildId,
    expectedBuildProfile: 'staging',
    now: fixtureNow,
    ...overrides,
  });
}

function clone() {
  return structuredClone(validEvidence);
}

function replaceJsonArtifact(evidence, id, suffix, mutate) {
  const artifact = evidence.artifacts.find((candidate) => candidate.id === id);
  const value = JSON.parse(readFileSync(resolve(root, artifact.path), 'utf8'));
  mutate(value);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  Object.assign(artifact, write(`${evidenceRoot}/${id}-${suffix}.json`, bytes));
}

const cases = [
  {
    name: 'accepts a complete exact-build two-iPhone camera lifecycle matrix',
    run() {
      const result = validate(clone());
      return (
        result.errors.length === 0 &&
        result.summary.devices === 2 &&
        result.summary.routes === 3 &&
        result.summary.runs === 54 &&
        result.summary.requiredRuns === 54 &&
        result.summary.proofArtifacts === 54 &&
        result.summary.artifacts === 64
      );
    },
  },
  {
    name: 'rejects an omitted route-scenario-device run',
    run() {
      const evidence = clone();
      evidence.runs.pop();
      return validate(evidence).errors.some((error) =>
        /Missing required device-route-scenario/.test(error),
      );
    },
  },
  {
    name: 'rejects a typed pass with a false required observation',
    run() {
      const evidence = clone();
      const field = Object.keys(evidence.runs[0].observations)[0];
      evidence.runs[0].observations[field] = false;
      return validate(evidence).errors.some((error) =>
        error.includes(`observations.${field} must be true`),
      );
    },
  },
  {
    name: 'rejects a simulator in the physical-device matrix',
    run() {
      const evidence = clone();
      evidence.devices[0].model = 'iPhone Simulator';
      return validate(evidence).errors.some((error) => /real physical iPhone model/.test(error));
    },
  },
  {
    name: 'rejects a floor phone that is not on iOS 17',
    run() {
      const evidence = clone();
      evidence.devices[0].osVersion = 'iOS 18.0';
      return validate(evidence).errors.some((error) =>
        /supported-floor device must run an iOS 17/.test(error),
      );
    },
  },
  {
    name: 'rejects final Info.plist camera purpose-copy drift',
    run() {
      const evidence = clone();
      evidence.signedArchive.finalInfoPlist.cameraUsageDescription = 'Camera access is needed.';
      return validate(evidence).errors.some((error) => /exact reviewed purpose string/.test(error));
    },
  },
  {
    name: 'rejects a source hash that does not bind current runtime bytes',
    run() {
      const evidence = clone();
      evidence.sourceHashes[CAMERA_LIFECYCLE_REQUIRED_SOURCE_FILES[0]] = 'f'.repeat(64);
      return validate(evidence).errors.some((error) =>
        /does not match the exact source file bytes/.test(error),
      );
    },
  },
  {
    name: 'rejects artifact hash tampering',
    run() {
      const evidence = clone();
      evidence.artifacts[0].sha256 = 'f'.repeat(64);
      return validate(evidence).errors.some((error) => /sha256 does not match/.test(error));
    },
  },
  {
    name: 'rejects artifact path traversal',
    run() {
      const evidence = clone();
      evidence.artifacts[0].path = '../eas-build-log.txt';
      return validate(evidence).errors.some((error) => /path must be normalized under/.test(error));
    },
  },
  {
    name: 'rejects source drift after the built candidate',
    run() {
      return validate(clone(), {
        changedPathsSinceSource: ['apps/mobile/src/app/shelf/scan.tsx'],
      }).errors.some((error) => /Source drift after the built camera candidate/.test(error));
    },
  },
  {
    name: 'rejects a build-profile mismatch',
    run() {
      return validate(clone(), { expectedBuildProfile: 'production' }).errors.some((error) =>
        /must match PHASE5_IOS_BUILD_PROFILE exactly/.test(error),
      );
    },
  },
  {
    name: 'rejects non-independent QA and privacy signoff',
    run() {
      const evidence = clone();
      evidence.signoff.privacySecuritySignedOffBy = evidence.signoff.qaSignedOffBy;
      return validate(evidence).errors.some((error) =>
        /must be independent named reviewers/.test(error),
      );
    },
  },
  {
    name: 'rejects Boolean-only permission state summaries',
    run() {
      const evidence = clone();
      evidence.runs[0].permissionBefore = true;
      return validate(evidence).errors.some((error) =>
        /permissionBefore must be an object/.test(error),
      );
    },
  },
  {
    name: 'rejects a proof artifact classified as containing user photo pixels',
    run() {
      const evidence = clone();
      const proof = evidence.artifacts.find(({ id }) => id.startsWith('proof-'));
      proof.privacy.containsUserPhotoPixels = true;
      return validate(evidence).errors.some((error) =>
        /privacy\.containsUserPhotoPixels must be false/.test(error),
      );
    },
  },
  {
    name: 'rejects aggregate privacy attestation that omits packet artifacts',
    run() {
      const evidence = clone();
      const cleanup = evidence.artifacts.find(({ id }) => id === 'privacy_cleanup_report');
      const original = readFileSync(resolve(root, cleanup.path), 'utf8');
      const parsed = JSON.parse(original);
      parsed.claims.artifactIds.pop();
      const bytes = Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
      const mutated = write(`${evidenceRoot}/privacy-cleanup-omission.json`, bytes);
      Object.assign(cleanup, mutated);
      const rejected = validate(evidence).errors.some((error) =>
        /artifactIds must enumerate every packet artifact/.test(error),
      );
      return rejected;
    },
  },
  {
    name: 'rejects an artifact above its media byte ceiling',
    run() {
      const evidence = clone();
      const proof = evidence.artifacts.find(({ id }) => id.startsWith('proof-'));
      proof.bytes = CAMERA_LIFECYCLE_ARTIFACT_BYTE_CEILINGS['application/json'] + 1;
      return validate(evidence).errors.some((error) => /exceeds the .*byte ceiling/.test(error));
    },
  },
  {
    name: 'rejects an aggregate artifact declaration above the packet ceiling',
    run() {
      const evidence = clone();
      for (const artifact of evidence.artifacts.filter(({ id }) => id.startsWith('proof-'))) {
        artifact.bytes = 500 * 1024;
      }
      return validate(evidence).errors.some(
        (error) =>
          error.includes(
            `above the ${CAMERA_LIFECYCLE_TOTAL_ARTIFACT_BYTES_MAX}-byte packet ceiling`,
          ) && /declare/.test(error),
      );
    },
  },
  {
    name: 'rejects a non-canonical UTC evidence timestamp',
    run() {
      const evidence = clone();
      evidence.testStartedAt = '2026-07-18T12:00:00Z';
      return validate(evidence).errors.some((error) =>
        /testStartedAt must be a valid ISO timestamp/.test(error),
      );
    },
  },
  {
    name: 'rejects future-dated completion beyond the clock-skew allowance',
    run() {
      const evidence = clone();
      evidence.completedAt = '2026-07-19T18:00:00.000Z';
      return validate(evidence).errors.some((error) =>
        /completedAt cannot be in the future/.test(error),
      );
    },
  },
  {
    name: 'rejects a semantically tampered per-run proof JSON',
    run() {
      const evidence = clone();
      const run = evidence.runs[0];
      const id = run.proofArtifactIds[0];
      replaceJsonArtifact(evidence, id, 'tampered', (value) => {
        value.claims.run.route = 'progress_capture';
      });
      return validate(evidence).errors.some((error) =>
        /claims\.run must exactly cross-bind/.test(error),
      );
    },
  },
  {
    name: 'rejects a per-run proof with a zero raw-source digest',
    run() {
      const evidence = clone();
      const run = evidence.runs[0];
      const id = run.proofArtifactIds[0];
      replaceJsonArtifact(evidence, id, 'zero-source-digest', (value) => {
        value.claims.sourceEvidence[0].sha256 = '0'.repeat(64);
      });
      return validate(evidence).errors.some((error) =>
        /sourceEvidence\[0\]\.sha256 must be a non-zero SHA-256 digest/.test(error),
      );
    },
  },
  {
    name: 'rejects a network capture window narrower than the test window',
    run() {
      const evidence = clone();
      replaceJsonArtifact(evidence, 'network_privacy_report', 'narrow', (value) => {
        value.claims.captureStartedAt = '2026-07-18T12:30:00.000Z';
      });
      return validate(evidence).errors.some((error) =>
        /capture must start at or before testStartedAt/.test(error),
      );
    },
  },
  {
    name: 'rejects an EAS build log missing an exact archive binding',
    run() {
      const evidence = clone();
      const artifact = evidence.artifacts.find(({ id }) => id === 'eas_build_log');
      const text = readFileSync(resolve(root, artifact.path), 'utf8')
        .split(/\r?\n/)
        .filter((line) => !line.startsWith('archiveSha256='))
        .join('\n');
      Object.assign(
        artifact,
        write(`${evidenceRoot}/eas-build-log-missing-archive.txt`, Buffer.from(text, 'utf8')),
      );
      return validate(evidence).errors.some((error) =>
        /eas_build_log must contain only the 12 canonical binding lines/.test(error),
      );
    },
  },
  {
    name: 'rejects a secret-bearing extra EAS build-log line',
    run() {
      const evidence = clone();
      const artifact = evidence.artifacts.find(({ id }) => id === 'eas_build_log');
      const text = `${readFileSync(resolve(root, artifact.path), 'utf8').trimEnd()}\nauthToken=not-for-commit\n`;
      Object.assign(
        artifact,
        write(`${evidenceRoot}/eas-build-log-secret-line.txt`, Buffer.from(text, 'utf8')),
      );
      return validate(evidence).errors.some((error) =>
        /only the 12 canonical binding lines/.test(error),
      );
    },
  },
  {
    name: 'rejects an all-zero archive digest',
    run() {
      const evidence = clone();
      evidence.build.archiveSha256 = '0'.repeat(64);
      return validate(evidence).errors.some((error) =>
        /archiveSha256 must be a non-zero inspected/.test(error),
      );
    },
  },
  {
    name: 'rejects EAS build URLs with a query',
    run() {
      const value = `https://expo.dev/accounts/routinekind/projects/mobile/builds/${easIosBuildId}?token=secret`;
      const evidence = clone();
      evidence.build.easIosBuildId = value;
      return (
        normalizeCameraLifecycleEasBuildId(value) === null &&
        validate(evidence).errors.some((error) =>
          /build\.easIosBuildId must be a real EAS/.test(error),
        )
      );
    },
  },
  {
    name: 'rejects EAS build URLs with a fragment',
    run() {
      const value = `https://expo.dev/accounts/routinekind/projects/mobile/builds/${easIosBuildId}#secret`;
      const evidence = clone();
      evidence.build.easIosBuildId = value;
      return (
        normalizeCameraLifecycleEasBuildId(value) === null &&
        validate(evidence).errors.some((error) =>
          /build\.easIosBuildId must be a real EAS/.test(error),
        )
      );
    },
  },
  {
    name: 'rejects EAS build URLs with query syntax inside an account segment',
    run() {
      const value = `https://expo.dev/accounts/routine?token/projects/mobile/builds/${easIosBuildId}`;
      return normalizeCameraLifecycleEasBuildId(value) === null;
    },
  },
  {
    name: 'rejects Apple current-release URLs with a query',
    run() {
      const evidence = clone();
      evidence.devicePolicy.currentIosReleaseSourceUrl = `${CAMERA_LIFECYCLE_REVIEWED_CURRENT_IOS_SOURCE_URL}?token=secret`;
      return validate(evidence).errors.some((error) =>
        /without credentials, port, query, or fragment/.test(error),
      );
    },
  },
  {
    name: 'rejects an obsolete current-public iOS claim',
    run() {
      const evidence = clone();
      evidence.devicePolicy.currentPublicIosVersion = 'iOS 18.5';
      return validate(evidence).errors.some((error) =>
        /must equal the reviewed current public release/.test(error),
      );
    },
  },
  {
    name: 'rejects an obsolete current-flagship model',
    run() {
      const evidence = clone();
      evidence.devices.find(({ role }) => role === 'current_flagship').model = 'iPhone 15 Pro';
      return validate(evidence).errors.some((error) =>
        /current flagship model must be/.test(error),
      );
    },
  },
  {
    name: 'accepts evidence exactly at the seven-day freshness boundary',
    run() {
      const evidence = clone();
      const now = Date.parse(evidence.completedAt) + CAMERA_LIFECYCLE_EVIDENCE_MAX_AGE_MS;
      return validate(evidence, { now }).errors.length === 0;
    },
  },
  {
    name: 'rejects evidence one millisecond beyond the seven-day freshness boundary',
    run() {
      const evidence = clone();
      evidence.signoff.signedAt = evidence.completedAt;
      const now = Date.parse(evidence.completedAt) + CAMERA_LIFECYCLE_EVIDENCE_MAX_AGE_MS + 1;
      const errors = validate(evidence, { now }).errors;
      return (
        errors.some((error) => /completedAt must be no more than seven days old/.test(error)) &&
        errors.some((error) => /signoff\.signedAt must be no more than seven days old/.test(error))
      );
    },
  },
  {
    name: 'accepts device-policy review exactly seven days before testing',
    run() {
      const evidence = clone();
      evidence.devicePolicy.reviewedAt = new Date(
        Date.parse(evidence.testStartedAt) - CAMERA_LIFECYCLE_EVIDENCE_MAX_AGE_MS,
      ).toISOString();
      return validate(evidence).errors.length === 0;
    },
  },
  {
    name: 'rejects stale device-policy review beyond seven days',
    run() {
      const evidence = clone();
      evidence.devicePolicy.reviewedAt = new Date(
        Date.parse(evidence.testStartedAt) - CAMERA_LIFECYCLE_EVIDENCE_MAX_AGE_MS - 1,
      ).toISOString();
      return validate(evidence).errors.some((error) =>
        /devicePolicy\.reviewedAt must be within seven days/.test(error),
      );
    },
  },
  {
    name: 'rejects overlapping scenario intervals on the same physical device',
    run() {
      const evidence = clone();
      const deviceId = evidence.devices[0].id;
      for (const [index, run] of evidence.runs
        .filter((candidate) => candidate.deviceId === deviceId)
        .entries()) {
        run.startedAt = '2026-07-18T12:00:00.000Z';
        run.completedAt = '2026-07-18T12:00:01.000Z';
        const proofId = run.proofArtifactIds[0];
        replaceJsonArtifact(evidence, proofId, `overlap-${index}`, (value) => {
          value.claims.run = structuredClone(run);
        });
      }
      return validate(evidence).errors.some((error) => /runs on .* must not overlap/.test(error));
    },
  },
  {
    name: 'rejects a missing scenario-required raw-source kind',
    run() {
      const evidence = clone();
      const run = evidence.runs.find(({ scenarioId }) => scenarioId === 'offline');
      replaceJsonArtifact(evidence, run.proofArtifactIds[0], 'missing-network-source', (value) => {
        value.claims.sourceEvidence.pop();
      });
      return validate(evidence).errors.some((error) =>
        /sourceEvidence must contain screen_recording, structured_device_log, network_trace/.test(
          error,
        ),
      );
    },
  },
  {
    name: 'rejects credential-like raw-source reference drift',
    run() {
      const evidence = clone();
      const run = evidence.runs[0];
      replaceJsonArtifact(evidence, run.proofArtifactIds[0], 'credential-reference', (value) => {
        value.claims.sourceEvidence[0].reference += '/token-secret';
      });
      return validate(evidence).errors.some((error) =>
        /reference must equal the derived/.test(error),
      );
    },
  },
  {
    name: 'rejects role-only and placeholder signoff identities',
    run() {
      const roleEvidence = clone();
      roleEvidence.signoff.qaSignedOffBy = 'Physical Device QA Reviewer';
      const placeholderEvidence = clone();
      placeholderEvidence.signoff.qaSignedOffBy = 'Test User';
      return (
        validate(roleEvidence).errors.some((error) =>
          /accountable person, not a role label/.test(error),
        ) &&
        validate(placeholderEvidence).errors.some((error) =>
          /accountable person, not a role label/.test(error),
        )
      );
    },
  },
  {
    name: 'rejects an unsafe archive Info.plist member path',
    run() {
      const evidence = clone();
      replaceJsonArtifact(evidence, 'final_info_plist_report', 'unsafe-member-path', (value) => {
        value.claims.infoPlistRelativePath = 'RoutineKind.xcarchive/Products/C:secret/Info.plist';
      });
      return validate(evidence).errors.some((error) =>
        /normalized portable archive-member path/.test(error),
      );
    },
  },
  {
    name: 'rejects an unstructured or secret-extended network capture tool',
    run() {
      const evidence = clone();
      replaceJsonArtifact(evidence, 'network_privacy_report', 'capture-tool-secret', (value) => {
        value.claims.captureTool.apiToken = 'not-for-commit';
      });
      return validate(evidence).errors.some((error) =>
        /captureTool contains unknown field apiToken/.test(error),
      );
    },
  },
  {
    name: 'rejects Windows ADS and unsafe template path forms cross-platform',
    run() {
      return (
        normalizeCameraLifecycleEvidencePath(
          'docs/phase-5/evidence/camera-lifecycle/host:proof.json',
        ) === null &&
        normalizeCameraLifecycleTemplatePath('../camera.template.json') === null &&
        normalizeCameraLifecycleTemplatePath('C:/camera.template.json') === null
      );
    },
  },
  {
    name: 'rejects intermediate symlink or junction escape where supported',
    run() {
      const outside = mkdtempSync(join(tmpdir(), 'routinekind-camera-outside-'));
      const linkRelative = `${evidenceRoot}/escape-link`;
      const link = resolve(root, linkRelative);
      writeFileSync(resolve(outside, 'secret.json'), '{"outside":true}\n');
      let created = false;
      try {
        symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
        created = true;
        return (
          readCameraLifecycleContainedFile(root, `${linkRelative}/secret.json`, {
            maxBytes: 1024,
          }) === null
        );
      } catch (error) {
        return ['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error?.code);
      } finally {
        if (created) {
          try {
            rmdirSync(link);
          } catch {
            // The smoke still fails if a supported indirection was accepted.
          }
        }
        rmSync(outside, { recursive: true, force: true });
      }
    },
  },
  {
    name: 'fails closed without throwing for disappeared and oversized reads',
    run() {
      const disappeared = `${evidenceRoot}/disappeared.json`;
      write(disappeared, Buffer.from('{"present":true}\n'));
      rmSync(resolve(root, disappeared), { force: true });
      const oversized = `${evidenceRoot}/oversized.json`;
      write(oversized, Buffer.alloc(128, 0x61));
      return (
        readCameraLifecycleContainedFile(root, disappeared, { maxBytes: 1024 }) === null &&
        readCameraLifecycleContainedFile(root, oversized, { maxBytes: 64 }) === null &&
        readCameraLifecycleContainedFile(root, null, { maxBytes: 64 }) === null
      );
    },
  },
  {
    name: 'rejects malformed collection shapes without throwing',
    run() {
      const evidence = clone();
      evidence.devices = 'not-an-array';
      evidence.artifacts = { invalid: true };
      const result = validate(evidence);
      return (
        result.errors.some((error) => /devices must be an array/.test(error)) &&
        result.errors.some((error) => /artifacts must be an array/.test(error))
      );
    },
  },
  {
    name: 'rejects unresolved known limitations under a pass signoff',
    run() {
      const evidence = clone();
      evidence.knownLimitations = [
        'The interruption suite was not executed on the supported-floor physical iPhone.',
      ];
      return validate(evidence).errors.some((error) =>
        /must be resolved before a pass decision/.test(error),
      );
    },
  },
];

let failures = 0;
for (const testCase of cases) {
  let passed = false;
  try {
    passed = testCase.run() === true;
  } catch (error) {
    console.error(
      `FAIL ${testCase.name}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
    failures += 1;
    continue;
  }
  if (passed) console.log(`PASS ${testCase.name}`);
  else {
    console.error(`FAIL ${testCase.name}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\nCamera lifecycle evidence smoke failed on ${failures}/${cases.length} cases.`);
  process.exit(1);
}

console.log(`\nCamera lifecycle evidence smoke passed ${cases.length}/${cases.length} cases.`);
