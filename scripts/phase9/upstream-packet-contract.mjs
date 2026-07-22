import { PHASE5_REQUIRED_QA_EVIDENCE_KEYS } from '../phase5/device-qa-packet-contract.mjs';
import { validatePhase7EvidenceInventory } from '../phase7/core-loop-qa-packet-contract.mjs';
import { validateBetaCoverageEvidenceInventory } from '../phase4/beta-coverage-packet-contract.mjs';
import {
  validateGovernedEvidenceChainBinding,
  validateGovernedGeneratedPublication,
} from '../launch/governed-evidence-chain.mjs';

function chainAndEnvelopeFailures(packet, label, audit) {
  const failures = validateGovernedEvidenceChainBinding(
    packet?.governedEvidenceChain,
    audit,
  ).errors.map((error) => `${label} ${error}`);
  if (packet?.gitSha !== packet?.governedEvidenceChain?.currentGitSha) {
    failures.push(`${label} packet Git SHA does not match its governed current Git SHA`);
  }
  if (packet?.gitStatus !== '') failures.push(`${label} was not generated from a clean worktree`);
  return failures;
}

export function validatePhase5UpstreamPacket(packet, audit) {
  const label = 'Phase 5 device QA packet';
  const failures = [];
  if (!Array.isArray(packet?.blockers) || packet.blockers.length !== 0) {
    failures.push(`${label} must contain an empty blockers array`);
  }
  const qaEvidence = packet?.qaEvidence;
  const keys =
    qaEvidence !== null && typeof qaEvidence === 'object' && !Array.isArray(qaEvidence)
      ? Object.keys(qaEvidence)
      : [];
  if (
    keys.length !== PHASE5_REQUIRED_QA_EVIDENCE_KEYS.length ||
    new Set(keys).size !== keys.length ||
    keys.some((key) => !PHASE5_REQUIRED_QA_EVIDENCE_KEYS.includes(key)) ||
    keys.some((key) => qaEvidence[key]?.required !== true || qaEvidence[key]?.passed !== true)
  ) {
    failures.push(`${label} required QA evidence inventory is not exact and passing`);
  }
  if (
    packet?.buildEvidence?.qaSignedOff !== true ||
    typeof packet?.buildEvidence?.signedOffBy !== 'string' ||
    packet.buildEvidence.signedOffBy.length === 0
  ) {
    failures.push(`${label} does not contain completed named native-device signoff`);
  }
  for (const [field, value] of [
    ['widgetLifecycleEvidence', packet?.widgetLifecycleEvidence?.status],
    ['cameraLifecycleEvidence', packet?.cameraLifecycleEvidence?.status],
    ['performanceEvidence', packet?.performanceEvidence?.status],
  ]) {
    if (value !== 'pass') failures.push(`${label} ${field} is not pass`);
  }
  if (packet?.nativeOcr?.qaRequired === true && packet?.nativeOcr?.evidence?.status !== 'pass') {
    failures.push(`${label} required native OCR evidence is not pass`);
  }
  failures.push(...chainAndEnvelopeFailures(packet, label, audit));
  failures.push(
    ...validateGovernedGeneratedPublication(packet?.governedEvidenceChain, audit, [
      'docs/phase-5/generated/device-qa-packet.json',
      'docs/phase-5/generated/device-qa-packet.md',
    ]).errors.map((error) => `${label} ${error}`),
  );
  return Object.freeze({
    status: failures.length === 0 ? 'pass' : 'blocked',
    errors: Object.freeze(failures),
  });
}

export function validatePhase7UpstreamPacket(packet, audit) {
  const label = 'Phase 7 core-loop QA packet';
  const failures = [];
  if (!Array.isArray(packet?.blockers) || packet.blockers.length !== 0) {
    failures.push(`${label} must contain an empty blockers array`);
  }
  failures.push(
    ...validatePhase7EvidenceInventory(packet?.evidence).errors.map((error) => `${label} ${error}`),
  );
  if (
    packet?.cat07CommittedEvidence?.status !== 'pass' ||
    packet?.cat07FullEvidenceContract?.status !== 'pass'
  ) {
    failures.push(`${label} CAT07 evidence is not pass`);
  }
  if (packet?.upstreamPackets?.phase5DeviceQa?.status !== 'pass') {
    failures.push(`${label} does not record a passing Phase 5 upstream role`);
  }
  if (packet?.upstreamPackets?.humanE2e?.status !== 'pass') {
    failures.push(`${label} does not record a passing human-E2E upstream role`);
  }
  failures.push(...chainAndEnvelopeFailures(packet, label, audit));
  failures.push(
    ...validateGovernedGeneratedPublication(packet?.governedEvidenceChain, audit, [
      'docs/phase-7/generated/core-loop-qa-packet.json',
      'docs/phase-7/generated/core-loop-qa-packet.md',
    ]).errors.map((error) => `${label} ${error}`),
  );
  return Object.freeze({
    status: failures.length === 0 ? 'pass' : 'blocked',
    errors: Object.freeze(failures),
  });
}

export function validateClaimedBetaUpstreamPacket(packet, audit, claimed) {
  if (!claimed) return Object.freeze({ status: 'not_claimed', errors: Object.freeze([]) });
  const label = 'beta coverage packet';
  const failures = [];
  if (
    packet?.status !== 'ready' ||
    !Array.isArray(packet?.codeErrors) ||
    packet.codeErrors.length !== 0 ||
    !Array.isArray(packet?.evidenceBlockers) ||
    packet.evidenceBlockers.length !== 0 ||
    !Array.isArray(packet?.warnings) ||
    packet.warnings.length !== 0
  ) {
    failures.push(`${label} is not ready with empty blocker/warning sets and complete evidence`);
  }
  failures.push(
    ...validateBetaCoverageEvidenceInventory(packet?.evidence).errors.map(
      (error) => `${label} ${error}`,
    ),
  );
  failures.push(...chainAndEnvelopeFailures(packet, label, audit));
  failures.push(
    ...validateGovernedGeneratedPublication(packet?.governedEvidenceChain, audit, [
      'docs/phase-4/generated/beta-coverage-report.json',
      'docs/phase-4/generated/beta-coverage-report.md',
    ]).errors.map((error) => `${label} ${error}`),
  );
  return Object.freeze({
    status: failures.length === 0 ? 'pass' : 'blocked',
    errors: Object.freeze(failures),
  });
}
