export {
  abs,
  block,
  blockPublicEnvSecrets,
  command,
  envFile,
  envSnapshot,
  evidenceFlagEnabled,
  exists,
  gitStatusExcludingGeneratedEvidence,
  has,
  hash,
  listFiles,
  markdownList,
  mkdir,
  normalizeLaunchDecision,
  normalizeNamedSignoff,
  normalizeProductionDomain,
  normalizeProductionSupportEmail,
  normalizeProductionUrl,
  parseEnv,
  printResult,
  productionDomain,
  productionSupportEmail,
  productionUrl,
  read,
  requiredPhase9EvidenceKeys,
  root,
  strict,
  warn,
  write,
} from '../phase9/lib.mjs';

const PHASE10_ANDROID_EVIDENCE_KEYS = Object.freeze([
  'PHASE10_PLAY_CLOSED_TEST_READY',
  'PHASE10_PLAY_12_TESTERS_14_DAYS_SCHEDULED',
]);

export function requiredPhase10EvidenceKeys(
  contract = loadLaunchContract(resolve(import.meta.dirname, '../..')),
) {
  const keys = [
    'PHASE10_PHASE9_BETA_CANDIDATE_PASS',
    'PHASE10_BETA_IDENTITY_PASS',
    'PHASE10_TESTFLIGHT_READY',
    ...PHASE10_ANDROID_EVIDENCE_KEYS,
    'PHASE10_RECRUITING_PASS',
    'PHASE10_BETA_TERMS_PASS',
    'PHASE10_DASHBOARDS_PASS',
    'PHASE10_SUPPORT_DESK_PASS',
    'PHASE10_PRIVACY_PAYLOAD_PASS',
    'PHASE10_PAYMENT_QA_PASS',
    'PHASE10_CATALOG_BETA_PASS',
    'PHASE10_RETENTION_REPORT_PASS',
  ];
  return isReleasePlatformRequired('android', contract)
    ? keys
    : keys.filter((key) => !PHASE10_ANDROID_EVIDENCE_KEYS.includes(key));
}

export function notApplicablePhase10EvidenceKeys(
  contract = loadLaunchContract(resolve(import.meta.dirname, '../..')),
) {
  return isReleasePlatformRequired('android', contract) ? [] : [...PHASE10_ANDROID_EVIDENCE_KEYS];
}

export function phase10RequiredDocs(
  contract = loadLaunchContract(resolve(import.meta.dirname, '../..')),
) {
  const docs = [
    'docs/phase-10/beta-source-of-truth.md',
    'docs/phase-10/tester-recruitment-sheet.md',
    'docs/phase-10/tester-brief.md',
    'docs/phase-10/testflight-packet.md',
    'docs/phase-10/beta-event-schema.md',
    'docs/phase-10/support-operations.md',
    'docs/phase-10/surveys.md',
    'docs/phase-10/interview-script.md',
    'docs/phase-10/catalog-beta-report.md',
    'docs/phase-10/payment-beta-report.md',
    'docs/phase-10/support-beta-report.md',
    'docs/phase-10/retention-activation-report.md',
    'docs/phase-10/public-launch-decision-memo.md',
  ];
  if (isReleasePlatformRequired('android', contract)) {
    docs.splice(4, 0, 'docs/phase-10/google-closed-testing-packet.md');
  }
  return docs;
}

export function phase10SourceFiles() {
  return [
    'package.json',
    'docs/hugeToDo/launch-contract.json',
    'scripts/launch/contract.mjs',
    'turbo.json',
    '.env.example',
    'scripts/phase9/lib.mjs',
    'scripts/phase9/evidence-normalization-smoke.mjs',
    'scripts/phase10-11/public-contact-smoke.mjs',
    'scripts/phase10/lib.mjs',
    'scripts/phase10/beta-readiness.mjs',
    'scripts/phase10/beta-analytics-audit.mjs',
    'scripts/phase10/build-support-handoff-packet.mjs',
    'scripts/phase10/build-beta-packet.mjs',
    'docs/phase-10/generated/support-handoff-packet.json',
    'docs/phase-10/generated/support-handoff-packet.md',
    'apps/mobile/eas.json',
    'apps/mobile/app.config.js',
    'apps/mobile/src/lib/analytics/eventRegistry.ts',
    'apps/mobile/src/lib/analytics/track.ts',
    'apps/mobile/src/lib/observability/scrub.ts',
    'docs/phase-9/generated/release-engineering-qa-packet.json',
    'docs/phase-9/generated/release-engineering-qa-packet.md',
    ...phase10RequiredDocs(),
  ];
}
import { resolve } from 'node:path';
import { isReleasePlatformRequired, loadLaunchContract } from '../launch/contract.mjs';
