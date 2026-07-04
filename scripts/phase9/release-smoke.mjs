#!/usr/bin/env node
import { block, envFile, envSnapshot, exists, has, printResult, read, requiredPhase9EvidenceKeys, warn } from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const exampleEnv = envFile('.env.example');

const requiredFiles = [
  'docs/phase-9/source-of-truth.md',
  'docs/phase-9/data-inventory.md',
  'docs/phase-9/edge-function-auth-matrix.md',
  'docs/phase-9/observability-payload-audit.md',
  'docs/phase-9/rollout-rollback-plan.md',
  'docs/phase-9/incident-response-plan.md',
  'docs/phase-9/beta-evidence-summary.md',
  'docs/phase-9/dependency-sbom.md',
  'docs/phase-9/release-candidates/README.md',
  'docs/phase-9/release-candidates/_template/manifest.md',
  'docs/phase-9/release-candidates/_template/commands.md',
  'docs/phase-9/release-candidates/_template/automated-verification.md',
  'docs/phase-9/release-candidates/_template/manual-qa-matrix.md',
  'docs/phase-9/release-candidates/_template/security-review.md',
  'docs/phase-9/release-candidates/_template/privacy-review.md',
  'docs/phase-9/release-candidates/_template/payments-review.md',
  'docs/phase-9/release-candidates/_template/observability-review.md',
  'docs/phase-9/release-candidates/_template/store-review-packet.md',
  'docs/phase-9/release-candidates/_template/rollout-plan.md',
  'docs/phase-9/release-candidates/_template/incident-plan.md',
  'docs/phase-9/release-candidates/_template/signoff.md',
  'supabase/functions/account-deletion/index.ts',
  'supabase/functions/data-export/index.ts',
  'apps/mobile/src/lib/observability/scrub.ts',
  'apps/mobile/src/lib/analytics/eventRegistry.ts',
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
];

for (const file of requiredFiles) block(errors, exists(file), `${file} is missing.`);

for (const key of [
  'APPLE_SIWA_CLIENT_ID',
  'POSTHOG_PROJECT_ID',
  'POSTHOG_API_HOST',
  'POSTHOG_DELETION_APPROVED_ALTERNATE',
  ...requiredPhase9EvidenceKeys(),
  'PHASE9_SIGNED_OFF_BY',
]) {
  block(errors, Object.prototype.hasOwnProperty.call(exampleEnv, key), `.env.example is missing ${key}.`);
}

const packageJson = JSON.parse(read('package.json'));
for (const script of [
  'phase9:release-smoke',
  'phase9:rls-adversarial',
  'phase9:edge-auth-smoke',
  'phase9:data-rights-smoke',
  'phase9:privacy-payload-audit',
  'phase9:store-build-inspect',
  'phase9:dependency-sbom',
  'phase9:qa-packet',
  'phase9:verify',
]) {
  block(errors, Boolean(packageJson.scripts?.[script]), `package.json is missing ${script}.`);
}

block(errors, has('apps/mobile/app.config.js', /associatedDomains/), 'app.config.js must configure iOS associated domains.');
block(errors, has('apps/mobile/app.config.js', /intentFilters/), 'app.config.js must configure Android App Links.');
block(errors, has('apps/mobile/eas.json', /"production"/) && has('apps/mobile/eas.json', /"channel":\s*"production"/), 'eas.json must define a production channel.');
block(errors, !/^production$/i.test(env.EXPO_PUBLIC_APP_ENV ?? '') || !env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY, 'Production builds must not include RevenueCat Test Store key.');

for (const key of Object.keys(exampleEnv).filter((name) => name.startsWith('EXPO_PUBLIC_'))) {
  block(errors, !/(SECRET|PRIVATE|SERVICE_ROLE|WEBHOOK|PERSONAL|AUTH_TOKEN)/i.test(key), `Secret-looking key is public: ${key}.`);
}

const placeholder = (value) => !value || /example\.com|YOUR-PROJECT|xxxxxxxx|XXXXXXXX|\.\.\.|__BLOCKED_PLACEHOLDER__/i.test(String(value));
for (const key of [
  'EXPO_PUBLIC_PRIVACY_URL',
  'EXPO_PUBLIC_TERMS_URL',
  'EXPO_PUBLIC_SUPPORT_URL',
  'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
  'EXPO_PUBLIC_DATA_EXPORT_URL',
  'EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL',
  'EXPO_PUBLIC_FINAL_BRAND_DOMAIN',
  'EXPO_PUBLIC_MARKETING_URL',
  'EXPO_PUBLIC_SUPPORT_EMAIL',
  'EXPO_PUBLIC_APP_STORE_URL',
  'EXPO_PUBLIC_PLAY_STORE_URL',
]) {
  warn(warnings, !placeholder(env[key]), `Missing final value for ${key}.`);
}

for (const key of requiredPhase9EvidenceKeys()) {
  warn(warnings, env[key] === 'true', `Missing Phase 9 release evidence: ${key}=true.`);
}
warn(warnings, Boolean(env.PHASE9_SIGNED_OFF_BY), 'Missing Phase 9 named signoff: PHASE9_SIGNED_OFF_BY.');

if (env.EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED === 'true') {
  warn(warnings, !placeholder(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN), 'Public links are enabled before final domain evidence.');
}
if (env.EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED === 'true') {
  warn(warnings, env.PHASE7_CLINICAL_REVIEW_PASS === 'true', 'Cloud Ask is enabled without clinical/legal release evidence.');
}
if (env.EXPO_PUBLIC_NATIVE_OCR_ENABLED === 'true') {
  warn(warnings, env.PHASE5_DEVICE_QA_PASS === 'true', 'Native OCR is enabled without native device QA evidence.');
}

if (env.PHASE9_RUN_LIVE_SUPABASE_CHECK === 'true') {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    const response = await fetch(`${url.replace(/\/+$/g, '')}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    block(errors, response.ok, `Supabase connectivity check failed with ${response.status}.`);
  } catch (error) {
    block(errors, false, `Supabase connectivity check failed: ${error instanceof Error ? error.message : String(error)}.`);
  }
} else {
  warn(warnings, false, 'Live Supabase connectivity check not run; set PHASE9_RUN_LIVE_SUPABASE_CHECK=true for RC evidence.');
}

printResult('Phase 9 release smoke', errors, warnings);
