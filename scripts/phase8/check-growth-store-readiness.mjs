#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { productionDomain, productionSupportEmail, productionUrl } from '../phase9/lib.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const errors = [];
const warnings = [];

function abs(path) {
  return resolve(root, path);
}

function read(path) {
  return readFileSync(abs(path), 'utf8');
}

function exists(path) {
  return existsSync(abs(path));
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

function fail(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function has(path, pattern) {
  return pattern.test(read(path));
}

function listFiles(dir) {
  const base = abs(dir);
  if (!existsSync(base)) return [];
  const out = [];
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

const exampleEnv = parseEnv(read('.env.example'));
const launchEnv = { ...exampleEnv, ...envFile('.env'), ...process.env };

const requiredEnv = [
  'EXPO_PUBLIC_MARKETING_URL',
  'EXPO_PUBLIC_SUPPORT_EMAIL',
  'EXPO_PUBLIC_APP_STORE_URL',
  'EXPO_PUBLIC_PLAY_STORE_URL',
  'EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED',
  'EXPO_PUBLIC_PHASE8_REVIEW_PROMPT_ENABLED',
  'EXPO_PUBLIC_PHASE8_CREATOR_LINKS_ENABLED',
  'EXPO_PUBLIC_PHASE8_PAID_MEASUREMENT_ENABLED',
  'PHASE8_BRAND_SOURCE_OF_TRUTH_PASS',
  'PHASE8_DOMAIN_DNS_PASS',
  'PHASE8_IOS_UNIVERSAL_LINKS_PASS',
  'PHASE8_ANDROID_APP_LINKS_PASS',
  'PHASE8_SHARE_CARD_DEVICE_QA_PASS',
  'PHASE8_ATTRIBUTION_PRIVACY_PASS',
  'PHASE8_APP_STORE_PACKET_PASS',
  'PHASE8_PLAY_STORE_PACKET_PASS',
  'PHASE8_CREATOR_COMPLIANCE_PASS',
  'PHASE8_SUPPORT_RESPONSE_PASS',
  'PHASE8_LAUNCH_DASHBOARD_READY',
  'PHASE8_DRY_RUN_PASS',
  'PHASE8_SIGNED_OFF_BY',
  'APPLE_TEAM_ID',
  'ANDROID_CERT_SHA256_FINGERPRINTS',
];

for (const key of requiredEnv) {
  fail(Object.prototype.hasOwnProperty.call(exampleEnv, key), `.env.example is missing ${key}.`);
}

const requiredFiles = [
  'apps/mobile/src/lib/launch/phase8.ts',
  'apps/mobile/src/lib/growth/attribution.ts',
  'apps/mobile/src/lib/growth/attribution.test.ts',
  'apps/mobile/src/features/growth/shareLinks.ts',
  'apps/mobile/src/app/s/[shareId].tsx',
  'apps/mobile/src/features/growth/shareCard.ts',
  'apps/mobile/src/features/review/policy.ts',
  'apps/mobile/src/features/review/policy.test.ts',
  'apps/mobile/src/features/review/prompt.ts',
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
  'supabase/migrations/20260616000028_phase8_growth.sql',
  'supabase/functions/growth-event/index.ts',
  'supabase/functions/waitlist/index.ts',
];

for (const file of requiredFiles) {
  fail(exists(file), `${file} is missing.`);
}

fail(has('apps/mobile/app.config.js', /associatedDomains/), 'app.config.js must configure iOS associated domains.');
fail(has('apps/mobile/app.config.js', /intentFilters/), 'app.config.js must configure Android App Links intent filters.');
fail(has('apps/mobile/app.config.js', /appStoreUrl/), 'app.config.js must expose the App Store URL for native review fallback.');
fail(has('apps/mobile/app.config.js', /playStoreUrl/), 'app.config.js must expose the Play Store URL for native review fallback.');

fail(has('apps/mobile/src/lib/env.ts', /phase8PublicLinksEnabled/), 'env.ts is missing Phase 8 public link flag.');
fail(has('apps/mobile/src/lib/env.ts', /phase8ReviewPromptEnabled/), 'env.ts is missing Phase 8 review prompt flag.');
fail(has('apps/mobile/src/lib/env.ts', /appStoreUrl/), 'env.ts is missing store URLs.');

fail(has('apps/mobile/src/lib/growth/attribution.ts', /SENSITIVE_GROWTH_KEY/), 'growth attribution must declare a sensitive-key guard.');
fail(has('apps/mobile/src/lib/growth/attribution.ts', /share_id/), 'growth attribution must allow opaque share_id only.');
fail(has('apps/mobile/src/features/growth/shareLinks.ts', /createShareId/), 'share link helper must create opaque share IDs.');
fail(!has('apps/mobile/src/features/growth/shareLinks.ts', /product(Name|Id)|rule_id|pregnan/i), 'share link helper must not carry product, rule, or pregnancy data.');
fail(has('apps/mobile/src/app/s/[shareId].tsx', /share_link_opened/), 'Installed app must handle /s/:shareId links.');
fail(has('apps/mobile/src/app/s/[shareId].tsx', /isSafeOpaqueId/), 'Installed share route must validate opaque share IDs.');

fail(has('apps/mobile/src/features/growth/shareCard.ts', /width:\s*1080/) && has('apps/mobile/src/features/growth/shareCard.ts', /height:\s*1920/), 'Share card export must be fixed at 1080x1920.');
const shareRoute = read('apps/mobile/src/app/share/conflict/[ruleId].tsx');
for (const event of [
  'share_card_export_started',
  'share_link_created',
  'share_card_export_succeeded',
  'share_card_export_failed',
  'share_card_exported',
  'share_sheet_opened',
]) {
  fail(shareRoute.includes(event), `Share route must track ${event}.`);
}
fail(!/rule_id/.test(shareRoute), 'Share route must not send rule_id in public growth telemetry.');
fail(has('apps/mobile/src/lib/launch/phase7.ts', /interactionType\s*!==\s*'safety'/), 'Share eligibility must exclude safety conflicts.');
fail(has('apps/mobile/src/lib/launch/phase7.ts', /tagA\s*!==\s*'pregnancy'/), 'Share eligibility must exclude pregnancy pseudo-conflicts.');

fail(has('apps/mobile/src/features/review/prompt.ts', /expo-store-review/), 'Review prompt must use expo-store-review.');
fail(has('apps/mobile/src/features/review/policy.ts', /maxAttemptsPer365Days:\s*3/), 'Review prompt policy must cap annual attempts.');
fail(!has('apps/mobile/src/features/review/prompt.ts', /5\s*star|five\s*star|positive\s*review/i), 'Review prompt must not ask for positive reviews.');

fail(has('apps/mobile/src/lib/legal/storeMetadata.ts', /PHASE8_STORE_METADATA_PACKET/), 'Store metadata packet is missing.');
fail(has('apps/mobile/src/lib/legal/storeMetadata.ts', /validateStoreMetadataPacket/), 'Store metadata validator is missing.');
fail(has('supabase/migrations/20260616000028_phase8_growth.sql', /growth_events/), 'Phase 8 migration must create growth_events.');
fail(has('supabase/migrations/20260616000028_phase8_growth.sql', /waitlist_signups/), 'Phase 8 migration must create waitlist_signups.');
fail(has('supabase/functions/growth-event/index.ts', /allowedEvents/), 'growth-event function must allowlist event names.');
fail(has('supabase/functions/waitlist/index.ts', /invalid email/), 'waitlist function must validate email.');

const allText = listFiles('.')
  .filter((file) => !file.includes(`${join('node_modules', '')}`))
  .filter((file) => !file.includes(`${join('.git', '')}`))
  .filter((file) => !file.endsWith(join('scripts', 'phase8', 'check-growth-store-readiness.mjs')))
  .filter((file) => /\.(ts|tsx|js|mjs|json|md|html)$/.test(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
fail(!/dynamiclinks\.page\.link|@react-native-firebase\/dynamic-links|expo-firebase-dynamic-links/i.test(allText), 'Firebase Dynamic Links must not be used.');

warn(productionDomain(launchEnv.EXPO_PUBLIC_FINAL_BRAND_DOMAIN), 'Missing final brand domain.');
warn(productionUrl(launchEnv.EXPO_PUBLIC_MARKETING_URL), 'Missing production marketing URL.');
warn(productionSupportEmail(launchEnv.EXPO_PUBLIC_SUPPORT_EMAIL), 'Missing production support email.');
warn(productionUrl(launchEnv.EXPO_PUBLIC_APP_STORE_URL), 'Missing App Store URL.');
warn(productionUrl(launchEnv.EXPO_PUBLIC_PLAY_STORE_URL), 'Missing Play Store URL.');

const externalEvidence = [
  'PHASE8_BRAND_SOURCE_OF_TRUTH_PASS',
  'PHASE8_DOMAIN_DNS_PASS',
  'PHASE8_IOS_UNIVERSAL_LINKS_PASS',
  'PHASE8_ANDROID_APP_LINKS_PASS',
  'PHASE8_SHARE_CARD_DEVICE_QA_PASS',
  'PHASE8_ATTRIBUTION_PRIVACY_PASS',
  'PHASE8_APP_STORE_PACKET_PASS',
  'PHASE8_PLAY_STORE_PACKET_PASS',
  'PHASE8_CREATOR_COMPLIANCE_PASS',
  'PHASE8_SUPPORT_RESPONSE_PASS',
  'PHASE8_LAUNCH_DASHBOARD_READY',
  'PHASE8_DRY_RUN_PASS',
];
for (const key of externalEvidence) {
  warn(process.env[key] === 'true', `Missing external Phase 8 evidence: ${key}=true.`);
}
warn(Boolean(process.env.PHASE8_SIGNED_OFF_BY), 'Missing external Phase 8 evidence: PHASE8_SIGNED_OFF_BY.');
warn(Boolean(process.env.APPLE_TEAM_ID) && !/^X+$/i.test(process.env.APPLE_TEAM_ID), 'Missing Apple Team ID evidence for AASA.');
warn(Boolean(process.env.ANDROID_CERT_SHA256_FINGERPRINTS), 'Missing Android release certificate fingerprint evidence.');

console.log('Phase 8 growth/store readiness check');
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`FAIL ${error}`);

if (errors.length > 0) {
  console.error(`\nPhase 8 growth/store readiness has ${errors.length} blocker${errors.length === 1 ? '' : 's'}.`);
  process.exit(1);
}

if (warnings.length > 0 && strict) {
  console.error(`\nPhase 8 strict mode failed on ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
  process.exit(1);
}

console.log('\nPhase 8 code gates are present. Strict launch still requires warning-free evidence.');
