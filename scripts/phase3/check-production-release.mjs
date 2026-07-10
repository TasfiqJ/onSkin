#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { assertReleaseReadyReviewEvidence } = require('../../apps/mobile/phase3-review-evidence');

function normalizedStage(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function checkProductionRelease(options = {}) {
  const env = options.env ?? process.env;
  const appVariant = normalizedStage(env.APP_VARIANT);
  const appEnvironment = normalizedStage(env.EXPO_PUBLIC_APP_ENV);
  const isProduction = [appVariant, appEnvironment].includes('production');

  if (!isProduction) {
    return {
      ok: true,
      message: 'Phase 3 production release clearance is not required for this build stage.',
    };
  }

  if (env.PHASE3_RELEASE_CLEARANCE !== 'cleared') {
    return {
      ok: false,
      message:
        'Production release requires PHASE3_RELEASE_CLEARANCE=cleared after the signed Phase 3 review packet and strict copy audit are complete.',
    };
  }

  try {
    assertReleaseReadyReviewEvidence({
      worklist: options.worklist,
      verifyHashes: options.verifyHashes,
      rootDir: options.rootDir,
    });
  } catch (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message: 'Phase 3 production release clearance and reviewer evidence are recorded.',
  };
}

const isMain = resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isMain) {
  const result = checkProductionRelease();
  if (result.ok) {
    console.log(result.message);
  } else {
    console.error(`FAIL ${result.message}`);
    process.exitCode = 1;
  }
}
