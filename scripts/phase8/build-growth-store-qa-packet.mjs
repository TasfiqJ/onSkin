#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  evidenceFlagEnabled,
  normalizeAndroidSha256Fingerprints,
  normalizeAppleTeamId,
  normalizeNamedSignoff,
  normalizeProductionDomain,
  normalizeProductionSupportEmail,
  normalizeProductionUrl,
  command,
} from '../phase9/lib.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const packetOutDir = process.env.PHASE8_PACKET_OUT_DIR ?? 'docs/phase-8/generated';
const outDir = resolve(root, packetOutDir);
const packetOutputPaths = [
  `${packetOutDir}/growth-store-qa-packet.json`,
  `${packetOutDir}/growth-store-qa-packet.md`,
].map((path) => path.replace(/\\/g, '/'));
const blockers = [];
const warnings = [];

function abs(path) {
  return resolve(root, path);
}

function exists(path) {
  return existsSync(abs(path));
}

function read(path) {
  return readFileSync(abs(path), 'utf8');
}

function hash(path) {
  return createHash('sha256').update(read(path)).digest('hex');
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    out[key] = rest.join('=').trim();
  }
  return out;
}

function envFile(path) {
  return exists(path) ? parseEnv(read(path)) : {};
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function block(condition, message) {
  if (!condition) blockers.push(message);
}

function gitStatusExcludingGeneratedPacket() {
  const excluded = new Set(packetOutputPaths);
  return command('git', ['status', '--short'])
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const statusPath = line.slice(3).replace(/\\/g, '/');
      return !excluded.has(statusPath);
    })
    .join('\n')
    .trim();
}

const exampleEnv = parseEnv(read('.env.example'));
const localEnv = envFile('.env');
const launchEnv = { ...exampleEnv, ...localEnv, ...process.env };

const evidence = {
  brandSourceOfTruth: evidenceFlagEnabled(process.env.PHASE8_BRAND_SOURCE_OF_TRUTH_PASS),
  domainDns: evidenceFlagEnabled(process.env.PHASE8_DOMAIN_DNS_PASS),
  iosUniversalLinks: evidenceFlagEnabled(process.env.PHASE8_IOS_UNIVERSAL_LINKS_PASS),
  androidAppLinks: evidenceFlagEnabled(process.env.PHASE8_ANDROID_APP_LINKS_PASS),
  shareCardDeviceQa: evidenceFlagEnabled(process.env.PHASE8_SHARE_CARD_DEVICE_QA_PASS),
  attributionPrivacy: evidenceFlagEnabled(process.env.PHASE8_ATTRIBUTION_PRIVACY_PASS),
  appStorePacket: evidenceFlagEnabled(process.env.PHASE8_APP_STORE_PACKET_PASS),
  playStorePacket: evidenceFlagEnabled(process.env.PHASE8_PLAY_STORE_PACKET_PASS),
  creatorCompliance: evidenceFlagEnabled(process.env.PHASE8_CREATOR_COMPLIANCE_PASS),
  supportResponse: evidenceFlagEnabled(process.env.PHASE8_SUPPORT_RESPONSE_PASS),
  launchDashboard: evidenceFlagEnabled(process.env.PHASE8_LAUNCH_DASHBOARD_READY),
  dryRun: evidenceFlagEnabled(process.env.PHASE8_DRY_RUN_PASS),
  appleTeamId: Boolean(normalizeAppleTeamId(process.env.APPLE_TEAM_ID)),
  androidCertificateFingerprints:
    normalizeAndroidSha256Fingerprints(process.env.ANDROID_CERT_SHA256_FINGERPRINTS).length > 0,
  signedOffBy: normalizeNamedSignoff(process.env.PHASE8_SIGNED_OFF_BY) ?? '',
};

const sourceFiles = [
  '.env.example',
  'package.json',
  'apps/mobile/app.config.js',
  'apps/mobile/src/lib/env.ts',
  'apps/mobile/src/lib/launch/phase8.ts',
  'apps/mobile/src/lib/growth/attribution.ts',
  'apps/mobile/src/features/growth/shareLinks.ts',
  'apps/mobile/src/app/s/[shareId].tsx',
  'apps/mobile/src/features/growth/shareCard.ts',
  'apps/mobile/src/app/share/conflict/[ruleId].tsx',
  'apps/mobile/src/features/review/policy.ts',
  'apps/mobile/src/features/review/prompt.ts',
  'apps/mobile/src/lib/legal/storeMetadata.ts',
  'docs/phase-8/source-of-truth.md',
  'docs/phase-8/link-routing-runbook.md',
  'docs/phase-8/store-metadata-source-of-truth.md',
  'docs/phase-8/store-compliance-packet.md',
  'docs/phase-8/creator-brief.md',
  'docs/phase-8/apple-ads-keyword-lab.md',
  'docs/phase-8/acquisition-dashboard.md',
  'docs/phase-8/launch-dry-run-checklist.md',
  'docs/phase-8/support-review-response-playbook.md',
  'docs/phase-8/phase-8-exit-review.md',
  'docs/phase-8/public-site/index.html',
  'docs/phase-8/public-site/share.html',
  'docs/phase-8/public-site/waitlist.html',
  'docs/phase-8/public-site/support.html',
  'docs/phase-8/public-site/.well-known/apple-app-site-association.template.json',
  'docs/phase-8/public-site/.well-known/assetlinks.template.json',
  'docs/HUMAN_SIMULATED_E2E_TESTING.md',
  'docs/E2E_TESTING_CHECKLIST.md',
  'docs/USER_FLOW_TREE.md',
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
  'docs/phase-5/generated/device-qa-packet.json',
  'docs/phase-5/generated/device-qa-packet.md',
  'docs/phase-6/generated/payments-qa-packet.json',
  'docs/phase-6/generated/payments-qa-packet.md',
  'docs/phase-7/generated/core-loop-qa-packet.json',
  'docs/phase-7/generated/core-loop-qa-packet.md',
  'scripts/phase8/build-growth-store-qa-packet.mjs',
  'scripts/phase8/check-growth-store-readiness.mjs',
  'scripts/phase8/check-growth-store-smoke.mjs',
  'scripts/phase9/lib.mjs',
  'supabase/migrations/20260616000028_phase8_growth.sql',
  'supabase/functions/growth-event/index.ts',
  'supabase/functions/waitlist/index.ts',
];

for (const file of sourceFiles) {
  block(exists(file), `${file} is missing from the QA packet inputs.`);
}

let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedPacket();
} catch {
  warn(false, 'Git SHA/status could not be captured.');
}
warn(
  gitStatus.length === 0,
  'Phase 8 QA packet generated with a dirty Git worktree; do not use it as final growth/store evidence.',
);

const publicIdentity = {
  finalBrandDomain: normalizeProductionDomain(launchEnv.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
  marketingUrl: normalizeProductionUrl(launchEnv.EXPO_PUBLIC_MARKETING_URL),
  appStoreUrl: normalizeProductionUrl(launchEnv.EXPO_PUBLIC_APP_STORE_URL),
  playStoreUrl: normalizeProductionUrl(launchEnv.EXPO_PUBLIC_PLAY_STORE_URL),
  supportEmail: normalizeProductionSupportEmail(launchEnv.EXPO_PUBLIC_SUPPORT_EMAIL),
};

warn(Boolean(publicIdentity.finalBrandDomain), 'Final brand domain is missing.');
warn(Boolean(publicIdentity.marketingUrl), 'Marketing URL is missing.');
warn(Boolean(publicIdentity.supportEmail), 'Support email is missing.');
warn(Boolean(publicIdentity.appStoreUrl), 'App Store URL is missing.');
warn(Boolean(publicIdentity.playStoreUrl), 'Play Store URL is missing.');

for (const [key, passed] of Object.entries(evidence)) {
  if (key === 'signedOffBy') continue;
  warn(Boolean(passed), `External evidence missing: ${key}.`);
}
warn(Boolean(evidence.signedOffBy), 'External evidence missing: signedOffBy.');

const packet = {
  generatedAt: new Date().toISOString(),
  objective: 'Phase 8 growth loop and store readiness',
  status: blockers.length === 0 && warnings.length === 0 ? 'ready' : 'blocked',
  gitSha,
  gitStatus,
  publicIdentity,
  evidence,
  matrices: {
    linkRouting: [
      'iOS installed opens app via Universal Links',
      'iOS not installed opens web fallback',
      'Android installed opens app via App Links',
      'Android not installed opens web fallback',
      'Desktop opens web fallback',
      'Invalid share ID never reveals sensitive context',
    ],
    shareCard: [
      'Reviewed non-safety two-product conflicts only',
      '1080x1920 export',
      'Brand, CTA, footnote, and first-party link label present',
      'No product/profile/pregnancy/photo/rule data in URL',
      'Started, link created, succeeded/failed, sheet opened events present',
    ],
    storeSubmission: [
      'Metadata limits validated in tests',
      'No unsupported claims in public copy',
      'Screenshots use enabled features only',
      'Privacy labels and Data safety match code',
      'Account deletion and export evidence attached',
    ],
    attribution: [
      'Allowed campaign keys only',
      'Opaque share_id only',
      'No health/product/profile/contact fields',
      'No complex analytics objects',
    ],
  },
  sourceHashes: Object.fromEntries(sourceFiles.filter(exists).map((file) => [file, hash(file)])),
  blockers,
  warnings,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(
  resolve(outDir, 'growth-store-qa-packet.json'),
  `${JSON.stringify(packet, null, 2)}\n`,
);

const markdown = [
  '# Phase 8 Growth Store QA Packet',
  '',
  `Generated: ${packet.generatedAt}`,
  `Status: ${packet.status}`,
  `Git SHA: ${packet.gitSha}`,
  `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
  '',
  '## Public Identity',
  '',
  `- Final domain: ${packet.publicIdentity.finalBrandDomain ?? 'BLOCKED'}`,
  `- Marketing URL: ${packet.publicIdentity.marketingUrl ?? 'BLOCKED'}`,
  `- App Store URL: ${packet.publicIdentity.appStoreUrl ?? 'BLOCKED'}`,
  `- Play Store URL: ${packet.publicIdentity.playStoreUrl ?? 'BLOCKED'}`,
  `- Support email: ${packet.publicIdentity.supportEmail ?? 'BLOCKED'}`,
  '',
  '## Blockers',
  '',
  ...(blockers.length ? blockers.map((item) => `- ${item}`) : ['- None from code packet inputs.']),
  '',
  '## Warnings',
  '',
  ...(warnings.length ? warnings.map((item) => `- ${item}`) : ['- None.']),
  '',
  '## Matrices',
  '',
  ...Object.entries(packet.matrices).flatMap(([name, rows]) => [
    `### ${name}`,
    '',
    ...rows.map((row) => `- ${row}`),
    '',
  ]),
  '## Source Hashes',
  '',
  ...Object.entries(packet.sourceHashes).map(([file, value]) => `- \`${file}\`: \`${value}\``),
  '',
].join('\n');

writeFileSync(resolve(outDir, 'growth-store-qa-packet.md'), markdown);

console.log(`Wrote ${resolve(outDir, 'growth-store-qa-packet.md')}`);
console.log(`Wrote ${resolve(outDir, 'growth-store-qa-packet.json')}`);

if (blockers.length > 0) {
  console.error(
    `Phase 8 QA packet has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

if (warnings.length > 0 && strict) {
  console.error(
    `Phase 8 QA packet strict mode failed on ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}
