#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  createNativeOcrEvidenceTemplate,
  normalizeNativeOcrEvidencePath,
  validateNativeOcrEvidence,
} from './native-ocr-evidence-contract.mjs';
import { gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';

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

function currentGitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function sourceLineage(sourceGitSha, currentSha) {
  if (!/^[0-9a-f]{40}$/i.test(String(sourceGitSha ?? '')) || !currentSha) {
    return { isAncestor: false, changedPaths: null };
  }
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', sourceGitSha, currentSha], {
    cwd: root,
    encoding: 'utf8',
  });
  if (ancestor.status !== 0) return { isAncestor: false, changedPaths: null };
  try {
    const changedPaths = execFileSync(
      'git',
      ['-c', 'core.quotepath=false', 'diff', '--name-only', `${sourceGitSha}..${currentSha}`],
      { cwd: root, encoding: 'utf8' },
    )
      .split(/\r?\n/)
      .map((path) => path.trim().replaceAll('\\', '/'))
      .filter(Boolean);
    return { isAncestor: true, changedPaths };
  } catch {
    return { isAncestor: true, changedPaths: null };
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
try {
  evidence = JSON.parse(readFileSync(abs(evidencePath), 'utf8'));
} catch (error) {
  console.error(
    `FAIL Native OCR evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
  );
  process.exit(1);
}

const currentSha = currentGitSha();
const lineage = sourceLineage(evidence.sourceGitSha, currentSha);
const expectedBuildId = String(process.env.PHASE5_IOS_BUILD_ID ?? '').trim();
const expectedBuildProfile = String(process.env.PHASE5_IOS_BUILD_PROFILE ?? '').trim();
const result = validateNativeOcrEvidence(evidence, {
  root,
  currentGitSha: currentSha,
  sourceGitShaIsAncestor: lineage.isAncestor,
  changedPathsSinceSource: lineage.changedPaths,
  evidencePath,
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
let gitStatus = 'unknown';
try {
  gitStatus = gitStatusExcludingGeneratedEvidence([
    evidencePath,
    ...result.artifacts.map(({ path }) => path),
  ]);
  if (gitStatus) {
    const message =
      'Native OCR evidence was checked from a dirty worktree outside the evidence artifact and generated packet allowlist; it cannot clear strict release QA.';
    if (strict) result.errors.push(message);
    else result.warnings.push(message);
  }
} catch {
  result.errors.push('Native OCR evidence could not inspect Git worktree cleanliness.');
}
for (const warning of result.warnings) console.warn(`WARN ${warning}`);
for (const error of result.errors) console.error(`FAIL ${error}`);

console.log(`Evidence: ${evidencePath}`);
console.log(
  `Physical proof: ${result.summary.runs}/${result.summary.requiredRuns} runs across ${result.summary.devices} devices, ${result.summary.corpusItems} labels, and ${result.summary.labelClasses}/5 classes.`,
);
console.log(`RTL reading-order corpus: ${result.summary.rtlCorpusItems}/2 minimum labels.`);
console.log(`Verified attachments: ${result.artifacts.length}/7.`);
console.log(`Git status outside validated evidence: ${gitStatus || 'clean'}.`);

if (result.errors.length > 0) {
  console.error(
    `\nPhase 5 native OCR evidence failed on ${result.errors.length} blocker${result.errors.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log('\nPhase 5 native OCR evidence passed.');
