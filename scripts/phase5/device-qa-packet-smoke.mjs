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
import {
  createPerformanceEvidenceTemplate,
  summarizePerformanceSamples,
} from './performance-evidence-contract.mjs';
import { PHASE5_REQUIRED_QA_EVIDENCE_KEYS } from './device-qa-packet-contract.mjs';
import { renderHumanE2eManifestMarkdown } from '../e2e/human-e2e-manifest-render.mjs';
import { canonicalEvidenceJsonBytes } from '../e2e/evidence-diagnostic-hygiene.mjs';
import {
  buildGovernedEvidenceLedger,
  captureGovernedPublicationPolicy,
  governedEvidenceLedgerPath,
  governedEvidenceRoleForPath,
  renderGovernedEvidenceLedger,
} from '../launch/governed-evidence-chain.mjs';
import {
  publishGovernedFixtureTail,
  publishGovernedFixtureUnit,
} from '../launch/governed-evidence-test-fixture.mjs';
import {
  CAT07_BROWSER_LAUNCH_SCHEMA_VERSION,
  CAT07_CHILD_ENVIRONMENT_SCHEMA_VERSION,
  CAT07_ENVIRONMENT_BOOTSTRAP_SCHEMA_VERSION,
  CAT07_LOOPBACK_ATTESTATION_SCHEMA_VERSION,
  CAT07_RUNTIME_PROVENANCE_SCHEMA_VERSION,
  buildCat07ChildEnvironment,
  cat07BrowserArguments,
} from '../e2e/cat07-shelf-freshness-audit.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(scriptDir, '..', '..');
const fixtureRoot = mkdtempSync(join(tmpdir(), 'layerwell-phase5-repo-'));
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
const cat07SummaryFixtureRelativePath =
  'test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json';
const cat07SummaryFixturePath = resolve(fixtureRoot, cat07SummaryFixtureRelativePath);
mkdirSync(dirname(cat07SummaryFixturePath), { recursive: true });
const cat07ManifestFixtureRelativePath = 'docs/e2e/generated/human-e2e-manifest.json';
const cat07ManifestFixturePath = resolve(fixtureRoot, cat07ManifestFixtureRelativePath);
const cat07ManifestMarkdownFixturePath = resolve(
  fixtureRoot,
  'docs/e2e/generated/human-e2e-manifest.md',
);
const cat07RunId = 'cat07-11111111-1111-4111-8111-111111111111';
const cat07SourceSha = git(fixtureRoot, ['rev-parse', 'HEAD']);
const cat07SourcePackageLockResult = spawnSync(
  'git',
  ['show', `${cat07SourceSha}:package-lock.json`],
  { cwd: fixtureRoot, encoding: null, maxBuffer: 16 * 1024 * 1024 },
);
if (
  cat07SourcePackageLockResult.status !== 0 ||
  !Buffer.isBuffer(cat07SourcePackageLockResult.stdout)
) {
  throw new Error('Phase 5 smoke could not read the CAT07 source package-lock blob.');
}
const cat07SourcePackageLockBytes = cat07SourcePackageLockResult.stdout;
const cat07Viewports = [
  { id: 'iphone-375x667', width: 375, height: 667 },
  { id: 'iphone-390x844', width: 390, height: 844 },
  { id: 'iphone-430x932', width: 430, height: 932 },
];
const cat07AtSecond = (seconds) =>
  new Date(Date.parse('2026-08-08T00:00:00.000Z') + seconds * 1_000).toISOString();
const cat07Steps = [
  '01-manual',
  '02-opening-required',
  '03-future-opened-date-blocked',
  '04-label-pao-ready',
  '05-shelf-countdown',
  '06-label-pao-detail',
  '07-package-date-recorded',
  '08-replacement-choices',
  '09-future-replacement-date-blocked',
  '10-unopened-replacement-shelf',
  '11-unopened-replacement-detail',
  '12-unknown-excluded-from-expiring',
  '13-archive-history',
  '14-archived-provenance',
];
const cat07ExpectedArtifacts = [
  'browser-events-cat07-freshness.json',
  'expo-cat07-freshness.log',
  'report.md',
];
for (const viewport of cat07Viewports) {
  const bootstrapPrefix = `bootstrap-cat07-freshness-${viewport.id}`;
  cat07ExpectedArtifacts.push(
    `${bootstrapPrefix}-catalog-ready.json`,
    `${bootstrapPrefix}-catalog-ready.png`,
    `${bootstrapPrefix}-result.json`,
  );
  const scenarioPrefix = `freshness-lifecycle-${viewport.id}`;
  for (const step of cat07Steps) {
    cat07ExpectedArtifacts.push(`${scenarioPrefix}-${step}.json`, `${scenarioPrefix}-${step}.png`);
  }
  cat07ExpectedArtifacts.push(`${scenarioPrefix}-result.json`);
}
cat07ExpectedArtifacts.sort();
const cat07SummaryFixture = {
  artifacts: cat07ExpectedArtifacts,
  bootstrapResults: cat07Viewports.map((viewport, index) => ({
    browserFailures: [],
    completedAt: cat07AtSecond(index * 20 + 5),
    error: null,
    nativeDeviceProof: false,
    runId: cat07RunId,
    startedAt: cat07AtSecond(index * 20 + 1),
    surface: 'expo-web',
    verdict: 'pass',
    viewport,
  })),
  completedAt: cat07AtSecond(65),
  expectedBootstrapCount: 3,
  expectedExecutionCount: 3,
  limitations: ['Synthetic packet-binding fixture; not release evidence.'],
  nativeDeviceProof: false,
  requiredViewports: cat07Viewports,
  runId: cat07RunId,
  scenarios: cat07Viewports.map((viewport, index) => ({
    browserFailures: [],
    completedAt: cat07AtSecond(index * 20 + 19),
    error: null,
    nativeDeviceProof: false,
    runId: cat07RunId,
    startedAt: cat07AtSecond(index * 20 + 6),
    surface: 'expo-web',
    verdict: 'pass',
    viewport,
  })),
  schemaVersion: 2,
  screenshots: cat07ExpectedArtifacts.filter((artifact) => artifact.endsWith('.png')),
  sourceGitSha: cat07SourceSha,
  startedAt: cat07AtSecond(0),
  surface: 'expo-web',
  verdict: 'pass',
  verifiedOutcomes: ['Synthetic packet-binding fixture; not release evidence.'],
};
const cat07RuntimePaths = Object.fromEntries(
  ['appData', 'cache', 'home', 'npmGlobalConfig', 'npmUserConfig', 'temp'].map((name) => [
    name,
    resolve(fixtureRoot, '.tmp', 'cat07-runtime', name),
  ]),
);
cat07SummaryFixture.runtimeProvenance = {
  browserLaunch: {
    args: cat07BrowserArguments({ userDataDir: '<fresh-profile>' }),
    schemaVersion: CAT07_BROWSER_LAUNCH_SCHEMA_VERSION,
  },
  childEnvironment: {
    keys: Object.keys(
      buildCat07ChildEnvironment({
        hostEnvironment: process.env,
        platform: process.platform,
        runtimePaths: cat07RuntimePaths,
      }),
    ).sort(),
    schemaVersion: CAT07_CHILD_ENVIRONMENT_SCHEMA_VERSION,
  },
  environmentBootstrap: {
    bytes: 1,
    schemaVersion: CAT07_ENVIRONMENT_BOOTSTRAP_SCHEMA_VERSION,
    sha256: '1'.repeat(64),
  },
  installMode: 'isolated-npm-ci-offline-ignore-scripts-then-repo-postinstall',
  packageLock: {
    bytes: cat07SourcePackageLockBytes.length,
    sha256: createHash('sha256').update(cat07SourcePackageLockBytes).digest('hex'),
  },
  runtimeTree: {
    bytes: 1,
    directoryCount: 1,
    entryCount: 2,
    fileCount: 1,
    linkCount: 0,
    rootCount: 1,
    roots: [
      {
        bytes: 1,
        directoryCount: 1,
        entryCount: 2,
        fileCount: 1,
        linkCount: 0,
        path: 'node_modules',
        sha256: '2'.repeat(64),
      },
    ],
    sha256: '3'.repeat(64),
  },
  schemaVersion: CAT07_RUNTIME_PROVENANCE_SCHEMA_VERSION,
  serverListener: {
    address: '::1',
    family: 'IPv6',
    kind: 'cat07-loopback-listener',
    method: 'inherited-node-ipc',
    port: 8720,
    schemaVersion: CAT07_LOOPBACK_ATTESTATION_SCHEMA_VERSION,
  },
  sourceTree: { bytes: 1, entryCount: 1, fileCount: 1, sha256: '4'.repeat(64) },
  tools: Object.fromEntries(
    ['browser', 'expoCli', 'git', 'node', 'npmCli'].map((name, index) => [
      name,
      {
        basename: `${name}.fixture`,
        bytes: index + 1,
        sha256: String(index + 5).repeat(64),
        version: 'fixture-version',
      },
    ]),
  ),
};
const cat07ManifestScriptFixturePath = resolve(fixtureRoot, 'scripts/e2e/human-e2e-manifest.mjs');
writeFileSync(
  cat07ManifestScriptFixturePath,
  `#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const summary = JSON.parse(readFileSync(${JSON.stringify(cat07SummaryFixtureRelativePath)}, 'utf8'));
const expected = ${JSON.stringify(cat07ExpectedArtifacts)};
const expectedHead = process.argv.find((argument) => argument.startsWith('--expected-head-sha='))?.slice('--expected-head-sha='.length);
const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const valid = process.argv.includes('--cat07-committed-check') &&
  /^[a-f0-9]{40}$/.test(expectedHead ?? '') &&
  currentHead === expectedHead &&
  summary.schemaVersion === 2 &&
  summary.verdict === 'pass' &&
  summary.nativeDeviceProof === false &&
  JSON.stringify(summary.artifacts) === JSON.stringify(expected) &&
  JSON.stringify(summary.screenshots) === JSON.stringify(expected.filter((path) => path.endsWith('.png')));
if (!valid) {
  console.error('FAIL committed CAT07 full evidence contract: Phase 5 smoke rejected forged structure');
  process.exit(1);
}
console.log(\`PASS committed CAT07 full evidence contract \${expectedHead}\`);
`,
);
const writeCat07CommittedFixture = (summary) => {
  const summaryBytes = canonicalEvidenceJsonBytes(summary);
  writeFileSync(cat07SummaryFixturePath, summaryBytes);
  const manifest = JSON.parse(readFileSync(cat07ManifestFixturePath, 'utf8'));
  manifest.status = 'pass';
  manifest.gitSha = cat07SourceSha;
  manifest.gateResults = (manifest.gateResults ?? []).filter(
    (gate) => gate?.id !== 'cat07-shelf-freshness-supported-phone',
  );
  manifest.gateResults.push({
    detail: 'Synthetic Phase 5 CAT07 packet-binding fixture.',
    evidence: 'summary.json',
    evidenceExists: true,
    evidenceSha256: createHash('sha256').update(summaryBytes).digest('hex'),
    evidenceTracked: true,
    failureCount: 0,
    fileCount: 100,
    folder: 'test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current',
    folderExists: true,
    id: 'cat07-shelf-freshness-supported-phone',
    kind: 'cat07-shelf-freshness',
    required: true,
    requirementFailures: [],
    status: 'pass',
    supportClass: 'supported-phone',
    title: 'CAT07 Shelf freshness and replacement provenance lifecycle',
    verdict: 'pass',
  });
  writeFileSync(cat07ManifestFixturePath, canonicalEvidenceJsonBytes(manifest));
  writeFileSync(cat07ManifestMarkdownFixturePath, renderHumanE2eManifestMarkdown(manifest));
};
writeCat07CommittedFixture(cat07SummaryFixture);
git(fixtureRoot, ['add', '-A']);
git(fixtureRoot, ['add', '-f', '--', cat07SummaryFixtureRelativePath]);
git(fixtureRoot, ['commit', '--quiet', '-m', 'Phase 5 smoke source']);

const root = fixtureRoot;
const phase5SourceGitSha = currentGitSha();
const packetPath = resolve(root, 'scripts/phase5/build-device-qa-packet.mjs');
const iosBuildId = '9f7b48e1-7a52-4efb-9d93-3e93a2bf13e5';
const appBundleIdentifier = 'com.layerwell.phase5smoke';
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

const governedPhase5EvidencePaths = new Set();
const governedPhase5EvidencePrefixes = [
  'docs/phase-5/evidence/widget-lifecycle/',
  'docs/phase-5/evidence/native-ocr/',
  'docs/phase-5/evidence/camera-lifecycle/',
  'docs/phase-5/evidence/performance/',
];

function recordGovernedPhase5EvidencePath(relativePath) {
  if (governedPhase5EvidencePrefixes.some((prefix) => relativePath.startsWith(prefix))) {
    governedPhase5EvidencePaths.add(relativePath);
  }
}

function artifact(relativePath, bytes, mediaType) {
  mkdirSync(dirname(resolve(root, relativePath)), { recursive: true });
  writeFileSync(resolve(root, relativePath), bytes);
  recordGovernedPhase5EvidencePath(relativePath);
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
  evidence.sourceGitSha = phase5SourceGitSha;
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
  recordGovernedPhase5EvidencePath(relativePath);
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
  evidence.sourceGitSha = phase5SourceGitSha;
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
  recordGovernedPhase5EvidencePath(relativePath);
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
  evidence.sourceGitSha = phase5SourceGitSha;
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
    displayName: 'Layerwell Staging',
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
      displayName: 'Layerwell Staging',
      appVersion: '1.0.0',
      iosBuildNumber: '42',
      cameraUsageDescription:
        'Allow Layerwell Staging to use the camera to scan product barcodes, capture ingredient labels, and take guided progress photos. Barcode frames are processed on your device; label and progress photos remain local.',
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
        'Layerwell.xcarchive/Products/Applications/Layerwell.app/Info.plist',
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
          'LAYERWELL_CAMERA_BUILD_BINDING_V1',
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
  recordGovernedPhase5EvidencePath(relativePath);
  return relativePath;
}

const cameraLifecycleEvidencePath = writeCameraLifecycleEvidenceFixture();

const performanceEvidenceRelativeRoot = `docs/phase-5/evidence/performance/device-packet-smoke-${process.pid}`;

function writePerformanceEvidenceFixture() {
  const evidence = createPerformanceEvidenceTemplate();
  evidence.thresholdsDefinedAt = '2026-07-18T12:00:00.000Z';
  evidence.thresholdsDefinedBy = 'Performance Evidence Owner';
  evidence.capturedAt = '2026-07-18T13:00:00.000Z';
  evidence.gitSha = phase5SourceGitSha;
  for (const [platform, device] of Object.entries(evidence.devices)) {
    Object.assign(
      device,
      platform === 'ios'
        ? {
            physical: true,
            buildId: iosBuildId,
            deviceModel: 'iPhone 15 Pro',
            osVersion: 'iOS 18.5',
            logicalWidth: 393,
            usableHeight: 852,
          }
        : {
            physical: true,
            buildId: '7a4d74ae-2acd-4af5-931f-b768565bcd64',
            deviceModel: 'Pixel 8',
            osVersion: 'Android 15',
            logicalWidth: 412,
            usableHeight: 892,
          },
    );
  }
  for (const [metric, threshold] of Object.entries(evidence.thresholds)) {
    threshold.maxP95 = metric === 'photo_timeline_peak_memory_mb' ? 512 : 1_500;
    threshold.rationale = `Owner-approved launch threshold for the ${metric} supported-device measurement.`;
  }
  evidence.measurements = evidence.measurements.map((measurement, index) => {
    const samples =
      measurement.metric === 'photo_timeline_peak_memory_mb'
        ? [170, 175, 180, 185, 190]
        : [100 + index, 110 + index, 120 + index, 130 + index, 140 + index];
    return {
      ...measurement,
      source:
        measurement.metric === 'photo_timeline_peak_memory_mb'
          ? 'native_profiler'
          : 'instrumented_timer',
      samples,
      ...summarizePerformanceSamples(samples),
    };
  });
  evidence.photoDataset = {
    encryptedPhotoCount: 50,
    source: 'Synthetic non-sensitive encrypted photo performance fixture.',
    plaintextDeletedAfterImport: true,
    zeroCrashes: true,
    zeroOsTerminations: true,
  };
  evidence.knownCaveats = [];
  evidence.signoff = {
    decision: 'pass',
    signedOffBy: 'Performance QA Reviewer',
    signedAt: '2026-07-18T14:00:00.000Z',
  };
  const relativePath = `${performanceEvidenceRelativeRoot}/evidence.json`;
  mkdirSync(dirname(resolve(root, relativePath)), { recursive: true });
  writeFileSync(resolve(root, relativePath), canonicalEvidenceJsonBytes(evidence));
  recordGovernedPhase5EvidencePath(relativePath);
  return relativePath;
}

const performanceEvidencePath = writePerformanceEvidenceFixture();
const releaseCandidateDir = `docs/phase-9/release-candidates/rc-phase5-smoke-${process.pid}`;
const releaseCandidateManifestPath = `${releaseCandidateDir}/manifest.md`;
mkdirSync(resolve(root, releaseCandidateDir), { recursive: true });
writeFileSync(
  resolve(root, releaseCandidateManifestPath),
  `# Synthetic Phase 5 governed evidence smoke RC\n\nSource: ${phase5SourceGitSha}\n`,
);
const governedLedgerEntries = [...governedPhase5EvidencePaths, releaseCandidateManifestPath].map(
  (path) => ({
    role: governedEvidenceRoleForPath(path, releaseCandidateDir),
    path,
    sha256: sha256(readFileSync(resolve(root, path))),
  }),
);
const governedLedger = buildGovernedEvidenceLedger({
  sourceGitSha: phase5SourceGitSha,
  releaseCandidateDir,
  publicationPolicy: captureGovernedPublicationPolicy(root, phase5SourceGitSha),
  entries: governedLedgerEntries,
});
const governedLedgerRelativePath = governedEvidenceLedgerPath(releaseCandidateDir);
writeFileSync(
  resolve(root, governedLedgerRelativePath),
  renderGovernedEvidenceLedger(governedLedger),
);
git(fixtureRoot, [
  'add',
  '-f',
  '--',
  widgetEvidenceRelativeRoot,
  nativeOcrEvidenceRelativeRoot,
  cameraEvidenceRelativeRoot,
  performanceEvidenceRelativeRoot,
  releaseCandidateDir,
]);
git(fixtureRoot, ['commit', '--quiet', '-m', 'Commit governed Phase 5 evidence']);
const governedEvidenceHead = currentGitSha();
let phase5SmokeBaselineHead = governedEvidenceHead;
if (git(fixtureRoot, ['status', '--short', '--untracked-files=all'])) {
  throw new Error('Phase 5 governed evidence smoke fixture is not clean after E.');
}
const finalHumanManifest = JSON.parse(readFileSync(cat07ManifestFixturePath, 'utf8'));
finalHumanManifest.generatedAt = '2026-08-08T00:01:30.000Z';
writeFileSync(cat07ManifestFixturePath, canonicalEvidenceJsonBytes(finalHumanManifest));
writeFileSync(cat07ManifestMarkdownFixturePath, renderHumanE2eManifestMarkdown(finalHumanManifest));
git(fixtureRoot, [
  'add',
  '--',
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
]);
git(fixtureRoot, ['commit', '--quiet', '-m', 'Commit final human-E2E manifest descendant']);
const humanManifestPrefixHead = currentGitSha();
publishGovernedFixtureUnit({
  fixtureRoot,
  unitId: 'docs/phase-4/generated/beta-coverage-report',
});
const phase5PacketPrefixHead = currentGitSha();

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
    'https://expo.dev/accounts/layerwell/projects/mobile/builds/7a4d74ae-2acd-4af5-931f-b768565bcd64',
  PHASE5_IOS_DEVICE: 'iPhone 17 Pro / iOS 26.5.2',
  PHASE5_ANDROID_DEVICE: 'Pixel 8 / Android 15',
  PHASE5_QA_SIGNOFF: 'true',
  PHASE5_SIGNED_OFF_BY: 'Tas Mohammed',
  APP_IOS_BUNDLE_IDENTIFIER: appBundleIdentifier,
  APPLE_TEAM_ID: appleTeamId,
  PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH: widgetEvidencePath,
  PHASE5_NATIVE_OCR_EVIDENCE_PATH: nativeOcrEvidencePath,
  PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH: cameraLifecycleEvidencePath,
  PHASE5_PERFORMANCE_EVIDENCE_PATH: performanceEvidencePath,
  PHASE9_RELEASE_CANDIDATE_DIR: releaseCandidateDir,
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
  PHASE5_CAT07_SYNTHETIC_CHILD_WIRING: '1',
};

let packetFixtureCounter = 0;

function run(extraEnv, strict = true) {
  packetFixtureCounter += 1;
  const fixtureId = `phase5-${process.pid}-${packetFixtureCounter}`;
  const outDirRelative = `.tmp/phase5-packet-fixtures/${fixtureId}`;
  const outDir = resolve(root, ...outDirRelative.split('/'));
  packetOutDirs.push(outDir);
  const result = spawnSync(
    process.execPath,
    [packetPath, ...(strict ? ['--strict'] : []), '--test-fixture-output'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...processBaseEnv,
        ...validEvidence,
        ...extraEnv,
        NODE_ENV: 'test',
        PHASE5_QA_PACKET_OUT_DIR: outDirRelative,
      },
    },
  );
  result.outDir = outDir;
  return result;
}

function runRejectedPacketOutput(outDir, args = [], extraEnv = {}) {
  return spawnSync(process.execPath, [packetPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...processBaseEnv,
      ...validEvidence,
      ...extraEnv,
      PHASE5_QA_PACKET_OUT_DIR: outDir,
    },
  });
}

const committedPacketJsonPath = resolve(root, 'docs/phase-5/generated/device-qa-packet.json');
const committedPacketMarkdownPath = resolve(root, 'docs/phase-5/generated/device-qa-packet.md');

function runCanonicalPacketGeneration() {
  return spawnSync(process.execPath, [packetPath, '--strict'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...validEvidence },
  });
}

function runCheck(extraEnv = {}) {
  const beforeJson = readFileSync(committedPacketJsonPath);
  const beforeMarkdown = readFileSync(committedPacketMarkdownPath);
  const result = spawnSync(process.execPath, [packetPath, '--strict', '--check'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...validEvidence, ...extraEnv },
  });
  result.outputsUnchanged =
    beforeJson.equals(readFileSync(committedPacketJsonPath)) &&
    beforeMarkdown.equals(readFileSync(committedPacketMarkdownPath));
  return result;
}

const checkDriftHelperPath = resolve(root, '.tmp/phase5-check-drift-helper.mjs');
mkdirSync(dirname(checkDriftHelperPath), { recursive: true });
writeFileSync(
  checkDriftHelperPath,
  `import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const [packetPath, targetPath] = process.argv.slice(2);
const original = readFileSync(targetPath);
const child = spawn(process.execPath, [packetPath, '--strict', '--check', '--test-check-drift-window'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PHASE5_QA_PACKET_CHECK_TEST_PAUSE_MS: '3000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let stdout = '';
let stderr = '';
let mutated = false;
child.stdout.on('data', (chunk) => {
  stdout += chunk.toString('utf8');
  if (!mutated && stdout.includes('PHASE5_QA_PACKET_CHECK_COMPARISON_COMPLETE')) {
    mutated = true;
    writeFileSync(targetPath, Buffer.concat([original, Buffer.from('\\n')]));
  }
});
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString('utf8');
});
child.on('error', (error) => {
  stderr += String(error?.stack ?? error);
});
child.on('close', (code) => {
  writeFileSync(targetPath, original);
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = code ?? 1;
});
`,
);

function runCheckWithLateDrift(relativeTargetPath) {
  const beforeJson = readFileSync(committedPacketJsonPath);
  const beforeMarkdown = readFileSync(committedPacketMarkdownPath);
  const result = spawnSync(
    process.execPath,
    [checkDriftHelperPath, packetPath, resolve(root, relativeTargetPath)],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...processBaseEnv, ...validEvidence },
      maxBuffer: 8 * 1024 * 1024,
      timeout: 60_000,
    },
  );
  result.outputsUnchanged =
    beforeJson.equals(readFileSync(committedPacketJsonPath)) &&
    beforeMarkdown.equals(readFileSync(committedPacketMarkdownPath));
  return result;
}

const canonicalPacketGeneration = runCanonicalPacketGeneration();
if (canonicalPacketGeneration.status !== 0) {
  throw new Error(
    `Phase 5 smoke could not generate the committed replay fixture:\n${canonicalPacketGeneration.stdout}\n${canonicalPacketGeneration.stderr}`,
  );
}
git(fixtureRoot, [
  'add',
  '-f',
  '--',
  'docs/phase-5/generated/device-qa-packet.json',
  'docs/phase-5/generated/device-qa-packet.md',
]);
git(fixtureRoot, ['commit', '--quiet', '-m', 'Commit canonical Phase 5 QA packet']);
phase5SmokeBaselineHead = currentGitSha();
if (git(fixtureRoot, ['status', '--short', '--untracked-files=all'])) {
  throw new Error('Phase 5 committed packet smoke fixture is not clean.');
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

function restoreGovernedEvidenceHead() {
  git(fixtureRoot, ['switch', '--quiet', '--detach', phase5SmokeBaselineHead]);
  const status = git(fixtureRoot, ['status', '--short', '--untracked-files=all']);
  if (status) throw new Error(`Phase 5 smoke could not restore governed E:\n${status}`);
}

function runWithFinalReadinessDescendants() {
  publishGovernedFixtureTail({
    fixtureRoot,
    alreadyPublishedUnitIds: [
      'docs/e2e/generated/human-e2e-manifest',
      'docs/phase-4/generated/beta-coverage-report',
      'docs/phase-5/generated/device-qa-packet',
    ],
  });
  try {
    return run({});
  } finally {
    restoreGovernedEvidenceHead();
  }
}

function runWithNearMissGeneratedDescendant() {
  const relativePath = 'docs/phase-7/generated/core-loop-qa-packet.txt';
  mkdirSync(dirname(resolve(root, relativePath)), { recursive: true });
  writeFileSync(resolve(root, relativePath), 'near-miss generated evidence path\n');
  git(fixtureRoot, ['add', '-f', '--', relativePath]);
  git(fixtureRoot, ['commit', '--quiet', '-m', 'Commit near-miss generated descendant']);
  try {
    return run({});
  } finally {
    restoreGovernedEvidenceHead();
  }
}

function runWithUnledgeredRawEvidenceMutation() {
  const absolutePath = resolve(root, performanceEvidencePath);
  const original = readFileSync(absolutePath);
  writeFileSync(absolutePath, Buffer.concat([original, Buffer.from('\n')]));
  git(fixtureRoot, ['add', '-f', '--', performanceEvidencePath]);
  git(fixtureRoot, ['commit', '--quiet', '-m', 'Commit unledgered raw evidence mutation']);
  try {
    return run({});
  } finally {
    restoreGovernedEvidenceHead();
  }
}

function runWithMismatchedEvidenceSourceCommit() {
  const absolutePath = resolve(root, performanceEvidencePath);
  const evidence = JSON.parse(readFileSync(absolutePath, 'utf8'));
  evidence.gitSha = cat07SourceSha;
  writeFileSync(absolutePath, canonicalEvidenceJsonBytes(evidence));
  git(fixtureRoot, ['add', '-f', '--', performanceEvidencePath]);
  git(fixtureRoot, ['commit', '--quiet', '-m', 'Commit mismatched evidence source binding']);
  try {
    return run({});
  } finally {
    restoreGovernedEvidenceHead();
  }
}

if (process.env.PHASE5_DEVICE_QA_SMOKE_GOVERNANCE_ONLY === '1') {
  const result = runWithFinalReadinessDescendants();
  const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
  if (
    result.status !== 0 ||
    /^FAIL /m.test(output(result)) ||
    packet.governedEvidenceChain.status !== 'pass' ||
    packet.governedEvidenceChain.sourceGitSha !== phase5SourceGitSha ||
    packet.governedEvidenceChain.evidenceCommitSha !== governedEvidenceHead ||
    packet.governedEvidenceChain.currentGitSha !== packet.gitSha ||
    packet.governedEvidenceChain.currentGitSha === governedEvidenceHead ||
    packet.governedEvidenceChain.downstreamGeneratedOnly !== true ||
    packet.governedEvidenceChain.downstreamCommitCount !== 23
  ) {
    throw new Error(
      `Phase 5 governance-only smoke failed:\n${output(result)}\n${JSON.stringify(packet.governedEvidenceChain, null, 2)}`,
    );
  }
  console.log('OK strict Phase 5 QA packet accepts the exact 22-unit R DAG and final F');
  process.exit(0);
}

function runCheckWithForgedGovernedFields() {
  const packet = JSON.parse(readFileSync(committedPacketJsonPath, 'utf8'));
  packet.governedEvidenceChain.sourceGitSha = cat07SourceSha;
  packet.governedEvidenceChain.releaseCandidateDir =
    'docs/phase-9/release-candidates/rc-forged-phase5-smoke';
  packet.governedEvidenceChain.downstreamCommitCount = 999;
  writeFileSync(committedPacketJsonPath, canonicalEvidenceJsonBytes(packet));
  git(fixtureRoot, ['add', '--', 'docs/phase-5/generated/device-qa-packet.json']);
  git(fixtureRoot, ['commit', '--quiet', '--amend', '--no-edit']);
  try {
    return runCheck();
  } finally {
    restoreGovernedEvidenceHead();
  }
}

function runCheckWithBackwardHumanManifestPrefix() {
  const packet = JSON.parse(readFileSync(committedPacketJsonPath, 'utf8'));
  const recordedCurrent = packet.governedEvidenceChain.currentGitSha;
  const recordedCount = packet.governedEvidenceChain.downstreamCommitCount;
  packet.gitSha = governedEvidenceHead;
  packet.governedEvidenceChain.currentGitSha = governedEvidenceHead;
  packet.governedEvidenceChain.downstreamCommitCount = 0;
  packet.cat07CommittedEvidence.headSha = governedEvidenceHead;
  packet.cat07FullEvidenceContract.headSha = governedEvidenceHead;
  writeFileSync(committedPacketJsonPath, canonicalEvidenceJsonBytes(packet));
  const markdown = readFileSync(committedPacketMarkdownPath, 'utf8')
    .replace(`Git SHA: ${recordedCurrent}`, `Git SHA: ${governedEvidenceHead}`)
    .replace(`- Current commit: ${recordedCurrent}`, `- Current commit: ${governedEvidenceHead}`)
    .replace(
      `- Allowlisted downstream commits: ${recordedCount}`,
      '- Allowlisted downstream commits: 0',
    );
  writeFileSync(committedPacketMarkdownPath, markdown);
  git(fixtureRoot, [
    'add',
    '--',
    'docs/phase-5/generated/device-qa-packet.json',
    'docs/phase-5/generated/device-qa-packet.md',
  ]);
  git(fixtureRoot, ['commit', '--quiet', '--amend', '--no-edit']);
  try {
    return runCheck();
  } finally {
    restoreGovernedEvidenceHead();
  }
}

function runCheckWithForgedPacketField() {
  const packet = JSON.parse(readFileSync(committedPacketJsonPath, 'utf8'));
  packet.purpose = 'Hand-edited forged Phase 5 packet purpose.';
  writeFileSync(committedPacketJsonPath, canonicalEvidenceJsonBytes(packet));
  git(fixtureRoot, ['add', '--', 'docs/phase-5/generated/device-qa-packet.json']);
  git(fixtureRoot, ['commit', '--quiet', '--amend', '--no-edit']);
  try {
    return runCheck();
  } finally {
    restoreGovernedEvidenceHead();
  }
}

function runCheckWithStaleMarkdown() {
  writeFileSync(
    committedPacketMarkdownPath,
    Buffer.concat([readFileSync(committedPacketMarkdownPath), Buffer.from('stale hand edit\n')]),
  );
  git(fixtureRoot, ['add', '--', 'docs/phase-5/generated/device-qa-packet.md']);
  git(fixtureRoot, ['commit', '--quiet', '--amend', '--no-edit']);
  try {
    return runCheck();
  } finally {
    restoreGovernedEvidenceHead();
  }
}

function runCheckWithDirtyRawEvidence() {
  const absolutePath = resolve(root, performanceEvidencePath);
  const original = readFileSync(absolutePath);
  writeFileSync(absolutePath, Buffer.concat([original, Buffer.from('\n')]));
  try {
    return runCheck();
  } finally {
    writeFileSync(absolutePath, original);
  }
}

function runWithCat07WorkingTreeMismatch() {
  const original = readFileSync(cat07SummaryFixturePath);
  writeFileSync(
    cat07SummaryFixturePath,
    `${JSON.stringify({ ...cat07SummaryFixture, verdict: 'fail' }, null, 2)}\n`,
  );
  try {
    return run({});
  } finally {
    writeFileSync(cat07SummaryFixturePath, original);
  }
}

function runWithMalformedCommittedCat07Summary() {
  writeCat07CommittedFixture({ ...cat07SummaryFixture, verdict: 'fail' });
  git(fixtureRoot, ['add', '-A']);
  git(fixtureRoot, ['commit', '--quiet', '-m', 'Commit malformed CAT07 summary smoke']);
  const result = run({});
  writeCat07CommittedFixture(cat07SummaryFixture);
  git(fixtureRoot, ['add', '-A']);
  git(fixtureRoot, ['commit', '--quiet', '-m', 'Restore valid CAT07 summary smoke']);
  return result;
}

function runWithStructurallyPlausibleForgedCat07Summary() {
  const forged = {
    ...cat07SummaryFixture,
    artifacts: cat07SummaryFixture.artifacts.map((artifact, index) =>
      index === 0 ? 'forged-browser-events.json' : artifact,
    ),
  };
  writeCat07CommittedFixture(forged);
  git(fixtureRoot, ['add', '-A']);
  git(fixtureRoot, ['commit', '--quiet', '-m', 'Commit plausible forged CAT07 summary smoke']);
  const result = run({});
  writeCat07CommittedFixture(cat07SummaryFixture);
  git(fixtureRoot, ['add', '-A']);
  git(fixtureRoot, ['commit', '--quiet', '-m', 'Restore full CAT07 summary smoke']);
  return result;
}

function runWithCat07SummaryOutsideHead() {
  git(fixtureRoot, ['rm', '--cached', '--', cat07SummaryFixtureRelativePath]);
  git(fixtureRoot, ['commit', '--quiet', '-m', 'Remove tracked CAT07 smoke summary']);
  return run({});
}

function runWithCameraEvidenceJunctionEscape() {
  const outside = mkdtempSync(join(tmpdir(), 'layerwell-camera-packet-outside-'));
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

function runRealCat07ContractSmoke() {
  return spawnSync(
    process.execPath,
    [resolve(sourceRoot, 'scripts/e2e/human-e2e-manifest.mjs'), '--cat07-contract-smoke'],
    {
      cwd: sourceRoot,
      encoding: 'utf8',
      env: { ...processBaseEnv },
      maxBuffer: 2 * 1024 * 1024,
      timeout: 180_000,
    },
  );
}

const cases = [
  {
    name: 'Phase 5 packet rejects caller-selected normal output directories',
    result: runRejectedPacketOutput('docs/phase-5/caller-selected'),
    expect(result) {
      return (
        result.status !== 0 &&
        /PHASE5_QA_PACKET_OUT_DIR is reserved for an explicit repo-local Phase 5 test fixture/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'Phase 5 packet rejects traversal even in explicit test-fixture mode',
    result: runRejectedPacketOutput('../outside-phase5', ['--test-fixture-output'], {
      NODE_ENV: 'test',
    }),
    expect(result) {
      return (
        result.status !== 0 &&
        /PHASE5_QA_PACKET_OUT_DIR is reserved for an explicit repo-local Phase 5 test fixture/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'real CAT07 manifest contract passes before synthetic Phase 5 child wiring is exercised',
    result: runRealCat07ContractSmoke(),
    expect(result) {
      return (
        result.status === 0 &&
        /PASS CAT07 shelf-freshness evidence contract smoke/.test(output(result))
      );
    },
  },
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
    name: 'strict Phase 5 QA packet requires governed supported-device performance evidence',
    result: run({ PHASE5_PERFORMANCE_EVIDENCE_PATH: '' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE5_PERFORMANCE_EVIDENCE_PATH; real supported-device performance evidence is not attached/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects evidence claims without an explicit selected RC',
    result: run({ PHASE9_RELEASE_CANDIDATE_DIR: '' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE9_RELEASE_CANDIDATE_DIR is required whenever Phase 5 evidence is claimed/.test(
          output(result),
        )
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
      PHASE5_IOS_BUILD_ID: `https://expo.dev/accounts/layerwell/projects/mobile/builds/${iosBuildId}?token=packet-secret-value`,
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
        packet.schemaVersion === 1 &&
        packet.kind === 'phase5_device_qa_packet' &&
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
        packet.performanceEvidence.status === 'pass' &&
        packet.performanceEvidence.summary.found ===
          packet.performanceEvidence.summary.requiredMeasurements &&
        /^[0-9a-f]{64}$/i.test(packet.performanceEvidence.sha256) &&
        packet.governedEvidenceChain.status === 'pass' &&
        packet.governedEvidenceChain.schemaVersion === 1 &&
        packet.governedEvidenceChain.kind === 'phase5_governed_evidence_chain_binding' &&
        JSON.stringify(Object.keys(packet.governedEvidenceChain).sort()) ===
          JSON.stringify(
            [
              'schemaVersion',
              'kind',
              'status',
              'sourceGitSha',
              'evidenceCommitSha',
              'currentGitSha',
              'releaseCandidateDir',
              'ledgerPath',
              'ledgerSha256',
              'ledgerEntryCount',
              'directEvidenceCommit',
              'evidenceOnlyCommit',
              'cleanWorktree',
              'normalIndexState',
              'hashesValid',
              'downstreamGeneratedOnly',
              'downstreamCommitCount',
              'roleInventories',
              'errors',
            ].sort(),
          ) &&
        packet.governedEvidenceChain.sourceGitSha === phase5SourceGitSha &&
        packet.governedEvidenceChain.evidenceCommitSha === governedEvidenceHead &&
        packet.governedEvidenceChain.currentGitSha === packet.gitSha &&
        packet.governedEvidenceChain.releaseCandidateDir === releaseCandidateDir &&
        packet.governedEvidenceChain.ledgerPath === governedLedgerRelativePath &&
        /^[0-9a-f]{64}$/i.test(packet.governedEvidenceChain.ledgerSha256) &&
        packet.governedEvidenceChain.ledgerEntryCount === governedLedgerEntries.length &&
        packet.governedEvidenceChain.directEvidenceCommit === true &&
        packet.governedEvidenceChain.evidenceOnlyCommit === true &&
        packet.governedEvidenceChain.cleanWorktree === true &&
        packet.governedEvidenceChain.hashesValid === true &&
        packet.governedEvidenceChain.downstreamGeneratedOnly === true &&
        packet.governedEvidenceChain.downstreamCommitCount === 3 &&
        packet.governedEvidenceChain.roleInventories['phase5-widget-lifecycle'].entries.length ===
          16 &&
        packet.governedEvidenceChain.roleInventories['phase5-native-ocr'].entries.length === 8 &&
        packet.governedEvidenceChain.roleInventories['phase5-camera-lifecycle'].entries.length ===
          65 &&
        packet.governedEvidenceChain.roleInventories['phase5-performance'].entries.length === 1 &&
        Object.values(packet.governedEvidenceChain.roleInventories).every(
          (inventory) =>
            JSON.stringify(Object.keys(inventory).sort()) ===
              JSON.stringify(['claimed', 'entries', 'ledgerEntryCount'].sort()) &&
            inventory.claimed === true &&
            inventory.ledgerEntryCount === inventory.entries.length &&
            inventory.entries.every(
              (entry) =>
                JSON.stringify(Object.keys(entry).sort()) ===
                  JSON.stringify(['path', 'sha256'].sort()) && /^[0-9a-f]{64}$/u.test(entry.sha256),
            ),
        ) &&
        JSON.stringify(Object.keys(packet.qaEvidence).sort()) ===
          JSON.stringify([...PHASE5_REQUIRED_QA_EVIDENCE_KEYS].sort()) &&
        JSON.stringify(Object.keys(packet.evidenceStatuses).sort()) ===
          JSON.stringify(
            [
              'widgetLifecycle',
              'nativeOcr',
              'cameraLifecycle',
              'performance',
              'governedEvidenceChain',
            ].sort(),
          ) &&
        Object.values(packet.evidenceStatuses).every((status) => status === 'pass') &&
        Array.isArray(packet.blockers) &&
        packet.blockers.length === 0 &&
        /^[0-9a-f]{40}$/i.test(packet.gitSha) &&
        packet.cat07CommittedEvidence.status === 'pass' &&
        packet.cat07CommittedEvidence.headSha === packet.gitSha &&
        packet.cat07FullEvidenceContract.status === 'pass' &&
        packet.cat07FullEvidenceContract.headSha === packet.gitSha &&
        typeof packet.gitStatus === 'string' &&
        Array.isArray(packet.warnings) &&
        packet.files.some((file) => file.path === 'scripts/phase5/build-device-qa-packet.mjs') &&
        packet.files.some((file) => file.path === 'scripts/launch/governed-evidence-chain.mjs') &&
        packet.files.some((file) => file.path === 'scripts/phase9/release-qa-integrity.mjs') &&
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
        packet.files.some((file) => file.path === 'scripts/e2e/evidence-diagnostic-hygiene.mjs') &&
        packet.files.some((file) => file.path === 'scripts/e2e/cat07-png-contract.mjs') &&
        packet.files.some((file) => file.path === 'scripts/e2e/cat07-committed-evidence.mjs') &&
        [
          'scripts/e2e/cat07-shelf-freshness-audit.mjs',
          'scripts/e2e/cat07-shelf-freshness-audit.test.mjs',
          'scripts/phase2/local-supabase-contract.mjs',
          'scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql',
          'scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql',
          'scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql',
          'supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
          'supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql',
          'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
          'supabase/tests/database/catalog_import_lifecycle.test.sql',
          'supabase/tests/database/catalog_launch_curation.test.sql',
          'supabase/tests/database/catalog_serving_gate.test.sql',
          'supabase/tests/database/cat07_truthful_freshness.test.sql',
          'docs/hugeToDo/CAT-07-SHELF-FRESHNESS-SOURCE-CHECKPOINT-2026-07-19.md',
          'test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json',
        ].every((path) =>
          packet.files.some(
            (file) => file.path === path && /^[0-9a-f]{64}$/i.test(file.sha256 ?? ''),
          ),
        ) &&
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
          'scripts/phase5/expo-widgets-57.0.9/LayerwellWidgetLifecycleStore.swift',
          'scripts/phase5/expo-widgets-57.0.9/AppIntent.swift',
          'scripts/phase5/expo-widgets-57.0.9/EntryView.swift',
          'scripts/phase5/expo-widgets-57.0.9/ExpoWidgets.podspec',
          'scripts/phase5/expo-widgets-57.0.9/LiveActivity.swift',
          'scripts/phase5/expo-widgets-57.0.9/LiveActivityFactory.swift',
          'scripts/phase5/expo-widgets-57.0.9/TimelineProvider.swift',
          'scripts/phase5/expo-widgets-57.0.9/Utils.swift',
          'scripts/phase5/expo-widgets-57.0.9/WidgetLiveActivity.swift',
          'scripts/phase5/expo-widgets-57.0.9/WidgetObject.swift',
          'scripts/phase5/expo-widgets-57.0.9/WidgetsModule.swift',
        ].every((path) =>
          packet.files.some(
            (file) => file.path === path && /^[0-9a-f]{64}$/i.test(file.sha256 ?? ''),
          ),
        )
      );
    },
  },
  {
    name: 'Phase 5 QA packet check accepts the committed canonical publication without writing',
    result: runCheck(),
    expect(result) {
      if (result.status !== 0 || result.outputsUnchanged !== true) return false;
      const packet = JSON.parse(readFileSync(committedPacketJsonPath, 'utf8'));
      return (
        /PASS committed Phase 5 QA packet matches canonical replay inputs/.test(output(result)) &&
        packet.gitSha === phase5PacketPrefixHead &&
        packet.governedEvidenceChain.currentGitSha === phase5PacketPrefixHead &&
        packet.governedEvidenceChain.downstreamCommitCount === 2
      );
    },
  },
  {
    name: 'Phase 5 QA packet check rejects missing replay evidence without writing',
    result: runCheck({ PHASE5_PERFORMANCE_EVIDENCE_PATH: '' }),
    expect(result) {
      return (
        result.status === 1 &&
        result.outputsUnchanged === true &&
        /replay inputs\/environment did not reproduce a blocker-free Phase 5 packet/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'Phase 5 QA packet check rejects mismatched replay environment without writing',
    result: runCheck({ PHASE5_SIGNED_OFF_BY: 'Different Replay Reviewer' }),
    expect(result) {
      return (
        result.status === 1 &&
        result.outputsUnchanged === true &&
        /replay inputs\/environment did not reproduce a blocker-free Phase 5 packet/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'Phase 5 QA packet check rejects forged S, RC, and prefix count without writing',
    result: runCheckWithForgedGovernedFields(),
    expect(result) {
      const text = output(result);
      return (
        result.status === 1 &&
        result.outputsUnchanged === true &&
        text.includes('source commit S does not match the fresh governed audit') &&
        text.includes(
          'selected release-candidate directory does not match the fresh governed audit',
        ) &&
        text.includes('downstreamCommitCount is not one valid prefix')
      );
    },
  },
  {
    name: 'Phase 5 QA packet check rejects a backward prefix across newer human-manifest inputs',
    result: runCheckWithBackwardHumanManifestPrefix(),
    expect(result) {
      const text = output(result);
      return (
        result.status === 1 &&
        result.outputsUnchanged === true &&
        (text.includes('governed publication commit does not change exactly the output pair') ||
          text.includes('fresh replay input does not match recorded currentGitSha'))
      );
    },
  },
  {
    name: 'Phase 5 QA packet check rejects a forged nonvolatile JSON field without writing',
    result: runCheckWithForgedPacketField(),
    expect(result) {
      return (
        result.status === 1 &&
        result.outputsUnchanged === true &&
        /packet JSON does not match canonical replay inputs/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 5 QA packet check rejects stale committed Markdown without writing',
    result: runCheckWithStaleMarkdown(),
    expect(result) {
      return (
        result.status === 1 &&
        result.outputsUnchanged === true &&
        /packet Markdown does not match canonical replay inputs/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 5 QA packet check rejects dirty raw evidence without writing',
    result: runCheckWithDirtyRawEvidence(),
    expect(result) {
      return (
        result.status === 1 &&
        result.outputsUnchanged === true &&
        /fresh governed evidence audit did not pass/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 5 QA packet check final snapshot rejects late source drift',
    result: runCheckWithLateDrift('docs/DEVICE_SUPPORT_POLICY.md'),
    expect(result) {
      return (
        result.status === 1 &&
        result.outputsUnchanged === true &&
        /docs\/DEVICE_SUPPORT_POLICY\.md working bytes changed during Phase 9 packet assembly/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'Phase 5 QA packet check evidence binding rejects late raw-artifact drift',
    result: runCheckWithLateDrift(
      JSON.parse(readFileSync(resolve(root, cameraLifecycleEvidencePath), 'utf8')).artifacts[0]
        .path,
    ),
    expect(result) {
      return (
        result.status === 1 &&
        result.outputsUnchanged === true &&
        /changed during Phase 5 packet assembly/.test(output(result))
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects dirty central generated evidence changes',
    result: runWithDirtyGeneratedEvidence({}),
    expect(result) {
      if (result.status !== 1) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.gitStatus.includes('docs/phase-3/generated/review-worklist.json') &&
        packet.governedEvidenceChain.status === 'blocked' &&
        packet.governedEvidenceChain.errors.some((error) =>
          error.includes('governed evidence validation requires a clean worktree'),
        ) &&
        packet.blockers.includes(
          'Phase 5 device QA packet requires a clean Git worktree for governed evidence validation; do not use it as final native-device evidence.',
        )
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
        packet.governedEvidenceChain.status === 'blocked' &&
        packet.blockers.includes(
          'Phase 5 device QA packet requires a clean Git worktree for governed evidence validation; do not use it as final native-device evidence.',
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
        packet.governedEvidenceChain.status === 'blocked' &&
        packet.warnings.includes(
          'Phase 5 device QA packet requires a clean Git worktree for governed evidence validation; do not use it as final native-device evidence.',
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet accepts final Phase 7 and readiness descendants',
    result: runWithFinalReadinessDescendants(),
    expect(result) {
      if (result.status !== 0 || /^FAIL /m.test(output(result))) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.governedEvidenceChain.status === 'pass' &&
        packet.governedEvidenceChain.sourceGitSha === phase5SourceGitSha &&
        packet.governedEvidenceChain.evidenceCommitSha === governedEvidenceHead &&
        packet.governedEvidenceChain.currentGitSha === packet.gitSha &&
        packet.governedEvidenceChain.currentGitSha !== governedEvidenceHead &&
        packet.governedEvidenceChain.downstreamGeneratedOnly === true &&
        packet.governedEvidenceChain.downstreamCommitCount === 23
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects a near-miss generated descendant path',
    result: runWithNearMissGeneratedDescendant(),
    expect(result) {
      if (result.status !== 1) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.governedEvidenceChain.status === 'blocked' &&
        packet.governedEvidenceChain.errors.some((error) =>
          error.includes('changes a non-allowlisted downstream path'),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects an unledgered raw-evidence mutation after E',
    result: runWithUnledgeredRawEvidenceMutation(),
    expect(result) {
      if (result.status !== 1) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.governedEvidenceChain.status === 'blocked' &&
        packet.governedEvidenceChain.errors.some((error) =>
          error.includes(`${performanceEvidencePath} changed after the evidence commit`),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects mismatched evidence source commits',
    result: runWithMismatchedEvidenceSourceCommit(),
    expect(result) {
      if (result.status !== 1) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.governedEvidenceChain.status === 'blocked' &&
        packet.governedEvidenceChain.sourceGitSha === null &&
        packet.blockers.some((blocker) =>
          blocker.includes('Governed Phase 5 evidence must share one coherent source Git SHA (S)'),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects CAT07 working bytes that differ from HEAD',
    result: runWithCat07WorkingTreeMismatch(),
    expect(result) {
      if (result.status !== 1) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return packet.blockers.some((blocker) =>
        blocker.includes(`${cat07SummaryFixtureRelativePath} working bytes do not match HEAD`),
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects a malformed committed CAT07 summary',
    result: runWithMalformedCommittedCat07Summary(),
    expect(result) {
      if (result.status !== 1) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return packet.blockers.some((blocker) =>
        blocker.includes('committed CAT07 summary verdict must be pass'),
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects a structurally plausible forged CAT07 summary',
    result: runWithStructurallyPlausibleForgedCat07Summary(),
    expect(result) {
      if (result.status !== 1) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return packet.blockers.some(
        (blocker) =>
          blocker.includes('CAT07 full evidence contract') &&
          blocker.includes('Phase 5 smoke rejected forged structure'),
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects an ignored CAT07 summary outside HEAD',
    result: runWithCat07SummaryOutsideHead(),
    expect(result) {
      if (result.status !== 1) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      const cat07Diagnostics = packet.blockers
        .filter((blocker) => blocker.startsWith('CAT07'))
        .join('\n');
      return (
        cat07Diagnostics.includes(cat07SummaryFixtureRelativePath) &&
        cat07Diagnostics.includes('must exist in HEAD') &&
        !/(?:[A-Za-z]:[\\/]|[\\/]Users[\\/]|[\\/]AppData[\\/]|\.claude[\\/]worktrees[\\/])/u.test(
          cat07Diagnostics,
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
