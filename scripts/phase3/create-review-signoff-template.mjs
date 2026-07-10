#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';

const require = createRequire(import.meta.url);
const {
  REVIEW_SIGNOFF_SCHEMA_VERSION,
  REVIEW_WORKLIST_SCHEMA_VERSION,
  computeReviewSnapshotSha256,
} = require('../../apps/mobile/phase3-review-evidence');

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
export const DEFAULT_WORKLIST_PATH = 'docs/phase-3/generated/review-worklist.json';
export const SIGNOFF_DIR = 'docs/phase-3/signoffs';
const RELEASE_DISPOSITIONS = new Set(['approved', 'deferred']);
const SHA256_RE = /^[a-f0-9]{64}$/i;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

export function parseArgs(argv) {
  const options = {
    disposition: '',
    help: false,
    itemId: '',
    list: false,
    outputPath: '',
  };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--list') {
      options.list = true;
      continue;
    }

    const match = arg.match(/^--(item|disposition|output)(?:=(.*))?$/);
    if (!match) throw new Error(`Unsupported argument: ${arg}.`);
    const [, name, inlineValue] = match;
    if (seen.has(name)) throw new Error(`--${name} may be supplied only once.`);
    seen.add(name);
    const value = inlineValue === undefined ? optionValue(argv, index, `--${name}`) : inlineValue;
    if (inlineValue === undefined) index += 1;
    if (!text(value)) throw new Error(`--${name} requires a non-empty value.`);

    if (name === 'item') options.itemId = text(value);
    if (name === 'disposition') options.disposition = text(value).toLowerCase();
    if (name === 'output') options.outputPath = text(value);
  }

  if (options.list && (options.itemId || options.disposition || options.outputPath)) {
    throw new Error('--list cannot be combined with --item, --disposition, or --output.');
  }
  return options;
}

export function assertWorklistUsable(worklist) {
  if (!worklist || typeof worklist !== 'object' || Array.isArray(worklist)) {
    throw new Error('Phase 3 review worklist is not a JSON object.');
  }
  if (worklist.schemaVersion !== REVIEW_WORKLIST_SCHEMA_VERSION) {
    throw new Error(
      `Phase 3 review worklist schemaVersion must be ${REVIEW_WORKLIST_SCHEMA_VERSION}.`,
    );
  }
  if (text(worklist.gitStatus)) {
    throw new Error('Phase 3 review worklist was generated from a dirty worktree.');
  }
  if (
    Number(worklist.summary?.blockerCount) !== 0 ||
    Number(worklist.summary?.missingSourcePathCount) !== 0 ||
    Number(worklist.summary?.warningCount) !== 0 ||
    (Array.isArray(worklist.blockers) && worklist.blockers.length > 0) ||
    (Array.isArray(worklist.warnings) && worklist.warnings.length > 0)
  ) {
    throw new Error(
      'Phase 3 review worklist reports contract blockers, warnings, or missing sources.',
    );
  }
  if (!Array.isArray(worklist.items) || worklist.items.length === 0) {
    throw new Error('Phase 3 review worklist contains no review items.');
  }
}

export function loadWorklist(rootDir = REPO_ROOT, path = DEFAULT_WORKLIST_PATH) {
  const absolutePath = resolve(rootDir, path);
  if (!existsSync(absolutePath)) throw new Error(`Phase 3 review worklist is missing: ${path}.`);
  let worklist;
  try {
    worklist = JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Phase 3 review worklist is invalid JSON: ${error.message}.`);
  }
  assertWorklistUsable(worklist);
  return worklist;
}

export function assertCurrentWorklist(rootDir = REPO_ROOT) {
  const dirtySource = gitStatusExcludingGeneratedEvidence();
  if (dirtySource) {
    throw new Error(
      `Refusing to prepare reviewer evidence from a dirty source tree: ${dirtySource.split(/\r?\n/)[0]}.`,
    );
  }
  const checker = resolve(rootDir, 'scripts/phase3/build-review-worklist.mjs');
  const result = spawnSync(process.execPath, [checker, '--strict', '--check'], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  if (result.status === 0) return;
  const output = `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim();
  throw new Error(
    `Phase 3 review worklist is not current. Run npm run phase3:review-worklist from a clean source commit.${
      output ? ` ${output.split(/\r?\n/)[0]}` : ''
    }`,
  );
}

export function suggestedSignoffPath(itemId) {
  const filename = text(itemId)
    .replace(/:/g, '--')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!filename) throw new Error('Cannot derive a safe signoff filename from the item ID.');
  return `${SIGNOFF_DIR}/${filename}.json`;
}

export function createSignoffTemplate(item, requestedDisposition = '') {
  const id = text(item?.id);
  if (!id) throw new Error('Review item has no stable ID.');
  if (item?.signoff) throw new Error(`${id} already has a detached signoff.`);

  const currentDisposition = text(item?.statusBucket);
  const requested = text(requestedDisposition).toLowerCase();
  if (requested && !RELEASE_DISPOSITIONS.has(requested)) {
    throw new Error('--disposition must be approved or deferred.');
  }
  if (
    RELEASE_DISPOSITIONS.has(currentDisposition) &&
    requested &&
    requested !== currentDisposition
  ) {
    throw new Error(
      `${id} already records ${currentDisposition}; the template disposition cannot contradict it.`,
    );
  }
  const disposition = RELEASE_DISPOSITIONS.has(currentDisposition) ? currentDisposition : requested;
  if (!RELEASE_DISPOSITIONS.has(disposition)) {
    throw new Error(
      `${id} is unresolved; supply --disposition approved or deferred only after a real decision exists.`,
    );
  }

  const computedSnapshotSha256 = computeReviewSnapshotSha256(item);
  if (!SHA256_RE.test(text(item.reviewSnapshotSha256))) {
    throw new Error(`${id} has no valid generated review snapshot SHA-256.`);
  }
  if (text(item.reviewSnapshotSha256).toLowerCase() !== computedSnapshotSha256) {
    throw new Error(`${id} has a stale generated review snapshot SHA-256.`);
  }

  return {
    schemaVersion: REVIEW_SIGNOFF_SCHEMA_VERSION,
    itemId: id,
    reviewSnapshotSha256: computedSnapshotSha256,
    attestor: {
      name: 'REPLACE_WITH_REVIEWER_OR_DECISION_OWNER_NAME',
      credentialOrRole: 'REPLACE_WITH_PROFESSIONAL_CREDENTIAL_OR_OWNER_ROLE',
    },
    reviewDate: 'YYYY-MM-DD',
    decision: {
      disposition,
      conditions: ['REPLACE_WITH_CONDITION_OR_REMOVE_THIS_ENTRY_IF_NONE'],
      conditionsSatisfied: 'REPLACE_WITH_true_OR_false_AFTER_REVIEW',
    },
    evidenceReference: 'REPLACE_WITH_RETAINED_APPROVAL_REFERENCE',
    productionGate:
      disposition === 'deferred'
        ? {
            state: 'REPLACE_WITH_hidden_inert_disabled_excluded_OR_not_exposed',
            reason: 'REPLACE_WITH_DEFERRAL_AND_PRODUCTION_GATE_REASON',
            owner: 'REPLACE_WITH_PRODUCTION_GATE_OWNER',
          }
        : null,
  };
}

export function resolveSafeOutputPath(rootDir, outputPath) {
  const signoffRoot = resolve(rootDir, SIGNOFF_DIR);
  const target = resolve(rootDir, outputPath);
  const targetRelativeToSignoffs = relative(signoffRoot, target);
  if (
    !targetRelativeToSignoffs ||
    targetRelativeToSignoffs.startsWith('..') ||
    /^[a-zA-Z]:/.test(targetRelativeToSignoffs) ||
    dirname(target) !== signoffRoot ||
    !target.toLowerCase().endsWith('.json')
  ) {
    throw new Error(`--output must be a direct JSON child of ${SIGNOFF_DIR}.`);
  }
  return target;
}

export function writeSignoffTemplate(rootDir, outputPath, template) {
  const target = resolveSafeOutputPath(rootDir, outputPath);
  if (existsSync(target)) {
    throw new Error(`Refusing to overwrite existing signoff or draft: ${outputPath}.`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(template, null, 2)}\n`, { flag: 'wx' });
  return target;
}

function listItems(worklist) {
  return worklist.items.map((item) => ({
    id: item.id,
    domain: item.domain,
    area: item.area,
    status: item.status,
    signoffStatus: item.signoffStatus,
    reviewSnapshotSha256: item.reviewSnapshotSha256,
    suggestedOutput: suggestedSignoffPath(item.id),
  }));
}

function usage() {
  return [
    'Phase 3 detached signoff template generator',
    '',
    'List review items:',
    '  npm run phase3:review-signoff-template -- --list',
    '',
    'Print an item-specific draft to stdout:',
    '  npm run phase3:review-signoff-template -- --item <id> --disposition approved|deferred',
    '',
    'Write a non-overwriting draft under docs/phase-3/signoffs:',
    '  npm run phase3:review-signoff-template -- --item <id> --disposition approved|deferred --output docs/phase-3/signoffs/<safe-name>.json',
  ].join('\n');
}

export function runCli(argv, { rootDir = REPO_ROOT } = {}) {
  const options = parseArgs(argv);
  if (options.help) return { kind: 'text', value: usage() };

  assertCurrentWorklist(rootDir);
  const worklist = loadWorklist(rootDir);
  if (options.list) return { kind: 'json', value: listItems(worklist) };
  if (!options.itemId) throw new Error('--item is required unless --list or --help is used.');

  const item = worklist.items.find((candidate) => text(candidate?.id) === options.itemId);
  if (!item) throw new Error(`Unknown Phase 3 review item: ${options.itemId}.`);
  const template = createSignoffTemplate(item, options.disposition);
  if (!options.outputPath) return { kind: 'json', value: template };

  const target = writeSignoffTemplate(rootDir, options.outputPath, template);
  return {
    kind: 'text',
    value: `Wrote ${relative(rootDir, target).replaceAll('\\', '/')}. Complete every placeholder before regenerating the worklist; this draft is not approval evidence.`,
  };
}

const isMain = resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = runCli(process.argv.slice(2));
    console.log(result.kind === 'json' ? JSON.stringify(result.value, null, 2) : result.value);
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
