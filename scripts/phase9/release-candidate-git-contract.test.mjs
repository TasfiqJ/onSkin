import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { linkSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  captureGovernedPublicationPolicy,
  renderGovernedEvidenceLedger,
} from '../launch/governed-evidence-chain.mjs';
import { seedGovernedPublicationSourceFixture } from '../launch/governed-evidence-test-fixture.mjs';
import {
  auditReleaseCandidateGitContract,
  isExactTrackedHeadTextFile,
} from './release-candidate-git-contract.mjs';

const RC_DIR = 'docs/phase-9/release-candidates/rc-2026-07-22-b001';
const MANIFEST = `${RC_DIR}/manifest.md`;
const INDEX = `${RC_DIR}/ios-archive-privacy-evidence.json`;
const LEDGER = `${RC_DIR}/evidence-chain.json`;
const GENERATED = 'docs/phase-9/generated/dependency-inventory.json';
const GENERATED_MD = 'docs/phase-9/generated/dependency-inventory.md';
const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function git(root, ...args) {
  return execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function write(root, path, value) {
  const absolute = join(root, ...path.split('/'));
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function commit(root, message) {
  git(root, 'add', '--all');
  git(root, '-c', 'commit.gpgsign=false', 'commit', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

function fixture(
  t,
  { externalChange = false, externalRenameIntoRc = false, omitIndexFromLedger = false } = {},
) {
  const root = mkdtempSync(join(tmpdir(), 'onskin-rc-git-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  git(root, 'init', '--initial-branch=main');
  git(root, 'config', 'user.email', 'release-contract@example.invalid');
  git(root, 'config', 'user.name', 'Release Contract Test');
  write(root, '.gitattributes', '* text=auto eol=lf\n');
  write(root, 'source.txt', 'source\n');
  seedGovernedPublicationSourceFixture({ fixtureRoot: root, sourceRoot: REPOSITORY_ROOT });
  commit(root, 'source');
  const sourceGitSha = git(root, 'rev-parse', 'HEAD');
  const manifestBytes = '# Manifest\n';
  const indexBytes = '{"schemaVersion":1}\n';
  write(root, MANIFEST, manifestBytes);
  write(root, INDEX, indexBytes);
  const entries = [{ role: 'release-candidate', path: MANIFEST, sha256: digest(manifestBytes) }];
  if (!omitIndexFromLedger) {
    entries.push({ role: 'release-candidate', path: INDEX, sha256: digest(indexBytes) });
  }
  if (externalChange) write(root, 'outside.txt', 'not evidence\n');
  if (externalRenameIntoRc) {
    const renamed = `${RC_DIR}/renamed-source.txt`;
    const destination = join(root, ...renamed.split('/'));
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(join(root, 'source.txt'), destination);
    entries.push({ role: 'release-candidate', path: renamed, sha256: digest('source\n') });
    git(root, 'config', 'diff.renames', 'true');
  }
  write(
    root,
    LEDGER,
    renderGovernedEvidenceLedger({
      sourceGitSha,
      releaseCandidateDir: RC_DIR,
      publicationPolicy: captureGovernedPublicationPolicy(root, sourceGitSha),
      entries,
    }),
  );
  const evidenceCommitSha = commit(root, 'evidence');
  return { evidenceCommitSha, root, sourceGitSha };
}

function auditFixture(fixtureValue, options = {}) {
  return auditReleaseCandidateGitContract({
    ...fixtureValue,
    releaseCandidateDir: RC_DIR,
    requiredTrackedFiles: [MANIFEST, INDEX, LEDGER],
    ...options,
  });
}

test('accepts governed E plus an exact generated tail and binds required RC metadata', (t) => {
  const value = fixture(t);
  write(value.root, GENERATED, '{"generated":true}\n');
  write(value.root, GENERATED_MD, '# Generated dependency inventory\n');
  const headGitSha = commit(value.root, 'generated');
  const result = auditFixture(value);
  assert.equal(result.status, 'pass', result.errors.join('\n'));
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.headGitSha, headGitSha);
  assert.equal(result.evidenceCommitSha, value.evidenceCommitSha);
  assert.equal(result.directEvidenceCommit, true);
  assert.equal(result.evidenceOnlyCommit, true);
  assert.equal(result.cleanWorktree, true);
  assert.equal(result.normalIndexState, true);
  assert.deepEqual(result.ledgerBoundFiles, {
    [MANIFEST]: true,
    [INDEX]: true,
    [LEDGER]: true,
  });
  assert.equal(result.chain.downstreamCommits.length, 1);
  assert.equal(isExactTrackedHeadTextFile(value.root, MANIFEST, RC_DIR), true);
  assert.throws(() => result.errors.push('mutate'), TypeError);
});

test('rejects unbound RC metadata, extra E paths, renames, raw tail edits, and near misses', async (t) => {
  await t.test('required file omitted from ledger', (child) => {
    const result = auditFixture(fixture(child, { omitIndexFromLedger: true }));
    assert.equal(result.status, 'invalid');
    assert.equal(result.ledgerBoundFiles[INDEX], false);
  });
  await t.test('outside change in E', (child) => {
    const result = auditFixture(fixture(child, { externalChange: true }));
    assert.equal(result.status, 'invalid');
    assert.equal(result.evidenceOnlyCommit, false);
  });
  await t.test('outside source renamed into RC', (child) => {
    const result = auditFixture(fixture(child, { externalRenameIntoRc: true }));
    assert.equal(result.status, 'invalid');
    assert.equal(result.evidenceOnlyCommit, false);
  });
  await t.test('later RC mutation', (child) => {
    const value = fixture(child);
    write(value.root, MANIFEST, '# Later mutation\n');
    commit(value.root, 'later RC mutation');
    const result = auditFixture(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /changed after the evidence commit|non-allowlisted/u);
  });
  await t.test('near-miss generated output', (child) => {
    const value = fixture(child);
    write(value.root, 'docs/phase-9/generated/dependency-inventory-copy.json', '{}\n');
    commit(value.root, 'near miss');
    const result = auditFixture(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /non-allowlisted/u);
  });
});

test('rejects modified, hardlinked, skip-worktree, and ignored-untracked metadata', async (t) => {
  await t.test('modified file', (child) => {
    const value = fixture(child);
    write(value.root, MANIFEST, '# Modified\n');
    const result = auditFixture(value);
    assert.equal(result.status, 'invalid');
    assert.equal(result.trackedFiles[MANIFEST], false);
    assert.equal(result.cleanWorktree, false);
  });
  await t.test('hardlinked file', (child) => {
    const value = fixture(child);
    const outside = mkdtempSync(join(tmpdir(), 'onskin-rc-hardlink-'));
    child.after(() => rmSync(outside, { force: true, recursive: true }));
    linkSync(join(value.root, ...MANIFEST.split('/')), join(outside, 'alias'));
    const result = auditFixture(value);
    assert.equal(result.status, 'invalid');
    assert.equal(result.trackedFiles[MANIFEST], false);
  });
  await t.test('skip-worktree outside source file', (child) => {
    const value = fixture(child);
    git(value.root, 'update-index', '--skip-worktree', 'source.txt');
    write(value.root, 'source.txt', 'hidden skip-worktree mutation\n');
    const result = auditFixture(value);
    assert.equal(result.status, 'invalid');
    assert.equal(result.normalIndexState, false);
  });
  await t.test('assume-unchanged outside source file', (child) => {
    const value = fixture(child);
    git(value.root, 'update-index', '--assume-unchanged', 'source.txt');
    write(value.root, 'source.txt', 'hidden assume-unchanged mutation\n');
    const result = auditFixture(value);
    assert.equal(result.status, 'invalid');
    assert.equal(result.normalIndexState, false);
  });
  await t.test('ignored untracked packet', (child) => {
    const root = mkdtempSync(join(tmpdir(), 'onskin-rc-git-'));
    child.after(() => rmSync(root, { force: true, recursive: true }));
    git(root, 'init', '--initial-branch=main');
    git(root, 'config', 'user.email', 'release-contract@example.invalid');
    git(root, 'config', 'user.name', 'Release Contract Test');
    write(root, 'source.txt', 'source\n');
    commit(root, 'source');
    const sourceGitSha = git(root, 'rev-parse', 'HEAD');
    write(root, '.git/info/exclude', 'docs/phase-9/release-candidates/\n');
    write(root, MANIFEST, '# Ignored\n');
    write(root, INDEX, '{}\n');
    const result = auditFixture({ root, sourceGitSha });
    assert.equal(result.status, 'invalid');
    assert.equal(result.trackedFiles[MANIFEST], false);
    assert.equal(result.trackedFiles[INDEX], false);
  });
});

test('ignores inherited Git repository, config, and PATH selection environment', (t) => {
  const value = fixture(t);
  const expectedHeadGitSha = git(value.root, 'rev-parse', 'HEAD');
  const decoyRoot = mkdtempSync(join(tmpdir(), 'onskin-rc-git-decoy-'));
  t.after(() => rmSync(decoyRoot, { force: true, recursive: true }));
  git(decoyRoot, 'init', '--initial-branch=main');
  git(decoyRoot, 'config', 'user.email', 'decoy@example.invalid');
  git(decoyRoot, 'config', 'user.name', 'Decoy Repository');
  write(decoyRoot, 'decoy.txt', 'decoy\n');
  commit(decoyRoot, 'decoy');

  const keys = [
    'GIT_CONFIG_COUNT',
    'GIT_CONFIG_KEY_0',
    'GIT_CONFIG_VALUE_0',
    'GIT_DIR',
    'GIT_INDEX_FILE',
    'GIT_WORK_TREE',
    'PATH',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.GIT_DIR = join(decoyRoot, '.git');
  process.env.GIT_WORK_TREE = decoyRoot;
  process.env.GIT_INDEX_FILE = join(decoyRoot, '.git', 'index');
  process.env.GIT_CONFIG_COUNT = '1';
  process.env.GIT_CONFIG_KEY_0 = 'diff.external';
  process.env.GIT_CONFIG_VALUE_0 = 'not-a-command';
  process.env.PATH = join(decoyRoot, 'path-without-git');
  try {
    const result = auditFixture(value);
    assert.equal(result.status, 'pass');
    assert.equal(result.headGitSha, expectedHeadGitSha);
  } finally {
    for (const [key, prior] of Object.entries(previous)) {
      if (prior === undefined) delete process.env[key];
      else process.env[key] = prior;
    }
  }
});

test('rejects malformed RC directories, unsafe/colliding paths, callbacks, and source SHAs', () => {
  const common = {
    root: process.cwd(),
    sourceGitSha: 'a'.repeat(40),
    releaseCandidateDir: RC_DIR,
    requiredTrackedFiles: [MANIFEST],
  };
  for (const override of [
    { sourceGitSha: 'main' },
    { releaseCandidateDir: 'docs/phase-9/release-candidates/..' },
    { releaseCandidateDir: 'docs/phase-9/release-candidates/_template' },
    { requiredTrackedFiles: [`${RC_DIR}/../escape.md`] },
    { requiredTrackedFiles: [MANIFEST, MANIFEST] },
    { requiredTrackedFiles: [`${RC_DIR}/A.md`, `${RC_DIR}/a.md`] },
    { onPhase: 'not-a-function' },
  ]) {
    assert.throws(() => auditReleaseCandidateGitContract({ ...common, ...override }), TypeError);
  }
});
