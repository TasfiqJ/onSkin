#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const phase10ReadinessPath = resolve(root, 'scripts/phase10/beta-readiness.mjs');
const phase11ReadinessPath = resolve(root, 'scripts/phase11/launch-readiness.mjs');

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

const publicContactEnv = {
  EXPO_PUBLIC_PRIVACY_URL: 'https://routinekind.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://routinekind.app/terms',
  EXPO_PUBLIC_SUPPORT_URL: 'https://routinekind.app/support',
  EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://routinekind.app/account-deletion',
  EXPO_PUBLIC_DATA_EXPORT_URL: 'https://routinekind.app/data-export',
  EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL: 'https://routinekind.app/consumer-health-privacy',
  EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'routinekind.app',
  EXPO_PUBLIC_MARKETING_URL: 'https://routinekind.app',
  EXPO_PUBLIC_SUPPORT_EMAIL: 'support@routinekind.app',
  EXPO_PUBLIC_APP_STORE_URL: 'https://apps.apple.com/app/id123456789',
  EXPO_PUBLIC_PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.routinekind.app',
};

const phase10EvidenceEnv = {
  PHASE10_PHASE9_BETA_CANDIDATE_PASS: 'true',
  PHASE10_BETA_IDENTITY_PASS: 'true',
  PHASE10_TESTFLIGHT_READY: 'true',
  PHASE10_PLAY_CLOSED_TEST_READY: 'true',
  PHASE10_PLAY_12_TESTERS_14_DAYS_SCHEDULED: 'true',
  PHASE10_RECRUITING_PASS: 'true',
  PHASE10_BETA_TERMS_PASS: 'true',
  PHASE10_DASHBOARDS_PASS: 'true',
  PHASE10_SUPPORT_DESK_PASS: 'true',
  PHASE10_PRIVACY_PAYLOAD_PASS: 'true',
  PHASE10_PAYMENT_QA_PASS: 'true',
  PHASE10_CATALOG_BETA_PASS: 'true',
  PHASE10_RETENTION_REPORT_PASS: 'true',
  PHASE10_PUBLIC_LAUNCH_DECISION: 'go',
  PHASE10_SIGNED_OFF_BY: 'tas@example.com',
};

const phase11EvidenceEnv = {
  PHASE11_PHASE10_EXIT_PASS: 'true',
  PHASE11_PHASE9_RC_SIGNOFF_PASS: 'true',
  PHASE11_STORE_APPROVAL_PASS: 'true',
  PHASE11_PRODUCTION_ENV_PASS: 'true',
  PHASE11_REVENUECAT_PROD_PASS: 'true',
  PHASE11_MONITORING_PASS: 'true',
  PHASE11_SUPPORT_READY: 'true',
  PHASE11_INCIDENT_ROLLBACK_PASS: 'true',
  PHASE11_RING0_PASS: 'true',
  PHASE11_RING1_72H_REPORT_PASS: 'true',
  PHASE11_ASO_REVIEW_PASS: 'true',
  PHASE11_CREATOR_DISCLOSURE_PASS: 'true',
  PHASE11_REVENUE_RECON_PASS: 'true',
  PHASE11_WEEK1_DECISION_PASS: 'true',
  PHASE11_SIGNED_OFF_BY: 'tas@example.com',
};

function run(scriptPath, extraEnv) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...processBaseEnv,
      ...publicContactEnv,
      ...phase10EvidenceEnv,
      ...phase11EvidenceEnv,
      ...extraEnv,
    },
  });
}

function combinedOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function hasNoFinalContactWarning(result, wording) {
  return result.status === 0 && !combinedOutput(result).includes(wording);
}

const cases = [
  {
    name: 'Phase 10 accepts production contact values without final identity warnings',
    result: run(phase10ReadinessPath, {}),
    expect(result) {
      return hasNoFinalContactWarning(result, 'final beta identity/policy value');
    },
  },
  {
    name: 'Phase 10 rejects reserved final brand domains',
    result: run(phase10ReadinessPath, {
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'routinekind.local',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes(
          'Missing or non-production final beta identity/policy value: EXPO_PUBLIC_FINAL_BRAND_DOMAIN.',
        )
      );
    },
  },
  {
    name: 'Phase 10 rejects credential-bearing policy URLs',
    result: run(phase10ReadinessPath, {
      EXPO_PUBLIC_PRIVACY_URL: 'https://user:pass@routinekind.app/privacy',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes(
          'Missing or non-production final beta identity/policy value: EXPO_PUBLIC_PRIVACY_URL.',
        )
      );
    },
  },
  {
    name: 'Phase 10 rejects local support email domains',
    result: run(phase10ReadinessPath, {
      EXPO_PUBLIC_SUPPORT_EMAIL: 'support@localhost',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes(
          'Missing or non-production final beta identity/policy value: EXPO_PUBLIC_SUPPORT_EMAIL.',
        )
      );
    },
  },
  {
    name: 'Phase 11 accepts production contact values without final public warnings',
    result: run(phase11ReadinessPath, {}),
    expect(result) {
      return hasNoFinalContactWarning(result, 'final public launch value');
    },
  },
  {
    name: 'Phase 11 rejects plaintext store URLs',
    result: run(phase11ReadinessPath, {
      EXPO_PUBLIC_APP_STORE_URL: 'http://apps.apple.com/app/id123456789',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes(
          'Missing or non-production final public launch value: EXPO_PUBLIC_APP_STORE_URL.',
        )
      );
    },
  },
  {
    name: 'Phase 11 rejects placeholder support email domains',
    result: run(phase11ReadinessPath, {
      EXPO_PUBLIC_SUPPORT_EMAIL: 'support@example.com',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes(
          'Missing or non-production final public launch value: EXPO_PUBLIC_SUPPORT_EMAIL.',
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
  const output = combinedOutput(testCase.result).trim();
  if (output) console.error(output);
}

if (failed) process.exit(1);
