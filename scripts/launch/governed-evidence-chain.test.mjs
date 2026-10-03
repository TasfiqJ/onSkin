import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import {
  cpSync,
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
  GOVERNED_DOWNSTREAM_GENERATED_PATHS,
  GOVERNED_DOWNSTREAM_PUBLICATION_UNITS,
  GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID,
  GOVERNED_LAUNCH_CONTRACT_PATH,
  GOVERNED_POST_E_PUBLICATION_DAG_EDGES,
  GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS,
  GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS,
  auditGovernedEvidenceChain,
  buildGovernedEvidenceLedger,
  buildGovernedPublicationPolicyTemplate,
  captureGovernedPublicationPolicy,
  captureGovernedEvidenceWorkingBindings,
  parseGovernedEvidenceLedger,
  renderGovernedEvidenceLedger,
  validateGovernedEvidenceChainBinding,
  validateGovernedGeneratedPublication,
  validateGovernedPublicationCompletion,
  verifyGovernedEvidenceWorkingBindings,
} from './governed-evidence-chain.mjs';

const RC_DIR = 'docs/phase-9/release-candidates/rc-2026-07-22-b001';
const LEDGER = `${RC_DIR}/evidence-chain.json`;
const MANIFEST = `${RC_DIR}/manifest.md`;
const GENERATED = 'docs/phase-9/generated/dependency-inventory.json';
const GENERATED_MD = 'docs/phase-9/generated/dependency-inventory.md';
const OTHER_GENERATED = 'docs/phase-9/generated/release-engineering-qa-packet.json';
const LATER_GENERATED = 'docs/phase-9/generated/live-catalog-rate-limit.json';
const LATER_GENERATED_MD = 'docs/phase-9/generated/live-catalog-rate-limit.md';
const PHASE10 = 'docs/phase-10/generated/closed-beta-packet.json';
const PHASE10_MD = 'docs/phase-10/generated/closed-beta-packet.md';
const PHASE11 = 'docs/phase-11/generated/public-launch-packet.json';
const PHASE11_MD = 'docs/phase-11/generated/public-launch-packet.md';
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
const PUBLICATION_UNIT_BY_ID = new Map(
  GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.map((unit) => [unit.id, unit]),
);

function git(root, args, { input = undefined } = {}) {
  return execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
    input,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function gitNulPaths(root, args) {
  const output = execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (output.length === 0) return [];
  assert.equal(output.at(-1), 0, 'Git path inventory must be NUL terminated');
  return output.subarray(0, -1).toString('utf8').split('\0');
}

function write(root, path, value) {
  const absolute = join(root, ...path.split('/'));
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
}

function writePair(root, jsonPath, markdownPath, value = '{"generated":true}\n') {
  write(root, jsonPath, value);
  write(root, markdownPath, '# Generated\n');
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function commit(root, message) {
  git(root, ['add', '--all']);
  git(root, ['-c', 'commit.gpgsign=false', 'commit', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function writePublicationUnit(root, unitId, marker = 'generated') {
  const unit = PUBLICATION_UNIT_BY_ID.get(unitId);
  if (!unit) throw new Error(`unknown test publication unit: ${unitId}`);
  for (const repoPath of unit.paths) {
    write(
      root,
      repoPath,
      repoPath.endsWith('.json')
        ? `${JSON.stringify({ marker, unitId })}\n`
        : `# ${marker}: ${unitId}\n`,
    );
  }
  return unit;
}

function publishUnit(value, unitId, marker = 'generated') {
  const unit = writePublicationUnit(value.root, unitId, marker);
  return {
    commitSha: commit(value.root, `${marker} ${unitId}`),
    unit,
  };
}

function publishRequiredTail(value, unitIds = REQUIRED_POST_E_ORDER) {
  const commits = new Map();
  for (const unitId of unitIds) {
    commits.set(unitId, publishUnit(value, unitId).commitSha);
  }
  return commits;
}

function createRepository(t) {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-evidence-chain-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.email', 'evidence-chain@example.invalid']);
  git(root, ['config', 'user.name', 'Evidence Chain Test']);
  write(root, '.gitattributes', '* text=auto eol=lf\n');
  write(root, 'source.txt', 'immutable source\n');
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
  return { root, sourceGitSha };
}

function fixture(
  t,
  {
    extraEvidencePath = null,
    hashOverride = null,
    manifestBytes = Buffer.from('# Release candidate\n'),
    publicationPolicyOverride = null,
    renameSourceIntoRc = false,
    symlinkMode = false,
  } = {},
) {
  const value = createRepository(t);
  const entries = [];
  if (renameSourceIntoRc) {
    const renamed = `${RC_DIR}/renamed-source.txt`;
    const destination = join(value.root, ...renamed.split('/'));
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(join(value.root, 'source.txt'), destination);
    entries.push({
      role: 'release-candidate',
      path: renamed,
      sha256: digest('immutable source\n'),
    });
  } else {
    write(value.root, MANIFEST, manifestBytes);
    entries.push({
      role: 'release-candidate',
      path: MANIFEST,
      sha256: hashOverride ?? digest(manifestBytes),
    });
  }
  if (extraEvidencePath) write(value.root, extraEvidencePath, 'outside governed roots\n');
  const capturedPublicationPolicy = captureGovernedPublicationPolicy(
    value.root,
    value.sourceGitSha,
  );
  const publicationPolicy =
    typeof publicationPolicyOverride === 'function'
      ? publicationPolicyOverride(capturedPublicationPolicy)
      : (publicationPolicyOverride ?? capturedPublicationPolicy);
  const ledger = renderGovernedEvidenceLedger({
    sourceGitSha: value.sourceGitSha,
    releaseCandidateDir: RC_DIR,
    publicationPolicy,
    entries,
  });
  write(value.root, LEDGER, ledger);
  if (symlinkMode) {
    // Keep the regular working file byte-identical to the staged link target.
    // Otherwise Linux Git reports a dirty worktree before the tree-mode gate.
    git(value.root, ['config', 'core.symlinks', 'false']);
    git(value.root, ['add', '--all']);
    const objectId = git(value.root, ['hash-object', '-w', '--stdin'], { input: manifestBytes });
    git(value.root, ['update-index', '--cacheinfo', `120000,${objectId},${MANIFEST}`]);
    git(value.root, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'evidence']);
    value.evidenceCommitSha = git(value.root, ['rev-parse', 'HEAD']);
  } else {
    value.evidenceCommitSha = commit(value.root, 'evidence');
  }
  return value;
}

function audit(value, options = {}) {
  return auditGovernedEvidenceChain({
    root: value.root,
    sourceGitSha: value.sourceGitSha,
    releaseCandidateDir: RC_DIR,
    ...options,
  });
}

test('canonical ledger builder/parser sorts and freezes exact evidence bindings', () => {
  const sourceGitSha = 'a'.repeat(40);
  const ledger = buildGovernedEvidenceLedger({
    sourceGitSha,
    releaseCandidateDir: RC_DIR,
    publicationPolicy: buildGovernedPublicationPolicyTemplate(),
    entries: [
      { role: 'human-e2e', path: 'test-results/human-e2e/z.txt', sha256: 'b'.repeat(64) },
      { role: 'release-candidate', path: MANIFEST, sha256: 'c'.repeat(64) },
    ],
  });
  const bytes = renderGovernedEvidenceLedger(ledger);
  const parsed = parseGovernedEvidenceLedger(bytes, {
    expectedReleaseCandidateDir: RC_DIR,
    expectedSourceGitSha: sourceGitSha,
  });
  assert.deepEqual(parsed, ledger);
  assert.equal(parsed.entries[0].path, MANIFEST);
  assert.throws(() => parsed.entries.push({}), TypeError);
  assert.throws(
    () => parseGovernedEvidenceLedger(Buffer.from(bytes.toString('utf8').replace('\n', '\r\n'))),
    /canonical JSON/u,
  );
});

test('central downstream inventory exactly covers every tracked docs generated output', () => {
  const trackedGeneratedPaths = gitNulPaths(REPOSITORY_ROOT, ['ls-files', '-z', '--', 'docs'])
    .filter((repoPath) => repoPath.startsWith('docs/') && repoPath.includes('/generated/'))
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const governedGeneratedPaths = [...GOVERNED_DOWNSTREAM_GENERATED_PATHS].sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)),
  );
  assert.deepEqual(governedGeneratedPaths, trackedGeneratedPaths);
  const flattenedPublicationPaths = GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.flatMap(
    ({ paths }) => paths,
  ).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  assert.deepEqual(flattenedPublicationPaths, trackedGeneratedPaths);
  assert.equal(
    GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.filter(({ kind }) => kind === 'json_markdown_pair')
      .length,
    32,
  );
  assert.equal(
    GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.filter(({ kind }) => kind === 'json_singleton').length,
    3,
  );
  assert.equal(GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS.length, 12);
  assert.equal(GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.length, 22);
  const lifecyclePartition = [
    ...GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS,
    ...GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS,
    GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID,
  ].sort();
  assert.deepEqual(
    lifecyclePartition,
    governedGeneratedPaths
      .filter((path) => path.endsWith('.json'))
      .map((path) => path.slice(0, -'.json'.length))
      .sort(),
  );
  assert.equal(new Set(lifecyclePartition).size, 35);
  assert.equal(
    new Set(
      GOVERNED_POST_E_PUBLICATION_DAG_EDGES.map(
        ({ before, after, kind }) => `${before}\0${after}\0${kind}`,
      ),
    ).size,
    GOVERNED_POST_E_PUBLICATION_DAG_EDGES.length,
  );
  assert.equal(
    GOVERNED_POST_E_PUBLICATION_DAG_EDGES.every(
      ({ before, after }) =>
        GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.includes(before) &&
        GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.includes(after) &&
        before !== after,
    ),
    true,
  );
});

test('rejects unsafe, colliding, wrongly classified, and duplicate-key ledger input', () => {
  const common = {
    sourceGitSha: 'a'.repeat(40),
    releaseCandidateDir: RC_DIR,
    publicationPolicy: buildGovernedPublicationPolicyTemplate(),
  };
  assert.throws(
    () =>
      buildGovernedEvidenceLedger({
        sourceGitSha: common.sourceGitSha,
        releaseCandidateDir: RC_DIR,
        entries: [{ role: 'release-candidate', path: MANIFEST, sha256: 'b'.repeat(64) }],
      }),
    /publication policy/u,
  );
  assert.throws(
    () =>
      buildGovernedEvidenceLedger({
        ...common,
        entries: [
          { role: 'release-candidate', path: `${RC_DIR}/A.md`, sha256: 'b'.repeat(64) },
          { role: 'release-candidate', path: `${RC_DIR}/a.md`, sha256: 'c'.repeat(64) },
        ],
      }),
    /colliding paths/u,
  );
  assert.throws(
    () =>
      buildGovernedEvidenceLedger({
        ...common,
        entries: [{ role: 'release-candidate', path: 'scripts/app.mjs', sha256: 'b'.repeat(64) }],
      }),
    /outside its governed/u,
  );
  assert.throws(
    () =>
      buildGovernedEvidenceLedger({
        ...common,
        entries: [
          { role: 'release-candidate', path: `${RC_DIR}/../escape.md`, sha256: 'b'.repeat(64) },
        ],
      }),
    /unsafe|canonical/u,
  );
  const valid = renderGovernedEvidenceLedger({
    ...common,
    entries: [{ role: 'release-candidate', path: MANIFEST, sha256: 'b'.repeat(64) }],
  }).toString('utf8');
  const duplicate = valid.replace(
    '"sourceGitSha":',
    `"sourceGitSha":"${'a'.repeat(40)}","sourceGitSha":`,
  );
  assert.throws(() => parseGovernedEvidenceLedger(Buffer.from(duplicate)), /canonical JSON/u);
});

test('accepts S -> E and a strictly linear exact-allowlist generated tail', (t) => {
  const value = fixture(t);
  let result = audit(value);
  assert.equal(result.status, 'pass');
  assert.equal(result.evidenceCommitSha, value.evidenceCommitSha);
  assert.equal(result.directEvidenceCommit, true);
  assert.equal(result.evidenceOnlyCommit, true);
  assert.equal(result.hashesValid, true);
  assert.equal(result.downstreamCommits.length, 0);

  writePair(value.root, GENERATED, GENERATED_MD);
  const generatedCommit = commit(value.root, 'generated packet');
  result = audit(value);
  assert.equal(result.status, 'pass');
  assert.equal(result.headGitSha, generatedCommit);
  assert.deepEqual(result.downstreamCommits[0].changedPaths, [GENERATED, GENERATED_MD]);
  assert.equal(GOVERNED_DOWNSTREAM_GENERATED_PATHS.includes(GENERATED), true);
});

test('validates an upstream packet at an exact R prefix when the fresh audit is at F', (t) => {
  const value = fixture(t);
  const publicationCommits = publishRequiredTail(value);
  const releasePacketGitSha = publicationCommits.get(
    'docs/generated/generated-packet-status-audit',
  );
  const releaseAudit = audit(value);
  assert.equal(releaseAudit.status, 'pass');
  assert.equal(validateGovernedPublicationCompletion(releaseAudit, { stage: 'R' }).status, 'pass');
  const launchSnapshot = releaseAudit.ledger.publicationPolicy.launchContract.snapshot;
  for (const snapshot of [
    { ...launchSnapshot, releaseMode: 'all-features' },
    { ...launchSnapshot, requiredFeatureIds: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11] },
  ]) {
    const forgedAudit = {
      ...releaseAudit,
      ledger: {
        ...releaseAudit.ledger,
        publicationPolicy: {
          ...releaseAudit.ledger.publicationPolicy,
          launchContract: {
            ...releaseAudit.ledger.publicationPolicy.launchContract,
            snapshot,
          },
        },
      },
    };
    const validation = validateGovernedPublicationCompletion(forgedAudit, { stage: 'R' });
    assert.equal(validation.status, 'blocked');
    assert.deepEqual(validation.errors, ['pinned S launch contract is not the active iOS lean V1 policy']);
  }
  publishUnit(value, GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID, 'readiness F');
  const result = audit(value);
  assert.equal(result.status, 'pass');
  assert.equal(validateGovernedPublicationCompletion(result, { stage: 'F' }).status, 'pass');
  const binding = {
    status: 'pass',
    sourceGitSha: value.sourceGitSha,
    evidenceCommitSha: value.evidenceCommitSha,
    currentGitSha: releasePacketGitSha,
    releaseCandidateDir: RC_DIR,
    ledgerPath: LEDGER,
    ledgerSha256: digest(renderGovernedEvidenceLedger(result.ledger)),
    ledgerEntryCount: result.ledger.entries.length,
    downstreamCommitCount: GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.length,
  };
  assert.equal(validateGovernedEvidenceChainBinding(binding, result).status, 'pass');

  for (const [name, forged, pattern] of [
    ['blocked role', { ...binding, status: 'blocked' }, /status is not pass/u],
    ['foreign S', { ...binding, sourceGitSha: 'f'.repeat(40) }, /sourceGitSha/u],
    [
      'foreign RC',
      { ...binding, releaseCandidateDir: 'docs/phase-9/release-candidates/rc-foreign' },
      /releaseCandidateDir/u,
    ],
    ['forged current', { ...binding, currentGitSha: 'e'.repeat(40) }, /currentGitSha/u],
    ['forged prefix count', { ...binding, downstreamCommitCount: 2 }, /prefix position/u],
    ['forged ledger', { ...binding, ledgerSha256: '0'.repeat(64) }, /ledgerSha256/u],
    [
      'legacy evidence alias',
      { ...binding, evidenceGitSha: value.evidenceCommitSha },
      /legacy governed evidenceGitSha/u,
    ],
  ]) {
    const validation = validateGovernedEvidenceChainBinding(forged, result);
    assert.equal(validation.status, 'blocked', name);
    assert.match(validation.errors.join('\n'), pattern, name);
  }
});

test('rejects adversarial lifecycle omissions, reversals, source edits, and forged S policy', async (t) => {
  await t.test('one missing middle publication blocks the attempted R chain', (child) => {
    const value = fixture(child);
    const missingUnitId = 'docs/phase-9/generated/dependency-inventory';
    publishRequiredTail(
      value,
      REQUIRED_POST_E_ORDER.filter((unitId) => unitId !== missingUnitId),
    );
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(
      result.errors.join('\n'),
      /release-engineering-qa-packet before required DAG predecessors: .*dependency-inventory/u,
    );
    assert.equal(validateGovernedPublicationCompletion(result, { stage: 'R' }).status, 'blocked');
  });

  for (const { name, before, after, prerequisites } of [
    {
      name: 'Phase 7 before Phase 6',
      before: 'docs/phase-6/generated/payments-qa-packet',
      after: 'docs/phase-7/generated/core-loop-qa-packet',
      prerequisites: [
        'docs/e2e/generated/human-e2e-manifest',
        'docs/phase-4/generated/beta-coverage-report',
        'docs/phase-5/generated/device-qa-packet',
      ],
    },
    {
      name: 'Phase 8 before Phase 7',
      before: 'docs/phase-7/generated/core-loop-qa-packet',
      after: 'docs/phase-8/generated/growth-store-qa-packet',
      prerequisites: [
        'docs/e2e/generated/human-e2e-manifest',
        'docs/phase-4/generated/beta-coverage-report',
        'docs/phase-5/generated/device-qa-packet',
        'docs/phase-6/generated/payments-qa-packet',
      ],
    },
  ]) {
    await t.test(`reversed predecessor/consumer: ${name}`, (child) => {
      const value = fixture(child);
      for (const unitId of prerequisites) publishUnit(value, unitId);
      publishUnit(value, after, 'reversed consumer');
      publishUnit(value, before, 'late predecessor');
      const result = audit(value);
      assert.equal(result.status, 'invalid');
      assert.match(
        result.errors.join('\n'),
        new RegExp(`${after} before required DAG predecessors`),
      );
      assert.match(result.errors.join('\n'), new RegExp(before));
    });
  }

  await t.test('post-E edit of one S-bound source-snapshot unit', (child) => {
    const value = fixture(child);
    publishUnit(value, 'docs/generated/source-packet-audit', 'post-E source mutation');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(
      result.errors.join('\n'),
      /changes source-snapshot unit docs\/generated\/source-packet-audit after S/u,
    );
  });

  await t.test('generated status cannot precede the last required R unit', (child) => {
    const value = fixture(child);
    const statusUnitId = 'docs/generated/generated-packet-status-audit';
    const lateUnitId = 'docs/phase-11/generated/public-launch-packet';
    publishRequiredTail(
      value,
      REQUIRED_POST_E_ORDER.filter((unitId) => ![statusUnitId, lateUnitId].includes(unitId)),
    );
    publishUnit(value, statusUnitId, 'premature generated status');
    publishUnit(value, lateUnitId, 'late R packet');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(
      result.errors.join('\n'),
      /generated-packet-status-audit before required DAG predecessors: .*public-launch-packet/u,
    );
  });

  await t.test('placeholder S publicationPolicy cannot authenticate real source bytes', (child) => {
    const value = fixture(child, {
      publicationPolicyOverride: buildGovernedPublicationPolicyTemplate(),
    });
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(
      result.errors.join('\n'),
      /publication policy does not match the pinned S launch contract and source snapshots/u,
    );
  });

  await t.test('forged S source digest cannot authenticate real source bytes', (child) => {
    const value = fixture(child, {
      publicationPolicyOverride(captured) {
        const forged = structuredClone(captured);
        forged.sourceSnapshotUnits[0].files[0].sha256 = '0'.repeat(64);
        return forged;
      },
    });
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(
      result.errors.join('\n'),
      /publication policy does not match the pinned S launch contract and source snapshots/u,
    );
  });
});

function generatedPublicationBinding(value, result) {
  return {
    status: 'pass',
    sourceGitSha: value.sourceGitSha,
    evidenceCommitSha: value.evidenceCommitSha,
    currentGitSha: value.evidenceCommitSha,
    releaseCandidateDir: RC_DIR,
    ledgerPath: LEDGER,
    ledgerSha256: digest(renderGovernedEvidenceLedger(result.ledger)),
    ledgerEntryCount: result.ledger.entries.length,
    downstreamCommitCount: 0,
  };
}

test('binds a generated JSON/Markdown pair to its unique publication commit', (t) => {
  const value = fixture(t);
  write(value.root, GENERATED, '{"generated":true}\n');
  write(value.root, GENERATED_MD, '# Generated\n');
  const publicationCommitSha = commit(value.root, 'publish generated pair');
  writePair(value.root, LATER_GENERATED, LATER_GENERATED_MD, '{"later":true}\n');
  commit(value.root, 'later generated output');
  const result = audit(value);
  assert.equal(result.status, 'pass');
  const binding = generatedPublicationBinding(value, result);
  const validation = validateGovernedGeneratedPublication(binding, result, [
    GENERATED_MD,
    GENERATED,
  ]);
  assert.equal(validation.status, 'pass');
  assert.equal(validation.publicationCommitSha, publicationCommitSha);
  assert.deepEqual(validation.outputPaths, [GENERATED, GENERATED_MD]);

  const wrongParentAudit = {
    ...result,
    downstreamCommits: result.downstreamCommits.map((entry, index) =>
      index === 0 ? { ...entry, parentSha: 'f'.repeat(40) } : entry,
    ),
  };
  assert.match(
    validateGovernedGeneratedPublication(binding, wrongParentAudit, [
      GENERATED,
      GENERATED_MD,
    ]).errors.join('\n'),
    /direct child/u,
  );
});

test('retained governed evidence bindings reject same-byte identity replacement', (t) => {
  const value = fixture(t);
  writePair(value.root, GENERATED, GENERATED_MD);
  commit(value.root, 'generated tail');
  const result = audit(value);
  assert.equal(result.status, 'pass');
  const bindings = captureGovernedEvidenceWorkingBindings(result, value.root);
  assert.deepEqual(verifyGovernedEvidenceWorkingBindings(bindings, value.root), []);

  const displaced = mkdtempSync(join(tmpdir(), 'layerwell-governed-binding-displaced-'));
  t.after(() => rmSync(displaced, { force: true, recursive: true }));
  renameSync(join(value.root, ...GENERATED.split('/')), join(displaced, 'generated.json'));
  write(value.root, GENERATED, '{"generated":true}\n');
  assert.match(
    verifyGovernedEvidenceWorkingBindings(bindings, value.root).join('\n'),
    /dependency-inventory\.json changed/u,
  );
  renameSync(join(value.root, ...MANIFEST.split('/')), join(displaced, 'manifest.md'));
  write(value.root, MANIFEST, '# Release candidate\n');
  assert.match(
    verifyGovernedEvidenceWorkingBindings(bindings, value.root).join('\n'),
    /changed during governed evidence publication/u,
  );
});

test('rejects split, widened, repeated, and missing governed publication units', async (t) => {
  await t.test('split pair', (child) => {
    const value = fixture(child);
    write(value.root, GENERATED, '{"generated":true}\n');
    commit(value.root, 'publish JSON alone');
    write(value.root, GENERATED_MD, '# Generated\n');
    commit(value.root, 'publish Markdown alone');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /publish exactly one governed JSON\/Markdown pair/u);
  });

  await t.test('extra path in publication commit', (child) => {
    const value = fixture(child);
    write(value.root, GENERATED, '{"generated":true}\n');
    write(value.root, GENERATED_MD, '# Generated\n');
    write(value.root, OTHER_GENERATED, '{"extra":true}\n');
    commit(value.root, 'publish widened packet');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /publish exactly one governed JSON\/Markdown pair/u);
  });

  await t.test('later exact-pair edit', (child) => {
    const value = fixture(child);
    writePair(value.root, GENERATED, GENERATED_MD);
    commit(value.root, 'publish pair');
    writePair(value.root, GENERATED, GENERATED_MD, '{"generated":"edited"}\n');
    write(value.root, GENERATED_MD, '# Hand edited\n');
    commit(value.root, 'edit published pair');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /after its publication/u);
  });

  await t.test('Phase 10 hand-edited JSON without its Markdown pair', (child) => {
    const value = fixture(child);
    write(value.root, PHASE10, '{"handEdited":true}\n');
    commit(value.root, 'hand edit Phase 10 JSON');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /publish exactly one governed JSON\/Markdown pair/u);
  });

  await t.test('Phase 10 pair cannot publish before its governed inputs', (child) => {
    const value = fixture(child);
    writePair(value.root, PHASE10, PHASE10_MD);
    commit(value.root, 'publish Phase 10 pair');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /before required DAG predecessors/u);
  });

  await t.test('Phase 10 and Phase 11 pairs cannot be co-committed', (child) => {
    const value = fixture(child);
    writePair(value.root, PHASE10, PHASE10_MD);
    writePair(value.root, PHASE11, PHASE11_MD);
    commit(value.root, 'co-commit Phase 10 and Phase 11');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /publish exactly one governed JSON\/Markdown pair/u);
  });

  await t.test('Phase 11 pair cannot publish before its governed inputs', (child) => {
    const value = fixture(child);
    writePair(value.root, PHASE11, PHASE11_MD);
    commit(value.root, 'publish Phase 11 pair');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /before required DAG predecessors/u);
  });

  await t.test('no child publication', (child) => {
    const value = fixture(child);
    const result = audit(value);
    assert.match(
      validateGovernedGeneratedPublication(generatedPublicationBinding(value, result), result, [
        GENERATED,
        GENERATED_MD,
      ]).errors.join('\n'),
      /no downstream publication/u,
    );
  });
});

test('rejects S -> E path/hash/mode violations and evidence mutation after E', async (t) => {
  await t.test('extra source-like path in E', (child) => {
    const result = audit(fixture(child, { extraEvidencePath: 'scripts/unbound.mjs' }));
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /do not exactly equal/u);
  });
  await t.test('outside path renamed into governed RC', (child) => {
    const result = audit(fixture(child, { renameSourceIntoRc: true }));
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /do not exactly equal/u);
  });
  await t.test('ledger digest mismatch', (child) => {
    const result = audit(fixture(child, { hashOverride: 'f'.repeat(64) }));
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /SHA-256/u);
  });
  await t.test('non-regular evidence tree mode', (child) => {
    const result = audit(fixture(child, { symlinkMode: true }));
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /100644 Git blob/u);
  });
  await t.test('raw evidence changed in a later commit', (child) => {
    const value = fixture(child);
    write(value.root, MANIFEST, '# Mutated later\n');
    commit(value.root, 'mutate evidence');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /changed after the evidence commit|non-allowlisted/u);
  });
  await t.test('non-allowlisted generated tail', (child) => {
    const value = fixture(child);
    write(value.root, 'docs/generated/near-miss.json', '{}\n');
    commit(value.root, 'near miss');
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /non-allowlisted/u);
  });
});

test('rejects merge topology while ignoring Git replace refs', async (t) => {
  await t.test('merge commit', (child) => {
    const value = fixture(child);
    git(value.root, ['switch', '-c', 'side']);
    writePair(
      value.root,
      'docs/generated/source-packet-audit.json',
      'docs/generated/source-packet-audit.md',
      '{"side":true}\n',
    );
    commit(value.root, 'side generated');
    git(value.root, ['switch', 'main']);
    writePair(value.root, GENERATED, GENERATED_MD, '{"main":true}\n');
    commit(value.root, 'main generated');
    git(value.root, ['-c', 'commit.gpgsign=false', 'merge', '--no-ff', 'side', '-m', 'merge']);
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /strictly linear, non-merge/u);
  });
  await t.test('replace ref is ignored', (child) => {
    const value = fixture(child);
    git(value.root, ['replace', value.sourceGitSha, value.evidenceCommitSha]);
    assert.equal(audit(value).status, 'pass');
  });
});

test('rejects bounded-size, hardlink, dirty/index, and mid-audit race violations', async (t) => {
  await t.test('entry byte ceiling', (child) => {
    const value = fixture(child, { manifestBytes: Buffer.from('0123456789abcdef') });
    const result = audit(value, { maxAggregateBytes: 1024, maxEntryBytes: 8 });
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /byte ceiling/u);
  });
  await t.test('hardlinked evidence file', (child) => {
    const value = fixture(child);
    const linkDirectory = mkdtempSync(join(tmpdir(), 'layerwell-evidence-hardlink-'));
    child.after(() => rmSync(linkDirectory, { force: true, recursive: true }));
    linkSync(join(value.root, ...MANIFEST.split('/')), join(linkDirectory, 'alias'));
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /stable, single-link/u);
  });
  await t.test('oversized allowlisted generated blob', (child) => {
    const value = fixture(child);
    writePair(value.root, GENERATED, GENERATED_MD, `${'x'.repeat(2048)}\n`);
    commit(value.root, 'oversized generated packet');
    const result = audit(value, { maxAggregateBytes: 4096, maxEntryBytes: 1024 });
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /byte ceiling|ENOBUFS/u);
  });
  await t.test('cumulative downstream generated byte ceiling', (child) => {
    const value = fixture(child);
    writePair(value.root, GENERATED, GENERATED_MD, `${'a'.repeat(29_999)}\n`);
    commit(value.root, 'generated packet one');
    writePair(value.root, LATER_GENERATED, LATER_GENERATED_MD, `${'b'.repeat(29_999)}\n`);
    commit(value.root, 'generated packet two');
    const result = audit(value, { maxAggregateBytes: 50_000, maxEntryBytes: 32_000 });
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /downstream generated blobs exceed/u);
  });
  await t.test('hardlinked generated working file', (child) => {
    const value = fixture(child);
    writePair(value.root, GENERATED, GENERATED_MD);
    commit(value.root, 'generated packet');
    const linkDirectory = mkdtempSync(join(tmpdir(), 'layerwell-generated-hardlink-'));
    child.after(() => rmSync(linkDirectory, { force: true, recursive: true }));
    linkSync(join(value.root, ...GENERATED.split('/')), join(linkDirectory, 'alias'));
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /stable, single-link/u);
  });
  await t.test('generated working file mutation race', (child) => {
    const value = fixture(child);
    writePair(value.root, GENERATED, GENERATED_MD);
    commit(value.root, 'generated packet');
    const result = audit(value, {
      onPhase(phase) {
        if (phase === 'before-final-snapshot') write(value.root, GENERATED, '{"raced":true}\n');
      },
    });
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /clean worktree|status changed|drifted/u);
  });
  await t.test('skip-worktree index entry', (child) => {
    const value = fixture(child);
    git(value.root, ['update-index', '--skip-worktree', 'source.txt']);
    const result = audit(value);
    assert.equal(result.status, 'invalid');
    assert.equal(result.normalIndexState, false);
  });
  await t.test('working tree mutation race', (child) => {
    const value = fixture(child);
    const result = audit(value, {
      onPhase(phase) {
        if (phase === 'before-final-snapshot') write(value.root, MANIFEST, '# Raced\n');
      },
    });
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /clean worktree|status changed|drifted/u);
  });
  await t.test('identical repository-root replacement race', (child) => {
    const value = fixture(child);
    const replacement = `${value.root}-replacement`;
    const displaced = `${value.root}-displaced`;
    cpSync(value.root, replacement, { recursive: true });
    child.after(() => rmSync(replacement, { force: true, recursive: true }));
    child.after(() => rmSync(displaced, { force: true, recursive: true }));
    const result = audit(value, {
      onPhase(phase) {
        if (phase === 'after-initial-snapshot') {
          renameSync(value.root, displaced);
          renameSync(replacement, value.root);
        }
      },
    });
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /root identity changed/u);
  });
});

test('ignores inherited repository/config poisoning and rejects malformed arguments', (t) => {
  const value = fixture(t);
  const decoy = createRepository(t);
  const previous = Object.fromEntries(
    [
      'GIT_DIR',
      'GIT_WORK_TREE',
      'GIT_INDEX_FILE',
      'GIT_CONFIG_COUNT',
      'GIT_CONFIG_KEY_0',
      'GIT_CONFIG_VALUE_0',
      'PATH',
    ].map((key) => [key, process.env[key]]),
  );
  process.env.GIT_DIR = join(decoy.root, '.git');
  process.env.GIT_WORK_TREE = decoy.root;
  process.env.GIT_INDEX_FILE = join(decoy.root, '.git', 'index');
  process.env.GIT_CONFIG_COUNT = '1';
  process.env.GIT_CONFIG_KEY_0 = 'diff.external';
  process.env.GIT_CONFIG_VALUE_0 = 'definitely-not-a-command';
  process.env.PATH = join(decoy.root, 'path-without-git');
  try {
    assert.equal(audit(value).status, 'pass');
  } finally {
    for (const [key, prior] of Object.entries(previous)) {
      if (prior === undefined) delete process.env[key];
      else process.env[key] = prior;
    }
  }
  assert.throws(
    () =>
      auditGovernedEvidenceChain({
        root: value.root,
        sourceGitSha: 'main',
        releaseCandidateDir: RC_DIR,
      }),
    TypeError,
  );
  assert.throws(
    () =>
      auditGovernedEvidenceChain({
        root: value.root,
        sourceGitSha: value.sourceGitSha,
        releaseCandidateDir: 'docs/phase-9/release-candidates/_template',
      }),
    TypeError,
  );
});
