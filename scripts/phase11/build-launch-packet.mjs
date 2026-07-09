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
  normalizeProductionDomain,
  normalizeProductionSupportEmail,
  normalizeProductionUrl,
  phase11SourceFiles,
  printResult,
  read,
  requiredPhase11EvidenceKeys,
  warn,
  write,
} from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const sourceFiles = phase11SourceFiles();
const packetOutDir = String(env.PHASE11_PACKET_OUT_DIR ?? '').trim();
const outDir = packetOutDir || 'docs/phase-11/generated';
const packetOutputPaths = [
  `${outDir}/public-launch-packet.json`,
  `${outDir}/public-launch-packet.md`,
].map((path) => path.replace(/\\/g, '/'));

function gitStatusExcludingGeneratedPacket() {
  return gitStatusExcludingGeneratedEvidence(packetOutputPaths);
}

for (const file of sourceFiles)
  block(errors, exists(file), `${file} is missing from public launch packet inputs.`);

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
  'Public launch packet generated with a dirty Git worktree; do not use it as final launch evidence.',
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

let phase10PacketStatus = 'missing';
let phase10Decision = '';
if (exists('docs/phase-10/generated/closed-beta-packet.json')) {
  try {
    const phase10Packet = JSON.parse(read('docs/phase-10/generated/closed-beta-packet.json'));
    phase10PacketStatus = phase10Packet.status ?? 'unknown';
    phase10Decision = phase10Packet.publicLaunchDecision ?? '';
  } catch {
    phase10PacketStatus = 'unparseable';
  }
}

warn(warnings, phase9PacketStatus === 'ready', `Phase 9 packet status is ${phase9PacketStatus}.`);
warn(
  warnings,
  phase10PacketStatus === 'ready',
  `Phase 10 packet status is ${phase10PacketStatus}.`,
);
warn(
  warnings,
  Boolean(normalizeLaunchDecision(phase10Decision)),
  'Phase 10 packet does not contain a go or limited launch decision.',
);

const evidence = Object.fromEntries(
  requiredPhase11EvidenceKeys().map((key) => [key, evidenceFlagEnabled(env[key])]),
);
for (const [key, passed] of Object.entries(evidence))
  warn(warnings, passed, `External public launch evidence missing: ${key}=true.`);
const signedOffBy = normalizeNamedSignoff(env.PHASE11_SIGNED_OFF_BY);
warn(warnings, Boolean(signedOffBy), 'Public launch named signoff missing: PHASE11_SIGNED_OFF_BY.');

const packet = {
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 && warnings.length === 0 ? 'ready' : 'blocked',
  gitSha,
  gitStatus,
  phase9PacketStatus,
  phase10PacketStatus,
  phase10Decision: normalizeLaunchDecision(phase10Decision) ?? '',
  launchIdentity: {
    appEnvironment: env.EXPO_PUBLIC_APP_ENV ?? null,
    finalBrandDomain: normalizeProductionDomain(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
    marketingUrl: normalizeProductionUrl(env.EXPO_PUBLIC_MARKETING_URL),
    appStoreUrl: normalizeProductionUrl(env.EXPO_PUBLIC_APP_STORE_URL),
    playStoreUrl: normalizeProductionUrl(env.EXPO_PUBLIC_PLAY_STORE_URL),
    supportEmail: normalizeProductionSupportEmail(env.EXPO_PUBLIC_SUPPORT_EMAIL),
  },
  evidence,
  signedOffBy: signedOffBy ?? '',
  sourceHashes: Object.fromEntries(sourceFiles.filter(exists).map((file) => [file, hash(file)])),
  blockers: errors,
  warnings,
};

write(`${outDir}/public-launch-packet.json`, `${JSON.stringify(packet, null, 2)}\n`);
write(
  `${outDir}/public-launch-packet.md`,
  [
    '# Phase 11 Public Launch Packet',
    '',
    `Generated: ${packet.generatedAt}`,
    `Status: ${packet.status}`,
    `Git SHA: ${packet.gitSha}`,
    `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
    `Phase 9 packet status: ${packet.phase9PacketStatus}`,
    `Phase 10 packet status: ${packet.phase10PacketStatus}`,
    `Phase 10 decision: ${packet.phase10Decision || 'BLOCKED'}`,
    '',
    '## Launch Identity',
    '',
    `- Environment: ${packet.launchIdentity.appEnvironment || 'BLOCKED'}`,
    `- Final domain: ${packet.launchIdentity.finalBrandDomain || 'BLOCKED'}`,
    `- Marketing URL: ${packet.launchIdentity.marketingUrl || 'BLOCKED'}`,
    `- App Store URL: ${packet.launchIdentity.appStoreUrl || 'BLOCKED'}`,
    `- Play Store URL: ${packet.launchIdentity.playStoreUrl || 'BLOCKED'}`,
    `- Support email: ${packet.launchIdentity.supportEmail || 'BLOCKED'}`,
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
    '',
    '## Source Hashes',
    '',
    ...Object.entries(packet.sourceHashes).map(([file, value]) => `- \`${file}\`: \`${value}\``),
    '',
  ].join('\n'),
);

printResult('Phase 11 public launch packet', errors, warnings);
