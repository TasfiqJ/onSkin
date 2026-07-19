#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { format as prettierFormat, resolveConfig as resolvePrettierConfig } from 'prettier';

import { gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';
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
    return {
      isAncestor: true,
      changedPaths: execFileSync(
        'git',
        ['-c', 'core.quotepath=false', 'diff', '--name-only', `${sourceGitSha}..${currentSha}`],
        { cwd: root, encoding: 'utf8' },
      )
        .split(/\r?\n/)
        .map((path) => path.trim().replaceAll('\\', '/'))
        .filter(Boolean),
    };
  } catch {
    return { isAncestor: true, changedPaths: null };
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

const currentSha = currentGitSha();
const lineage = sourceLineage(evidence.sourceGitSha, currentSha);
const rawExpectedBuildId = String(process.env.PHASE5_IOS_BUILD_ID ?? '').trim();
const expectedBuildId = normalizeCameraLifecycleEasBuildId(rawExpectedBuildId);
const expectedBuildProfile = String(process.env.PHASE5_IOS_BUILD_PROFILE ?? '').trim();
const result = validateCameraLifecycleEvidence(evidence, {
  root,
  currentGitSha: currentSha,
  sourceGitShaIsAncestor: lineage.isAncestor,
  changedPathsSinceSource: lineage.changedPaths,
  evidencePath,
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

let gitStatus = 'unknown';
try {
  gitStatus = gitStatusExcludingGeneratedEvidence([
    evidencePath,
    ...result.artifacts.map(({ path }) => path),
  ]);
  if (gitStatus) {
    const message =
      'Camera lifecycle evidence was checked from a dirty worktree outside the validated evidence and generated-packet allowlist; it cannot clear strict release QA.';
    if (strict) result.errors.push(message);
    else result.warnings.push(message);
  }
} catch {
  result.errors.push('Camera lifecycle evidence could not inspect Git worktree cleanliness.');
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
console.log(`Git status outside validated evidence: ${gitStatus || 'clean'}.`);
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
