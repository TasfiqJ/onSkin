#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { auditGovernedEvidenceChain } from '../launch/governed-evidence-chain.mjs';
import {
  createNativeOcrEvidenceTemplate,
  normalizeNativeOcrEvidencePath,
  validateNativeOcrEvidence,
} from './native-ocr-evidence-contract.mjs';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const writeTemplate = process.argv.includes('--write-template');
const checkTemplate = process.argv.includes('--check-template');
const templatePath =
  process.env.PHASE5_NATIVE_OCR_TEMPLATE_PATH ?? 'docs/phase-5/native-ocr-evidence.template.json';
const rawEvidencePath = String(process.env.PHASE5_NATIVE_OCR_EVIDENCE_PATH ?? '').trim();

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
  const role = 'phase5-native-ocr';
  const expected = [
    { path: evidencePath, sha256: sha256(evidenceBytes) },
    ...result.artifacts.map(({ path, sha256: digest }) => ({ path, sha256: digest })),
  ];
  const expectedByPath = new Map(expected.map((entry) => [entry.path, entry]));
  if (expectedByPath.size !== expected.length) {
    result.errors.push('Native OCR evidence references duplicate governed paths.');
    return;
  }
  const roleEntries = chain.ledger.entries.filter((entry) => entry.role === role);
  const ledgerByPath = new Map(roleEntries.map((entry) => [entry.path, entry]));
  for (const expectedEntry of expected) {
    const ledgerEntry = ledgerByPath.get(expectedEntry.path);
    if (!ledgerEntry) {
      result.errors.push(
        `Native OCR evidence path is not an exact ${role} ledger entry: ${expectedEntry.path}.`,
      );
    } else if (ledgerEntry.sha256 !== expectedEntry.sha256) {
      result.errors.push(`Native OCR ledger digest does not match ${expectedEntry.path}.`);
    }
  }
  for (const ledgerEntry of roleEntries) {
    if (!expectedByPath.has(ledgerEntry.path)) {
      result.errors.push(
        `Native OCR ledger contains an unreferenced ${role} entry: ${ledgerEntry.path}.`,
      );
    }
  }
}

const expectedTemplate = normalizedJson(createNativeOcrEvidenceTemplate());

if (writeTemplate) {
  mkdirSync(dirname(abs(templatePath)), { recursive: true });
  writeFileSync(abs(templatePath), expectedTemplate);
  console.log(`Wrote ${templatePath.replaceAll('\\', '/')}`);
  process.exit(0);
}

if (checkTemplate) {
  if (!existsSync(abs(templatePath))) {
    console.error(`FAIL Missing ${templatePath}. Run npm run phase5:native-ocr-evidence:template.`);
    process.exit(1);
  }
  const actual = readFileSync(abs(templatePath), 'utf8').replace(/\r\n/g, '\n');
  if (actual !== expectedTemplate) {
    console.error(
      `FAIL ${templatePath} is stale. Run npm run phase5:native-ocr-evidence:template.`,
    );
    process.exit(1);
  }
  console.log('Phase 5 native OCR evidence template is current.');
  process.exit(0);
}

console.log('Phase 5 native OCR evidence check');

if (!rawEvidencePath) {
  const message =
    'Missing PHASE5_NATIVE_OCR_EVIDENCE_PATH; a Boolean pass flag cannot substitute for exact-build physical-iPhone OCR evidence.';
  if (strict) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
  console.warn(`WARN ${message}`);
  console.log(
    '\nNative OCR remains externally blocked and must stay disabled for production claims.',
  );
  process.exit(0);
}

const evidencePath = normalizeNativeOcrEvidencePath(rawEvidencePath);
if (!evidencePath) {
  console.error(
    'FAIL PHASE5_NATIVE_OCR_EVIDENCE_PATH must be a normalized repo-relative JSON path under docs/phase-5/evidence/native-ocr/.',
  );
  process.exit(1);
}
if (!existsSync(abs(evidencePath))) {
  console.error(`FAIL Native OCR evidence file does not exist: ${evidencePath}.`);
  process.exit(1);
}

let evidence;
let evidenceBytes;
try {
  evidenceBytes = readFileSync(abs(evidencePath));
  evidence = JSON.parse(evidenceBytes.toString('utf8'));
} catch (error) {
  console.error(
    `FAIL Native OCR evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
  );
  process.exit(1);
}

const expectedBuildId = String(process.env.PHASE5_IOS_BUILD_ID ?? '').trim();
const expectedBuildProfile = String(process.env.PHASE5_IOS_BUILD_PROFILE ?? '').trim();
const result = validateNativeOcrEvidence(evidence, {
  root,
  expectedBuildId: expectedBuildId || null,
  expectedBuildProfile: expectedBuildProfile || null,
});
for (const [value, message] of [
  [
    expectedBuildId,
    'PHASE5_IOS_BUILD_ID is required to cross-bind strict native OCR evidence to the candidate build.',
  ],
  [
    expectedBuildProfile,
    'PHASE5_IOS_BUILD_PROFILE is required to cross-bind strict native OCR evidence to the candidate profile.',
  ],
]) {
  if (value) continue;
  if (strict) result.errors.push(message);
  else result.warnings.push(message);
}

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
      sourceGitSha: String(evidence.sourceGitSha ?? ''),
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

console.log(`Evidence: ${evidencePath}`);
console.log(
  `Physical proof: ${result.summary.runs}/${result.summary.requiredRuns} runs across ${result.summary.devices} devices, ${result.summary.corpusItems} labels, and ${result.summary.labelClasses}/5 classes.`,
);
console.log(`RTL reading-order corpus: ${result.summary.rtlCorpusItems}/2 minimum labels.`);
console.log(`Verified attachments: ${result.artifacts.length}/7.`);
console.log(`Governed evidence chain: ${chain?.status ?? 'not-validated'}.`);

if (result.errors.length > 0) {
  console.error(
    `\nPhase 5 native OCR evidence failed on ${result.errors.length} blocker${result.errors.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log('\nPhase 5 native OCR evidence passed.');
