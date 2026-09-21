import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import {
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GOVERNED_DOWNSTREAM_PUBLICATION_UNITS,
  GOVERNED_LAUNCH_CONTRACT_PATH,
  GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS,
  auditGovernedEvidenceChain,
  parseGovernedEvidenceLedger,
} from '../launch/governed-evidence-chain.mjs';
import { buildEvidenceChainLedger, parseCliArguments } from './build-evidence-chain-ledger.mjs';

const RC_DIR = 'docs/phase-9/release-candidates/rc-2026-07-22-b001';
const MANIFEST = `${RC_DIR}/manifest.md`;
const LEDGER = `${RC_DIR}/evidence-chain.json`;
const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function git(root, args, { input = undefined } = {}) {
  return execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: 'utf8',
    input,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function write(root, path, value) {
  const absolute = join(root, ...path.split('/'));
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
}

function commit(root, message) {
  git(root, ['add', '--all']);
  git(root, ['-c', 'commit.gpgsign=false', 'commit', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function fixture(t, { stageManifest = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-ledger-builder-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.email', 'ledger-builder@example.invalid']);
  git(root, ['config', 'user.name', 'Ledger Builder Test']);
  write(root, '.gitattributes', '* text=auto eol=lf\n');
  write(root, 'source.txt', 'source\n');
  write(
    root,
    GOVERNED_LAUNCH_CONTRACT_PATH,
    readFileSync(join(REPOSITORY_ROOT, ...GOVERNED_LAUNCH_CONTRACT_PATH.split('/'))),
  );
  for (const unitId of GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS) {
    const unit = GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.find(({ id }) => id === unitId);
    for (const repoPath of unit.paths) {
      write(root, repoPath, repoPath.endsWith('.json') ? '{}\n' : '# Source snapshot\n');
    }
  }
  const sourceGitSha = commit(root, 'source');
  write(root, MANIFEST, '# RC manifest\n');
  if (stageManifest) git(root, ['add', '--', MANIFEST]);
  return { root, sourceGitSha };
}

function build(value, options = {}) {
  return buildEvidenceChainLedger({
    root: value.root,
    sourceGitSha: value.sourceGitSha,
    releaseCandidateDir: RC_DIR,
    ...options,
  });
}

test('writes a canonical non-self-referential ledger for exact staged evidence', (t) => {
  const value = fixture(t);
  const result = build(value);
  assert.equal(result.status, 'written');
  assert.equal(result.entryCount, 1);
  assert.equal(result.sourceSnapshotUnitCount, 12);
  assert.equal(result.postEvidenceRequiredUnitCount, 22);
  assert.equal(result.ledgerPath, LEDGER);
  const ledger = parseGovernedEvidenceLedger(readFileSync(join(value.root, ...LEDGER.split('/'))), {
    expectedReleaseCandidateDir: RC_DIR,
    expectedSourceGitSha: value.sourceGitSha,
  });
  assert.deepEqual(
    ledger.entries.map(({ path }) => path),
    [MANIFEST],
  );
  assert.equal(
    ledger.entries.some(({ path }) => path === LEDGER),
    false,
  );
  assert.equal(ledger.publicationPolicy.launchContract.exists, true);
  assert.equal(ledger.publicationPolicy.sourceSnapshotUnits.length, 12);
  assert.equal(
    ledger.publicationPolicy.sourceSnapshotUnits.every(({ files }) =>
      files.every(({ exists, sha256 }) => exists && /^[a-f0-9]{64}$/u.test(sha256)),
    ),
    true,
  );

  git(value.root, ['add', '--', LEDGER]);
  git(value.root, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'evidence']);
  const audit = auditGovernedEvidenceChain({
    root: value.root,
    sourceGitSha: value.sourceGitSha,
    releaseCandidateDir: RC_DIR,
  });
  assert.equal(audit.status, 'pass');
});

test('rejects source-like, deleted, unstaged, untracked, and self-staged inputs', async (t) => {
  await t.test('source-like staged path', (child) => {
    const value = fixture(child);
    write(value.root, 'scripts/not-evidence.mjs', 'export {};\n');
    git(value.root, ['add', '--', 'scripts/not-evidence.mjs']);
    assert.throws(() => build(value), /outside every governed/u);
  });
  await t.test('staged deletion', (child) => {
    const value = fixture(child);
    git(value.root, ['rm', '--', 'source.txt']);
    assert.throws(() => build(value), /must be one added\/modified|outside every governed/u);
  });
  await t.test('unstaged tracked mutation', (child) => {
    const value = fixture(child);
    write(value.root, 'source.txt', 'unstaged mutation\n');
    assert.throws(() => build(value), /unstaged tracked changes/u);
  });
  await t.test('nonignored untracked path', (child) => {
    const value = fixture(child);
    write(value.root, 'notes.txt', 'not staged\n');
    assert.throws(() => build(value), /untracked files must be staged/u);
  });
  await t.test('ledger already in source index', (child) => {
    const value = fixture(child, { stageManifest: false });
    write(value.root, LEDGER, '{}\n');
    git(value.root, ['add', '--', LEDGER]);
    assert.throws(
      () => build(value),
      /absent from the source index|must not include or hash itself/u,
    );
  });
});

test('rejects non-normal index/mode, oversized, and hardlinked evidence', async (t) => {
  await t.test('skip-worktree source entry', (child) => {
    const value = fixture(child);
    git(value.root, ['update-index', '--skip-worktree', 'source.txt']);
    assert.throws(() => build(value), /non-normal entry/u);
  });
  await t.test('symlink-mode staged evidence', (child) => {
    const value = fixture(child);
    // Exercise the staged mode check without an earlier dirty-worktree failure
    // on Linux, where Git otherwise expects an actual working-tree symlink.
    git(value.root, ['config', 'core.symlinks', 'false']);
    const objectId = git(value.root, ['hash-object', '-w', '--stdin'], { input: 'target.txt' });
    git(value.root, ['update-index', '--cacheinfo', `120000,${objectId},${MANIFEST}`]);
    write(value.root, MANIFEST, 'target.txt');
    assert.throws(() => build(value), /100644 staged blob/u);
  });
  await t.test('byte ceiling', (child) => {
    const value = fixture(child, { stageManifest: false });
    write(value.root, MANIFEST, '0123456789abcdef');
    git(value.root, ['add', '--', MANIFEST]);
    assert.throws(
      () => build(value, { maxAggregateBytes: 1024, maxEntryBytes: 8 }),
      /byte ceiling/u,
    );
  });
  await t.test('hardlinked working evidence', (child) => {
    const value = fixture(child);
    const outside = mkdtempSync(join(tmpdir(), 'layerwell-ledger-builder-link-'));
    child.after(() => rmSync(outside, { force: true, recursive: true }));
    linkSync(join(value.root, ...MANIFEST.split('/')), join(outside, 'alias'));
    assert.throws(() => build(value), /working bytes do not exactly match/u);
  });
});

test('detects staged/working/output races and cleans a failed publication', async (t) => {
  await t.test('identical repository-root replacement before writer binding', (child) => {
    const value = fixture(child);
    const displaced = `${value.root}-displaced`;
    child.after(() => rmSync(displaced, { force: true, recursive: true }));
    assert.throws(
      () =>
        build(value, {
          onPhase(phase) {
            if (phase === 'after-builder-capture') {
              renameSync(value.root, displaced);
              cpSync(displaced, value.root, { recursive: true });
            }
          },
        }),
      /repository root identity changed/u,
    );
    assert.equal(existsSync(join(value.root, ...LEDGER.split('/'))), false);
  });
  await t.test('working evidence changes after preflight', (child) => {
    const value = fixture(child);
    assert.throws(
      () =>
        build(value, {
          onPhase(phase) {
            if (phase === 'after-preflight') write(value.root, MANIFEST, '# raced\n');
          },
        }),
      /snapshot drift/u,
    );
    assert.equal(existsSync(join(value.root, ...LEDGER.split('/'))), false);
  });
  await t.test('published ledger tamper', (child) => {
    const value = fixture(child);
    assert.throws(
      () =>
        build(value, {
          onPhase(phase) {
            if (phase === 'after-write') write(value.root, LEDGER, '{"tampered":true}\n');
          },
        }),
      /publication verification|snapshot drift/u,
    );
    assert.equal(existsSync(join(value.root, ...LEDGER.split('/'))), false);
  });
  await t.test('hardlinked pre-existing output', (child) => {
    const value = fixture(child);
    write(value.root, LEDGER, '{}\n');
    const outside = mkdtempSync(join(tmpdir(), 'layerwell-ledger-output-link-'));
    child.after(() => rmSync(outside, { force: true, recursive: true }));
    linkSync(join(value.root, ...LEDGER.split('/')), join(outside, 'alias'));
    assert.throws(() => build(value), /single-link|snapshot drift/u);
    assert.equal(existsSync(join(value.root, ...LEDGER.split('/'))), false);
  });
});

test('requires exact source HEAD and strict arguments', (t) => {
  const value = fixture(t);
  write(value.root, 'later.txt', 'later\n');
  commit(value.root, 'later source');
  assert.throws(() => build(value), /HEAD to equal/u);
  assert.throws(
    () =>
      buildEvidenceChainLedger({
        root: value.root,
        sourceGitSha: 'main',
        releaseCandidateDir: RC_DIR,
      }),
    TypeError,
  );
  assert.throws(
    () =>
      buildEvidenceChainLedger({
        root: value.root,
        sourceGitSha: git(value.root, ['rev-parse', 'HEAD']),
        releaseCandidateDir: 'docs/phase-9/release-candidates/_template',
      }),
    TypeError,
  );
});

test('CLI configuration rejects conflicting provenance environment aliases', () => {
  const sourceGitSha = 'a'.repeat(40);
  const selected = parseCliArguments([], {
    GOVERNED_EVIDENCE_RC_DIR: RC_DIR,
    GOVERNED_EVIDENCE_SOURCE_GIT_SHA: sourceGitSha,
    PHASE9_IOS_SOURCE_GIT_SHA: sourceGitSha,
    PHASE9_RELEASE_CANDIDATE_DIR: RC_DIR,
  });
  assert.deepEqual(selected, { releaseCandidateDir: RC_DIR, sourceGitSha });
  assert.throws(
    () =>
      parseCliArguments([], {
        GOVERNED_EVIDENCE_SOURCE_GIT_SHA: 'b'.repeat(40),
        PHASE9_IOS_SOURCE_GIT_SHA: sourceGitSha,
      }),
    /environment aliases must agree exactly/u,
  );
  assert.throws(
    () =>
      parseCliArguments([], {
        GOVERNED_EVIDENCE_RC_DIR: `${RC_DIR}-other`,
        PHASE9_RELEASE_CANDIDATE_DIR: RC_DIR,
      }),
    /environment aliases must agree exactly/u,
  );
});
