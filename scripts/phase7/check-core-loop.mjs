#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  return existsSync(abs(path)) ? parseEnv(read(path)) : {};
}

function require(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function has(path, pattern) {
  return pattern.test(read(path));
}

const exampleEnv = parseEnv(read('.env.example'));
const localEnv = envFile('.env');
const launchEnv = { ...exampleEnv, ...localEnv };

const requiredFiles = [
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/components/launch/DeferredSurface.tsx',
  'docs/phase-7/surface-inventory.md',
  'docs/phase-7/launch-claim-matrix.md',
  'docs/phase-7/beta-evidence-dashboard.md',
  'docs/phase-7/core-loop-qa-checklist.md',
  'docs/phase-7/phase-7-exit-review.md',
];

for (const file of requiredFiles) {
  require(existsSync(abs(file)), `${file} is missing.`);
}

const phase7PublicFlags = [
  'EXPO_PUBLIC_FINAL_BRAND_DOMAIN',
  'EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED',
  'EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED',
  'EXPO_PUBLIC_PHASE7_TREND_ENABLED',
  'EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED',
  'EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED',
  'EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED',
  'EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED',
  'EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED',
];

for (const key of phase7PublicFlags) {
  require(Object.prototype.hasOwnProperty.call(exampleEnv, key), `.env.example is missing ${key}.`);
}

require(has('apps/mobile/src/lib/env.ts', /phase7CommerceEnabled/), 'env.ts is missing Phase 7 commerce flag.');
require(has('apps/mobile/src/lib/env.ts', /phase7ReviewedConflictSharingEnabled/), 'env.ts is missing reviewed conflict sharing flag.');
require(has('apps/mobile/src/lib/launch/phase7.ts', /canShareConflictCard/), 'phase7.ts is missing share-card eligibility helper.');
require(has('apps/mobile/src/lib/launch/phase7.ts', /finalDomainReady/), 'phase7.ts must require a final brand domain for launch-sensitive surfaces.');

const gatedRoutes = [
  ['apps/mobile/src/app/commerce/_layout.tsx', /phase7Flags\.commerce/, 'commerce route group'],
  ['apps/mobile/src/app/trend/_layout.tsx', /phase7Flags\.trend/, 'trend route group'],
  ['apps/mobile/src/app/ask/_layout.tsx', /phase7Flags\.cloudAsk/, 'cloud Ask route group'],
  ['apps/mobile/src/app/community/ask.tsx', /phase7Flags\.communityPosting/, 'community ask screen'],
  ['apps/mobile/src/app/community/people-like-you.tsx', /phase7Flags\.communityPosting/, 'people-like-you screen'],
  ['apps/mobile/src/app/routine/widgets.tsx', /phase7Flags\.widgets/, 'widgets screen'],
];
for (const [path, pattern, label] of gatedRoutes) {
  require(has(path, /DeferredSurface/), `${label} must render DeferredSurface when gated.`);
  require(has(path, pattern), `${label} is missing its Phase 7 flag check.`);
}

require(
  has('apps/mobile/src/app/(tabs)/today.tsx', /phase7Flags\.cloudAsk\s*\?\s*<AskTeaser/),
  'Today must hide AskTeaser unless cloud Ask is enabled.',
);
require(
  has('apps/mobile/src/app/(tabs)/progress.tsx', /phase7Flags\.trend[\s\S]*<TrendInsight/),
  'Progress must hide TrendInsight unless trend is enabled.',
);
require(
  has('apps/mobile/src/app/progress/about.tsx', /phase7Flags\.trend[\s\S]*trend\/optin/),
  'Progress no-score explainer must hide trend opt-in unless trend is enabled.',
);
require(
  has('apps/mobile/src/features/commerce/WhereToBuy.tsx', /phase7Flags\.commerce/) &&
    has('apps/mobile/src/features/commerce/WhereToBuy.tsx', /EnabledWhereToBuy/),
  'WhereToBuy must be hidden behind the commerce flag without conditional hooks.',
);
require(
  has('apps/mobile/src/app/(tabs)/you.tsx', /phase7Flags\.widgets/) &&
    has('apps/mobile/src/app/(tabs)/you.tsx', /phase7Flags\.cloudAsk/) &&
    has('apps/mobile/src/app/(tabs)/you.tsx', /phase7Flags\.commerce/) &&
    has('apps/mobile/src/app/(tabs)/you.tsx', /phase7Flags\.trend/),
  'You tab must gate widgets, cloud Ask, commerce, and trend entry points.',
);

const shareRoute = read('apps/mobile/src/app/share/conflict/[ruleId].tsx');
require(/phase7Flags\.shareCard/.test(shareRoute), 'Share route must be gated by phase7Flags.shareCard.');
require(/canShareConflictCard/.test(shareRoute), 'Share route must require canShareConflictCard.');
require(!/\?\?\s*data\?\.conflicts\[0\]/.test(shareRoute), 'Share route must not fallback to the first conflict.');
require(/share_card_exported/.test(shareRoute), 'Share route must track share_card_exported.');
require(/share_sheet_opened/.test(shareRoute), 'Share route must track share_sheet_opened.');
require(
  has('apps/mobile/src/app/conflict/[ruleId].tsx', /canShareConflictCard/),
  'Conflict sheet must hide share launcher unless share card is eligible.',
);

warn(
  Boolean(launchEnv.EXPO_PUBLIC_FINAL_BRAND_DOMAIN) && !/example\.com/i.test(launchEnv.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
  'Missing final brand domain: EXPO_PUBLIC_FINAL_BRAND_DOMAIN.',
);
for (const key of ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_TERMS_URL', 'EXPO_PUBLIC_SUPPORT_URL', 'EXPO_PUBLIC_ACCOUNT_DELETION_URL', 'EXPO_PUBLIC_DATA_EXPORT_URL']) {
  warn(Boolean(launchEnv[key]) && !/example\.com/i.test(launchEnv[key]), `${key} must be a real production URL.`);
}

const placeholderFiles = [
  'apps/mobile/src/features/onboarding/consentCopy.ts',
  'apps/mobile/src/features/ask/copy.ts',
  'apps/mobile/src/features/trend/copy.ts',
  'apps/mobile/src/features/community/copy.ts',
  'apps/mobile/src/features/commerce/copy.ts',
  'apps/mobile/src/app/(tabs)/you.tsx',
];
for (const file of placeholderFiles) {
  warn(!/PLACEHOLDER|placeholder|B-PRIVACY-COPY/i.test(read(file)), `${file} still contains placeholder privacy/consent copy.`);
}

warn(!/reviewedBy:\s*null/.test(read('apps/mobile/src/features/intelligence/rules.ts')), 'Starter conflict rules still have reviewedBy: null.');
warn(
  !/reviewedBy:\s*null/.test(read('apps/mobile/src/features/recommendations/catalog.ts')),
  'Recommendation catalog still has reviewedBy: null for medical-adjacent entries.',
);

const externalEvidence = [
  'PHASE7_BRAND_READY',
  'PHASE7_SUPABASE_RLS_PASS',
  'PHASE7_CLINICAL_REVIEW_PASS',
  'PHASE7_CATALOG_BETA_IMPORT_PASS',
  'PHASE7_DEVICE_QA_PASS',
  'PHASE7_REVENUECAT_QA_PASS',
  'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
  'PHASE7_BETA_DASHBOARD_READY',
];
for (const key of externalEvidence) {
  warn(process.env[key] === 'true', `Missing external Phase 7 evidence: ${key}=true.`);
}
warn(Boolean(process.env.PHASE7_SIGNED_OFF_BY), 'Missing external Phase 7 evidence: PHASE7_SIGNED_OFF_BY.');

console.log('Phase 7 core-loop launch check');
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`FAIL ${error}`);

if (errors.length > 0) {
  console.error(`\nPhase 7 core loop has ${errors.length} blocker${errors.length === 1 ? '' : 's'}.`);
  process.exit(1);
}

if (warnings.length > 0 && strict) {
  console.error(`\nPhase 7 strict mode failed on ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
  process.exit(1);
}

console.log('\nPhase 7 code gates are present. Strict launch still requires warning-free evidence.');
