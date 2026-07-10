#!/usr/bin/env node

function normalizedStage(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

const appVariant = normalizedStage(process.env.APP_VARIANT);
const appEnvironment = normalizedStage(process.env.EXPO_PUBLIC_APP_ENV);
const isProduction = [appVariant, appEnvironment].includes('production');

if (!isProduction) {
  console.log('Phase 3 production release clearance is not required for this build stage.');
  process.exit(0);
}

if (process.env.PHASE3_RELEASE_CLEARANCE !== 'cleared') {
  console.error(
    'FAIL Production release requires PHASE3_RELEASE_CLEARANCE=cleared after the signed Phase 3 review packet and strict copy audit are complete.',
  );
  process.exit(1);
}

console.log('Phase 3 production release clearance is recorded.');
