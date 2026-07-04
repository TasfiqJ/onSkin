#!/usr/bin/env node
import { block, has, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];

const exportSource = read('supabase/functions/data-export/index.ts');
const deletionSource = read('supabase/functions/account-deletion/index.ts');

const requiredExportTables = [
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
  'subscriptions_events',
  'obf_contribution_queue',
  'order_attributions',
];

for (const table of requiredExportTables) {
  block(errors, exportSource.includes(table), `data-export is missing ${table}.`);
}

for (const pattern of [
  /CALLER_RLS_EXPORT_TABLES/,
  /SERVICE_ROLE_FILTERED_EXPORTS/,
  /local_only_photo_note/,
  /exclusion_register/,
  /createSignedUrl/,
  /EXPORT_TABLE_FAILED/,
  /DATA_EXPORT_FAILED/,
  /order_attributions.*commission_cents/s,
]) {
  block(errors, pattern.test(exportSource), `data-export is missing required coverage marker ${pattern}.`);
}
block(errors, /select\('id, click_token, external_order_id, order_amount_cents, currency, status, transaction_date, record_updated_at, created_at'\)/.test(exportSource), 'order_attributions export must omit commission_cents.');

for (const pattern of [
  /revokeAppleTokenIfNeeded/,
  /https:\/\/appleid\.apple\.com\/auth\/token/,
  /https:\/\/appleid\.apple\.com\/auth\/revoke/,
  /POSTHOG_PERSONAL_API_KEY/,
  /persons\/bulk_delete/,
  /deleteRevenueCatSubscriber/,
  /api\.revenuecat\.com\/v1\/subscribers/,
  /deletePhotoStorage/,
  /scrubServiceRoleOnlyRows/,
  /order_attributions.*click_token/s,
  /subscriptions_events.*resolved_user_id/s,
  /auth\.admin\.deleteUser/,
]) {
  block(errors, pattern.test(deletionSource), `account-deletion is missing required deletion marker ${pattern}.`);
}

block(errors, !/async function revokeAppleToken\(_userId/.test(deletionSource), 'Apple token revocation stub remains.');
block(errors, !/async function deletePostHogPerson\(_userId/.test(deletionSource), 'PostHog deletion stub remains.');
block(errors, !/BLOCKED:\s*B-APPLE|BLOCKED:\s*B-POSTHOG/.test(deletionSource), 'Provider deletion blocker comments remain in account-deletion.');

const migrationText = read('supabase/migrations/20260614000026_phase4_catalog.sql');
warn(warnings, /obf_contribution_queue[\s\S]*on delete set null/.test(migrationText), 'OBF contribution queue user link is not documented as set-null on account deletion.');

warn(warnings, process.env.PHASE9_DATA_EXPORT_DELETE_PASS === 'true', 'Missing live data export/delete evidence: PHASE9_DATA_EXPORT_DELETE_PASS=true.');

printResult('Phase 9 data rights smoke', errors, warnings);
