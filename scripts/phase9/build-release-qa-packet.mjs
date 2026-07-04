#!/usr/bin/env node
import {
  block,
  command,
  envSnapshot,
  exists,
  hash,
  markdownList,
  printResult,
  requiredPhase9EvidenceKeys,
  warn,
  write,
} from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();

const sourceFiles = [
  'package.json',
  'package-lock.json',
  'apps/mobile/app.base.json',
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
  'apps/mobile/src/lib/analytics/eventRegistry.ts',
  'apps/mobile/src/lib/analytics/track.ts',
  'apps/mobile/src/lib/observability/scrub.ts',
  'apps/mobile/src/lib/observability/sentry.ts',
  'apps/mobile/src/features/settings/actions.ts',
  'apps/mobile/src/lib/auth/apple.ts',
  'supabase/functions/account-deletion/index.ts',
  'supabase/functions/data-export/index.ts',
  'supabase/functions/revenuecat-webhook/index.ts',
  'docs/phase-9/source-of-truth.md',
  'docs/phase-9/data-inventory.md',
  'docs/phase-9/edge-function-auth-matrix.md',
  'docs/phase-9/observability-payload-audit.md',
  'docs/phase-9/rollout-rollback-plan.md',
  'docs/phase-9/incident-response-plan.md',
];

for (const file of sourceFiles) block(errors, exists(file), `${file} is missing from QA packet inputs.`);

let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = command('git', ['status', '--short']).trim();
} catch {
  warn(warnings, false, 'Git SHA/status could not be captured.');
}

const evidence = Object.fromEntries(requiredPhase9EvidenceKeys().map((key) => [key, env[key] === 'true']));
for (const [key, passed] of Object.entries(evidence)) {
  warn(warnings, passed, `External RC evidence missing: ${key}=true.`);
}
warn(warnings, Boolean(env.PHASE9_SIGNED_OFF_BY), 'External RC evidence missing: PHASE9_SIGNED_OFF_BY.');

const packet = {
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 && warnings.length === 0 ? 'ready' : 'blocked',
  gitSha,
  gitStatus,
  releaseIdentity: {
    appEnvironment: env.EXPO_PUBLIC_APP_ENV ?? null,
    finalBrandDomain: env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN ?? null,
    marketingUrl: env.EXPO_PUBLIC_MARKETING_URL ?? null,
    appStoreUrl: env.EXPO_PUBLIC_APP_STORE_URL ?? null,
    playStoreUrl: env.EXPO_PUBLIC_PLAY_STORE_URL ?? null,
    supportEmail: env.EXPO_PUBLIC_SUPPORT_EMAIL ?? null,
  },
  evidence,
  signedOffBy: env.PHASE9_SIGNED_OFF_BY ?? '',
  sourceHashes: Object.fromEntries(sourceFiles.filter(exists).map((file) => [file, hash(file)])),
  blockers: errors,
  warnings,
};

write('docs/phase-9/generated/release-engineering-qa-packet.json', `${JSON.stringify(packet, null, 2)}\n`);
write(
  'docs/phase-9/generated/release-engineering-qa-packet.md',
  [
    '# Phase 9 Release Engineering QA Packet',
    '',
    `Generated: ${packet.generatedAt}`,
    `Status: ${packet.status}`,
    `Git SHA: ${packet.gitSha}`,
    '',
    '## Release Identity',
    '',
    `- Environment: ${packet.releaseIdentity.appEnvironment || 'BLOCKED'}`,
    `- Final domain: ${packet.releaseIdentity.finalBrandDomain || 'BLOCKED'}`,
    `- Marketing URL: ${packet.releaseIdentity.marketingUrl || 'BLOCKED'}`,
    `- App Store URL: ${packet.releaseIdentity.appStoreUrl || 'BLOCKED'}`,
    `- Play Store URL: ${packet.releaseIdentity.playStoreUrl || 'BLOCKED'}`,
    `- Support email: ${packet.releaseIdentity.supportEmail || 'BLOCKED'}`,
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

printResult('Phase 9 release QA packet', errors, warnings);
