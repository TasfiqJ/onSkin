#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstatSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { format as prettierFormat, resolveConfig as resolvePrettierConfig } from 'prettier';

import { auditGovernedEvidenceChain } from '../launch/governed-evidence-chain.mjs';
import {
  createCameraLifecycleEvidenceTemplate,
  CAMERA_LIFECYCLE_MANIFEST_BYTES_MAX,
  normalizeCameraLifecycleEasBuildId,
  normalizeCameraLifecycleEvidencePath,
  normalizeCameraLifecycleTemplatePath,
  readCameraLifecycleContainedFile,
  validateCameraLifecycleEvidence,
} from './camera-lifecycle-evidence-contract.mjs';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const writeTemplate = process.argv.includes('--write-template');
const checkTemplate = process.argv.includes('--check-template');
const rawTemplatePath =
  process.env.PHASE5_CAMERA_LIFECYCLE_TEMPLATE_PATH ??
  'docs/phase-5/camera-lifecycle-evidence.template.json';
const templatePath = normalizeCameraLifecycleTemplatePath(rawTemplatePath);
const rawEvidencePath = String(process.env.PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH ?? '').trim();

if (!templatePath) {
  console.error(
    'FAIL PHASE5_CAMERA_LIFECYCLE_TEMPLATE_PATH must be a normalized portable repo-relative JSON path under docs/phase-5/.',
  );
  process.exit(1);
}

function normalizedJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function safeTemplateDestination(path) {
  try {
    const absoluteRoot = resolve(root);
    const rootStats = lstatSync(absoluteRoot);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) return null;
    const target = resolve(absoluteRoot, path);
    const targetRelative = relative(absoluteRoot, target);
    if (
      !targetRelative ||
      targetRelative === '..' ||
      targetRelative.startsWith(`..${sep}`) ||
      isAbsolute(targetRelative)
    ) {
      return null;
    }
    const parent = dirname(target);
    let cursor = absoluteRoot;
    for (const component of relative(absoluteRoot, parent).split(sep).filter(Boolean)) {
      cursor = join(cursor, component);
      const stats = lstatSync(cursor);
      if (!stats.isDirectory() || stats.isSymbolicLink()) return null;
    }
    const canonicalize = realpathSync.native ?? realpathSync;
    const canonicalRoot = canonicalize(absoluteRoot);
    const canonicalParent = canonicalize(parent);
    const canonicalRelative = relative(canonicalRoot, canonicalParent);
    if (
      canonicalRelative === '..' ||
      canonicalRelative.startsWith(`..${sep}`) ||
      isAbsolute(canonicalRelative)
    ) {
      return null;
    }
    try {
      const targetStats = lstatSync(target);
      if (!targetStats.isFile() || targetStats.isSymbolicLink()) return null;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') return null;
    }
    return target;
  } catch {
    return null;
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function appendGovernedRoleErrors(result, chain, evidencePath, evidenceBytes) {
  if (chain.status !== 'pass' || !chain.ledger) {
    result.errors.push(`Governed evidence chain is invalid: ${chain.errors.join(' | ')}`);
    return;
  }
  const role = 'phase5-camera-lifecycle';
  const expected = [
    { path: evidencePath, sha256: sha256(evidenceBytes) },
    ...result.artifacts.map(({ path, sha256: digest }) => ({ path, sha256: digest })),
  ];
  const expectedByPath = new Map(expected.map((entry) => [entry.path, entry]));
  if (expectedByPath.size !== expected.length) {
    result.errors.push('Camera lifecycle evidence references duplicate governed paths.');
    return;
  }
  const roleEntries = chain.ledger.entries.filter((entry) => entry.role === role);
  const ledgerByPath = new Map(roleEntries.map((entry) => [entry.path, entry]));
  for (const expectedEntry of expected) {
    const ledgerEntry = ledgerByPath.get(expectedEntry.path);
    if (!ledgerEntry) {
      result.errors.push(
        `Camera lifecycle evidence path is not an exact ${role} ledger entry: ${expectedEntry.path}.`,
      );
    } else if (ledgerEntry.sha256 !== expectedEntry.sha256) {
      result.errors.push(`Camera lifecycle ledger digest does not match ${expectedEntry.path}.`);
    }
  }
  for (const ledgerEntry of roleEntries) {
    if (!expectedByPath.has(ledgerEntry.path)) {
      result.errors.push(
        `Camera lifecycle ledger contains an unreferenced ${role} entry: ${ledgerEntry.path}.`,
      );
    }
  }
}

const prettierConfig = (await resolvePrettierConfig(root)) ?? {};
const expectedTemplate = await prettierFormat(
  normalizedJson(createCameraLifecycleEvidenceTemplate()),
  {
    ...prettierConfig,
    filepath: templatePath,
    parser: 'json',
  },
);

if (writeTemplate) {
  const destination = safeTemplateDestination(templatePath);
  if (!destination) {
    console.error('FAIL Camera lifecycle template destination is missing, indirect, or unsafe.');
    process.exit(1);
  }
  try {
    writeFileSync(destination, expectedTemplate);
  } catch {
    console.error('FAIL Camera lifecycle template destination could not be written safely.');
    process.exit(1);
  }
  console.log(`Wrote ${templatePath.replaceAll('\\', '/')}`);
  process.exit(0);
}

if (checkTemplate) {
  const templateFile = readCameraLifecycleContainedFile(root, templatePath, {
    maxBytes: CAMERA_LIFECYCLE_MANIFEST_BYTES_MAX,
  });
  if (!templateFile) {
    console.error(
      `FAIL Missing, unsafe, or oversized ${templatePath}. Run npm run phase5:camera-lifecycle-evidence:template.`,
    );
    process.exit(1);
  }
  const actual = templateFile.bytes.toString('utf8').replace(/\r\n/g, '\n');
  if (actual !== expectedTemplate) {
    console.error(
      `FAIL ${templatePath} is stale. Run npm run phase5:camera-lifecycle-evidence:template.`,
    );
    process.exit(1);
  }
  console.log('Phase 5 camera lifecycle evidence template is current.');
  process.exit(0);
}

console.log('Phase 5 camera lifecycle evidence check');

if (!rawEvidencePath) {
  const message =
    'Missing PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH; camera QA Booleans cannot substitute for exact-build, signed-archive, two-physical-iPhone lifecycle evidence.';
  if (strict) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
  console.warn(`WARN ${message}`);
  console.log('\nCAT-06 remains blocked on physical-iPhone evidence.');
  process.exit(0);
}

const evidencePath = normalizeCameraLifecycleEvidencePath(rawEvidencePath);
if (!evidencePath) {
  console.error(
    'FAIL PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH must be a normalized repo-relative JSON path under docs/phase-5/evidence/camera-lifecycle/.',
  );
  process.exit(1);
}
const evidenceFile = readCameraLifecycleContainedFile(root, evidencePath, {
  maxBytes: CAMERA_LIFECYCLE_MANIFEST_BYTES_MAX,
});
if (!evidenceFile) {
  console.error(
    `FAIL Camera lifecycle evidence file is missing, oversized, indirect, unreadable, or outside the canonical repository root: ${evidencePath}.`,
  );
  process.exit(1);
}

let evidence;
try {
  evidence = JSON.parse(evidenceFile.bytes.toString('utf8'));
} catch (error) {
  console.error(
    `FAIL Camera lifecycle evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
  );
  process.exit(1);
}

const rawExpectedBuildId = String(process.env.PHASE5_IOS_BUILD_ID ?? '').trim();
const expectedBuildId = normalizeCameraLifecycleEasBuildId(rawExpectedBuildId);
const expectedBuildProfile = String(process.env.PHASE5_IOS_BUILD_PROFILE ?? '').trim();
const result = validateCameraLifecycleEvidence(evidence, {
  root,
  expectedBuildId,
  expectedBuildProfile: expectedBuildProfile || null,
});

for (const [value, message] of [
  [
    rawExpectedBuildId,
    'PHASE5_IOS_BUILD_ID is required to cross-bind camera lifecycle evidence to the candidate build.',
  ],
  [
    expectedBuildProfile,
    'PHASE5_IOS_BUILD_PROFILE is required to cross-bind camera lifecycle evidence to the candidate profile.',
  ],
]) {
  if (value) continue;
  if (strict) result.errors.push(message);
  else result.warnings.push(message);
}
if (rawExpectedBuildId && !expectedBuildId) {
  result.errors.push(
    'PHASE5_IOS_BUILD_ID must be a canonical EAS UUID or strict expo.dev build URL without credentials, port, query, or fragment.',
  );
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
    appendGovernedRoleErrors(result, chain, evidencePath, evidenceFile.bytes);
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
  `Physical proof: ${result.summary.runs}/${result.summary.requiredRuns} runs across ${result.summary.devices} physical iPhones, ${result.summary.routes}/3 routes, and ${result.summary.scenarioDefinitions} route-scenario definitions.`,
);
console.log(
  `Verified artifacts: ${result.summary.artifacts} total, including ${result.summary.proofArtifacts} per-run proof attachments.`,
);
console.log(`Governed evidence chain: ${chain?.status ?? 'not-validated'}.`);
console.log(
  'Attestation scope: raw-source digests, derived references, and named reviews are accountable attestations; this validator does not fetch access-controlled raw media.',
);

if (result.errors.length > 0) {
  console.error(
    `\nPhase 5 camera lifecycle evidence failed on ${result.errors.length} blocker${result.errors.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log('\nPhase 5 camera lifecycle evidence passed.');
