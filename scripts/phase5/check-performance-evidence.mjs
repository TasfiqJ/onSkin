#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { auditGovernedEvidenceChain } from '../launch/governed-evidence-chain.mjs';
import {
  createPerformanceEvidenceTemplate,
  PERFORMANCE_MIN_SAMPLE_COUNT,
  normalizePerformanceEvidencePath,
  summarizePerformanceSamples,
  validatePerformanceEvidence,
} from './performance-evidence-contract.mjs';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const writeTemplate = process.argv.includes('--write-template');
const checkTemplate = process.argv.includes('--check-template');
const writeSummaries = process.argv.includes('--write-summaries');
const templatePath =
  process.env.PHASE5_PERFORMANCE_TEMPLATE_PATH ?? 'docs/phase-5/performance-evidence.template.json';
const rawEvidencePath = String(process.env.PHASE5_PERFORMANCE_EVIDENCE_PATH ?? '').trim();

function abs(path) {
  return resolve(root, path);
}

function normalizedJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function appendGovernedRoleErrors(result, chain, evidencePath, evidenceBytes) {
  if (chain.status !== 'pass' || !chain.ledger) {
    result.errors.push(`Governed evidence chain is invalid: ${chain.errors.join(' | ')}`);
    return;
  }
  const role = 'phase5-performance';
  const roleEntries = chain.ledger.entries.filter((entry) => entry.role === role);
  if (roleEntries.length !== 1 || roleEntries[0].path !== evidencePath) {
    result.errors.push(
      `Performance evidence must be the sole exact ${role} ledger entry: ${evidencePath}.`,
    );
    return;
  }
  if (roleEntries[0].sha256 !== sha256(evidenceBytes)) {
    result.errors.push(`Performance evidence ledger digest does not match ${evidencePath}.`);
  }
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

if (!rawEvidencePath) {
  const message =
    'Missing PHASE5_PERFORMANCE_EVIDENCE_PATH; real supported-device performance evidence is not attached.';
  if (strict || writeSummaries) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
  console.warn(`WARN ${message}`);
  console.log('\nPerformance evidence remains externally blocked.');
  process.exit(0);
}

const evidencePath = normalizePerformanceEvidencePath(rawEvidencePath);
if (!evidencePath) {
  console.error(
    'FAIL PHASE5_PERFORMANCE_EVIDENCE_PATH must be a normalized repo-relative JSON path under docs/phase-5/evidence/performance/.',
  );
  process.exit(1);
}

if (!existsSync(abs(evidencePath))) {
  console.error(`FAIL Performance evidence file does not exist: ${evidencePath}.`);
  process.exit(1);
}

let evidence;
let evidenceBytes;
try {
  evidenceBytes = readFileSync(abs(evidencePath));
  evidence = JSON.parse(evidenceBytes.toString('utf8'));
} catch (error) {
  console.error(
    `FAIL Performance evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
  );
  process.exit(1);
}

if (writeSummaries) {
  if (!Array.isArray(evidence.measurements) || evidence.measurements.length === 0) {
    console.error('FAIL measurements must contain raw observations before summaries are written.');
    process.exit(1);
  }

  const summaries = [];
  for (const [index, measurement] of evidence.measurements.entries()) {
    const samples = measurement?.samples;
    const summary = summarizePerformanceSamples(samples);
    if (!summary || samples.length < PERFORMANCE_MIN_SAMPLE_COUNT) {
      console.error(
        `FAIL measurements[${index}].samples must contain at least ${PERFORMANCE_MIN_SAMPLE_COUNT} positive raw observations before summaries are written.`,
      );
      process.exit(1);
    }
    summaries.push(summary);
  }

  for (const [index, summary] of summaries.entries()) {
    Object.assign(evidence.measurements[index], summary);
  }
  writeFileSync(abs(evidencePath), normalizedJson(evidence));
  console.log(
    `Wrote calculated sampleCount/p50/p95/max summaries for ${summaries.length} measurements to ${evidencePath.replaceAll('\\', '/')}.`,
  );
  process.exit(0);
}

const result = validatePerformanceEvidence(evidence);
const releaseCandidateDir = String(process.env.PHASE9_RELEASE_CANDIDATE_DIR ?? '').trim();
let chain = null;
if (!releaseCandidateDir) {
  result.errors.push(
    'PHASE9_RELEASE_CANDIDATE_DIR is required to validate the governed S-to-E evidence chain.',
  );
} else {
  try {
    chain = auditGovernedEvidenceChain({
      root,
      sourceGitSha: String(evidence.gitSha ?? ''),
      releaseCandidateDir,
    });
    appendGovernedRoleErrors(result, chain, evidencePath, evidenceBytes);
  } catch (error) {
    result.errors.push(
      `Governed evidence chain could not be validated: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
}
for (const warning of result.warnings) console.warn(`WARN ${warning}`);
for (const error of result.errors) console.error(`FAIL ${error}`);

console.log(`Evidence: ${evidencePath.replaceAll('\\', '/')}`);
console.log(
  `Measurements: ${result.summary.found}/${result.summary.requiredMeasurements} across ${result.summary.platforms} platforms.`,
);
console.log(`Governed evidence chain: ${chain?.status ?? 'not-validated'}.`);

if (result.errors.length > 0) {
  console.error(
    `\nPhase 5 performance evidence failed on ${result.errors.length} blocker${result.errors.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log('\nPhase 5 performance evidence passed.');
