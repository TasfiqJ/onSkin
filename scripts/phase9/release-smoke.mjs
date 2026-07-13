#!/usr/bin/env node
import {
  block,
  blockPublicEnvSecrets,
  command,
  envFile,
  envSnapshot,
  evidenceFlagEnabled,
  exists,
  has,
  hash,
  normalizeNamedSignoff,
  placeholderEnvValue,
  printResult,
  productionDomain,
  productionSupportEmail,
  productionUrl,
  read,
  requiredPhase9EvidenceKeys,
  warn,
} from './lib.mjs';
import { isReleasePlatformRequired, loadLaunchContract } from '../launch/contract.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const exampleEnv = envFile('.env.example');
const launchContract = loadLaunchContract();
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);

const phase7EvidenceKeys = [
  'PHASE7_BRAND_READY',
  'PHASE7_SUPABASE_RLS_PASS',
  'PHASE7_CLINICAL_REVIEW_PASS',
  'PHASE7_CATALOG_BETA_IMPORT_PASS',
  'PHASE7_DEVICE_QA_PASS',
  'PHASE7_REVENUECAT_QA_PASS',
  'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
  'PHASE7_BETA_DASHBOARD_READY',
  'PHASE7_SIGNED_OFF_BY',
];

const liveHarnessFiles = [
  'scripts/phase9/live-supabase-adversarial.mjs',
  'scripts/phase9/live-edge-auth.mjs',
  'scripts/phase9/live-public-forms.mjs',
  'scripts/phase9/live-catalog-rate-limit.mjs',
  'scripts/phase9/live-order-report-poll.mjs',
  'scripts/phase9/live-revenuecat-webhook.mjs',
  'scripts/phase9/live-data-rights.mjs',
  'scripts/phase9/live-consent-withdrawal.mjs',
];

const localVerifierFiles = [
  'scripts/phase9/release-contact-smoke.mjs',
  'scripts/phase9/evidence-normalization-smoke.mjs',
  'scripts/phase9/release-smoke.mjs',
  'scripts/phase9/rls-adversarial-smoke.mjs',
  'scripts/phase9/rls-adversarial.mjs',
  'scripts/phase9/edge-auth-smoke.mjs',
  'scripts/phase9/edge-functions-check.mjs',
  'scripts/phase9/data-rights-smoke.mjs',
  'scripts/phase9/consent-withdrawal-smoke.mjs',
  'scripts/phase9/supabase-policy-lint.mjs',
  'scripts/phase9/security-ci-smoke.mjs',
  'scripts/phase9/privacy-payload-audit.mjs',
  'scripts/phase9/dependency-sbom.mjs',
  'scripts/phase9/store-build-inspect.mjs',
];

const requiredFiles = [
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  'docs/phase-9/source-of-truth.md',
  'docs/phase-9/data-inventory.md',
  'docs/phase-9/edge-function-auth-matrix.md',
  'docs/phase-9/observability-payload-audit.md',
  'docs/phase-9/security-scanner-evidence.md',
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
  '.github/workflows/quality.yml',
  'supabase/functions/account-deletion/index.ts',
  'supabase/functions/account-deletion/photoStorageCleanup.ts',
  'supabase/functions/account-deletion/photoStorageCleanup.test.ts',
  'supabase/functions/_shared/storagePath.ts',
  'supabase/functions/_shared/storagePath.test.ts',
  'supabase/functions/data-export/index.ts',
  'supabase/functions/data-export/exportCore.ts',
  'supabase/functions/data-export/exportCore.test.ts',
  'supabase/functions/data-export/exportRegistry.ts',
  'supabase/functions/data-export/exportRegistry.test.ts',
  'supabase/functions/consent-withdrawal/index.ts',
  'supabase/functions/catalog-lookup/catalogContract.ts',
  'supabase/functions/catalog-lookup/catalogContract.test.ts',
  'supabase/functions/catalog-search/catalogContract.ts',
  'supabase/functions/catalog-search/catalogContract.test.ts',
  'supabase/migrations/20260705000034_phase9_security_definer_hardening.sql',
  'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
  'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
  'supabase/migrations/20260615000027_phase6_payments.sql',
  'supabase/migrations/20260713000045_anonymous_photo_storage_guard.sql',
  'scripts/phase9/lib.mjs',
  'scripts/phase2/supabase-rls-smoke.mjs',
  'scripts/phase9/build-release-qa-packet.mjs',
  ...localVerifierFiles,
  ...liveHarnessFiles,
  'apps/mobile/src/lib/observability/scrub.ts',
  'apps/mobile/src/lib/analytics/eventRegistry.ts',
  'apps/mobile/src/lib/env.ts',
  'apps/mobile/src/lib/env.test.ts',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
  'apps/mobile/src/features/photos/encryptedStorage.ts',
  'apps/mobile/src/features/photos/encryptedStorage.test.ts',
  'apps/mobile/src/features/photos/store.ts',
  'apps/mobile/src/features/photos/store.test.ts',
  'apps/mobile/src/lib/supabase/largeSecureStore.ts',
  'apps/mobile/src/lib/supabase/largeSecureStore.test.ts',
  'apps/mobile/src/lib/applock/singleFlight.ts',
  'apps/mobile/src/lib/applock/singleFlight.test.ts',
  'apps/mobile/src/lib/auth/accountGeneration.ts',
  'apps/mobile/src/lib/auth/accountGeneration.test.ts',
  'apps/mobile/src/lib/auth/localAccountIsolation.ts',
  'apps/mobile/src/lib/auth/localAccountIsolation.test.ts',
  'apps/mobile/src/app/community/ask.tsx',
  'apps/mobile/src/app/community/people-like-you.tsx',
  'apps/mobile/src/app/trend/optin.tsx',
  'apps/mobile/src/app/routine/widgets.tsx',
  'apps/mobile/src/app/routine/_layout.tsx',
  'apps/mobile/src/features/subscription/gatedRoutes.ts',
  'apps/mobile/src/features/subscription/copy.ts',
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
];

for (const file of requiredFiles) block(errors, exists(file), `${file} is missing.`);

for (const key of [
  'APPLE_SIWA_CLIENT_ID',
  'POSTHOG_PROJECT_ID',
  'POSTHOG_API_HOST',
  'POSTHOG_DELETION_APPROVED_ALTERNATE',
  'TURNSTILE_SECRET_KEY',
  'PUBLIC_FORMS_TURNSTILE_REQUIRED',
  'PUBLIC_FORMS_RATE_LIMIT_MAX',
  'PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS',
  'PUBLIC_FORMS_MAX_BYTES',
  'PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX',
  'CATALOG_RATE_LIMIT_MAX',
  'CATALOG_RATE_LIMIT_WINDOW_SECONDS',
  'USER_EDGE_BODY_MAX_BYTES',
  'EDGE_EXTERNAL_FETCH_TIMEOUT_MS',
  'EDGE_EXTERNAL_RESPONSE_MAX_BYTES',
  'DATA_EXPORT_RATE_LIMIT_MAX',
  'DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS',
  'DATA_EXPORT_PHOTO_URL_TTL_SECONDS',
  'PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX',
  'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK',
  'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS',
  'PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX',
  'SHOPMY_BRAND_API_KEY',
  'ORDER_REPORT_POLL_SECRET',
  'REVENUECAT_WEBHOOK_MAX_BYTES',
  'PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL',
  'PHASE9_ANONYMOUS_CAPTCHA_TOKEN',
  'PHASE9_ALLOW_PRODUCTION_LIVE_SUPABASE_ADVERSARIAL',
  'PHASE9_RUN_LIVE_EDGE_AUTH',
  'PHASE9_ALLOW_PRODUCTION_LIVE_EDGE_AUTH',
  'PHASE9_RUN_LIVE_PUBLIC_FORMS',
  'PHASE9_ALLOW_PRODUCTION_LIVE_PUBLIC_FORMS',
  'PHASE9_RUN_LIVE_CATALOG_RATE_LIMIT',
  'PHASE9_ALLOW_PRODUCTION_LIVE_CATALOG_RATE_LIMIT',
  'PHASE9_RUN_LIVE_ORDER_REPORT_POLL',
  'PHASE9_ALLOW_PRODUCTION_LIVE_ORDER_REPORT_POLL',
  'PHASE9_ORDER_REPORT_POLL_ACTIVATED_EXPECTED',
  'PHASE9_RUN_LIVE_REVENUECAT_WEBHOOK',
  'PHASE9_ALLOW_PRODUCTION_LIVE_REVENUECAT_WEBHOOK',
  'PHASE9_RUN_LIVE_DATA_RIGHTS',
  'PHASE9_ALLOW_PRODUCTION_LIVE_DATA_RIGHTS',
  'PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL',
  'PHASE9_ALLOW_PRODUCTION_LIVE_CONSENT_WITHDRAWAL',
  'PHASE9_RELEASE_CANDIDATE_DIR',
  ...phase7EvidenceKeys,
  ...requiredPhase9EvidenceKeys(),
  'PHASE9_SIGNED_OFF_BY',
]) {
  block(
    errors,
    Object.prototype.hasOwnProperty.call(exampleEnv, key),
    `.env.example is missing ${key}.`,
  );
}

const packageJson = JSON.parse(read('package.json'));
const integerInRange = (value, min, max) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
};

for (const script of [
  'phase9:release-smoke',
  'phase9:rls-adversarial-smoke',
  'phase9:rls-adversarial',
  'phase9:supabase-policy-lint',
  'phase9:live-supabase-adversarial',
  'phase9:edge-auth-smoke',
  'phase9:edge-functions-check',
  'phase9:live-edge-auth',
  'phase9:live-public-forms',
  'phase9:live-catalog-rate-limit',
  'phase9:live-order-report-poll',
  'phase9:live-revenuecat-webhook',
  'phase9:security-ci-smoke',
  'phase9:data-rights-smoke',
  'phase9:data-export-contract-smoke',
  'phase9:storage-path-privacy-smoke',
  'phase9:account-deletion-photo-storage-smoke',
  'phase9:revenuecat-webhook-atomic-smoke',
  'phase9:live-data-rights',
  'phase9:consent-withdrawal',
  'phase9:live-consent-withdrawal',
  'phase9:privacy-payload-audit',
  'phase9:store-build-inspect',
  'phase9:dependency-sbom',
  'phase9:qa-packet',
  'phase9:verify',
  'docs:generated-packet-status-audit:strict',
]) {
  block(errors, Boolean(packageJson.scripts?.[script]), `package.json is missing ${script}.`);
}
block(
  errors,
  /phase9:rls-adversarial-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:rls-adversarial/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'phase9:verify must run the credential-free RLS contract and static adversarial gates.',
);
block(
  errors,
  /phase9:rls-adversarial-smoke/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    /phase9:rls-adversarial/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    /phase9:supabase-policy-lint/.test(packageJson.scripts?.['launch:verify'] ?? ''),
  'launch:verify must run the RLS contract, static adversarial, and Supabase policy gates.',
);
block(
  errors,
  /phase9:data-export-contract-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:data-export-contract-smoke/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    has('.github/workflows/quality.yml', /npm run phase9:data-export-contract-smoke/),
  'Phase 9, launch, and CI verification must run the canonical data-export contract.',
);
block(
  errors,
  /phase9:storage-path-privacy-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'phase9:verify must run the storage-path privacy contract.',
);
block(
  errors,
  /phase9:account-deletion-photo-storage-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'phase9:verify must run the account-deletion photo-storage contract.',
);
block(
  errors,
  /phase9:revenuecat-webhook-atomic-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'phase9:verify must run the RevenueCat atomic webhook contract.',
);
block(
  errors,
  /phase9:qa-packet && npm run docs:generated-packet-status-audit:strict && npm run typecheck/.test(
    packageJson.scripts?.['phase9:verify'] ?? '',
  ),
  'phase9:verify must run the strict generated-packet status audit after building the release QA packet.',
);

block(
  errors,
  has('apps/mobile/app.config.js', /associatedDomains/),
  'app.config.js must configure iOS associated domains.',
);
if (androidReleaseRequired) {
  block(
    errors,
    has('apps/mobile/app.config.js', /intentFilters/),
    'app.config.js must configure Android App Links.',
  );
}
block(
  errors,
  has('apps/mobile/eas.json', /"production"/) &&
    has('apps/mobile/eas.json', /"channel":\s*"production"/),
  'eas.json must define a production channel.',
);
block(
  errors,
  has('apps/mobile/app.config.js', /function readVariantEnv/) &&
    has('apps/mobile/app.config.js', /trim\(\)\.toLowerCase\(\)/) &&
    has('apps/mobile/app.config.js', /must be development, staging, or production/),
  'app.config.js must normalize and validate APP_VARIANT before resolving native identity.',
);
block(
  errors,
  !/^production$/i.test(env.EXPO_PUBLIC_APP_ENV ?? '') ||
    !env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY,
  'Production builds must not include RevenueCat Test Store key.',
);
block(
  errors,
  has('apps/mobile/src/lib/env.ts', /function readAppEnvironment/),
  'Mobile env helper must normalize app environment.',
);
block(
  errors,
  has('apps/mobile/src/lib/env.ts', /return isDevRuntime\(\) \? 'development' : 'production'/),
  'Mobile env helper must default missing/invalid non-dev app environment to production.',
);
block(
  errors,
  !has(
    'apps/mobile/src/lib/env.ts',
    /appEnvironment:\s*process\.env\.EXPO_PUBLIC_APP_ENV\s*\?\?\s*'development'/,
  ),
  'Mobile env helper must not default appEnvironment to development in release bundles.',
);
block(
  errors,
  has('apps/mobile/src/lib/env.test.ts', /defaults missing non-dev app env to production/) &&
    has('apps/mobile/src/lib/env.test.ts', /defaults invalid non-dev app env to production/),
  'Mobile env tests must prove non-dev app environment fails closed to production.',
);
block(
  errors,
  has('scripts/phase9/lib.mjs', /function readScriptAppEnvironment/) &&
    has('scripts/phase9/lib.mjs', /envFile\('\.env'\)/) &&
    has('scripts/phase9/lib.mjs', /process\.env/) &&
    has('scripts/phase9/lib.mjs', /return 'production'/),
  'Phase 9 script app-environment helper must default missing or invalid values to production.',
);
for (const file of liveHarnessFiles) {
  if (!exists(file)) continue;
  const source = read(file);
  block(
    errors,
    /readScriptAppEnvironment\(\)/.test(source),
    `${file} must use readScriptAppEnvironment().`,
  );
  block(
    errors,
    !/\?\?\s*'development'/.test(source),
    `${file} must not default live app environment to development.`,
  );
  block(
    errors,
    /placeholderEnvValue/.test(source),
    `${file} must use the shared placeholderEnvValue helper.`,
  );
  block(
    errors,
    !/function\s+placeholder\s*\(/.test(source),
    `${file} must not carry a local placeholder regex.`,
  );
  if (/cleanup (?:warning|failed)/i.test(source)) {
    block(
      errors,
      /redactedErrorKind/.test(source),
      `${file} cleanup warnings must use redacted error kinds.`,
    );
    block(
      errors,
      !/cleanup (?:warning|failed)[^\n]*(?:\.message|resultError\(error\)|user\.email|externalOrderId)/i.test(
        source,
      ),
      `${file} cleanup warnings must not include raw messages, user emails, or synthetic identifiers.`,
    );
  }
}

const qaPacketBuilder = read('scripts/phase9/build-release-qa-packet.mjs');
block(
  errors,
  /scripts\/phase9\/build-release-qa-packet\.mjs/.test(qaPacketBuilder),
  'Phase 9 release QA packet must include its own builder in source hashes.',
);
block(
  errors,
  /Release QA packet generated with a dirty Git worktree/.test(qaPacketBuilder) &&
    /Git status: \$\{packet\.gitStatus \? 'DIRTY' : 'clean'\}/.test(qaPacketBuilder),
  'Phase 9 release QA packet must warn on dirty worktrees and expose Git status in Markdown.',
);
block(
  errors,
  /function gitStatusExcludingGeneratedPacket\(\)/.test(qaPacketBuilder) &&
    /release-engineering-qa-packet\.json/.test(qaPacketBuilder) &&
    /release-engineering-qa-packet\.md/.test(qaPacketBuilder) &&
    /gitStatus = gitStatusExcludingGeneratedPacket\(\)/.test(qaPacketBuilder),
  'Phase 9 release QA packet must ignore only its own generated outputs when recording Git status.',
);
for (const file of ['.env.example', ...requiredFiles]) {
  block(
    errors,
    qaPacketBuilder.includes(`'${file}'`) || qaPacketBuilder.includes(`"${file}"`),
    `Phase 9 release QA packet must hash ${file}.`,
  );
}
block(
  errors,
  has('apps/mobile/src/lib/launch/phase7.ts', /productionSurfaceReady/) &&
    has(
      'apps/mobile/src/lib/launch/phase7.ts',
      /env\.appEnvironment\s*!==\s*'production'\s*\|\|\s*finalDomainReady/,
    ),
  'Phase 7 launch flags must fail closed for production bundles until a final brand domain is configured.',
);
block(
  errors,
  has(
    'apps/mobile/src/lib/launch/phase7.ts',
    /phase7Capabilities\s*=\s*Object\.freeze\([\s\S]*communityQuestionSubmission:\s*false[\s\S]*communityAggregates:\s*false[\s\S]*trendEngine:\s*false[\s\S]*nativeWidgets:\s*false/,
  ),
  'Unimplemented community, Trend, and native-widget capabilities must remain non-environment-driven.',
);
block(
  errors,
  has(
    'apps/mobile/src/lib/launch/phase7.test.ts',
    /keeps production Phase 7 surfaces disabled without a final brand domain/,
  ) &&
    has(
      'apps/mobile/src/lib/launch/phase7.test.ts',
      /keeps unimplemented capabilities closed even when staging flags are enabled/,
    ),
  'Phase 7 launch tests must cover production identity gates and non-bypassable unavailable capabilities.',
);

for (const [path, surface, label] of [
  ['apps/mobile/src/app/community/ask.tsx', 'communityPosting', 'community ask screen'],
  [
    'apps/mobile/src/app/community/people-like-you.tsx',
    'communityPosting',
    'community aggregate screen',
  ],
  ['apps/mobile/src/app/trend/optin.tsx', 'trend', 'trend opt-in screen'],
  ['apps/mobile/src/app/routine/widgets.tsx', 'widgets', 'widgets screen'],
]) {
  const source = read(path);
  block(
    errors,
    /DeferredSurface/.test(source) && source.includes(`surface="${surface}"`),
    `${label} must remain a truthful deferred surface.`,
  );
}

const communityAsk = read('apps/mobile/src/app/community/ask.tsx');
const communityAggregate = read('apps/mobile/src/app/community/people-like-you.tsx');
const trendOptIn = read('apps/mobile/src/app/trend/optin.tsx');
const widgetsRoute = read('apps/mobile/src/app/routine/widgets.tsx');
const routineLayout = read('apps/mobile/src/app/routine/_layout.tsx');
const routineGatedRoutes = read('apps/mobile/src/features/subscription/gatedRoutes.ts');
const subscriptionCopy = read('apps/mobile/src/features/subscription/copy.ts');
block(
  errors,
  !/question_submitted|grantCommunityConsent|confirmCommunityAge|TextInput/.test(communityAsk),
  'Unavailable community posting must not collect consent, accept text, or emit submission analytics.',
);
block(
  errors,
  !/dry, sensitive|alternate-night cycling|Aggregated & anonymised/.test(communityAggregate),
  'People-like-you must not render illustrative aggregate data as real.',
);
block(
  errors,
  !/grantTrendConsent|revokeTrendConsent|photo_trend_insights|ToggleSwitch/.test(trendOptIn),
  'Unavailable Trend must not solicit consent or present an opt-in control.',
);
block(
  errors,
  !/Show on Lock Screen|useUpdateNotifPrefs|Live Activity/.test(widgetsRoute) &&
    !/withProGate|<ProGate/.test(widgetsRoute) &&
    /if \(routeName === 'widgets'\) return null/.test(routineGatedRoutes) &&
    /if \(!gateFeature\) return stack/.test(routineLayout) &&
    !/glanceable|home screen|Live Activit(?:y|ies)/i.test(subscriptionCopy),
  'Unavailable native widgets and Live Activities must bypass paywalls and not appear as working claims.',
);

blockPublicEnvSecrets(errors, env, exampleEnv);

const placeholder = placeholderEnvValue;

function markdownTableValue(source, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    source
      .match(new RegExp(`^\\|\\s*${escaped}\\s*\\|\\s*([^|]+?)\\s*\\|\\s*$`, 'im'))?.[1]
      ?.trim() ?? ''
  );
}

for (const [key, validate] of [
  ['EXPO_PUBLIC_PRIVACY_URL', productionUrl],
  ['EXPO_PUBLIC_TERMS_URL', productionUrl],
  ['EXPO_PUBLIC_SUPPORT_URL', productionUrl],
  ['EXPO_PUBLIC_ACCOUNT_DELETION_URL', productionUrl],
  ['EXPO_PUBLIC_DATA_EXPORT_URL', productionUrl],
  ['EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL', productionUrl],
  ['EXPO_PUBLIC_FINAL_BRAND_DOMAIN', productionDomain],
  ['EXPO_PUBLIC_MARKETING_URL', productionUrl],
  ['EXPO_PUBLIC_SUPPORT_EMAIL', productionSupportEmail],
  ['EXPO_PUBLIC_APP_STORE_URL', productionUrl],
  ...(androidReleaseRequired ? [['EXPO_PUBLIC_PLAY_STORE_URL', productionUrl]] : []),
]) {
  warn(warnings, validate(env[key]), `Missing or non-production final value for ${key}.`);
}

for (const key of requiredPhase9EvidenceKeys()) {
  warn(warnings, evidenceFlagEnabled(env[key]), `Missing Phase 9 release evidence: ${key}=true.`);
}
warn(
  warnings,
  Boolean(normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY)),
  'Missing Phase 9 named signoff: PHASE9_SIGNED_OFF_BY.',
);

const claimedPhase9EvidenceKeys = requiredPhase9EvidenceKeys().filter((key) =>
  evidenceFlagEnabled(env[key]),
);
const claimedPhase9Signoff = Boolean(normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY));
const releaseCandidateDir = String(env.PHASE9_RELEASE_CANDIDATE_DIR ?? '')
  .replace(/\\/g, '/')
  .replace(/\/+$/g, '');
if (claimedPhase9EvidenceKeys.length > 0 || claimedPhase9Signoff) {
  let gitStatus = '';
  try {
    gitStatus = command('git', ['status', '--short']).trim();
  } catch {
    block(
      errors,
      false,
      'Current Git status could not be read for release-candidate verification.',
    );
  }
  block(
    errors,
    gitStatus.length === 0,
    'Phase 9 evidence/signoff claims require a clean Git worktree.',
  );

  block(
    errors,
    !placeholder(releaseCandidateDir),
    'PHASE9_RELEASE_CANDIDATE_DIR is required when any Phase 9 evidence or signoff is claimed.',
  );
  if (!placeholder(releaseCandidateDir)) {
    block(
      errors,
      /^docs\/phase-9\/release-candidates\/(?!_template(?:\/|$))[^/]+$/.test(releaseCandidateDir),
      'PHASE9_RELEASE_CANDIDATE_DIR must point to one immutable non-template folder under docs/phase-9/release-candidates/.',
    );

    const rcFileNames = [
      'manifest.md',
      'commands.md',
      'automated-verification.md',
      'manual-qa-matrix.md',
      'security-review.md',
      'privacy-review.md',
      'payments-review.md',
      'observability-review.md',
      'store-review-packet.md',
      'rollout-plan.md',
      'incident-plan.md',
      'signoff.md',
    ];
    const rcFiles = rcFileNames.map((file) => `${releaseCandidateDir}/${file}`);

    for (const file of rcFiles)
      block(errors, exists(file), `${file} is missing from claimed release-candidate evidence.`);

    for (const file of rcFiles) {
      if (!exists(file)) continue;
      block(
        errors,
        !/\b(?:TBD|BLOCKED)\b/.test(read(file)),
        `${file} must not contain TBD/BLOCKED placeholders when Phase 9 evidence is claimed.`,
      );
    }
    for (const name of rcFileNames) {
      const file = `${releaseCandidateDir}/${name}`;
      const templateFile = `docs/phase-9/release-candidates/_template/${name}`;
      if (!exists(file) || !exists(templateFile)) continue;
      block(
        errors,
        hash(file) !== hash(templateFile),
        `${file} must be customized from the RC template when Phase 9 evidence is claimed.`,
      );
    }

    const manifestPath = `${releaseCandidateDir}/manifest.md`;
    if (exists(manifestPath)) {
      const manifestSource = read(manifestPath);
      const manifestSha = markdownTableValue(manifestSource, 'Git SHA');
      let currentSha = '';
      try {
        currentSha = command('git', ['rev-parse', 'HEAD']).trim();
      } catch {
        block(
          errors,
          false,
          'Current Git SHA could not be read for release-candidate verification.',
        );
      }
      block(
        errors,
        /^[a-f0-9]{40}$/i.test(manifestSha),
        `${manifestPath} must contain a full 40-character Git SHA.`,
      );
      if (currentSha && /^[a-f0-9]{40}$/i.test(manifestSha)) {
        block(
          errors,
          manifestSha.toLowerCase() === currentSha.toLowerCase(),
          `${manifestPath} Git SHA must match the current commit (${currentSha}).`,
        );
      }
    }
  }
}

if (evidenceFlagEnabled(env.EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED)) {
  warn(
    warnings,
    productionDomain(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
    'Public links are enabled before final domain evidence.',
  );
}

const productionPhase7SurfaceEvidence = [
  {
    flag: 'EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED',
    label: 'Commerce',
    evidence: [
      'PHASE7_BRAND_READY',
      'PHASE7_CLINICAL_REVIEW_PASS',
      'PHASE7_CATALOG_BETA_IMPORT_PASS',
      'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
    ],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED',
    label: 'Community posting',
    evidence: [
      'PHASE7_CLINICAL_REVIEW_PASS',
      'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
      'PHASE7_BETA_DASHBOARD_READY',
    ],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_TREND_ENABLED',
    label: 'Trend insights',
    evidence: [
      'PHASE7_CLINICAL_REVIEW_PASS',
      'PHASE7_DEVICE_QA_PASS',
      'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
    ],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED',
    label: 'Cloud Ask',
    evidence: [
      'PHASE7_CLINICAL_REVIEW_PASS',
      'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
      'PHASE7_BETA_DASHBOARD_READY',
    ],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED',
    label: 'Widgets',
    evidence: ['PHASE7_DEVICE_QA_PASS', 'PHASE7_BETA_DASHBOARD_READY'],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED',
    label: 'Share cards',
    evidence: ['PHASE7_BRAND_READY', 'PHASE7_CLINICAL_REVIEW_PASS', 'PHASE7_DEVICE_QA_PASS'],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED',
    label: 'Goal-active recommendations',
    evidence: ['PHASE7_CLINICAL_REVIEW_PASS', 'PHASE7_CATALOG_BETA_IMPORT_PASS'],
  },
];

if (/^production$/i.test(env.EXPO_PUBLIC_APP_ENV ?? '')) {
  for (const surface of productionPhase7SurfaceEvidence) {
    if (!evidenceFlagEnabled(env[surface.flag])) continue;
    block(
      errors,
      productionDomain(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
      `Production ${surface.label} cannot be enabled before EXPO_PUBLIC_FINAL_BRAND_DOMAIN is final.`,
    );
    for (const key of surface.evidence) {
      block(
        errors,
        evidenceFlagEnabled(env[key]),
        `Production ${surface.label} requires ${key}=true.`,
      );
    }
    block(
      errors,
      Boolean(normalizeNamedSignoff(env.PHASE7_SIGNED_OFF_BY)),
      `Production ${surface.label} requires PHASE7_SIGNED_OFF_BY.`,
    );
  }
}

if (evidenceFlagEnabled(env.EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED)) {
  warn(
    warnings,
    evidenceFlagEnabled(env.PHASE7_CLINICAL_REVIEW_PASS),
    'Cloud Ask is enabled without clinical/legal release evidence.',
  );
}
if (evidenceFlagEnabled(env.EXPO_PUBLIC_NATIVE_OCR_ENABLED)) {
  warn(
    warnings,
    evidenceFlagEnabled(env.PHASE5_DEVICE_QA_PASS),
    'Native OCR is enabled without native device QA evidence.',
  );
}
if (env.EXPO_PUBLIC_APP_ENV === 'production') {
  warn(
    warnings,
    !placeholder(env.TURNSTILE_SECRET_KEY),
    'Production public forms require TURNSTILE_SECRET_KEY.',
  );
}
if (!placeholder(env.SHOPMY_BRAND_API_KEY)) {
  block(
    errors,
    !placeholder(env.ORDER_REPORT_POLL_SECRET),
    'ORDER_REPORT_POLL_SECRET is required when SHOPMY_BRAND_API_KEY is configured.',
  );
}
block(
  errors,
  integerInRange(env.PUBLIC_FORMS_RATE_LIMIT_MAX, 1, 1000),
  'PUBLIC_FORMS_RATE_LIMIT_MAX must be an integer from 1 to 1000.',
);
block(
  errors,
  integerInRange(env.PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS, 60, 86400),
  'PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS must be an integer from 60 to 86400.',
);
block(
  errors,
  integerInRange(env.PUBLIC_FORMS_MAX_BYTES, 1024, 65536),
  'PUBLIC_FORMS_MAX_BYTES must be an integer from 1024 to 65536.',
);
block(
  errors,
  integerInRange(env.PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX, 2, 1100),
  'PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX must be an integer from 2 to 1100.',
);
block(
  errors,
  Number(env.PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX) > Number(env.PUBLIC_FORMS_RATE_LIMIT_MAX),
  'PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX must be greater than PUBLIC_FORMS_RATE_LIMIT_MAX.',
);
block(
  errors,
  integerInRange(env.CATALOG_RATE_LIMIT_MAX, 1, 1000),
  'CATALOG_RATE_LIMIT_MAX must be an integer from 1 to 1000.',
);
block(
  errors,
  integerInRange(env.CATALOG_RATE_LIMIT_WINDOW_SECONDS, 60, 86400),
  'CATALOG_RATE_LIMIT_WINDOW_SECONDS must be an integer from 60 to 86400.',
);
block(
  errors,
  integerInRange(env.USER_EDGE_BODY_MAX_BYTES, 1024, 65536),
  'USER_EDGE_BODY_MAX_BYTES must be an integer from 1024 to 65536.',
);
block(
  errors,
  integerInRange(env.EDGE_EXTERNAL_FETCH_TIMEOUT_MS, 1000, 30000),
  'EDGE_EXTERNAL_FETCH_TIMEOUT_MS must be an integer from 1000 to 30000.',
);
block(
  errors,
  integerInRange(env.EDGE_EXTERNAL_RESPONSE_MAX_BYTES, 1024, 1048576),
  'EDGE_EXTERNAL_RESPONSE_MAX_BYTES must be an integer from 1024 to 1048576.',
);
block(
  errors,
  integerInRange(env.DATA_EXPORT_RATE_LIMIT_MAX, 1, 100),
  'DATA_EXPORT_RATE_LIMIT_MAX must be an integer from 1 to 100.',
);
block(
  errors,
  integerInRange(env.DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS, 60, 86400),
  'DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS must be an integer from 60 to 86400.',
);
block(
  errors,
  integerInRange(env.DATA_EXPORT_PHOTO_URL_TTL_SECONDS, 60, 3600),
  'DATA_EXPORT_PHOTO_URL_TTL_SECONDS must be an integer from 60 to 3600.',
);
block(
  errors,
  integerInRange(env.PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX, 2, 110),
  'PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX must be an integer from 2 to 110.',
);
block(
  errors,
  Number(env.PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX) > Number(env.DATA_EXPORT_RATE_LIMIT_MAX),
  'PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX must be greater than DATA_EXPORT_RATE_LIMIT_MAX.',
);
block(
  errors,
  ['true', 'false'].includes(String(env.PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK)),
  'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK must be true or false.',
);
block(
  errors,
  integerInRange(env.PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS, 0, 3900),
  'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS must be an integer from 0 to 3900.',
);
if (env.PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK === 'true') {
  block(
    errors,
    Number(env.DATA_EXPORT_PHOTO_URL_TTL_SECONDS) <= 120,
    'DATA_EXPORT_PHOTO_URL_TTL_SECONDS must be 120 or lower when signed URL expiry evidence is enabled.',
  );
  block(
    errors,
    Number(env.PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS) >
      Number(env.DATA_EXPORT_PHOTO_URL_TTL_SECONDS),
    'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS must be greater than DATA_EXPORT_PHOTO_URL_TTL_SECONDS when expiry evidence is enabled.',
  );
}
block(
  errors,
  integerInRange(env.PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX, 2, 1100),
  'PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX must be an integer from 2 to 1100.',
);
block(
  errors,
  Number(env.PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX) > Number(env.CATALOG_RATE_LIMIT_MAX),
  'PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX must be greater than CATALOG_RATE_LIMIT_MAX.',
);
block(
  errors,
  integerInRange(env.REVENUECAT_WEBHOOK_MAX_BYTES, 1024, 262144),
  'REVENUECAT_WEBHOOK_MAX_BYTES must be an integer from 1024 to 262144.',
);

if (env.PHASE9_RUN_LIVE_SUPABASE_CHECK === 'true') {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    const response = await fetch(`${url.replace(/\/+$/g, '')}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    block(errors, response.ok, `Supabase connectivity check failed with ${response.status}.`);
  } catch (error) {
    block(
      errors,
      false,
      `Supabase connectivity check failed: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
} else {
  warn(
    warnings,
    false,
    'Live Supabase connectivity check not run; set PHASE9_RUN_LIVE_SUPABASE_CHECK=true for RC evidence.',
  );
}

if (!androidReleaseRequired) {
  console.log(
    'N/A Android build, Play testing, Play packet, and Play Store URL evidence: excluded by launch contract.',
  );
}
printResult('Phase 9 release smoke', errors, warnings);
