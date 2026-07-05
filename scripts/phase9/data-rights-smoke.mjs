#!/usr/bin/env node
import { block, has, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];

const exportSource = read('supabase/functions/data-export/index.ts');
const deletionSource = read('supabase/functions/account-deletion/index.ts');
const settingsActionsSource = read('apps/mobile/src/features/settings/actions.ts');
const localPrivateDataKeysSource = read('apps/mobile/src/features/settings/localPrivateDataKeys.ts');
const packageJson = JSON.parse(read('package.json'));
const liveHarness = read('scripts/phase9/live-data-rights.mjs');
const externalFetchHelper = read('supabase/functions/_shared/fetch.ts');
const deletionHandlerSource = deletionSource.slice(deletionSource.indexOf('Deno.serve'));
const exportHandlerSource = exportSource.slice(exportSource.indexOf('Deno.serve'));

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
  /photoPathBelongsToUser/,
  /photo_download_url_omissions/,
  /INVALID_STORAGE_PATH/,
  /EXPORT_TABLE_FAILED/,
  /DATA_EXPORT_FAILED/,
  /order_attributions.*commission_cents/s,
]) {
  block(errors, pattern.test(exportSource), `data-export is missing required coverage marker ${pattern}.`);
}
block(errors, /select\('id, click_token, external_order_id, order_amount_cents, currency, status, transaction_date, record_updated_at, created_at'\)/.test(exportSource), 'order_attributions export must omit commission_cents.');
block(
  errors,
  exportSource.indexOf('photoPathBelongsToUser(userId, photo.storage_path as string)') !== -1 &&
    exportSource.indexOf('photoPathBelongsToUser(userId, photo.storage_path as string)') <
      exportSource.indexOf('.createSignedUrl(photo.storage_path as string'),
  'data-export must verify photo storage_path ownership before creating signed URLs.',
);
for (const pattern of [
  /DATA_EXPORT_RATE_LIMIT_MAX/,
  /DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS/,
  /DATA_EXPORT_PHOTO_URL_TTL_SECONDS/,
  /consume_edge_rate_limit/,
  /hmacSha256Hex/,
  /keyHash/,
  /DATA_EXPORT_RATE_LIMIT_FAILED/,
  /RATE_LIMIT_UNAVAILABLE/,
  /RATE_LIMITED/,
  /Retry-After/,
]) {
  block(errors, pattern.test(exportSource), `data-export is missing rate-limit marker ${pattern}.`);
}
block(
  errors,
  exportHandlerSource.indexOf('const rateLimitError = await enforceRateLimit(admin, userId);') !== -1 &&
    exportHandlerSource.indexOf('const rateLimitError = await enforceRateLimit(admin, userId);') <
      exportHandlerSource.indexOf('for (const item of CALLER_RLS_EXPORT_TABLES)') &&
    exportHandlerSource.indexOf('const rateLimitError = await enforceRateLimit(admin, userId);') <
      exportHandlerSource.indexOf('.createSignedUrl(photo.storage_path as string'),
  'data-export must enforce per-user rate limits before export table reads or signed URL generation.',
);
block(errors, /dataExportPhotoUrlTtlSeconds/.test(exportSource), 'data-export must use a named configurable photo signed URL TTL.');
block(
  errors,
  /createSignedUrl\(photo\.storage_path as string,\s*dataExportPhotoUrlTtlSeconds\)/.test(exportSource),
  'data-export must use DATA_EXPORT_PHOTO_URL_TTL_SECONDS for photo signed URLs.',
);

for (const pattern of [
  /revokeAppleTokenIfNeeded/,
  /assertDeletionPreconditions/,
  /assertAppleRevocationConfigured/,
  /assertPostHogDeletionConfigured/,
  /https:\/\/appleid\.apple\.com\/auth\/token/,
  /https:\/\/appleid\.apple\.com\/auth\/revoke/,
  /POSTHOG_PERSONAL_API_KEY/,
  /persons\/bulk_delete/,
  /pseudonymousUserId/,
  /distinct_ids:\s*\[await pseudonymousUserId\(userId\), userId\]/,
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
block(
  errors,
  /EDGE_EXTERNAL_FETCH_TIMEOUT_MS/.test(externalFetchHelper) &&
    /EDGE_EXTERNAL_RESPONSE_MAX_BYTES/.test(externalFetchHelper) &&
    /fetchWithTimeout/.test(externalFetchHelper) &&
    /readLimitedResponseText/.test(externalFetchHelper) &&
    /readLimitedResponseJson/.test(externalFetchHelper),
  'Shared external fetch helper must bound provider timeouts and response bodies.',
);
block(errors, /fetchWithTimeout/.test(deletionSource), 'account-deletion provider calls must use timed external fetches.');
block(errors, /readLimitedResponseJson/.test(deletionSource), 'account-deletion provider JSON responses must be bounded.');
block(errors, /readLimitedResponseText/.test(deletionSource), 'account-deletion provider text responses must be bounded.');
block(errors, !/await fetch\(/.test(deletionSource), 'account-deletion must not call provider fetch directly.');
block(errors, !/\.(?:json|text)\(\)/.test(deletionSource), 'account-deletion must not read unbounded provider response bodies.');

block(
  errors,
  deletionHandlerSource.indexOf('assertDeletionPreconditions(user, body)') !== -1 &&
    deletionHandlerSource.indexOf('assertDeletionPreconditions(user, body)') <
      deletionHandlerSource.indexOf('deletePhotoStorage(user.id, supabase)'),
  'account-deletion must preflight provider configuration before deleting storage.',
);
block(
  errors,
  deletionHandlerSource.indexOf('deleteRevenueCatSubscriber(user.id, supabase)') !== -1 &&
    deletionHandlerSource.indexOf('deleteRevenueCatSubscriber(user.id, supabase)') <
      deletionHandlerSource.indexOf('deletePhotoStorage(user.id, supabase)'),
  'account-deletion must delete the RevenueCat identity before local storage cleanup.',
);
block(
  errors,
  deletionHandlerSource.indexOf('deletePostHogPerson(user.id)') !== -1 &&
    deletionHandlerSource.indexOf('deletePostHogPerson(user.id)') <
      deletionHandlerSource.indexOf('deletePhotoStorage(user.id, supabase)'),
  'account-deletion must delete the PostHog identity before local storage cleanup.',
);
block(errors, /const code = publicError\(error\)/.test(deletionSource), 'account-deletion must derive a stable public error code.');
block(errors, /console\.error\('\[account-deletion\]', code\)/.test(deletionSource), 'account-deletion must not log raw provider errors.');
block(errors, !/return message/.test(deletionSource), 'account-deletion publicError must not return raw provider messages.');
block(errors, !/return json\(\{ deleted: false, error: publicError\(error\) \}/.test(deletionSource), 'account-deletion must not return raw publicError output inline.');
block(errors, /console\.error\('\[data-export\]', 'DATA_EXPORT_FAILED'\)/.test(exportSource), 'data-export must log only a stable failure code.');
block(errors, !/console\.error\('\[data-export\]', error\)/.test(exportSource), 'data-export must not log raw export errors.');
block(errors, /DATA_EXPORT_CACHE_UNAVAILABLE/.test(settingsActionsSource), 'Mobile data export must fail closed when cacheDirectory is unavailable.');
block(errors, /onskin-export-\$\{Date\.now\(\)\}\.json/.test(settingsActionsSource), 'Mobile data export must use a unique one-time export cache filename.');
block(errors, !/onskin-export\.json/.test(settingsActionsSource), 'Mobile data export must not reuse the legacy stable plaintext cache filename.');
block(
  errors,
  settingsActionsSource.indexOf('try {') !== -1 &&
    settingsActionsSource.indexOf('await FileSystem.writeAsStringAsync(uri, json);') >
      settingsActionsSource.indexOf('try {') &&
    settingsActionsSource.indexOf('await FileSystem.writeAsStringAsync(uri, json);') <
      settingsActionsSource.indexOf('await Sharing.isAvailableAsync()'),
  'Mobile data export must write the plaintext cache file inside the cleanup try/finally block.',
);
block(
  errors,
  /try\s*\{[\s\S]*Sharing\.isAvailableAsync\(\)[\s\S]*Sharing\.shareAsync\(uri[\s\S]*\}\s*finally\s*\{[\s\S]*FileSystem\.deleteAsync\(uri,\s*\{\s*idempotent:\s*true\s*\}\)\.catch\(\(\)\s*=>\s*\{\}\)/.test(
    settingsActionsSource,
  ),
  'Mobile data export must delete the plaintext export cache file in a finally block after the share attempt.',
);
block(
  errors,
  /LOCAL_PRIVATE_CACHE_PREFIXES\s*=\s*\[[^\]]*'onskin-export-'[^\]]*'onskin-share-'[^\]]*\]/.test(
    localPrivateDataKeysSource,
  ),
  'Local private data cleanup must include one-time export cache files and photo share cache files.',
);
for (const [label, source, handlerSource, firstSensitiveMarkers] of [
  ['account-deletion', deletionSource, deletionHandlerSource, ['auth.getUser(token)', 'readLimitedJson(req']],
  ['data-export', exportSource, exportHandlerSource, ['auth.getUser()']],
]) {
  block(errors, /'Access-Control-Allow-Methods': 'POST, OPTIONS'/.test(source), `${label} must advertise POST-only execution and OPTIONS preflight.`);
  block(errors, /req\.method === 'OPTIONS'/.test(handlerSource), `${label} must return early for CORS preflight requests.`);
  block(errors, /req\.method !== 'POST'/.test(handlerSource), `${label} must reject non-POST execution methods.`);
  block(errors, /METHOD_NOT_ALLOWED/.test(handlerSource), `${label} must use a stable method rejection error code.`);
  block(
    errors,
    handlerSource.indexOf("req.method === 'OPTIONS'") !== -1 &&
      handlerSource.indexOf("req.method !== 'POST'") !== -1 &&
      firstSensitiveMarkers.every(
        (marker) =>
          handlerSource.indexOf(marker) !== -1 &&
          handlerSource.indexOf("req.method === 'OPTIONS'") < handlerSource.indexOf(marker) &&
          handlerSource.indexOf("req.method !== 'POST'") < handlerSource.indexOf(marker),
      ),
    `${label} method checks must run before request body parsing, auth resolution, or side effects.`,
  );
}

block(errors, !/async function revokeAppleToken\(_userId/.test(deletionSource), 'Apple token revocation stub remains.');
block(errors, !/async function deletePostHogPerson\(_userId/.test(deletionSource), 'PostHog deletion stub remains.');
block(errors, !/BLOCKED:\s*B-APPLE|BLOCKED:\s*B-POSTHOG/.test(deletionSource), 'Provider deletion blocker comments remain in account-deletion.');
block(errors, Boolean(packageJson.scripts?.['phase9:live-data-rights']), 'package.json is missing phase9:live-data-rights.');
block(
  errors,
  /functions\.invoke\('data-export'/.test(liveHarness) &&
    /functions\.invoke\('account-deletion'/.test(liveHarness) &&
    /PHASE9_RUN_LIVE_DATA_RIGHTS/.test(liveHarness) &&
    /PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX/.test(liveHarness) &&
    /PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK/.test(liveHarness) &&
    /PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS/.test(liveHarness) &&
    /photo_download_url_omissions/.test(liveHarness) &&
    /INVALID_STORAGE_PATH/.test(liveHarness) &&
    /data-export photo signed URLs expire after configured TTL/.test(liveHarness) &&
    /data-export returns 429 after configured data-rights rate limit/.test(liveHarness) &&
    /edge_rate_limits stores keyed hashes only for data-export scope/.test(liveHarness) &&
    /RATE_LIMITED/.test(liveHarness),
  'Live data-rights harness must invoke data-export/account-deletion and prove data-export 429/keyed-hash rate-limit behavior behind an explicit run flag.',
);

const migrationText = read('supabase/migrations/20260614000026_phase4_catalog.sql');
warn(warnings, /obf_contribution_queue[\s\S]*on delete set null/.test(migrationText), 'OBF contribution queue user link is not documented as set-null on account deletion.');

warn(warnings, process.env.PHASE9_DATA_EXPORT_DELETE_PASS === 'true', 'Missing live data export/delete evidence: PHASE9_DATA_EXPORT_DELETE_PASS=true.');

printResult('Phase 9 data rights smoke', errors, warnings);
