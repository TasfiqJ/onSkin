#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import {
  block,
  evidenceFlagEnabled,
  exists,
  markdownList,
  normalizeNamedSignoff,
  normalizeProductionDomain,
  normalizeProductionSupportEmail,
  normalizeProductionUrl,
  notApplicablePhase9EvidenceKeys,
  parseEnv,
  printResult,
  requiredPhase9EvidenceKeys,
  warn,
} from './lib.mjs';
import {
  CAT07_COMMITTED_INPUT_PATHS,
  validateCat07CommittedEvidence,
  validateCat07FullEvidenceContract,
} from '../e2e/cat07-committed-evidence.mjs';
import {
  isReleasePlatformRequired,
  launchContractSnapshot,
  platformRequirementStatus,
  validateLaunchContract,
} from '../launch/contract.mjs';
import {
  atomicWriteReleaseQaOutputs,
  canonicalReleaseRepoPath,
  captureReleaseCandidateRawEvidenceBindings,
  captureReleaseQaSnapshot,
  evaluateCat07ReleaseEvidence,
  evaluateReleaseCandidateReadiness,
  expectedReleaseCandidateMetadataPaths,
  listPinnedHeadFiles,
  PHASE9_CAT07_BOUND_INPUT_PATHS,
  pinnedSourceHashes,
  runTrustedGit,
  verifyReleaseCandidateRawEvidenceBindings,
  verifyReleaseQaSnapshot,
} from './release-qa-integrity.mjs';
import { auditReleaseCandidateGitContract } from './release-candidate-git-contract.mjs';
import {
  auditGovernedEvidenceChain,
  captureGovernedEvidenceWorkingBindings,
  renderGovernedEvidenceLedger,
  validateGovernedEvidenceChainBinding,
  validateGovernedGeneratedPublication,
  verifyGovernedEvidenceWorkingBindings,
} from '../launch/governed-evidence-chain.mjs';
import { PHASE5_REQUIRED_QA_EVIDENCE_KEYS } from '../phase5/device-qa-packet-contract.mjs';
import { PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS } from '../photo05/trend-admission-source-contract.mjs';
import { COM01A_COMMERCE_AUTHORITY_SOURCE_PATHS } from '../com01/commerce-admission-source-contract.mjs';
import { validatePhase7EvidenceInventory } from '../phase7/core-loop-qa-packet-contract.mjs';
import {
  validateClaimedBetaUpstreamPacket,
  validatePhase5UpstreamPacket,
  validatePhase7UpstreamPacket,
} from './upstream-packet-contract.mjs';

function activeConfiguredValue(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function selectGovernedCoordinate(environment, canonicalName, aliasName, selectionErrors) {
  const canonicalValue = activeConfiguredValue(environment[canonicalName]);
  const aliasValue = activeConfiguredValue(environment[aliasName]);
  if (canonicalValue !== null && aliasValue !== null && canonicalValue !== aliasValue) {
    selectionErrors.push(`${canonicalName} and ${aliasName} select different governed evidence`);
  }
  return canonicalValue ?? aliasValue;
}

function invalidGovernedEvidenceChainAudit({
  errors: auditErrors,
  sourceGitSha = null,
  releaseCandidateDir = null,
  headGitSha = null,
}) {
  return Object.freeze({
    schemaVersion: 1,
    kind: 'governed_evidence_chain_audit',
    status: 'invalid',
    sourceGitSha,
    headGitSha,
    evidenceCommitSha: null,
    releaseCandidateDir,
    ledgerPath: null,
    directEvidenceCommit: false,
    evidenceOnlyCommit: false,
    cleanWorktree: false,
    normalIndexState: false,
    ledgerValid: false,
    hashesValid: false,
    downstreamGeneratedOnly: false,
    ledger: null,
    downstreamCommits: [],
    errors: [...auditErrors],
  });
}

function verifyReplayInputsAtRecordedPrefix(snapshot, recordedCurrentGitSha, rootPath) {
  const replayErrors = [];
  for (const repoPath of [...sourceFiles, ...releaseCandidateExpectedFiles]) {
    const currentHeadBytes = snapshot.records[repoPath]?.headBytes;
    if (!Buffer.isBuffer(currentHeadBytes)) {
      replayErrors.push(`${repoPath} has no pinned current-HEAD bytes`);
      continue;
    }
    try {
      const recordedBytes = runTrustedGit(
        rootPath,
        ['show', `${recordedCurrentGitSha}:${repoPath}`],
        { maxBuffer: 64 * 1024 * 1024 },
      );
      if (!recordedBytes.equals(currentHeadBytes)) {
        replayErrors.push(`${repoPath} differs from the recorded packet-input prefix`);
      }
    } catch {
      replayErrors.push(`${repoPath} is missing from the recorded packet-input prefix`);
    }
  }
  return replayErrors;
}

function governedEvidenceChainRecord(audit, consumerErrors) {
  const ledgerBytes = audit.ledger ? renderGovernedEvidenceLedger(audit.ledger) : null;
  return Object.freeze({
    status: audit.status === 'pass' && consumerErrors.length === 0 ? 'pass' : 'blocked',
    sourceGitSha: audit.sourceGitSha ?? null,
    evidenceCommitSha: audit.evidenceCommitSha ?? null,
    currentGitSha: audit.headGitSha ?? null,
    releaseCandidateDir: audit.releaseCandidateDir ?? null,
    ledgerPath: audit.ledgerPath ?? null,
    ledgerSha256: ledgerBytes ? createHash('sha256').update(ledgerBytes).digest('hex') : null,
    ledgerEntryCount: Array.isArray(audit.ledger?.entries) ? audit.ledger.entries.length : 0,
    downstreamCommitCount: Array.isArray(audit.downstreamCommits)
      ? audit.downstreamCommits.length
      : 0,
    sourcePacketCodeBoundToSourceCommit:
      audit.status === 'pass' && audit.downstreamGeneratedOnly === true,
    errors: [...audit.errors, ...consumerErrors],
  });
}

function collectUpstreamChainBindingFailures(upstreamPacket, label, audit) {
  const upstreamChain = upstreamPacket?.governedEvidenceChain;
  const failures = validateGovernedEvidenceChainBinding(upstreamChain, audit).errors.map(
    (error) => `${label} ${error}`,
  );
  if (upstreamPacket?.gitSha !== upstreamChain?.currentGitSha) {
    failures.push(`${label} packet Git SHA does not match its governed current Git SHA`);
  }
  if (upstreamPacket?.gitStatus !== '') {
    failures.push(`${label} was not generated from a clean worktree`);
  }
  return failures;
}

function readPinnedUpstreamPacket(snapshot, repoPath, label) {
  const bytes = snapshot.records[repoPath]?.headBytes;
  if (!Buffer.isBuffer(bytes)) throw new Error(`${label} is missing from pinned HEAD`);
  const packet = JSON.parse(bytes.toString('utf8'));
  if (packet === null || typeof packet !== 'object' || Array.isArray(packet)) {
    throw new Error(`${label} must be one JSON object`);
  }
  return packet;
}

function inspectPinnedPhase5Packet(snapshot, audit) {
  const label = 'pinned Phase 5 device QA packet';
  const failures = [];
  let packet;
  try {
    packet = readPinnedUpstreamPacket(
      snapshot,
      'docs/phase-5/generated/device-qa-packet.json',
      label,
    );
  } catch (error) {
    return Object.freeze({
      status: 'blocked',
      errors: [error instanceof Error ? error.message : `${label} could not be parsed`],
    });
  }
  if (!Array.isArray(packet.blockers) || packet.blockers.length !== 0) {
    failures.push(`${label} must contain an empty blockers array`);
  }
  const qaEvidence = packet.qaEvidence;
  const qaEvidenceKeys =
    qaEvidence !== null && typeof qaEvidence === 'object' && !Array.isArray(qaEvidence)
      ? Object.keys(qaEvidence)
      : [];
  if (
    qaEvidenceKeys.length !== PHASE5_REQUIRED_QA_EVIDENCE_KEYS.length ||
    new Set(qaEvidenceKeys).size !== qaEvidenceKeys.length ||
    qaEvidenceKeys.some((key) => !PHASE5_REQUIRED_QA_EVIDENCE_KEYS.includes(key)) ||
    qaEvidenceKeys.some(
      (key) => qaEvidence[key]?.required !== true || qaEvidence[key]?.passed !== true,
    )
  ) {
    failures.push(`${label} required QA evidence inventory is not exact and passing`);
  }
  if (
    packet.buildEvidence?.qaSignedOff !== true ||
    typeof packet.buildEvidence?.signedOffBy !== 'string' ||
    packet.buildEvidence.signedOffBy.length === 0
  ) {
    failures.push(`${label} does not contain completed named native-device signoff`);
  }
  for (const [field, value] of [
    ['widgetLifecycleEvidence', packet.widgetLifecycleEvidence?.status],
    ['cameraLifecycleEvidence', packet.cameraLifecycleEvidence?.status],
    ['performanceEvidence', packet.performanceEvidence?.status],
  ]) {
    if (value !== 'pass') failures.push(`${label} ${field} is not pass`);
  }
  if (packet.nativeOcr?.qaRequired === true && packet.nativeOcr?.evidence?.status !== 'pass') {
    failures.push(`${label} required native OCR evidence is not pass`);
  }
  failures.push(...collectUpstreamChainBindingFailures(packet, label, audit));
  failures.push(...validatePhase5UpstreamPacket(packet, audit).errors);
  return Object.freeze({
    status: failures.length === 0 ? 'pass' : 'blocked',
    gitSha: packet.gitSha ?? null,
    errors: failures,
  });
}

function inspectPinnedPhase7Packet(snapshot, audit) {
  const label = 'pinned Phase 7 core-loop QA packet';
  const failures = [];
  let packet;
  try {
    packet = readPinnedUpstreamPacket(
      snapshot,
      'docs/phase-7/generated/core-loop-qa-packet.json',
      label,
    );
  } catch (error) {
    return Object.freeze({
      status: 'blocked',
      errors: [error instanceof Error ? error.message : `${label} could not be parsed`],
    });
  }
  if (!Array.isArray(packet.blockers) || packet.blockers.length !== 0) {
    failures.push(`${label} must contain an empty blockers array`);
  }
  failures.push(
    ...validatePhase7EvidenceInventory(packet.evidence).errors.map((error) => `${label} ${error}`),
  );
  if (
    packet.cat07CommittedEvidence?.status !== 'pass' ||
    packet.cat07FullEvidenceContract?.status !== 'pass'
  ) {
    failures.push(`${label} CAT07 evidence is not pass`);
  }
  if (packet.upstreamPackets?.phase5DeviceQa?.status !== 'pass') {
    failures.push(`${label} does not record a passing Phase 5 upstream role`);
  }
  if (packet.upstreamPackets?.humanE2e?.status !== 'pass') {
    failures.push(`${label} does not record a passing human-E2E upstream role`);
  }
  failures.push(...collectUpstreamChainBindingFailures(packet, label, audit));
  failures.push(...validatePhase7UpstreamPacket(packet, audit).errors);
  return Object.freeze({
    status: failures.length === 0 ? 'pass' : 'blocked',
    gitSha: packet.gitSha ?? null,
    errors: failures,
  });
}

function inspectClaimedBetaPacket(snapshot, audit, claimed) {
  const label = 'claimed pinned beta coverage packet';
  if (!claimed) return Object.freeze({ status: 'not_claimed', errors: [] });
  const failures = [];
  let packet;
  try {
    packet = readPinnedUpstreamPacket(
      snapshot,
      'docs/phase-4/generated/beta-coverage-report.json',
      label,
    );
  } catch (error) {
    return Object.freeze({
      status: 'blocked',
      errors: [error instanceof Error ? error.message : `${label} could not be parsed`],
    });
  }
  if (
    packet.status !== 'ready' ||
    !Array.isArray(packet.codeErrors) ||
    packet.codeErrors.length !== 0 ||
    !Array.isArray(packet.evidenceBlockers) ||
    packet.evidenceBlockers.length !== 0 ||
    !Array.isArray(packet.warnings) ||
    packet.warnings.length !== 0 ||
    Object.keys(packet.evidence ?? {}).length === 0 ||
    Object.values(packet.evidence ?? {}).some((value) => value !== true)
  ) {
    failures.push(`${label} is not ready with empty blocker/warning sets and complete evidence`);
  }
  failures.push(...collectUpstreamChainBindingFailures(packet, label, audit));
  failures.push(...validateClaimedBetaUpstreamPacket(packet, audit, true).errors);
  return Object.freeze({
    status: failures.length === 0 ? 'pass' : 'blocked',
    gitSha: packet.gitSha ?? null,
    errors: failures,
  });
}

const errors = [];
const warnings = [];
const root = process.cwd();
const check = process.argv.includes('--check');
const defaultPacketOutputPaths = [
  'docs/phase-9/generated/release-engineering-qa-packet.json',
  'docs/phase-9/generated/release-engineering-qa-packet.md',
];
let environmentBootstrap;
try {
  environmentBootstrap = captureReleaseQaSnapshot({
    root,
    inputPaths: ['.env.example'],
    outputPaths: defaultPacketOutputPaths,
    workingInputPaths: ['.env'],
  });
} catch {
  console.error('FAIL Phase 9 release QA packet could not pin its environment inputs.');
  process.exit(1);
}
const processEnvironment = { ...process.env };
function environmentBinding(value) {
  return JSON.stringify(
    Object.entries(value).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}
const processEnvironmentBinding = environmentBinding(processEnvironment);
function processEnvironmentStabilityErrors() {
  return environmentBinding(process.env) === processEnvironmentBinding
    ? []
    : ['process environment changed during Phase 9 packet assembly'];
}
const pinnedEnvExampleBytes = environmentBootstrap.records['.env.example'].headBytes;
if (!Buffer.isBuffer(pinnedEnvExampleBytes)) {
  console.error('FAIL .env.example must exist as a regular blob in pinned HEAD.');
  process.exit(1);
}
const env = {
  ...parseEnv(pinnedEnvExampleBytes.toString('utf8')),
  ...(environmentBootstrap.workingRecords['.env'].kind === 'file'
    ? parseEnv(environmentBootstrap.workingRecords['.env'].bytes.toString('utf8'))
    : {}),
  ...processEnvironment,
};
if (String(env.PHASE9_PACKET_OUT_DIR ?? '').trim().length > 0) {
  console.error(
    'FAIL PHASE9_PACKET_OUT_DIR cannot redirect the governed Phase 9 release packet outputs.',
  );
  process.exit(1);
}
const packetOutputPaths = [...defaultPacketOutputPaths];

const sourceFiles = [
  '.env.example',
  'docs/hugeToDo/launch-contract.json',
  'docs/hugeToDo/PAY-06-ENTITLEMENT-AUTHORITY-LANES-2026-07-14.md',
  'docs/hugeToDo/IOS-02-WIDGET-LIFECYCLE-SOURCE-CHECKPOINT-2026-07-16.md',
  'docs/hugeToDo/IOS-09-IOS-PRIVACY-SOURCE-CHECKPOINT-2026-07-16.md',
  'docs/hugeToDo/CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26.md',
  'docs/hugeToDo/CORE-07-SHARE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md',
  'docs/09-personalized-recommendations.md',
  'scripts/launch/contract.mjs',
  'scripts/core02/clinical-rule-source-contract.test.mjs',
  'scripts/core06/recommendation-admission-source-contract.test.mjs',
  'scripts/core07/share-admission-source-contract.mjs',
  'scripts/core07/share-admission-source-contract.test.mjs',
  'scripts/phase9/recommendation-zero-admission-smoke.mjs',
  'scripts/postinstall.mjs',
  'scripts/cat05/native-label-ocr-source-contract.test.mjs',
  'scripts/phase5/check-native-ocr-evidence.mjs',
  'scripts/phase5/native-ocr-evidence-contract.mjs',
  'scripts/phase5/native-ocr-evidence-smoke.mjs',
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
  'apps/mobile/src/features/healthConsent/HealthDataActivationMount.tsx',
  'apps/mobile/src/features/healthConsent/HealthDataActivationMount.test.ts',
  'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx',
  'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.navigation.test.ts',
  'apps/mobile/src/features/healthConsent/healthLifecycleRoutes.test.ts',
  'apps/mobile/src/features/healthConsent/selectiveCleanup.ts',
  'apps/mobile/src/features/healthConsent/selectiveCleanup.test.ts',
  'apps/mobile/src/lib/auth/AuthProvider.tsx',
  'apps/mobile/src/lib/auth/authDerivedCleanupAuthProviderContracts.test.ts',
  'apps/mobile/src/lib/auth/revokedCredentialActivity.ts',
  'apps/mobile/src/lib/auth/revokedCredentialActivity.test.ts',
  'package.json',
  'apps/mobile/package.json',
  '.github/workflows/quality.yml',
  'package-lock.json',
  '.github/workflows/security.yml',
  'supabase/config.toml',
  'supabase/functions/manifest.json',
  'apps/mobile/app.base.json',
  'apps/mobile/app.config.js',
  'apps/mobile/plugins/withRoutineKindWidgetPrivacyManifest.js',
  'apps/mobile/eas.json',
  'docs/phase-9/apple-ios-privacy-baseline.json',
  'docs/phase-9/ios-sdk-package-mapping.json',
  'docs/phase-9/ios-privacy-baseline-notes.md',
  'scripts/phase9/patch-react-native-view-shot-privacy.mjs',
  'scripts/phase9/patch-react-native-view-shot-privacy.test.mjs',
  'scripts/phase9/ios-privacy-contract.mjs',
  'scripts/phase9/ios-privacy-source-audit.mjs',
  'scripts/phase9/ios-privacy-source-audit.test.mjs',
  'scripts/phase9/ios-archive-privacy-evidence.mjs',
  'scripts/phase9/ios-archive-privacy-evidence.test.mjs',
  'scripts/phase9/ios-release-candidate-cross-binding.mjs',
  'scripts/phase9/release-candidate-git-contract.mjs',
  'scripts/phase9/release-candidate-git-contract.test.mjs',
  'scripts/phase9/verification-wiring-contract.mjs',
  'scripts/phase9/verification-wiring-contract.test.mjs',
  'apps/mobile/src/lib/env.ts',
  'apps/mobile/src/lib/env.test.ts',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
  'apps/mobile/src/lib/launch/phase8.ts',
  'apps/mobile/src/lib/launch/phase8.test.ts',
  'apps/mobile/src/features/growth/shareAdmission.ts',
  'apps/mobile/src/features/growth/shareAdmission.test.ts',
  'apps/mobile/src/features/growth/publicLinkAdmission.ts',
  'apps/mobile/src/features/growth/publicLinkAdmission.test.ts',
  'apps/mobile/src/features/growth/shareProjection.ts',
  'apps/mobile/src/features/growth/shareProjection.test.ts',
  'apps/mobile/src/features/growth/ConflictCard.tsx',
  'apps/mobile/src/features/growth/shareCard.ts',
  'apps/mobile/src/features/growth/shareCard.test.ts',
  'apps/mobile/src/features/growth/shareLinks.ts',
  'apps/mobile/src/features/growth/shareLinks.test.ts',
  'apps/mobile/src/features/growth/shareLandingRoute.test.ts',
  'apps/mobile/src/features/growth/cardCopy.ts',
  'apps/mobile/src/features/growth/cardCopy.test.ts',
  'apps/mobile/src/features/intelligence/conflictIdentity.ts',
  'apps/mobile/src/features/intelligence/conflictRoutes.test.ts',
  'apps/mobile/src/app/share/conflict/[ruleId].tsx',
  'apps/mobile/src/app/conflict/[ruleId].tsx',
  'apps/mobile/src/app/s/[shareId].tsx',
  'docs/phase-8/public-site/share.html',
  'apps/mobile/src/features/recommendations/admission.ts',
  'apps/mobile/src/features/recommendations/admission.test.ts',
  'apps/mobile/src/features/recommendations/goalAdmission.ts',
  'apps/mobile/src/features/recommendations/goalAdmission.test.ts',
  'apps/mobile/src/features/recommendations/goalProvenance.ts',
  'apps/mobile/src/features/recommendations/catalog.ts',
  'apps/mobile/src/features/recommendations/engine.ts',
  'apps/mobile/src/features/recommendations/engine.test.ts',
  'apps/mobile/src/features/recommendations/useRecommendations.ts',
  'apps/mobile/src/features/commerce/WhereToBuy.tsx',
  'apps/mobile/src/app/recommendations/[id].tsx',
  'supabase/migrations/20260726000071_recommendation_zero_admission.sql',
  'supabase/tests/database/recommendation_zero_admission.test.sql',
  'supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql',
  'apps/mobile/src/lib/analytics/eventRegistry.ts',
  'apps/mobile/src/lib/analytics/track.ts',
  'apps/mobile/src/app/community/ask.tsx',
  'apps/mobile/src/app/community/people-like-you.tsx',
  'apps/mobile/src/app/trend/optin.tsx',
  'apps/mobile/src/app/routine/widgets.tsx',
  'apps/mobile/src/app/routine/_layout.tsx',
  'apps/mobile/src/features/subscription/gatedRoutes.ts',
  'apps/mobile/src/features/subscription/copy.ts',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'apps/mobile/src/lib/observability/scrub.ts',
  'apps/mobile/src/lib/observability/sentry.ts',
  'apps/mobile/src/app/_layout.tsx',
  'apps/mobile/src/app/(tabs)/you.tsx',
  'apps/mobile/src/app/(tabs)/progress.tsx',
  'apps/mobile/src/app/progress/capture.tsx',
  'apps/mobile/src/app/progress/review.tsx',
  'apps/mobile/src/app/progress/[id].tsx',
  'apps/mobile/src/features/photos/PhotoTimelineLockGate.tsx',
  'apps/mobile/src/features/photos/PhotoStorageGate.tsx',
  'apps/mobile/src/features/photos/encryptedStorage.ts',
  'apps/mobile/src/features/photos/encryptedStorage.test.ts',
  'apps/mobile/src/features/photos/store.ts',
  'apps/mobile/src/features/photos/store.test.ts',
  'apps/mobile/src/features/photos/usePhotos.ts',
  'apps/mobile/src/features/settings/actions.ts',
  'apps/mobile/src/features/settings/actions.test.ts',
  'apps/mobile/src/features/settings/AccountDeletionRecoveryGate.tsx',
  'apps/mobile/src/features/settings/accountDeletionClientState.ts',
  'apps/mobile/src/features/settings/accountDeletionClientState.test.ts',
  'apps/mobile/src/features/settings/accountDeletionRecovery.ts',
  'apps/mobile/src/features/settings/accountDeletionRecovery.test.ts',
  'apps/mobile/src/features/settings/accountDeletionRecoveryGate.test.ts',
  'apps/mobile/src/features/settings/localDeviceExport.ts',
  'apps/mobile/src/features/settings/localDeviceExport.test.ts',
  'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
  'apps/mobile/src/features/settings/localPrivateDataKeys.test.ts',
  'apps/mobile/src/features/settings/localPrivateData.ts',
  'apps/mobile/src/features/settings/localPrivateData.test.ts',
  'apps/mobile/src/lib/storage/privateKV.ts',
  'apps/mobile/src/lib/storage/privateKV.test.ts',
  'apps/mobile/src/lib/supabase/largeSecureStore.ts',
  'apps/mobile/src/lib/supabase/largeSecureStore.test.ts',
  'apps/mobile/src/lib/applock/AppLockProvider.tsx',
  'apps/mobile/src/lib/applock/authenticate.ts',
  'apps/mobile/src/lib/applock/authenticate.test.ts',
  'apps/mobile/src/lib/applock/singleFlight.ts',
  'apps/mobile/src/lib/applock/singleFlight.test.ts',
  'apps/mobile/src/lib/auth/accountGeneration.ts',
  'apps/mobile/src/lib/auth/accountGeneration.test.ts',
  'apps/mobile/src/lib/auth/localAccountIsolation.ts',
  'apps/mobile/src/lib/auth/localAccountIsolation.test.ts',
  'apps/mobile/src/lib/auth/apple.ts',
  'supabase/functions/account-deletion/appleDeletionExecutor.test.ts',
  'supabase/functions/account-deletion/appleDeletionExecutor.ts',
  'supabase/functions/account-deletion/appleDeletionNetwork.test.ts',
  'supabase/functions/account-deletion/appleDeletionNetwork.ts',
  'supabase/functions/account-deletion/authDeletionExecutor.test.ts',
  'supabase/functions/account-deletion/authDeletionExecutor.ts',
  'supabase/functions/account-deletion/deletionProviderNetwork.test.ts',
  'supabase/functions/account-deletion/deletionProviderNetwork.ts',
  'supabase/functions/account-deletion/durableDeletionCore.test.ts',
  'supabase/functions/account-deletion/durableDeletionCore.ts',
  'supabase/functions/account-deletion/durableDeletionCrypto.test.ts',
  'supabase/functions/account-deletion/durableDeletionCrypto.ts',
  'supabase/functions/account-deletion/durableDeletionDatabaseGateway.test.ts',
  'supabase/functions/account-deletion/durableDeletionDatabaseGateway.ts',
  'supabase/functions/account-deletion/durableDeletionEncryptedStateStore.test.ts',
  'supabase/functions/account-deletion/durableDeletionEncryptedStateStore.ts',
  'supabase/functions/account-deletion/durableDeletionHttpHandler.test.ts',
  'supabase/functions/account-deletion/durableDeletionHttpHandler.ts',
  'supabase/functions/account-deletion/durableDeletionPayloads.test.ts',
  'supabase/functions/account-deletion/durableDeletionPayloads.ts',
  'supabase/functions/account-deletion/durableDeletionRuntime.test.ts',
  'supabase/functions/account-deletion/durableDeletionRuntime.ts',
  'supabase/functions/account-deletion/durableDeletionRuntimeCore.test.ts',
  'supabase/functions/account-deletion/durableDeletionRuntimeCore.ts',
  'supabase/functions/account-deletion/durableDeletionWorker.test.ts',
  'supabase/functions/account-deletion/durableDeletionWorker.ts',
  'supabase/functions/account-deletion/durableProviderDeletion.test.ts',
  'supabase/functions/account-deletion/durableProviderDeletion.ts',
  'supabase/functions/account-deletion/index.ts',
  'supabase/functions/account-deletion/localDeletionExecutors.test.ts',
  'supabase/functions/account-deletion/photoStorageCleanup.test.ts',
  'supabase/functions/account-deletion/photoStorageCleanup.ts',
  'supabase/functions/account-deletion/photoStorageDeletionExecutor.ts',
  'supabase/functions/account-deletion/postHogDeletionExecutor.test.ts',
  'supabase/functions/account-deletion/postHogDeletionExecutor.ts',
  'supabase/functions/account-deletion/providerDeletion.test.ts',
  'supabase/functions/account-deletion/providerDeletion.ts',
  'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.test.ts',
  'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts',
  'supabase/functions/account-deletion/serviceRoleCleanup.test.ts',
  'supabase/functions/account-deletion/serviceRoleCleanup.ts',
  'supabase/functions/account-deletion/serviceRowsDeletionExecutor.ts',
  'supabase/functions/_shared/body.ts',
  'supabase/functions/_shared/fetch.ts',
  'supabase/functions/_shared/storagePath.ts',
  'supabase/functions/_shared/storagePath.test.ts',
  'supabase/functions/_shared/rateLimitOwnership.test.ts',
  'supabase/functions/_shared/revenueCatIdentityTombstone.ts',
  'supabase/functions/_shared/revenueCatIdentityTombstone.test.ts',
  'supabase/functions/data-export/index.ts',
  'supabase/functions/data-export/exportCore.ts',
  'supabase/functions/data-export/exportCore.test.ts',
  'supabase/functions/data-export/catalogCorrectionExportCore.ts',
  'supabase/functions/data-export/catalogCorrectionExportCore.test.ts',
  'supabase/functions/data-export/healthSyncExportCore.ts',
  'supabase/functions/data-export/healthSyncExportCore.test.ts',
  'supabase/functions/data-export/exportRegistry.ts',
  'supabase/functions/data-export/exportRegistry.test.ts',
  'supabase/functions/consent-withdrawal/index.ts',
  'supabase/functions/catalog-report/deletionBarrier.test.ts',
  'supabase/functions/order-report-poll/index.ts',
  'supabase/functions/order-report-poll/orderAttributionCore.ts',
  'supabase/functions/order-report-poll/orderAttributionCore.test.ts',
  'supabase/functions/subscription-grants/index.ts',
  'supabase/functions/subscription-reconciliation/index.ts',
  'supabase/functions/subscription-reconciliation/publicationLease.ts',
  'supabase/functions/subscription-reconciliation/publicationLease.test.ts',
  'supabase/functions/subscription-reconciliation/reconciliationCore.ts',
  'supabase/functions/subscription-reconciliation/reconciliationCore.test.ts',
  'supabase/functions/subscription-reconciliation/reconciliationContract.test.ts',
  'supabase/functions/_shared/verifiedAuthSessionClaims.ts',
  'supabase/functions/catalog-search/index.ts',
  'supabase/functions/catalog-search/catalogContract.ts',
  'supabase/functions/catalog-search/catalogContract.test.ts',
  'supabase/functions/catalog-lookup/index.ts',
  'supabase/functions/catalog-lookup/catalogContract.ts',
  'supabase/functions/catalog-lookup/catalogContract.test.ts',
  'supabase/functions/catalog-report/index.ts',
  'supabase/functions/catalog-report/privacy.ts',
  'supabase/functions/catalog-report/privacy.test.ts',
  'supabase/functions/revenuecat-webhook/index.ts',
  'supabase/functions/revenuecat-webhook/webhookCore.ts',
  'supabase/functions/revenuecat-webhook/webhookCore.test.ts',
  'supabase/functions/subscription-grants/deletionBarrierContract.test.ts',
  'supabase/functions/subscription-grants/grantErrors.ts',
  'supabase/functions/subscription-grants/grantErrors.test.ts',
  'supabase/migrations/20260615000027_phase6_payments.sql',
  'supabase/migrations/20260705000034_phase9_security_definer_hardening.sql',
  'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
  'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
  'supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
  'supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql',
  'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
  'supabase/tests/database/catalog_import_lifecycle.test.sql',
  'supabase/tests/database/catalog_launch_curation.test.sql',
  'supabase/tests/database/catalog_serving_gate.test.sql',
  'supabase/tests/database/cat07_truthful_freshness.test.sql',
  'supabase/migrations/20260713000045_anonymous_photo_storage_guard.sql',
  'supabase/migrations/20260713000046_account_service_row_scrub.sql',
  'supabase/migrations/20260713000047_account_obf_contribution_erasure.sql',
  'supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql',
  'supabase/migrations/20260713000049_revenuecat_deletion_barrier_guard.sql',
  'supabase/migrations/20260713000050_service_writer_deletion_barriers.sql',
  'supabase/migrations/20260713000051_revenuecat_identity_tombstones.sql',
  'supabase/migrations/20260713000052_account_publication_fence.sql',
  'supabase/migrations/20260714000053_entitlement_authority_lanes.sql',
  'supabase/migrations/20260715000054_health_consent_withdrawal_lifecycle.sql',
  'scripts/phase9/lib.mjs',
  'scripts/phase2/supabase-rls-smoke.mjs',
  'scripts/phase9/release-contact-smoke.mjs',
  'scripts/phase9/evidence-normalization-smoke.mjs',
  'scripts/phase9/release-smoke.mjs',
  'scripts/phase9/rls-adversarial-smoke.mjs',
  'scripts/phase9/rls-adversarial.mjs',
  'scripts/phase9/edge-function-manifest-check.mjs',
  'scripts/phase9/edge-function-manifest-lib.mjs',
  'scripts/phase9/edge-function-manifest-smoke.mjs',
  'scripts/phase9/build-release-qa-packet.mjs',
  'scripts/phase9/release-qa-integrity.mjs',
  'scripts/phase9/release-qa-integrity.test.mjs',
  'scripts/launch/governed-evidence-chain.mjs',
  'scripts/launch/governed-evidence-chain.test.mjs',
  'scripts/launch/governed-publication-coverage.mjs',
  'scripts/launch/governed-publication-coverage.test.mjs',
  'scripts/phase9/git-status-exclusion.test.mjs',
  'scripts/docs/device-support-policy-audit.test.mjs',
  'scripts/phase9/dependency-sbom-contract.mjs',
  'scripts/phase9/dependency-sbom-contract.test.mjs',
  'scripts/e2e/human-e2e-manifest-contract.test.mjs',
  'scripts/phase9/build-evidence-chain-ledger.mjs',
  'scripts/phase9/build-evidence-chain-ledger.test.mjs',
  'scripts/phase5/device-qa-packet-contract.mjs',
  'scripts/phase7/core-loop-qa-packet-contract.mjs',
  'scripts/phase7/core-loop-qa-packet-contract.test.mjs',
  'scripts/phase9/upstream-packet-contract.mjs',
  'scripts/phase9/upstream-packet-contract.test.mjs',
  'docs/phase-5/generated/device-qa-packet.json',
  'docs/phase-7/generated/core-loop-qa-packet.json',
  'docs/phase-4/generated/beta-coverage-report.json',
  ...PHASE9_CAT07_BOUND_INPUT_PATHS,
  'scripts/phase9/live-supabase-adversarial.mjs',
  'scripts/phase9/live-edge-auth.mjs',
  'scripts/phase9/live-data-rights.mjs',
  'scripts/phase9/live-consent-withdrawal.mjs',
  'scripts/phase9/consent-withdrawal-evidence.mjs',
  'scripts/phase9/consent-withdrawal-evidence.test.mjs',
  'scripts/phase9/live-public-forms.mjs',
  'scripts/phase9/live-catalog-rate-limit.mjs',
  'scripts/phase9/live-order-report-poll.mjs',
  'scripts/phase9/live-revenuecat-webhook.mjs',
  'scripts/phase9/edge-auth-smoke.mjs',
  'scripts/phase9/edge-functions-check.mjs',
  'scripts/phase9/data-rights-smoke.mjs',
  'scripts/phase9/account-deletion-lifecycle-postgres-rehearsal.sql',
  'scripts/phase9/account-service-scrub-postgres-rehearsal.sql',
  'scripts/phase9/revenuecat-deletion-barrier-postgres-rehearsal.sql',
  'scripts/phase9/revenuecat-identity-tombstones-postgres-rehearsal.sql',
  'scripts/phase9/account-publication-fence-postgres-rehearsal.sql',
  'scripts/phase9/service-writer-deletion-barriers-postgres-rehearsal.sql',
  'scripts/phase9/entitlement-authority-lanes-postgres-rehearsal.sql',
  'scripts/phase9/catalog-scan-minimization-postgres-rehearsal.sql',
  'scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql',
  'scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql',
  'scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql',
  'scripts/phase9/consent-withdrawal-smoke.mjs',
  'scripts/phase9/supabase-policy-lint.mjs',
  'scripts/phase9/security-ci-smoke.mjs',
  'scripts/phase9/privacy-payload-audit.mjs',
  'scripts/phase9/dependency-sbom.mjs',
  'scripts/phase9/store-build-inspect.mjs',
  'docs/phase-9/source-of-truth.md',
  'docs/phase-9/data-inventory.md',
  'docs/phase-9/edge-function-auth-matrix.md',
  'docs/phase-9/observability-payload-audit.md',
  'docs/phase-9/security-scanner-evidence.md',
  'docs/phase-9/rollout-rollback-plan.md',
  'docs/phase-9/incident-response-plan.md',
  'docs/phase-9/beta-evidence-summary.md',
  'docs/phase-9/dependency-sbom.md',
  'docs/phase-9/release-candidates/README.md',
  'docs/phase-9/release-candidates/_template/manifest.md',
  'docs/phase-9/release-candidates/_template/commands.md',
  'docs/phase-9/release-candidates/_template/automated-verification.md',
  'docs/phase-9/release-candidates/_template/manual-qa-matrix.md',
  'docs/phase-9/release-candidates/_template/security-review.md',
  'docs/phase-9/release-candidates/_template/privacy-review.md',
  'docs/phase-9/release-candidates/_template/ios-archive-privacy-evidence.json',
  'docs/phase-9/release-candidates/_template/payments-review.md',
  'docs/phase-9/release-candidates/_template/observability-review.md',
  'docs/phase-9/release-candidates/_template/store-review-packet.md',
  'docs/phase-9/release-candidates/_template/rollout-plan.md',
  'docs/phase-9/release-candidates/_template/incident-plan.md',
  'docs/phase-9/release-candidates/_template/signoff.md',
];
for (const path of PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS) {
  if (!sourceFiles.includes(path)) sourceFiles.push(path);
}
for (const path of COM01A_COMMERCE_AUTHORITY_SOURCE_PATHS) {
  if (!sourceFiles.includes(path)) sourceFiles.push(path);
}

for (const file of sourceFiles)
  block(errors, exists(file), `${file} is missing from QA packet inputs.`);

const gitSha = environmentBootstrap.headSha;

const governedChainSelectionErrors = [];
const governedSourceGitSha = selectGovernedCoordinate(
  env,
  'PHASE9_IOS_SOURCE_GIT_SHA',
  'GOVERNED_EVIDENCE_SOURCE_GIT_SHA',
  governedChainSelectionErrors,
);
const governedReleaseCandidateSelection = selectGovernedCoordinate(
  env,
  'PHASE9_RELEASE_CANDIDATE_DIR',
  'GOVERNED_EVIDENCE_RC_DIR',
  governedChainSelectionErrors,
);
if (!/^[0-9a-f]{40}$/u.test(String(governedSourceGitSha ?? ''))) {
  governedChainSelectionErrors.push(
    'PHASE9_IOS_SOURCE_GIT_SHA (or its exact governed alias) must select one lowercase source commit',
  );
}
if (
  !/^docs\/phase-9\/release-candidates\/rc-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(
    String(governedReleaseCandidateSelection ?? ''),
  )
) {
  governedChainSelectionErrors.push(
    'PHASE9_RELEASE_CANDIDATE_DIR (or its exact governed alias) must select one immutable release candidate',
  );
}

const releaseCandidateDirValue = String(governedReleaseCandidateSelection ?? '')
  .replace(/\\/g, '/')
  .replace(/\/+$/g, '');
let releaseCandidateDir = '';
let releaseCandidateFiles = [];
let releaseCandidateExpectedFiles = [];
if (releaseCandidateDirValue) {
  try {
    releaseCandidateDir = canonicalReleaseRepoPath(root, releaseCandidateDirValue);
    releaseCandidateExpectedFiles = expectedReleaseCandidateMetadataPaths(
      root,
      releaseCandidateDir,
    );
    releaseCandidateFiles = listPinnedHeadFiles(root, gitSha, releaseCandidateDir);
  } catch {
    block(
      errors,
      false,
      'PHASE9_RELEASE_CANDIDATE_DIR must name a repository-confined directory in pinned HEAD.',
    );
  }
}

let sourceSnapshot;
try {
  sourceSnapshot = captureReleaseQaSnapshot({
    root,
    expectedHeadSha: gitSha,
    inputPaths: check
      ? [...sourceFiles, ...releaseCandidateExpectedFiles, ...packetOutputPaths]
      : [...sourceFiles, ...releaseCandidateExpectedFiles],
    outputPaths: check ? [] : packetOutputPaths,
    workingInputPaths: ['.env'],
  });
} catch {
  console.error('FAIL Phase 9 release QA packet could not capture its pinned source snapshot.');
  process.exit(1);
}
if (verifyReleaseQaSnapshot(environmentBootstrap).status !== 'pass') {
  console.error('FAIL Phase 9 release QA packet environment inputs drifted during assembly.');
  process.exit(1);
}
let governedEvidenceChainAudit;
if (governedChainSelectionErrors.length > 0) {
  governedEvidenceChainAudit = invalidGovernedEvidenceChainAudit({
    errors: governedChainSelectionErrors,
    sourceGitSha: governedSourceGitSha,
    releaseCandidateDir: governedReleaseCandidateSelection,
    headGitSha: gitSha,
  });
} else {
  try {
    governedEvidenceChainAudit = auditGovernedEvidenceChain({
      root,
      sourceGitSha: governedSourceGitSha,
      releaseCandidateDir: governedReleaseCandidateSelection,
      expectedHeadSha: gitSha,
    });
  } catch (error) {
    governedEvidenceChainAudit = invalidGovernedEvidenceChainAudit({
      errors: [
        `governed evidence chain could not be audited: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
      sourceGitSha: governedSourceGitSha,
      releaseCandidateDir: governedReleaseCandidateSelection,
      headGitSha: gitSha,
    });
  }
}
const governedChainConsumerErrors = [];
let governedEvidenceBindings = null;
if (governedEvidenceChainAudit.status === 'pass') {
  try {
    governedEvidenceBindings = captureGovernedEvidenceWorkingBindings(
      governedEvidenceChainAudit,
      root,
    );
  } catch (error) {
    governedChainConsumerErrors.push(
      error instanceof Error ? error.message : 'governed evidence files could not be bound',
    );
  }
}
const governedEvidenceChain = governedEvidenceChainRecord(
  governedEvidenceChainAudit,
  governedChainConsumerErrors,
);
for (const error of governedEvidenceChain.errors) {
  block(errors, false, `Governed evidence chain: ${error}.`);
}
let launchContract;
try {
  launchContract = JSON.parse(
    sourceSnapshot.records['docs/hugeToDo/launch-contract.json'].headBytes.toString('utf8'),
  );
  const contractErrors = validateLaunchContract(launchContract);
  if (contractErrors.length > 0) throw new Error('invalid pinned launch contract');
  launchContract = Object.freeze(launchContract);
} catch {
  console.error('FAIL Pinned launch contract is missing, malformed, or invalid.');
  process.exit(1);
}
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);
block(
  errors,
  launchContract.conflictShareAdmission.sharePublicationAdmitted === true,
  'CORE-07A share publication remains zero-admission; exact-content receipt issuance, sanitized projection review, and explicit exact-payload confirmation are unavailable.',
);
block(
  errors,
  launchContract.conflictShareAdmission.publicLinksAdmitted === true,
  'CORE-07A public links remain zero-admission; no reviewed production token, retention, revocation, deletion, abuse, or destination contract exists.',
);
block(
  errors,
  launchContract.trendInsightAdmission.trendInsightAdmitted === true,
  'PHOTO-05A Trend insights remain literal-zero-admission; no validated on-device engine or result issuer exists, and simulated metrics, consent state, tone, fixtures, legacy rows, analytics, and disabled-path side effects grant no authority.',
);
block(
  errors,
  launchContract.commerceAdmission.commerceAdmitted === true,
  'COM-01A commerce remains literal-zero-admission; the approved rail, publication authority, reviewed catalog/stacks, consent grant, partner poll, click recording, external navigation, analytics, and disabled-path side effects all remain closed.',
);
const gitStatus = sourceSnapshot.gitStatus;
warn(
  warnings,
  gitStatus.length === 0,
  'Release QA packet generated with a dirty Git worktree; do not use it as final RC evidence.',
);
warn(
  warnings,
  sourceSnapshot.integrityIssues.length === 0,
  'Release QA packet inputs do not all match regular, byte-identical blobs in pinned HEAD.',
);

const cat07Evidence = evaluateCat07ReleaseEvidence({
  expectedHeadSha: gitSha,
  snapshot: sourceSnapshot,
  validateCommitted: (validationRoot, { expectedHeadSha }) =>
    validateCat07CommittedEvidence(validationRoot, { expectedHeadSha }),
  validateFull: (validationRoot, { expectedHeadSha }) =>
    validateCat07FullEvidenceContract(validationRoot, { expectedHeadSha }),
});
for (const error of cat07Evidence.errors) {
  block(errors, false, `CAT07 launch evidence: ${error}.`);
}

const evidence = Object.fromEntries(
  requiredPhase9EvidenceKeys(launchContract).map((key) => [key, evidenceFlagEnabled(env[key])]),
);
const notApplicableEvidence = Object.fromEntries(
  notApplicablePhase9EvidenceKeys(launchContract).map((key) => [key, 'not_applicable']),
);
for (const [key, passed] of Object.entries(evidence)) {
  warn(warnings, passed, `External RC evidence missing: ${key}=true.`);
}
warn(
  warnings,
  Boolean(normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY)),
  'External RC evidence missing: PHASE9_SIGNED_OFF_BY.',
);

const upstreamPackets = {
  phase5DeviceQa: inspectPinnedPhase5Packet(sourceSnapshot, governedEvidenceChainAudit),
  phase7CoreLoop: inspectPinnedPhase7Packet(sourceSnapshot, governedEvidenceChainAudit),
  betaCoverage: inspectClaimedBetaPacket(
    sourceSnapshot,
    governedEvidenceChainAudit,
    evidence.PHASE9_BETA_EVIDENCE_PASS === true,
  ),
};
for (const [role, result] of Object.entries(upstreamPackets)) {
  for (const error of result.errors) {
    block(errors, false, `Upstream ${role}: ${error}.`);
  }
}

const claimsComplete =
  Object.values(evidence).every((passed) => passed === true) &&
  Boolean(normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY));
function runStrictIosArchiveCrossBinding() {
  const result = spawnSync(
    process.execPath,
    ['scripts/phase9/store-build-inspect.mjs', '--check', '--strict'],
    {
      cwd: root,
      env,
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 10 * 60_000,
      windowsHide: true,
    },
  );
  return { status: result.status === 0 && !result.error ? 'pass' : 'blocked' };
}
const releaseCandidateEvaluation = evaluateReleaseCandidateReadiness({
  root,
  releaseCandidateDir,
  observedTrackedFiles: releaseCandidateFiles,
  snapshot: sourceSnapshot,
  configuredArchiveEvidencePath: env.PHASE9_IOS_ARCHIVE_PRIVACY_EVIDENCE_PATH,
  configuredSourceGitSha: governedSourceGitSha,
  claimsComplete,
  auditGitContract: auditReleaseCandidateGitContract,
  auditCrossBinding: runStrictIosArchiveCrossBinding,
});
let rawEvidenceBinding = null;
const rawEvidenceErrors = [];
if (releaseCandidateEvaluation.status === 'pass') {
  try {
    rawEvidenceBinding = captureReleaseCandidateRawEvidenceBindings({
      root,
      releaseCandidateDir: releaseCandidateEvaluation.dir,
      indexBytes:
        sourceSnapshot.records[
          `${releaseCandidateEvaluation.dir}/ios-archive-privacy-evidence.json`
        ].headBytes,
    });
  } catch {
    rawEvidenceErrors.push('raw iOS archive/report files could not be hash-bound for publication');
  }
}
const releaseCandidateEvidence = {
  ...releaseCandidateEvaluation,
  status:
    releaseCandidateEvaluation.status === 'pass' && rawEvidenceBinding !== null
      ? 'pass'
      : 'blocked',
  rawEvidenceBinding: {
    status: rawEvidenceBinding === null ? 'blocked' : 'pass',
    fileCount: rawEvidenceBinding === null ? 0 : Object.keys(rawEvidenceBinding.records).length,
  },
  errors: [...releaseCandidateEvaluation.errors, ...rawEvidenceErrors],
};
for (const error of releaseCandidateEvidence.errors) {
  block(errors, false, `Release-candidate readiness: ${error}.`);
}

const packet = {
  generatedAt: new Date().toISOString(),
  status:
    errors.length === 0 &&
    warnings.length === 0 &&
    cat07Evidence.status === 'pass' &&
    releaseCandidateEvidence.status === 'pass' &&
    governedEvidenceChain.status === 'pass'
      ? 'ready'
      : 'blocked',
  launchContract: launchContractSnapshot(launchContract),
  platformStatus: {
    ios: platformRequirementStatus('ios', launchContract),
    android: platformRequirementStatus('android', launchContract),
  },
  gitSha,
  gitStatus,
  sourceSnapshot: {
    headSha: sourceSnapshot.headSha,
    gitStatusSha256: sourceSnapshot.gitStatusSha256,
    inputCount: sourceFiles.length + releaseCandidateExpectedFiles.length,
    optionalWorkingInputCount: sourceSnapshot.workingInputPaths.length,
    integrityStatus: sourceSnapshot.integrityIssues.length === 0 ? 'pass' : 'blocked',
    integrityIssues: sourceSnapshot.integrityIssues,
  },
  cat07Evidence: {
    ...cat07Evidence,
    committedInputPaths: [...CAT07_COMMITTED_INPUT_PATHS],
  },
  governedEvidenceChain,
  upstreamPackets,
  releaseIdentity: {
    appEnvironment: env.EXPO_PUBLIC_APP_ENV ?? null,
    finalBrandDomain: normalizeProductionDomain(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
    marketingUrl: normalizeProductionUrl(env.EXPO_PUBLIC_MARKETING_URL),
    appStoreUrl: normalizeProductionUrl(env.EXPO_PUBLIC_APP_STORE_URL),
    playStoreUrl: androidReleaseRequired
      ? normalizeProductionUrl(env.EXPO_PUBLIC_PLAY_STORE_URL)
      : null,
    supportEmail: normalizeProductionSupportEmail(env.EXPO_PUBLIC_SUPPORT_EMAIL),
  },
  releaseCandidate: releaseCandidateEvidence,
  evidence,
  notApplicableEvidence,
  signedOffBy: normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY) ?? '',
  sourceHashes: pinnedSourceHashes(sourceSnapshot, [
    ...sourceFiles,
    ...releaseCandidateExpectedFiles,
  ]),
  blockers: errors,
  warnings,
};

const packetMarkdown = [
  '# Phase 9 Release Engineering QA Packet',
  '',
  `Generated: ${packet.generatedAt}`,
  `Status: ${packet.status}`,
  `Git SHA: ${packet.gitSha}`,
  `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
  `NUL Git status SHA-256: ${packet.sourceSnapshot.gitStatusSha256}`,
  `Pinned input integrity: ${packet.sourceSnapshot.integrityStatus}`,
  '',
  '## Governed Evidence Chain',
  '',
  `- Status: ${packet.governedEvidenceChain.status}`,
  `- Source S: \`${packet.governedEvidenceChain.sourceGitSha ?? 'BLOCKED'}\``,
  `- Evidence E: \`${packet.governedEvidenceChain.evidenceCommitSha ?? 'BLOCKED'}\``,
  `- Current R/F HEAD: \`${packet.governedEvidenceChain.currentGitSha ?? 'BLOCKED'}\``,
  `- Selected RC: \`${packet.governedEvidenceChain.releaseCandidateDir ?? 'BLOCKED'}\``,
  `- Ledger path: \`${packet.governedEvidenceChain.ledgerPath ?? 'BLOCKED'}\``,
  `- Ledger SHA-256: \`${packet.governedEvidenceChain.ledgerSha256 ?? 'BLOCKED'}\``,
  `- Ledger entries: ${packet.governedEvidenceChain.ledgerEntryCount}`,
  `- Audited generated descendants: ${packet.governedEvidenceChain.downstreamCommitCount}`,
  `- Packet code bound to S: ${packet.governedEvidenceChain.sourcePacketCodeBoundToSourceCommit ? 'yes' : 'BLOCKED'}`,
  '',
  '## Upstream Packet Contracts',
  '',
  `- Phase 5 device QA: ${packet.upstreamPackets.phase5DeviceQa.status}`,
  `- Phase 7 core loop: ${packet.upstreamPackets.phase7CoreLoop.status}`,
  `- Beta coverage (when claimed): ${packet.upstreamPackets.betaCoverage.status}`,
  '',
  '## CAT07 Launch Evidence',
  '',
  `- Overall: ${packet.cat07Evidence.status}`,
  `- Expected HEAD: \`${packet.cat07Evidence.expectedHeadSha}\``,
  `- Committed validator: ${packet.cat07Evidence.committed.status}`,
  `- Committed validator HEAD: \`${packet.cat07Evidence.committed.headSha ?? 'BLOCKED'}\``,
  `- Full manifest validator: ${packet.cat07Evidence.full.status}`,
  `- Full manifest validator HEAD: \`${packet.cat07Evidence.full.headSha ?? 'BLOCKED'}\``,
  `- Summary SHA-256: \`${packet.cat07Evidence.committed.summarySha256 ?? 'BLOCKED'}\``,
  `- Manifest JSON SHA-256: \`${packet.cat07Evidence.committed.manifestSha256 ?? 'BLOCKED'}\``,
  `- Manifest Markdown SHA-256: \`${packet.cat07Evidence.committed.markdownSha256 ?? 'BLOCKED'}\``,
  '',
  '### CAT07 Bound Input Hashes',
  '',
  ...Object.entries(packet.cat07Evidence.boundInputHashes).map(
    ([file, value]) => `- \`${file}\`: \`${value ?? 'BLOCKED'}\``,
  ),
  '',
  '## Release Identity',
  '',
  `- Environment: ${packet.releaseIdentity.appEnvironment || 'BLOCKED'}`,
  `- Final domain: ${packet.releaseIdentity.finalBrandDomain || 'BLOCKED'}`,
  `- Marketing URL: ${packet.releaseIdentity.marketingUrl || 'BLOCKED'}`,
  `- App Store URL: ${packet.releaseIdentity.appStoreUrl || 'BLOCKED'}`,
  `- Play Store URL: ${androidReleaseRequired ? packet.releaseIdentity.playStoreUrl || 'BLOCKED' : 'NOT APPLICABLE'}`,
  `- Support email: ${packet.releaseIdentity.supportEmail || 'BLOCKED'}`,
  `- Signed off by: ${packet.signedOffBy || 'BLOCKED'}`,
  `- Release candidate folder: ${packet.releaseCandidate.dir || 'BLOCKED'}`,
  `- RC tracked inventory: ${packet.releaseCandidate.inventoryStatus}`,
  `- RC pinned metadata: ${packet.releaseCandidate.pinnedMetadataStatus}`,
  `- RC Git contract: ${packet.releaseCandidate.gitContract.status}`,
  `- RC archive/store cross-binding: ${packet.releaseCandidate.crossBinding.status}`,
  `- RC raw archive/report binding: ${packet.releaseCandidate.rawEvidenceBinding.status}`,
  '',
  '## Blockers',
  '',
  ...markdownList(errors, '- None from packet inputs.'),
  '',
  '## Warnings',
  '',
  ...markdownList(warnings),
  '',
  '## Evidence',
  '',
  ...Object.entries(evidence).map(([key, value]) => `- ${key}: ${value ? 'PASS' : 'BLOCKED'}`),
  ...Object.entries(notApplicableEvidence).map(([key, value]) => `- ${key}: ${value}`),
  '',
  '## Source Hashes',
  '',
  ...Object.entries(packet.sourceHashes).map(([file, value]) => `- \`${file}\`: \`${value}\``),
  '',
].join('\n');

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function exactIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function replaceExactlyOnce(text, search, replacement, errors, label) {
  const first = text.indexOf(search);
  if (first < 0 || text.indexOf(search, first + search.length) >= 0) {
    errors.push(`canonical Phase 9 Markdown does not contain exactly one ${label}`);
    return text;
  }
  return `${text.slice(0, first)}${replacement}${text.slice(first + search.length)}`;
}

const initialCat07EvidenceJson = JSON.stringify(cat07Evidence);

function phase9AssemblyStabilityErrors({ includeSourceSnapshot }) {
  const stabilityErrors = processEnvironmentStabilityErrors();
  if (includeSourceSnapshot) {
    stabilityErrors.push(...verifyReleaseQaSnapshot(sourceSnapshot).errors);
  }
  stabilityErrors.push(...verifyReleaseQaSnapshot(environmentBootstrap).errors);
  if (releaseCandidateEvidence.status === 'pass') {
    const rawEvidenceCheck = verifyReleaseCandidateRawEvidenceBindings(rawEvidenceBinding);
    if (rawEvidenceCheck.status !== 'pass') {
      stabilityErrors.push(...rawEvidenceCheck.errors);
    }
  }
  if (governedEvidenceChainAudit.status === 'pass') {
    if (!governedEvidenceBindings) {
      stabilityErrors.push(
        'Phase 9 packet assembly has no retained governed evidence file bindings',
      );
    } else {
      stabilityErrors.push(
        ...verifyGovernedEvidenceWorkingBindings(governedEvidenceBindings, root, {
          context: 'Phase 9 packet assembly',
        }),
      );
    }
  }
  const finalCat07Evidence = evaluateCat07ReleaseEvidence({
    expectedHeadSha: gitSha,
    snapshot: sourceSnapshot,
    validateCommitted: (validationRoot, { expectedHeadSha }) =>
      validateCat07CommittedEvidence(validationRoot, { expectedHeadSha }),
    validateFull: (validationRoot, { expectedHeadSha }) =>
      validateCat07FullEvidenceContract(validationRoot, { expectedHeadSha }),
  });
  if (JSON.stringify(finalCat07Evidence) !== initialCat07EvidenceJson) {
    stabilityErrors.push('CAT07 evidence result changed during Phase 9 packet assembly');
  }
  if (includeSourceSnapshot && governedEvidenceChainAudit.status === 'pass') {
    try {
      const finalAudit = auditGovernedEvidenceChain({
        root,
        sourceGitSha: governedSourceGitSha,
        releaseCandidateDir: governedReleaseCandidateSelection,
        expectedHeadSha: gitSha,
      });
      if (JSON.stringify(finalAudit) !== JSON.stringify(governedEvidenceChainAudit)) {
        stabilityErrors.push(
          'governed evidence-chain audit changed during Phase 9 packet assembly',
        );
      }
    } catch (error) {
      stabilityErrors.push(
        `governed evidence chain could not be re-audited during Phase 9 packet assembly: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  return stabilityErrors;
}

async function waitForCheckDriftTestWindow(checkErrors) {
  if (!process.argv.includes('--test-check-drift-window')) return;
  const rawMilliseconds = String(process.env.PHASE9_QA_PACKET_CHECK_TEST_PAUSE_MS ?? '');
  const milliseconds = Number(rawMilliseconds);
  if (
    process.env.NODE_ENV !== 'test' ||
    !/^[1-9][0-9]{2,4}$/u.test(rawMilliseconds) ||
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 100 ||
    milliseconds > 10_000
  ) {
    checkErrors.push('Phase 9 check drift window is restricted to one bounded test-only pause');
    return;
  }
  console.log('PHASE9_QA_PACKET_CHECK_COMPARISON_COMPLETE');
  await new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));
}

if (check) {
  const checkErrors = [];
  let recordedPacket = null;
  let recordedMarkdown = null;
  const jsonRecord = sourceSnapshot.records[packetOutputPaths[0]];
  const markdownRecord = sourceSnapshot.records[packetOutputPaths[1]];
  for (const [path, record] of [
    [packetOutputPaths[0], jsonRecord],
    [packetOutputPaths[1], markdownRecord],
  ]) {
    if (
      record?.workingKind !== 'file' ||
      !Buffer.isBuffer(record.workingBytes) ||
      !record.workingTreeMatchesHead ||
      !Buffer.isBuffer(record.headBytes) ||
      !record.headBytes.equals(record.workingBytes)
    ) {
      checkErrors.push(`${path} must be one committed regular file whose working bytes match HEAD`);
    }
  }
  try {
    if (
      !Buffer.isBuffer(jsonRecord?.workingBytes) ||
      !Buffer.isBuffer(markdownRecord?.workingBytes)
    ) {
      throw new Error('committed Phase 9 packet output pair is missing from the pinned snapshot');
    }
    recordedPacket = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(jsonRecord.workingBytes),
    );
    recordedMarkdown = new TextDecoder('utf-8', { fatal: true }).decode(
      markdownRecord.workingBytes,
    );
  } catch (error) {
    checkErrors.push(error instanceof Error ? error.message : String(error));
  }
  if (recordedPacket && typeof recordedMarkdown === 'string') {
    if (!canonicalJsonBytes(recordedPacket).equals(jsonRecord.workingBytes)) {
      checkErrors.push('recorded Phase 9 JSON is not canonical generated JSON');
    }
    if (!exactIsoTimestamp(recordedPacket.generatedAt)) {
      checkErrors.push('recorded Phase 9 generatedAt must be one canonical ISO timestamp');
    }
    checkErrors.push(
      ...validateGovernedGeneratedPublication(
        recordedPacket.governedEvidenceChain,
        governedEvidenceChainAudit,
        packetOutputPaths,
      ).errors,
    );
    if (recordedPacket.gitSha !== recordedPacket.governedEvidenceChain?.currentGitSha) {
      checkErrors.push('recorded Phase 9 gitSha does not match governed currentGitSha');
    }
    if (
      recordedPacket.status !== 'ready' ||
      !Array.isArray(recordedPacket.blockers) ||
      recordedPacket.blockers.length !== 0 ||
      !Array.isArray(recordedPacket.warnings) ||
      recordedPacket.warnings.length !== 0
    ) {
      checkErrors.push('recorded Phase 9 packet is not ready and blocker-free');
    }
    if (
      recordedPacket.cat07Evidence?.status !== 'pass' ||
      recordedPacket.releaseCandidate?.status !== 'pass' ||
      recordedPacket.upstreamPackets?.phase5DeviceQa?.status !== 'pass' ||
      recordedPacket.upstreamPackets?.phase7CoreLoop?.status !== 'pass' ||
      recordedPacket.upstreamPackets?.betaCoverage?.status !== 'pass'
    ) {
      checkErrors.push('recorded Phase 9 required upstream and release roles are not pass');
    }
    const requiredEvidenceKeys = requiredPhase9EvidenceKeys(launchContract);
    const recordedEvidenceKeys = Object.keys(recordedPacket.evidence ?? {});
    if (
      recordedEvidenceKeys.length !== requiredEvidenceKeys.length ||
      new Set(recordedEvidenceKeys).size !== recordedEvidenceKeys.length ||
      recordedEvidenceKeys.some((key) => !requiredEvidenceKeys.includes(key)) ||
      recordedEvidenceKeys.some((key) => recordedPacket.evidence[key] !== true)
    ) {
      checkErrors.push('recorded Phase 9 evidence inventory is not exact and passing');
    }
    if (/^[0-9a-f]{40}$/u.test(String(recordedPacket.gitSha ?? ''))) {
      checkErrors.push(
        ...verifyReplayInputsAtRecordedPrefix(sourceSnapshot, recordedPacket.gitSha, root),
      );
    }

    const rewriteCurrentHead = (value) => {
      if (Array.isArray(value)) return value.map(rewriteCurrentHead);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([key, child]) => [key, rewriteCurrentHead(child)]),
        );
      }
      return value === packet.gitSha ? recordedPacket.gitSha : value;
    };
    const replayPacket = rewriteCurrentHead(JSON.parse(JSON.stringify(packet)));
    replayPacket.generatedAt = '<generatedAt>';
    replayPacket.governedEvidenceChain.downstreamCommitCount =
      recordedPacket.governedEvidenceChain?.downstreamCommitCount;
    const comparableRecordedPacket = JSON.parse(JSON.stringify(recordedPacket));
    comparableRecordedPacket.generatedAt = '<generatedAt>';
    if (JSON.stringify(comparableRecordedPacket) !== JSON.stringify(replayPacket)) {
      checkErrors.push('recorded Phase 9 JSON is stale or forged');
    }

    let replayMarkdown = replaceExactlyOnce(
      packetMarkdown,
      `Generated: ${packet.generatedAt}`,
      'Generated: <generatedAt>',
      checkErrors,
      'fresh generatedAt line',
    );
    replayMarkdown = replayMarkdown.split(packet.gitSha).join(recordedPacket.gitSha);
    replayMarkdown = replaceExactlyOnce(
      replayMarkdown,
      `- Audited generated descendants: ${packet.governedEvidenceChain.downstreamCommitCount}`,
      `- Audited generated descendants: ${recordedPacket.governedEvidenceChain?.downstreamCommitCount}`,
      checkErrors,
      'fresh governed downstream-count line',
    );
    const comparableRecordedMarkdown = replaceExactlyOnce(
      recordedMarkdown,
      `Generated: ${recordedPacket.generatedAt}`,
      'Generated: <generatedAt>',
      checkErrors,
      'committed generatedAt line',
    );
    if (comparableRecordedMarkdown !== replayMarkdown) {
      checkErrors.push('recorded Phase 9 Markdown is stale or forged');
    }
  }
  if (checkErrors.length === 0) {
    await waitForCheckDriftTestWindow(checkErrors);
  }
  checkErrors.push(...phase9AssemblyStabilityErrors({ includeSourceSnapshot: true }));
  if (checkErrors.length > 0) {
    console.error(`FAIL Phase 9 packet check: ${[...new Set(checkErrors)].join('; ')}.`);
    process.exit(1);
  }
  console.log('Phase 9 release QA packet is current and governed.');
  process.exit(0);
}

const prePublicationErrors = phase9AssemblyStabilityErrors({ includeSourceSnapshot: true });
if (prePublicationErrors.length > 0) {
  console.error(
    `FAIL Phase 9 packet inputs changed before publication: ${[
      ...new Set(prePublicationErrors),
    ].join('; ')}.`,
  );
  process.exit(1);
}

try {
  atomicWriteReleaseQaOutputs({
    root,
    snapshot: sourceSnapshot,
    verifyAdditional() {
      return phase9AssemblyStabilityErrors({ includeSourceSnapshot: false });
    },
    outputs: [
      {
        path: packetOutputPaths[0],
        bytes: `${JSON.stringify(packet, null, 2)}\n`,
      },
      { path: packetOutputPaths[1], bytes: packetMarkdown },
    ],
  });
} catch {
  console.error(
    'FAIL Phase 9 release QA packet inputs drifted or its atomic output publication failed; packet outputs were removed.',
  );
  process.exit(1);
}

printResult('Phase 9 release QA packet', errors, warnings);
