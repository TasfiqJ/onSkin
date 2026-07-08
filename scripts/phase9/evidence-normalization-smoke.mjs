#!/usr/bin/env node
import { block, evidenceFlagEnabled, printResult, read } from './lib.mjs';

const errors = [];
const warnings = [];

const evidenceGates = [
  {
    file: 'scripts/phase5/build-device-qa-packet.mjs',
    keys: ['PHASE5_QA_SIGNOFF'],
  },
  {
    file: 'scripts/phase6/build-payments-qa-packet.mjs',
    keys: [
      'PHASE6_RC_OFFERING_REVIEWED',
      'PHASE6_IOS_SANDBOX_RESTORE_PASS',
      'PHASE6_ANDROID_LICENSE_TEST_PASS',
      'PHASE6_WEBHOOK_HMAC_TEST_PASS',
      'PHASE6_FINANCE_SIGNOFF',
    ],
  },
  {
    file: 'scripts/phase7/build-core-loop-qa-packet.mjs',
    keys: [
      'PHASE7_BRAND_READY',
      'PHASE7_SUPABASE_RLS_PASS',
      'PHASE7_CLINICAL_REVIEW_PASS',
      'PHASE7_CATALOG_BETA_IMPORT_PASS',
      'PHASE7_DEVICE_QA_PASS',
      'PHASE7_REVENUECAT_QA_PASS',
      'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
      'PHASE7_BETA_DASHBOARD_READY',
    ],
  },
  {
    file: 'scripts/phase8/build-growth-store-qa-packet.mjs',
    keys: [
      'PHASE8_BRAND_SOURCE_OF_TRUTH_PASS',
      'PHASE8_DOMAIN_DNS_PASS',
      'PHASE8_IOS_UNIVERSAL_LINKS_PASS',
      'PHASE8_ANDROID_APP_LINKS_PASS',
      'PHASE8_SHARE_CARD_DEVICE_QA_PASS',
      'PHASE8_ATTRIBUTION_PRIVACY_PASS',
      'PHASE8_APP_STORE_PACKET_PASS',
      'PHASE8_PLAY_STORE_PACKET_PASS',
      'PHASE8_CREATOR_COMPLIANCE_PASS',
      'PHASE8_SUPPORT_RESPONSE_PASS',
      'PHASE8_LAUNCH_DASHBOARD_READY',
      'PHASE8_DRY_RUN_PASS',
    ],
  },
  {
    file: 'scripts/phase9/rls-adversarial.mjs',
    keys: ['PHASE9_RLS_STAGING_PASS', 'PHASE9_RLS_PRODUCTION_PASS'],
  },
  {
    file: 'scripts/phase9/edge-auth-smoke.mjs',
    keys: ['PHASE9_EDGE_AUTH_PASS'],
  },
  {
    file: 'scripts/phase9/data-rights-smoke.mjs',
    keys: ['PHASE9_DATA_EXPORT_DELETE_PASS'],
  },
  {
    file: 'scripts/phase9/consent-withdrawal-smoke.mjs',
    keys: ['PHASE9_CONSENT_WITHDRAWAL_PASS'],
  },
  {
    file: 'scripts/phase9/privacy-payload-audit.mjs',
    keys: ['PHASE9_OBSERVABILITY_PAYLOAD_PASS'],
  },
  {
    file: 'scripts/phase9/dependency-sbom.mjs',
    keys: ['PHASE9_DEPENDENCY_AUDIT_PASS'],
  },
  {
    file: 'scripts/phase9/store-build-inspect.mjs',
    keys: [
      'PHASE9_IOS_TESTFLIGHT_PASS',
      'PHASE9_ANDROID_CLOSED_TEST_PASS',
      'PHASE9_ANDROID_TARGET_API_PASS',
      'PHASE9_ANDROID_16KB_PASS',
      'PHASE9_IOS_PRIVACY_REPORT_PASS',
      'PHASE9_APP_STORE_PACKET_PASS',
      'PHASE9_PLAY_PACKET_PASS',
    ],
  },
  {
    file: 'scripts/phase10/beta-analytics-audit.mjs',
    keys: ['PHASE10_DASHBOARDS_PASS', 'PHASE10_PRIVACY_PAYLOAD_PASS'],
  },
  {
    file: 'scripts/phase11/launch-readiness.mjs',
    dynamicKeySource: 'scripts/phase11/lib.mjs',
    dynamicKeyFunction: 'requiredPhase11EvidenceKeys',
    keys: [
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
    ],
  },
  {
    file: 'scripts/phase11/launch-ring-gates.mjs',
    dynamicKeySource: 'scripts/phase11/lib.mjs',
    dynamicKeyFunction: 'requiredPhase11EvidenceKeys',
    keys: [
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
    ],
  },
  {
    file: 'scripts/phase11/build-launch-packet.mjs',
    dynamicKeySource: 'scripts/phase11/lib.mjs',
    dynamicKeyFunction: 'requiredPhase11EvidenceKeys',
    keys: [
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
    ],
  },
];

const accessFor = (key) => String.raw`(?:process\.env|env)\.${key}`;

for (const { file, keys } of evidenceGates) {
  const source = read(file);
  block(
    errors,
    source.includes('evidenceFlagEnabled'),
    `${file} must import/use evidenceFlagEnabled for external evidence pass flags.`,
  );

  const gate = evidenceGates.find((candidate) => candidate.file === file);
  if (gate?.dynamicKeyFunction) {
    const keySource = read(gate.dynamicKeySource);
    block(
      errors,
      source.includes(gate.dynamicKeyFunction),
      `${file} must use ${gate.dynamicKeyFunction} for external evidence keys.`,
    );
    block(
      errors,
      /evidenceFlagEnabled\(env\[key\]\)/.test(source),
      `${file} must normalize dynamic evidence keys with evidenceFlagEnabled(env[key]).`,
    );
    block(
      errors,
      !/env\[[^\]]+\]\s*={2,3}\s*['"]true['"]/.test(source),
      `${file} must not raw-compare dynamic env evidence to true.`,
    );
    block(
      errors,
      !/['"]true['"]\s*={2,3}\s*env\[[^\]]+\]/.test(source),
      `${file} must not raw-compare true to dynamic env evidence.`,
    );
    for (const key of keys) {
      block(errors, keySource.includes(`'${key}'`), `${gate.dynamicKeySource} is missing ${key}.`);
    }
    continue;
  }

  for (const key of keys) {
    const access = accessFor(key);
    block(
      errors,
      new RegExp(String.raw`evidenceFlagEnabled\(${access}\)`).test(source),
      `${file} must normalize ${key} with evidenceFlagEnabled.`,
    );
    block(
      errors,
      !new RegExp(String.raw`${access}\s*={2,3}\s*['"]true['"]`).test(source),
      `${file} must not raw-compare ${key} to true.`,
    );
    block(
      errors,
      !new RegExp(String.raw`['"]true['"]\s*={2,3}\s*${access}`).test(source),
      `${file} must not raw-compare true to ${key}.`,
    );
  }
}

for (const [value, expected] of [
  ['true', true],
  [' TRUE ', true],
  ['TrUe', true],
  ['false', false],
  ['1', false],
  ['', false],
  [undefined, false],
]) {
  block(
    errors,
    evidenceFlagEnabled(value) === expected,
    `evidenceFlagEnabled(${JSON.stringify(value)}) must be ${expected}.`,
  );
}

printResult('Phase 5/6/7/8/9/10/11 evidence normalization smoke', errors, warnings);
