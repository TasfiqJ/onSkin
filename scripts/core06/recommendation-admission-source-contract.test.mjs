#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const paths = Object.freeze({
  packageJson: 'package.json',
  admission: 'apps/mobile/src/features/recommendations/admission.ts',
  admissionTest: 'apps/mobile/src/features/recommendations/admission.test.ts',
  goalAdmission: 'apps/mobile/src/features/recommendations/goalAdmission.ts',
  goalAdmissionTest: 'apps/mobile/src/features/recommendations/goalAdmission.test.ts',
  goalProvenance: 'apps/mobile/src/features/recommendations/goalProvenance.ts',
  catalog: 'apps/mobile/src/features/recommendations/catalog.ts',
  recommendationCopy: 'apps/mobile/src/features/recommendations/copy.ts',
  engine: 'apps/mobile/src/features/recommendations/engine.ts',
  engineTest: 'apps/mobile/src/features/recommendations/engine.test.ts',
  fit: 'apps/mobile/src/features/recommendations/fit.ts',
  fragrance: 'apps/mobile/src/features/recommendations/fragrance.ts',
  preferences: 'apps/mobile/src/features/recommendations/preferences.ts',
  recommendationStore: 'apps/mobile/src/features/recommendations/store.ts',
  healthProcessingEpoch: 'apps/mobile/src/lib/consent/healthProcessingEpoch.ts',
  healthDataWriteAdmission: 'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts',
  privateKV: 'apps/mobile/src/lib/storage/privateKV.ts',
  recommendationLoading: 'apps/mobile/src/features/recommendations/loading.ts',
  useRecommendations: 'apps/mobile/src/features/recommendations/useRecommendations.ts',
  recommendationHub: 'apps/mobile/src/app/recommendations/index.tsx',
  recommendationPreferencesScreen: 'apps/mobile/src/app/recommendations/preferences.tsx',
  profile: 'apps/mobile/src/features/scheduler/profile.ts',
  whereToBuy: 'apps/mobile/src/features/commerce/WhereToBuy.tsx',
  recommendationDetail: 'apps/mobile/src/app/recommendations/[id].tsx',
  recommendationTeaser: 'apps/mobile/src/features/recommendations/RecommendationsTeaser.tsx',
  sentry: 'apps/mobile/src/lib/observability/sentry.ts',
  observabilityScrub: 'apps/mobile/src/lib/observability/scrub.ts',
  phase7: 'apps/mobile/src/lib/launch/phase7.ts',
  launchContract: 'docs/hugeToDo/launch-contract.json',
  launchContractSource: 'scripts/launch/contract.mjs',
  migration: 'supabase/migrations/20260726000071_recommendation_zero_admission.sql',
  databaseContract: 'supabase/tests/database/recommendation_zero_admission.test.sql',
  upgradeContract: 'supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql',
  databaseRunner: 'scripts/phase9/recommendation-zero-admission-smoke.mjs',
  reviewPacketBuilder: 'scripts/phase3/build-review-packet.mjs',
  checkpoint: 'docs/hugeToDo/CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26.md',
  recommendationDoc: 'docs/09-personalized-recommendations.md',
  architecture: 'docs/ARCHITECTURE.md',
  decisions: 'docs/DECISIONS.md',
  userFlow: 'docs/USER_FLOW_TREE.md',
  todoIndex: 'docs/hugeToDo/README.md',
});

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
}

function walk(directory) {
  const absolute = resolve(root, directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(absolute, entry.name);
    if (entry.isDirectory()) return walk(relative(root, entryPath));
    return [relative(root, entryPath).replaceAll('\\', '/')];
  });
}

function productionMobileSources() {
  return walk('apps/mobile/src').filter(
    (path) =>
      ['.ts', '.tsx'].includes(extname(path)) &&
      !/(?:^|\/)__tests__(?:\/|$)/u.test(path) &&
      !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path),
  );
}

function assertIncludesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing ${value}.`);
  }
}

function bounded(text, start, end) {
  const startIndex = text.indexOf(start);
  assert.ok(startIndex >= 0, `missing section start: ${start}`);
  const endIndex = text.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `missing section end after ${start}: ${end}`);
  return text.slice(startIndex, endIndex);
}

test('product-specific recommendation admission is a literal zero-product boundary', () => {
  const admission = read(paths.admission);
  const admissionTest = read(paths.admissionTest);
  const intake = bounded(
    admission,
    'export function admitCatalogRecommendationCandidates',
    'export type TypeFirstRecommendationProvenance',
  );

  assert.match(
    admission,
    /export const PRODUCT_SPECIFIC_MODE:\s*ProductSpecificMode\s*=\s*['"]closed['"]/u,
  );
  assert.match(intake, /admittedCatalogProducts:\s*\[\s*\]/u);
  assert.match(intake, /reasonCode:\s*['"]product_specific_mode_closed['"]/u);
  assert.doesNotMatch(
    intake,
    /catalogProductId|admissionReceiptId|recommendation_eligible|reviewedBy/u,
    'closed candidate intake must not inspect fields that could become a weaker admission path',
  );
  assertIncludesAll(
    admission,
    [
      'product_specific_mode_closed',
      'candidate_envelope_invalid',
      'catalog_provenance_invalid',
      'catalog_quality_not_cleared',
      'catalog_review_not_cleared',
    ],
    'closed admission reason vocabulary',
  );
  assert.match(admissionTest, /admits zero catalog products for %s input/u);
  assert.match(admissionTest, /rejects every member of a candidate array/u);
});

test('current recommendation provenance is type-first or Shelf-context only', () => {
  const admission = read(paths.admission);
  const engine = read(paths.engine);
  const detail = read(paths.recommendationDetail);

  assert.match(
    admission,
    /export type RecommendationProvenance\s*=[\s\S]*?TypeFirstRecommendationProvenance[\s\S]*?ShelfContextRecommendationProvenance[\s\S]*?CatalogProductRecommendationProvenance/u,
  );
  assert.match(admission, /kind:\s*['"]type_first['"]/u);
  assert.match(admission, /kind:\s*['"]shelf_context['"]/u);
  assert.match(engine, /\bprovenance:\s*RecommendationProvenance/u);
  assert.match(engine, /provenance:\s*typeFirstProvenance\(type\.type\)/u);
  assert.match(engine, /provenance:\s*shelfContextProvenance\(item\.id\)/u);
  assert.match(engine, /provenance:\s*shelfContextProvenance\(topConflict\.productBId\)/u);
  assert.match(detail, /<WhereToBuy\s+provenance=\{rec\.provenance\}\s*\/>/u);

  const producers = productionMobileSources().flatMap((path) => {
    if (path === paths.admission) return [];
    const source = read(path);
    return /kind:\s*['"]catalog_product['"]/u.test(source) ? [path] : [];
  });
  assert.deepEqual(
    producers,
    [],
    `no current production source may mint catalog_product provenance:\n${producers.join('\n')}`,
  );
});

test('zero-product recommendation detail copy cannot claim a specific product', () => {
  const copy = read(paths.recommendationCopy);
  const detail = read(paths.recommendationDetail);

  assert.match(copy, /specificNote:\s*['"]No specific product is selected or offered\.['"]/u);
  assert.doesNotMatch(copy, /specific products,\s*ranked by fit/iu);
  assert.match(detail, /\{REC_COPY\.card\.specificNote\}/u);
  assertIncludesAll(
    detail,
    [
      'const recType = recTypeByKey(rec.productType);',
      'const presetCategory = recType ? ROLE_TO_CATEGORY[recType.role] : undefined;',
      "pathname: '/shelf/manual'",
      'params: { presetCategory }',
    ],
    'user-completed type-first acceptance path',
  );
  assert.doesNotMatch(detail, /pathname:\s*['"]\/shelf\/search['"]|catalogProductId/u);
});

test('runtime commerce admission rejects every current or forged provenance', () => {
  const admission = read(paths.admission);
  const admissionTest = read(paths.admissionTest);
  const guard = bounded(
    admission,
    'export function isAdmittedCatalogProductProvenance',
    'export function typeFirstProvenance',
  );
  const whereToBuy = read(paths.whereToBuy);

  assert.match(
    guard,
    /\):\s*_value is CatalogProductRecommendationProvenance\s*\{\s*return false;\s*\}/u,
  );
  assert.doesNotMatch(
    guard,
    /catalogProductId|admissionReceiptId|productType/u,
    'closed runtime commerce admission must not accept shape-only future authority',
  );
  assert.match(
    admissionTest,
    /never upgrades type-first, shelf-context, or forged catalog provenance to commerce/u,
  );
  assert.match(
    whereToBuy,
    /export function WhereToBuy\(_props:\s*\{\s*provenance:\s*unknown\s*\}\)\s*\{\s*return null;\s*\}/u,
  );
  assert.doesNotMatch(whereToBuy, /^import\s/mu);
  assert.doesNotMatch(
    whereToBuy,
    /EnabledWhereToBuy|useWhereToBuy|recordClick|openExternalHttpsUrl/u,
  );
});

test('goal-active output requires flag, consent, exact provenance, and positive review clearance', () => {
  const goal = read(paths.goalAdmission);
  const goalTest = read(paths.goalAdmissionTest);
  const goalProvenance = read(paths.goalProvenance);
  const profile = read(paths.profile);
  const useRecommendations = read(paths.useRecommendations);
  const engine = read(paths.engine);
  const catalog = read(paths.catalog);
  const hub = read(paths.recommendationHub);

  assert.match(
    goal,
    /CURRENT_GOAL_ACTIVE_REVIEW_CLEARANCE\s*=\s*Object\.freeze\(\{[\s\S]*?status:\s*['"]closed['"][\s\S]*?corpusSha256:\s*null[\s\S]*?admittedTypeCount:\s*0[\s\S]*?receiptIds:\s*Object\.freeze\(\[\s*\]/u,
  );
  assertIncludesAll(
    `${goal}\n${goalProvenance}`,
    [
      'phase7_goal_flag_closed',
      'health_consent_not_current',
      'goal_provenance_invalid',
      'goal_review_clearance_closed',
      'QUIZ_SCORING_PROVENANCE.contractId',
      'QUIZ_SCORING_PROVENANCE.contentSha256',
      'QUIZ_SCORING_PROVENANCE.scoringSha256',
      'QUIZ_SCORING_PROVENANCE.contractSha256',
      'profileCompletedAt',
    ],
    'goal admission',
  );
  assert.match(goal, /if\s*\(\s*!phase7Flags\.goalActiveRecommendations\s*\)/u);
  assert.match(goal, /if\s*\(\s*!input\.consentCurrent\s*\)/u);
  assert.match(goal, /isCurrentGoalRecommendationProvenance\(input\.provenance,\s*input\.goals\)/u);
  assert.match(profile, /goalProvenance\??:\s*GoalRecommendationProvenance\s*\|\s*null/u);
  assert.match(profile, /source:\s*['"]local_current_quiz['"]/u);
  assert.match(profile, /source:\s*['"]server_current_quiz['"]/u);
  assert.match(useRecommendations, /goalProvenance:\s*profile\.data\.goalProvenance/u);
  assert.match(
    engine,
    /goalActiveRecommendationAdmission\(\{[\s\S]*?consentCurrent:[\s\S]*?goals:[\s\S]*?provenance:\s*eligibleInput\.profile\.goalProvenance/u,
  );
  assert.match(
    engine,
    /const unaddressedGoals\s*=\s*eligibleInput\.profile\.goals\.filter\([\s\S]*?goalIsAddressedByShelf/u,
  );
  assert.match(
    engine,
    /if\s*\(\s*goalAdmission\.admitted\s*\)\s*\{\s*for\s*\(\s*const goal of unaddressedGoals/u,
  );
  assert.match(
    engine,
    /goalReviewPending\s*=\s*unaddressedGoals\.length\s*>\s*0\s*&&\s*!goalAdmission\.admitted/u,
  );
  assert.match(
    engine,
    /youreSet:[\s\S]*?ranked\.length\s*===\s*0[\s\S]*?conflictCoverageStatus\s*===\s*['"]compatible['"][\s\S]*?unaddressedGoals\.length\s*===\s*0/u,
  );
  assertIncludesAll(
    hub,
    [
      "result.conflictCoverageStatus === 'not_applicable'",
      'REC_COPY.noPairEvaluation.title',
      'REC_COPY.noCurrentSuggestion.title',
    ],
    'zero-result recommendation hub',
  );
  assert.doesNotMatch(catalog, /\breviewedBy\b\s*:/u);
  assert.doesNotMatch(catalog, /\b__DEV__\b/u);
  assert.match(goalTest, /requires the current Phase 7 flag, consent, exact goal provenance/u);
});

test('recommendation detection and ranking have no commerce import path', () => {
  const engine = read(paths.engine);
  const rankingSources = [
    paths.admission,
    paths.goalAdmission,
    paths.catalog,
    paths.engine,
    'apps/mobile/src/features/recommendations/fit.ts',
  ];
  const offenders = [];

  for (const path of rankingSources) {
    const source = read(path);
    if (/from\s+['"][^'"]*(?:commerce|affiliate|whereToBuy|WhereToBuy)[^'"]*['"]/iu.test(source)) {
      offenders.push(path);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `recommendation admission/ranking must not import commerce:\n${offenders.join('\n')}`,
  );

  const engineTest = read(paths.engineTest);
  assert.match(engineTest, /No commercial field exists in the ranking output/iu);
  for (const field of [
    'commission',
    'affiliate',
    'partnership',
    'brand_deal',
    'sponsor',
    'payout',
    'revenue',
  ]) {
    assert.ok(engineTest.includes(`'${field}'`), `ranking test must reject ${field}`);
  }

  const inputContract = bounded(engine, 'export type RecInput', 'export type RecHow');
  assert.doesNotMatch(
    inputContract,
    /\brecTypes\b/u,
    'production recommendation input must not accept caller-supplied type/copy rows',
  );
  assert.match(
    engine,
    /const recTypes = shippableRecTypes\(\);/u,
    'production scoring must use only the checked-in launch-gated type catalog',
  );
});

test('migration 0071 seals product recommendation admission and the legacy cache', () => {
  const migration = read(paths.migration);
  const admissionControl = bounded(
    migration,
    'create table private.recommendation_admission_control',
    'create or replace function private.guard_recommendation_admission_control',
  );
  const candidateView = bounded(
    migration,
    'create view public.recommendable_catalog_products',
    'comment on view public.recommendable_catalog_products',
  );

  assertIncludesAll(
    migration,
    [
      'private.recommendation_admission_control',
      "check (admission_state = 'closed')",
      "check (checkpoint = 'core06a_zero_admission')",
      "check (reason_code = 'reviewed_corpus_not_admitted')",
      'recommendation_admission_control_immutable',
      'RECOMMENDATION_ADMISSION_CONTROL_MIGRATION_OWNED',
      'products_recommendation_eligibility_closed',
      'recommendation_eligible := false',
      'RECOMMENDATION_CATALOG_VALIDATOR_PREDICATE_DRIFT',
      'catalog_launch_curation_record_is_valid_v0058',
      'catalog_launch_curation_campaign_record_validity',
      'public.recommendable_catalog_products',
      "control.admission_state = 'open'",
      'recommendations_catalog_product_closed',
      'check (catalog_product_id is null)',
      'recommendations_admission_control',
      'RECOMMENDATION_ADMISSION_CLOSED',
      'delete from public.recommendations;',
    ],
    '0071 zero-admission migration',
  );
  assert.match(admissionControl, /enable row level security/u);
  assert.match(admissionControl, /force row level security/u);
  assert.match(
    candidateView,
    /select\s+product\.id,\s+product\.name,\s+product\.brand,\s+product\.category,\s+product\.product_type,\s+product\.region,\s+product\.quality_grade,\s+product\.data_quality_score,\s+product\.ingredient_quality_score\s+from/u,
  );
  assert.doesNotMatch(
    candidateView,
    /select\s+(?:product\.)?\*/u,
    'the service-only candidate projection must not grow through SELECT *',
  );
  assert.match(
    migration,
    /revoke all on public\.recommendable_catalog_products[\s\S]*?grant select on public\.recommendable_catalog_products to service_role/u,
  );
  assert.match(
    migration,
    /revoke all on public\.recommendations[\s\S]*?from public,\s*anon,\s*authenticated,\s*service_role;[\s\S]*?grant select on public\.recommendations to authenticated,\s*service_role/u,
  );
  assert.match(
    migration,
    /revoke all on public\.recommendation_preferences[\s\S]*?from public,\s*anon,\s*authenticated,\s*service_role;[\s\S]*?grant select on public\.recommendation_preferences[\s\S]*?to authenticated,\s*service_role/u,
  );
  assert.match(migration, /public\.set_recommendation_preferences/u);
  assert.match(migration, /public\._assert_current_health_session\(v_user_id\)/u);
  assert.match(migration, /public\._assert_health_processing_active_locked\(v_user_id\)/u);
  assert.match(migration, /public\._account_access_allowed\(v_user_id\)/u);
});

test('the mobile preference mirror uses the exact closed-vocabulary owner RPC', () => {
  const preferences = read(paths.preferences);
  const recommendationCopy = read(paths.recommendationCopy);
  const engine = read(paths.engine);
  const fit = read(paths.fit);
  const store = read(paths.recommendationStore);
  const healthProcessingEpoch = read(paths.healthProcessingEpoch);
  const healthDataWriteAdmission = read(paths.healthDataWriteAdmission);
  const privateKV = read(paths.privateKV);
  const recommendationLoading = read(paths.recommendationLoading);
  const useRecommendations = read(paths.useRecommendations);
  const fragrance = read(paths.fragrance);
  const hub = read(paths.recommendationHub);
  const preferencesScreen = read(paths.recommendationPreferencesScreen);
  const migration = read(paths.migration);

  assert.match(
    preferences,
    /RECOMMENDATION_FORMATS\s*=\s*\[\s*['"]gel['"],\s*['"]cream['"],\s*['"]fluid['"],\s*['"]balm['"],\s*['"]oil['"]\s*\]\s*as const/u,
  );
  assert.match(
    store,
    /supabase\.rpc\(['"]set_recommendation_preferences['"],\s*\{\s*p_values_filters:\s*normalized\.values,\s*p_budget_band:\s*normalized\.budget,\s*p_format_prefs:\s*normalized\.formats,\s*\}\)/u,
  );
  assert.doesNotMatch(
    store,
    /\.from\(['"]recommendation_preferences['"]\)\s*\.\s*(?:insert|upsert|update|delete)/u,
    'mobile must not regain a direct recommendation_preferences DML lane',
  );
  assert.match(
    healthProcessingEpoch,
    /HEALTH_PROCESSING_POSTGREST_RPC_NAMES\s*=\s*\[[\s\S]*?['"]set_recommendation_preferences['"][\s\S]*?\]\s*as const/u,
    'the owner RPC must receive the current health-processing epoch through the exact transport allowlist',
  );
  assert.doesNotMatch(
    bounded(
      store,
      'export async function loadPreferences',
      'export async function savePreferences',
    ),
    /\bcatch\b/u,
    'an unreadable preference record must not collapse to defaults',
  );
  assert.doesNotMatch(
    bounded(
      store,
      'export async function loadDismissed',
      'export async function dismissRecommendation',
    ),
    /\bcatch\b/u,
    'an unreadable dismissal record must not collapse to an empty set',
  );
  assertIncludesAll(
    healthDataWriteAdmission,
    ["'layerwell.recDismissed.v1'", "'layerwell.recPrefs.v1'"],
    'recommendation health-purpose private keys',
  );
  assertIncludesAll(
    privateKV,
    [
      'const healthWriteLease = captureHealthPurposePrivateDataWriteLease(key);',
      'assertHealthDataWriteLease(healthWriteLease);',
      'return updatePrivateItemWithGuard(key, updater, assertHealthMutationCurrent);',
    ],
    'private-KV health-purpose write lease',
  );
  assert.match(
    store,
    /export async function dismissRecommendation[\s\S]*?await updatePrivateItem\(DISMISSED_KEY,/u,
    'dismissal writes must use the lease-enforcing private-KV update path',
  );
  assertIncludesAll(
    useRecommendations,
    [
      'isRecommendationDataUnavailable({',
      'prefsError: prefsQ.isError',
      'profileSource: profile.data?.source ?? null',
      'consentCurrent: profile.data?.consentCurrent ?? null',
      '!prefsQ.data || isUnavailable',
      'hasExplicitFragranceMarker(i.product)',
    ],
    'recommendation input availability boundary',
  );
  assert.match(
    fragrance,
    /\(\?:fragrance\|parfum\|perfume\)\[ -\]\?free/u,
    'fragrance-free wording must not be inverted into a fragrance marker',
  );
  assertIncludesAll(
    recommendationCopy,
    [
      'Your saved shelf details include a fragrance marker for',
      'A fragrance-free option may be worth considering.',
    ],
    'truthful shelf-derived fragrance copy',
  );
  assertIncludesAll(
    recommendationLoading,
    [
      'shelfError ||',
      'profileError ||',
      'prefsError ||',
      "profileSource === 'unavailable'",
      'consentCurrent === false',
    ],
    'fail-closed recommendation availability predicate',
  );
  assert.match(hub, /isUnavailable[\s\S]*?REC_COPY\.unavailable\.title/u);
  assert.match(preferencesScreen, /isError[\s\S]*?REC_COPY\.preferences\.loadFailedTitle/u);
  assertIncludesAll(
    recommendationCopy,
    [
      'Only fragrance-free can affect current type guidance.',
      'reviewed product matching is not available',
      'Other choices are saved but do not affect current suggestions.',
      'Current guidance: fragrance-free only.',
    ],
    'truthful current/future recommendation preference copy',
  );
  assert.match(
    preferencesScreen,
    /\{showPreferencesSubtitle\s*\?\s*\([\s\S]*?\{REC_COPY\.preferences\.subtitle\}[\s\S]*?\)\s*:\s*\([\s\S]*?\{REC_COPY\.preferences\.compactScope\}/u,
    'compact recommendation preferences must still disclose the sole current influence',
  );
  assert.match(
    fit,
    /const catalogQuality\s*=\s*0;/u,
    'zero product admission must not mint catalog-quality score credit',
  );
  assert.match(
    fragrance,
    /return type\.type\s*===\s*['"]fragrance_free_cleanser['"]/u,
    'current fragrance-free weighting must require the exact type fact',
  );
  assert.match(
    fit,
    /const typeIsFragranceFree\s*=\s*isCurrentFragranceFreeRecommendationType\(type\)/u,
    'fit scoring must consume the exact fragrance-free type fact',
  );
  assert.doesNotMatch(
    fit,
    /typeIsFragranceFree[\s\S]{0,120}\|\|\s*type\.sensitiveSafe/u,
    'sensitivity metadata is not fragrance-free evidence',
  );
  assert.match(
    engine,
    /input\.preferences\.values\.includes\(['"]fragrance_free['"]\)\s*&&\s*isCurrentFragranceFreeRecommendationType\(type\)/u,
    'rendered fit explanations must use the same exact fragrance-free type fact',
  );
  assert.doesNotMatch(
    engine,
    /fragrance-free[\s\S]{0,180}\|\|\s*type\.sensitiveSafe/iu,
    'rendered fit explanations must not describe sensitivity metadata as fragrance-free evidence',
  );
  assertIncludesAll(
    engine,
    [
      'type.role === fragranced.role && isCurrentFragranceFreeRecommendationType(type)',
      'if (fragranceFreeType)',
    ],
    'better-fit exact-role fragrance-free admission',
  );
  assertIncludesAll(
    migration,
    [
      "'fragrance_free'",
      "'vegan'",
      "'cruelty_free'",
      "'non_comedogenic'",
      "'sustainable'",
      "'gel'",
      "'cream'",
      "'fluid'",
      "'balm'",
      "'oil'",
      "'drugstore'",
      "'mid'",
      "'premium'",
    ],
    'database preference vocabulary',
  );
});

test('recommendation route semantics are not exported to analytics or crash vendors', () => {
  const hub = read(paths.recommendationHub);
  const detail = read(paths.recommendationDetail);
  const teaser = read(paths.recommendationTeaser);
  const preferences = read(paths.recommendationPreferencesScreen);
  const sentry = read(paths.sentry);
  const scrub = read(paths.observabilityScrub);
  const recommendationProducers = `${hub}\n${detail}\n${teaser}\n${preferences}`;

  assertIncludesAll(
    recommendationProducers,
    [
      "track('recommendation_expanded');",
      "track('recommendation_accepted');",
      "track('recommendation_dismissed');",
      "track('youre_set_shown');",
      "track('recommendation_shown', { count: result.recommendations.length });",
      "track('preference_set');",
    ],
    'content-free recommendation analytics producers',
  );
  assert.match(
    hub,
    /if\s*\(result\.youreSet\)\s*track\(['"]youre_set_shown['"]\);\s*else if\s*\(result\.recommendations\.length\s*>\s*0\)\s*\{\s*track\(['"]recommendation_shown['"],\s*\{\s*count:\s*result\.recommendations\.length\s*\}\);/u,
    'zero-result status screens must not be counted as shown recommendations',
  );
  assert.ok(
    detail.indexOf('await dismissRecommendation(rec.id);') <
      detail.indexOf("track('recommendation_dismissed');"),
    'dismissal analytics must follow successful local persistence',
  );
  assert.ok(
    detail.indexOf('if (isConflict && rec.relatedRuleId) {') <
      detail.indexOf("track('recommendation_accepted');"),
    'opening conflict detail must not be counted as accepting a recommendation',
  );
  assert.doesNotMatch(
    recommendationProducers,
    /track\(\s*['"](?:recommendation_(?:shown|expanded|accepted|dismissed)|youre_set_shown|preference_set)['"]\s*,\s*\{[\s\S]{0,180}?\b(?:id|productType|trigger|provenance)\b/u,
    'recommendation analytics must not carry semantic recommendation identifiers or types',
  );

  const vendorTransportOffenders = productionMobileSources().filter((path) =>
    /(?:from\s+|import\s*\(|require\s*\()\s*['"]posthog-react-native['"]|new\s+PostHog\b|\bposthog\w*\.(?:capture|identify|flush)\s*\(/iu.test(
      read(path),
    ),
  );
  assert.deepEqual(
    vendorTransportOffenders,
    [],
    `non-test mobile source must not install a PostHog transport:\n${vendorTransportOffenders.join('\n')}`,
  );
  assertIncludesAll(
    sentry,
    [
      'tracesSampleRate: 0',
      'maxBreadcrumbs: 0',
      'beforeBreadcrumb: () => null',
      'contexts: undefined',
      'request: undefined',
      'spans: undefined',
      'transaction: undefined',
      'transaction_info: undefined',
      'tags: sanitizeSentryTags(event.tags)',
    ],
    'Sentry route-content redaction',
  );
  assert.match(
    scrub,
    /SENSITIVE_CONTEXT_KEY\s*=[\s\S]*?route\|params\|search/u,
    'observability context keys must drop routes and params',
  );
});

test('database and forward-upgrade tests execute the checked-in 0071 boundary', () => {
  const database = read(paths.databaseContract);
  const upgrade = read(paths.upgradeContract);
  const runner = read(paths.databaseRunner);

  assert.match(database, /select plan\(\d+\)/u);
  assert.match(database, /'20260926000078'::text/u);
  assert.match(database, /recommendation_admission_control/u);
  assert.match(database, /recommendable_catalog_products/u);
  assert.match(database, /recommendations_catalog_product_closed/u);
  assert.match(database, /set_recommendation_preferences/u);
  assert.match(upgrade, /select plan\(\d+\)/u);
  assert.match(upgrade, /0070\s*->\s*0071/u);
  assert.match(upgrade, /Legacy recommendation candidate/u);
  assert.match(runner, /20260726000071_recommendation_zero_admission\.sql/u);
  assert.match(runner, /recommendation_zero_admission\.test\.sql/u);
  assert.match(runner, /recommendation_zero_admission_0071_upgrade\.test\.sql/u);
});

test('the launch contract requires exact recommendation professional roles', () => {
  const contract = JSON.parse(read(paths.launchContract));
  const launchSource = read(paths.launchContractSource);
  const reviewPacketBuilder = read(paths.reviewPacketBuilder);
  const entries = contract.featureProfessionalReviewRequirements?.recommendations;

  assert.deepEqual(entries?.map((entry) => entry.reviewerRole).sort(), [
    'board_certified_dermatologist',
    'cosmetic_chemist',
    'regulatory_counsel',
  ]);
  assert.deepEqual(entries?.map((entry) => entry.taskId).sort(), ['H-07', 'REV-04', 'REV-05']);
  assert.match(launchSource, /PROFESSIONAL_REVIEW_FEATURE_KEYS[\s\S]*?['"]recommendations['"]/u);

  const reviewBundle = bounded(
    reviewPacketBuilder,
    'const core06RecommendationReviewSources = Object.freeze([',
    'const packets = {',
  );
  assertIncludesAll(
    reviewBundle,
    [
      'apps/mobile/src/features/onboarding/serverSkinProfile.ts',
      'apps/mobile/src/features/recommendations/admission.ts',
      'apps/mobile/src/features/recommendations/goalAdmission.ts',
      'apps/mobile/src/features/recommendations/goalProvenance.ts',
      'apps/mobile/src/features/recommendations/catalog.ts',
      'apps/mobile/src/features/recommendations/engine.ts',
      'apps/mobile/src/features/recommendations/fit.ts',
      'apps/mobile/src/features/recommendations/fragrance.ts',
      'apps/mobile/src/features/recommendations/copy.ts',
      'apps/mobile/src/features/recommendations/loading.ts',
      'apps/mobile/src/features/recommendations/preferences.ts',
      'apps/mobile/src/features/recommendations/store.ts',
      'apps/mobile/src/features/recommendations/useRecommendations.ts',
      'apps/mobile/src/features/recommendations/RecommendationsTeaser.tsx',
      'apps/mobile/src/features/scheduler/profile.ts',
      'apps/mobile/src/app/recommendations/index.tsx',
      'apps/mobile/src/app/recommendations/preferences.tsx',
      'apps/mobile/src/app/recommendations/[id].tsx',
      'apps/mobile/src/features/commerce/WhereToBuy.tsx',
      'apps/mobile/src/lib/consent/healthProcessingEpoch.ts',
      'supabase/migrations/20260726000071_recommendation_zero_admission.sql',
      'scripts/core06/recommendation-admission-source-contract.test.mjs',
    ],
    'CORE-06 professional review source bundle',
  );
  for (const [packetName, nextPacket] of [
    ['legalRegulatory', 'clinical: ['],
    ['clinical', 'cosmeticChemistry: ['],
    ['cosmeticChemistry', 'ipFto: ['],
    ['privacyPlatform', '\n};'],
  ]) {
    const packetSection = bounded(reviewPacketBuilder, `${packetName}: [`, nextPacket);
    assert.match(
      packetSection,
      /\.\.\.core06RecommendationReviewSources/u,
      `${packetName} must bind the exact common CORE-06 recommendation source bundle`,
    );
  }
});

test('the source-of-truth docs preserve zero admission and explicit external gates', () => {
  const checkpoint = read(paths.checkpoint);
  const recommendationDoc = read(paths.recommendationDoc);
  const architecture = read(paths.architecture);
  const decisions = read(paths.decisions);
  const userFlow = read(paths.userFlow);
  const todoIndex = read(paths.todoIndex);

  assertIncludesAll(
    checkpoint,
    [
      '`CORE-06A` is `in_progress`',
      'zero-product-admission',
      '`type_first`',
      '`shelf_context`',
      'no current `catalog_product` producer',
      'goal-active',
      'commerce',
      'App Store',
      'legal',
      'revenue',
      'Accessed 2026-07-29',
    ],
    'CORE-06A checkpoint',
  );
  assert.match(recommendationDoc, /2026-07-26 Authoritative Source Boundary/u);
  assert.match(architecture, /A-012: Admit Recommendation Provenance/u);
  assert.match(decisions, /Make Recommendation Admission Positive/u);
  assert.match(userFlow, /product-specific mode closed with zero admitted products/u);
  assert.match(userFlow, /no-product and product lookup failure/u);
  assert.match(userFlow, /commerce fetch is impossible for current provenance/u);
  assert.match(todoIndex, /CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26\.md/u);
});

test('CORE-06 source and database contracts are mandatory verification gates', () => {
  const packageJson = JSON.parse(read(paths.packageJson));
  assert.equal(
    packageJson.scripts['core06:recommendation-admission-source-contract:test'],
    'node --test scripts/core06/recommendation-admission-source-contract.test.mjs',
  );
  assert.equal(
    packageJson.scripts['core06:recommendation-db-contract'],
    'node scripts/phase9/recommendation-zero-admission-smoke.mjs',
  );
  for (const parentScript of ['phase3:verify', 'phase7:verify', 'launch:verify']) {
    const commands = String(packageJson.scripts[parentScript] ?? '').split(' && ');
    assert.ok(
      commands.includes('npm run core06:recommendation-admission-source-contract:test'),
      `${parentScript} must run the CORE-06 source contract as a blocking gate`,
    );
    assert.ok(
      commands.includes('npm run core06:recommendation-db-contract'),
      `${parentScript} must run the CORE-06 database contract as a blocking gate`,
    );
  }
});
