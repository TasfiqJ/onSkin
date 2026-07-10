#!/usr/bin/env node
import { createRequire } from 'node:module';

import { checkProductionRelease } from './check-production-release.mjs';

const require = createRequire(import.meta.url);
const { createReleaseReadyTestWorklist } = require('../../apps/mobile/phase3-review-evidence');

const cases = [
  {
    name: 'development does not require external release evidence',
    result: checkProductionRelease({
      env: { APP_VARIANT: 'development', EXPO_PUBLIC_APP_ENV: 'development' },
    }),
    pass(result) {
      return result.ok && /not required/.test(result.message);
    },
  },
  {
    name: 'staging remains available for reviewer QA',
    result: checkProductionRelease({
      env: { APP_VARIANT: 'staging', EXPO_PUBLIC_APP_ENV: 'staging' },
    }),
    pass(result) {
      return result.ok && /not required/.test(result.message);
    },
  },
  {
    name: 'production variant fails closed without clearance',
    result: checkProductionRelease({
      env: { APP_VARIANT: 'production', EXPO_PUBLIC_APP_ENV: 'staging' },
    }),
    pass(result) {
      return !result.ok && /PHASE3_RELEASE_CLEARANCE=cleared/.test(result.message);
    },
  },
  {
    name: 'production runtime environment fails closed without clearance',
    result: checkProductionRelease({
      env: { APP_VARIANT: 'staging', EXPO_PUBLIC_APP_ENV: 'production' },
    }),
    pass(result) {
      return !result.ok && /PHASE3_RELEASE_CLEARANCE=cleared/.test(result.message);
    },
  },
  {
    name: 'production rejects pending clearance',
    result: checkProductionRelease({
      env: {
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        PHASE3_RELEASE_CLEARANCE: 'pending',
      },
    }),
    pass(result) {
      return !result.ok && /PHASE3_RELEASE_CLEARANCE=cleared/.test(result.message);
    },
  },
  {
    name: 'clearance flag cannot bypass the unresolved reviewer worklist',
    result: checkProductionRelease({
      env: {
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        PHASE3_RELEASE_CLEARANCE: 'cleared',
      },
    }),
    pass(result) {
      return !result.ok && /review evidence is not release-ready/.test(result.message);
    },
  },
  {
    name: 'production accepts exact clearance with injected release-ready evidence',
    result: checkProductionRelease({
      env: {
        APP_VARIANT: ' Production ',
        EXPO_PUBLIC_APP_ENV: ' PRODUCTION ',
        PHASE3_RELEASE_CLEARANCE: 'cleared',
      },
      worklist: createReleaseReadyTestWorklist(),
      verifyHashes: false,
    }),
    pass(result) {
      return result.ok && /detached signoff evidence/.test(result.message);
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
  console.error(testCase.result.message);
}

if (failed) process.exit(1);
