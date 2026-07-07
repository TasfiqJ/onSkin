#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const checkEnvPath = resolve(scriptDir, 'check-payments-env.mjs');

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

const completeEnv = {
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_livevalue123',
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_livevalue123',
  EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: 'pro',
  EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID: 'routinekind.pro.annual',
  EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID: 'routinekind.pro.monthly',
  EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID: 'routinekind.pro.reverse_trial',
  REVENUECAT_WEBHOOK_AUTH: 'revenuecat-webhook-auth-live',
  REVENUECAT_WEBHOOK_SIGNING_SECRET: 'whsec_livevalue123',
  REVENUECAT_SECRET_API_KEY: 'sk_livevalue123',
  BRAND_LEGAL_CLEARANCE: 'cleared',
  EXPO_PUBLIC_PRIVACY_URL: 'https://routinekind.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://routinekind.app/terms',
  EXPO_PUBLIC_SUPPORT_URL: 'https://routinekind.app/support',
  PHASE6_RC_OFFERING_REVIEWED: 'true',
  PHASE6_IOS_SANDBOX_RESTORE_PASS: 'true',
  PHASE6_ANDROID_LICENSE_TEST_PASS: 'true',
  PHASE6_WEBHOOK_HMAC_TEST_PASS: 'true',
  PHASE6_FINANCE_SIGNOFF: 'true',
  PHASE6_SIGNED_OFF_BY: 'tas@example.com',
};

function run(extraEnv) {
  return spawnSync(process.execPath, [checkEnvPath, '--strict'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...completeEnv, ...extraEnv },
  });
}

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

const cases = [
  {
    name: 'strict payments env passes with production RevenueCat and policy values',
    result: run({}),
    expect(result) {
      return result.status === 0 && /Phase 6 payments baseline is present/.test(result.stdout);
    },
  },
  {
    name: 'strict payments env rejects cased placeholder RevenueCat public keys',
    result: run({ EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_XXXXXXXXXXXX' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing EXPO_PUBLIC_REVENUECAT_IOS_KEY for production/.test(output(result))
      );
    },
  },
  {
    name: 'strict payments env rejects local product ids',
    result: run({ EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID: 'routinekind_pro_annual_dev' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Production annual RevenueCat product id must be a final App Store\/Play product id/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict payments env rejects blocked webhook secrets',
    result: run({ REVENUECAT_WEBHOOK_SIGNING_SECRET: '__BLOCKED_PLACEHOLDER__' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing production RevenueCat webhook signing secret/.test(output(result))
      );
    },
  },
  {
    name: 'strict payments env rejects malformed production policy URLs',
    result: run({ EXPO_PUBLIC_SUPPORT_URL: 'https://user:pass@routinekind.app/support' }),
    expect(result) {
      return (
        result.status === 1 &&
        /EXPO_PUBLIC_SUPPORT_URL must be a real production HTTPS URL/.test(output(result))
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
