#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { loadLaunchContract } from '../launch/contract.mjs';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');
const registerPath = 'docs/FOR_TAS_TO_DO.md';
const executionPlanPath = 'docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md';
const outJson = process.env.TAS_TODO_AUDIT_JSON ?? 'docs/generated/tas-todo-audit.json';
const outMd = process.env.TAS_TODO_AUDIT_MD ?? 'docs/generated/tas-todo-audit.md';

const REQUIRED_HUMAN_IDS = Array.from(
  { length: 12 },
  (_, index) => `H-${String(index + 1).padStart(2, '0')}`,
);
const REQUIRED_VENDOR_IDS = ['V-01', 'V-02'];
const REQUIRED_SAFETY_TEXT = [
  'Never send passwords',
  'MFA codes',
  'private keys',
  'banking data',
  'unredacted user data',
  'Codex-owned',
  'Pending external work never pauses safe Codex-owned work',
];

function abs(path) {
  return resolve(root, path);
}

function exists(path) {
  return existsSync(abs(path));
}

function read(path) {
  return readFileSync(abs(path), 'utf8');
}

function rel(path) {
  return relative(root, path).replaceAll('\\', '/');
}

function extractDate(text) {
  return text.match(/^Date:\s*(\d{4}-\d{2}-\d{2})$/m)?.[1] ?? null;
}

function normalizeGeneratedMarkdown(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^Generated: .+$/m, 'Generated: <ignored>')
    .trimEnd();
}

function normalizeGeneratedJson(text) {
  const parsed = JSON.parse(text);
  delete parsed.generatedAt;
  return JSON.stringify(parsed, null, 2);
}

function checkGeneratedFile(path, expectedContent, normalize) {
  if (!exists(path)) {
    console.error(`FAIL Missing ${path}. Run npm run docs:tas-todo-audit:strict.`);
    return false;
  }
  if (normalize(read(path)) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run docs:tas-todo-audit:strict.`);
    return false;
  }
  return true;
}

const blockers = [];
const warnings = [];

for (const path of [registerPath, executionPlanPath]) {
  if (!exists(path)) blockers.push(`Missing ${path}.`);
}

let contract;
try {
  contract = loadLaunchContract(root);
} catch (error) {
  blockers.push(error instanceof Error ? error.message : String(error));
}

const registerText = exists(registerPath) ? read(registerPath) : '';
const planText = exists(executionPlanPath) ? read(executionPlanPath) : '';
const registerDate = extractDate(registerText);
const expectedDate = contract?.effectiveDate ?? null;

if (expectedDate && registerDate !== expectedDate) {
  blockers.push(`${registerPath} Date is ${registerDate ?? 'missing'}, expected ${expectedDate}.`);
}

for (const id of [...REQUIRED_HUMAN_IDS, ...REQUIRED_VENDOR_IDS]) {
  const registerCount = registerText.match(new RegExp(`^\\| ${id} \\|`, 'gm'))?.length ?? 0;
  if (registerCount !== 1) {
    blockers.push(
      `${registerPath} must contain exactly one table row for ${id}; found ${registerCount}.`,
    );
  }
  if (!planText.includes(`| ${id} |`)) {
    blockers.push(`${executionPlanPath} is missing touchpoint ${id}.`);
  }
}

for (const text of REQUIRED_SAFETY_TEXT) {
  if (!registerText.includes(text))
    blockers.push(`${registerPath} is missing safety text: ${text}.`);
}

for (const heading of [
  '## Founder Touchpoints',
  '## External Professional And Staffed-Operation Touchpoints',
  '## Vendor And Apple Outcomes',
  '## Current Critical Order',
]) {
  if (!registerText.includes(heading)) blockers.push(`${registerPath} is missing ${heading}.`);
}

if (!registerText.includes('Android credentials, builds, device')) {
  blockers.push(`${registerPath} must state that Android release evidence is not founder work.`);
}

const dumpedEvidenceKeys = [
  ...new Set(registerText.match(/\bPHASE(?:[2-9]|10|11)_[A-Z0-9_]+\b/g) ?? []),
];
if (dumpedEvidenceKeys.length > 0) {
  blockers.push(
    `${registerPath} must not dump Codex-owned phase evidence keys: ${dumpedEvidenceKeys.join(', ')}.`,
  );
}

const commandDump = registerText.match(/npm run [a-z0-9:-]+/gi) ?? [];
if (commandDump.length > 0) {
  blockers.push(`${registerPath} must not assign repository commands to the founder.`);
}

if (/Everything here needs a founder|For Tas To Do|Tas-owned strict/i.test(registerText)) {
  blockers.push(`${registerPath} still contains the superseded broad founder-task model.`);
}

if (registerText.length > 15_000) {
  warnings.push(
    `${registerPath} exceeds 15,000 characters; recheck that Codex-owned work was not added.`,
  );
}

const audit = {
  generatedAt: new Date().toISOString(),
  status: blockers.length === 0 ? 'pass' : 'blocked',
  strict,
  purpose:
    'Verify that the founder handoff contains only the 12 human/reviewer/staff touchpoints and two Apple/vendor outcomes from the iOS all-features ownership model.',
  sourceFiles: { registerPath, executionPlanPath },
  launchContract: contract
    ? {
        programId: contract.programId,
        effectiveDate: contract.effectiveDate,
        platforms: contract.release.platforms,
        androidRelease: contract.release.androidRelease,
      }
    : null,
  registerDate,
  requiredHumanIds: REQUIRED_HUMAN_IDS,
  requiredVendorIds: REQUIRED_VENDOR_IDS,
  dumpedEvidenceKeys,
  commandDump,
  summary: {
    humanTouchpointCount: REQUIRED_HUMAN_IDS.length,
    vendorOutcomeCount: REQUIRED_VENDOR_IDS.length,
    blockerCount: blockers.length,
    warningCount: warnings.length,
  },
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(audit, null, 2)}\n`;
const mdContent = [
  '# Founder Touchpoint Audit',
  '',
  `Generated: ${audit.generatedAt}`,
  `Status: ${audit.status}`,
  `Strict mode: ${strict ? 'yes' : 'no'}`,
  '',
  'This audit enforces the narrow founder/external ownership boundary from the',
  'iOS all-features execution charter. Repository commands, environment-key',
  'inventories, research, engineering, configuration, evidence generation, and',
  'launch operations must not be handed to the founder.',
  '',
  '## Summary',
  '',
  `- Human/reviewer/staff touchpoints: ${audit.summary.humanTouchpointCount}`,
  `- Apple/vendor outcomes: ${audit.summary.vendorOutcomeCount}`,
  `- Register date: ${audit.registerDate ?? 'missing'}`,
  `- Release platforms: ${audit.launchContract?.platforms.join(', ') ?? 'invalid contract'}`,
  `- Android release: ${audit.launchContract?.androidRelease === false ? 'not applicable' : 'invalid'}`,
  `- Blockers: ${audit.summary.blockerCount}`,
  `- Warnings: ${audit.summary.warningCount}`,
  '',
  '## Required IDs',
  '',
  `- Human: ${REQUIRED_HUMAN_IDS.join(', ')}`,
  `- Vendor: ${REQUIRED_VENDOR_IDS.join(', ')}`,
  '',
  '## Blockers',
  '',
  ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ['- None.']),
  '',
  '## Warnings',
  '',
  ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- None.']),
  '',
].join('\n');

if (check) {
  const jsonCurrent = checkGeneratedFile(outJson, jsonContent, normalizeGeneratedJson);
  const mdCurrent = checkGeneratedFile(outMd, mdContent, normalizeGeneratedMarkdown);
  if (blockers.length > 0 || !jsonCurrent || !mdCurrent) process.exit(1);
  if (strict && warnings.length > 0) warnings.forEach((warning) => console.warn(`WARN ${warning}`));
  console.log('Founder touchpoint audit is current.');
  console.log('Founder touchpoint audit passed.');
  process.exit(0);
}

mkdirSync(dirname(abs(outJson)), { recursive: true });
writeFileSync(abs(outJson), jsonContent);
writeFileSync(abs(outMd), mdContent);
console.log(`Wrote ${rel(abs(outJson))}`);
console.log(`Wrote ${rel(abs(outMd))}`);

if (blockers.length > 0) {
  blockers.forEach((blocker) => console.error(`FAIL ${blocker}`));
  process.exit(1);
}
if (strict && warnings.length > 0) warnings.forEach((warning) => console.warn(`WARN ${warning}`));
console.log('Founder touchpoint audit passed.');
