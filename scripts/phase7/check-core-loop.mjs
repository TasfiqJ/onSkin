#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  evidenceFlagEnabled,
  normalizeNamedSignoff,
  productionDomain,
  productionUrl,
} from '../phase9/lib.mjs';
import {
  isSurfaceRequired,
  loadLaunchContract,
  REQUIRED_SURFACE_KEYS,
} from '../launch/contract.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const launchContract = loadLaunchContract(root);
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

for (const surface of REQUIRED_SURFACE_KEYS) {
  require(isSurfaceRequired(
    surface,
    launchContract,
  ), `Launch contract must keep required Phase 7/8 surface ${surface}.`);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function has(path, pattern) {
  return pattern.test(read(path));
}

function hasSelfClosingJsxWithProps(source, component, propPatterns) {
  const tags = source.match(new RegExp(`<${component}\\b[\\s\\S]*?\\/\\s*>`, 'g')) ?? [];
  return tags.some((tag) => propPatterns.every((pattern) => pattern.test(tag)));
}

const exampleEnv = parseEnv(read('.env.example'));
const localEnv = envFile('.env');
const launchEnv = { ...exampleEnv, ...localEnv, ...process.env };

const requiredFiles = [
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
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

require(has(
  'apps/mobile/src/lib/env.ts',
  /phase7CommerceEnabled/,
), 'env.ts is missing Phase 7 commerce flag.');
require(has(
  'apps/mobile/src/lib/env.ts',
  /phase7ReviewedConflictSharingEnabled/,
), 'env.ts is missing reviewed conflict sharing flag.');
require(has(
  'apps/mobile/src/lib/launch/phase7.ts',
  /canShareConflictCard/,
), 'phase7.ts is missing share-card eligibility helper.');
require(has(
  'apps/mobile/src/lib/launch/phase7.ts',
  /finalDomainReady/,
), 'phase7.ts must require a final brand domain for launch-sensitive surfaces.');
require(has(
  'apps/mobile/src/lib/launch/phase7.ts',
  /productionSurfaceReady/,
), 'phase7.ts must fail closed for production deferred surfaces.');
require(has(
  'apps/mobile/src/lib/launch/phase7.ts',
  /phase7Capabilities\s*=\s*Object\.freeze\([\s\S]*communityQuestionSubmission:\s*false[\s\S]*communityAggregates:\s*false[\s\S]*trendEngine:\s*false[\s\S]*nativeWidgets:\s*false/,
), 'phase7.ts must keep unimplemented community, Trend, and native-widget capabilities non-environment-driven.');
const qaPacketBuilder = read('scripts/phase7/build-core-loop-qa-packet.mjs');
const humanE2eManifestBuilder = read('scripts/e2e/human-e2e-manifest.mjs');
require(/function gitStatusExcludingGeneratedPacket\(\)/.test(qaPacketBuilder) &&
  /core-loop-qa-packet\.json/.test(qaPacketBuilder) &&
  /core-loop-qa-packet\.md/.test(qaPacketBuilder) &&
  /gitStatus = gitStatusExcludingGeneratedPacket\(\)/.test(
    qaPacketBuilder,
  ), 'Phase 7 core-loop QA packet must ignore only its own generated outputs when recording Git status.');
require(/Phase 7 core-loop QA packet generated with a dirty Git worktree/.test(qaPacketBuilder) &&
  /Git status: \$\{packet\.gitStatus \? 'DIRTY' : 'clean'\}/.test(
    qaPacketBuilder,
  ), 'Phase 7 core-loop QA packet must warn on dirty worktrees and expose Git status in Markdown.');
for (const file of [
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  'package.json',
  'apps/mobile/src/app/cycle/settings.tsx',
  'apps/mobile/src/app/cycle/week.tsx',
  'apps/mobile/src/app/cycle/why-tonight.tsx',
  'apps/mobile/src/app/routine/plan.tsx',
  'apps/mobile/src/features/scheduler/cadence.ts',
  'apps/mobile/src/features/scheduler/customCycle.ts',
  'apps/mobile/src/features/scheduler/customCycle.test.ts',
  'apps/mobile/src/features/scheduler/cycleStore.ts',
  'apps/mobile/src/features/scheduler/cycleStore.test.ts',
  'apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts',
  'apps/mobile/src/features/scheduler/orchestrate.ts',
  'apps/mobile/src/features/scheduler/orchestrate.test.ts',
  'apps/mobile/src/features/scheduler/useCycle.ts',
  'apps/mobile/src/features/today/cycleCompletion.ts',
  'apps/mobile/src/features/today/cycleCompletion.test.ts',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
  'apps/mobile/src/components/launch/DeferredSurface.tsx',
  'apps/mobile/src/components/launch/DeferredSurface.test.ts',
  'apps/mobile/src/lib/navigation/safeBack.ts',
  'apps/mobile/src/lib/navigation/safeBack.test.ts',
  'apps/mobile/src/app/trend/_layout.tsx',
  'apps/mobile/src/app/trend/fairness.tsx',
  'apps/mobile/src/app/trend/optin.tsx',
  'apps/mobile/src/features/trend/copy.ts',
  'apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts',
  'apps/mobile/src/features/trend/trendRoutes.test.ts',
  'apps/mobile/src/features/trend/useTrend.ts',
  'scripts/phase7/build-core-loop-qa-packet.mjs',
  'scripts/phase7/check-core-loop.mjs',
  'scripts/phase7/check-core-loop-smoke.mjs',
  'scripts/e2e/human-e2e-manifest.mjs',
  'scripts/phase9/lib.mjs',
  'docs/HUMAN_SIMULATED_E2E_TESTING.md',
  'docs/E2E_TESTING_CHECKLIST.md',
  'docs/USER_FLOW_TREE.md',
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
  'docs/phase-5/generated/device-qa-packet.json',
  'docs/phase-5/generated/device-qa-packet.md',
  'docs/phase-6/generated/payments-qa-packet.json',
  'docs/phase-6/generated/payments-qa-packet.md',
  'docs/phase-7/core-loop-qa-checklist.md',
  'docs/phase-7/phase-7-exit-review.md',
]) {
  require(qaPacketBuilder.includes(`'${file}'`) ||
    qaPacketBuilder.includes(`"${file}"`), `Phase 7 core-loop QA packet must hash ${file}.`);
}
require(/id: 'authored-cycle-customization-supported-phone'/.test(humanE2eManifestBuilder) &&
  /cycle-customization-current/.test(
    humanE2eManifestBuilder,
  ), 'The human E2E manifest must require authored-cycle customization evidence.');
require(/id: 'shelf-freshness-provenance-supported-phone'/.test(humanE2eManifestBuilder) &&
  /shelf-freshness-provenance-current/.test(
    humanE2eManifestBuilder,
  ), 'The human E2E manifest must require Shelf freshness and replacement provenance evidence.');
require(has(
  'apps/mobile/src/lib/launch/phase7.test.ts',
  /keeps production Phase 7 surfaces disabled without a final brand domain/,
) &&
  has(
    'apps/mobile/src/lib/launch/phase7.test.ts',
    /keeps unimplemented capabilities closed even when staging flags are enabled/,
  ), 'phase7.test.ts must cover production identity gates and non-bypassable unavailable capabilities.');

const gatedRoutes = [
  ['apps/mobile/src/app/commerce/_layout.tsx', /phase7Flags\.commerce/, 'commerce route group'],
  ['apps/mobile/src/app/trend/_layout.tsx', /phase7Flags\.trend/, 'trend route group'],
];
for (const [path, pattern, label] of gatedRoutes) {
  require(has(path, /DeferredSurface/), `${label} must render DeferredSurface when gated.`);
  require(has(path, pattern), `${label} is missing its Phase 7 flag check.`);
}

for (const [path, surface, label] of [
  ['apps/mobile/src/app/community/ask.tsx', 'communityPosting', 'community ask screen'],
  [
    'apps/mobile/src/app/community/people-like-you.tsx',
    'communityPosting',
    'people-like-you screen',
  ],
  ['apps/mobile/src/app/trend/optin.tsx', 'trend', 'trend opt-in screen'],
  ['apps/mobile/src/app/routine/widgets.tsx', 'widgets', 'widgets screen'],
]) {
  const source = read(path);
  require(/DeferredSurface/.test(source), `${label} must remain a deferred surface.`);
  require(source.includes(`surface="${surface}"`), `${label} must use truthful deferred copy.`);
}

const communityAsk = read('apps/mobile/src/app/community/ask.tsx');
const communityAggregate = read('apps/mobile/src/app/community/people-like-you.tsx');
const trendOptIn = read('apps/mobile/src/app/trend/optin.tsx');
const widgetsRoute = read('apps/mobile/src/app/routine/widgets.tsx');
const routineLayout = read('apps/mobile/src/app/routine/_layout.tsx');
const routineGatedRoutes = read('apps/mobile/src/features/subscription/gatedRoutes.ts');
const subscriptionCopy = read('apps/mobile/src/features/subscription/copy.ts');
require(!/question_submitted|grantCommunityConsent|confirmCommunityAge|TextInput/.test(
  communityAsk,
), 'Unavailable community posting must not collect consent, accept text, or emit submission analytics.');
require(!/dry, sensitive|alternate-night cycling|Aggregated & anonymised/.test(
  communityAggregate,
), 'People-like-you must not render illustrative aggregate data as real.');
require(!/grantTrendInsightsConsent|revokeTrendInsightsConsent|setTrendInsightsLocal|ToggleSwitch/.test(
  trendOptIn,
), 'Unavailable Trend must not solicit or persist engine consent.');
for (const path of [
  'apps/mobile/src/app/trend/_layout.tsx',
  'apps/mobile/src/app/trend/optin.tsx',
  'apps/mobile/src/app/trend/fairness.tsx',
]) {
  require(hasSelfClosingJsxWithProps(read(path), 'DeferredSurface', [
    /fallbackRoute=\{APP_PROGRESS_ROUTE\}/,
    /fallbackLabel="Back to Progress"/,
    /fallbackBehavior="replace"/,
  ]), `${path} must replace to Progress instead of following stale navigation history.`);
}
require(!/Check it off right from the home screen|Show on the Lock Screen|ToggleSwitch/.test(
  widgetsRoute,
) &&
  !/withProGate|<ProGate/.test(widgetsRoute) &&
  /if \(routeName === 'widgets'\) return null/.test(routineGatedRoutes) &&
  /if \(!gateFeature\) return stack/.test(routineLayout) &&
  !/home-screen widgets|glanceable widgets/.test(
    subscriptionCopy,
  ), 'Unavailable native widgets and Live Activities must bypass paywalls and not appear as working claims.');

const askLayout = read('apps/mobile/src/app/ask/_layout.tsx');
const askConsent = read('apps/mobile/src/app/ask/consent.tsx');
require(/<Stack screenOptions=\{\{ headerShown: false \}\} \/>/.test(askLayout) &&
  !/phase7Flags\.cloudAsk|DeferredSurface/.test(
    askLayout,
  ), 'Deterministic Ask route group must stay reachable while cloud Ask is deferred.');
require(/if \(!phase7Flags\.cloudAsk\)/.test(askConsent) &&
  hasSelfClosingJsxWithProps(askConsent, 'DeferredSurface', [
    /surface="cloudAsk"/,
    /fallbackRoute=\{APP_ASK_ROUTE\}/,
    /fallbackLabel="Back to Ask"/,
  ]), 'Cloud Ask consent route must render DeferredSurface when gated.');
require(has(
  'apps/mobile/src/app/(tabs)/today.tsx',
  /phase7Flags\.cloudAsk[\s\S]{0,120}<AskTeaser/,
), 'Today must hide AskTeaser unless cloud Ask is enabled.');
require(has(
  'apps/mobile/src/app/(tabs)/progress.tsx',
  /phase7Flags\.trend[\s\S]*<TrendInsight/,
), 'Progress must hide TrendInsight unless trend is enabled.');
require(has(
  'apps/mobile/src/app/progress/about.tsx',
  /phase7Flags\.trend[\s\S]*trend\/optin/,
), 'Progress no-score explainer must hide trend opt-in unless trend is enabled.');
require(has('apps/mobile/src/features/commerce/WhereToBuy.tsx', /phase7Flags\.commerce/) &&
  has(
    'apps/mobile/src/features/commerce/WhereToBuy.tsx',
    /EnabledWhereToBuy/,
  ), 'WhereToBuy must be hidden behind the commerce flag without conditional hooks.');
require(has('apps/mobile/src/app/(tabs)/you.tsx', /phase7Flags\.widgets/) &&
  has('apps/mobile/src/app/(tabs)/you.tsx', /phase7Flags\.cloudAsk/) &&
  has('apps/mobile/src/app/(tabs)/you.tsx', /phase7Flags\.commerce/) &&
  has(
    'apps/mobile/src/app/(tabs)/you.tsx',
    /phase7Flags\.trend/,
  ), 'You tab must gate widgets, cloud Ask, commerce, and trend entry points.');

const shareRoute = read('apps/mobile/src/app/share/conflict/[ruleId].tsx');
require(/phase7Flags\.shareCard/.test(
  shareRoute,
), 'Share route must be gated by phase7Flags.shareCard.');
require(/canShareConflictCard/.test(shareRoute), 'Share route must require canShareConflictCard.');
require(!/\?\?\s*data\?\.conflicts\[0\]/.test(
  shareRoute,
), 'Share route must not fallback to the first conflict.');
require(/share_card_exported/.test(shareRoute), 'Share route must track share_card_exported.');
require(/share_sheet_opened/.test(shareRoute), 'Share route must track share_sheet_opened.');
require(has(
  'apps/mobile/src/app/conflict/[ruleId].tsx',
  /canShareConflictCard/,
), 'Conflict sheet must hide share launcher unless share card is eligible.');

const analyticsRegistry = read('apps/mobile/src/lib/analytics/eventRegistry.ts');
const shelfTab = read('apps/mobile/src/app/(tabs)/shelf.tsx');
const onboardingProducts = read('apps/mobile/src/app/onboarding/products.tsx');
const routinePlan = read('apps/mobile/src/app/routine/plan.tsx');
const routineActivationAnalytics = read('apps/mobile/src/features/routine/activationAnalytics.ts');
const routineActivationAnalyticsTest = read(
  'apps/mobile/src/features/routine/activationAnalytics.test.ts',
);
const routineGenerate = read('apps/mobile/src/features/routine/generate.ts');
const routineGenerateTest = read('apps/mobile/src/features/routine/generate.test.ts');
const routineReviewGateTest = read('apps/mobile/src/features/routine/reviewGate.test.ts');
const schedulerOrchestrateTest = read('apps/mobile/src/features/scheduler/orchestrate.test.ts');
const todayTab = read('apps/mobile/src/app/(tabs)/today.tsx');
const progressReview = read('apps/mobile/src/app/progress/review.tsx');
const shelfMutations = read('apps/mobile/src/features/shelf/mutations.ts');
const betaDashboard = read('docs/phase-7/beta-evidence-dashboard.md');
const coreLoopEvents = [
  'product_add_started',
  'product_added',
  'routine_plan_viewed',
  'routine_created',
  'first_useful_insight',
  'conflict_detected',
  'routine_checkoff_completed',
  'first_checkoff_completed',
  'cycle_night_completed',
  'photo_baseline_added',
  'photo_captured',
  'paywall_shown',
  'reverse_trial_started',
  'purchase_completed',
];

for (const event of coreLoopEvents) {
  require(analyticsRegistry.includes(
    `'${event}'`,
  ), `Analytics registry is missing V1 core-loop event: ${event}.`);
  require(betaDashboard.includes(
    `\`${event}\``,
  ), `Phase 7 beta dashboard must reference emitted event: ${event}.`);
}

require(/track\('product_added'/.test(
  shelfMutations,
), 'Shelf add flow must emit product_added for product-add activation.');
require(/trackProductAddStarted/.test(shelfTab) &&
  /trackProductAddStarted/.test(
    onboardingProducts,
  ), 'Shelf and onboarding entry points must emit product_add_started for product-add drop-off analysis.');
require(/recordRoutinePlanAnalytics/.test(routinePlan) &&
  /routineStepCount/.test(routinePlan) &&
  /track\('routine_plan_viewed'/.test(routineActivationAnalytics) &&
  /track\('routine_created'/.test(routineActivationAnalytics) &&
  /const hasRoutineSteps = routineStepCount > 0;/.test(routineActivationAnalytics) &&
  /if \(hasRoutineSteps\) \{\s*track\('routine_created'/.test(routineActivationAnalytics) &&
  /async function reserveFirstEvents/.test(routineActivationAnalytics) &&
  /await updatePrivateItem\(KEY/.test(routineActivationAnalytics) &&
  /if \(input\.routineCreated && !current\.firstRoutineCreated\)/.test(
    routineActivationAnalytics,
  ) &&
  /routineCreated: hasRoutineSteps/.test(routineActivationAnalytics) &&
  /if \(reserved\.firstRoutineCreated\)/.test(routineActivationAnalytics) &&
  /does not count a real plan with no executable steps as routine creation/.test(
    routineActivationAnalyticsTest,
  ) &&
  /serializes simultaneous first-insight reservations/.test(routineActivationAnalyticsTest) &&
  /does not emit a first event when its durable reservation fails/.test(
    routineActivationAnalyticsTest,
  ) &&
  /track\('first_useful_insight'/.test(routineActivationAnalytics) &&
  /track\('conflict_detected'/.test(
    routinePlan,
  ), 'Routine plan must emit routine_plan_viewed, reserve routine_created for real plans with executable steps, and emit first_useful_insight plus conflict_detected.');
require(/done[\s\S]{0,160}track\('routine_checkoff_completed'/.test(todayTab) &&
  /firstEver[\s\S]{0,80}track\('first_checkoff_completed'/.test(
    todayTab,
  ), 'Today check-off flow must emit routine_checkoff_completed and first_checkoff_completed.');
require(/shippableRules\(\)/.test(routineGenerate) &&
  /canUseRoutineCadence\(\)/.test(routineGenerate) &&
  /does not surface unreviewed conflict guidance through the default production generator/.test(
    routineGenerateTest,
  ) &&
  /surfaces reviewed conflict guidance when production rules are reviewed/.test(
    routineGenerateTest,
  ) &&
  /withDevFlag\(false/.test(routineGenerateTest) &&
  /withholds cadence outside dev until clinical review flips the gate/.test(
    routineReviewGateTest,
  ) &&
  /does not let the E2E fixture open unreviewed cadence outside dev/.test(routineReviewGateTest) &&
  /withholds unreviewed cycle cadence in production until B-DERM-REVIEW closes/.test(
    schedulerOrchestrateTest,
  ), 'Phase 7 must pin production-mode tests that withhold unreviewed conflict and routine-cadence guidance until B-DERM-REVIEW closes.');
require(/shouldTrackCycleNightCompleted/.test(todayTab) &&
  /track\('cycle_night_completed', \{ moment: 'pm', source: 'today' \}/.test(
    todayTab,
  ), 'Today PM check-off flow must emit privacy-safe cycle_night_completed when a cycle night is completed.');
require(/wasEmpty[\s\S]{0,140}track\('first_photo_captured'/.test(progressReview) &&
  /wasEmpty[\s\S]{0,180}track\('photo_baseline_added'/.test(
    progressReview,
  ), 'Progress baseline save must emit first_photo_captured and photo_baseline_added.');
require(!/shelf_product_added|conflict_opened/.test(
  betaDashboard,
), 'Phase 7 beta dashboard contains stale non-emitted core-loop event names.');

warn(
  productionDomain(launchEnv.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
  'Missing final brand domain: EXPO_PUBLIC_FINAL_BRAND_DOMAIN.',
);
for (const key of [
  'EXPO_PUBLIC_PRIVACY_URL',
  'EXPO_PUBLIC_TERMS_URL',
  'EXPO_PUBLIC_SUPPORT_URL',
  'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
  'EXPO_PUBLIC_DATA_EXPORT_URL',
  'EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL',
]) {
  warn(productionUrl(launchEnv[key]), `${key} must be a real production URL.`);
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
  warn(
    !/PLACEHOLDER|placeholder|B-PRIVACY-COPY/i.test(read(file)),
    `${file} still contains placeholder privacy/consent copy.`,
  );
}

warn(
  !/reviewedBy:\s*null/.test(read('apps/mobile/src/features/intelligence/rules.ts')),
  'Starter conflict rules still have reviewedBy: null.',
);
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
  'PHASE7_ONBOARDING_CONSENT_QA_PASS',
  'PHASE7_SHELF_INTAKE_QA_PASS',
  'PHASE7_REVIEWED_GUIDANCE_QA_PASS',
  'PHASE7_ROUTINE_BUILDER_QA_PASS',
  'PHASE7_TODAY_CHECKOFF_QA_PASS',
  'PHASE7_PHOTOS_PRIVACY_QA_PASS',
  'PHASE7_REMINDERS_QA_PASS',
  'PHASE7_PAYMENTS_LIFECYCLE_QA_PASS',
  'PHASE7_PRIVACY_CONTROLS_QA_PASS',
  'PHASE7_SHARE_CARD_QA_PASS',
  'PHASE7_DEFERRED_SURFACES_QA_PASS',
  'PHASE7_ANALYTICS_QA_PASS',
];
for (const key of externalEvidence) {
  warn(evidenceFlagEnabled(process.env[key]), `Missing external Phase 7 evidence: ${key}=true.`);
}
warn(
  Boolean(normalizeNamedSignoff(process.env.PHASE7_SIGNED_OFF_BY)),
  'Missing external Phase 7 evidence: PHASE7_SIGNED_OFF_BY.',
);

console.log('Phase 7 core-loop launch check');
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`FAIL ${error}`);

if (errors.length > 0) {
  console.error(
    `\nPhase 7 core loop has ${errors.length} blocker${errors.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

if (warnings.length > 0 && strict) {
  console.error(
    `\nPhase 7 strict mode failed on ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log(
  '\nPhase 7 code gates are present. Strict launch still requires warning-free evidence.',
);
