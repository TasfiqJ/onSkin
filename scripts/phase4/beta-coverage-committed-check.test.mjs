import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildGovernedPublicationPolicyTemplate,
  renderGovernedEvidenceLedger,
} from '../launch/governed-evidence-chain.mjs';
import {
  parsePinnedBetaLaunchContract,
  validateCommittedBetaCoverageReplay,
} from './beta-coverage-committed-check.mjs';

const sourceGitSha = 'a'.repeat(40);
const evidenceCommitSha = 'b'.repeat(40);
const recordedPrefixSha = 'c'.repeat(40);
const publicationSha = 'd'.repeat(40);
const finalGitSha = 'f'.repeat(40);
const releaseCandidateDir = 'docs/phase-9/release-candidates/rc-2099-01-01-b001';
const ledgerPath = `${releaseCandidateDir}/evidence-chain.json`;
const outputPaths = [
  'docs/phase-4/generated/beta-coverage-report.json',
  'docs/phase-4/generated/beta-coverage-report.md',
];
const sourceHashPaths = ['source-a.txt'];
const sourceBytes = Buffer.from('source bytes\n', 'utf8');
const aggregateBytes = Buffer.from('{"aggregate":true}\n', 'utf8');
const ledger = {
  schemaVersion: 1,
  kind: 'layerwell_governed_evidence_chain',
  sourceGitSha,
  releaseCandidateDir,
  publicationPolicy: buildGovernedPublicationPolicyTemplate(),
  entries: [
    {
      role: 'release-candidate',
      path: `${releaseCandidateDir}/manifest.md`,
      sha256: 'e'.repeat(64),
    },
  ],
};
const ledgerSha256 = createHash('sha256')
  .update(renderGovernedEvidenceLedger(ledger))
  .digest('hex');

function audit({ publicationPaths = outputPaths, laterPaths = ['other.json'] } = {}) {
  return {
    status: 'pass',
    sourceGitSha,
    evidenceCommitSha,
    headGitSha: finalGitSha,
    releaseCandidateDir,
    ledgerPath,
    ledger,
    downstreamCommits: [
      {
        commitSha: recordedPrefixSha,
        parentSha: evidenceCommitSha,
        changedPaths: ['docs/e2e/generated/human-e2e-manifest.json'],
      },
      {
        commitSha: publicationSha,
        parentSha: recordedPrefixSha,
        changedPaths: publicationPaths,
      },
      { commitSha: finalGitSha, parentSha: publicationSha, changedPaths: laterPaths },
    ],
  };
}

function chain(currentGitSha, downstreamCommitCount) {
  return {
    status: 'pass',
    sourceGitSha,
    evidenceCommitSha,
    currentGitSha,
    releaseCandidateDir,
    ledgerPath,
    ledgerSha256,
    ledgerEntryCount: 1,
    downstreamCommitCount,
    errors: [],
  };
}

function report({
  generatedAt = '2099-01-01T00:00:00.000Z',
  gitSha = recordedPrefixSha,
  governedEvidenceChain = chain(recordedPrefixSha, 1),
} = {}) {
  return {
    generatedAt,
    inputPath: 'docs/phase-4/beta-coverage-input.json',
    gitSha,
    gitStatus: '',
    inputArtifact: {
      path: 'docs/phase-4/beta-coverage-input.json',
      exists: true,
      bytes: aggregateBytes.length,
      sha256: createHash('sha256').update(aggregateBytes).digest('hex'),
    },
    sourceHashes: [
      {
        path: sourceHashPaths[0],
        exists: true,
        bytes: sourceBytes.length,
        sha256: createHash('sha256').update(sourceBytes).digest('hex'),
      },
    ],
    governedEvidenceChain,
    status: 'ready',
    strict: true,
    evidence: {
      realBetaDataClaimed: true,
      dashboardEvidencePresent: true,
      supportDashboardEvidencePresent: true,
      analyticsDashboardEvidencePresent: true,
      sourceExportDigestPresent: true,
      namedSignoffPresent: true,
    },
    codeErrors: [],
    evidenceBlockers: [],
    warnings: [],
  };
}

function markdown(packet) {
  return Buffer.from(
    [
      '# Beta',
      `Generated: ${packet.generatedAt}`,
      `Git SHA: ${packet.gitSha}`,
      `- Current R/F HEAD: ${packet.governedEvidenceChain.currentGitSha}`,
      `- Downstream generated commits: ${packet.governedEvidenceChain.downstreamCommitCount}`,
      '',
    ].join('\n'),
    'utf8',
  );
}

function fixture(overrides = {}) {
  const recordedPacket = overrides.recordedPacket ?? report();
  const freshReport =
    overrides.freshReport ??
    report({
      generatedAt: '2099-01-01T00:00:01.000Z',
      gitSha: finalGitSha,
      governedEvidenceChain: chain(finalGitSha, 3),
    });
  return {
    recordedJsonBytes:
      overrides.recordedJsonBytes ??
      Buffer.from(`${JSON.stringify(recordedPacket, null, 2)}\n`, 'utf8'),
    recordedMarkdownBytes: overrides.recordedMarkdownBytes ?? markdown(recordedPacket),
    freshReport,
    freshMarkdownBytes: overrides.freshMarkdownBytes ?? markdown(freshReport),
    audit: overrides.audit ?? audit(),
    outputPaths,
    sourceHashPaths,
    prefixSourceBytes: overrides.prefixSourceBytes ?? new Map([[sourceHashPaths[0], sourceBytes]]),
    currentHeadSourceBytes:
      overrides.currentHeadSourceBytes ?? new Map([[sourceHashPaths[0], sourceBytes]]),
    mountedInput: overrides.mountedInput ?? {
      path: 'docs/phase-4/beta-coverage-input.json',
      kind: 'file',
      bytes: aggregateBytes,
    },
    initialSnapshotErrors: overrides.initialSnapshotErrors ?? [],
    finalSnapshotErrors: overrides.finalSnapshotErrors ?? [],
    governedBindingErrors: overrides.governedBindingErrors ?? [],
  };
}

test('accepts the canonical committed beta pair at its unique governed publication', () => {
  assert.equal(validateCommittedBetaCoverageReplay(fixture()).status, 'pass');
});

test('rejects a backward governed prefix', () => {
  const recordedPacket = report({
    gitSha: evidenceCommitSha,
    governedEvidenceChain: chain(evidenceCommitSha, 0),
  });
  const result = validateCommittedBetaCoverageReplay(fixture({ recordedPacket }));
  assert.equal(result.status, 'blocked');
  assert.match(result.errors.join('\n'), /publication commit does not change exactly/u);
});

test('rejects JSON-only and widened publication commits', () => {
  const jsonOnly = validateCommittedBetaCoverageReplay(
    fixture({ audit: audit({ publicationPaths: [outputPaths[0]] }) }),
  );
  assert.equal(jsonOnly.status, 'blocked');
  assert.match(jsonOnly.errors.join('\n'), /exactly the output pair/u);
  const widened = validateCommittedBetaCoverageReplay(
    fixture({ audit: audit({ publicationPaths: [...outputPaths, 'extra.json'] }) }),
  );
  assert.equal(widened.status, 'blocked');
  assert.match(widened.errors.join('\n'), /exactly the output pair/u);
});

test('rejects a later edit to either committed beta output', () => {
  const result = validateCommittedBetaCoverageReplay(
    fixture({ audit: audit({ laterPaths: [outputPaths[1]] }) }),
  );
  assert.equal(result.status, 'blocked');
  assert.match(result.errors.join('\n'), /changed after its publication/u);
});

test('rejects noncanonical JSON, whitespace drift, and a dirty generatedAt', () => {
  const invalidTimestampPacket = report({ generatedAt: '2099-01-01T00:00:00Z' });
  const result = validateCommittedBetaCoverageReplay(
    fixture({
      recordedPacket: invalidTimestampPacket,
      recordedJsonBytes: Buffer.from(`${JSON.stringify(invalidTimestampPacket)} \n`, 'utf8'),
    }),
  );
  assert.equal(result.status, 'blocked');
  assert.match(result.errors.join('\n'), /not canonical generated JSON/u);
  assert.match(result.errors.join('\n'), /canonical ISO timestamp/u);
});

test('rejects late mounted-input and source drift', () => {
  const inputDrift = validateCommittedBetaCoverageReplay(
    fixture({
      mountedInput: {
        path: 'docs/phase-4/beta-coverage-input.json',
        kind: 'file',
        bytes: Buffer.from('{"aggregate":false}\n', 'utf8'),
      },
    }),
  );
  assert.equal(inputDrift.status, 'blocked');
  assert.match(inputDrift.errors.join('\n'), /mounted beta aggregate input bytes/u);
  const sourceDrift = validateCommittedBetaCoverageReplay(
    fixture({
      currentHeadSourceBytes: new Map([
        [sourceHashPaths[0], Buffer.from('late source edit\n', 'utf8')],
      ]),
    }),
  );
  assert.equal(sourceDrift.status, 'blocked');
  assert.match(sourceDrift.errors.join('\n'), /changed after the recorded beta replay prefix/u);
});

test('rejects late index and governed working-binding drift', () => {
  const result = validateCommittedBetaCoverageReplay(
    fixture({
      finalSnapshotErrors: ['complete Git index changed during beta check'],
      governedBindingErrors: ['governed ledger changed during beta check'],
    }),
  );
  assert.equal(result.status, 'blocked');
  assert.match(result.errors.join('\n'), /complete Git index changed/u);
  assert.match(result.errors.join('\n'), /governed ledger changed/u);
});

test('pins launch-contract semantics before a swap-use-restore race window', () => {
  const pinnedBytes = readFileSync('docs/hugeToDo/launch-contract.json');
  const transientLiveBytes = Buffer.from(
    pinnedBytes.toString('utf8').replace('lean-v1', 'transient-forged-mode'),
    'utf8',
  );
  assert.notDeepEqual(transientLiveBytes, pinnedBytes);
  const contract = parsePinnedBetaLaunchContract({
    workingKind: 'file',
    workingTreeMatchesHead: true,
    headBytes: pinnedBytes,
    workingBytes: pinnedBytes,
  });
  assert.equal(contract.release.mode, 'lean-v1');
  assert.throws(
    () =>
      parsePinnedBetaLaunchContract({
        workingKind: 'file',
        workingTreeMatchesHead: true,
        headBytes: pinnedBytes,
        workingBytes: transientLiveBytes,
      }),
    /pinned regular HEAD-matching file/u,
  );
});
