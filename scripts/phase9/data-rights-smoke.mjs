#!/usr/bin/env node
import { block, evidenceFlagEnabled, has, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];

const exportSource = read('supabase/functions/data-export/index.ts');
const exportCoreSource = read('supabase/functions/data-export/exportCore.ts');
const completeExportSource = `${exportSource}\n${exportCoreSource}`;
const deletionSource = read('supabase/functions/account-deletion/index.ts');
const deletionCoreSource = read('supabase/functions/account-deletion/deletionCore.ts');
const deletionStateSource = read('supabase/functions/account-deletion/supabaseDeletionState.ts');
const deletionRecoverySource = read('supabase/functions/account-deletion/RECOVERY.md');
const deletionMigrationSource = read(
  'supabase/migrations/20260713000043_account_deletion_resumable.sql',
);
const settingsActionsSource = read('apps/mobile/src/features/settings/actions.ts');
const deletionVendorFreezeSource = read('apps/mobile/src/lib/auth/accountDeletionVendorFreeze.ts');
const deletionVendorFreezeRuntimeSource = read(
  'apps/mobile/src/lib/auth/accountDeletionVendorFreezeRuntime.ts',
);
const authProviderSource = read('apps/mobile/src/lib/auth/AuthProvider.tsx');
const localPrivateDataSource = read('apps/mobile/src/features/settings/localPrivateData.ts');
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
const edgeFunctionManifest = JSON.parse(read('supabase/functions/manifest.json'));
const liveHarness = read('scripts/phase9/live-data-rights.mjs');
const liveAccountCleanupSource = read('scripts/phase9/live-account-cleanup.mjs');
const guardedCleanupHarnessPaths = [
  'scripts/phase2/supabase-rls-smoke.mjs',
  'scripts/phase9/live-consent-withdrawal.mjs',
  'scripts/phase9/live-catalog-rate-limit.mjs',
  'scripts/phase9/live-supabase-adversarial.mjs',
  'scripts/phase9/live-revenuecat-webhook.mjs',
  'scripts/phase9/live-edge-auth.mjs',
  'scripts/phase9/live-data-rights.mjs',
];
const guardedCleanupHarnesses = guardedCleanupHarnessPaths.map((path) => ({
  path,
  source: read(path),
}));
const guardedCleanupHarnessSource = guardedCleanupHarnesses.map(({ source }) => source).join('\n');
const guardedCleanupCallerContractsHold = guardedCleanupHarnesses.every(({ path, source }) => {
  const cleanupIndex = source.lastIndexOf('await cleanupLiveTestAccounts');
  const cleanupCallEnd = source.indexOf('});', cleanupIndex);
  const cleanupCallSource = source.slice(cleanupIndex, cleanupCallEnd + 3);
  const successIndex = path.endsWith('supabase-rls-smoke.mjs')
    ? source.lastIndexOf('OK Supabase RLS smoke tests passed.')
    : source.lastIndexOf("writeArtifacts(errors.length > 0 ? 'fail' : 'pass')");
  const expectedErrorSink = path.endsWith('supabase-rls-smoke.mjs')
    ? /\berrors:\s*cleanupErrors,/.test(cleanupCallSource)
    : /\berrors,/.test(cleanupCallSource);
  return (
    /cleanupLiveTestAccounts/.test(source) &&
    !/deleteLiveTestAccount/.test(source) &&
    !/auth\.admin\.deleteUser/.test(source) &&
    cleanupIndex !== -1 &&
    cleanupCallEnd !== -1 &&
    expectedErrorSink &&
    successIndex !== -1 &&
    cleanupIndex < successIndex
  );
});
const externalFetchHelper = read('supabase/functions/_shared/fetch.ts');
const storagePathHelper = read('supabase/functions/_shared/storagePath.ts');
const storagePathHelperTest = read('supabase/functions/_shared/storagePath.test.ts');
const deletionHandlerSource = deletionSource.slice(deletionSource.indexOf('Deno.serve'));
const exportHandlerSource = exportSource.slice(exportSource.indexOf('Deno.serve'));
const deletionStepList =
  deletionCoreSource
    .match(/export const ACCOUNT_DELETION_STEPS = \[([\s\S]*?)\] as const;/)?.[1]
    ?.match(/'[^']+'/g)
    ?.map((step) => step.slice(1, -1)) ?? [];

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
  /runAccountDeletionStateMachine/,
  /createSupabaseAccountDeletionStateStore/,
  /auth\.admin\.deleteUser/,
]) {
  block(
    errors,
    pattern.test(deletionSource),
    `account-deletion is missing required deletion marker ${pattern}.`,
  );
}
for (const pattern of [
  /runAccountDeletionStateMachine/,
  /input\.store\.claim/,
  /input\.store\.checkpoint/,
  /input\.store\.beginAppleAttempt/,
  /input\.store[\s\S]*\.recordFailure/,
  /deleteRevenueCatSubscriber/,
  /deletePostHogPerson/,
  /deletePhotoStorage/,
  /eraseDatabaseState/,
  /revokeOtherAuthSessions/,
  /revokeAppleToken/,
  /reconcileProviders/,
  /deleteAuthIdentity/,
  /APPLE_AUTHORIZATION_CODE_REQUIRED/,
  /APPLE_REVOCATION_STATUS_UNKNOWN/,
]) {
  block(
    errors,
    pattern.test(deletionCoreSource),
    `account-deletion state machine is missing required marker ${pattern}.`,
  );
}
block(
  errors,
  JSON.stringify(deletionStepList) ===
    JSON.stringify([
      'revenuecat',
      'posthog',
      'storage',
      'database',
      'sessions',
      'apple',
      'providers_final',
      'auth',
    ]),
  'account-deletion must checkpoint early providers, storage/database, session revocation, Apple, final providers, then auth.',
);
block(
  errors,
  /const appleAuthorizationCode = input\.appleAuthorizationCode\?\.trim\(\)/.test(
    deletionCoreSource,
  ) &&
    deletionCoreSource.indexOf("throw new Error('APPLE_AUTHORIZATION_CODE_REQUIRED')") <
      deletionCoreSource.indexOf('input.store.claim') &&
    /state = await input\.store\.beginAppleAttempt/.test(deletionCoreSource) &&
    /await input\.actions\.revokeAppleToken\(appleAuthorizationCode\)/.test(deletionCoreSource) &&
    /state\.nextStep === 'apple_in_progress'/.test(deletionCoreSource),
  'account-deletion must preflight Apple authorization before claim and durably prevent reuse before provider I/O.',
);
block(
  errors,
  !/authorization[_ ]code/i.test(deletionMigrationSource) &&
    !/p_apple_authorization_code/i.test(deletionStateSource),
  'account-deletion durable state must never persist the single-use Apple authorization code.',
);
for (const pattern of [
  /create table public\.account_deletion_requests/,
  /next_step[\s\S]*'revenuecat'[\s\S]*'posthog'[\s\S]*'storage'[\s\S]*'database'[\s\S]*'apple'[\s\S]*'auth'[\s\S]*'complete'/,
  /alter table public\.account_deletion_requests enable row level security/,
  /pg_advisory_xact_lock/,
  /reject_owned_write_during_account_deletion/,
  /account_deletion_write_allowed/,
  /as restrictive for insert to authenticated/,
  /create or replace function public\.account_deletion_claim/,
  /create or replace function public\.account_deletion_preflight/,
  /create or replace function public\.account_deletion_begin_apple_attempt/,
  /create or replace function public\.account_deletion_checkpoint/,
  /create or replace function public\.account_deletion_record_failure/,
  /create or replace function public\.account_deletion_completion_status/,
  /completion_token_hash\s+text not null unique/,
  /grant execute on function public\.account_deletion_completion_status\(text\)[\s\S]*to anon, authenticated, service_role/,
  /where deletion\.user_lookup_hash = public\.account_deletion_lookup_hash\(v_user_id\)/,
  /deletion\.next_step in \('apple_in_progress', 'providers_final', 'auth'\)/,
  /v_request\.lease_expires_at > clock_timestamp\(\)[\s\S]*v_request\.next_step = 'apple_in_progress'/,
  /create or replace function public\.erase_account_database_state/,
  /delete from public\.profiles where id = p_user_id/,
  /update public\.subscriptions_events[\s\S]*resolved_user_id = null/,
  /update public\.order_attributions[\s\S]*click_token = null/,
  /delete from public\.obf_contribution_queue/,
  /grant execute on function public\.account_deletion_claim\(uuid, text, boolean, uuid, uuid, text\)[\s\S]*to service_role/,
  /grant execute on function public\.account_deletion_begin_apple_attempt\(uuid, uuid, uuid\)[\s\S]*to service_role/,
  /grant execute on function public\.erase_account_database_state\(uuid, uuid, uuid\)[\s\S]*to service_role/,
  /after delete on auth\.users/,
  /before delete on auth\.users/,
  /guard_account_deletion_before_auth_delete/,
  /reject_auth_write_during_account_deletion/,
  /reject_auth_session_write_during_account_deletion/,
  /reject_auth_refresh_token_write_during_account_deletion/,
  /before insert or update or delete on auth\.identities/,
  /before insert or update on auth\.sessions/,
  /before insert or update on auth\.refresh_tokens/,
  /v_new - 'revoked' - 'updated_at'/,
  /finalize_account_deletion_after_auth_delete/,
  /suppress_deleted_revenuecat_identity/,
  /suppress_deleted_order_click_token/,
]) {
  block(
    errors,
    pattern.test(deletionMigrationSource),
    `account-deletion migration is missing durable-state/erasure marker ${pattern}.`,
  );
}
block(
  errors,
  /next_step = 'complete'[\s\S]*user_id is null[\s\S]*initiating_session_id is null[\s\S]*completed_at is not null/.test(
    deletionMigrationSource,
  ) && /user_hash\s+text not null unique/.test(deletionMigrationSource),
  'account-deletion must retain only a pseudonymous, content-free receipt after completion.',
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
  /eraseDatabaseState\(\{ requestId: state\.requestId \}\)/.test(deletionCoreSource) &&
    deletionStepList.indexOf('database') < deletionStepList.indexOf('apple') &&
    deletionStepList.indexOf('database') < deletionStepList.indexOf('sessions') &&
    deletionStepList.indexOf('sessions') < deletionStepList.indexOf('apple') &&
    deletionStepList.indexOf('apple') < deletionStepList.indexOf('providers_final') &&
    deletionStepList.indexOf('providers_final') < deletionStepList.indexOf('auth'),
  'account-deletion must freeze data, revoke other sessions, revoke Apple, reconcile providers, and delete auth last.',
);
block(
  errors,
  deletionHandlerSource.indexOf('const durablePreflight = await stateStore.preflight') !== -1 &&
    deletionHandlerSource.indexOf('const durablePreflight = await stateStore.preflight') <
      deletionHandlerSource.indexOf('runAccountDeletionStateMachine({') &&
    /userHasProvider\(user, 'apple'\) \|\| durablePreflight\.appleRequired/.test(
      deletionHandlerSource,
    ),
  'account-deletion must read a durable Apple requirement before claim/freeze.',
);
block(
  errors,
  /auth\.admin\.signOut\(token, 'others'\)/.test(deletionSource) &&
    /async reconcileProviders\(\)[\s\S]*deleteRevenueCatSubscriber[\s\S]*deletePostHogPerson/.test(
      deletionSource,
    ),
  'account-deletion must revoke other sessions and retry final RevenueCat/PostHog deletion.',
);
block(
  errors,
  /verifiedSessionId\(token, user\.id\)/.test(deletionSource) &&
    /sessionId,\s*leaseToken/s.test(deletionSource) &&
    /initiating_session_id/.test(deletionMigrationSource) &&
    /v_request\.initiating_session_id is distinct from p_session_id/.test(
      deletionMigrationSource,
    ) &&
    /v_new ->> 'session_id' = v_initiating_session_id::text/.test(deletionMigrationSource),
  'account-deletion must bind retryable auth maintenance to the verified initiating session.',
);
block(
  errors,
  /Hosted Supabase compatibility gate/.test(deletionRecoverySource) &&
    /explicitly unsupported residual/.test(deletionRecoverySource) &&
    /RevenueCat and PostHog do not expose an account-scoped write lock/.test(
      deletionRecoverySource,
    ),
  'account-deletion must document managed-Auth and external-provider residual gates.',
);
block(
  errors,
  settingsActionsSource.indexOf('armAccountDeletionVendorFreeze(data.user.id)') !== -1 &&
    settingsActionsSource.indexOf('armAccountDeletionVendorFreeze(data.user.id)') <
      settingsActionsSource.indexOf(
        'await awaitAccountGenerationLease(lease, settleVendorIdentityResetsWithinBound)',
      ) &&
    settingsActionsSource.indexOf(
      'await awaitAccountGenerationLease(lease, settleVendorIdentityResetsWithinBound)',
    ) < settingsActionsSource.indexOf("invokeEdgeFunction<unknown>('account-deletion'") &&
    /freezeAnalyticsIdentityForAccountDeletion\(\)/.test(settingsActionsSource) &&
    /freezeRevenueCatIdentityForAccountDeletion\(\)/.test(settingsActionsSource) &&
    /Promise\.all\(\[/.test(settingsActionsSource) &&
    /ACCOUNT_DELETION_VENDOR_RESET_TIMEOUT/.test(settingsActionsSource) &&
    /Promise\.race/.test(settingsActionsSource) &&
    /assertAccountDeletionResponse\(response\)/.test(settingsActionsSource),
  'Mobile deletion must durably freeze writes, hard-bound vendor fences, and validate Edge success before sign-out.',
);
block(
  errors,
  /version: 2/.test(deletionVendorFreezeSource) &&
    /state: 'pending'/.test(deletionVendorFreezeSource) &&
    /owner_hash/.test(deletionVendorFreezeSource) &&
    /completion_token/.test(deletionVendorFreezeSource) &&
    /Crypto\.getRandomBytes\(32\)/.test(deletionVendorFreezeSource) &&
    /AsyncStorage\.setItem/.test(deletionVendorFreezeSource) &&
    /ACCOUNT_DELETION_VENDOR_FREEZE_OWNER_MISMATCH/.test(deletionVendorFreezeSource) &&
    /let writesBlocked = true/.test(deletionVendorFreezeRuntimeSource) &&
    authProviderSource.indexOf(
      'await hydrateAccountDeletionVendorFreeze(resolvedTargetUserId)',
    ) !== -1 &&
    authProviderSource.indexOf(
      'await hydrateAccountDeletionVendorFreeze(resolvedTargetUserId)',
    ) <
      authProviderSource.indexOf('setSession(latestPendingSession)') &&
    authProviderSource.indexOf('await reconcileAccountDeletionCompletionReceipt()') <
      authProviderSource.indexOf('await invalidateLocalSupabaseSession()') &&
    localPrivateDataSource.indexOf('clearAccountDeletionVendorFreezeAfterCleanup()') >
      localPrivateDataSource.indexOf('if (failed.length > 0) throw new Error'),
  'Mobile deletion freeze must survive relaunch and clear only after the final private cleanup.',
);
block(
  errors,
  /client\.functions\.invoke\('account-deletion'/.test(liveAccountCleanupSource) &&
    /data\.deleted !== true/.test(liveAccountCleanupSource) &&
    /data\.request_id/.test(liveAccountCleanupSource) &&
    /admin\.auth\.admin\.getUserById/.test(liveAccountCleanupSource) &&
    /error\?\.code === 'user_not_found'/.test(liveAccountCleanupSource) &&
    /auth absence verification failed/.test(liveAccountCleanupSource) &&
    !/auth\.admin\.deleteUser/.test(guardedCleanupHarnessSource) &&
    guardedCleanupCallerContractsHold,
  'Disposable live users must use guarded deletion, prove Auth absence, and finish cleanup before PASS.',
);
block(
  errors,
  deletionHandlerSource.indexOf('appleClientSecret = await createAppleClientSecret()') !== -1 &&
    deletionHandlerSource.indexOf('appleClientSecret = await createAppleClientSecret()') <
      deletionHandlerSource.indexOf('runAccountDeletionStateMachine({'),
  'account-deletion must validate Apple configuration and private-key parsing before claim/freeze.',
);
block(
  errors,
  /if \(response\.ok\) return 'deleted'/.test(deletionSource) &&
    !/lastStatus === 404[^\n]*return 'already_absent'/.test(deletionSource),
  'PostHog deletion must accept only a 2xx response; 404 is a provider failure.',
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
  JSON.stringify(
    edgeFunctionManifest.functions?.['account-deletion']?.requiredSecrets ?? [],
  ).includes('REVENUECAT_SECRET_API_KEY') &&
    !JSON.stringify(
      edgeFunctionManifest.functions?.['account-deletion']?.conditionalSecrets ?? [],
    ).includes('REVENUECAT_SECRET_API_KEY'),
  'Account deletion always calls RevenueCat, so its deletion API key must be mandatory in the manifest.',
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
    /randomBytes\(32\)\.toString\('hex'\)/.test(liveHarness) &&
    /a still-valid deleted-owner JWT recreated photo storage after deletion/.test(liveHarness) &&
    /RATE_LIMITED/.test(liveHarness),
  'Live data-rights harness must invoke data-export/account-deletion and prove rate limits plus stale-JWT storage denial behind an explicit run flag.',
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
