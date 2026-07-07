#!/usr/bin/env node
import { block, evidenceFlagEnabled, listFiles, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];

const migrations = listFiles('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .map((file) => read(file))
  .join('\n');
const exportSource = read('supabase/functions/data-export/index.ts');
const packageJson = JSON.parse(read('package.json'));
const liveHarness = read('scripts/phase9/live-supabase-adversarial.mjs');

const createdTables = new Set(
  [...migrations.matchAll(/create table(?: if not exists)? public\.([a-z_]+)/gi)].map((match) => match[1]),
);
const rlsTables = new Set(
  [...migrations.matchAll(/alter table public\.([a-z_]+) enable row level security/gi)].map((match) => match[1]),
);
const dynamicUserTables = new Set();
for (const match of migrations.matchAll(/create table(?: if not exists)? public\.([a-z_]+)\s*\(([\s\S]*?)\n\);/gi)) {
  if (/references auth\.users/i.test(match[2])) dynamicUserTables.add(match[1]);
}

const requiredUserOrLinkedTables = [
  'profiles',
  'skin_profiles',
  'user_products',
  'routines',
  'routine_steps',
  'routine_completions',
  'routine_conflicts',
  'active_ramp',
  'shelf_scans',
  'cycles',
  'cycle_nights',
  'streak_freezes',
  'notification_preferences',
  'notification_log',
  'consents',
  'photos',
  'entitlements',
  'reverse_trial_grants',
  'recommendation_preferences',
  'recommendations',
  'catalog_corrections',
  'catalog_lookup_events',
  'commerce_click_events',
  'community_blocks',
  'community_questions',
  'community_reactions',
  'community_reports',
  'photo_trend',
  'ask_sessions',
  'ask_turn_audit',
  'ask_safety_audit',
];

const serviceOnlyTables = [
  'subscriptions_events',
  'order_attributions',
  'obf_contribution_queue',
  'catalog_import_batches',
  'catalog_quality_reports',
  'community_moderation_events',
];

const publicCatalogTables = [
  'ingredients',
  'ingredient_synonyms',
  'ingredient_tags',
  'products',
  'product_ingredients',
  'conflict_rules',
  'ingredient_pao_defaults',
  'sequencing_rules',
  'affiliate_links',
  'creator_stacks',
  'creator_stack_items',
  'community_topics',
  'community_notes',
  'catalog_sources',
  'brands',
  'product_categories',
  'product_barcodes',
  'ingredient_tag_definitions',
  'ingredient_tag_assignments',
  'product_ingredient_lists',
  'product_ingredient_tokens',
  'product_active_bands',
  'product_pao_expiry',
];

for (const table of [...requiredUserOrLinkedTables, ...serviceOnlyTables, ...publicCatalogTables]) {
  block(errors, createdTables.has(table), `Migration missing table ${table}.`);
  block(errors, rlsTables.has(table), `RLS is not enabled for ${table}.`);
}

for (const table of dynamicUserTables) {
  block(
    errors,
    requiredUserOrLinkedTables.includes(table) || serviceOnlyTables.includes(table),
    `Discovered auth.users-linked table without Phase 9 RLS classification: ${table}.`,
  );
}

for (const table of requiredUserOrLinkedTables) {
  block(errors, exportSource.includes(table), `User-linked table is missing from data-export coverage: ${table}.`);
}

for (const table of serviceOnlyTables) {
  if (table === 'catalog_import_batches' || table === 'catalog_quality_reports' || table === 'community_moderation_events') continue;
  block(errors, exportSource.includes(table), `Service-only user-linked table is missing from data-export or exclusion coverage: ${table}.`);
}

block(errors, /photos_objects_select_own/.test(migrations), 'Storage RLS policy missing for photos select.');
block(errors, /photos_objects_insert_own/.test(migrations), 'Storage RLS policy missing for photos insert.');
block(errors, /photos_objects_delete_own/.test(migrations), 'Storage RLS policy missing for photos delete.');
block(errors, /owns_routine/.test(migrations), 'Child-table routine ownership helper is missing.');
block(errors, /owns_cycle/.test(migrations), 'Child-table cycle ownership helper is missing.');
block(errors, /ask_turn_audit_select_own/.test(migrations), 'Ask turn audit parent-owner policy is missing.');
block(
  errors,
  /drop policy if exists "routine_steps_insert_own"[\s\S]*create policy "routine_steps_insert_own"[\s\S]*owns_user_product\(user_product_id\)/i.test(
    migrations,
  ),
  'Routine step RLS must block cross-user product references.',
);
block(
  errors,
  /drop policy if exists "cycle_nights_insert_own"[\s\S]*create policy "cycle_nights_insert_own"[\s\S]*owns_user_product\(user_product_id\)/i.test(
    migrations,
  ),
  'Cycle night RLS must block cross-user product references.',
);
block(
  errors,
  /create or replace function public\.owns_ask_turn_audit[\s\S]*drop policy if exists "ask_safety_audit_insert_own"[\s\S]*owns_ask_turn_audit\(turn_audit_id\)/i.test(
    migrations,
  ),
  'Ask safety audit RLS must prove the referenced turn belongs to the caller.',
);
block(
  errors,
  /drop policy if exists "community_reports_insert_own"[\s\S]*moderation_state = 'approved'/i.test(migrations),
  'Community report RLS must block reports against private pending questions.',
);
block(
  errors,
  /create policy "photos_storage_path_owned_insert"[\s\S]*split_part\(storage_path, '\/', 1\) = \(select auth\.uid\(\)\)::text/i.test(
    migrations,
  ),
  'Photo metadata RLS must bind cloud storage_path to the caller prefix.',
);
block(
  errors,
  /create policy "photos_storage_path_owned_update"[\s\S]*local_only = true[\s\S]*storage_path is null[\s\S]*local_only = false/i.test(
    migrations,
  ),
  'Photo metadata RLS must block local-only rows with cloud storage paths.',
);
block(
  errors,
  /drop policy if exists "community_reactions_insert_own"[\s\S]*create policy "community_reactions_insert_own"[\s\S]*note_id is not null[\s\S]*reviewed_by is not null[\s\S]*claim_safety_ok = true/i.test(
    migrations,
  ),
  'Community reactions must target published claim-safe notes.',
);
block(errors, /create or replace function public\.has_current_consent/i.test(migrations), 'Current consent helper is missing.');
for (const [type, tablePolicy] of [
  ['photo_cloud_backup', 'photos_cloud_backup_consent_insert'],
  ['photo_cloud_backup', 'photos_objects_insert_own'],
  ['data_sharing', 'commerce_click_events_consent_insert'],
  ['photo_trend_insights', 'photo_trend_consent_insert'],
  ['community_participation', 'community_reactions_consent_insert'],
  ['ask_onskin', 'ask_sessions_consent_insert'],
  ['ask_onskin', 'ask_turn_audit_consent_insert'],
  ['ask_onskin', 'ask_safety_audit_consent_insert'],
]) {
  block(
    errors,
    new RegExp(`${tablePolicy}[\\s\\S]*has_current_consent\\('${type}'\\)`, 'i').test(migrations),
    `${tablePolicy} must require current ${type} consent.`,
  );
}
block(
  errors,
  Boolean(packageJson.scripts?.['phase9:live-supabase-adversarial']),
  'package.json is missing phase9:live-supabase-adversarial.',
);
block(
  errors,
  /storage\.from\('photos'\)/.test(liveHarness) && /PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL/.test(liveHarness),
  'Live Supabase adversarial harness must test private photo storage and require an explicit run flag.',
);

const requiredLiveHarnessTables = [
  'routine_conflicts',
  'active_ramp',
  'shelf_scans',
  'cycles',
  'cycle_nights',
  'streak_freezes',
  'notification_preferences',
  'notification_log',
  'recommendation_preferences',
  'recommendations',
  'photo_trend',
  'catalog_corrections',
  'catalog_lookup_events',
  'commerce_click_events',
  'community_blocks',
  'community_questions',
  'community_reports',
  'community_reactions',
  'ask_sessions',
  'ask_turn_audit',
  'ask_safety_audit',
  'reverse_trial_grants',
];

for (const table of requiredLiveHarnessTables) {
  block(
    errors,
    liveHarness.includes(`'${table}'`),
    `Live Supabase adversarial harness is missing ${table} coverage.`,
  );
}

const requiredLiveHarnessChecks = [
  'photo metadata cross-user storage path insert',
  'photo metadata local-only storage path insert',
  'photo metadata cross-user storage path update',
  'community reaction unpublished note insert',
  'community reaction null note insert',
  'photo trend revoked consent insert',
  'commerce click revoked consent insert',
  'community question revoked consent insert',
  'community reaction revoked consent insert',
  'Ask session revoked consent insert',
  'Ask safety revoked consent insert',
  'photo metadata revoked cloud consent insert',
  'storage upload after photo_cloud_backup revocation unexpectedly succeeded',
];

for (const check of requiredLiveHarnessChecks) {
  block(errors, liveHarness.includes(check), `Live Supabase adversarial harness is missing: ${check}.`);
}

warn(warnings, evidenceFlagEnabled(process.env.PHASE9_RLS_STAGING_PASS), 'Missing live staging RLS adversarial evidence: PHASE9_RLS_STAGING_PASS=true.');
warn(warnings, evidenceFlagEnabled(process.env.PHASE9_RLS_PRODUCTION_PASS), 'Missing live production RLS adversarial evidence: PHASE9_RLS_PRODUCTION_PASS=true.');

printResult('Phase 9 RLS adversarial', errors, warnings);
