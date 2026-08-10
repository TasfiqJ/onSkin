import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  buildGovernedPublicationPolicyTemplate,
  renderGovernedEvidenceLedger,
} from '../launch/governed-evidence-chain.mjs';
import { PHASE5_REQUIRED_QA_EVIDENCE_KEYS } from '../phase5/device-qa-packet-contract.mjs';
import { PHASE7_EVIDENCE_KEYS } from '../phase7/core-loop-qa-packet-contract.mjs';
import {
  validateClaimedBetaUpstreamPacket,
  validatePhase5UpstreamPacket,
  validatePhase7UpstreamPacket,
} from './upstream-packet-contract.mjs';

const sourceGitSha = 'a'.repeat(40);
const evidenceCommitSha = 'b'.repeat(40);
const packetGitSha = 'c'.repeat(40);
const publicationGitSha = 'd'.repeat(40);
const finalGitSha = 'f'.repeat(40);
const releaseCandidateDir = 'docs/phase-9/release-candidates/rc-2099-01-01-b001';
const ledgerPath = `${releaseCandidateDir}/evidence-chain.json`;
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
function auditFor(outputPaths) {
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
        commitSha: packetGitSha,
        parentSha: evidenceCommitSha,
        changedPaths: ['docs/e2e/generated/human-e2e-manifest.json'],
      },
      { commitSha: publicationGitSha, parentSha: packetGitSha, changedPaths: outputPaths },
      {
        commitSha: finalGitSha,
        parentSha: publicationGitSha,
        changedPaths: ['docs/generated/readiness-status-audit.json'],
      },
    ],
  };
}
const phase5Audit = auditFor([
  'docs/phase-5/generated/device-qa-packet.json',
  'docs/phase-5/generated/device-qa-packet.md',
]);
const phase7Audit = auditFor([
  'docs/phase-7/generated/core-loop-qa-packet.json',
  'docs/phase-7/generated/core-loop-qa-packet.md',
]);
const betaAudit = auditFor([
  'docs/phase-4/generated/beta-coverage-report.json',
  'docs/phase-4/generated/beta-coverage-report.md',
]);
const ledgerSha256 = createHash('sha256')
  .update(renderGovernedEvidenceLedger(ledger))
  .digest('hex');
const governedEvidenceChain = {
  status: 'pass',
  sourceGitSha,
  evidenceCommitSha,
  currentGitSha: packetGitSha,
  releaseCandidateDir,
  ledgerPath,
  ledgerSha256,
  ledgerEntryCount: 1,
  downstreamCommitCount: 1,
};

function phase5Packet() {
  return {
    gitSha: packetGitSha,
    gitStatus: '',
    blockers: [],
    governedEvidenceChain,
    buildEvidence: { qaSignedOff: true, signedOffBy: 'Native QA Owner' },
    qaEvidence: Object.fromEntries(
      PHASE5_REQUIRED_QA_EVIDENCE_KEYS.map((key) => [key, { required: true, passed: true }]),
    ),
    widgetLifecycleEvidence: { status: 'pass' },
    cameraLifecycleEvidence: { status: 'pass' },
    performanceEvidence: { status: 'pass' },
    nativeOcr: { qaRequired: false },
  };
}

function phase7Packet() {
  return {
    gitSha: packetGitSha,
    gitStatus: '',
    blockers: [],
    governedEvidenceChain,
    evidence: Object.fromEntries(
      PHASE7_EVIDENCE_KEYS.map((key) => [key, key === 'signedOffBy' ? 'QA Owner' : true]),
    ),
    cat07CommittedEvidence: { status: 'pass' },
    cat07FullEvidenceContract: { status: 'pass' },
    upstreamPackets: {
      phase5DeviceQa: { status: 'pass' },
      humanE2e: { status: 'pass' },
    },
  };
}

function betaPacket() {
  return {
    status: 'ready',
    gitSha: packetGitSha,
    gitStatus: '',
    governedEvidenceChain,
    codeErrors: [],
    evidenceBlockers: [],
    warnings: [],
    evidence: {
      realBetaDataClaimed: true,
      dashboardEvidencePresent: true,
      supportDashboardEvidencePresent: true,
      analyticsDashboardEvidencePresent: true,
      sourceExportDigestPresent: true,
      namedSignoffPresent: true,
    },
  };
}

test('accepts future-ready Phase 5, Phase 7, and beta packet roles at R when audited at F', () => {
  assert.equal(validatePhase5UpstreamPacket(phase5Packet(), phase5Audit).status, 'pass');
  assert.equal(validatePhase7UpstreamPacket(phase7Packet(), phase7Audit).status, 'pass');
  assert.equal(validateClaimedBetaUpstreamPacket(betaPacket(), betaAudit, true).status, 'pass');
});

test('rejects reduced and extra canonical evidence inventories', () => {
  const reducedPhase5 = phase5Packet();
  delete reducedPhase5.qaEvidence[PHASE5_REQUIRED_QA_EVIDENCE_KEYS[0]];
  assert.equal(validatePhase5UpstreamPacket(reducedPhase5, phase5Audit).status, 'blocked');
  const extraPhase5 = phase5Packet();
  extraPhase5.qaEvidence.FORGED_QA_PASS = { required: true, passed: true };
  assert.equal(validatePhase5UpstreamPacket(extraPhase5, phase5Audit).status, 'blocked');
  const reducedPhase7 = phase7Packet();
  delete reducedPhase7.evidence[PHASE7_EVIDENCE_KEYS[0]];
  assert.equal(validatePhase7UpstreamPacket(reducedPhase7, phase7Audit).status, 'blocked');
  const extraPhase7 = phase7Packet();
  extraPhase7.evidence.forgedEvidence = true;
  assert.equal(validatePhase7UpstreamPacket(extraPhase7, phase7Audit).status, 'blocked');
  const reducedBeta = betaPacket();
  delete reducedBeta.evidence.realBetaDataClaimed;
  assert.equal(validateClaimedBetaUpstreamPacket(reducedBeta, betaAudit, true).status, 'blocked');
  const extraBeta = betaPacket();
  extraBeta.evidence.forgedEvidence = true;
  assert.equal(validateClaimedBetaUpstreamPacket(extraBeta, betaAudit, true).status, 'blocked');
});

test('rejects blocked upstream roles, foreign RCs, and false beta claims', () => {
  const blockedPhase7 = phase7Packet();
  blockedPhase7.upstreamPackets.humanE2e.status = 'blocked';
  assert.equal(validatePhase7UpstreamPacket(blockedPhase7, phase7Audit).status, 'blocked');
  const foreignBeta = betaPacket();
  foreignBeta.governedEvidenceChain = {
    ...governedEvidenceChain,
    releaseCandidateDir: 'docs/phase-9/release-candidates/rc-foreign',
  };
  assert.equal(validateClaimedBetaUpstreamPacket(foreignBeta, betaAudit, true).status, 'blocked');
  const blockedBeta = betaPacket();
  blockedBeta.status = 'blocked';
  assert.equal(validateClaimedBetaUpstreamPacket(blockedBeta, betaAudit, true).status, 'blocked');
});
