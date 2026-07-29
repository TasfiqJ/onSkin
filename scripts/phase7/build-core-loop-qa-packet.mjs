#!/usr/bin/env node
import { createHash } from 'node:crypto';

import { evidenceFlagEnabled, normalizeNamedSignoff } from '../phase9/lib.mjs';
import {
  atomicWriteReleaseQaOutputs,
  captureReleaseQaSnapshot,
  runTrustedGit,
  verifyReleaseQaSnapshot,
} from '../phase9/release-qa-integrity.mjs';
import { launchContractSnapshot, validateLaunchContract } from '../launch/contract.mjs';
import {
  auditGovernedEvidenceChain,
  captureGovernedEvidenceWorkingBindings,
  renderGovernedEvidenceLedger,
  validateGovernedEvidenceChainBinding,
  validateGovernedGeneratedPublication,
  verifyGovernedEvidenceWorkingBindings,
} from '../launch/governed-evidence-chain.mjs';
import {
  CAT07_COMMITTED_SUMMARY_PATH,
  validateCat07CommittedEvidence,
  validateCat07FullEvidenceContract,
} from '../e2e/cat07-committed-evidence.mjs';
import { validateHumanE2eManifestReleaseRole } from '../e2e/human-e2e-manifest-contract.mjs';
import { PHASE5_REQUIRED_QA_EVIDENCE_KEYS } from '../phase5/device-qa-packet-contract.mjs';
import { PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS } from '../photo05/trend-admission-source-contract.mjs';
import { validatePhase7EvidenceInventory } from './core-loop-qa-packet-contract.mjs';

const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');
const root = process.cwd();
const defaultPacketOutDir = 'docs/phase-7/generated';
const requestedPacketOutDir = process.env.PHASE7_PACKET_OUT_DIR;
const testFixtureOutput = process.argv.includes('--test-fixture-output');
let packetOutDir = defaultPacketOutDir;
if (requestedPacketOutDir !== undefined) {
  if (
    !testFixtureOutput ||
    process.env.NODE_ENV !== 'test' ||
    !/^\.tmp\/phase7-packet-fixtures\/[a-z0-9][a-z0-9-]{0,95}$/u.test(requestedPacketOutDir)
  ) {
    console.error(
      'FAIL PHASE7_PACKET_OUT_DIR is reserved for an explicit repo-local Phase 7 test fixture.',
    );
    process.exit(1);
  }
  packetOutDir = requestedPacketOutDir;
} else if (testFixtureOutput) {
  console.error('FAIL --test-fixture-output requires one governed PHASE7_PACKET_OUT_DIR.');
  process.exit(1);
}
const packetOutputPaths = [
  `${packetOutDir}/core-loop-qa-packet.json`,
  `${packetOutDir}/core-loop-qa-packet.md`,
].map((path) => path.replace(/\\/g, '/'));
const cat07ShelfFreshnessSummaryPath = CAT07_COMMITTED_SUMMARY_PATH;

const requiredFiles = [
  'package.json',
  'docs/hugeToDo/launch-contract.json',
  'docs/hugeToDo/CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26.md',
  'docs/hugeToDo/CORE-07-SHARE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md',
  'docs/09-personalized-recommendations.md',
  'scripts/launch/contract.mjs',
  'scripts/core02/clinical-rule-source-contract.test.mjs',
  'scripts/core06/recommendation-admission-source-contract.test.mjs',
  'scripts/core07/share-admission-source-contract.mjs',
  'scripts/core07/share-admission-source-contract.test.mjs',
  'scripts/phase9/recommendation-zero-admission-smoke.mjs',
  'apps/mobile/src/lib/env.ts',
  'apps/mobile/src/lib/env.test.ts',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
  'apps/mobile/src/lib/launch/phase8.ts',
  'apps/mobile/src/lib/launch/phase8.test.ts',
  'apps/mobile/src/components/launch/DeferredSurface.tsx',
  'apps/mobile/src/components/launch/DeferredSurface.test.ts',
  'apps/mobile/src/lib/navigation/safeBack.ts',
  'apps/mobile/src/lib/navigation/safeBack.test.ts',
  'apps/mobile/src/app/(tabs)/today.tsx',
  'apps/mobile/src/app/(tabs)/progress.tsx',
  'apps/mobile/src/app/(tabs)/shelf.tsx',
  'apps/mobile/src/app/(tabs)/you.tsx',
  'apps/mobile/src/app/_layout.tsx',
  'apps/mobile/src/app/cycle/settings.tsx',
  'apps/mobile/src/app/cycle/week.tsx',
  'apps/mobile/src/app/cycle/why-tonight.tsx',
  'apps/mobile/src/app/onboarding/products.tsx',
  'apps/mobile/src/app/routine/plan.tsx',
  'apps/mobile/src/app/share/conflict/[ruleId].tsx',
  'apps/mobile/src/app/s/[shareId].tsx',
  'apps/mobile/src/app/trend/_layout.tsx',
  'apps/mobile/src/app/trend/fairness.tsx',
  'apps/mobile/src/app/trend/optin.tsx',
  'apps/mobile/src/app/conflict/[ruleId].tsx',
  'apps/mobile/src/app/recommendations/[id].tsx',
  'apps/mobile/src/app/recommendations/index.tsx',
  'apps/mobile/src/app/recommendations/preferences.tsx',
  'apps/mobile/src/app/shelf/[id].tsx',
  'apps/mobile/src/app/shelf/_layout.tsx',
  'apps/mobile/src/app/shelf/add.tsx',
  'apps/mobile/src/app/shelf/archive.tsx',
  'apps/mobile/src/app/shelf/manual.tsx',
  'apps/mobile/src/app/shelf/no-match.tsx',
  'apps/mobile/src/app/shelf/ocr.tsx',
  'apps/mobile/src/app/shelf/opened.tsx',
  'apps/mobile/src/app/shelf/replenish.tsx',
  'apps/mobile/src/app/shelf/scan.tsx',
  'apps/mobile/src/app/shelf/search.tsx',
  'apps/mobile/src/features/ask/answer.ts',
  'apps/mobile/src/features/ask/answer.test.ts',
  'apps/mobile/src/features/ask/claimsafety.test.ts',
  'apps/mobile/src/features/ask/copy.ts',
  'apps/mobile/src/features/ask/useAsk.ts',
  'apps/mobile/src/features/catalog/client.ts',
  'apps/mobile/src/features/catalog/client.test.ts',
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
  'apps/mobile/src/features/commerce/WhereToBuy.tsx',
  'apps/mobile/src/features/commerce/commerceRoutes.test.ts',
  'apps/mobile/src/features/intelligence/pao.ts',
  'apps/mobile/src/features/intelligence/pao.test.ts',
  'apps/mobile/src/features/intelligence/conflictIdentity.ts',
  'apps/mobile/src/features/intelligence/conflictRoutes.test.ts',
  'apps/mobile/src/features/notifications/BehaviouralTriggers.tsx',
  'apps/mobile/src/features/notifications/claimsafety.test.ts',
  'apps/mobile/src/features/notifications/copy.ts',
  'apps/mobile/src/features/notifications/store.ts',
  'apps/mobile/src/features/notifications/store.test.ts',
  'apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts',
  'apps/mobile/src/features/onboarding/serverSkinProfile.ts',
  'apps/mobile/src/features/onboarding/serverSkinProfile.test.ts',
  'apps/mobile/src/features/recommendations/admission.ts',
  'apps/mobile/src/features/recommendations/admission.test.ts',
  'apps/mobile/src/features/recommendations/RecommendationsTeaser.tsx',
  'apps/mobile/src/features/recommendations/RecommendationsTeaser.test.ts',
  'apps/mobile/src/features/recommendations/claimsafety.test.ts',
  'apps/mobile/src/features/recommendations/catalog.ts',
  'apps/mobile/src/features/recommendations/copy.ts',
  'apps/mobile/src/features/recommendations/engine.ts',
  'apps/mobile/src/features/recommendations/engine.test.ts',
  'apps/mobile/src/features/recommendations/fit.ts',
  'apps/mobile/src/features/recommendations/fit.test.ts',
  'apps/mobile/src/features/recommendations/fragrance.ts',
  'apps/mobile/src/features/recommendations/goalAdmission.ts',
  'apps/mobile/src/features/recommendations/goalAdmission.test.ts',
  'apps/mobile/src/features/recommendations/goalProvenance.ts',
  'apps/mobile/src/features/recommendations/loading.ts',
  'apps/mobile/src/features/recommendations/preferences.ts',
  'apps/mobile/src/features/recommendations/recommendationRoutes.test.ts',
  'apps/mobile/src/features/recommendations/replenishment.ts',
  'apps/mobile/src/features/recommendations/replenishment.test.ts',
  'apps/mobile/src/features/recommendations/store.ts',
  'apps/mobile/src/features/recommendations/store.test.ts',
  'apps/mobile/src/features/recommendations/useRecommendations.ts',
  'apps/mobile/src/features/recommendations/useRecommendations.test.ts',
  'apps/mobile/src/features/routine/activationAnalytics.ts',
  'apps/mobile/src/features/routine/activationAnalytics.test.ts',
  'apps/mobile/src/features/scheduler/cadence.ts',
  'apps/mobile/src/features/scheduler/customCycle.ts',
  'apps/mobile/src/features/scheduler/customCycle.test.ts',
  'apps/mobile/src/features/scheduler/cycleStore.ts',
  'apps/mobile/src/features/scheduler/cycleStore.test.ts',
  'apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts',
  'apps/mobile/src/features/scheduler/orchestrate.ts',
  'apps/mobile/src/features/scheduler/orchestrate.test.ts',
  'apps/mobile/src/features/scheduler/profile.ts',
  'apps/mobile/src/features/scheduler/profile.test.ts',
  'apps/mobile/src/features/scheduler/useCycle.ts',
  'apps/mobile/src/features/shelf/freshness.ts',
  'apps/mobile/src/features/shelf/freshness.test.ts',
  'apps/mobile/src/features/shelf/freshnessMigration.test.ts',
  'apps/mobile/src/features/shelf/paoProvenance.ts',
  'apps/mobile/src/features/shelf/paoProvenance.test.ts',
  'apps/mobile/src/features/shelf/shelfRoutes.test.ts',
  'apps/mobile/src/features/shelf/store.ts',
  'apps/mobile/src/features/shelf/store.test.ts',
  'apps/mobile/src/features/today/completionsStore.ts',
  'apps/mobile/src/features/today/completionsStore.test.ts',
  'apps/mobile/src/features/today/cycleCompletion.ts',
  'apps/mobile/src/features/today/cycleCompletion.test.ts',
  'apps/mobile/src/features/today/routineProjection.ts',
  'apps/mobile/src/features/today/routineProjection.test.ts',
  'apps/mobile/src/features/today/todayRoute.test.ts',
  'apps/mobile/src/features/trend/copy.ts',
  'apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts',
  'apps/mobile/src/features/trend/trendRoutes.test.ts',
  'apps/mobile/src/features/trend/useTrend.ts',
  'apps/mobile/src/lib/consent/healthDataWriteAdmissionContracts.test.ts',
  'apps/mobile/src/lib/consent/healthProcessingEpoch.ts',
  'apps/mobile/src/lib/legal/phase3LaunchGates.test.ts',
  'packages/types/src/database.types.ts',
  'supabase/functions/catalog-lookup/index.ts',
  'supabase/functions/catalog-lookup/catalogContract.ts',
  'supabase/functions/catalog-lookup/catalogContract.test.ts',
  'supabase/functions/catalog-search/index.ts',
  'supabase/functions/catalog-search/catalogContract.ts',
  'supabase/functions/catalog-search/catalogContract.test.ts',
  'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
  'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
  'supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
  'supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql',
  'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
  'supabase/migrations/20260726000071_recommendation_zero_admission.sql',
  'supabase/tests/database/catalog_import_lifecycle.test.sql',
  'supabase/tests/database/catalog_launch_curation.test.sql',
  'supabase/tests/database/catalog_serving_gate.test.sql',
  'supabase/tests/database/cat07_truthful_freshness.test.sql',
  'supabase/tests/database/recommendation_zero_admission.test.sql',
  'supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql',
  'scripts/phase7/build-core-loop-qa-packet.mjs',
  'scripts/phase7/check-core-loop.mjs',
  'scripts/phase7/check-core-loop-smoke.mjs',
  'scripts/phase7/core-loop-qa-packet-contract.mjs',
  'scripts/phase7/core-loop-qa-packet-contract.test.mjs',
  'scripts/e2e/human-e2e-manifest.mjs',
  'scripts/e2e/human-e2e-manifest-render.mjs',
  'scripts/e2e/human-e2e-manifest-contract.mjs',
  'scripts/e2e/human-e2e-manifest-contract.test.mjs',
  'scripts/e2e/evidence-diagnostic-hygiene.mjs',
  'scripts/e2e/cat07-png-contract.mjs',
  'scripts/e2e/cat07-committed-evidence.mjs',
  'scripts/e2e/cat07-shelf-freshness-audit.mjs',
  'scripts/e2e/cat07-shelf-freshness-audit.test.mjs',
  'scripts/phase2/local-supabase-contract.mjs',
  'scripts/phase5/device-qa-packet-contract.mjs',
  'scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql',
  'scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql',
  'scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql',
  'scripts/phase9/lib.mjs',
  'scripts/phase9/release-qa-integrity.mjs',
  'scripts/launch/governed-evidence-chain.mjs',
  'scripts/launch/governed-evidence-chain.test.mjs',
  'scripts/phase9/build-evidence-chain-ledger.mjs',
  'scripts/phase9/build-evidence-chain-ledger.test.mjs',
  'docs/HUMAN_SIMULATED_E2E_TESTING.md',
  'docs/E2E_TESTING_CHECKLIST.md',
  'docs/USER_FLOW_TREE.md',
  'docs/hugeToDo/CAT-07-SHELF-FRESHNESS-SOURCE-CHECKPOINT-2026-07-19.md',
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
  cat07ShelfFreshnessSummaryPath,
  'docs/phase-5/generated/device-qa-packet.json',
  'docs/phase-5/generated/device-qa-packet.md',
  'docs/phase-6/generated/payments-qa-packet.json',
  'docs/phase-6/generated/payments-qa-packet.md',
  'docs/phase-7/surface-inventory.md',
  'docs/phase-7/launch-claim-matrix.md',
  'docs/phase-7/beta-evidence-dashboard.md',
  'docs/phase-7/core-loop-qa-checklist.md',
  'docs/phase-7/phase-7-exit-review.md',
  'docs/phase-8/public-site/share.html',
];
for (const path of PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS) {
  if (!requiredFiles.includes(path)) requiredFiles.push(path);
}

const scenarios = [
  {
    surface: 'Onboarding',
    scenario: 'final age/account/consent copy, policy links, and consent ledger verified',
    evidenceKey: 'onboardingConsentQaPass',
    envKey: 'PHASE7_ONBOARDING_CONSENT_QA_PASS',
  },
  {
    surface: 'Shelf intake',
    scenario:
      'add owned products via manual/search/scan-or-OCR with source/confidence visible; exact-date intake rejects impossible/future dates; label PAO requires explicit open-jar confirmation; surfaced expiry provenance matches the winning date; reload preserves the lifecycle; re-add archives the prior unit, retains product/PAO provenance, and drops its package-specific date evidence; replenishment alerts remain off until explicit opt-in',
    evidenceKey: 'shelfIntakeQaPass',
    envKey: 'PHASE7_SHELF_INTAKE_QA_PASS',
  },
  {
    surface: 'Reviewed guidance',
    scenario:
      'reviewed conflict shows evidence and sequence guidance; unreviewed conflict stays hidden',
    evidenceKey: 'reviewedGuidanceQaPass',
    envKey: 'PHASE7_REVIEWED_GUIDANCE_QA_PASS',
  },
  {
    surface: 'Routine builder',
    scenario: 'AM/PM routine persists across restart, offline, timezone rollover',
    evidenceKey: 'routineBuilderQaPass',
    envKey: 'PHASE7_ROUTINE_BUILDER_QA_PASS',
  },
  {
    surface: 'Today check-off',
    scenario: 'offline/online check-off is idempotent and append-only',
    evidenceKey: 'todayCheckoffQaPass',
    envKey: 'PHASE7_TODAY_CHECKOFF_QA_PASS',
  },
  {
    surface: 'Photos',
    scenario:
      'baseline capture renders locally; app lock gates timeline; settings and Progress show device-only storage with no backup control or automatic upload',
    evidenceKey: 'photosPrivacyQaPass',
    envKey: 'PHASE7_PHOTOS_PRIVACY_QA_PASS',
  },
  {
    surface: 'Reminders',
    scenario: 'permission, quiet hours, Android 13+ permission, timezone/DST behavior verified',
    evidenceKey: 'remindersQaPass',
    envKey: 'PHASE7_REMINDERS_QA_PASS',
  },
  {
    surface: 'Payments',
    scenario:
      'RevenueCat purchase, restore, cancellation, expiration, refund, and webhook lifecycle verified',
    evidenceKey: 'paymentsLifecycleQaPass',
    envKey: 'PHASE7_PAYMENTS_LIFECYCLE_QA_PASS',
  },
  {
    surface: 'Privacy controls',
    scenario: 'export, account deletion, health-data withdrawal, app lock, support links verified',
    evidenceKey: 'privacyControlsQaPass',
    envKey: 'PHASE7_PRIVACY_CONTROLS_QA_PASS',
  },
  {
    surface: 'Share card',
    scenario:
      'literal zero share and public-link admission: no capture, file, network, token, native share, record-implying landing state, raw/private projection, or analytics side effect',
    evidenceKey: 'shareCardQaPass',
    envKey: 'PHASE7_SHARE_CARD_QA_PASS',
  },
  {
    surface: 'Deferred surfaces',
    scenario:
      'commerce/community posting/trend/cloud Ask/widgets/share hidden unless gates enabled',
    evidenceKey: 'deferredSurfacesQaPass',
    envKey: 'PHASE7_DEFERRED_SURFACES_QA_PASS',
  },
  {
    surface: 'Analytics',
    scenario:
      'activation, retention, payment, privacy, support, and deferred-surface events visible',
    evidenceKey: 'analyticsQaPass',
    envKey: 'PHASE7_ANALYTICS_QA_PASS',
  },
];

const evidence = {
  brandReady: evidenceFlagEnabled(process.env.PHASE7_BRAND_READY),
  supabaseRlsPass: evidenceFlagEnabled(process.env.PHASE7_SUPABASE_RLS_PASS),
  clinicalReviewPass: evidenceFlagEnabled(process.env.PHASE7_CLINICAL_REVIEW_PASS),
  catalogBetaImportPass: evidenceFlagEnabled(process.env.PHASE7_CATALOG_BETA_IMPORT_PASS),
  deviceQaPass: evidenceFlagEnabled(process.env.PHASE7_DEVICE_QA_PASS),
  revenueCatQaPass: evidenceFlagEnabled(process.env.PHASE7_REVENUECAT_QA_PASS),
  privacyExportDeletePass: evidenceFlagEnabled(process.env.PHASE7_PRIVACY_EXPORT_DELETE_PASS),
  betaDashboardReady: evidenceFlagEnabled(process.env.PHASE7_BETA_DASHBOARD_READY),
  signedOffBy: normalizeNamedSignoff(process.env.PHASE7_SIGNED_OFF_BY) ?? '',
};
for (const scenario of scenarios) {
  evidence[scenario.evidenceKey] = evidenceFlagEnabled(process.env[scenario.envKey]);
}
const evidenceInventoryValidation = validatePhase7EvidenceInventory(evidence);

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

function invalidGovernedEvidenceChainAudit({
  errors,
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
    errors: [...errors],
  });
}

function selectGovernedCoordinate({ aliasName, canonicalName, manifestValue, errors }) {
  const canonicalValue = process.env[canonicalName];
  const aliasValue = process.env[aliasName];
  if (canonicalValue != null && aliasValue != null && canonicalValue !== aliasValue) {
    errors.push(`${canonicalName} and ${aliasName} select different governed evidence values`);
  }
  const environmentValue = canonicalValue ?? aliasValue ?? null;
  if (environmentValue !== null && manifestValue != null && environmentValue !== manifestValue) {
    errors.push(`${canonicalName} does not match the pinned human-E2E manifest`);
  }
  return environmentValue ?? manifestValue ?? null;
}

function verifyReplayInputsAtRecordedPrefix(snapshot, recordedCurrentGitSha) {
  const errors = [];
  for (const repoPath of requiredFiles) {
    const currentHeadBytes = snapshot.records[repoPath]?.headBytes;
    if (!Buffer.isBuffer(currentHeadBytes)) {
      errors.push(`${repoPath} has no pinned current-HEAD bytes`);
      continue;
    }
    try {
      const recordedBytes = runTrustedGit(root, ['show', `${recordedCurrentGitSha}:${repoPath}`], {
        maxBuffer: 64 * 1024 * 1024,
      });
      if (!recordedBytes.equals(currentHeadBytes)) {
        errors.push(`${repoPath} differs from the recorded packet-input prefix`);
      }
    } catch {
      errors.push(`${repoPath} is missing from the recorded packet-input prefix`);
    }
  }
  return errors;
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

function inspectPinnedPhase5Packet(snapshot, audit) {
  const label = 'pinned Phase 5 device QA packet';
  const failures = [];
  let phase5Packet = null;
  try {
    const bytes = snapshot.records['docs/phase-5/generated/device-qa-packet.json']?.headBytes;
    if (!Buffer.isBuffer(bytes)) throw new Error(`${label} is missing from HEAD`);
    phase5Packet = JSON.parse(bytes.toString('utf8'));
    if (phase5Packet === null || typeof phase5Packet !== 'object' || Array.isArray(phase5Packet)) {
      throw new Error(`${label} is not one JSON object`);
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : `${label} could not be parsed`);
    return Object.freeze({ status: 'blocked', errors: failures });
  }
  if (!Array.isArray(phase5Packet.blockers) || phase5Packet.blockers.length !== 0) {
    failures.push(`${label} must contain an empty blockers array`);
  }
  const qaEvidence = phase5Packet.qaEvidence;
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
    phase5Packet.buildEvidence?.qaSignedOff !== true ||
    typeof phase5Packet.buildEvidence?.signedOffBy !== 'string' ||
    phase5Packet.buildEvidence.signedOffBy.length === 0
  ) {
    failures.push(`${label} does not contain completed named native-device signoff`);
  }
  for (const [field, value] of [
    ['widgetLifecycleEvidence', phase5Packet.widgetLifecycleEvidence?.status],
    ['cameraLifecycleEvidence', phase5Packet.cameraLifecycleEvidence?.status],
    ['performanceEvidence', phase5Packet.performanceEvidence?.status],
  ]) {
    if (value !== 'pass') failures.push(`${label} ${field} is not pass`);
  }
  if (
    phase5Packet.nativeOcr?.qaRequired === true &&
    phase5Packet.nativeOcr?.evidence?.status !== 'pass'
  ) {
    failures.push(`${label} required native OCR evidence is not pass`);
  }
  failures.push(...collectUpstreamChainBindingFailures(phase5Packet, label, audit));
  failures.push(
    ...validateGovernedGeneratedPublication(phase5Packet.governedEvidenceChain, audit, [
      'docs/phase-5/generated/device-qa-packet.json',
      'docs/phase-5/generated/device-qa-packet.md',
    ]).errors.map((error) => `${label} ${error}`),
  );
  return Object.freeze({
    status: failures.length === 0 ? 'pass' : 'blocked',
    gitSha: phase5Packet.gitSha ?? null,
    errors: failures,
  });
}

const blockers = [];
const warnings = [];
let sourceSnapshot;
try {
  sourceSnapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: check ? [...requiredFiles, ...packetOutputPaths] : requiredFiles,
    outputPaths: check ? [] : packetOutputPaths,
    maxAggregateInputBytes: 512 * 1024 * 1024,
    maxInputBytes: 64 * 1024 * 1024,
  });
} catch (error) {
  console.error(
    `FAIL Phase 7 source snapshot could not be captured safely: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}
let launchContract;
try {
  const launchContractBytes =
    sourceSnapshot.records['docs/hugeToDo/launch-contract.json']?.headBytes;
  if (!Buffer.isBuffer(launchContractBytes)) {
    throw new Error('pinned launch contract is missing');
  }
  launchContract = JSON.parse(launchContractBytes.toString('utf8'));
  const launchContractErrors = validateLaunchContract(launchContract);
  if (launchContractErrors.length > 0) throw new Error('pinned launch contract is invalid');
  launchContract = Object.freeze(launchContract);
} catch {
  console.error('FAIL Pinned Phase 7 launch contract is missing, malformed, or invalid.');
  process.exit(1);
}
const gitSha = sourceSnapshot.headSha;
const governedChainConsumerErrors = [];
let humanManifestChain = null;
let humanManifestPacket = null;
try {
  const humanManifestBytes =
    sourceSnapshot.records['docs/e2e/generated/human-e2e-manifest.json']?.headBytes;
  if (!Buffer.isBuffer(humanManifestBytes)) {
    throw new Error('pinned human-E2E manifest is missing');
  }
  const parsedHumanManifest = JSON.parse(humanManifestBytes.toString('utf8'));
  if (
    parsedHumanManifest === null ||
    typeof parsedHumanManifest !== 'object' ||
    Array.isArray(parsedHumanManifest) ||
    parsedHumanManifest.governedEvidenceChain === null ||
    typeof parsedHumanManifest.governedEvidenceChain !== 'object' ||
    Array.isArray(parsedHumanManifest.governedEvidenceChain)
  ) {
    throw new Error('pinned human-E2E manifest has no governed evidence-chain binding');
  }
  humanManifestPacket = parsedHumanManifest;
  humanManifestChain = parsedHumanManifest.governedEvidenceChain;
} catch (error) {
  governedChainConsumerErrors.push(
    error instanceof Error ? error.message : 'pinned human-E2E manifest could not be parsed',
  );
}
const governedChainSelectionErrors = [];
const governedSourceGitSha = selectGovernedCoordinate({
  aliasName: 'GOVERNED_EVIDENCE_SOURCE_GIT_SHA',
  canonicalName: 'PHASE9_IOS_SOURCE_GIT_SHA',
  manifestValue: humanManifestChain?.sourceGitSha,
  errors: governedChainSelectionErrors,
});
const governedReleaseCandidateDir = selectGovernedCoordinate({
  aliasName: 'GOVERNED_EVIDENCE_RC_DIR',
  canonicalName: 'PHASE9_RELEASE_CANDIDATE_DIR',
  manifestValue: humanManifestChain?.releaseCandidateDir,
  errors: governedChainSelectionErrors,
});
if (!/^[0-9a-f]{40}$/u.test(String(governedSourceGitSha ?? ''))) {
  governedChainSelectionErrors.push(
    'the governed evidence source must be one lowercase 40-character Git SHA',
  );
}
if (
  !/^docs\/phase-9\/release-candidates\/rc-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(
    String(governedReleaseCandidateDir ?? ''),
  )
) {
  governedChainSelectionErrors.push(
    'the governed evidence release candidate must be one strict immutable RC directory',
  );
}
let governedEvidenceChainAudit;
if (governedChainSelectionErrors.length > 0) {
  governedEvidenceChainAudit = invalidGovernedEvidenceChainAudit({
    errors: governedChainSelectionErrors,
    sourceGitSha: governedSourceGitSha,
    releaseCandidateDir: governedReleaseCandidateDir,
    headGitSha: gitSha,
  });
} else {
  try {
    governedEvidenceChainAudit = auditGovernedEvidenceChain({
      root,
      sourceGitSha: governedSourceGitSha,
      releaseCandidateDir: governedReleaseCandidateDir,
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
      releaseCandidateDir: governedReleaseCandidateDir,
      headGitSha: gitSha,
    });
  }
}
if (governedEvidenceChainAudit.status === 'pass') {
  if (humanManifestChain?.status !== 'pass') {
    governedChainConsumerErrors.push(
      'pinned human-E2E manifest does not record a passing governed evidence chain',
    );
  }
  const ledgerBytes = renderGovernedEvidenceLedger(governedEvidenceChainAudit.ledger);
  const exactBindings = [
    ['sourceGitSha', governedEvidenceChainAudit.sourceGitSha],
    ['evidenceCommitSha', governedEvidenceChainAudit.evidenceCommitSha],
    ['releaseCandidateDir', governedEvidenceChainAudit.releaseCandidateDir],
    ['ledgerPath', governedEvidenceChainAudit.ledgerPath],
    ['ledgerSha256', createHash('sha256').update(ledgerBytes).digest('hex')],
    ['ledgerEntryCount', governedEvidenceChainAudit.ledger.entries.length],
  ];
  for (const [field, expected] of exactBindings) {
    if (humanManifestChain?.[field] !== expected) {
      governedChainConsumerErrors.push(
        `pinned human-E2E manifest governed ${field} does not match the fresh central audit`,
      );
    }
  }
  const allowedRecordedHeads = [
    governedEvidenceChainAudit.evidenceCommitSha,
    ...governedEvidenceChainAudit.downstreamCommits.map(({ commitSha }) => commitSha),
  ];
  const recordedPrefixPosition = allowedRecordedHeads.indexOf(humanManifestChain?.currentGitSha);
  if (recordedPrefixPosition < 0) {
    governedChainConsumerErrors.push(
      'pinned human-E2E manifest current Git SHA is not E or an audited generated descendant',
    );
  } else if (humanManifestChain?.downstreamCommitCount !== recordedPrefixPosition) {
    governedChainConsumerErrors.push(
      'pinned human-E2E manifest downstream count does not match its exact prefix position',
    );
  }
}
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
const humanE2eUpstreamValidation = validateHumanE2eManifestReleaseRole(
  humanManifestPacket,
  governedEvidenceChainAudit,
);
const humanE2ePublicationValidation = validateGovernedGeneratedPublication(
  humanManifestPacket?.governedEvidenceChain,
  governedEvidenceChainAudit,
  ['docs/e2e/generated/human-e2e-manifest.json', 'docs/e2e/generated/human-e2e-manifest.md'],
);
const humanE2eUpstreamPacket = Object.freeze({
  status:
    humanE2eUpstreamValidation.status === 'pass' && humanE2ePublicationValidation.status === 'pass'
      ? 'pass'
      : 'blocked',
  gitSha: humanManifestPacket?.gitSha ?? null,
  errors: Object.freeze([
    ...humanE2eUpstreamValidation.errors,
    ...humanE2ePublicationValidation.errors,
  ]),
});
const phase5UpstreamPacket = inspectPinnedPhase5Packet(sourceSnapshot, governedEvidenceChainAudit);
const generatedEvidenceStatusExclusions = new Set(packetOutputPaths);
const gitStatus = sourceSnapshot.gitStatusEntries
  .filter((entry) => {
    const paths = [entry.path, entry.from].filter(Boolean);
    return (
      paths.length === 0 || !paths.every((path) => generatedEvidenceStatusExclusions.has(path))
    );
  })
  .map(
    (entry) =>
      `${entry.status} ${JSON.stringify(entry.path)}${
        entry.from ? ` from ${JSON.stringify(entry.from)}` : ''
      }`,
  )
  .join('\n');
const files = requiredFiles.map((path) => hashFileFromSnapshot(path, sourceSnapshot));
for (const issue of sourceSnapshot.integrityIssues) {
  blockers.push(`Phase 7 source snapshot: ${issue}.`);
}
for (const error of governedEvidenceChain.errors) {
  blockers.push(`Governed evidence chain: ${error}.`);
}
for (const error of phase5UpstreamPacket.errors) {
  blockers.push(`Phase 5 upstream packet: ${error}.`);
}
for (const error of humanE2eUpstreamPacket.errors) {
  blockers.push(`Human-E2E upstream manifest: ${error}.`);
}
if (gitStatus.length > 0) {
  const dirtyMessage =
    'Phase 7 core-loop QA packet generated with a dirty Git worktree; do not use it as final core-loop evidence.';
  if (strict) blockers.push(dirtyMessage);
  else warnings.push(dirtyMessage);
}
for (const file of files) if (!file.exists) blockers.push(`Missing ${file.path}.`);
if (launchContract.conflictShareAdmission.sharePublicationAdmitted !== true) {
  blockers.push(
    'CORE-07A share publication is not admitted; no runtime flag, final domain, reviewedBy field, or QA flag may substitute for a positive immutable exact-content share receipt.',
  );
}
if (launchContract.conflictShareAdmission.publicLinksAdmitted !== true) {
  blockers.push(
    'CORE-07A public links are not admitted; no token service, reviewed retention/revocation/deletion/abuse contract, or exact-destination confirmation is available.',
  );
}
if (launchContract.trendInsightAdmission.trendInsightAdmitted !== true) {
  blockers.push(
    'PHOTO-05A Trend insights remain literal-zero-admission; no environment, development, E2E, caller, fixture, legacy state, simulated metric, consent grant, QA flag, or stored row may substitute for a validated on-device engine and issuer-bound result.',
  );
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
for (const [key, value] of Object.entries(evidence)) {
  if (key === 'signedOffBy') {
    if (!value) blockers.push('Missing PHASE7_SIGNED_OFF_BY.');
  } else if (value !== true) {
    blockers.push(`Missing ${key} evidence.`);
  }
}
for (const error of evidenceInventoryValidation.errors) {
  if (!blockers.includes(error)) blockers.push(`Phase 7 evidence contract: ${error}.`);
}

const packet = {
  generatedAt: new Date().toISOString(),
  launchContract: launchContractSnapshot(launchContract),
  purpose: 'Phase 7 closed-beta core-loop launch QA packet.',
  gitSha,
  gitStatus,
  evidence,
  governedEvidenceChain,
  upstreamPackets: {
    humanE2e: humanE2eUpstreamPacket,
    phase5DeviceQa: phase5UpstreamPacket,
  },
  cat07CommittedEvidence,
  cat07FullEvidenceContract,
  scenarios: scenarios.map(({ surface, scenario, evidenceKey, envKey }) => ({
    surface,
    scenario,
    evidenceKey,
    envKey,
    evidencePass: evidence[evidenceKey],
  })),
  files,
  blockers,
  warnings,
};

const jsonBytes = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`, 'utf8');

const scenarioRows = scenarios
  .map(
    ({ surface, scenario, evidenceKey, envKey }) =>
      `| ${surface} | ${scenario} | \`${envKey}\` | ${evidence[evidenceKey] ? 'yes' : 'BLOCKED'} |`,
  )
  .join('\n');
const fileRows = files
  .map((file) =>
    file.exists
      ? `| ${file.path} | present | ${file.bytes} | ${file.sha256} |`
      : `| ${file.path} | missing |  |  |`,
  )
  .join('\n');
const markdownBytes = Buffer.from(
  [
    '# Generated Phase 7 Core Loop QA Packet',
    '',
    `Generated at: ${packet.generatedAt}`,
    `Git SHA: ${packet.gitSha}`,
    `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
    '',
    'Strict completion requires real brand/legal clearance, Supabase RLS evidence, clinical review, catalog import evidence, device QA, RevenueCat QA, privacy/export/delete QA, analytics dashboard readiness, and a named owner.',
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
    `- Human-E2E manifest: ${packet.upstreamPackets.humanE2e.status}`,
    `- Phase 5 device QA: ${packet.upstreamPackets.phase5DeviceQa.status}`,
    `- Phase 5 recorded head: \`${packet.upstreamPackets.phase5DeviceQa.gitSha ?? 'BLOCKED'}\``,
    '',
    '## Evidence',
    '',
    `- Brand ready: ${evidence.brandReady ? 'yes' : 'BLOCKED'}`,
    `- Supabase RLS pass: ${evidence.supabaseRlsPass ? 'yes' : 'BLOCKED'}`,
    `- Clinical review pass: ${evidence.clinicalReviewPass ? 'yes' : 'BLOCKED'}`,
    `- Catalog beta import pass: ${evidence.catalogBetaImportPass ? 'yes' : 'BLOCKED'}`,
    `- Device QA pass: ${evidence.deviceQaPass ? 'yes' : 'BLOCKED'}`,
    `- RevenueCat QA pass: ${evidence.revenueCatQaPass ? 'yes' : 'BLOCKED'}`,
    `- Privacy/export/delete pass: ${evidence.privacyExportDeletePass ? 'yes' : 'BLOCKED'}`,
    `- Beta dashboard ready: ${evidence.betaDashboardReady ? 'yes' : 'BLOCKED'}`,
    `- Signed off by: ${evidence.signedOffBy || 'BLOCKED'}`,
    '',
    '## Scenario Evidence',
    '',
    ...scenarios.map(
      ({ surface, evidenceKey, envKey }) =>
        `- ${surface} (${envKey}): ${evidence[evidenceKey] ? 'yes' : 'BLOCKED'}`,
    ),
    '',
    '## Scenarios',
    '',
    '| Surface | Required scenario set | Evidence flag | Status |',
    '| --- | --- | --- | --- |',
    scenarioRows,
    '',
    '## Files',
    '',
    '| Path | Status | Bytes | SHA-256 |',
    '| --- | --- | --- | --- |',
    fileRows,
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

function exactIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function replaceExactlyOnce(text, search, replacement, errors, label) {
  const first = text.indexOf(search);
  if (first < 0 || text.indexOf(search, first + search.length) >= 0) {
    errors.push(`canonical Phase 7 Markdown does not contain exactly one ${label}`);
    return text;
  }
  return `${text.slice(0, first)}${replacement}${text.slice(first + search.length)}`;
}

const initialCommittedEvidenceJson = JSON.stringify(cat07CommittedEvidence);
const initialFullEvidenceJson = JSON.stringify(cat07FullEvidenceContract);

function phase7AssemblyStabilityErrors({ includeSourceSnapshot }) {
  const errors = [];
  if (includeSourceSnapshot) {
    errors.push(...verifyReleaseQaSnapshot(sourceSnapshot).errors);
  }
  if (governedEvidenceChainAudit.status === 'pass') {
    if (!governedEvidenceBindings) {
      errors.push('Phase 7 packet assembly has no retained governed evidence file bindings');
    } else {
      errors.push(
        ...verifyGovernedEvidenceWorkingBindings(governedEvidenceBindings, root, {
          context: 'Phase 7 packet assembly',
        }),
      );
    }
  }
  const committed = validateCat07CommittedEvidence(root, { expectedHeadSha: gitSha });
  const full = validateCat07FullEvidenceContract(root, { expectedHeadSha: gitSha });
  if (JSON.stringify(committed) !== initialCommittedEvidenceJson) {
    errors.push('CAT07 committed evidence result changed during Phase 7 packet assembly');
  }
  if (JSON.stringify(full) !== initialFullEvidenceJson) {
    errors.push('CAT07 full evidence result changed during Phase 7 packet assembly');
  }
  if (includeSourceSnapshot && governedEvidenceChainAudit.status === 'pass') {
    try {
      const finalAudit = auditGovernedEvidenceChain({
        root,
        sourceGitSha: governedSourceGitSha,
        releaseCandidateDir: governedReleaseCandidateDir,
        expectedHeadSha: gitSha,
      });
      if (JSON.stringify(finalAudit) !== JSON.stringify(governedEvidenceChainAudit)) {
        errors.push('governed evidence-chain audit changed during Phase 7 packet assembly');
      }
    } catch (error) {
      errors.push(
        `governed evidence chain could not be re-audited during Phase 7 packet assembly: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  return errors;
}

async function waitForCheckDriftTestWindow(errors) {
  if (!process.argv.includes('--test-check-drift-window')) return;
  const rawMilliseconds = String(process.env.PHASE7_QA_PACKET_CHECK_TEST_PAUSE_MS ?? '');
  const milliseconds = Number(rawMilliseconds);
  if (
    process.env.NODE_ENV !== 'test' ||
    !/^[1-9][0-9]{2,4}$/u.test(rawMilliseconds) ||
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 100 ||
    milliseconds > 10_000
  ) {
    errors.push('Phase 7 check drift window is restricted to one bounded test-only pause');
    return;
  }
  console.log('PHASE7_QA_PACKET_CHECK_COMPARISON_COMPLETE');
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
      throw new Error('committed Phase 7 packet output pair is missing from the pinned snapshot');
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
      checkErrors.push('recorded Phase 7 JSON is not canonical generated JSON');
    }
    if (!exactIsoTimestamp(recordedPacket.generatedAt)) {
      checkErrors.push('recorded Phase 7 generatedAt must be one canonical ISO timestamp');
    }
    const publication = validateGovernedGeneratedPublication(
      recordedPacket.governedEvidenceChain,
      governedEvidenceChainAudit,
      packetOutputPaths,
    );
    checkErrors.push(...publication.errors);
    if (recordedPacket.gitSha !== recordedPacket.governedEvidenceChain?.currentGitSha) {
      checkErrors.push('recorded Phase 7 gitSha does not match governed currentGitSha');
    }
    if (!Array.isArray(recordedPacket.blockers) || recordedPacket.blockers.length !== 0) {
      checkErrors.push('recorded Phase 7 packet is blocked');
    }
    checkErrors.push(...validatePhase7EvidenceInventory(recordedPacket.evidence).errors);
    if (
      recordedPacket.upstreamPackets?.humanE2e?.status !== 'pass' ||
      recordedPacket.upstreamPackets?.phase5DeviceQa?.status !== 'pass'
    ) {
      checkErrors.push('recorded Phase 7 upstream packet roles are not pass');
    }
    if (
      recordedPacket.cat07CommittedEvidence?.status !== 'pass' ||
      recordedPacket.cat07FullEvidenceContract?.status !== 'pass'
    ) {
      checkErrors.push('recorded Phase 7 CAT07 evidence is not pass');
    }
    if (/^[0-9a-f]{40}$/u.test(String(recordedPacket.gitSha ?? ''))) {
      checkErrors.push(
        ...verifyReplayInputsAtRecordedPrefix(sourceSnapshot, recordedPacket.gitSha),
      );
    }

    const replayPacket = JSON.parse(JSON.stringify(packet));
    replayPacket.generatedAt = '<generatedAt>';
    replayPacket.gitSha = recordedPacket.gitSha;
    replayPacket.governedEvidenceChain.currentGitSha = recordedPacket.gitSha;
    replayPacket.governedEvidenceChain.downstreamCommitCount =
      recordedPacket.governedEvidenceChain?.downstreamCommitCount;
    const rewriteCurrentHead = (value) => {
      if (Array.isArray(value)) return value.map(rewriteCurrentHead);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([key, child]) => [key, rewriteCurrentHead(child)]),
        );
      }
      return value === packet.gitSha ? recordedPacket.gitSha : value;
    };
    replayPacket.cat07CommittedEvidence = rewriteCurrentHead(replayPacket.cat07CommittedEvidence);
    replayPacket.cat07FullEvidenceContract = rewriteCurrentHead(
      replayPacket.cat07FullEvidenceContract,
    );
    const comparableRecordedPacket = JSON.parse(JSON.stringify(recordedPacket));
    comparableRecordedPacket.generatedAt = '<generatedAt>';
    if (JSON.stringify(comparableRecordedPacket) !== JSON.stringify(replayPacket)) {
      checkErrors.push('recorded Phase 7 JSON is stale or forged');
    }

    let replayMarkdown = replaceExactlyOnce(
      markdownBytes.toString('utf8'),
      `Generated at: ${packet.generatedAt}`,
      'Generated at: <generatedAt>',
      checkErrors,
      'fresh generatedAt line',
    );
    replayMarkdown = replaceExactlyOnce(
      replayMarkdown,
      `Git SHA: ${packet.gitSha}`,
      `Git SHA: ${recordedPacket.gitSha}`,
      checkErrors,
      'fresh Git SHA line',
    );
    replayMarkdown = replaceExactlyOnce(
      replayMarkdown,
      `- Current R/F HEAD: \`${packet.governedEvidenceChain.currentGitSha ?? 'BLOCKED'}\``,
      `- Current R/F HEAD: \`${recordedPacket.governedEvidenceChain?.currentGitSha ?? 'BLOCKED'}\``,
      checkErrors,
      'fresh governed current-commit line',
    );
    replayMarkdown = replaceExactlyOnce(
      replayMarkdown,
      `- Audited generated descendants: ${packet.governedEvidenceChain.downstreamCommitCount}`,
      `- Audited generated descendants: ${recordedPacket.governedEvidenceChain?.downstreamCommitCount}`,
      checkErrors,
      'fresh governed downstream-count line',
    );
    const comparableRecordedMarkdown = replaceExactlyOnce(
      recordedMarkdown,
      `Generated at: ${recordedPacket.generatedAt}`,
      'Generated at: <generatedAt>',
      checkErrors,
      'committed generatedAt line',
    );
    if (comparableRecordedMarkdown !== replayMarkdown) {
      checkErrors.push('recorded Phase 7 Markdown is stale or forged');
    }
  }
  if (checkErrors.length === 0) {
    await waitForCheckDriftTestWindow(checkErrors);
  }
  checkErrors.push(...phase7AssemblyStabilityErrors({ includeSourceSnapshot: true }));
  if (checkErrors.length > 0) {
    console.error(`FAIL Phase 7 packet check: ${[...new Set(checkErrors)].join('; ')}.`);
    process.exit(1);
  }
  console.log('Phase 7 core-loop QA packet is current and governed.');
  process.exit(0);
}

const prePublicationErrors = phase7AssemblyStabilityErrors({ includeSourceSnapshot: true });
if (prePublicationErrors.length > 0) {
  console.error(
    `FAIL Phase 7 packet inputs changed before publication: ${[
      ...new Set(prePublicationErrors),
    ].join('; ')}.`,
  );
  process.exit(1);
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
      return phase7AssemblyStabilityErrors({ includeSourceSnapshot: false });
    },
  });
} catch (error) {
  console.error(
    `FAIL Phase 7 packet publication was rejected: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}

console.log(`Wrote ${packetOutputPaths[0]}`);
console.log(`Wrote ${packetOutputPaths[1]}`);

if (strict && blockers.length > 0) {
  console.error(
    `\nPhase 7 strict QA packet has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}
