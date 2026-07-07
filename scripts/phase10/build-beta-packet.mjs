#!/usr/bin/env node
import {
  block,
  command,
  envSnapshot,
  exists,
  hash,
  markdownList,
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

const errors = [];
const warnings = [];
const env = envSnapshot();
const sourceFiles = phase10SourceFiles();

for (const file of sourceFiles) block(errors, exists(file), `${file} is missing from closed beta packet inputs.`);

let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = command('git', ['status', '--short']).trim();
} catch {
  warn(warnings, false, 'Git SHA/status could not be captured.');
}

let phase9PacketStatus = 'missing';
if (exists('docs/phase-9/generated/release-engineering-qa-packet.json')) {
  try {
    phase9PacketStatus = JSON.parse(read('docs/phase-9/generated/release-engineering-qa-packet.json')).status ?? 'unknown';
  } catch {
    phase9PacketStatus = 'unparseable';
  }
}
warn(warnings, phase9PacketStatus === 'ready', `Phase 9 packet status is ${phase9PacketStatus}.`);

const evidence = Object.fromEntries(requiredPhase10EvidenceKeys().map((key) => [key, env[key] === 'true']));
for (const [key, passed] of Object.entries(evidence)) warn(warnings, passed, `External closed beta evidence missing: ${key}=true.`);

const decision = String(env.PHASE10_PUBLIC_LAUNCH_DECISION ?? '').toLowerCase();
const decisionReady = ['go', 'limited'].includes(decision);
warn(warnings, decisionReady, 'Closed beta public-launch decision missing: PHASE10_PUBLIC_LAUNCH_DECISION=go or limited.');
warn(warnings, Boolean(env.PHASE10_SIGNED_OFF_BY), 'Closed beta named signoff missing: PHASE10_SIGNED_OFF_BY.');

const packet = {
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 && warnings.length === 0 ? 'ready' : 'blocked',
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
  publicLaunchDecision: env.PHASE10_PUBLIC_LAUNCH_DECISION ?? '',
  signedOffBy: env.PHASE10_SIGNED_OFF_BY ?? '',
  sourceHashes: Object.fromEntries(sourceFiles.filter(exists).map((file) => [file, hash(file)])),
  blockers: errors,
  warnings,
};

write('docs/phase-10/generated/closed-beta-packet.json', `${JSON.stringify(packet, null, 2)}\n`);
write(
  'docs/phase-10/generated/closed-beta-packet.md',
  [
    '# Phase 10 Closed Beta Packet',
    '',
    `Generated: ${packet.generatedAt}`,
    `Status: ${packet.status}`,
    `Git SHA: ${packet.gitSha}`,
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
    '',
    '## Source Hashes',
    '',
    ...Object.entries(packet.sourceHashes).map(([file, value]) => `- \`${file}\`: \`${value}\``),
    '',
  ].join('\n'),
);

printResult('Phase 10 closed beta packet', errors, warnings);
