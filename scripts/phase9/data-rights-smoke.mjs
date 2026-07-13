#!/usr/bin/env node
import {
  block,
  evidenceFlagEnabled,
  has,
  listFiles,
  OWNER_LINKED_PRIVATE_TABLES,
  printResult,
  read,
  SERVICE_ONLY_PRIVATE_TABLES,
  warn,
} from './lib.mjs';

const errors = [];
const warnings = [];

const exportSource = read('supabase/functions/data-export/index.ts');
const exportCoreSource = read('supabase/functions/data-export/exportCore.ts');
const exportRegistrySource = read('supabase/functions/data-export/exportRegistry.ts');
const exportRegistryTestSource = read('supabase/functions/data-export/exportRegistry.test.ts');
const completeExportSource = `${exportSource}\n${exportCoreSource}\n${exportRegistrySource}`;
const migrationSource = listFiles('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .map((file) => read(file))
  .join('\n');
const deletionSource = read('supabase/functions/account-deletion/index.ts');
const deletionProviderSource = read('supabase/functions/account-deletion/providerDeletion.ts');
const deletionProviderTestSource = read(
  'supabase/functions/account-deletion/providerDeletion.test.ts',
);
const deletionServiceCleanupSource = read(
  'supabase/functions/account-deletion/serviceRoleCleanup.ts',
);
const deletionServiceCleanupTestSource = read(
  'supabase/functions/account-deletion/serviceRoleCleanup.test.ts',
);
const accountServiceScrubMigration = read(
  'supabase/migrations/20260713000046_account_service_row_scrub.sql',
);
const accountServiceScrubPostgresRehearsal = read(
  'scripts/phase9/account-service-scrub-postgres-rehearsal.sql',
);
const orderAttributionCoreSource = read(
  'supabase/functions/order-report-poll/orderAttributionCore.ts',
);
const orderAttributionPollSource = read('supabase/functions/order-report-poll/index.ts');
const completeDeletionSource = `${deletionSource}\n${deletionProviderSource}\n${deletionServiceCleanupSource}\n${accountServiceScrubMigration}`;
const environmentExampleSource = read('.env.example');
const edgeFunctionManifest = JSON.parse(read('supabase/functions/manifest.json'));
const deletionManifest = edgeFunctionManifest.functions?.['account-deletion'] ?? {};
const settingsActionsSource = read('apps/mobile/src/features/settings/actions.ts');
const settingsRouteSource = read('apps/mobile/src/app/(tabs)/you.tsx');
const localDeviceExportSource = read('apps/mobile/src/features/settings/localDeviceExport.ts');
const localDeviceExportTestSource = read(
  'apps/mobile/src/features/settings/localDeviceExport.test.ts',
);
const localPrivateDataKeysSource = read(
  'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
);
const localAccountIsolationSource = read('apps/mobile/src/lib/auth/localAccountIsolation.ts');
const plaintextStagingSource = read('apps/mobile/src/lib/storage/plaintextStagingCore.ts');
const plaintextStagingAdapterSource = read('apps/mobile/src/lib/storage/plaintextStaging.ts');
const packageJson = JSON.parse(read('package.json'));
const liveHarness = read('scripts/phase9/live-data-rights.mjs');
const externalFetchHelper = read('supabase/functions/_shared/fetch.ts');
const storagePathHelper = read('supabase/functions/_shared/storagePath.ts');
const storagePathHelperTest = read('supabase/functions/_shared/storagePath.test.ts');
const deletionHandlerSource = deletionSource.slice(deletionSource.indexOf('Deno.serve'));
const exportHandlerSource = exportSource.slice(exportSource.indexOf('Deno.serve'));

function tableNamesBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) return [];
  return [...source.slice(start, end).matchAll(/table:\s*'([^']+)'/g)].map((match) => match[1]);
}

function stringLiteralsBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) return [];
  return [...source.slice(start, end).matchAll(/'([a-z][a-z0-9_]*)'/g)].map((match) => match[1]);
}

const callerRegistryTables = tableNamesBetween(
  exportRegistrySource,
  'export const CALLER_RLS_EXPORT_TABLES',
  'export const SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES',
);
const directServiceRegistryTables = tableNamesBetween(
  exportRegistrySource,
  'export const SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES',
  'export const SPECIAL_SERVICE_ROLE_FILTERED_EXPORTS',
);
const serviceOnlyDenylist = stringLiteralsBetween(
  exportRegistrySource,
  'export const SERVICE_ONLY_EXPORT_DENYLIST',
  'export const CALLER_RLS_EXPORT_TABLES',
);
const subscriptionExportColumns = stringLiteralsBetween(
  exportRegistrySource,
  'export const SUBSCRIPTION_EVENT_EXPORT_COLUMNS',
  'export function subscriptionEventOwnerFilter',
);
const subscriptionTableDefinition =
  migrationSource.match(
    /create table(?: if not exists)? public\.subscriptions_events\s*\(([\s\S]*?)\n\);/i,
  )?.[1] ?? '';
const subscriptionSchemaColumns = new Set(
  [...subscriptionTableDefinition.matchAll(/^\s*([a-z][a-z0-9_]*)\s+/gm)].map((match) => match[1]),
);
for (const statement of migrationSource.matchAll(
  /alter table public\.subscriptions_events([\s\S]*?);/gi,
)) {
  for (const column of statement[1].matchAll(/add column if not exists\s+([a-z][a-z0-9_]*)/gi)) {
    subscriptionSchemaColumns.add(column[1]);
  }
}

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
  block(errors, completeExportSource.includes(table), `data-export is missing ${table}.`);
}

block(
  errors,
  JSON.stringify([...new Set(callerRegistryTables)].sort()) ===
    JSON.stringify([...OWNER_LINKED_PRIVATE_TABLES].sort()) &&
    callerRegistryTables.length === OWNER_LINKED_PRIVATE_TABLES.length,
  'Caller-RLS export registry must exactly match the canonical owner-linked private-table inventory without duplicates.',
);
block(
  errors,
  callerRegistryTables.every((table) => !SERVICE_ONLY_PRIVATE_TABLES.includes(table)),
  'Caller-RLS export registry contains a canonical service-only table.',
);
block(
  errors,
  JSON.stringify([...new Set(serviceOnlyDenylist)].sort()) ===
    JSON.stringify([...SERVICE_ONLY_PRIVATE_TABLES].sort()) &&
    serviceOnlyDenylist.length === SERVICE_ONLY_PRIVATE_TABLES.length,
  'Runtime export denylist must exactly match the canonical service-only private-table inventory.',
);
block(
  errors,
  directServiceRegistryTables.filter((table) => table === 'reverse_trial_grants').length === 1 &&
    directServiceRegistryTables.includes('obf_contribution_queue'),
  'Direct service-role export registry must contain reverse_trial_grants exactly once and retain OBF coverage.',
);
block(
  errors,
  /buildDirectExportPlans\(userId\)/.test(exportSource) &&
    /item\.clientKind === 'caller' \? supabase : admin/.test(exportSource) &&
    /selectColumns:\s*item\.selectColumns/.test(exportSource) &&
    /EXPORT_SOURCE_DUPLICATE/.test(exportSource),
  'data-export must execute the validated caller/service plan with the selected client, allowlist, and duplicate-source guard.',
);
block(
  errors,
  /table:\s*'reverse_trial_grants'[\s\S]*scope:\s*'service_role_filtered'[\s\S]*selectColumns:\s*'user_id, granted_at, expires_at, source, metadata'/.test(
    exportRegistrySource,
  ) &&
    /EXPORT_REGISTRY_SERVICE_ONLY_IN_CALLER/.test(exportRegistrySource) &&
    /every canonical service-only table is rejected from the caller registry/.test(
      exportRegistryTestSource,
    ),
  'Reverse-trial export must be service-role filtered, column-allowlisted, and protected by an executable denylist mutation contract.',
);
block(
  errors,
  /subscriptionEventOwnerFilter\(userId\)/.test(exportSource) &&
    /SUBSCRIPTION_EVENT_EXPORT_COLUMNS\.join/.test(exportSource) &&
    /aliases\.cs\.\{\$\{verifiedUserId\}\}/.test(exportRegistrySource) &&
    /transferred_from\.cs\.\{\$\{verifiedUserId\}\}/.test(exportRegistrySource) &&
    /transferred_to\.cs\.\{\$\{verifiedUserId\}\}/.test(exportRegistrySource),
  'Subscription export must match scalar/array owner identities while returning only allowlisted non-owner fields.',
);
block(
  errors,
  subscriptionExportColumns.length > 0 &&
    subscriptionExportColumns.every((column) => subscriptionSchemaColumns.has(column)),
  `Subscription export allowlist contains a column absent from the migrated subscriptions_events schema: ${
    subscriptionExportColumns
      .filter((column) => !subscriptionSchemaColumns.has(column))
      .join(', ') || 'unknown'
  }.`,
);
block(
  errors,
  /table:\s*'obf_contribution_queue'[\s\S]*selectColumns:\s*\n?\s*'id, correction_id, user_id, barcode, payload, status, submitted_at, created_at, updated_at'/.test(
    exportRegistrySource,
  ) && /EXPORT_REGISTRY_SERVICE_COLUMNS_REQUIRED/.test(exportRegistrySource),
  'Every direct service-role export must use an explicit reviewed column allowlist.',
);

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
  /selectColumns:\s*\n?\s*'id, click_token, external_order_id, order_amount_cents, currency, status, transaction_date, record_updated_at, created_at'/s.test(
    exportSource,
  ),
  'order_attributions export must omit commission_cents.',
);
block(
  errors,
  /listStoragePathsVerified/.test(exportSource) &&
    /photoPathBelongsToUser\(options\.userId/.test(exportCoreSource) &&
    /photoPathBelongsToUser\(userId, path\)/.test(exportSource) &&
    exportSource.indexOf('photoPathBelongsToUser(userId, path)') <
      exportSource.indexOf('.createSignedUrl('),
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
      exportHandlerSource.indexOf('const sourceTasks:') &&
    exportHandlerSource.indexOf('const rateLimitError = await enforceRateLimit(admin, userId);') <
      exportHandlerSource.indexOf('.createSignedUrl('),
  'data-export must enforce per-user rate limits before export table reads or signed URL generation.',
);
block(
  errors,
  /dataExportPhotoUrlTtlSeconds/.test(exportSource),
  'data-export must use a named configurable photo signed URL TTL.',
);
block(
  errors,
  /createSignedUrl\(\s*path,\s*dataExportPhotoUrlTtlSeconds\s*,?\s*\)/s.test(exportSource),
  'data-export must use DATA_EXPORT_PHOTO_URL_TTL_SECONDS for photo signed URLs.',
);

for (const pattern of [
  /paginateRows/,
  /listStoragePathsVerified/,
  /count_before/,
  /count_after/,
  /checksum_algorithm/,
  /independent_count_guarded_reads/,
  /do not share a database transaction or cross-source snapshot/,
]) {
  block(
    errors,
    pattern.test(completeExportSource),
    `data-export is missing pagination/manifest coverage marker ${pattern}.`,
  );
}
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
  /distinct_ids:\s*distinctIds/,
  /deleteRevenueCatSubscriber/,
  /api\.revenuecat\.com\/v1\/subscribers/,
  /deletePhotoStorage/,
  /scrubAccountServiceRows/,
  /order_attributions.*click_token/s,
  /subscriptions_events.*resolved_user_id/s,
  /auth\.admin\.deleteUser/,
]) {
  block(
    errors,
    pattern.test(completeDeletionSource),
    `account-deletion is missing required deletion marker ${pattern}.`,
  );
}
block(
  errors,
  /ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES\s*=\s*16_384/.test(deletionProviderSource) &&
    /buildRevenueCatDeletionRequest/.test(deletionSource) &&
    /readLimitedResponseJson<unknown>\([\s\S]*?ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES/.test(
      deletionSource,
    ) &&
    /revenueCatDeletionDisposition\(response\.status, body, userId\)\s*!==\s*'deleted'/.test(
      deletionSource,
    ) &&
    /status\s*!==\s*200/.test(deletionProviderSource) &&
    /body\.app_user_id\s*!==\s*expectedUserId/.test(deletionProviderSource) &&
    /body\.deleted\s*!==\s*true/.test(deletionProviderSource) &&
    !/response\.status\s*===\s*404/.test(deletionSource) &&
    (deletionProviderSource.match(/redirect:\s*'error'/g)?.length ?? 0) === 2,
  'RevenueCat deletion must accept only the bounded documented 200 response for the requested app user with deleted=true; undocumented 404 responses must fail closed.',
);
block(
  errors,
  /\/api\/projects\/\$\{encodeURIComponent\(options\.projectId\)\}\/persons\/bulk_delete\//.test(
    deletionProviderSource,
  ) &&
    /distinct_ids:\s*distinctIds/.test(deletionProviderSource) &&
    /delete_events:\s*true/.test(deletionProviderSource) &&
    /delete_recordings:\s*true/.test(deletionProviderSource) &&
    /status\s*!==\s*202/.test(deletionProviderSource) &&
    /body\.persons_found\s*===\s*0/.test(deletionProviderSource) &&
    /body\.persons_deleted\s*!==\s*body\.persons_found/.test(deletionProviderSource) &&
    /body\.events_queued_for_deletion\s*!==\s*true/.test(deletionProviderSource) &&
    /body\.recordings_queued_for_deletion\s*!==\s*true/.test(deletionProviderSource) &&
    /'deletion_errors' in body/.test(deletionProviderSource) &&
    /body\.deletion_errors\.length\s*!==\s*0/.test(deletionProviderSource) &&
    /disposition\s*===\s*'already_absent'/.test(deletionSource) &&
    /throw new Error\('POSTHOG_DELETION_PENDING'\)/.test(deletionSource),
  'PostHog deletion must distinguish idempotent zero-match absence from a fully attested asynchronous queue response.',
);
block(
  errors,
  /parsed\s*=\s*new URL\(host\)/.test(deletionProviderSource) &&
    /parsed\.protocol\s*!==\s*'https:'/.test(deletionProviderSource) &&
    /parsed\.hostname\s*!==\s*'eu\.posthog\.com'/.test(deletionProviderSource) &&
    /parsed\.username\s*!==\s*''/.test(deletionProviderSource) &&
    /parsed\.pathname\s*!==\s*'\/'/.test(deletionProviderSource) &&
    /parsed\.search\s*!==\s*''/.test(deletionProviderSource) &&
    /parsed\.hash\s*!==\s*''/.test(deletionProviderSource) &&
    /const host = normalizePostHogApiHost\(options\.host\);[\s\S]*?pseudonymousUserId/.test(
      deletionProviderSource,
    ),
  'PostHog host validation must allow only the reviewed EU HTTPS API origin before deriving or transmitting account identifiers.',
);
block(
  errors,
  !/POSTHOG_DELETION_APPROVED_ALTERNATE/.test(
    `${completeDeletionSource}\n${environmentExampleSource}\n${JSON.stringify(deletionManifest)}`,
  ) &&
    !/POSTHOG_ENVIRONMENT_ID/.test(
      `${completeDeletionSource}\n${environmentExampleSource}\n${JSON.stringify(deletionManifest)}`,
    ) &&
    !/\/api\/environments\//.test(completeDeletionSource),
  'Account deletion must not bypass PostHog erasure or fall back to the deprecated environment endpoint.',
);
block(
  errors,
  deletionManifest.requiredSecrets?.some(
    (group) =>
      group.includes('REVENUECAT_SECRET_API_KEY') && group.includes('REVENUECAT_REST_API_KEY'),
  ) &&
    deletionManifest.conditionalEnvironment?.some(
      (condition) =>
        /APP_ENV is staging\/production or any PostHog deletion signal/.test(condition.when) &&
        condition.anyOf?.length === 1 &&
        condition.anyOf[0] === 'POSTHOG_PROJECT_ID',
    ) &&
    deletionManifest.conditionalSecrets?.some(
      (condition) =>
        /APP_ENV is staging\/production or any PostHog deletion signal/.test(condition.when) &&
        condition.anyOf?.length === 1 &&
        condition.anyOf[0] === 'POSTHOG_PERSONAL_API_KEY',
    ),
  'Account deletion manifest must require RevenueCat and fail closed on the PostHog project/PAT pair in staging, production, or any partially configured deletion environment.',
);
block(
  errors,
  deletionManifest.conditionalEnvironment?.some(
    (condition) =>
      /Sign in with Apple identity/.test(condition.when) &&
      condition.anyOf?.length === 1 &&
      condition.anyOf[0] === 'APPLE_SIWA_CLIENT_ID',
  ) &&
    deletionManifest.conditionalEnvironment?.some(
      (condition) =>
        /Sign in with Apple identity/.test(condition.when) &&
        condition.anyOf?.length === 1 &&
        condition.anyOf[0] === 'APP_IOS_BUNDLE_IDENTIFIER',
    ),
  'Account deletion manifest must separately require the Apple authorization client ID and its iOS bundle-ID attestation input.',
);
block(
  errors,
  /exact attested 200 response/.test(deletionProviderTestSource) &&
    /\[404, null\]/.test(deletionProviderTestSource) &&
    /zero matched persons to be an idempotent absence/.test(deletionProviderTestSource) &&
    /eu\.posthog\.com\.evil\.example/.test(deletionProviderTestSource) &&
    /!request\.url\.includes\('\/api\/environments\/'\)/.test(deletionProviderTestSource),
  'Provider deletion contract tests must cover RevenueCat malformed/404 rejection, PostHog idempotent absence and queued deletion, exact-host enforcement, and endpoint removal.',
);
block(
  errors,
  /scrubAccountServiceRows\(user\.id, supabase\)/.test(deletionSource) &&
    /ACCOUNT_SERVICE_SCRUB_FAILED/.test(deletionServiceCleanupSource) &&
    /rpc\(ACCOUNT_SERVICE_SCRUB_RPC/.test(deletionServiceCleanupSource) &&
    /complete\s*!==\s*true/.test(deletionServiceCleanupSource) &&
    /residual_order_attributions\s*!==\s*0/.test(deletionServiceCleanupSource) &&
    /residual_subscription_identities\s*!==\s*0/.test(deletionServiceCleanupSource),
  'Account deletion must use the strict service-role scrub RPC attestation before deleting Auth.',
);
block(
  errors,
  /create unique index[\s\S]*commerce_click_events[\s\S]*click_token/i.test(
    accountServiceScrubMigration,
  ) &&
    /foreign key \(click_token\)[\s\S]*references public\.commerce_click_events \(click_token\)[\s\S]*on delete set null/i.test(
      accountServiceScrubMigration,
    ) &&
    /delete from public\.subscriptions_events as event[\s\S]*from auth\.users as other_user/i.test(
      accountServiceScrubMigration,
    ) &&
    /subscriptions_events_deleted/.test(deletionServiceCleanupSource) &&
    /account-only subscription events to be deleted/.test(deletionServiceCleanupTestSource),
  'Service-row deletion must enforce unambiguous click ownership, detach deleted clicks, delete A-only subscription events, and preserve shared owners.',
);
block(
  errors,
  /_migration_0046_payload_owner_values/.test(accountServiceScrubMigration) &&
    /join auth\.users as users[\s\S]*?users\.id::text = pg_catalog\.lower/.test(
      accountServiceScrubMigration,
    ) &&
    /canonical_subscription_owner_identity/.test(accountServiceScrubMigration) &&
    /subscriptions_events_canonical_owner_identities/.test(accountServiceScrubMigration) &&
    /SUBSCRIPTION_OWNER_CANONICALIZATION_INCOMPLETE/.test(accountServiceScrubMigration) &&
    /LEGACY_SUBSCRIPTION_OWNER_BACKFILL_INCOMPLETE/.test(accountServiceScrubMigration) &&
    /_migration_0046_sanitized_payload/.test(accountServiceScrubMigration) &&
    /LEGACY_SUBSCRIPTION_PAYLOAD_FIXTURE_FAILED/.test(accountServiceScrubMigration) &&
    /SUBSCRIPTION_PAYLOAD_ALLOWLIST_INCOMPLETE/.test(accountServiceScrubMigration) &&
    /LEGACY_ACCOUNT_DELETION_HASH_PURGE_INCOMPLETE/.test(accountServiceScrubMigration),
  'Legacy subscription rows must backfill every live owner before typed payload replacement and purge deterministic deletion-hash audit residue.',
);
block(
  errors,
  /\\ir \.\.\/\.\.\/supabase\/migrations\/20260713000046_account_service_row_scrub\.sql/.test(
    accountServiceScrubPostgresRehearsal,
  ) &&
    /deleted-payload-shared/.test(accountServiceScrubPostgresRehearsal) &&
    /deleted-transfer-only/.test(accountServiceScrubPostgresRehearsal) &&
    /ACTIVE_MARKER_ERASED_LIVE_ACCOUNT/.test(accountServiceScrubPostgresRehearsal) &&
    /REPEATED_ALIAS_ORDER_CHANGED/.test(accountServiceScrubPostgresRehearsal) &&
    /B_ONLY_ROW_CHANGED/.test(accountServiceScrubPostgresRehearsal) &&
    /id uuid primary key default gen_random_uuid\(\)/.test(accountServiceScrubPostgresRehearsal) &&
    /STRUCTURED_OWNER_NOT_CANONICALIZED/.test(accountServiceScrubPostgresRehearsal) &&
    /transferred_from is not null/.test(accountServiceScrubPostgresRehearsal),
  'Disposable PostgreSQL rehearsal must execute migration 0046 against production-shaped UUID rows plus deleted-marker, payload-only, transfer-only, repeated, whitespace/case, empty-array, active-account, and unchanged-B fixtures.',
);
block(
  errors,
  /persistOrderAttributionPage/.test(orderAttributionPollSource) &&
    /pollOrderReportPages/.test(orderAttributionPollSource) &&
    /orderReportFailure/.test(orderAttributionPollSource) &&
    /findKnownClickTokens/.test(orderAttributionCoreSource) &&
    /knownTokens\.has\(candidate\) \? candidate : null/.test(orderAttributionCoreSource) &&
    /ORDER_REPORT_UPSTREAM_FAILED/.test(orderAttributionCoreSource) &&
    /ORDER_REPORT_PAGE_LIMIT_EXCEEDED/.test(orderAttributionCoreSource) &&
    /adaptShopMyOrderReportItem/.test(orderAttributionCoreSource) &&
    /ORDER_ATTRIBUTION_PERSIST_FAILED/.test(orderAttributionPollSource),
  'Order-report ingestion must fail closed on incomplete provider pages and never invent or restore an unknown/deleted click token.',
);
block(
  errors,
  !/account_deletion_\$\{userHash\}/.test(deletionSource) &&
    !/CUSTOMER_DELETION_REQUESTED/.test(deletionSource),
  'Account deletion must not retain a recomputable user hash in the subscription event log.',
);
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
  (deletionSource.match(/redirect:\s*'error'/g)?.length ?? 0) === 2 &&
    (deletionProviderSource.match(/redirect:\s*'error'/g)?.length ?? 0) === 2,
  'Account deletion must fail closed on redirects for Apple, RevenueCat, and PostHog credential-bearing requests.',
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
  deletionHandlerSource.indexOf('deleteRevenueCatSubscriber(user.id)') !== -1 &&
    deletionHandlerSource.indexOf('deleteRevenueCatSubscriber(user.id)') <
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
  /reservePlaintextStaging\('data_export_json'\)/.test(settingsActionsSource) &&
    /PLAINTEXT_STAGING_CACHE_UNAVAILABLE/.test(plaintextStagingSource),
  'Mobile data export must reserve an owned plaintext operation and fail closed when cache storage is unavailable.',
);
block(
  errors,
  /createOperationId:\s*randomUUID/.test(plaintextStagingAdapterSource) &&
    /return `\$\{entry\.operationId\}\.\$\{extensionForPurpose\(entry\.purpose\)\}`/.test(
      plaintextStagingSource,
    ) &&
    !/Date\.now\(\)[^\n]*\.json/.test(settingsActionsSource),
  'Mobile data export must use a random opaque operation ID for its one-time cache filename.',
);
block(
  errors,
  !/onskin-export-\$\{Date\.now\(\)\}/.test(settingsActionsSource) &&
    !/onskin-export\.json/.test(settingsActionsSource),
  'Mobile data export must not generate legacy plaintext cache filenames.',
);
block(
  errors,
  settingsActionsSource.indexOf("reservePlaintextStaging('data_export_json')") !== -1 &&
    settingsActionsSource.indexOf("reservePlaintextStaging('data_export_json')") <
      settingsActionsSource.indexOf('const json = JSON.stringify') &&
    settingsActionsSource.indexOf('const json = JSON.stringify') <
      settingsActionsSource.indexOf('await FileSystem.writeAsStringAsync(staging.uri, json);'),
  'Mobile data export must persist its content-free journal reservation before JSON plaintext is created or written.',
);
block(
  errors,
  /try\s*\{[\s\S]*markPlaintextStagingState\(staging, 'plaintext_written'\)[\s\S]*markPlaintextStagingState\(staging, 'sharing'\)[\s\S]*Sharing\.shareAsync\(staging\.uri[\s\S]*\}\s*finally\s*\{[\s\S]*cleanupPlaintextStaging\(staging\)/.test(
    settingsActionsSource,
  ),
  'Mobile data export must journal plaintext/share state and request owned cleanup in a finally block.',
);
block(
  errors,
  /LOCAL_PRIVATE_CONTROL_KEYS\s*=\s*\[[\s\S]*PLAINTEXT_STAGING_JOURNAL_KEY[\s\S]*\]\s*as const/.test(
    localPrivateDataKeysSource,
  ) &&
    /clearPlaintextStaging/.test(localAccountIsolationSource) &&
    /scavengePlaintextStaging/.test(localAccountIsolationSource),
  'The plaintext journal must be a private control key and account-boundary cleanup must scavenge owned staging files.',
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
  /exportCore\.test\.ts/.test(packageJson.scripts?.['phase9:data-export-contract-smoke'] ?? '') &&
    /exportRegistry\.test\.ts/.test(
      packageJson.scripts?.['phase9:data-export-contract-smoke'] ?? '',
    ) &&
    /phase9:data-export-contract-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:data-export-contract-smoke/.test(packageJson.scripts?.['launch:verify'] ?? ''),
  'Data-export core/registry contracts must share one package command included in Phase 9 and launch verification.',
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
    /reverse_trial_grants/.test(liveHarness) &&
    /reverse-trial export manifest is incomplete or misclassified/.test(liveHarness) &&
    /other user reverse-trial grant retained/.test(liveHarness) &&
    /body: \{ user_id: userB\.id \}/.test(liveHarness) &&
    /Storage cleanup left a residual object/.test(liveHarness) &&
    /Rate-limit cleanup left a residual row/.test(liveHarness) &&
    /User cleanup left a residual Auth user/.test(liveHarness) &&
    /harnessErrorDetail/.test(liveHarness) &&
    /storageObjectMissing/.test(liveHarness) &&
    /authUserMissing/.test(liveHarness) &&
    /\^sha256:\[a-f0-9\]\{64\}\$/.test(liveHarness) &&
    !/response\.text\.slice/.test(liveHarness) &&
    /RATE_LIMITED/.test(liveHarness),
  'Live data-rights harness must prove export/delete isolation, reverse-trial service coverage, redacted evidence, blocking cleanup, and rate-limit behavior behind an explicit run flag.',
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
