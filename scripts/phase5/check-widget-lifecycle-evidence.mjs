#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, posix, relative, resolve } from 'node:path';

import {
  createWidgetLifecycleEvidenceTemplate,
  validateWidgetLifecycleEvidence,
  WIDGET_LIFECYCLE_EVIDENCE_ROOT,
  widgetLifecycleArtifactReferences,
} from './widget-lifecycle-evidence-contract.mjs';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const writeTemplate = process.argv.includes('--write-template');
const checkTemplate = process.argv.includes('--check-template');
const templatePath =
  process.env.PHASE5_WIDGET_LIFECYCLE_TEMPLATE_PATH ??
  'docs/phase-5/widget-lifecycle-evidence.template.json';
const evidencePath = String(process.env.PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH ?? '').trim();

function normalizedJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function abs(path) {
  return resolve(root, path);
}

function command(name, args) {
  return execFileSync(name, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function normalizedEvidencePath(value) {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    !value ||
    value.includes('\\') ||
    value.includes('%') ||
    /\s/.test(value) ||
    isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return null;
  }
  const normalized = posix.normalize(value);
  if (
    normalized !== value ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    !normalized.startsWith(WIDGET_LIFECYCLE_EVIDENCE_ROOT)
  ) {
    return null;
  }
  return normalized;
}

function dirtySourcePaths(allowedEvidencePaths) {
  const status = command('git', [
    '-c',
    `safe.directory=${resolve(root)}`,
    '-c',
    'core.quotepath=false',
    'status',
    '--short',
    '--untracked-files=all',
  ]);
  if (!status) return [];
  const allowed = new Set(allowedEvidencePaths);
  return status
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => {
      const paths = line
        .slice(3)
        .split(' -> ')
        .map((path) => path.trim().replaceAll('\\', '/'));
      return paths.some((path) => !allowed.has(path));
    });
}

const expectedTemplate = normalizedJson(createWidgetLifecycleEvidenceTemplate());

if (writeTemplate) {
  mkdirSync(dirname(abs(templatePath)), { recursive: true });
  writeFileSync(abs(templatePath), expectedTemplate);
  console.log(`Wrote ${templatePath.replaceAll('\\', '/')}`);
  process.exit(0);
}

if (checkTemplate) {
  if (!existsSync(abs(templatePath))) {
    console.error(`FAIL Missing ${templatePath}.`);
    process.exit(1);
  }
  let actual;
  try {
    actual = JSON.parse(readFileSync(abs(templatePath), 'utf8'));
  } catch {
    console.error(`FAIL ${templatePath} is not valid JSON.`);
    process.exit(1);
  }
  if (JSON.stringify(actual) !== JSON.stringify(createWidgetLifecycleEvidenceTemplate())) {
    console.error(
      `FAIL ${templatePath} is stale. Run node scripts/phase5/check-widget-lifecycle-evidence.mjs --write-template.`,
    );
    process.exit(1);
  }
  console.log('Phase 5 widget lifecycle evidence template is current.');
  process.exit(0);
}

console.log('Phase 5 widget lifecycle evidence check');

if (!evidencePath) {
  const message =
    'Missing PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH; signed archive, privacy, interaction, cleanup, and Live Activity proof are not attached.';
  if (strict) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
  console.warn(`WARN ${message}`);
  console.log('\nWidget lifecycle evidence remains externally blocked.');
  process.exit(0);
}

const normalizedPath = normalizedEvidencePath(evidencePath);
if (!normalizedPath) {
  console.error(
    `FAIL PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH must be a normalized repo-relative JSON path under ${WIDGET_LIFECYCLE_EVIDENCE_ROOT}.`,
  );
  process.exit(1);
}
if (!existsSync(abs(normalizedPath))) {
  console.error(`FAIL Widget lifecycle evidence file does not exist: ${normalizedPath}.`);
  process.exit(1);
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(abs(normalizedPath), 'utf8'));
} catch (error) {
  console.error(
    `FAIL Widget lifecycle evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
  );
  process.exit(1);
}

let currentHead = '';
try {
  currentHead = command('git', [
    '-c',
    `safe.directory=${resolve(root)}`,
    'rev-parse',
    'HEAD',
  ]).toLowerCase();
} catch {
  console.error('FAIL Current Git HEAD could not be resolved.');
  process.exit(1);
}

const result = validateWidgetLifecycleEvidence(evidence, {
  root,
  expectedGitSha: currentHead,
  expectedBuildId: process.env.PHASE5_IOS_BUILD_ID,
  expectedSignedOffBy: process.env.PHASE5_SIGNED_OFF_BY,
  expectedAppBundleIdentifier: process.env.APP_IOS_BUNDLE_IDENTIFIER,
  expectedTeamIdentifier: process.env.APPLE_TEAM_ID,
});

const allowedEvidencePaths =
  result.errors.length === 0
    ? [
        normalizedPath,
        ...widgetLifecycleArtifactReferences(evidence, result.artifacts)
          .map(({ path }) => normalizedEvidencePath(String(path ?? '')))
          .filter(Boolean),
      ]
    : [];
try {
  const dirty = dirtySourcePaths(allowedEvidencePaths);
  if (dirty.length > 0) {
    result.errors.push(
      `Source worktree differs from sourceGitSha outside the attached evidence paths: ${dirty.join(' | ')}.`,
    );
  }
} catch {
  result.errors.push('Git source cleanliness could not be verified.');
}

for (const warning of result.warnings) console.warn(`WARN ${warning}`);
for (const error of result.errors) console.error(`FAIL ${error}`);

console.log(`Evidence: ${relative(root, abs(normalizedPath)).replaceAll('\\', '/')}`);
console.log(
  `Base reports/artifacts: ${result.summary.baseArtifactCount}/${result.summary.requiredBaseArtifactCount}; proof attachments: ${result.summary.proofAttachmentCount} (minimum ${result.summary.minimumProofAttachmentCount}); scenarios: ${result.summary.scenarioCount}/4.`,
);

if (result.errors.length > 0) {
  console.error(
    `\nPhase 5 widget lifecycle evidence failed on ${result.errors.length} blocker${result.errors.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log('\nPhase 5 widget lifecycle evidence passed.');
