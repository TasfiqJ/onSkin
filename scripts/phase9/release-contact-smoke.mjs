#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const releaseSmokePath = resolve(scriptDir, 'release-smoke.mjs');

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

const finalContactEnv = {
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

const validPhase7ShareEvidence = {
  PHASE7_BRAND_READY: ' TRUE ',
  PHASE7_CLINICAL_REVIEW_PASS: 'true',
  PHASE7_DEVICE_QA_PASS: ' True ',
  PHASE7_SIGNED_OFF_BY: ' Tas Mohammed ',
};

function run(extraEnv) {
  return spawnSync(process.execPath, [releaseSmokePath], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...finalContactEnv, ...extraEnv },
  });
}

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

const cases = [
  {
    name: 'Phase 9 accepts production final contacts without final-value warnings',
    result: run({}),
    expect(result) {
      return (
        result.status === 0 && !output(result).includes('Missing or non-production final value')
      );
    },
  },
  {
    name: 'Phase 9 rejects credential-bearing final policy URLs',
    result: run({ EXPO_PUBLIC_PRIVACY_URL: 'https://user:pass@routinekind.app/privacy' }),
    expect(result) {
      return (
        result.status === 0 &&
        output(result).includes(
          'Missing or non-production final value for EXPO_PUBLIC_PRIVACY_URL.',
        )
      );
    },
  },
  {
    name: 'Phase 9 rejects reserved final domains',
    result: run({ EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'routinekind.local' }),
    expect(result) {
      return (
        result.status === 0 &&
        output(result).includes(
          'Missing or non-production final value for EXPO_PUBLIC_FINAL_BRAND_DOMAIN.',
        )
      );
    },
  },
  {
    name: 'Phase 9 rejects placeholder support email domains',
    result: run({ EXPO_PUBLIC_SUPPORT_EMAIL: 'support@example.com' }),
    expect(result) {
      return (
        result.status === 0 &&
        output(result).includes(
          'Missing or non-production final value for EXPO_PUBLIC_SUPPORT_EMAIL.',
        )
      );
    },
  },
  {
    name: 'Phase 9 blocks production deferred surfaces before final domain readiness',
    result: run({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'routinekind.local',
      EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED: 'true',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        output(result).includes(
          'Production Share cards cannot be enabled before EXPO_PUBLIC_FINAL_BRAND_DOMAIN is final.',
        )
      );
    },
  },
  {
    name: 'Phase 9 accepts normalized Phase 7 production surface evidence',
    result: run({
      ...validPhase7ShareEvidence,
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED: ' TRUE ',
    }),
    expect(result) {
      const text = output(result);
      return (
        result.status === 0 &&
        !text.includes('Production Share cards requires PHASE7_BRAND_READY=true.') &&
        !text.includes('Production Share cards requires PHASE7_CLINICAL_REVIEW_PASS=true.') &&
        !text.includes('Production Share cards requires PHASE7_DEVICE_QA_PASS=true.') &&
        !text.includes('Production Share cards requires PHASE7_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 9 blocks placeholder Phase 7 production surface signoffs',
    result: run({
      ...validPhase7ShareEvidence,
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED: 'true',
      PHASE7_SIGNED_OFF_BY: 'Tester Name',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        output(result).includes('Production Share cards requires PHASE7_SIGNED_OFF_BY.')
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
