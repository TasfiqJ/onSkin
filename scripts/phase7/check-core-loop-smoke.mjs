#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const checkPath = resolve(scriptDir, 'check-core-loop.mjs');

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

const validPublicIdentity = {
  EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'routinekind.app',
  EXPO_PUBLIC_PRIVACY_URL: 'https://routinekind.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://routinekind.app/terms',
  EXPO_PUBLIC_SUPPORT_URL: 'https://routinekind.app/support',
  EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://routinekind.app/account-deletion',
  EXPO_PUBLIC_DATA_EXPORT_URL: 'https://routinekind.app/data-export',
  EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL:
    'https://routinekind.app/consumer-health-privacy',
};

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function run(extraEnv) {
  return spawnSync(process.execPath, [checkPath], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...extraEnv },
  });
}

const cases = [
  {
    name: 'Phase 7 accepts production public identity from process env',
    result: run(validPublicIdentity),
    expect(result) {
      const text = output(result);
      return (
        result.status === 0 &&
        !/Missing final brand domain: EXPO_PUBLIC_FINAL_BRAND_DOMAIN/.test(text) &&
        !/EXPO_PUBLIC_(?:PRIVACY|TERMS|SUPPORT|ACCOUNT_DELETION|DATA_EXPORT|CONSUMER_HEALTH_PRIVACY)_URL must be a real production URL/.test(
          text,
        )
      );
    },
  },
  {
    name: 'Phase 7 rejects reserved final brand domains',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://routinekind.localhost',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Missing final brand domain: EXPO_PUBLIC_FINAL_BRAND_DOMAIN/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 rejects credentialed policy URLs',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_SUPPORT_URL: 'https://user:pass@routinekind.app/support',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /EXPO_PUBLIC_SUPPORT_URL must be a real production URL/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 rejects plaintext consumer health policy URLs',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL:
        'http://routinekind.app/consumer-health-privacy',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL must be a real production URL/.test(
          output(result),
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
  const text = output(testCase.result).trim();
  if (text) console.error(text);
}

if (failed) process.exit(1);
