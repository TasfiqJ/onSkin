#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const checkEnvPath = resolve(scriptDir, 'check-payments-env.mjs');
const packetPath = resolve(scriptDir, 'build-payments-qa-packet.mjs');

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
  PHASE6_RC_OFFERING_REVIEWED: ' TRUE ',
  PHASE6_IOS_SANDBOX_RESTORE_PASS: 'true',
  PHASE6_ANDROID_LICENSE_TEST_PASS: 'True',
  PHASE6_WEBHOOK_HMAC_TEST_PASS: ' true ',
  PHASE6_FINANCE_SIGNOFF: 'TRUE',
  PHASE6_SIGNED_OFF_BY: ' Tas Mohammed ',
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

function runPacket(extraEnv) {
  const outDir = mkdtempSync(join(tmpdir(), 'routinekind-phase6-packet-'));
  try {
    const result = spawnSync(process.execPath, [packetPath], {
      cwd: root,
      encoding: 'utf8',
      env: { ...processBaseEnv, ...completeEnv, PHASE6_PACKET_OUT_DIR: outDir, ...extraEnv },
    });
    const packet = JSON.parse(readFileSync(resolve(outDir, 'payments-qa-packet.json'), 'utf8'));
    return { ...result, packet };
  } finally {
    rmSync(outDir, { force: true, recursive: true });
  }
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
  {
    name: 'strict payments env rejects non-true external evidence flags',
    result: run({ PHASE6_WEBHOOK_HMAC_TEST_PASS: 'yes' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing external Phase 6 evidence: PHASE6_WEBHOOK_HMAC_TEST_PASS/.test(output(result))
      );
    },
  },
  {
    name: 'strict payments env rejects placeholder signoffs',
    result: run({ PHASE6_SIGNED_OFF_BY: 'Tester Name' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing external Phase 6 evidence: PHASE6_SIGNED_OFF_BY/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 6 packet writes normalized evidence, config, and signoff',
    result: runPacket({}),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.productionConfig.annualProductIdFinal === true &&
        result.packet.productionConfig.webhookSigningSecretConfigured === true &&
        result.packet.productionConfig.privacyUrlProduction === true &&
        result.packet.evidence.rcOfferingReviewed === true &&
        result.packet.evidence.androidLicenseTestPass === true &&
        result.packet.evidence.signedOffBy === 'Tas Mohammed' &&
        !result.packet.blockers.some((blocker) => /PHASE6_SIGNED_OFF_BY/.test(blocker))
      );
    },
  },
  {
    name: 'Phase 6 packet blocks placeholder production config without leaking secrets',
    result: runPacket({
      EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID: 'routinekind.pro.annual.dev',
      REVENUECAT_WEBHOOK_SIGNING_SECRET: '__BLOCKED_PLACEHOLDER__',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.productionConfig.annualProductIdFinal === false &&
        result.packet.productionConfig.webhookSigningSecretConfigured === false &&
        result.packet.blockers.includes(
          'Missing final EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID.',
        ) &&
        result.packet.blockers.includes('Missing production REVENUECAT_WEBHOOK_SIGNING_SECRET.') &&
        !JSON.stringify(result.packet).includes('__BLOCKED_PLACEHOLDER__')
      );
    },
  },
  {
    name: 'Phase 6 packet strips placeholder signoffs',
    result: runPacket({ PHASE6_SIGNED_OFF_BY: 'tester@example.com' }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidence.signedOffBy === '' &&
        result.packet.blockers.includes('Missing PHASE6_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 6 packet blocks non-true evidence flags',
    result: runPacket({ PHASE6_FINANCE_SIGNOFF: 'approved' }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidence.financeSignoff === false &&
        result.packet.blockers.includes('Missing PHASE6_FINANCE_SIGNOFF=true.')
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
