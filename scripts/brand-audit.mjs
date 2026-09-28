#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_TARGETS,
  auditBrandIdentity,
  auditShouldFail,
  formatBrandAudit,
} from './brand-audit-lib.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const showAll = process.argv.includes('--all');
const targetArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

const result = await auditBrandIdentity({
  repoRoot,
  targets: targetArgs.length ? targetArgs : DEFAULT_TARGETS,
});

console.log(formatBrandAudit(result, { showAll }));

if (auditShouldFail(result, strict)) {
  console.error('');
  if (result.manifest.errors.length) {
    console.error(
      `Brand audit failed: ${result.manifest.errors.length} legacy compatibility manifest error(s) remain.`,
    );
  } else {
    console.error(
      `Brand audit strict mode failed: ${result.publicRiskCount} public launch risks and ${result.reviewNeededCount} review-needed references remain.`,
    );
  }
  process.exitCode = 1;
}
