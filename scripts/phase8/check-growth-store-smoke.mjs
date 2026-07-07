#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const checkPath = resolve(scriptDir, 'check-growth-store-readiness.mjs');

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
  EXPO_PUBLIC_MARKETING_URL: 'https://routinekind.app',
  EXPO_PUBLIC_SUPPORT_EMAIL: 'support@routinekind.app',
  EXPO_PUBLIC_APP_STORE_URL: 'https://apps.apple.com/app/id123456789',
  EXPO_PUBLIC_PLAY_STORE_URL:
    'https://play.google.com/store/apps/details?id=com.routinekind.app',
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
    name: 'Phase 8 accepts production public identity from process env',
    result: run(validPublicIdentity),
    expect(result) {
      const text = output(result);
      return (
        result.status === 0 &&
        !/Missing final brand domain/.test(text) &&
        !/Missing production marketing URL/.test(text) &&
        !/Missing production support email/.test(text) &&
        !/Missing App Store URL/.test(text) &&
        !/Missing Play Store URL/.test(text)
      );
    },
  },
  {
    name: 'Phase 8 rejects reserved final domains',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'routinekind.local',
    }),
    expect(result) {
      return result.status === 0 && /Missing final brand domain/.test(output(result));
    },
  },
  {
    name: 'Phase 8 rejects placeholder support emails',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_SUPPORT_EMAIL: 'support@example.com',
    }),
    expect(result) {
      return result.status === 0 && /Missing production support email/.test(output(result));
    },
  },
  {
    name: 'Phase 8 rejects credentialed store URLs',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_APP_STORE_URL: 'https://user:pass@apps.apple.com/app/id123456789',
    }),
    expect(result) {
      return result.status === 0 && /Missing App Store URL/.test(output(result));
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
