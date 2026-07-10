#!/usr/bin/env node
import { block, evidenceFlagEnabled, has, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];

const exportSource = read('supabase/functions/data-export/index.ts');
const deletionSource = read('supabase/functions/account-deletion/index.ts');
const settingsActionsSource = read('apps/mobile/src/features/settings/actions.ts');
const settingsRouteSource = read('apps/mobile/src/app/(tabs)/you.tsx');
const localDeviceExportSource = read('apps/mobile/src/features/settings/localDeviceExport.ts');
const localDeviceExportTestSource = read(
  'apps/mobile/src/features/settings/localDeviceExport.test.ts',
);
const localPrivateDataKeysSource = read(
  'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
);
const packageJson = JSON.parse(read('package.json'));
const liveHarness = read('scripts/phase9/live-data-rights.mjs');
const externalFetchHelper = read('supabase/functions/_shared/fetch.ts');
const storagePathHelper = read('supabase/functions/_shared/storagePath.ts');
const storagePathHelperTest = read('supabase/functions/_shared/storagePath.test.ts');
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
  block(
    errors,
    pattern.test(exportSource),
    `data-export is missing required coverage marker ${pattern}.`,
  );
}
block(
  errors,
  /Includes data saved to your account and on this device:/.test(settingsRouteSource) &&
    /completion history, preferences, and Progress notes\./.test(settingsRouteSource) &&
    /Photo files and thumbnails stay encrypted here;/.test(settingsRouteSource) &&
    /share images individually from Progress\./.test(settingsRouteSource) &&
    /Progress photos stay encrypted here unless you share one\./.test(settingsRouteSource) &&
    !/Photos stay on your device by default\./.test(settingsRouteSource),
  'Settings must disclose local-first export coverage and the Progress media-file exclusion.',
);
block(
  errors,
  /collectLocalDeviceExportData\(\)/.test(settingsActionsSource) &&
    /if \(isSupabaseConfigured\)/.test(settingsActionsSource) &&
    /serverAccountDataStatus = 'included'/.test(settingsActionsSource) &&
    /DATA_EXPORT_RESPONSE_INVALID/.test(settingsActionsSource) &&
    /parsed\.export_schema_version/.test(settingsActionsSource) &&
    /parsed\.user_id/.test(settingsActionsSource) &&
    /buildMobileDataExportBundle/.test(settingsActionsSource),
  'Mobile export must combine local device data with a validated configured server account bundle.',
);
block(
  errors,
  /LOCAL_PRIVATE_DATA_KEYS/.test(localDeviceExportSource) &&
    /LOCAL_DEVICE_EXPORT_STORAGE_KEYS/.test(localDeviceExportSource) &&
    /getPrivateItems\(LOCAL_DEVICE_EXPORT_STORAGE_KEYS\)/.test(localDeviceExportSource) &&
    /REDACTED_LOCAL_FIELD_NAMES/.test(localDeviceExportSource) &&
    /progress_photo_files_and_thumbnails/.test(localDeviceExportSource) &&
    /encryption_keys_and_auth_credentials/.test(localDeviceExportSource) &&
    /server_account_data_status/.test(localDeviceExportSource) &&
    /backend_not_configured/.test(localDeviceExportSource),
  'Mobile export must use an explicit local-private-data registry and versioned scope wrapper.',
);
block(
  errors,
  /LOCAL_DEVICE_EXPORT_STORAGE_KEYS/.test(localDeviceExportTestSource) &&
    /LOCAL_PRIVATE_DATA_KEYS/.test(localDeviceExportTestSource) &&
    /not\.toContain\('file:\/\/\/'\)/.test(localDeviceExportTestSource) &&
    /not\.toContain\('notesCiphertext'\)/.test(localDeviceExportTestSource) &&
    /notesExportStatus: 'unavailable'/.test(localDeviceExportTestSource),
  'Mobile export tests must enforce exhaustive local-key coverage and local media redaction.',
);
block(
  errors,
  /local_only_photo_note:\s*\n?\s*'Progress photo files and thumbnails are not included in this account export\.[^']*cloud backup is unavailable\.'/s.test(
    exportSource,
  ) && /Any server-side photo metadata rows are exported separately in photos\./.test(exportSource),
  'The export artifact must explain the device-only photo exclusion and separate metadata coverage.',
);
block(
  errors,
  /\.select\(\s*'id, click_token, external_order_id, order_amount_cents, currency, status, transaction_date, record_updated_at, created_at'\s*,?\s*\)/s.test(
    exportSource,
  ),
  'order_attributions export must omit commission_cents.',
);
block(
  errors,
  exportSource.indexOf('photoPathBelongsToUser(userId, photo.storage_path as string)') !== -1 &&
    exportSource.indexOf('photoPathBelongsToUser(userId, photo.storage_path as string)') <
      exportSource.indexOf('.createSignedUrl(photo.storage_path as string'),
  'data-export must verify photo storage_path ownership before creating signed URLs.',
);
block(
  errors,
  /SAFE_STORAGE_PATH_SEGMENT/.test(storagePathHelper) &&
    /segment !== '\.'/.test(storagePathHelper) &&
    /segment !== '\.\.'/.test(storagePathHelper),
  'Shared photo storage path helper must reject unsafe object path segments.',
);
block(
  errors,
  /photo storage path contract rejects cross-user or malformed paths/.test(storagePathHelperTest) &&
    /%2e%2e/.test(storagePathHelperTest) &&
    /token=secret/.test(storagePathHelperTest),
  'Shared photo storage path helper test must cover traversal and signed-token path probes.',
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
  exportHandlerSource.indexOf('const rateLimitError = await enforceRateLimit(admin, userId);') !==
    -1 &&
    exportHandlerSource.indexOf('const rateLimitError = await enforceRateLimit(admin, userId);') <
      exportHandlerSource.indexOf('for (const item of CALLER_RLS_EXPORT_TABLES)') &&
    exportHandlerSource.indexOf('const rateLimitError = await enforceRateLimit(admin, userId);') <
      exportHandlerSource.indexOf('.createSignedUrl(photo.storage_path as string'),
  'data-export must enforce per-user rate limits before export table reads or signed URL generation.',
);
block(
  errors,
  /dataExportPhotoUrlTtlSeconds/.test(exportSource),
  'data-export must use a named configurable photo signed URL TTL.',
);
block(
  errors,
  /createSignedUrl\(photo\.storage_path as string,\s*dataExportPhotoUrlTtlSeconds\)/.test(
    exportSource,
  ),
  'data-export must use DATA_EXPORT_PHOTO_URL_TTL_SECONDS for photo signed URLs.',
);
block(
  errors,
  /function exportFileSlug\(\)/.test(exportSource),
  'data-export must derive a sanitized export filename slug.',
);
block(
  errors,
  /function exportFileName\(\)/.test(exportSource),
  'data-export must derive its attachment filename from the sanitized slug.',
);
block(
  errors,
  /EXPO_PUBLIC_APP_DISPLAY_NAME/.test(exportSource) &&
    /APP_DISPLAY_NAME/.test(exportSource) &&
    /RoutineKind/.test(exportSource),
  'data-export attachment filename must use the runtime display name with a RoutineKind fallback.',
);
block(
  errors,
  /replace\(\/\[\^a-z0-9\]\+\/g,\s*'-'\)/.test(exportSource) &&
    /slice\(0,\s*48\)/.test(exportSource),
  'data-export attachment filename must sanitize and bound the runtime display name.',
);
block(
  errors,
  /'Content-Disposition': `attachment; filename="\$\{dataExportFileName\}"`/.test(exportSource),
  'data-export must use the sanitized runtime-brand filename in Content-Disposition.',
);
block(
  errors,
  !/filename="onskin-export\.json"/.test(exportSource) &&
    !/const dataExportFileName = 'onskin-export\.json'/.test(exportSource),
  'data-export must not expose the legacy export filename in response headers.',
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
  block(
    errors,
    pattern.test(deletionSource),
    `account-deletion is missing required deletion marker ${pattern}.`,
  );
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
block(
  errors,
  /fetchWithTimeout/.test(deletionSource),
  'account-deletion provider calls must use timed external fetches.',
);
block(
  errors,
  /readLimitedResponseJson/.test(deletionSource),
  'account-deletion provider JSON responses must be bounded.',
);
block(
  errors,
  /readLimitedResponseText/.test(deletionSource),
  'account-deletion provider text responses must be bounded.',
);
block(
  errors,
  !/await fetch\(/.test(deletionSource),
  'account-deletion must not call provider fetch directly.',
);
block(
  errors,
  !/\.(?:json|text)\(\)/.test(deletionSource),
  'account-deletion must not read unbounded provider response bodies.',
);

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
block(
  errors,
  /const code = publicError\(error\)/.test(deletionSource),
  'account-deletion must derive a stable public error code.',
);
block(
  errors,
  /console\.error\('\[account-deletion\]', code\)/.test(deletionSource),
  'account-deletion must not log raw provider errors.',
);
block(
  errors,
  !/return message/.test(deletionSource),
  'account-deletion publicError must not return raw provider messages.',
);
block(
  errors,
  !/return json\(\{ deleted: false, error: publicError\(error\) \}/.test(deletionSource),
  'account-deletion must not return raw publicError output inline.',
);
block(
  errors,
  /console\.error\('\[data-export\]', 'DATA_EXPORT_FAILED'\)/.test(exportSource),
  'data-export must log only a stable failure code.',
);
block(
  errors,
  !/console\.error\('\[data-export\]', error\)/.test(exportSource),
  'data-export must not log raw export errors.',
);
block(
  errors,
  /DATA_EXPORT_CACHE_UNAVAILABLE/.test(settingsActionsSource),
  'Mobile data export must fail closed when cacheDirectory is unavailable.',
);
block(
  errors,
  /brandCachePrefix\('export'\)/.test(settingsActionsSource) &&
    /\$\{exportCachePrefix\}\$\{Date\.now\(\)\}\.json/.test(settingsActionsSource),
  'Mobile data export must use a runtime-brand, unique one-time export cache filename.',
);
block(
  errors,
  !/onskin-export-\$\{Date\.now\(\)\}/.test(settingsActionsSource) &&
    !/onskin-export\.json/.test(settingsActionsSource),
  'Mobile data export must not generate legacy plaintext cache filenames.',
);
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
  /CURRENT_LOCAL_PRIVATE_CACHE_PREFIXES\s*=\s*\[[^\]]*'routinekind-export-'[^\]]*'routinekind-share-'[^\]]*\]/.test(
    localPrivateDataKeysSource,
  ) &&
    /LEGACY_LOCAL_PRIVATE_CACHE_PREFIXES\s*=\s*\[[^\]]*'onskin-export-'[^\]]*'onskin-share-'[^\]]*\]/.test(
      localPrivateDataKeysSource,
    ) &&
    /brandCachePrefix\('export'\)/.test(localPrivateDataKeysSource) &&
    /brandCachePrefix\('share'\)/.test(localPrivateDataKeysSource),
  'Local private data cleanup must include current, runtime-brand, and legacy export/share cache files.',
);
for (const [label, source, handlerSource, firstSensitiveMarkers] of [
  [
    'account-deletion',
    deletionSource,
    deletionHandlerSource,
    ['auth.getUser(token)', 'readLimitedJson(req'],
  ],
  ['data-export', exportSource, exportHandlerSource, ['auth.getUser()']],
]) {
  block(
    errors,
    /'Access-Control-Allow-Methods': 'POST, OPTIONS'/.test(source),
    `${label} must advertise POST-only execution and OPTIONS preflight.`,
  );
  block(
    errors,
    /req\.method === 'OPTIONS'/.test(handlerSource),
    `${label} must return early for CORS preflight requests.`,
  );
  block(
    errors,
    /req\.method !== 'POST'/.test(handlerSource),
    `${label} must reject non-POST execution methods.`,
  );
  block(
    errors,
    /METHOD_NOT_ALLOWED/.test(handlerSource),
    `${label} must use a stable method rejection error code.`,
  );
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

block(
  errors,
  !/async function revokeAppleToken\(_userId/.test(deletionSource),
  'Apple token revocation stub remains.',
);
block(
  errors,
  !/async function deletePostHogPerson\(_userId/.test(deletionSource),
  'PostHog deletion stub remains.',
);
block(
  errors,
  !/BLOCKED:\s*B-APPLE|BLOCKED:\s*B-POSTHOG/.test(deletionSource),
  'Provider deletion blocker comments remain in account-deletion.',
);
block(
  errors,
  Boolean(packageJson.scripts?.['phase9:live-data-rights']),
  'package.json is missing phase9:live-data-rights.',
);
block(
  errors,
  Boolean(packageJson.scripts?.['phase9:storage-path-privacy-smoke']) &&
    /storagePath\.test\.ts/.test(
      packageJson.scripts?.['phase9:storage-path-privacy-smoke'] ?? '',
    ) &&
    /phase9:storage-path-privacy-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'Storage path privacy contract must be scriptable and included in phase9:verify.',
);
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
block(
  errors,
  /function assertLocalPhotoExportDisclosure\(bundle\)/.test(liveHarness) &&
    /local_only_photo_note/.test(liveHarness) &&
    /Any server-side photo metadata rows are exported separately in photos\./.test(liveHarness) &&
    (liveHarness.match(/assertLocalPhotoExportDisclosure\(/g)?.length ?? 0) >= 3,
  'Live data-rights harness must verify the local-photo exclusion in normal and rate-limit export responses.',
);

const migrationText = read('supabase/migrations/20260614000026_phase4_catalog.sql');
warn(
  warnings,
  /obf_contribution_queue[\s\S]*on delete set null/.test(migrationText),
  'OBF contribution queue user link is not documented as set-null on account deletion.',
);

warn(
  warnings,
  evidenceFlagEnabled(process.env.PHASE9_DATA_EXPORT_DELETE_PASS),
  'Missing live data export/delete evidence: PHASE9_DATA_EXPORT_DELETE_PASS=true.',
);

printResult('Phase 9 data rights smoke', errors, warnings);
