#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const outDir = resolve(root, 'docs/phase-8/generated');
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

const exampleEnv = parseEnv(read('.env.example'));
const localEnv = envFile('.env');
const launchEnv = { ...exampleEnv, ...localEnv };

const evidence = {
  brandSourceOfTruth: process.env.PHASE8_BRAND_SOURCE_OF_TRUTH_PASS === 'true',
  domainDns: process.env.PHASE8_DOMAIN_DNS_PASS === 'true',
  iosUniversalLinks: process.env.PHASE8_IOS_UNIVERSAL_LINKS_PASS === 'true',
  androidAppLinks: process.env.PHASE8_ANDROID_APP_LINKS_PASS === 'true',
  shareCardDeviceQa: process.env.PHASE8_SHARE_CARD_DEVICE_QA_PASS === 'true',
  attributionPrivacy: process.env.PHASE8_ATTRIBUTION_PRIVACY_PASS === 'true',
  appStorePacket: process.env.PHASE8_APP_STORE_PACKET_PASS === 'true',
  playStorePacket: process.env.PHASE8_PLAY_STORE_PACKET_PASS === 'true',
  creatorCompliance: process.env.PHASE8_CREATOR_COMPLIANCE_PASS === 'true',
  supportResponse: process.env.PHASE8_SUPPORT_RESPONSE_PASS === 'true',
  launchDashboard: process.env.PHASE8_LAUNCH_DASHBOARD_READY === 'true',
  dryRun: process.env.PHASE8_DRY_RUN_PASS === 'true',
  appleTeamId: Boolean(process.env.APPLE_TEAM_ID) && !/^X+$/i.test(process.env.APPLE_TEAM_ID),
  androidCertificateFingerprints: Boolean(process.env.ANDROID_CERT_SHA256_FINGERPRINTS),
  signedOffBy: process.env.PHASE8_SIGNED_OFF_BY ?? '',
};

const sourceFiles = [
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
  'docs/phase-8/store-compliance-packet.md',
  'docs/phase-8/creator-brief.md',
  'docs/phase-8/acquisition-dashboard.md',
  'docs/phase-8/launch-dry-run-checklist.md',
  'supabase/migrations/20260616000028_phase8_growth.sql',
  'supabase/functions/growth-event/index.ts',
  'supabase/functions/waitlist/index.ts',
];

for (const file of sourceFiles) {
  block(exists(file), `${file} is missing from the QA packet inputs.`);
}

warn(Boolean(launchEnv.EXPO_PUBLIC_FINAL_BRAND_DOMAIN), 'Final brand domain is missing.');
warn(Boolean(launchEnv.EXPO_PUBLIC_MARKETING_URL), 'Marketing URL is missing.');
warn(Boolean(launchEnv.EXPO_PUBLIC_SUPPORT_EMAIL), 'Support email is missing.');
warn(Boolean(launchEnv.EXPO_PUBLIC_APP_STORE_URL), 'App Store URL is missing.');
warn(Boolean(launchEnv.EXPO_PUBLIC_PLAY_STORE_URL), 'Play Store URL is missing.');

for (const [key, passed] of Object.entries(evidence)) {
  if (key === 'signedOffBy') continue;
  warn(Boolean(passed), `External evidence missing: ${key}.`);
}
warn(Boolean(evidence.signedOffBy), 'External evidence missing: signedOffBy.');

const packet = {
  generatedAt: new Date().toISOString(),
  objective: 'Phase 8 growth loop and store readiness',
  status: blockers.length === 0 && warnings.length === 0 ? 'ready' : 'blocked',
  publicIdentity: {
    finalBrandDomain: launchEnv.EXPO_PUBLIC_FINAL_BRAND_DOMAIN || null,
    marketingUrl: launchEnv.EXPO_PUBLIC_MARKETING_URL || null,
    appStoreUrl: launchEnv.EXPO_PUBLIC_APP_STORE_URL || null,
    playStoreUrl: launchEnv.EXPO_PUBLIC_PLAY_STORE_URL || null,
    supportEmail: launchEnv.EXPO_PUBLIC_SUPPORT_EMAIL || null,
  },
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
writeFileSync(resolve(outDir, 'growth-store-qa-packet.json'), `${JSON.stringify(packet, null, 2)}\n`);

const markdown = [
  '# Phase 8 Growth Store QA Packet',
  '',
  `Generated: ${packet.generatedAt}`,
  `Status: ${packet.status}`,
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
  console.error(`Phase 8 QA packet has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}.`);
  process.exit(1);
}

if (warnings.length > 0 && strict) {
  console.error(`Phase 8 QA packet strict mode failed on ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
  process.exit(1);
}
