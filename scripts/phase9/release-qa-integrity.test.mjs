import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  CAT07_COMMITTED_INPUT_PATHS,
  CAT07_COMMITTED_MANIFEST_JSON_PATH,
  CAT07_COMMITTED_MANIFEST_MD_PATH,
  CAT07_COMMITTED_SUMMARY_PATH,
  validateCat07CommittedEvidence,
  validateCat07FullEvidenceContract,
} from '../e2e/cat07-committed-evidence.mjs';
import {
  atomicWriteReleaseQaOutputs,
  canonicalReleaseRepoPath,
  captureReleaseCandidateRawEvidenceBindings,
  captureReleaseQaSnapshot,
  evaluateCat07ReleaseEvidence,
  evaluateReleaseCandidateReadiness,
  expectedReleaseCandidateMetadataPaths,
  listPinnedHeadFiles,
  PHASE9_CAT07_BOUND_INPUT_PATHS,
  PHASE9_RELEASE_CANDIDATE_METADATA_FILE_NAMES,
  PHASE9_RELEASE_OPTIONAL_INPUT_MAX_BYTES,
  readPinnedHeadSha,
  readStableRootBoundWorkingFile,
  ReleaseQaSnapshotDriftError,
  runTrustedGit,
  trustedGitEnvironment,
  trustedGitExecutable,
  verifyReleaseCandidateRawEvidenceBindings,
  verifyReleaseQaSnapshot,
} from './release-qa-integrity.mjs';

function git(root, args) {
  return execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim();
}

function writeRepoFile(root, repoPath, contents) {
  const absolute = join(root, ...repoPath.split('/'));
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}

function createFixtureRepo(t) {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-phase9-release-integrity-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.name', 'Phase 9 Test']);
  git(root, ['config', 'user.email', 'phase9@example.invalid']);
  writeRepoFile(root, 'base.txt', 'base\n');
  git(root, ['add', '--', 'base.txt']);
  git(root, ['commit', '--quiet', '-m', 'base']);
  return root;
}

function commitPaths(root, paths, message) {
  git(root, ['add', '--', ...paths]);
  git(root, ['commit', '--quiet', '-m', message]);
}

test('release snapshot paths are repository-confined and canonical', (t) => {
  const root = createFixtureRepo(t);
  assert.equal(canonicalReleaseRepoPath(root, './base.txt'), 'base.txt');
  for (const invalid of [
    '../escape.txt',
    'C:\\escape.txt',
    '/escape.txt',
    'a/../b',
    'a\nfile',
    '.git/config',
    '.GIT/config',
    '.git./config',
    '.git /config',
    'nested/.GiT/index',
  ]) {
    assert.throws(() => canonicalReleaseRepoPath(root, invalid));
  }
});

test('trusted Git uses an absolute executable, a minimal environment, and ignores repository redirection', (t) => {
  const root = createFixtureRepo(t);
  const expectedHead = readPinnedHeadSha(root);
  const decoyRoot = createFixtureRepo(t);
  writeRepoFile(decoyRoot, 'decoy.txt', 'decoy\n');
  commitPaths(decoyRoot, ['decoy.txt'], 'decoy HEAD');
  const decoyHead = git(decoyRoot, ['rev-parse', 'HEAD']);
  assert.notEqual(decoyHead, expectedHead);
  git(root, ['config', 'alias.phase9-env-probe', '!f() { test -z "$PHASE9_SECRET_SENTINEL"; }; f']);

  assert.equal(isAbsolute(trustedGitExecutable()), true);
  const childEnvironment = trustedGitEnvironment();
  assert.equal(childEnvironment.GIT_NO_REPLACE_OBJECTS, '1');
  for (const key of [
    'PHASE9_SECRET_SENTINEL',
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_CONFIG_COUNT',
    'GIT_CONFIG_KEY_0',
    'GIT_CONFIG_VALUE_0',
  ]) {
    assert.equal(Object.hasOwn(childEnvironment, key), false);
  }

  const poisonedKeys = {
    PHASE9_SECRET_SENTINEL: 'must-not-enter-git-child',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.bare',
    GIT_CONFIG_VALUE_0: 'true',
    GIT_DIR: join(decoyRoot, '.git'),
    GIT_INDEX_FILE: join(decoyRoot, '.git', 'index'),
    GIT_OBJECT_DIRECTORY: join(decoyRoot, '.git', 'objects'),
    GIT_WORK_TREE: decoyRoot,
  };
  const previous = Object.fromEntries(
    Object.keys(poisonedKeys).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, poisonedKeys);
  try {
    assert.equal(readPinnedHeadSha(root), expectedHead);
    assert.deepEqual(listPinnedHeadFiles(root, expectedHead, 'base.txt'), ['base.txt']);
    assert.doesNotThrow(() => runTrustedGit(root, ['phase9-env-probe']));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  writeRepoFile(root, 'base.txt', 'replacement-object-bytes\n');
  commitPaths(root, ['base.txt'], 'replacement commit');
  const replacementHead = git(root, ['rev-parse', 'HEAD']);
  git(root, ['checkout', '--quiet', '--detach', expectedHead]);
  git(root, ['replace', expectedHead, replacementHead]);
  const replacementResistantSnapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths: ['out/release.json'],
  });
  assert.equal(replacementResistantSnapshot.headSha, expectedHead);
  assert.equal(
    replacementResistantSnapshot.records['base.txt'].headBytes.toString('utf8'),
    'base\n',
  );
});

test('stable working-file reads reject oversized optional inputs and unsafe ancestors', (t) => {
  const root = createFixtureRepo(t);
  writeRepoFile(root, '.env', 'X'.repeat(PHASE9_RELEASE_OPTIONAL_INPUT_MAX_BYTES + 1));
  const oversized = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths: ['out/release.json'],
    workingInputPaths: ['.env'],
  });
  assert.equal(oversized.workingRecords['.env'].kind, 'too-large');
  assert.equal(oversized.workingRecords['.env'].bytes, null);
  assert.ok(oversized.integrityIssues.includes('.env optional working input is too-large'));

  const outside = mkdtempSync(join(tmpdir(), 'layerwell-phase9-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeRepoFile(outside, 'secret.txt', 'outside\n');
  const linked = join(root, 'linked-parent');
  try {
    symlinkSync(outside, linked, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) {
      t.diagnostic(`ancestor link creation unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  const linkedRead = readStableRootBoundWorkingFile(root, 'linked-parent/secret.txt');
  assert.ok(['unsafe-ancestor', 'outside-root'].includes(linkedRead.kind));
  assert.equal(linkedRead.bytes, null);
});

test('stable working-file reads detect path replacement after descriptor open', (t) => {
  const root = createFixtureRepo(t);
  writeRepoFile(root, 'race.txt', 'original\n');
  const absolute = join(root, 'race.txt');
  const backup = join(root, 'race-original.txt');
  let replaced = false;
  const result = readStableRootBoundWorkingFile(root, 'race.txt', {
    onPhase: (phase) => {
      if (phase !== 'after-open') return;
      try {
        renameSync(absolute, backup);
        writeFileSync(absolute, 'replacement\n');
        replaced = true;
      } catch (error) {
        if (!['EPERM', 'EACCES'].includes(error?.code)) throw error;
      }
    },
  });
  if (!replaced) {
    t.diagnostic('platform denied replacement of an open file');
    return;
  }
  assert.equal(result.kind, 'unstable');
  assert.equal(result.bytes, null);
});

test('snapshot enforces both per-file and aggregate byte ceilings', (t) => {
  const root = createFixtureRepo(t);
  writeRepoFile(root, 'first.txt', '12345678');
  writeRepoFile(root, 'second.txt', 'abcdefgh');
  commitPaths(root, ['first.txt', 'second.txt'], 'bounded inputs');
  assert.equal(
    readStableRootBoundWorkingFile(root, 'first.txt', { maxBytes: 7 }).kind,
    'too-large',
  );
  assert.throws(
    () =>
      captureReleaseQaSnapshot({
        root,
        inputPaths: ['first.txt', 'second.txt'],
        outputPaths: ['out/release.json'],
        maxInputBytes: 8,
        maxAggregateInputBytes: 15,
        optionalWorkingInputMaxBytes: 8,
      }),
    /aggregate|length/u,
  );
});

test('release-candidate readiness requires exact pinned metadata plus real gate results', (t) => {
  const root = createFixtureRepo(t);
  const releaseCandidateDir = 'docs/phase-9/release-candidates/rc-2026-07-22-b001';
  const expectedFiles = expectedReleaseCandidateMetadataPaths(root, releaseCandidateDir);
  assert.ok(expectedFiles.includes(`${releaseCandidateDir}/evidence-chain.json`));
  const sourceGitSha = 'a'.repeat(40);
  for (const fileName of PHASE9_RELEASE_CANDIDATE_METADATA_FILE_NAMES) {
    const value =
      fileName === 'manifest.md'
        ? `| Build-source Git SHA | ${sourceGitSha} |\n`
        : `fixture:${fileName}\n`;
    writeRepoFile(root, `${releaseCandidateDir}/${fileName}`, value);
  }
  commitPaths(root, expectedFiles, 'release candidate metadata');
  const observedTrackedFiles = listPinnedHeadFiles(
    root,
    readPinnedHeadSha(root),
    releaseCandidateDir,
  );
  assert.deepEqual(observedTrackedFiles, expectedFiles);
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: expectedFiles,
    outputPaths: ['out/release.json'],
  });
  const configuredArchiveEvidencePath = `${releaseCandidateDir}/ios-archive-privacy-evidence.json`;
  let gitAuditCalls = 0;
  let crossBindingCalls = 0;
  const passingOptions = {
    root,
    releaseCandidateDir,
    observedTrackedFiles,
    snapshot,
    configuredArchiveEvidencePath,
    configuredSourceGitSha: sourceGitSha,
    claimsComplete: true,
    auditGitContract: (options) => {
      gitAuditCalls += 1;
      assert.deepEqual(options.requiredTrackedFiles, expectedFiles);
      assert.equal(options.sourceGitSha, sourceGitSha);
      return { errors: [], headGitSha: snapshot.headSha, status: 'pass' };
    },
    auditCrossBinding: (options) => {
      crossBindingCalls += 1;
      assert.equal(options.releaseCandidateDir, releaseCandidateDir);
      assert.equal(options.sourceGitSha, sourceGitSha);
      return { status: 'pass' };
    },
  };
  const passing = evaluateReleaseCandidateReadiness(passingOptions);
  assert.equal(passing.status, 'pass');
  assert.equal(passing.inventoryStatus, 'pass');
  assert.equal(passing.pinnedMetadataStatus, 'pass');
  assert.equal(passing.gitContract.status, 'pass');
  assert.equal(passing.crossBinding.status, 'pass');
  assert.equal(gitAuditCalls, 1);
  assert.equal(crossBindingCalls, 1);

  for (const observed of [
    [],
    expectedFiles.slice(1),
    [...expectedFiles, `${releaseCandidateDir}/extra.md`],
  ]) {
    const blocked = evaluateReleaseCandidateReadiness({
      ...passingOptions,
      observedTrackedFiles: observed,
    });
    assert.equal(blocked.status, 'blocked');
    assert.equal(blocked.inventoryStatus, 'blocked');
  }
  for (const invalidDir of [
    '',
    'docs/phase-9/release-candidates/_template',
    'docs/phase-9/release-candidates/arbitrary',
    'docs/phase-9/release-candidates/rc-UPPERCASE',
  ]) {
    assert.equal(
      evaluateReleaseCandidateReadiness({
        ...passingOptions,
        releaseCandidateDir: invalidDir,
      }).status,
      'blocked',
    );
  }

  const manifestPath = `${releaseCandidateDir}/manifest.md`;
  const unpinnedSnapshot = {
    ...snapshot,
    records: {
      ...snapshot.records,
      [manifestPath]: {
        ...snapshot.records[manifestPath],
        workingTreeMatchesHead: false,
      },
    },
  };
  assert.equal(
    evaluateReleaseCandidateReadiness({
      ...passingOptions,
      snapshot: unpinnedSnapshot,
    }).status,
    'blocked',
  );
  assert.equal(
    evaluateReleaseCandidateReadiness({
      ...passingOptions,
      configuredArchiveEvidencePath: `${releaseCandidateDir}/other.json`,
    }).status,
    'blocked',
  );
  assert.equal(
    evaluateReleaseCandidateReadiness({
      ...passingOptions,
      configuredSourceGitSha: 'b'.repeat(40),
    }).status,
    'blocked',
  );
  assert.equal(
    evaluateReleaseCandidateReadiness({ ...passingOptions, claimsComplete: false }).status,
    'blocked',
  );

  crossBindingCalls = 0;
  const gitBlocked = evaluateReleaseCandidateReadiness({
    ...passingOptions,
    auditGitContract: () => ({ errors: ['forged evidence commit'], status: 'invalid' }),
  });
  assert.equal(gitBlocked.status, 'blocked');
  assert.equal(gitBlocked.gitContract.status, 'blocked');
  assert.equal(crossBindingCalls, 0);

  const crossBindingBlocked = evaluateReleaseCandidateReadiness({
    ...passingOptions,
    auditCrossBinding: () => ({ status: 'blocked' }),
  });
  assert.equal(crossBindingBlocked.status, 'blocked');
  assert.equal(crossBindingBlocked.crossBinding.status, 'blocked');
});

test('pinned snapshot detects stale working bytes, status drift, and HEAD movement', (t) => {
  const root = createFixtureRepo(t);
  const outputs = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths: outputs,
  });
  assert.equal(snapshot.records['base.txt'].workingTreeMatchesHead, true);
  assert.equal(snapshot.gitStatusEntries.length, 0);

  writeRepoFile(root, 'base.txt', 'stale working bytes\n');
  const workingDrift = verifyReleaseQaSnapshot(snapshot);
  assert.equal(workingDrift.status, 'blocked');
  assert.ok(
    workingDrift.errors.some((error) => error.includes('NUL-delimited Git status changed')),
  );
  assert.ok(workingDrift.errors.some((error) => error.includes('base.txt working bytes changed')));

  writeRepoFile(root, 'base.txt', 'base\n');
  writeRepoFile(root, 'second.txt', 'second\n');
  commitPaths(root, ['second.txt'], 'move HEAD');
  const headDrift = verifyReleaseQaSnapshot(snapshot);
  assert.equal(headDrift.status, 'blocked');
  assert.ok(headDrift.errors.some((error) => error.includes('Git HEAD changed')));
});

test('committed packet check snapshots reject dirty generatedAt plus late source and raw drift', (t) => {
  const root = createFixtureRepo(t);
  const outputs = ['docs/generated/packet.json', 'docs/generated/packet.md'];
  writeRepoFile(
    root,
    outputs[0],
    '{\n  "generatedAt": "2026-07-22T12:34:56.789Z",\n  "status": "pass"\n}\n',
  );
  writeRepoFile(root, outputs[1], '# Packet\n\nGenerated: 2026-07-22T12:34:56.789Z\n');
  writeRepoFile(root, 'raw/evidence.bin', Buffer.from('immutable raw evidence\n', 'utf8'));
  commitPaths(root, [...outputs, 'raw/evidence.bin'], 'committed generated packet');

  const captureCheckSnapshot = () =>
    captureReleaseQaSnapshot({
      root,
      inputPaths: ['base.txt', 'raw/evidence.bin', ...outputs],
      outputPaths: [],
    });
  const clean = captureCheckSnapshot();
  for (const path of outputs) {
    assert.equal(clean.records[path].workingTreeMatchesHead, true);
  }

  writeRepoFile(
    root,
    outputs[0],
    '{\n  "generatedAt": "2099-01-01T00:00:00.000Z",\n  "status": "pass"\n}\n',
  );
  const dirtyGeneratedAt = verifyReleaseQaSnapshot(clean);
  assert.equal(dirtyGeneratedAt.status, 'blocked');
  assert.ok(
    dirtyGeneratedAt.errors.some((error) =>
      error.includes('docs/generated/packet.json working bytes changed'),
    ),
  );

  writeRepoFile(
    root,
    outputs[0],
    '{\n  "generatedAt": "2026-07-22T12:34:56.789Z",\n  "status": "pass"\n}\n',
  );
  const lateSourceSnapshot = captureCheckSnapshot();
  writeRepoFile(root, 'base.txt', 'late source drift\n');
  const lateSource = verifyReleaseQaSnapshot(lateSourceSnapshot);
  assert.equal(lateSource.status, 'blocked');
  assert.ok(lateSource.errors.some((error) => error.includes('base.txt working bytes changed')));

  writeRepoFile(root, 'base.txt', 'base\n');
  const lateRawSnapshot = captureCheckSnapshot();
  writeRepoFile(root, 'raw/evidence.bin', Buffer.from('late raw drift\n', 'utf8'));
  const lateRaw = verifyReleaseQaSnapshot(lateRawSnapshot);
  assert.equal(lateRaw.status, 'blocked');
  assert.ok(
    lateRaw.errors.some((error) => error.includes('raw/evidence.bin working bytes changed')),
  );
});

test('pinned snapshot rejects non-normal index flags and detects index-only drift', (t) => {
  const root = createFixtureRepo(t);
  const outputs = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths: outputs,
  });

  git(root, ['update-index', '--assume-unchanged', '--', 'base.txt']);
  const drift = verifyReleaseQaSnapshot(snapshot);
  assert.equal(drift.status, 'blocked');
  assert.ok(drift.errors.some((error) => error.includes('complete normal Git index')));
  assert.throws(
    () =>
      captureReleaseQaSnapshot({
        root,
        inputPaths: ['base.txt'],
        outputPaths: outputs,
      }),
    /non-normal flag entry/u,
  );
  git(root, ['update-index', '--no-assume-unchanged', '--', 'base.txt']);
});

test('pinned snapshot distinguishes missing and untracked release inputs', (t) => {
  const root = createFixtureRepo(t);
  const missing = captureReleaseQaSnapshot({
    root,
    inputPaths: ['missing.json'],
    outputPaths: ['out/release.json'],
  });
  assert.ok(
    missing.integrityIssues.includes('missing.json does not exist as a blob in pinned HEAD'),
  );
  assert.ok(missing.integrityIssues.includes('missing.json is missing in the working tree'));

  writeRepoFile(root, 'missing.json', '{}\n');
  const untracked = captureReleaseQaSnapshot({
    root,
    inputPaths: ['missing.json'],
    outputPaths: ['out/release.json'],
  });
  assert.ok(
    untracked.integrityIssues.includes('missing.json does not exist as a blob in pinned HEAD'),
  );
  assert.equal(untracked.records['missing.json'].workingKind, 'file');
  assert.equal(untracked.records['missing.json'].workingTreeMatchesHead, false);
  assert.ok(untracked.gitStatusEntries.some((entry) => entry.status === '??'));
});

test('snapshot rechecks ignored optional working inputs without publishing their hashes', (t) => {
  const root = createFixtureRepo(t);
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths: ['out/release.json'],
    workingInputPaths: ['.env'],
  });
  assert.equal(snapshot.workingRecords['.env'].kind, 'missing');
  assert.equal(Object.hasOwn(snapshot.records, '.env'), false);
  writeRepoFile(root, '.env', 'PRIVATE_VALUE=changed\n');
  const drift = verifyReleaseQaSnapshot(snapshot);
  assert.equal(drift.status, 'blocked');
  assert.ok(drift.errors.some((error) => error.includes('.env optional working input changed')));
});

test('real committed CAT07 validator rejects missing, untracked, forged, and stale evidence', (t) => {
  const root = createFixtureRepo(t);
  const head = readPinnedHeadSha(root);
  const missing = validateCat07CommittedEvidence(root, { expectedHeadSha: head });
  assert.equal(missing.status, 'blocked');
  assert.ok(missing.errors.some((error) => error.includes('must exist in HEAD')));

  for (const repoPath of CAT07_COMMITTED_INPUT_PATHS) writeRepoFile(root, repoPath, '{}\n');
  const untracked = validateCat07CommittedEvidence(root, { expectedHeadSha: head });
  assert.equal(untracked.status, 'blocked');
  assert.ok(untracked.errors.some((error) => error.includes('must exist in HEAD')));

  commitPaths(root, [...CAT07_COMMITTED_INPUT_PATHS], 'forged CAT07 evidence');
  const forgedHead = readPinnedHeadSha(root);
  const forged = validateCat07CommittedEvidence(root, { expectedHeadSha: forgedHead });
  assert.equal(forged.status, 'blocked');
  assert.ok(forged.errors.some((error) => error.includes('schemaVersion')));

  writeRepoFile(root, CAT07_COMMITTED_SUMMARY_PATH, '{"schemaVersion":2,"verdict":"pass"}\n');
  const stale = validateCat07CommittedEvidence(root, { expectedHeadSha: forgedHead });
  assert.equal(stale.status, 'blocked');
  assert.ok(
    stale.errors.includes(`${CAT07_COMMITTED_SUMMARY_PATH} working bytes do not match HEAD`),
  );
});

test('real full CAT07 validator rejects timeout, execution failure, and PASS-marker mismatch', (t) => {
  const root = createFixtureRepo(t);
  const head = readPinnedHeadSha(root);
  const pass = validateCat07FullEvidenceContract(root, {
    expectedHeadSha: head,
    execute: () => `PASS committed CAT07 full evidence contract ${head}\n`,
  });
  assert.equal(pass.status, 'pass');

  const markerMismatch = validateCat07FullEvidenceContract(root, {
    expectedHeadSha: head,
    execute: () => `PASS committed CAT07 full evidence contract ${'0'.repeat(40)}\n`,
  });
  assert.equal(markerMismatch.status, 'blocked');
  assert.ok(markerMismatch.errors.some((error) => error.includes('reviewed PASS marker')));

  const executionFailure = validateCat07FullEvidenceContract(root, {
    expectedHeadSha: head,
    execute: () => {
      const error = new Error('failure');
      error.stderr = 'validator exited 9';
      throw error;
    },
  });
  assert.equal(executionFailure.status, 'blocked');
  assert.ok(executionFailure.errors.some((error) => error.includes('validator failed')));

  const timeout = validateCat07FullEvidenceContract(root, {
    expectedHeadSha: head,
    execute: () => {
      const error = new Error('timeout');
      error.code = 'ETIMEDOUT';
      throw error;
    },
  });
  assert.equal(timeout.status, 'blocked');
  assert.ok(timeout.errors.length > 0);
});

test('Phase 9 CAT07 gate binds both validator results to exact pinned artifact hashes', (t) => {
  const root = createFixtureRepo(t);
  for (const repoPath of PHASE9_CAT07_BOUND_INPUT_PATHS) {
    writeRepoFile(root, repoPath, `fixture:${repoPath}\n`);
  }
  commitPaths(root, [...PHASE9_CAT07_BOUND_INPUT_PATHS], 'CAT07 bound inputs');
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: [...PHASE9_CAT07_BOUND_INPUT_PATHS],
    outputPaths: ['out/release.json'],
  });
  const committedPass = {
    errors: [],
    headSha: snapshot.headSha,
    manifestSha256: snapshot.records[CAT07_COMMITTED_MANIFEST_JSON_PATH].headSha256,
    markdownSha256: snapshot.records[CAT07_COMMITTED_MANIFEST_MD_PATH].headSha256,
    status: 'pass',
    summarySha256: snapshot.records[CAT07_COMMITTED_SUMMARY_PATH].headSha256,
  };
  const fullPass = { errors: [], headSha: snapshot.headSha, status: 'pass' };
  const gate = evaluateCat07ReleaseEvidence({
    expectedHeadSha: snapshot.headSha,
    snapshot,
    validateCommitted: (_root, options) => {
      assert.equal(options.expectedHeadSha, snapshot.headSha);
      return committedPass;
    },
    validateFull: (_root, options) => {
      assert.equal(options.expectedHeadSha, snapshot.headSha);
      return fullPass;
    },
  });
  assert.equal(gate.status, 'pass');
  assert.equal(gate.committed.status, 'pass');
  assert.equal(gate.full.status, 'pass');

  const forged = evaluateCat07ReleaseEvidence({
    expectedHeadSha: snapshot.headSha,
    snapshot,
    validateCommitted: () => ({ ...committedPass, summarySha256: '0'.repeat(64) }),
    validateFull: () => fullPass,
  });
  assert.equal(forged.status, 'blocked');
  assert.ok(forged.errors.some((error) => error.includes('summary validator hash')));
});

test('atomic publication removes outputs when ignored mounted raw RC evidence changes', (t) => {
  const root = createFixtureRepo(t);
  const releaseCandidateDir = 'docs/phase-9/release-candidates/rc-2026-07-22-b002';
  writeRepoFile(root, '.gitignore', `${releaseCandidateDir}/evidence/\n`);
  const rawFiles = [
    [`${releaseCandidateDir}/evidence/ios/archive.xcarchive.zip`, 'archive-bytes\n'],
    [`${releaseCandidateDir}/evidence/ios/eas-build.log`, 'build-log\n'],
    [`${releaseCandidateDir}/evidence/ios/privacy-report.pdf`, 'privacy-report-a\n'],
  ];
  const references = rawFiles.map(([repoPath, value]) => {
    writeRepoFile(root, repoPath, value);
    return {
      path: repoPath,
      sha256: createHash('sha256').update(value).digest('hex'),
      sizeBytes: Buffer.byteLength(value),
    };
  });
  const indexBytes = Buffer.from(
    JSON.stringify({
      archive: { file: references[0] },
      provenance: { easBuildLog: references[1] },
      artifacts: { privacyReport: references[2] },
    }),
  );
  const sourceGitSha = 'c'.repeat(40);
  const expectedFiles = expectedReleaseCandidateMetadataPaths(root, releaseCandidateDir);
  for (const fileName of PHASE9_RELEASE_CANDIDATE_METADATA_FILE_NAMES) {
    const contents =
      fileName === 'manifest.md'
        ? `| Build-source Git SHA | ${sourceGitSha} |\n`
        : fileName === 'ios-archive-privacy-evidence.json'
          ? indexBytes
          : `fixture:${fileName}\n`;
    writeRepoFile(root, `${releaseCandidateDir}/${fileName}`, contents);
  }
  commitPaths(root, ['.gitignore', ...expectedFiles], 'bind mounted RC evidence');

  const outputPaths = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt', '.gitignore', ...expectedFiles],
    outputPaths,
  });
  assert.equal(snapshot.gitStatusEntries.length, 0);
  const initialEvaluation = evaluateReleaseCandidateReadiness({
    root,
    releaseCandidateDir,
    observedTrackedFiles: listPinnedHeadFiles(root, snapshot.headSha, releaseCandidateDir),
    snapshot,
    configuredArchiveEvidencePath: `${releaseCandidateDir}/ios-archive-privacy-evidence.json`,
    configuredSourceGitSha: sourceGitSha,
    claimsComplete: true,
    auditGitContract: () => ({ errors: [], headGitSha: snapshot.headSha, status: 'pass' }),
    auditCrossBinding: () => ({ status: 'pass' }),
  });
  assert.equal(initialEvaluation.status, 'pass');
  const binding = captureReleaseCandidateRawEvidenceBindings({
    root,
    releaseCandidateDir,
    indexBytes:
      snapshot.records[`${releaseCandidateDir}/ios-archive-privacy-evidence.json`].headBytes,
  });
  assert.equal(verifyReleaseCandidateRawEvidenceBindings(binding).status, 'pass');

  assert.throws(
    () =>
      atomicWriteReleaseQaOutputs({
        root,
        snapshot,
        outputs: [
          { path: outputPaths[0], bytes: '{}\n' },
          { path: outputPaths[1], bytes: '# Release\n' },
        ],
        verifyAdditional: () => verifyReleaseCandidateRawEvidenceBindings(binding).errors,
        onPhase: (phase) => {
          if (phase === 'after-write') {
            writeRepoFile(root, rawFiles[2][0], 'privacy-report-b\n');
          }
        },
      }),
    ReleaseQaSnapshotDriftError,
  );
  assert.equal(existsSync(join(root, ...outputPaths[0].split('/'))), false);
  assert.equal(existsSync(join(root, ...outputPaths[1].split('/'))), false);
  assert.equal(verifyReleaseCandidateRawEvidenceBindings(binding).status, 'blocked');
});

test('atomic packet publication removes both outputs when an input drifts after writing', (t) => {
  const root = createFixtureRepo(t);
  const outputPaths = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths: outputPaths,
  });
  assert.throws(
    () =>
      atomicWriteReleaseQaOutputs({
        root,
        snapshot,
        outputs: [
          { path: outputPaths[0], bytes: '{}\n' },
          { path: outputPaths[1], bytes: '# Release\n' },
        ],
        onPhase: (phase) => {
          if (phase === 'after-write') writeRepoFile(root, 'base.txt', 'drifted\n');
        },
      }),
    ReleaseQaSnapshotDriftError,
  );
  assert.equal(existsSync(join(root, ...outputPaths[0].split('/'))), false);
  assert.equal(existsSync(join(root, ...outputPaths[1].split('/'))), false);
});

test('atomic packet publication removes both outputs on index-only flag drift', (t) => {
  const root = createFixtureRepo(t);
  const outputPaths = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths,
  });
  assert.throws(
    () =>
      atomicWriteReleaseQaOutputs({
        root,
        snapshot,
        outputs: [
          { path: outputPaths[0], bytes: '{}\n' },
          { path: outputPaths[1], bytes: '# Release\n' },
        ],
        onPhase: (phase) => {
          if (phase === 'after-preflight') {
            git(root, ['update-index', '--skip-worktree', '--', 'base.txt']);
          }
        },
      }),
    ReleaseQaSnapshotDriftError,
  );
  assert.equal(existsSync(join(root, ...outputPaths[0].split('/'))), false);
  assert.equal(existsSync(join(root, ...outputPaths[1].split('/'))), false);
  git(root, ['update-index', '--no-skip-worktree', '--', 'base.txt']);
});

test('atomic packet publication writes the exact pair when the snapshot remains stable', (t) => {
  const root = createFixtureRepo(t);
  const outputPaths = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths: outputPaths,
  });
  atomicWriteReleaseQaOutputs({
    root,
    snapshot,
    outputs: [
      { path: outputPaths[0], bytes: '{}\n' },
      { path: outputPaths[1], bytes: '# Release\n' },
    ],
  });
  assert.equal(readFileSync(join(root, ...outputPaths[0].split('/')), 'utf8'), '{}\n');
  assert.equal(readFileSync(join(root, ...outputPaths[1].split('/')), 'utf8'), '# Release\n');
});

test('atomic packet publication can replace a recently published pair on Windows filesystems', (t) => {
  const root = createFixtureRepo(t);
  const outputPaths = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths,
  });
  atomicWriteReleaseQaOutputs({
    root,
    snapshot,
    outputs: [
      { path: outputPaths[0], bytes: '{"publication":1}\n' },
      { path: outputPaths[1], bytes: '# Publication 1\n' },
    ],
  });
  atomicWriteReleaseQaOutputs({
    root,
    snapshot,
    outputs: [
      { path: outputPaths[0], bytes: '{"publication":2}\n' },
      { path: outputPaths[1], bytes: '# Publication 2\n' },
    ],
  });
  assert.equal(
    readFileSync(join(root, ...outputPaths[0].split('/')), 'utf8'),
    '{"publication":2}\n',
  );
  assert.equal(readFileSync(join(root, ...outputPaths[1].split('/')), 'utf8'), '# Publication 2\n');
});

test('atomic packet publication removes a temporary file when post-open work throws', (t) => {
  const root = createFixtureRepo(t);
  const outputPaths = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths,
  });
  let injected = false;
  assert.throws(
    () =>
      atomicWriteReleaseQaOutputs({
        root,
        snapshot,
        outputs: [
          { path: outputPaths[0], bytes: '{}\n' },
          { path: outputPaths[1], bytes: '# Release\n' },
        ],
        onPhase: (phase) => {
          if (phase === 'after-temporary-open' && !injected) {
            injected = true;
            throw new Error('synthetic post-open failure');
          }
        },
      }),
    /synthetic post-open failure/u,
  );
  assert.equal(injected, true);
  assert.deepEqual(readdirSync(join(root, 'out')), []);
});

test('atomic packet publication detects post-verification byte tampering and removes the pair', (t) => {
  const root = createFixtureRepo(t);
  const outputPaths = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths,
  });
  let tampered = false;
  assert.throws(
    () =>
      atomicWriteReleaseQaOutputs({
        root,
        snapshot,
        outputs: [
          { path: outputPaths[0], bytes: '{}\n' },
          { path: outputPaths[1], bytes: '# Release\n' },
        ],
        onPhase: (phase) => {
          if (phase === 'after-output-verification' && !tampered) {
            writeFileSync(join(root, ...outputPaths[0].split('/')), '{"tampered":true}\n');
            tampered = true;
          }
        },
      }),
    ReleaseQaSnapshotDriftError,
  );
  assert.equal(tampered, true);
  assert.equal(existsSync(join(root, ...outputPaths[0].split('/'))), false);
  assert.equal(existsSync(join(root, ...outputPaths[1].split('/'))), false);
});

test('atomic packet publication rejects an output-parent junction swap without writing outside', (t) => {
  const root = createFixtureRepo(t);
  const outside = mkdtempSync(join(tmpdir(), 'layerwell-phase9-output-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const outputPaths = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths,
  });
  const outputParent = join(root, 'out');
  const originalParent = join(root, 'out-original');
  let swapped = false;
  try {
    assert.throws(
      () =>
        atomicWriteReleaseQaOutputs({
          root,
          snapshot,
          outputs: [
            { path: outputPaths[0], bytes: '{}\n' },
            { path: outputPaths[1], bytes: '# Release\n' },
          ],
          onPhase: (phase) => {
            if (phase !== 'after-preflight' || swapped) return;
            renameSync(outputParent, originalParent);
            try {
              symlinkSync(outside, outputParent, process.platform === 'win32' ? 'junction' : 'dir');
              swapped = true;
            } catch (error) {
              renameSync(originalParent, outputParent);
              if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) return;
              throw error;
            }
          },
        }),
      /identity changed|regular repository directory|escapes/u,
    );
  } finally {
    if (swapped) {
      rmSync(outputParent, { force: true });
      renameSync(originalParent, outputParent);
    }
  }
  if (!swapped) {
    t.diagnostic('platform denied output-parent junction creation');
    return;
  }
  assert.equal(existsSync(join(outside, 'release.json')), false);
  assert.equal(existsSync(join(outside, 'release.md')), false);
  assert.deepEqual(readdirSync(outputParent), []);
});

test('atomic packet publication rejects a repository-root mismatch', (t) => {
  const root = createFixtureRepo(t);
  const otherRoot = createFixtureRepo(t);
  const outputPaths = ['out/release.json', 'out/release.md'];
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: ['base.txt'],
    outputPaths,
  });
  assert.throws(
    () =>
      atomicWriteReleaseQaOutputs({
        root: otherRoot,
        snapshot,
        outputs: [
          { path: outputPaths[0], bytes: '{}\n' },
          { path: outputPaths[1], bytes: '# Release\n' },
        ],
      }),
    /does not match the snapshotted repository root/u,
  );
  assert.equal(existsSync(join(otherRoot, ...outputPaths[0].split('/'))), false);
  assert.equal(existsSync(join(otherRoot, ...outputPaths[1].split('/'))), false);
});
