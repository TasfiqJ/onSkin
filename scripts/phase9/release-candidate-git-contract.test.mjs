import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  auditReleaseCandidateGitContract,
  isExactTrackedHeadTextFile,
} from './release-candidate-git-contract.mjs';

const RC_DIR = 'docs/phase-9/release-candidates/rc-2026-07-16-b001';
const MANIFEST = `${RC_DIR}/manifest.md`;
const INDEX = `${RC_DIR}/ios-archive-privacy-evidence.json`;

function git(root, ...args) {
  return execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function write(root, path, value) {
  const absolute = join(root, ...path.split('/'));
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, value, 'utf8');
}

function commit(root, message) {
  git(root, 'add', '--all');
  git(root, '-c', 'commit.gpgsign=false', 'commit', '-m', message);
}

function fixture(t, { externalChange = false, externalRenameIntoRc = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'onskin-rc-git-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  git(root, 'init', '--initial-branch=main');
  git(root, 'config', 'user.email', 'release-contract@example.invalid');
  git(root, 'config', 'user.name', 'Release Contract Test');
  write(root, '.gitattributes', '* text=auto eol=lf\n');
  write(root, 'source.txt', 'source\n');
  commit(root, 'source');
  const sourceGitSha = git(root, 'rev-parse', 'HEAD');
  write(root, MANIFEST, '# Manifest\n');
  write(root, INDEX, '{"schemaVersion":1}\n');
  if (externalChange) write(root, 'outside.txt', 'not evidence\n');
  if (externalRenameIntoRc) {
    const destination = join(root, ...`${RC_DIR}/renamed-source.txt`.split('/'));
    mkdirSync(join(destination, '..'), { recursive: true });
    renameSync(join(root, 'source.txt'), destination);
    git(root, 'config', 'diff.renames', 'true');
  }
  commit(root, 'evidence');
  return { root, sourceGitSha };
}

function auditFixture(fixtureValue) {
  return auditReleaseCandidateGitContract({
    ...fixtureValue,
    releaseCandidateDir: RC_DIR,
    requiredTrackedFiles: [MANIFEST, INDEX],
  });
}

test('accepts exactly one clean, RC-only evidence commit with HEAD-bound metadata', (t) => {
  const value = fixture(t);
  const result = auditFixture(value);
  assert.equal(result.status, 'pass');
  assert.equal(result.directEvidenceCommit, true);
  assert.equal(result.evidenceOnlyCommit, true);
  assert.equal(result.cleanWorktree, true);
  assert.equal(result.normalIndexState, true);
  assert.equal(isExactTrackedHeadTextFile(value.root, MANIFEST, RC_DIR), true);
  assert.throws(() => result.errors.push('mutate'), TypeError);
});

test('rejects a second evidence commit and any non-RC change in the evidence commit', async (t) => {
  await t.test('second commit', (child) => {
    const value = fixture(child);
    write(value.root, `${RC_DIR}/notes.md`, 'later\n');
    commit(value.root, 'later evidence mutation');
    const result = auditFixture(value);
    assert.equal(result.status, 'invalid');
    assert.equal(result.directEvidenceCommit, false);
  });
  await t.test('outside change', (child) => {
    const result = auditFixture(fixture(child, { externalChange: true }));
    assert.equal(result.status, 'invalid');
    assert.equal(result.evidenceOnlyCommit, false);
  });
  await t.test('outside file renamed into the RC directory', (child) => {
    const value = fixture(child, { externalRenameIntoRc: true });
    const renameAwarePaths = git(
      value.root,
      'diff',
      '--name-only',
      `${value.sourceGitSha}..HEAD`,
      '--',
    ).split(/\r?\n/u);
    assert.equal(renameAwarePaths.includes('source.txt'), false);
    assert.equal(renameAwarePaths.includes(`${RC_DIR}/renamed-source.txt`), true);

    const result = auditFixture(value);
    assert.equal(result.status, 'invalid');
    assert.equal(result.evidenceOnlyCommit, false);
  });
});

test('rejects modified, skip-worktree, and ignored-untracked metadata', async (t) => {
  await t.test('modified file', (child) => {
    const value = fixture(child);
    write(value.root, MANIFEST, '# Modified\n');
    const result = auditFixture(value);
    assert.equal(result.status, 'invalid');
    assert.equal(result.trackedFiles[MANIFEST], false);
    assert.equal(result.cleanWorktree, false);
  });
  await t.test('skip-worktree file', (child) => {
    const value = fixture(child);
    git(value.root, 'update-index', '--skip-worktree', MANIFEST);
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

test('ignores inherited Git repository and config selection environment', (t) => {
  const value = fixture(t);
  const expectedHeadGitSha = git(value.root, 'rev-parse', 'HEAD');
  const decoyRoot = mkdtempSync(join(tmpdir(), 'onskin-rc-git-decoy-'));
  t.after(() => rmSync(decoyRoot, { force: true, recursive: true }));
  git(decoyRoot, 'init', '--initial-branch=main');
  git(decoyRoot, 'config', 'user.email', 'decoy@example.invalid');
  git(decoyRoot, 'config', 'user.name', 'Decoy Repository');
  write(decoyRoot, 'decoy.txt', 'decoy\n');
  commit(decoyRoot, 'decoy');

  const poisonedEnvironment = {
    GIT_CONFIG_COUNT: process.env.GIT_CONFIG_COUNT,
    GIT_CONFIG_KEY_0: process.env.GIT_CONFIG_KEY_0,
    GIT_CONFIG_VALUE_0: process.env.GIT_CONFIG_VALUE_0,
    GIT_DIR: process.env.GIT_DIR,
    GIT_INDEX_FILE: process.env.GIT_INDEX_FILE,
    GIT_WORK_TREE: process.env.GIT_WORK_TREE,
  };
  process.env.GIT_DIR = join(decoyRoot, '.git');
  process.env.GIT_WORK_TREE = decoyRoot;
  process.env.GIT_INDEX_FILE = join(decoyRoot, '.git', 'index');
  process.env.GIT_CONFIG_COUNT = '1';
  process.env.GIT_CONFIG_KEY_0 = 'diff.renames';
  process.env.GIT_CONFIG_VALUE_0 = 'true';
  try {
    const result = auditFixture(value);
    assert.equal(result.status, 'pass');
    assert.equal(result.headGitSha, expectedHeadGitSha);
  } finally {
    for (const [key, previous] of Object.entries(poisonedEnvironment)) {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }
});

test('rejects malformed RC directories, unsafe paths, and malformed source SHAs', () => {
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
  ]) {
    assert.throws(() => auditReleaseCandidateGitContract({ ...common, ...override }), TypeError);
  }
});
