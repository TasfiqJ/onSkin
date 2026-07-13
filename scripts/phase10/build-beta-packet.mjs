#!/usr/bin/env node
import {
  block,
  command,
  evidenceFlagEnabled,
  envSnapshot,
  exists,
  gitStatusExcludingGeneratedEvidence,
  hash,
  markdownList,
  normalizeLaunchDecision,
  normalizeNamedSignoff,
  notApplicablePhase10EvidenceKeys,
  normalizeProductionDomain,
  normalizeProductionSupportEmail,
  normalizeProductionUrl,
  phase10SourceFiles,
  printResult,
  read,
  requiredPhase10EvidenceKeys,
  warn,
  write,
} from './lib.mjs';
import {
  launchContractSnapshot,
  loadLaunchContract,
  platformRequirementStatus,
} from '../launch/contract.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const launchContract = loadLaunchContract();
const sourceFiles = phase10SourceFiles();
const packetOutDir = String(env.PHASE10_PACKET_OUT_DIR ?? '').trim();
const outDir = packetOutDir || 'docs/phase-10/generated';
const packetOutputPaths = [
  `${outDir}/closed-beta-packet.json`,
  `${outDir}/closed-beta-packet.md`,
].map((path) => path.replace(/\\/g, '/'));

function gitStatusExcludingGeneratedPacket() {
  return gitStatusExcludingGeneratedEvidence(packetOutputPaths);
}

for (const file of sourceFiles)
  block(errors, exists(file), `${file} is missing from closed beta packet inputs.`);

let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedPacket();
} catch {
  warn(warnings, false, 'Git SHA/status could not be captured.');
}
warn(
  warnings,
  gitStatus.length === 0,
  'Closed beta packet generated with a dirty Git worktree; do not use it as final beta evidence.',
);

let phase9PacketStatus = 'missing';
if (exists('docs/phase-9/generated/release-engineering-qa-packet.json')) {
  try {
    phase9PacketStatus =
      JSON.parse(read('docs/phase-9/generated/release-engineering-qa-packet.json')).status ??
      'unknown';
  } catch {
    phase9PacketStatus = 'unparseable';
  }
}
warn(warnings, phase9PacketStatus === 'ready', `Phase 9 packet status is ${phase9PacketStatus}.`);

const evidence = Object.fromEntries(
  requiredPhase10EvidenceKeys().map((key) => [key, evidenceFlagEnabled(env[key])]),
);
const notApplicableEvidence = Object.fromEntries(
  notApplicablePhase10EvidenceKeys(launchContract).map((key) => [key, 'not_applicable']),
);
for (const [key, passed] of Object.entries(evidence))
  warn(warnings, passed, `External closed beta evidence missing: ${key}=true.`);

const publicLaunchDecision = normalizeLaunchDecision(env.PHASE10_PUBLIC_LAUNCH_DECISION);
const signedOffBy = normalizeNamedSignoff(env.PHASE10_SIGNED_OFF_BY);
warn(
  warnings,
  Boolean(publicLaunchDecision),
  'Closed beta public-launch decision missing: PHASE10_PUBLIC_LAUNCH_DECISION=go or limited.',
);
warn(warnings, Boolean(signedOffBy), 'Closed beta named signoff missing: PHASE10_SIGNED_OFF_BY.');

const packet = {
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 && warnings.length === 0 ? 'ready' : 'blocked',
  launchContract: launchContractSnapshot(launchContract),
  platformStatus: {
    ios: platformRequirementStatus('ios', launchContract),
    android: platformRequirementStatus('android', launchContract),
  },
  gitSha,
  gitStatus,
  phase9PacketStatus,
  betaIdentity: {
    appEnvironment: env.EXPO_PUBLIC_APP_ENV ?? null,
    finalBrandDomain: normalizeProductionDomain(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
    marketingUrl: normalizeProductionUrl(env.EXPO_PUBLIC_MARKETING_URL),
    supportEmail: normalizeProductionSupportEmail(env.EXPO_PUBLIC_SUPPORT_EMAIL),
  },
  evidence,
  notApplicableEvidence,
  publicLaunchDecision: publicLaunchDecision ?? '',
  signedOffBy: signedOffBy ?? '',
  sourceHashes: Object.fromEntries(sourceFiles.filter(exists).map((file) => [file, hash(file)])),
  blockers: errors,
  warnings,
};

write(`${outDir}/closed-beta-packet.json`, `${JSON.stringify(packet, null, 2)}\n`);
write(
  `${outDir}/closed-beta-packet.md`,
  [
    '# Phase 10 Closed Beta Packet',
    '',
    `Generated: ${packet.generatedAt}`,
    `Status: ${packet.status}`,
    `Git SHA: ${packet.gitSha}`,
    `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
    `Phase 9 packet status: ${packet.phase9PacketStatus}`,
    '',
    '## Beta Identity',
    '',
    `- Environment: ${packet.betaIdentity.appEnvironment || 'BLOCKED'}`,
    `- Final domain: ${packet.betaIdentity.finalBrandDomain || 'BLOCKED'}`,
    `- Marketing URL: ${packet.betaIdentity.marketingUrl || 'BLOCKED'}`,
    `- Support email: ${packet.betaIdentity.supportEmail || 'BLOCKED'}`,
    `- Public launch decision: ${packet.publicLaunchDecision || 'BLOCKED'}`,
    `- Signed off by: ${packet.signedOffBy || 'BLOCKED'}`,
    '',
    '## Blockers',
    '',
    ...markdownList(errors, '- None from packet inputs.'),
    '',
    '## Warnings',
    '',
    ...markdownList(warnings),
    '',
    '## Evidence',
    '',
    ...Object.entries(evidence).map(([key, value]) => `- ${key}: ${value ? 'PASS' : 'BLOCKED'}`),
    ...Object.entries(notApplicableEvidence).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Source Hashes',
    '',
    ...Object.entries(packet.sourceHashes).map(([file, value]) => `- \`${file}\`: \`${value}\``),
    '',
  ].join('\n'),
);

printResult('Phase 10 closed beta packet', errors, warnings);
