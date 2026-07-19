#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import {
  createNativeOcrEvidenceTemplate,
  NATIVE_OCR_LABEL_CLASSES,
  NATIVE_OCR_REQUIRED_SOURCE_FILES,
} from './native-ocr-evidence-contract.mjs';

const sourceRoot = resolve(import.meta.dirname, '..', '..');
const fixtureRoot = mkdtempSync(join(tmpdir(), 'routinekind-native-ocr-evidence-'));
const evidenceRelativeRoot = `docs/phase-5/evidence/native-ocr/smoke-${process.pid}`;
const evidenceRoot = resolve(fixtureRoot, evidenceRelativeRoot);
const evidencePath = `${evidenceRelativeRoot}/evidence.json`;

process.on('exit', () => rmSync(fixtureRoot, { recursive: true, force: true }));

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return String(result.stdout ?? '').trim();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function copyCurrentSource(path) {
  const source = resolve(sourceRoot, path);
  if (!existsSync(source)) throw new Error(`Missing native OCR smoke source: ${path}`);
  const target = resolve(fixtureRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

git(dirname(fixtureRoot), ['clone', '--quiet', '--no-local', sourceRoot, fixtureRoot]);
for (const path of new Set([
  ...NATIVE_OCR_REQUIRED_SOURCE_FILES,
  'scripts/phase5/native-ocr-evidence-contract.mjs',
  'scripts/phase5/check-native-ocr-evidence.mjs',
  'scripts/phase5/native-ocr-evidence-smoke.mjs',
  'package.json',
])) {
  copyCurrentSource(path);
}
git(fixtureRoot, ['config', 'user.email', 'phase5-native-ocr-smoke@example.invalid']);
git(fixtureRoot, ['config', 'user.name', 'Phase 5 Native OCR Smoke']);
git(fixtureRoot, ['add', '-A']);
git(fixtureRoot, ['commit', '--quiet', '-m', 'Phase 5 native OCR smoke source']);

const checker = resolve(fixtureRoot, 'scripts/phase5/check-native-ocr-evidence.mjs');
const gitSha = git(fixtureRoot, ['rev-parse', 'HEAD']);
const iosBuildId = '9f7b48e1-7a52-4efb-9d93-3e93a2bf13e5';
const buildProfile = 'staging';
mkdirSync(evidenceRoot, { recursive: true });

function writeArtifact(id, mediaType) {
  const extension =
    mediaType === 'application/json' ? 'json' : mediaType === 'text/csv' ? 'csv' : 'txt';
  const relativePath = `${evidenceRelativeRoot}/${id}.${extension}`;
  const bytes = Buffer.from(
    mediaType === 'application/json'
      ? `${JSON.stringify({ id, build: iosBuildId, sourceGitSha: gitSha, proof: `${id} physical-device proof` }, null, 2)}\n`
      : `${id},${iosBuildId},${gitSha},physical-device-proof\n`,
    'utf8',
  );
  writeFileSync(resolve(fixtureRoot, relativePath), bytes);
  return { id, path: relativePath, sha256: sha256(bytes), bytes: bytes.length, mediaType };
}

function nearestRank(samples, percentile) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)];
}

function rate(value) {
  return Number(value.toFixed(6));
}

function fillResults(evidence) {
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
      tokenRecall: rate(matchedTokens / expectedTokens),
      insertedTokenRate: rate(insertedTokens / Math.max(1, outputTokens)),
      orderedSequenceSimilarity: rate(
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

function validEvidence() {
  const evidence = createNativeOcrEvidenceTemplate();
  evidence.testStartedAt = '2026-07-18T12:00:00.000Z';
  evidence.completedAt = '2026-07-18T16:00:00.000Z';
  evidence.sourceGitSha = gitSha;
  evidence.sourceHashes = Object.fromEntries(
    NATIVE_OCR_REQUIRED_SOURCE_FILES.map((path) => [
      path,
      sha256(readFileSync(resolve(fixtureRoot, path))),
    ]),
  );
  Object.assign(evidence.build, {
    easIosBuildId: iosBuildId,
    profile: buildProfile,
    appBundleIdentifier: 'com.routinekind.phase5ocrsmoke',
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
    { id: 'ios-current-device', physical: true, model: 'iPhone 15 Pro', osVersion: 'iOS 18.5' },
  ];
  evidence.corpus.forEach((item, index) => {
    item.languageTags =
      item.labelClass === 'multilingual'
        ? /-(?:1|2)$/.test(item.id)
          ? ['en', 'ar']
          : ['en', 'fr']
        : ['en'];
    item.rightsBasis = 'owned_physical_product';
    item.provenanceNote = `Owned physical product label documented for governed smoke item ${index + 1}.`;
    item.groundTruthSha256 = sha256(`reviewed-ground-truth-${item.id}`);
    item.expectedTokenCount = 20;
  });
  evidence.runs = evidence.devices.flatMap((device, deviceIndex) =>
    evidence.corpus.map((item, itemIndex) => {
      const isClear = item.labelClass === 'clear';
      return {
        id: `${device.id}-${item.id}`,
        deviceId: device.id,
        corpusItemId: item.id,
        capturedAt: `2026-07-18T1${2 + deviceIndex}:${String(itemIndex).padStart(2, '0')}:00.000Z`,
        recognitionMs: 900 + deviceIndex * 100 + itemIndex * 20,
        expectedTokenCount: item.expectedTokenCount,
        matchedTokenCount: isClear ? 20 : 18,
        outputTokenCount: isClear ? 20 : 19,
        insertedTokenCount: 0,
        sequenceEditDistance: isClear ? 0 : 2,
        lowConfidenceTokenCount: isClear ? 0 : 2,
        editable: true,
        manualRecoveryAvailable: true,
        uncertaintyCuesVisible: true,
        transcriptNfc: true,
        multilingualGlyphsPreserved: true,
        readingOrderReviewed: true,
        rtlReadingOrderPass: item.languageTags.some((tag) => tag === 'ar') ? true : null,
        completedWithoutCrashOrHang: true,
        timedOut: false,
      };
    }),
  );
  fillResults(evidence);
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
    writeArtifact('eas_build_log', 'text/plain'),
    writeArtifact('archive_inspection', 'application/json'),
    writeArtifact('raw_run_export', 'application/json'),
    writeArtifact('network_capture', 'text/plain'),
    writeArtifact('accessibility_report', 'application/json'),
    writeArtifact('cleanup_report', 'text/plain'),
    writeArtifact('corpus_provenance_report', 'application/json'),
  ];
  evidence.knownLimitations = [
    'Vision confidence is an engine score, not a calibrated probability; every transcript remains editable.',
  ];
  evidence.signoff = {
    decision: 'pass',
    qaSignedOffBy: 'Physical Device Reviewer',
    privacySignedOffBy: 'Privacy Evidence Reviewer',
    signedAt: '2026-07-18T17:00:00.000Z',
  };
  return evidence;
}

function run(evidence, { strict = true, path = evidencePath, extraEnv = {} } = {}) {
  if (evidence) {
    const target = resolve(fixtureRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  return spawnSync(process.execPath, [checker, ...(strict ? ['--strict'] : [])], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PHASE5_NATIVE_OCR_EVIDENCE_PATH: path,
      PHASE5_IOS_BUILD_ID: iosBuildId,
      PHASE5_IOS_BUILD_PROFILE: buildProfile,
      ...extraEnv,
    },
  });
}

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

const template = createNativeOcrEvidenceTemplate();
assert.equal(template.schemaVersion, 2);
assert.equal(template.corpus.length, 25);
assert.equal(template.runs.length, 50);
assert.equal(template.devices.length, 2);
assert.equal(template.cleanup.noOrphanedExpoCameraPhotosAfterColdRelaunch, null);
assert.equal(template.cleanup.noLabelPhotoInImageCaches, null);
assert.equal(template.cleanup.startupSnapshotRetryBeforeSuccessPass, null);
assert.equal(template.cleanup.startupSnapshotFrozenAfterSuccessPass, null);
assert.equal(template.cleanup.combinedStartupDrainCoordinationPass, null);
assert.equal(template.cleanup.staleRawCaptureRemovedAfterLeaseInvalidation, null);
assert.equal(template.cleanup.progressReviewRawCaptureLifecyclePass, null);
for (const privacyCriticalSource of [
  'apps/mobile/src/app/_layout.tsx',
  'apps/mobile/src/app/progress/capture.tsx',
  'apps/mobile/src/app/progress/review.tsx',
  'apps/mobile/src/features/native/camera/labelPhotoStartup.ts',
  'apps/mobile/src/features/native/ocr/analytics.ts',
  'apps/mobile/src/features/photos/progressCapturePrivacy.ts',
]) {
  assert.equal(template.sourceHashes[privacyCriticalSource], null);
}
const packageScripts = JSON.parse(
  readFileSync(resolve(fixtureRoot, 'package.json'), 'utf8'),
).scripts;
for (const scriptName of [
  'cat05:native-ocr-source-contract:test',
  'phase5:native-ocr-evidence',
  'phase5:native-ocr-evidence:strict',
  'phase5:native-ocr-evidence:smoke',
  'phase5:native-ocr-evidence:template',
  'phase5:native-ocr-evidence:template:check',
]) {
  assert.equal(typeof packageScripts[scriptName], 'string', `missing ${scriptName}`);
}
assert.match(packageScripts['phase5:verify'], /phase5:native-ocr-evidence:smoke/);
assert.match(packageScripts['phase5:verify'], /cat05:native-ocr-source-contract:test/);
assert.match(packageScripts['phase5:verify'], /phase5:native-ocr-evidence:template:check/);
assert.match(packageScripts['phase5:verify'], /phase5:native-ocr-evidence(?:\s|$)/);
assert.match(packageScripts['launch:verify'], /phase5:native-ocr-evidence:template:check/);
assert.match(packageScripts['launch:verify'], /cat05:native-ocr-source-contract:test/);
assert.match(packageScripts['launch:verify'], /phase5:native-ocr-evidence(?:\s|$)/);

// Model the real two-commit workflow: A is the exact EAS source candidate;
// B commits only the completed evidence and attachments after physical QA.
const committedEvidence = validEvidence();
writeFileSync(
  resolve(fixtureRoot, evidencePath),
  `${JSON.stringify(committedEvidence, null, 2)}\n`,
);
git(fixtureRoot, ['add', evidenceRelativeRoot]);
git(fixtureRoot, ['commit', '--quiet', '-m', 'Attach physical native OCR evidence']);
const evidenceGitSha = git(fixtureRoot, ['rev-parse', 'HEAD']);
assert.notEqual(evidenceGitSha, gitSha);
assert.equal(
  spawnSync('git', ['merge-base', '--is-ancestor', gitSha, evidenceGitSha], {
    cwd: fixtureRoot,
  }).status,
  0,
);

const wrongBuild = validEvidence();
wrongBuild.build.easIosBuildId = '7a4d74ae-2acd-4af5-931f-b768565bcd64';

const wrongProfile = validEvidence();
wrongProfile.build.profile = 'production';

const staleSource = validEvidence();
staleSource.sourceHashes[NATIVE_OCR_REQUIRED_SOURCE_FILES[0]] = '0'.repeat(64);

const postHocThreshold = validEvidence();
postHocThreshold.thresholds.definedAt = '2026-07-18T13:00:00.000Z';

const forgedSummary = validEvidence();
forgedSummary.results.classSummaries.clear.tokenRecall = 0.99;

const failedAccuracy = validEvidence();
for (const run of failedAccuracy.runs) {
  const item = failedAccuracy.corpus.find(({ id }) => id === run.corpusItemId);
  if (item?.labelClass === 'clear') run.matchedTokenCount = 18;
}
fillResults(failedAccuracy);

const failedReadingOrder = validEvidence();
for (const run of failedReadingOrder.runs) {
  const item = failedReadingOrder.corpus.find(({ id }) => id === run.corpusItemId);
  if (item?.labelClass === 'multilingual') run.sequenceEditDistance = 10;
}
fillResults(failedReadingOrder);

const missingRtlCorpus = validEvidence();
for (const item of missingRtlCorpus.corpus) {
  if (item.labelClass === 'multilingual') item.languageTags = ['en', 'fr'];
}
for (const run of missingRtlCorpus.runs) run.rtlReadingOrderPass = null;
fillResults(missingRtlCorpus);

const missingClassItem = validEvidence();
missingClassItem.corpus = missingClassItem.corpus.filter((item) => item.id !== 'glare-heavy-5');
missingClassItem.runs = missingClassItem.runs.filter((run) => run.corpusItemId !== 'glare-heavy-5');
fillResults(missingClassItem);

const leakedNetwork = validEvidence();
leakedNetwork.privacyNetwork.zeroImageUploads = false;

const failedCleanup = validEvidence();
failedCleanup.cleanup.temporaryPhotoRemovedAfterLeave = false;

const failedImageCacheCleanup = validEvidence();
failedImageCacheCleanup.cleanup.noLabelPhotoInImageCaches = false;

const failedRawExpoCameraCleanup = validEvidence();
failedRawExpoCameraCleanup.cleanup.noOrphanedExpoCameraPhotosAfterColdRelaunch = false;

const failedStartupSnapshotRetry = validEvidence();
failedStartupSnapshotRetry.cleanup.startupSnapshotRetryBeforeSuccessPass = false;

const failedStartupSnapshotFreeze = validEvidence();
failedStartupSnapshotFreeze.cleanup.startupSnapshotFrozenAfterSuccessPass = false;

const failedCombinedStartupDrainCoordination = validEvidence();
failedCombinedStartupDrainCoordination.cleanup.combinedStartupDrainCoordinationPass = false;

const failedStaleRawCaptureCleanup = validEvidence();
failedStaleRawCaptureCleanup.cleanup.staleRawCaptureRemovedAfterLeaseInvalidation = false;

const failedProgressReviewRawCaptureLifecycle = validEvidence();
failedProgressReviewRawCaptureLifecycle.cleanup.progressReviewRawCaptureLifecyclePass = false;

const failedAccessibility = validEvidence();
failedAccessibility.accessibility.dynamicType200Pass = false;

const impossibleMatchedCount = validEvidence();
impossibleMatchedCount.runs[0].outputTokenCount = 1;
impossibleMatchedCount.runs[0].matchedTokenCount = 20;
impossibleMatchedCount.runs[0].sequenceEditDistance = 19;
fillResults(impossibleMatchedCount);

const impossibleLengthDistance = validEvidence();
impossibleLengthDistance.runs[0].outputTokenCount = 19;
impossibleLengthDistance.runs[0].matchedTokenCount = 19;
impossibleLengthDistance.runs[0].sequenceEditDistance = 0;
fillResults(impossibleLengthDistance);

const impossibleAlignmentDistance = validEvidence();
impossibleAlignmentDistance.runs[0].matchedTokenCount = 18;
impossibleAlignmentDistance.runs[0].sequenceEditDistance = 1;
fillResults(impossibleAlignmentDistance);

const tamperedArtifact = validEvidence();
tamperedArtifact.artifacts[0].sha256 = '0'.repeat(64);

const duplicateRun = validEvidence();
duplicateRun.runs[duplicateRun.runs.length - 1] = structuredClone(duplicateRun.runs[0]);
fillResults(duplicateRun);

const missingDevice = validEvidence();
missingDevice.devices = missingDevice.devices.slice(0, 1);
missingDevice.runs = missingDevice.runs.filter(
  (run) => run.deviceId === missingDevice.devices[0].id,
);
missingDevice.accessibility.testedDeviceIds = missingDevice.devices.map(({ id }) => id);
fillResults(missingDevice);

const placeholderSigners = validEvidence();
placeholderSigners.signoff.qaSignedOffBy = 'Tester Name';
placeholderSigners.signoff.privacySignedOffBy = 'Reviewer';
placeholderSigners.provenance.reviewedBy = 'Name';

const artifactTraversal = validEvidence();
artifactTraversal.artifacts[0].path = '../eas-build-log.txt';

const nonAncestor = validEvidence();
nonAncestor.sourceGitSha = '1234567890abcdef1234567890abcdef12345678';

function runWithDirtySource() {
  const marker = resolve(fixtureRoot, `.native-ocr-dirty-${process.pid}.tmp`);
  writeFileSync(marker, 'dirty source outside validated evidence\n');
  try {
    return run(validEvidence());
  } finally {
    rmSync(marker, { force: true });
  }
}

function runWithCommittedSourceDrift() {
  const driftRoot = mkdtempSync(join(tmpdir(), 'routinekind-native-ocr-source-drift-'));
  try {
    git(dirname(driftRoot), ['clone', '--quiet', '--no-local', fixtureRoot, driftRoot]);
    git(driftRoot, ['config', 'user.email', 'phase5-native-ocr-smoke@example.invalid']);
    git(driftRoot, ['config', 'user.name', 'Phase 5 Native OCR Smoke']);
    const driftPath = NATIVE_OCR_REQUIRED_SOURCE_FILES[0];
    const original = readFileSync(resolve(driftRoot, driftPath));
    writeFileSync(resolve(driftRoot, driftPath), Buffer.concat([original, Buffer.from('\n')]));
    git(driftRoot, ['add', driftPath]);
    git(driftRoot, ['commit', '--quiet', '-m', 'Drift source after candidate build']);
    return spawnSync(
      process.execPath,
      [resolve(driftRoot, 'scripts/phase5/check-native-ocr-evidence.mjs'), '--strict'],
      {
        cwd: driftRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PHASE5_NATIVE_OCR_EVIDENCE_PATH: evidencePath,
          PHASE5_IOS_BUILD_ID: iosBuildId,
          PHASE5_IOS_BUILD_PROFILE: buildProfile,
        },
      },
    );
  } finally {
    rmSync(driftRoot, { recursive: true, force: true });
  }
}

function runWithCommittedAllowedManifest() {
  const manifestRoot = mkdtempSync(join(tmpdir(), 'routinekind-native-ocr-manifest-'));
  try {
    git(dirname(manifestRoot), ['clone', '--quiet', '--no-local', fixtureRoot, manifestRoot]);
    git(manifestRoot, ['config', 'user.email', 'phase5-native-ocr-smoke@example.invalid']);
    git(manifestRoot, ['config', 'user.name', 'Phase 5 Native OCR Smoke']);
    const manifestPath = 'docs/e2e/generated/human-e2e-manifest.md';
    const original = readFileSync(resolve(manifestRoot, manifestPath));
    writeFileSync(
      resolve(manifestRoot, manifestPath),
      Buffer.concat([original, Buffer.from('\n<!-- refreshed evidence manifest -->\n')]),
    );
    git(manifestRoot, ['add', manifestPath]);
    git(manifestRoot, ['commit', '--quiet', '-m', 'Refresh human evidence manifest']);
    return spawnSync(
      process.execPath,
      [resolve(manifestRoot, 'scripts/phase5/check-native-ocr-evidence.mjs'), '--strict'],
      {
        cwd: manifestRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PHASE5_NATIVE_OCR_EVIDENCE_PATH: evidencePath,
          PHASE5_IOS_BUILD_ID: iosBuildId,
          PHASE5_IOS_BUILD_PROFILE: buildProfile,
        },
      },
    );
  } finally {
    rmSync(manifestRoot, { recursive: true, force: true });
  }
}

function runSymlinkCase() {
  try {
    const original = resolve(fixtureRoot, `${evidenceRelativeRoot}/network_capture.txt`);
    const symlinkRelativePath = `${evidenceRelativeRoot}/network-capture-symlink.txt`;
    symlinkSync(original, resolve(fixtureRoot, symlinkRelativePath), 'file');
    const evidence = validEvidence();
    const networkArtifact = evidence.artifacts.find(({ id }) => id === 'network_capture');
    networkArtifact.path = symlinkRelativePath;
    return { supported: true, result: run(evidence) };
  } catch {
    assert.match(
      readFileSync(resolve(fixtureRoot, 'scripts/phase5/native-ocr-evidence-contract.mjs'), 'utf8'),
      /isSymbolicLink\(\)/,
      'native OCR evidence validator must retain its fail-closed symlink check',
    );
    return { supported: false, result: null };
  }
}

const cases = [
  {
    name: 'accepts exact-source, exact-build, two-device OCR evidence',
    result: run(validEvidence()),
    pass: (result) =>
      result.status === 0 &&
      /50\/50 runs across 2 devices, 25 labels, and 5\/5 classes/.test(output(result)),
  },
  {
    name: 'keeps missing evidence truthfully blocked outside strict mode',
    result: run(null, { strict: false, path: '' }),
    pass: (result) =>
      result.status === 0 &&
      /remains externally blocked and must stay disabled/.test(output(result)),
  },
  {
    name: 'rejects missing artifact evidence in strict mode instead of trusting a Boolean',
    result: run(null, {
      path: '',
      extraEnv: { PHASE5_NATIVE_OCR_QA_PASS: 'true' },
    }),
    pass: (result) =>
      result.status === 1 && /Boolean pass flag cannot substitute/.test(output(result)),
  },
  {
    name: 'rejects evidence paths outside the governed repository root',
    result: run(validEvidence(), { path: '../native-ocr-evidence.json' }),
    pass: (result) =>
      result.status === 1 && /normalized repo-relative JSON path/.test(output(result)),
  },
  {
    name: 'accepts the committed evidence-only descendant of the EAS source commit',
    result: run(validEvidence()),
    pass: (result) => result.status === 0 && !/Source drift after/.test(output(result)),
  },
  {
    name: 'rejects strict evidence without external candidate build and profile bindings',
    result: run(validEvidence(), {
      extraEnv: { PHASE5_IOS_BUILD_ID: '', PHASE5_IOS_BUILD_PROFILE: '' },
    }),
    pass: (result) =>
      result.status === 1 &&
      /PHASE5_IOS_BUILD_ID is required to cross-bind/.test(output(result)) &&
      /PHASE5_IOS_BUILD_PROFILE is required to cross-bind/.test(output(result)),
  },
  {
    name: 'rejects an evidence build that differs from the candidate build',
    result: run(wrongBuild),
    pass: (result) =>
      result.status === 1 && /must match PHASE5_IOS_BUILD_ID exactly/.test(output(result)),
  },
  {
    name: 'rejects an evidence profile that differs from the candidate profile',
    result: run(wrongProfile),
    pass: (result) =>
      result.status === 1 && /must match PHASE5_IOS_BUILD_PROFILE exactly/.test(output(result)),
  },
  {
    name: 'rejects stale or invented source hashes',
    result: run(staleSource),
    pass: (result) =>
      result.status === 1 && /does not match the exact source file bytes/.test(output(result)),
  },
  {
    name: 'rejects post-hoc OCR thresholds',
    result: run(postHocThreshold),
    pass: (result) =>
      result.status === 1 && /post-hoc thresholds are rejected/.test(output(result)),
  },
  {
    name: 'rejects declared summaries that differ from raw run counts',
    result: run(forgedSummary),
    pass: (result) => result.status === 1 && /must equal the calculated value/.test(output(result)),
  },
  {
    name: 'calculates and rejects a failed clear-label accuracy threshold',
    result: run(failedAccuracy),
    pass: (result) =>
      result.status === 1 && /clear calculated token recall .* below/.test(output(result)),
  },
  {
    name: 'calculates and rejects token-order corruption despite unchanged token recall',
    result: run(failedReadingOrder),
    pass: (result) =>
      result.status === 1 &&
      /multilingual calculated ordered-sequence similarity .* below/.test(output(result)),
  },
  {
    name: 'rejects a multilingual corpus without the RTL reading-order floor',
    result: run(missingRtlCorpus),
    pass: (result) =>
      result.status === 1 && /at least 2 multilingual labels .* RTL/.test(output(result)),
  },
  {
    name: 'rejects incomplete glare-heavy corpus and device coverage',
    result: run(missingClassItem),
    pass: (result) => result.status === 1 && /at least 5 glare_heavy labels/.test(output(result)),
  },
  {
    name: 'rejects any image-network disclosure failure',
    result: run(leakedNetwork),
    pass: (result) => result.status === 1 && /zeroImageUploads must be true/.test(output(result)),
  },
  {
    name: 'rejects incomplete temporary-photo cleanup',
    result: run(failedCleanup),
    pass: (result) =>
      result.status === 1 && /temporaryPhotoRemovedAfterLeave must be true/.test(output(result)),
  },
  {
    name: 'rejects label photos left in Expo Camera, Expo Image, or SDWebImage disk caches',
    result: run(failedImageCacheCleanup),
    pass: (result) =>
      result.status === 1 && /noLabelPhotoInImageCaches must be true/.test(output(result)),
  },
  {
    name: 'rejects raw Expo Camera staging photos left after a cold relaunch',
    result: run(failedRawExpoCameraCleanup),
    pass: (result) =>
      result.status === 1 &&
      /noOrphanedExpoCameraPhotosAfterColdRelaunch must be true/.test(output(result)),
  },
  {
    name: 'rejects startup snapshot acquisition that cannot retry before first success',
    result: run(failedStartupSnapshotRetry),
    pass: (result) =>
      result.status === 1 &&
      /startupSnapshotRetryBeforeSuccessPass must be true/.test(output(result)),
  },
  {
    name: 'rejects startup snapshot relisting after first successful acquisition',
    result: run(failedStartupSnapshotFreeze),
    pass: (result) =>
      result.status === 1 &&
      /startupSnapshotFrozenAfterSuccessPass must be true/.test(output(result)),
  },
  {
    name: 'rejects combined startup drains without settled deduplicated retry coordination',
    result: run(failedCombinedStartupDrainCoordination),
    pass: (result) =>
      result.status === 1 &&
      /combinedStartupDrainCoordinationPass must be true/.test(output(result)),
  },
  {
    name: 'rejects stale raw captures left after mounted focus or close lease invalidation',
    result: run(failedStaleRawCaptureCleanup),
    pass: (result) =>
      result.status === 1 &&
      /staleRawCaptureRemovedAfterLeaseInvalidation must be true/.test(output(result)),
  },
  {
    name: 'rejects incomplete Progress review raw-capture privacy lifecycle proof',
    result: run(failedProgressReviewRawCaptureLifecycle),
    pass: (result) =>
      result.status === 1 &&
      /progressReviewRawCaptureLifecyclePass must be true/.test(output(result)),
  },
  {
    name: 'rejects matched tokens that exceed the observed output sequence',
    result: run(impossibleMatchedCount),
    pass: (result) =>
      result.status === 1 &&
      /matchedTokenCount cannot exceed either expectedTokenCount or outputTokenCount/.test(
        output(result),
      ),
  },
  {
    name: 'rejects zero edit distance when expected and output lengths differ',
    result: run(impossibleLengthDistance),
    pass: (result) =>
      result.status === 1 && /sequenceEditDistance cannot be below/.test(output(result)),
  },
  {
    name: 'rejects edit distance below the exact-match alignment floor',
    result: run(impossibleAlignmentDistance),
    pass: (result) =>
      result.status === 1 && /sequenceEditDistance cannot be below/.test(output(result)),
  },
  {
    name: 'rejects incomplete 200 percent Dynamic Type proof',
    result: run(failedAccessibility),
    pass: (result) => result.status === 1 && /dynamicType200Pass must be true/.test(output(result)),
  },
  {
    name: 'rejects proof attachments whose digest is not exact',
    result: run(tamperedArtifact),
    pass: (result) =>
      result.status === 1 && /sha256 does not match the evidence file bytes/.test(output(result)),
  },
  {
    name: 'rejects duplicated device and corpus run pairs',
    result: run(duplicateRun),
    pass: (result) => result.status === 1 && /Duplicate device\/corpus run/.test(output(result)),
  },
  {
    name: 'rejects evidence from fewer than two distinct physical iPhones',
    result: run(missingDevice),
    pass: (result) => result.status === 1 && /at least 2 physical iPhones/.test(output(result)),
  },
  {
    name: 'rejects placeholder QA, privacy, and provenance reviewers',
    result: run(placeholderSigners),
    pass: (result) =>
      result.status === 1 &&
      /qaSignedOffBy must name a real QA reviewer/.test(output(result)) &&
      /privacySignedOffBy must name a real privacy reviewer/.test(output(result)) &&
      /provenance.reviewedBy must name a real reviewer/.test(output(result)),
  },
  {
    name: 'rejects proof artifact path traversal',
    result: run(artifactTraversal),
    pass: (result) =>
      result.status === 1 && /path must be normalized and under/.test(output(result)),
  },
  {
    name: 'rejects a source SHA that is not an ancestor of the evidence commit',
    result: run(nonAncestor),
    pass: (result) => result.status === 1 && /must be a Git ancestor/.test(output(result)),
  },
  {
    name: 'rejects dirty worktree state outside validated evidence',
    result: runWithDirtySource(),
    pass: (result) => result.status === 1 && /dirty worktree outside/.test(output(result)),
  },
  {
    name: 'rejects committed runtime source drift after the built candidate',
    result: runWithCommittedSourceDrift(),
    pass: (result) =>
      result.status === 1 &&
      /Source drift after the built candidate is not evidence-only/.test(output(result)) &&
      /does not match the exact source file bytes/.test(output(result)),
  },
  {
    name: 'accepts an explicitly allowlisted committed human-evidence manifest refresh',
    result: runWithCommittedAllowedManifest(),
    pass: (result) => result.status === 0 && !/Source drift after/.test(output(result)),
  },
];

const symlinkCase = runSymlinkCase();
if (symlinkCase.supported) {
  cases.push({
    name: 'rejects symlinked proof artifacts',
    result: symlinkCase.result,
    pass: (result) =>
      result.status === 1 && /regular non-symlink evidence file/.test(output(result)),
  });
} else {
  console.log('PASS pins fail-closed symlink rejection on hosts that cannot create file symlinks');
}

let failed = false;
for (const testCase of cases) {
  if (testCase.pass(testCase.result)) {
    console.log(`PASS ${testCase.name}`);
    continue;
  }
  failed = true;
  console.error(`FAIL ${testCase.name}`);
  console.error(output(testCase.result));
}

if (failed) process.exit(1);
