export {
  abs,
  block,
  blockPublicEnvSecrets,
  command,
  envFile,
  envSnapshot,
  exists,
  has,
  hash,
  listFiles,
  markdownList,
  mkdir,
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

export function requiredPhase10EvidenceKeys() {
  return [
    'PHASE10_PHASE9_BETA_CANDIDATE_PASS',
    'PHASE10_BETA_IDENTITY_PASS',
    'PHASE10_TESTFLIGHT_READY',
    'PHASE10_PLAY_CLOSED_TEST_READY',
    'PHASE10_PLAY_12_TESTERS_14_DAYS_SCHEDULED',
    'PHASE10_RECRUITING_PASS',
    'PHASE10_BETA_TERMS_PASS',
    'PHASE10_DASHBOARDS_PASS',
    'PHASE10_SUPPORT_DESK_PASS',
    'PHASE10_PRIVACY_PAYLOAD_PASS',
    'PHASE10_PAYMENT_QA_PASS',
    'PHASE10_CATALOG_BETA_PASS',
    'PHASE10_RETENTION_REPORT_PASS',
  ];
}

export function phase10RequiredDocs() {
  return [
    'docs/phase-10/beta-source-of-truth.md',
    'docs/phase-10/tester-recruitment-sheet.md',
    'docs/phase-10/tester-brief.md',
    'docs/phase-10/testflight-packet.md',
    'docs/phase-10/google-closed-testing-packet.md',
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
}

export function phase10SourceFiles() {
  return [
    'package.json',
    'turbo.json',
    '.env.example',
    'apps/mobile/eas.json',
    'apps/mobile/app.config.js',
    'apps/mobile/src/lib/analytics/eventRegistry.ts',
    'apps/mobile/src/lib/analytics/track.ts',
    'apps/mobile/src/lib/observability/scrub.ts',
    'docs/phase-9/generated/release-engineering-qa-packet.json',
    ...phase10RequiredDocs(),
  ];
}
