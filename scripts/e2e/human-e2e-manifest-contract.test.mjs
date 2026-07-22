import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  buildGovernedPublicationPolicyTemplate,
  renderGovernedEvidenceLedger,
} from '../launch/governed-evidence-chain.mjs';
import {
  HUMAN_E2E_REQUIRED_GATE_IDS,
  validateHumanE2eManifestReleaseRole,
} from './human-e2e-manifest-contract.mjs';

const sourceGitSha = 'a'.repeat(40);
const evidenceCommitSha = 'b'.repeat(40);
const releasePacketGitSha = 'c'.repeat(40);
const finalGitSha = 'd'.repeat(40);
const releaseCandidateDir = 'docs/phase-9/release-candidates/rc-2099-01-01-b001';
const ledgerPath = `${releaseCandidateDir}/evidence-chain.json`;
const ledger = {
  schemaVersion: 1,
  kind: 'onskin_governed_evidence_chain',
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
const audit = {
  status: 'pass',
  sourceGitSha,
  evidenceCommitSha,
  headGitSha: finalGitSha,
  releaseCandidateDir,
  ledgerPath,
  ledger,
  downstreamCommits: [{ commitSha: releasePacketGitSha }, { commitSha: finalGitSha }],
};
const ledgerSha256 = createHash('sha256')
  .update(renderGovernedEvidenceLedger(ledger))
  .digest('hex');

function validPacket() {
  return {
    status: 'pass',
    gitSha: releasePacketGitSha,
    blockers: [],
    governedEvidenceChain: {
      status: 'pass',
      sourceGitSha,
      evidenceCommitSha,
      currentGitSha: releasePacketGitSha,
      releaseCandidateDir,
      ledgerPath,
      ledgerSha256,
      ledgerEntryCount: 1,
      downstreamCommitCount: 1,
    },
    gateResults: HUMAN_E2E_REQUIRED_GATE_IDS.map((id) => ({
      id,
      required: true,
      status: 'pass',
      verdict: 'pass',
    })),
  };
}

test('accepts an exact passing human manifest recorded at R and checked at F', () => {
  assert.equal(validateHumanE2eManifestReleaseRole(validPacket(), audit).status, 'pass');
});

test('rejects blocked, reduced, extra, foreign, and forged human manifest roles', () => {
  const cases = [
    { ...validPacket(), status: 'blocked' },
    { ...validPacket(), blockers: ['forged clear'] },
    { ...validPacket(), gateResults: validPacket().gateResults.slice(1) },
    {
      ...validPacket(),
      gateResults: [
        ...validPacket().gateResults,
        { id: 'forged-required-gate', required: true, status: 'pass', verdict: 'pass' },
      ],
    },
    {
      ...validPacket(),
      governedEvidenceChain: {
        ...validPacket().governedEvidenceChain,
        sourceGitSha: 'f'.repeat(40),
      },
    },
    {
      ...validPacket(),
      governedEvidenceChain: {
        ...validPacket().governedEvidenceChain,
        downstreamCommitCount: 2,
      },
    },
    { ...validPacket(), gitSha: finalGitSha },
  ];
  for (const packet of cases) {
    assert.equal(validateHumanE2eManifestReleaseRole(packet, audit).status, 'blocked');
  }
});
