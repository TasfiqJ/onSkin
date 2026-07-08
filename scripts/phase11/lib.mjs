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
  normalizeProductionDomain,
  normalizeProductionSupportEmail,
  normalizeProductionUrl,
  parseEnv,
  printResult,
  productionDomain,
  productionSupportEmail,
  productionUrl,
  read,
  root,
  strict,
  warn,
  write,
} from '../phase9/lib.mjs';

export {
  evidenceFlagEnabled,
  normalizeLaunchDecision,
  normalizeNamedSignoff,
} from '../phase10/lib.mjs';

export function requiredPhase11EvidenceKeys() {
  return [
    'PHASE11_PHASE10_EXIT_PASS',
    'PHASE11_PHASE9_RC_SIGNOFF_PASS',
    'PHASE11_STORE_APPROVAL_PASS',
    'PHASE11_PRODUCTION_ENV_PASS',
    'PHASE11_REVENUECAT_PROD_PASS',
    'PHASE11_MONITORING_PASS',
    'PHASE11_SUPPORT_READY',
    'PHASE11_INCIDENT_ROLLBACK_PASS',
    'PHASE11_RING0_PASS',
    'PHASE11_RING1_72H_REPORT_PASS',
    'PHASE11_ASO_REVIEW_PASS',
    'PHASE11_CREATOR_DISCLOSURE_PASS',
    'PHASE11_REVENUE_RECON_PASS',
    'PHASE11_WEEK1_DECISION_PASS',
  ];
}

export function phase11RequiredDocs() {
  return [
    'docs/phase-11/launch-command-center.md',
    'docs/phase-11/phase-10-exit-review.md',
    'docs/phase-11/store-release-plan.md',
    'docs/phase-11/production-environment-check.md',
    'docs/phase-11/revenuecat-production-verification.md',
    'docs/phase-11/monitoring-dashboards.md',
    'docs/phase-11/support-launch-readiness.md',
    'docs/phase-11/incident-rollback-drill.md',
    'docs/phase-11/ring-0-release-checklist.md',
    'docs/phase-11/ring-1-soft-launch.md',
    'docs/phase-11/aso-store-conversion-review.md',
    'docs/phase-11/creator-disclosure-pack.md',
    'docs/phase-11/revenue-finance-reconciliation.md',
    'docs/phase-11/launch-72-hour-report.md',
    'docs/phase-11/week-1-expansion-decision.md',
  ];
}

export function phase11SourceFiles() {
  return [
    'package.json',
    'turbo.json',
    '.env.example',
    'scripts/phase9/lib.mjs',
    'scripts/phase9/evidence-normalization-smoke.mjs',
    'scripts/phase10/lib.mjs',
    'scripts/phase10/build-beta-packet.mjs',
    'scripts/phase10-11/public-contact-smoke.mjs',
    'scripts/phase11/lib.mjs',
    'scripts/phase11/launch-readiness.mjs',
    'scripts/phase11/launch-ring-gates.mjs',
    'scripts/phase11/build-launch-packet.mjs',
    'apps/mobile/eas.json',
    'apps/mobile/app.config.js',
    'apps/mobile/src/lib/env.ts',
    'apps/mobile/src/lib/iap/revenuecat.ts',
    'docs/phase-9/generated/release-engineering-qa-packet.json',
    'docs/phase-9/generated/release-engineering-qa-packet.md',
    'docs/phase-10/generated/closed-beta-packet.json',
    'docs/phase-10/generated/closed-beta-packet.md',
    ...phase11RequiredDocs(),
  ];
}
