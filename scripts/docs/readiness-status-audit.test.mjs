import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, parse } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GOVERNED_DOWNSTREAM_PUBLICATION_UNITS,
  GOVERNED_LAUNCH_CONTRACT_PATH,
  GOVERNED_POST_E_PUBLICATION_DAG_EDGES,
  GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS,
  GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS,
  auditGovernedEvidenceChain,
  captureGovernedEvidenceWorkingBindings,
  captureGovernedPublicationPolicy,
  renderGovernedEvidenceLedger,
  verifyGovernedEvidenceWorkingBindings,
} from '../launch/governed-evidence-chain.mjs';
import {
  atomicWriteReadinessStatusOutputs,
  buildReadinessGovernedEvidenceChainSummary,
  buildReadinessSourceSnapshotSummary,
  canonicalReadinessRepoPath,
  captureReadinessStatusSnapshot,
  listReadinessMobileTestFiles,
  parseReadinessMobileTestFileList,
  readStableReadinessInput,
  readinessSnapshotIntegrityBlockers,
  READINESS_OUTPUT_JSON_PATH,
  READINESS_OUTPUT_MD_PATH,
  READINESS_GOVERNED_PACKET_CHECK_COMMAND,
  READINESS_STATIC_INPUT_PATHS,
  readinessVerificationLifecycleBlockers,
  resolveReadinessOutputPaths,
  reviewedReadinessTestBaseline,
  trustedReadinessGitEnvironment,
  trustedReadinessGitExecutable,
  validateReadinessCommittedProvenance,
  verifyReadinessStatusSnapshot,
} from './readiness-status-audit.mjs';

const GOVERNED_RC_DIR = 'docs/phase-9/release-candidates/rc-2026-07-22-b001';
const GOVERNED_LEDGER = `${GOVERNED_RC_DIR}/evidence-chain.json`;
const GOVERNED_MANIFEST = `${GOVERNED_RC_DIR}/manifest.md`;
const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function requiredPostEvidenceOrder() {
  const remaining = new Set(GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS);
  const completed = new Set();
  const ordered = [];
  while (remaining.size > 0) {
    const next = [...remaining]
      .sort()
      .find((unitId) =>
        GOVERNED_POST_E_PUBLICATION_DAG_EDGES.filter(({ after }) => after === unitId).every(
          ({ before }) => completed.has(before),
        ),
      );
    if (!next) throw new Error('test publication policy contains a cycle');
    ordered.push(next);
    completed.add(next);
    remaining.delete(next);
  }
  return ordered;
}

const REQUIRED_POST_E_ORDER = requiredPostEvidenceOrder();

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
  const root = mkdtempSync(join(tmpdir(), 'onskin-readiness-integrity-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.name', 'Readiness Test']);
  git(root, ['config', 'user.email', 'readiness@example.invalid']);
  writeRepoFile(root, 'input.txt', 'input\n');
  git(root, ['add', '--', 'input.txt']);
  git(root, ['commit', '--quiet', '-m', 'base']);
  return root;
}

test('readiness lifecycle keeps pre-S verification source-safe and post-F checks ordered', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.deepEqual(readinessVerificationLifecycleBlockers(packageJson), []);
  assert.equal(
    packageJson.scripts['release:governed-packets:check'],
    READINESS_GOVERNED_PACKET_CHECK_COMMAND,
  );

  const launchDeadlock = structuredClone(packageJson);
  launchDeadlock.scripts['launch:verify'] += ' && npm run e2e:human:manifest:check';
  assert.ok(
    readinessVerificationLifecycleBlockers(launchDeadlock).some((blocker) =>
      blocker.includes('launch:verify must not run post-E/F command'),
    ),
  );

  const devicePacketDeadlock = structuredClone(packageJson);
  devicePacketDeadlock.scripts['launch:verify'] +=
    ' && npm run docs:device-support-policy-audit:check';
  assert.ok(
    readinessVerificationLifecycleBlockers(devicePacketDeadlock).some((blocker) =>
      blocker.includes(
        'launch:verify must not run post-E/F command npm run docs:device-support-policy-audit:check',
      ),
    ),
  );

  const phase9Deadlock = structuredClone(packageJson);
  phase9Deadlock.scripts['phase9:verify'] += ' && npm run phase9:qa-packet';
  assert.ok(
    readinessVerificationLifecycleBlockers(phase9Deadlock).some((blocker) =>
      blocker.includes('phase9:verify must not run post-E/F command'),
    ),
  );

  const incompletePostF = structuredClone(packageJson);
  incompletePostF.scripts['release:governed-packets:check'] = 'npm run e2e:human:manifest:check';
  assert.ok(
    readinessVerificationLifecycleBlockers(incompletePostF).some((blocker) =>
      blocker.includes('release:governed-packets:check must own'),
    ),
  );
});

function commitPaths(root, paths, message) {
  git(root, ['add', '--', ...paths]);
  git(root, ['commit', '--quiet', '-m', message]);
}

function provenanceMarkdown(sourceSnapshot) {
  const inputMapSha = createHash('sha256')
    .update(JSON.stringify(sourceSnapshot.inputSha256))
    .digest('hex');
  return [
    '# Readiness Status Audit',
    '',
    `Provenance contract: ${sourceSnapshot.provenanceContract}`,
    `Pinned HEAD: ${sourceSnapshot.headSha}`,
    `Governed build source: ${sourceSnapshot.governedEvidenceChain.sourceGitSha}`,
    `Governed evidence commit: ${sourceSnapshot.governedEvidenceChain.evidenceCommitSha}`,
    `Governed release candidate: ${sourceSnapshot.governedEvidenceChain.releaseCandidateDir}`,
    `Governed ledger: ${sourceSnapshot.governedEvidenceChain.ledgerPath}`,
    `Governed ledger SHA-256: ${sourceSnapshot.governedEvidenceChain.ledgerSha256}`,
    `NUL Git status SHA-256: ${sourceSnapshot.gitStatusSha256}`,
    `Source-input inventory SHA-256: ${sourceSnapshot.inputInventorySha256}`,
    `Input SHA snapshot: ${inputMapSha}`,
    `Mobile test inventory SHA-256: ${sourceSnapshot.mobileTestInventorySha256}`,
    '',
  ].join('\n');
}

function evidenceOnlyGovernedSummary(evidenceAudit, readinessSourceHeadSha) {
  return {
    schemaVersion: 1,
    sourceGitSha: evidenceAudit.sourceGitSha,
    evidenceCommitSha: evidenceAudit.evidenceCommitSha,
    releaseCandidateDir: evidenceAudit.releaseCandidateDir,
    ledgerPath: evidenceAudit.ledgerPath,
    ledgerSha256: createHash('sha256')
      .update(renderGovernedEvidenceLedger(evidenceAudit.ledger))
      .digest('hex'),
    ledgerEntryCount: evidenceAudit.ledger.entries.length,
    publicationPolicyId: evidenceAudit.ledger.publicationPolicy.policyId,
    sourceSnapshotUnitCount: evidenceAudit.ledger.publicationPolicy.sourceSnapshotUnits.length,
    postEvidenceRequiredUnitCount:
      evidenceAudit.ledger.publicationPolicy.postEvidenceRequiredUnitIds.length,
    readinessSourceHeadSha,
  };
}

function createProvenanceFixture(
  t,
  {
    bypassEvidenceCommit = false,
    extraEvidenceFiles = [],
    mutateLedgerEvidence = false,
    omitGeneratedTail = false,
    tailExtraFiles = [],
  } = {},
) {
  const root = createFixtureRepo(t);
  writeRepoFile(root, 'apps/mobile/example.test.ts', 'export {};\n');
  writeRepoFile(
    root,
    GOVERNED_LAUNCH_CONTRACT_PATH,
    readFileSync(join(REPOSITORY_ROOT, ...GOVERNED_LAUNCH_CONTRACT_PATH.split('/'))),
  );
  const sourcePolicyPaths = [GOVERNED_LAUNCH_CONTRACT_PATH];
  for (const unitId of GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS) {
    const unit = GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.find(({ id }) => id === unitId);
    for (const repoPath of unit.paths) {
      writeRepoFile(root, repoPath, repoPath.endsWith('.json') ? '{}\n' : '# Source snapshot\n');
      sourcePolicyPaths.push(repoPath);
    }
  }
  commitPaths(root, ['apps/mobile/example.test.ts', ...sourcePolicyPaths], 'build source S');
  const sourceGitSha = git(root, ['rev-parse', 'HEAD']);
  let governedEvidenceChain = null;
  let evidenceAudit = null;
  let evidenceCommitSha = null;
  if (!bypassEvidenceCommit) {
    const manifestBytes = '# Governed RC manifest\n';
    writeRepoFile(root, GOVERNED_MANIFEST, manifestBytes);
    writeRepoFile(
      root,
      GOVERNED_LEDGER,
      renderGovernedEvidenceLedger({
        sourceGitSha,
        releaseCandidateDir: GOVERNED_RC_DIR,
        publicationPolicy: captureGovernedPublicationPolicy(root, sourceGitSha),
        entries: [
          {
            role: 'release-candidate',
            path: GOVERNED_MANIFEST,
            sha256: createHash('sha256').update(manifestBytes).digest('hex'),
          },
        ],
      }),
    );
    commitPaths(root, [GOVERNED_MANIFEST, GOVERNED_LEDGER], 'governed evidence E');
    evidenceCommitSha = git(root, ['rev-parse', 'HEAD']);
    evidenceAudit = auditGovernedEvidenceChain({
      root,
      sourceGitSha,
      releaseCandidateDir: GOVERNED_RC_DIR,
    });
    assert.equal(evidenceAudit.status, 'pass');
    governedEvidenceChain = evidenceOnlyGovernedSummary(evidenceAudit, evidenceCommitSha);
  }

  if (!omitGeneratedTail) {
    for (const [index, unitId] of REQUIRED_POST_E_ORDER.entries()) {
      const unit = GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.find(({ id }) => id === unitId);
      for (const repoPath of unit.paths) {
        writeRepoFile(
          root,
          repoPath,
          repoPath.endsWith('.json')
            ? `${JSON.stringify({ generated: true, unitId })}\n`
            : `# Generated ${unitId}\n`,
        );
      }
      const extraPaths = [];
      if (index === 0) {
        for (const [repoPath, contents] of tailExtraFiles) {
          writeRepoFile(root, repoPath, contents);
          extraPaths.push(repoPath);
        }
        if (mutateLedgerEvidence) {
          writeRepoFile(root, GOVERNED_MANIFEST, '# Mutated after E\n');
          extraPaths.push(GOVERNED_MANIFEST);
        }
      }
      commitPaths(root, [...unit.paths, ...extraPaths], `generated ${unitId}`);
      if (extraPaths.length > 0) break;
    }
  }
  const sourceHeadSha = git(root, ['rev-parse', 'HEAD']);
  if (bypassEvidenceCommit) {
    governedEvidenceChain = {
      schemaVersion: 1,
      sourceGitSha,
      evidenceCommitSha: sourceHeadSha,
      releaseCandidateDir: GOVERNED_RC_DIR,
      ledgerPath: GOVERNED_LEDGER,
      ledgerSha256: '0'.repeat(64),
      ledgerEntryCount: 1,
      publicationPolicyId: 'ios-all-features-generated-publication-v1',
      sourceSnapshotUnitCount: 12,
      postEvidenceRequiredUnitCount: 22,
      readinessSourceHeadSha: sourceHeadSha,
    };
  } else if (omitGeneratedTail || tailExtraFiles.length > 0 || mutateLedgerEvidence) {
    governedEvidenceChain = {
      ...governedEvidenceChain,
      readinessSourceHeadSha: sourceHeadSha,
    };
  } else {
    const sourceChainAudit = auditGovernedEvidenceChain({
      root,
      sourceGitSha,
      releaseCandidateDir: GOVERNED_RC_DIR,
      expectedHeadSha: sourceHeadSha,
    });
    assert.equal(sourceChainAudit.status, 'pass');
    governedEvidenceChain = buildReadinessGovernedEvidenceChainSummary(sourceChainAudit);
  }
  const outputPaths = [READINESS_OUTPUT_JSON_PATH, READINESS_OUTPUT_MD_PATH];
  const sourceInputPaths = ['input.txt', 'apps/mobile/example.test.ts'];
  const source = captureReadinessStatusSnapshot({
    root,
    inputPaths: sourceInputPaths,
    outputPaths,
  });
  assert.deepEqual(readinessSnapshotIntegrityBlockers(source), []);
  const sourceSnapshot = buildReadinessSourceSnapshotSummary({
    root,
    snapshot: source,
    sourceInputPaths,
    mobileTestPaths: ['apps/mobile/example.test.ts'],
    governedEvidenceChain,
  });
  const markdown = provenanceMarkdown(sourceSnapshot);
  writeRepoFile(root, outputPaths[0], `${JSON.stringify({ sourceSnapshot }, null, 2)}\n`);
  writeRepoFile(root, outputPaths[1], markdown);
  for (const [repoPath, contents] of extraEvidenceFiles) writeRepoFile(root, repoPath, contents);
  commitPaths(
    root,
    [...outputPaths, ...extraEvidenceFiles.map(([repoPath]) => repoPath)],
    'evidence B',
  );
  return {
    root,
    currentHeadSha: git(root, ['rev-parse', 'HEAD']),
    evidenceAudit,
    markdown,
    outputPaths,
    sourceGitSha,
    evidenceCommitSha,
    sourceHeadSha,
    sourceSnapshot,
    staticInputPaths: ['input.txt'],
  };
}

test('readiness paths reject traversal, absolute paths, controls, and case-folded Git paths', (t) => {
  const root = createFixtureRepo(t);
  assert.equal(canonicalReadinessRepoPath(root, './docs/out.json'), 'docs/out.json');
  for (const invalid of [
    '../escape.json',
    join(parse(root).root, 'escape.json'),
    '/escape.json',
    'docs/../escape.json',
    'docs/out.json\nsecond',
    '.git/config',
    '.GIT/config',
    '.git./config',
    'nested/.git /index',
  ]) {
    assert.throws(() => canonicalReadinessRepoPath(root, invalid));
  }
});

test('readiness output env cannot redirect publication or forge reviewed test baselines', (t) => {
  const root = createFixtureRepo(t);
  assert.deepEqual(resolveReadinessOutputPaths(root), {
    jsonPath: 'docs/generated/readiness-status-audit.json',
    mdPath: 'docs/generated/readiness-status-audit.md',
  });
  assert.deepEqual(
    resolveReadinessOutputPaths(root, {
      READINESS_STATUS_AUDIT_JSON: './docs/generated/readiness-status-audit.json',
      READINESS_STATUS_AUDIT_MD: './docs/generated/readiness-status-audit.md',
    }),
    {
      jsonPath: 'docs/generated/readiness-status-audit.json',
      mdPath: 'docs/generated/readiness-status-audit.md',
    },
  );
  for (const environment of [
    { READINESS_STATUS_AUDIT_JSON: 'package.json' },
    { READINESS_STATUS_AUDIT_MD: 'README.md' },
    { READINESS_STATUS_AUDIT_JSON: '.git/config' },
    { READINESS_STATUS_AUDIT_MD: '../outside.md' },
  ]) {
    assert.throws(() => resolveReadinessOutputPaths(root, environment));
  }

  assert.deepEqual(reviewedReadinessTestBaseline(), {
    expectedMobileTestFiles: 304,
    expectedMobileTests: 3607,
  });
  assert.doesNotThrow(() =>
    reviewedReadinessTestBaseline({ READINESS_TEST_FILES: '304', READINESS_TESTS: '3607' }),
  );
  for (const environment of [
    { READINESS_TEST_FILES: '1' },
    { READINESS_TEST_FILES: '304.0' },
    { READINESS_TESTS: '0' },
    { READINESS_TESTS: '999999' },
  ]) {
    assert.throws(() => reviewedReadinessTestBaseline(environment));
  }
});

test('readiness immutable source closure includes the governed topology implementation and contracts', () => {
  for (const repoPath of [
    'scripts/launch/governed-evidence-chain.mjs',
    'scripts/launch/governed-evidence-chain.test.mjs',
    'scripts/launch/governed-publication-coverage.mjs',
    'scripts/launch/governed-publication-coverage.test.mjs',
    'scripts/phase9/release-qa-integrity.mjs',
    'scripts/phase9/release-qa-integrity.test.mjs',
    'scripts/phase9/build-evidence-chain-ledger.mjs',
    'scripts/phase9/build-evidence-chain-ledger.test.mjs',
    'scripts/phase9/release-candidate-git-contract.mjs',
    'scripts/phase9/release-candidate-git-contract.test.mjs',
    'docs/phase-9/release-candidates/_template/evidence-chain.json',
    'docs/phase-9/release-candidates/README.md',
    'docs/phase-9/source-of-truth.md',
  ]) {
    assert.equal(READINESS_STATIC_INPUT_PATHS.includes(repoPath), true, repoPath);
  }
  assert.equal(new Set(READINESS_STATIC_INPUT_PATHS).size, READINESS_STATIC_INPUT_PATHS.length);
});

test('mobile test inventory parser is fatal on malformed bytes, duplicates, and portable collisions', (t) => {
  const root = createFixtureRepo(t);
  assert.deepEqual(
    parseReadinessMobileTestFileList(
      root,
      Buffer.from('apps/mobile/a.test.ts\0apps/mobile/not-a-test.ts\0apps/mobile/b.spec.tsx\0'),
    ),
    ['apps/mobile/a.test.ts', 'apps/mobile/b.spec.tsx'],
  );
  for (const bytes of [
    Buffer.from([0xff, 0x00]),
    Buffer.from('apps/mobile/a.test.ts'),
    Buffer.from('apps/mobile/a.test.ts\0apps/mobile/a.test.ts\0'),
    Buffer.from('apps/mobile/A.test.ts\0apps/mobile/a.test.ts\0'),
    Buffer.from('apps/mobile/../escape.test.ts\0'),
    Buffer.from('/apps/mobile/absolute.test.ts\0'),
    Buffer.from('apps/mobile/.git/config.test.ts\0'),
    Buffer.from('outside.test.ts\0'),
  ]) {
    assert.throws(() => parseReadinessMobileTestFileList(root, bytes));
  }
  assert.throws(() =>
    parseReadinessMobileTestFileList(
      root,
      Buffer.from('apps/mobile/a.test.ts\0apps/mobile/b.test.ts\0'),
      { maxEntries: 1 },
    ),
  );
});

test('readiness input reader rejects oversize and linked ancestors and detects path replacement', (t) => {
  const root = createFixtureRepo(t);
  writeRepoFile(root, 'oversize.txt', '123456789');
  const oversized = readStableReadinessInput(root, 'oversize.txt', { maxBytes: 8 });
  assert.equal(oversized.kind, 'too-large');
  assert.equal(oversized.bytes, null);

  const outside = mkdtempSync(join(tmpdir(), 'onskin-readiness-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeRepoFile(outside, 'secret.txt', 'outside\n');
  const linkedParent = join(root, 'linked-parent');
  try {
    symlinkSync(outside, linkedParent, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) throw error;
    t.diagnostic(`ancestor link creation unavailable: ${error.code}`);
  }
  if (existsSync(linkedParent)) {
    const linked = readStableReadinessInput(root, 'linked-parent/secret.txt');
    assert.ok(['unsafe-ancestor', 'outside-root'].includes(linked.kind));
    assert.equal(linked.bytes, null);
  }

  writeRepoFile(root, 'race.txt', 'original\n');
  const absolute = join(root, 'race.txt');
  const backup = join(root, 'race-original.txt');
  let replaced = false;
  const raced = readStableReadinessInput(root, 'race.txt', {
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
  if (replaced) {
    assert.equal(raced.kind, 'unstable');
    assert.equal(raced.bytes, null);
  } else {
    t.diagnostic('platform denied replacement of an open file');
  }
});

test('readiness snapshot enforces its aggregate ceiling before retaining oversized input sets', (t) => {
  const root = createFixtureRepo(t);
  writeRepoFile(root, 'first.txt', '12345678');
  writeRepoFile(root, 'second.txt', 'abcdefgh');
  commitPaths(root, ['first.txt', 'second.txt'], 'bounded inputs');
  assert.throws(
    () =>
      captureReadinessStatusSnapshot({
        root,
        inputPaths: ['first.txt', 'second.txt'],
        outputPaths: ['out/a.json', 'out/a.md'],
        maxInputBytes: 8,
        maxAggregateInputBytes: 15,
      }),
    /aggregate|length/u,
  );
});

test('readiness Git discovery ignores malicious PATH, repository redirection, and secret env', (t) => {
  const root = createFixtureRepo(t);
  writeRepoFile(root, 'apps/mobile/example.test.ts', 'export {};\n');
  commitPaths(root, ['apps/mobile/example.test.ts'], 'mobile test');
  const expectedHead = git(root, ['rev-parse', 'HEAD']);

  const decoy = createFixtureRepo(t);
  writeRepoFile(decoy, 'decoy.txt', 'decoy\n');
  commitPaths(decoy, ['decoy.txt'], 'decoy');
  assert.notEqual(git(decoy, ['rev-parse', 'HEAD']), expectedHead);
  const provenance = createProvenanceFixture(t);

  assert.equal(isAbsolute(trustedReadinessGitExecutable()), true);
  const trustedEnvironment = trustedReadinessGitEnvironment();
  for (const key of [
    'READINESS_SECRET_SENTINEL',
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_CONFIG_COUNT',
    'GIT_CONFIG_KEY_0',
    'GIT_CONFIG_VALUE_0',
  ]) {
    assert.equal(Object.hasOwn(trustedEnvironment, key), false);
  }

  const maliciousPath = mkdtempSync(join(tmpdir(), 'onskin-readiness-path-'));
  t.after(() => rmSync(maliciousPath, { recursive: true, force: true }));
  writeRepoFile(maliciousPath, process.platform === 'win32' ? 'git.cmd' : 'git', 'exit 99\n');
  const poisoned = {
    PATH: maliciousPath,
    READINESS_SECRET_SENTINEL: 'must-not-enter-git',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.bare',
    GIT_CONFIG_VALUE_0: 'true',
    GIT_DIR: join(decoy, '.git'),
    GIT_INDEX_FILE: join(decoy, '.git', 'index'),
    GIT_OBJECT_DIRECTORY: join(decoy, '.git', 'objects'),
    GIT_WORK_TREE: decoy,
  };
  const previous = Object.fromEntries(Object.keys(poisoned).map((key) => [key, process.env[key]]));
  Object.assign(process.env, poisoned);
  try {
    assert.deepEqual(listReadinessMobileTestFiles(root), ['apps/mobile/example.test.ts']);
    const snapshot = captureReadinessStatusSnapshot({
      root,
      inputPaths: ['input.txt', 'apps/mobile/example.test.ts'],
      outputPaths: ['out/a.json', 'out/a.md'],
    });
    assert.equal(snapshot.headSha, expectedHead);
    assert.equal(snapshot.records['apps/mobile/example.test.ts'].workingTreeMatchesHead, true);
    const provenanceResult = validateReadinessCommittedProvenance({
      ...provenance,
      recordedSourceSnapshot: provenance.sourceSnapshot,
      recordedMarkdown: provenance.markdown,
    });
    assert.deepEqual(provenanceResult.blockers, []);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('readiness pass invariant rejects dirty unrelated files and modified or untracked inputs', (t) => {
  const root = createFixtureRepo(t);
  const outputPaths = ['out/a.json', 'out/a.md'];
  const clean = captureReadinessStatusSnapshot({
    root,
    inputPaths: ['input.txt'],
    outputPaths,
  });
  assert.deepEqual(readinessSnapshotIntegrityBlockers(clean), []);

  writeRepoFile(root, 'unrelated.txt', 'committed\n');
  commitPaths(root, ['unrelated.txt'], 'tracked unrelated file');
  writeRepoFile(root, 'unrelated.txt', 'dirty\n');
  const dirtyUnrelated = captureReadinessStatusSnapshot({
    root,
    inputPaths: ['input.txt'],
    outputPaths,
  });
  assert.ok(
    readinessSnapshotIntegrityBlockers(dirtyUnrelated).some((blocker) =>
      blocker.includes('zero output-excluded Git status entries'),
    ),
  );

  writeRepoFile(root, 'unrelated.txt', 'committed\n');
  writeRepoFile(root, 'input.txt', 'modified input\n');
  const modifiedInput = captureReadinessStatusSnapshot({
    root,
    inputPaths: ['input.txt'],
    outputPaths,
  });
  assert.ok(
    readinessSnapshotIntegrityBlockers(modifiedInput).some((blocker) =>
      blocker.includes('input.txt working bytes do not match pinned HEAD'),
    ),
  );

  writeRepoFile(root, 'input.txt', 'input\n');
  writeRepoFile(root, 'untracked-input.txt', 'untracked input\n');
  const untrackedInput = captureReadinessStatusSnapshot({
    root,
    inputPaths: ['input.txt', 'untracked-input.txt'],
    outputPaths,
  });
  const untrackedBlockers = readinessSnapshotIntegrityBlockers(untrackedInput);
  assert.ok(
    untrackedBlockers.some((blocker) =>
      blocker.includes('untracked-input.txt does not exist as a blob in pinned HEAD'),
    ),
  );
  assert.equal(untrackedBlockers.length > 0 ? 'blocked' : 'pass', 'blocked');
});

test('readiness provenance accepts S -> E -> exact generated R -> readiness-only F', (t) => {
  const fixture = createProvenanceFixture(t);
  const result = validateReadinessCommittedProvenance({
    ...fixture,
    recordedSourceSnapshot: fixture.sourceSnapshot,
    recordedMarkdown: fixture.markdown,
  });
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.expectedSourceSnapshot, fixture.sourceSnapshot);
  assert.equal(result.expectedSourceSnapshot.inputSha256Basis, 'pinned-head-blob-bytes');
  assert.equal(result.expectedSourceSnapshot.inputSha256['input.txt'].length, 64);
  assert.equal(
    result.expectedSourceSnapshot.governedEvidenceChain.sourceGitSha,
    fixture.sourceGitSha,
  );
  assert.equal(
    result.expectedSourceSnapshot.governedEvidenceChain.evidenceCommitSha,
    fixture.evidenceCommitSha,
  );
  assert.equal(
    result.expectedSourceSnapshot.governedEvidenceChain.readinessSourceHeadSha,
    fixture.sourceHeadSha,
  );
});

test('readiness governed topology rejects bypasses, unauthorized tails, evidence mutation, near misses, and extra F files', async (t) => {
  await t.test('collapsed E to F without generated R', (child) => {
    const fixture = createProvenanceFixture(child, { omitGeneratedTail: true });
    assert.throws(
      () => buildReadinessGovernedEvidenceChainSummary(fixture.evidenceAudit),
      /post-evidence generated tail/u,
    );
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: fixture.sourceSnapshot,
      recordedMarkdown: fixture.markdown,
    });
    assert.ok(
      result.blockers.some((blocker) =>
        blocker.includes('Governed evidence chain is invalid: readiness F'),
      ),
    );
  });

  await t.test('bypassed E', (child) => {
    const fixture = createProvenanceFixture(child, { bypassEvidenceCommit: true });
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: fixture.sourceSnapshot,
      recordedMarkdown: fixture.markdown,
    });
    assert.ok(
      result.blockers.some((blocker) => blocker.includes('Governed evidence chain is invalid')),
    );
  });

  await t.test('unauthorized tail source file', (child) => {
    const fixture = createProvenanceFixture(child, {
      tailExtraFiles: [['scripts/unauthorized-tail.mjs', 'export {};\n']],
    });
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: fixture.sourceSnapshot,
      recordedMarkdown: fixture.markdown,
    });
    assert.ok(result.blockers.some((blocker) => blocker.includes('non-allowlisted')));
  });

  await t.test('mutated ledger-bound evidence', (child) => {
    const fixture = createProvenanceFixture(child, { mutateLedgerEvidence: true });
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: fixture.sourceSnapshot,
      recordedMarkdown: fixture.markdown,
    });
    assert.ok(
      result.blockers.some((blocker) => blocker.includes('changed after the evidence commit')),
    );
  });

  await t.test('arbitrary generated near-miss', (child) => {
    const fixture = createProvenanceFixture(child, {
      tailExtraFiles: [['docs/phase-9/generated/dependency-inventory-copy.json', '{}\n']],
    });
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: fixture.sourceSnapshot,
      recordedMarkdown: fixture.markdown,
    });
    assert.ok(result.blockers.some((blocker) => blocker.includes('non-allowlisted')));
  });

  await t.test('extra allowlisted file in final F', (child) => {
    const fixture = createProvenanceFixture(child, {
      extraEvidenceFiles: [['docs/generated/source-packet-audit.json', '{"tampered":true}\n']],
    });
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: fixture.sourceSnapshot,
      recordedMarkdown: fixture.markdown,
    });
    assert.ok(
      result.blockers.some((blocker) =>
        blocker.includes('Source-to-evidence commit diff must contain exactly the governed'),
      ),
    );
    assert.ok(
      result.blockers.some((blocker) => blocker.includes('Governed evidence chain is invalid')),
    );
  });

  await t.test('readiness pair published before final F', (child) => {
    const fixture = createProvenanceFixture(child, {
      tailExtraFiles: [
        [READINESS_OUTPUT_JSON_PATH, '{"premature":true}\n'],
        [READINESS_OUTPUT_MD_PATH, '# Premature readiness\n'],
      ],
    });
    const chain = auditGovernedEvidenceChain({
      root: fixture.root,
      sourceGitSha: fixture.sourceGitSha,
      releaseCandidateDir: GOVERNED_RC_DIR,
      expectedHeadSha: fixture.currentHeadSha,
    });
    assert.equal(chain.status, 'invalid');
    assert.match(
      chain.errors.join('\n'),
      /fails to publish exactly one governed JSON\/Markdown pair/u,
    );
    assert.throws(
      () =>
        buildReadinessGovernedEvidenceChainSummary(chain, {
          allowFinalReadinessCommit: true,
        }),
      /passing governed evidence-chain audit/u,
    );
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: fixture.sourceSnapshot,
      recordedMarkdown: fixture.markdown,
    });
    assert.ok(
      result.blockers.some((blocker) => blocker.includes('Governed evidence chain is invalid')),
    );
  });
});

test('readiness two-commit provenance rejects forged or stale cryptographic bindings', async (t) => {
  await t.test('forged sourceSnapshot', (child) => {
    const fixture = createProvenanceFixture(child);
    const forged = { ...fixture.sourceSnapshot, inputCount: 99 };
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: forged,
      recordedMarkdown: fixture.markdown,
    });
    assert.ok(result.blockers.some((blocker) => blocker.includes('does not exactly match')));
  });

  await t.test('stale input hash', (child) => {
    const fixture = createProvenanceFixture(child);
    const stale = {
      ...fixture.sourceSnapshot,
      inputSha256: { ...fixture.sourceSnapshot.inputSha256, 'input.txt': '0'.repeat(64) },
    };
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: stale,
      recordedMarkdown: provenanceMarkdown(stale),
    });
    assert.ok(result.blockers.some((blocker) => blocker.includes('does not exactly match')));
    assert.ok(result.blockers.some((blocker) => blocker.includes('Input SHA snapshot')));
  });

  await t.test('forged Markdown binding', (child) => {
    const fixture = createProvenanceFixture(child);
    const forgedMarkdown = fixture.markdown.replace(
      /^Pinned HEAD: .+$/mu,
      `Pinned HEAD: ${'0'.repeat(40)}`,
    );
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: fixture.sourceSnapshot,
      recordedMarkdown: forgedMarkdown,
    });
    assert.ok(result.blockers.some((blocker) => blocker.includes('Markdown Pinned HEAD')));
  });
});

test('readiness two-commit provenance rejects unrelated, repeated, and missing-source histories', async (t) => {
  await t.test('unrelated evidence change', (child) => {
    const fixture = createProvenanceFixture(child, {
      extraEvidenceFiles: [['unrelated.txt', 'not generated evidence\n']],
    });
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: fixture.sourceSnapshot,
      recordedMarkdown: fixture.markdown,
    });
    assert.ok(result.blockers.some((blocker) => blocker.includes('exactly the governed')));
  });

  await t.test('second evidence commit', (child) => {
    const fixture = createProvenanceFixture(child);
    writeRepoFile(
      fixture.root,
      fixture.outputPaths[0],
      `${JSON.stringify({ sourceSnapshot: fixture.sourceSnapshot, revision: 2 }, null, 2)}\n`,
    );
    writeRepoFile(fixture.root, fixture.outputPaths[1], `${fixture.markdown}Revision: 2\n`);
    commitPaths(fixture.root, fixture.outputPaths, 'second evidence commit');
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      currentHeadSha: git(fixture.root, ['rev-parse', 'HEAD']),
      recordedSourceSnapshot: fixture.sourceSnapshot,
      recordedMarkdown: fixture.markdown,
    });
    assert.ok(result.blockers.some((blocker) => blocker.includes('only direct parent')));
  });

  await t.test('missing source commit', (child) => {
    const fixture = createProvenanceFixture(child);
    const missing = { ...fixture.sourceSnapshot, headSha: 'f'.repeat(40) };
    const result = validateReadinessCommittedProvenance({
      ...fixture,
      recordedSourceSnapshot: missing,
      recordedMarkdown: provenanceMarkdown(missing),
    });
    assert.ok(result.blockers.some((blocker) => blocker.includes('does not exist')));
  });
});

test('readiness snapshot detects input, status, and HEAD drift', (t) => {
  const root = createFixtureRepo(t);
  const outputPaths = ['out/a.json', 'out/a.md'];

  const inputSnapshot = captureReadinessStatusSnapshot({
    root,
    inputPaths: ['input.txt'],
    outputPaths,
  });
  writeRepoFile(root, 'input.txt', 'mutated\n');
  const inputDrift = verifyReadinessStatusSnapshot(inputSnapshot);
  assert.equal(inputDrift.status, 'blocked');
  assert.ok(inputDrift.errors.some((error) => error.includes('input.txt working bytes changed')));

  writeRepoFile(root, 'input.txt', 'input\n');
  const statusSnapshot = captureReadinessStatusSnapshot({
    root,
    inputPaths: ['input.txt'],
    outputPaths,
  });
  writeRepoFile(root, 'untracked.txt', 'status drift\n');
  const statusDrift = verifyReadinessStatusSnapshot(statusSnapshot);
  assert.equal(statusDrift.status, 'blocked');
  assert.ok(statusDrift.errors.some((error) => error.includes('NUL-delimited Git status changed')));

  rmSync(join(root, 'untracked.txt'));
  const headSnapshot = captureReadinessStatusSnapshot({
    root,
    inputPaths: ['input.txt'],
    outputPaths,
  });
  writeRepoFile(root, 'head.txt', 'new head\n');
  commitPaths(root, ['head.txt'], 'move HEAD');
  const headDrift = verifyReadinessStatusSnapshot(headSnapshot);
  assert.equal(headDrift.status, 'blocked');
  assert.ok(headDrift.errors.some((error) => error.includes('Git HEAD changed')));
});

test('atomic readiness publication deletes both outputs when an input changes', (t) => {
  const root = createFixtureRepo(t);
  const jsonPath = 'out/readiness.json';
  const mdPath = 'out/readiness.md';
  const snapshot = captureReadinessStatusSnapshot({
    root,
    inputPaths: ['input.txt'],
    outputPaths: [jsonPath, mdPath],
  });
  assert.throws(() =>
    atomicWriteReadinessStatusOutputs({
      root,
      snapshot,
      jsonPath,
      mdPath,
      jsonContent: '{}\n',
      mdContent: '# Readiness\n',
      onPhase: (phase) => {
        if (phase === 'after-write') writeRepoFile(root, 'input.txt', 'changed\n');
      },
    }),
  );
  assert.equal(existsSync(join(root, ...jsonPath.split('/'))), false);
  assert.equal(existsSync(join(root, ...mdPath.split('/'))), false);

  writeRepoFile(root, 'input.txt', 'input\n');
  const stable = captureReadinessStatusSnapshot({
    root,
    inputPaths: ['input.txt'],
    outputPaths: [jsonPath, mdPath],
  });
  atomicWriteReadinessStatusOutputs({
    root,
    snapshot: stable,
    jsonPath,
    mdPath,
    jsonContent: '{}\n',
    mdContent: '# Readiness\n',
  });
  assert.equal(readFileSync(join(root, ...jsonPath.split('/')), 'utf8'), '{}\n');
  assert.equal(readFileSync(join(root, ...mdPath.split('/')), 'utf8'), '# Readiness\n');
});

test('atomic readiness publication rejects same-byte governed evidence replacement', (t) => {
  const value = createProvenanceFixture(t);
  const jsonPath = 'out/readiness.json';
  const mdPath = 'out/readiness.md';
  const snapshot = captureReadinessStatusSnapshot({
    root: value.root,
    inputPaths: ['input.txt'],
    outputPaths: [jsonPath, mdPath],
  });
  const bindings = captureGovernedEvidenceWorkingBindings(value.evidenceAudit, value.root);
  const displaced = mkdtempSync(join(tmpdir(), 'onskin-readiness-displaced-evidence-'));
  t.after(() => rmSync(displaced, { recursive: true, force: true }));

  atomicWriteReadinessStatusOutputs({
    root: value.root,
    snapshot,
    jsonPath,
    mdPath,
    jsonContent: '{"stable":true}\n',
    mdContent: '# Stable readiness\n',
    verifyAdditional: () =>
      verifyGovernedEvidenceWorkingBindings(bindings, value.root, {
        context: 'readiness audit publication',
      }),
  });
  assert.equal(readFileSync(join(value.root, ...jsonPath.split('/')), 'utf8'), '{"stable":true}\n');

  assert.throws(() =>
    atomicWriteReadinessStatusOutputs({
      root: value.root,
      snapshot,
      jsonPath,
      mdPath,
      jsonContent: '{}\n',
      mdContent: '# Readiness\n',
      verifyAdditional: () =>
        verifyGovernedEvidenceWorkingBindings(bindings, value.root, {
          context: 'readiness audit publication',
        }),
      onPhase: (phase) => {
        if (phase !== 'after-write') return;
        renameSync(
          join(value.root, ...GOVERNED_MANIFEST.split('/')),
          join(displaced, 'manifest.md'),
        );
        writeRepoFile(value.root, GOVERNED_MANIFEST, '# Governed RC manifest\n');
      },
    }),
  );
  assert.equal(existsSync(join(value.root, ...jsonPath.split('/'))), false);
  assert.equal(existsSync(join(value.root, ...mdPath.split('/'))), false);
});

test('atomic readiness publication deletes both outputs on status or HEAD drift', async (t) => {
  for (const driftKind of ['status', 'HEAD']) {
    await t.test(driftKind, (child) => {
      const root = createFixtureRepo(child);
      const jsonPath = 'out/readiness.json';
      const mdPath = 'out/readiness.md';
      const snapshot = captureReadinessStatusSnapshot({
        root,
        inputPaths: ['input.txt'],
        outputPaths: [jsonPath, mdPath],
      });
      assert.throws(() =>
        atomicWriteReadinessStatusOutputs({
          root,
          snapshot,
          jsonPath,
          mdPath,
          jsonContent: '{}\n',
          mdContent: '# Readiness\n',
          onPhase: (phase) => {
            if (phase !== 'after-write') return;
            const driftPath = driftKind === 'status' ? 'untracked.txt' : 'head.txt';
            writeRepoFile(root, driftPath, `${driftKind} drift\n`);
            if (driftKind === 'HEAD') commitPaths(root, [driftPath], 'move HEAD during publish');
          },
        }),
      );
      assert.equal(existsSync(join(root, ...jsonPath.split('/'))), false);
      assert.equal(existsSync(join(root, ...mdPath.split('/'))), false);
    });
  }
});

test('atomic readiness publication never follows a linked output parent', (t) => {
  const root = createFixtureRepo(t);
  const outside = mkdtempSync(join(tmpdir(), 'onskin-readiness-output-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const linkedParent = join(root, 'linked-output');
  try {
    symlinkSync(outside, linkedParent, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) {
      t.diagnostic(`output link creation unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  const jsonPath = 'linked-output/readiness.json';
  const mdPath = 'linked-output/readiness.md';
  const snapshot = captureReadinessStatusSnapshot({
    root,
    inputPaths: ['input.txt'],
    outputPaths: [jsonPath, mdPath],
  });
  assert.throws(() =>
    atomicWriteReadinessStatusOutputs({
      root,
      snapshot,
      jsonPath,
      mdPath,
      jsonContent: '{}\n',
      mdContent: '# Readiness\n',
    }),
  );
  assert.equal(existsSync(join(outside, 'readiness.json')), false);
  assert.equal(existsSync(join(outside, 'readiness.md')), false);
});
