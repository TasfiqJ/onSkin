#!/usr/bin/env node
import { validateEdgeFunctionManifest } from './edge-function-manifest-lib.mjs';

const errors = validateEdgeFunctionManifest();
if (errors.length > 0) {
  console.error('FAIL Edge Function manifest');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('PASS Edge Function manifest');
}
