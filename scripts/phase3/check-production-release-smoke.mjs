#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), 'check-production-release.mjs');

function run(env) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env,
  });
}

const cases = [
  {
    name: 'development does not require external release evidence',
    result: run({ APP_VARIANT: 'development', EXPO_PUBLIC_APP_ENV: 'development' }),
    pass(result) {
      return result.status === 0 && /not required/.test(result.stdout);
    },
  },
  {
    name: 'staging remains available for reviewer QA',
    result: run({ APP_VARIANT: 'staging', EXPO_PUBLIC_APP_ENV: 'staging' }),
    pass(result) {
      return result.status === 0 && /not required/.test(result.stdout);
    },
  },
  {
    name: 'production variant fails closed without clearance',
    result: run({ APP_VARIANT: 'production', EXPO_PUBLIC_APP_ENV: 'staging' }),
    pass(result) {
      return result.status === 1 && /PHASE3_RELEASE_CLEARANCE=cleared/.test(result.stderr);
    },
  },
  {
    name: 'production runtime environment fails closed without clearance',
    result: run({ APP_VARIANT: 'staging', EXPO_PUBLIC_APP_ENV: 'production' }),
    pass(result) {
      return result.status === 1 && /PHASE3_RELEASE_CLEARANCE=cleared/.test(result.stderr);
    },
  },
  {
    name: 'production rejects pending clearance',
    result: run({
      APP_VARIANT: 'production',
      EXPO_PUBLIC_APP_ENV: 'production',
      PHASE3_RELEASE_CLEARANCE: 'pending',
    }),
    pass(result) {
      return result.status === 1 && /PHASE3_RELEASE_CLEARANCE=cleared/.test(result.stderr);
    },
  },
  {
    name: 'production accepts exact recorded clearance',
    result: run({
      APP_VARIANT: ' Production ',
      EXPO_PUBLIC_APP_ENV: ' PRODUCTION ',
      PHASE3_RELEASE_CLEARANCE: 'cleared',
    }),
    pass(result) {
      return result.status === 0 && /clearance is recorded/.test(result.stdout);
    },
  },
];

let failed = false;
for (const testCase of cases) {
  if (testCase.pass(testCase.result)) {
    console.log(`OK ${testCase.name}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${testCase.name}`);
  if (testCase.result.stdout) console.error(testCase.result.stdout.trim());
  if (testCase.result.stderr) console.error(testCase.result.stderr.trim());
}

if (failed) process.exit(1);
