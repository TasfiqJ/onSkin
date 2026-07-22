#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, posix, relative, resolve } from 'node:path';

import { auditGovernedEvidenceChain } from '../launch/governed-evidence-chain.mjs';
import {
  createWidgetLifecycleEvidenceTemplate,
  validateWidgetLifecycleEvidence,
  WIDGET_LIFECYCLE_EVIDENCE_ROOT,
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

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function appendGovernedRoleErrors(result, chain, evidencePath, evidenceBytes) {
  if (chain.status !== 'pass' || !chain.ledger) {
    result.errors.push(`Governed evidence chain is invalid: ${chain.errors.join(' | ')}`);
    return;
  }
  const role = 'phase5-widget-lifecycle';
  const expected = [
    { path: evidencePath, sha256: sha256(evidenceBytes) },
    ...result.artifacts.map(({ path, sha256: digest }) => ({ path, sha256: digest })),
  ];
  const expectedByPath = new Map(expected.map((entry) => [entry.path, entry]));
  if (expectedByPath.size !== expected.length) {
    result.errors.push('Widget lifecycle evidence references duplicate governed paths.');
    return;
  }
  const roleEntries = chain.ledger.entries.filter((entry) => entry.role === role);
  const ledgerByPath = new Map(roleEntries.map((entry) => [entry.path, entry]));
  for (const expectedEntry of expected) {
    const ledgerEntry = ledgerByPath.get(expectedEntry.path);
    if (!ledgerEntry) {
      result.errors.push(
        `Widget lifecycle evidence path is not an exact ${role} ledger entry: ${expectedEntry.path}.`,
      );
    } else if (ledgerEntry.sha256 !== expectedEntry.sha256) {
      result.errors.push(`Widget lifecycle ledger digest does not match ${expectedEntry.path}.`);
    }
  }
  for (const ledgerEntry of roleEntries) {
    if (!expectedByPath.has(ledgerEntry.path)) {
      result.errors.push(
        `Widget lifecycle ledger contains an unreferenced ${role} entry: ${ledgerEntry.path}.`,
      );
    }
  }
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
let evidenceBytes;
try {
  evidenceBytes = readFileSync(abs(normalizedPath));
  evidence = JSON.parse(evidenceBytes.toString('utf8'));
} catch (error) {
  console.error(
    `FAIL Widget lifecycle evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
  );
  process.exit(1);
}

const result = validateWidgetLifecycleEvidence(evidence, {
  root,
  expectedBuildId: process.env.PHASE5_IOS_BUILD_ID,
  expectedSignedOffBy: process.env.PHASE5_SIGNED_OFF_BY,
  expectedAppBundleIdentifier: process.env.APP_IOS_BUNDLE_IDENTIFIER,
  expectedTeamIdentifier: process.env.APPLE_TEAM_ID,
});

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
    appendGovernedRoleErrors(result, chain, normalizedPath, evidenceBytes);
  } catch (error) {
    result.errors.push(
      `Governed evidence chain could not be validated: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
}

for (const warning of result.warnings) console.warn(`WARN ${warning}`);
for (const error of result.errors) console.error(`FAIL ${error}`);

console.log(`Evidence: ${relative(root, abs(normalizedPath)).replaceAll('\\', '/')}`);
console.log(
  `Base reports/artifacts: ${result.summary.baseArtifactCount}/${result.summary.requiredBaseArtifactCount}; proof attachments: ${result.summary.proofAttachmentCount} (minimum ${result.summary.minimumProofAttachmentCount}); scenarios: ${result.summary.scenarioCount}/4.`,
);
console.log(`Governed evidence chain: ${chain?.status ?? 'not-validated'}.`);

if (result.errors.length > 0) {
  console.error(
    `\nPhase 5 widget lifecycle evidence failed on ${result.errors.length} blocker${result.errors.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log('\nPhase 5 widget lifecycle evidence passed.');
