#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  createPerformanceEvidenceTemplate,
  validatePerformanceEvidence,
} from './performance-evidence-contract.mjs';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const writeTemplate = process.argv.includes('--write-template');
const checkTemplate = process.argv.includes('--check-template');
const templatePath =
  process.env.PHASE5_PERFORMANCE_TEMPLATE_PATH ?? 'docs/phase-5/performance-evidence.template.json';
const evidencePath = String(process.env.PHASE5_PERFORMANCE_EVIDENCE_PATH ?? '').trim();

function abs(path) {
  return resolve(root, path);
}

function normalizedJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const expectedTemplate = normalizedJson(createPerformanceEvidenceTemplate());

if (writeTemplate) {
  mkdirSync(dirname(abs(templatePath)), { recursive: true });
  writeFileSync(abs(templatePath), expectedTemplate);
  console.log(`Wrote ${templatePath.replaceAll('\\', '/')}`);
  process.exit(0);
}

if (checkTemplate) {
  if (!existsSync(abs(templatePath))) {
    console.error(
      `FAIL Missing ${templatePath}. Run npm run phase5:performance-evidence:template.`,
    );
    process.exit(1);
  }
  const actual = readFileSync(abs(templatePath), 'utf8').replace(/\r\n/g, '\n');
  if (actual !== expectedTemplate) {
    console.error(
      `FAIL ${templatePath} is stale. Run npm run phase5:performance-evidence:template.`,
    );
    process.exit(1);
  }
  console.log('Phase 5 performance evidence template is current.');
  process.exit(0);
}

console.log('Phase 5 performance evidence check');

if (!evidencePath) {
  const message =
    'Missing PHASE5_PERFORMANCE_EVIDENCE_PATH; real supported-device performance evidence is not attached.';
  if (strict) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
  console.warn(`WARN ${message}`);
  console.log('\nPerformance evidence remains externally blocked.');
  process.exit(0);
}

if (!existsSync(abs(evidencePath))) {
  console.error(`FAIL Performance evidence file does not exist: ${evidencePath}.`);
  process.exit(1);
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(abs(evidencePath), 'utf8'));
} catch (error) {
  console.error(
    `FAIL Performance evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
  );
  process.exit(1);
}

const result = validatePerformanceEvidence(evidence);
for (const warning of result.warnings) console.warn(`WARN ${warning}`);
for (const error of result.errors) console.error(`FAIL ${error}`);

console.log(`Evidence: ${evidencePath.replaceAll('\\', '/')}`);
console.log(
  `Measurements: ${result.summary.found}/${result.summary.requiredMeasurements} across ${result.summary.platforms} platforms.`,
);

if (result.errors.length > 0) {
  console.error(
    `\nPhase 5 performance evidence failed on ${result.errors.length} blocker${result.errors.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log('\nPhase 5 performance evidence passed.');
