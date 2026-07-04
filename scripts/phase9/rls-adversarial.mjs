#!/usr/bin/env node
import { block, listFiles, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];

const migrations = listFiles('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .map((file) => read(file))
  .join('\n');
const exportSource = read('supabase/functions/data-export/index.ts');

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

warn(warnings, process.env.PHASE9_RLS_STAGING_PASS === 'true', 'Missing live staging RLS adversarial evidence: PHASE9_RLS_STAGING_PASS=true.');
warn(warnings, process.env.PHASE9_RLS_PRODUCTION_PASS === 'true', 'Missing live production RLS adversarial evidence: PHASE9_RLS_PRODUCTION_PASS=true.');

printResult('Phase 9 RLS adversarial', errors, warnings);
