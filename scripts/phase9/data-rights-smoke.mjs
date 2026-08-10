#!/usr/bin/env node
import {
  block,
  evidenceFlagEnabled,
  has,
  listFiles,
  OWNER_LINKED_PRIVATE_TABLES,
  printResult,
  read,
  SEALED_OWNER_RPC_EXPORT_SOURCES,
  SEALED_OWNER_RPC_EXPORT_TABLES,
  SERVICE_ONLY_PRIVATE_TABLES,
  warn,
} from './lib.mjs';

const errors = [];
const warnings = [];

const exportSource = read('supabase/functions/data-export/index.ts');
const exportCoreSource = read('supabase/functions/data-export/exportCore.ts');
const catalogCorrectionExportSource = read(
  'supabase/functions/data-export/catalogCorrectionExportCore.ts',
);
const catalogCorrectionExportTestSource = read(
  'supabase/functions/data-export/catalogCorrectionExportCore.test.ts',
);
const healthSyncExportSource = read('supabase/functions/data-export/healthSyncExportCore.ts');
const healthSyncExportTestSource = read(
  'supabase/functions/data-export/healthSyncExportCore.test.ts',
);
const exportRegistrySource = read('supabase/functions/data-export/exportRegistry.ts');
const exportRegistryTestSource = read('supabase/functions/data-export/exportRegistry.test.ts');
const catalogOperatorMigration = read(
  'supabase/migrations/20260722000063_catalog_operator_authority.sql',
);
const routineCompletionSyncMigration = read(
  'supabase/migrations/20260726000069_routine_completion_sync_bridge.sql',
);
const healthLifecycleSource = read('supabase/functions/consent-withdrawal/healthLifecycleCore.ts');
const completeExportSource = `${exportSource}\n${exportCoreSource}\n${catalogCorrectionExportSource}\n${healthSyncExportSource}\n${exportRegistrySource}`;
const migrationSource = listFiles('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .map((file) => read(file))
  .join('\n');
const deletionSource = read('supabase/functions/account-deletion/index.ts');
const deletionHttpSource = read(
  'supabase/functions/account-deletion/durableDeletionHttpHandler.ts',
);
const deletionCoreSource = read('supabase/functions/account-deletion/durableDeletionCore.ts');
const deletionRuntimeCoreSource = read(
  'supabase/functions/account-deletion/durableDeletionRuntimeCore.ts',
);
const deletionRuntimeSource = read('supabase/functions/account-deletion/durableDeletionRuntime.ts');
const deletionWorkerSource = read('supabase/functions/account-deletion/durableDeletionWorker.ts');
const deletionDatabaseGatewaySource = read(
  'supabase/functions/account-deletion/durableDeletionDatabaseGateway.ts',
);
const deletionCryptoSource = read('supabase/functions/account-deletion/durableDeletionCrypto.ts');
const deletionEncryptedStateSource = read(
  'supabase/functions/account-deletion/durableDeletionEncryptedStateStore.ts',
);
const durableProviderDeletionSource = read(
  'supabase/functions/account-deletion/durableProviderDeletion.ts',
);
const deletionProviderNetworkSource = read(
  'supabase/functions/account-deletion/deletionProviderNetwork.ts',
);
const appleDeletionNetworkSource = read(
  'supabase/functions/account-deletion/appleDeletionNetwork.ts',
);
const appleDeletionExecutorSource = read(
  'supabase/functions/account-deletion/appleDeletionExecutor.ts',
);
const revenueCatV2DeletionExecutorSource = read(
  'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts',
);
const postHogDeletionExecutorSource = read(
  'supabase/functions/account-deletion/postHogDeletionExecutor.ts',
);
const photoStorageDeletionExecutorSource = read(
  'supabase/functions/account-deletion/photoStorageDeletionExecutor.ts',
);
const serviceRowsDeletionExecutorSource = read(
  'supabase/functions/account-deletion/serviceRowsDeletionExecutor.ts',
);
const authDeletionExecutorSource = read(
  'supabase/functions/account-deletion/authDeletionExecutor.ts',
);
const durableDeletionHttpTestSource = read(
  'supabase/functions/account-deletion/durableDeletionHttpHandler.test.ts',
);
const durableDeletionCoreTestSource = read(
  'supabase/functions/account-deletion/durableDeletionCore.test.ts',
);
const durableDeletionWorkerTestSource = read(
  'supabase/functions/account-deletion/durableDeletionWorker.test.ts',
);
const durableDeletionRuntimeTestSource = read(
  'supabase/functions/account-deletion/durableDeletionRuntime.test.ts',
);
const revenueCatV2DeletionExecutorTestSource = read(
  'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.test.ts',
);
const postHogDeletionExecutorTestSource = read(
  'supabase/functions/account-deletion/postHogDeletionExecutor.test.ts',
);
const appleDeletionExecutorTestSource = read(
  'supabase/functions/account-deletion/appleDeletionExecutor.test.ts',
);
const authDeletionExecutorTestSource = read(
  'supabase/functions/account-deletion/authDeletionExecutor.test.ts',
);
const localDeletionExecutorsTestSource = read(
  'supabase/functions/account-deletion/localDeletionExecutors.test.ts',
);
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
const accountObfErasureMigration = read(
  'supabase/migrations/20260713000047_account_obf_contribution_erasure.sql',
);
const accountDeletionLifecycleMigration = read(
  'supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql',
);
const revenueCatDeletionBarrierMigration = read(
  'supabase/migrations/20260713000049_revenuecat_deletion_barrier_guard.sql',
);
const serviceWriterDeletionBarrierMigration = read(
  'supabase/migrations/20260713000050_service_writer_deletion_barriers.sql',
);
const revenueCatIdentityTombstoneMigration = read(
  'supabase/migrations/20260713000051_revenuecat_identity_tombstones.sql',
);
const accountPublicationFenceMigration = read(
  'supabase/migrations/20260713000052_account_publication_fence.sql',
);
const entitlementAuthorityLanesMigration = read(
  'supabase/migrations/20260714000053_entitlement_authority_lanes.sql',
);
const accountServiceScrubPostgresRehearsal = read(
  'scripts/phase9/account-service-scrub-postgres-rehearsal.sql',
);
const accountPublicationFencePostgresRehearsal = read(
  'scripts/phase9/account-publication-fence-postgres-rehearsal.sql',
);
const entitlementAuthorityLanesPostgresRehearsal = read(
  'scripts/phase9/entitlement-authority-lanes-postgres-rehearsal.sql',
);
const catalogScanMinimizationPostgresRehearsal = read(
  'scripts/phase9/catalog-scan-minimization-postgres-rehearsal.sql',
);
const catalogScanMinimizationMigration = read(
  'supabase/migrations/20260718000059_catalog_scan_minimization.sql',
);
const catalogCorrectionIntakeStart = catalogScanMinimizationMigration.indexOf(
  'create or replace function public.submit_catalog_correction(',
);
const catalogCorrectionIntakeSource = catalogScanMinimizationMigration.slice(
  catalogCorrectionIntakeStart,
  catalogScanMinimizationMigration.indexOf(
    'create trigger trg_catalog_corrections_health_write',
    catalogCorrectionIntakeStart,
  ),
);
const orderAttributionCoreSource = read(
  'supabase/functions/order-report-poll/orderAttributionCore.ts',
);
const orderAttributionPollSource = read('supabase/functions/order-report-poll/index.ts');
const commerceZeroAdmissionMigration = read(
  'supabase/migrations/20260729000072_commerce_zero_admission.sql',
);
const completeDeletionSource = [
  deletionSource,
  deletionHttpSource,
  deletionCoreSource,
  deletionRuntimeCoreSource,
  deletionRuntimeSource,
  deletionWorkerSource,
  deletionDatabaseGatewaySource,
  deletionCryptoSource,
  deletionEncryptedStateSource,
  durableProviderDeletionSource,
  deletionProviderNetworkSource,
  appleDeletionNetworkSource,
  appleDeletionExecutorSource,
  revenueCatV2DeletionExecutorSource,
  postHogDeletionExecutorSource,
  photoStorageDeletionExecutorSource,
  serviceRowsDeletionExecutorSource,
  authDeletionExecutorSource,
  deletionProviderSource,
  deletionServiceCleanupSource,
  accountServiceScrubMigration,
  accountObfErasureMigration,
  accountDeletionLifecycleMigration,
  revenueCatDeletionBarrierMigration,
  serviceWriterDeletionBarrierMigration,
  revenueCatIdentityTombstoneMigration,
  accountPublicationFenceMigration,
  entitlementAuthorityLanesMigration,
].join('\n');
const environmentExampleSource = read('.env.example');
const edgeFunctionManifest = JSON.parse(read('supabase/functions/manifest.json'));
const deletionManifest = edgeFunctionManifest.functions?.['account-deletion'] ?? {};
const settingsActionsSource = read('apps/mobile/src/features/settings/actions.ts');
const serverDataExportContractSource = read(
  'apps/mobile/src/features/settings/serverDataExportContract.ts',
);
const accountDeletionClientStateSource = read(
  'apps/mobile/src/features/settings/accountDeletionClientState.ts',
);
const accountDeletionRecoverySource = read(
  'apps/mobile/src/features/settings/accountDeletionRecovery.ts',
);
const accountDeletionRecoveryGateSource = read(
  'apps/mobile/src/features/settings/AccountDeletionRecoveryGate.tsx',
);
const settingsActionsTestSource = read('apps/mobile/src/features/settings/actions.test.ts');
const accountDeletionRecoveryTestSource = read(
  'apps/mobile/src/features/settings/accountDeletionRecovery.test.ts',
);
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
const liveCapabilityStatusSource = liveHarness.slice(
  liveHarness.indexOf('async function postAccountDeletionStatus'),
  liveHarness.indexOf('function parseAccountDeletionBegin'),
);
const externalFetchHelper = read('supabase/functions/_shared/fetch.ts');
const storagePathHelper = read('supabase/functions/_shared/storagePath.ts');
const storagePathHelperTest = read('supabase/functions/_shared/storagePath.test.ts');
const deletionHandlerSource = deletionHttpSource.slice(
  deletionHttpSource.indexOf('return async (request: Request)'),
);
const exportHandlerSource = exportSource.slice(exportSource.indexOf('Deno.serve'));

function tableNamesBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) return [];
  return [...source.slice(start, end).matchAll(/table:\s*(["'])([^"']+)\1/g)].map(
    (match) => match[2],
  );
}

function stringLiteralsBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) return [];
  return [...source.slice(start, end).matchAll(/["']([a-z][a-z0-9_]*)["']/g)].map(
    (match) => match[1],
  );
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
const callerRpcRegistrySources = stringLiteralsBetween(
  exportRegistrySource,
  'export const CALLER_RPC_OWNER_EXPORTS',
  'export const CALLER_RPC_OWNER_EXPORT_TABLE_BY_SOURCE',
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
  'shelf_product_identities',
  'routines',
  'routine_steps',
  'routine_completions',
  'routine_conflicts',
  'active_ramp',
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
  'shelf_sync_receipts',
  'routine_completion_sync_receipts',
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
  (() => {
    const expectedExportDenylist = [
      ...SERVICE_ONLY_PRIVATE_TABLES,
      ...SEALED_OWNER_RPC_EXPORT_TABLES,
      'shelf_scans',
      'obf_contribution_queue',
      'catalog_import_batches',
      'catalog_quality_reports',
    ].sort();
    return (
      JSON.stringify([...new Set(serviceOnlyDenylist)].sort()) ===
        JSON.stringify(expectedExportDenylist) &&
      serviceOnlyDenylist.length === expectedExportDenylist.length
    );
  })(),
  'Runtime export denylist must exactly cover direct service-only tables plus purged scan/contribution stores and sealed catalog ledgers.',
);
block(
  errors,
  JSON.stringify([...new Set(callerRpcRegistrySources)].sort()) ===
    JSON.stringify(['catalog_corrections', ...SEALED_OWNER_RPC_EXPORT_SOURCES].sort()) &&
    callerRpcRegistrySources.length === SEALED_OWNER_RPC_EXPORT_SOURCES.length + 1,
  'Caller-RPC export registry must cover catalog corrections and every sealed owner-linked sync source exactly once.',
);
block(
  errors,
  /\\ir \.\.\/\.\.\/supabase\/migrations\/20260718000059_catalog_scan_minimization\.sql/.test(
    catalogScanMinimizationPostgresRehearsal,
  ) &&
    /insert into public\.shelf_scans/.test(catalogScanMinimizationPostgresRehearsal) &&
    /if exists \(select 1 from public\.shelf_scans\)/.test(
      catalogScanMinimizationPostgresRehearsal,
    ) &&
    /if exists \(select 1 from public\.obf_contribution_queue\)/.test(
      catalogScanMinimizationPostgresRehearsal,
    ) &&
    /legacy OBF contribution queue was not force-RLS sealed/.test(
      catalogScanMinimizationPostgresRehearsal,
    ) &&
    /legacy OBF contribution enqueue authority remains executable/.test(
      catalogScanMinimizationPostgresRehearsal,
    ) &&
    /0036000291452/.test(catalogScanMinimizationPostgresRehearsal) &&
    /barcode = '036000291452'/.test(catalogScanMinimizationPostgresRehearsal) &&
    /for v_index in 1\.\.96 loop/.test(catalogScanMinimizationPostgresRehearsal) &&
    /C:\\\\Users\\\\name\\\\photo\.jpg/.test(catalogScanMinimizationPostgresRehearsal) &&
    /deeply nested legacy correction was not minimized nonrecursively/.test(
      catalogScanMinimizationPostgresRehearsal,
    ) &&
    /CATALOG_LOOKUP_EVENT_RATE_LIMITED/.test(catalogScanMinimizationPostgresRehearsal) &&
    /from public\.submit_catalog_correction\(/.test(catalogScanMinimizationPostgresRehearsal) &&
    /sealed correction RPC did not persist the exact fixed-field contract/.test(
      catalogScanMinimizationPostgresRehearsal,
    ) &&
    /exact report retry did not return one immutable receipt/.test(
      catalogScanMinimizationPostgresRehearsal,
    ) &&
    /replayed report receipt did not expose current bounded status/.test(
      catalogScanMinimizationPostgresRehearsal,
    ) &&
    /CATALOG_REPORT_IDEMPOTENCY_CONFLICT/.test(catalogScanMinimizationPostgresRehearsal) &&
    /identity-free correction did not reject/.test(catalogScanMinimizationPostgresRehearsal) &&
    /nested case-folded proposed-payload barcode did not reject/.test(
      catalogScanMinimizationPostgresRehearsal,
    ) &&
    /nested case-folded client-context barcode did not reject/.test(
      catalogScanMinimizationPostgresRehearsal,
    ) &&
    /catalog_corrections_payloads_no_barcode/.test(catalogScanMinimizationPostgresRehearsal) &&
    /catalog-scan-minimization-postgres-rehearsal: pass/.test(
      catalogScanMinimizationPostgresRehearsal,
    ),
  'Disposable PostgreSQL rehearsal must execute migration 0059 against legacy raw identity, prove canonical GTIN cleanup, bound hostile correction JSON, seal deprecated OBF state, and exercise both sealed lookup and correction RPC contracts.',
);
block(
  errors,
  /drop index if exists public\.catalog_corrections_owner_request_uidx;[\s\S]*create unique index catalog_corrections_owner_request_uidx\s+on public\.catalog_corrections \(user_id, intake_request_id\)\s+where intake_request_id is not null;/.test(
    catalogScanMinimizationMigration,
  ) &&
    /catalog_report_request_digest/.test(catalogScanMinimizationMigration) &&
    catalogCorrectionIntakeStart >= 0 &&
    /on conflict \(user_id, intake_request_id\)/i.test(catalogCorrectionIntakeSource) &&
    /intake_health_epoch is distinct from p_expected_health_epoch/.test(
      catalogCorrectionIntakeSource,
    ) &&
    catalogCorrectionIntakeSource.indexOf(
      'perform public._assert_health_processing_epoch_locked(',
    ) >= 0 &&
    catalogCorrectionIntakeSource.indexOf(
      'perform public._assert_health_processing_epoch_locked(',
    ) < catalogCorrectionIntakeSource.indexOf("recent.created_at >= v_now - interval '15 minutes'"),
  'Catalog correction intake must serialize owner admission, bind request ID/epoch/body, and use an atomic ON CONFLICT replay path.',
);
block(
  errors,
  directServiceRegistryTables.filter((table) => table === 'reverse_trial_grants').length === 1 &&
    !directServiceRegistryTables.includes('obf_contribution_queue') &&
    serviceOnlyDenylist.includes('obf_contribution_queue'),
  'Direct service-role export registry must contain reverse_trial_grants exactly once while purged OBF work stays denylisted and unexportable.',
);
block(
  errors,
  /buildDirectExportPlans\(userId\)/.test(exportSource) &&
    /item\.clientKind === 'caller' \? healthSupabase : admin/.test(exportSource) &&
    /selectColumns:\s*item\.selectColumns/.test(exportSource) &&
    /EXPORT_SOURCE_DUPLICATE/.test(exportSource),
  'data-export must execute the validated caller/service plan with the selected client, allowlist, and duplicate-source guard.',
);
block(
  errors,
  /export_catalog_corrections_for_subject/.test(exportSource) &&
    /p_user_id:\s*userId/.test(exportSource) &&
    /p_after_created_at:\s*cursor\?\.createdAt \?\? null/.test(exportSource) &&
    /p_after_id:\s*cursor\?\.id \?\? null/.test(exportSource) &&
    /paginateCatalogCorrections/.test(exportSource) &&
    /expectedUserId:\s*userId/.test(exportSource) &&
    /exportCatalogCorrections\(healthSupabase, userId\)/.test(exportSource) &&
    !/\.from\(['"]catalog_corrections['"]\)/.test(exportSource) &&
    /CATALOG_CORRECTION_EXPORT_COLUMNS/.test(catalogCorrectionExportSource) &&
    /export_total_count/.test(catalogCorrectionExportSource) &&
    /COUNT_MISMATCH/.test(catalogCorrectionExportSource) &&
    /OWNER_MISMATCH/.test(catalogCorrectionExportSource) &&
    /NON_MONOTONIC_ORDER/.test(catalogCorrectionExportSource) &&
    /UNSTABLE_SNAPSHOT/.test(catalogCorrectionExportSource) &&
    /UNEXPECTED_COLUMN/.test(catalogCorrectionExportSource) &&
    /keyset-bound, count-guarded, and strips metadata/.test(catalogCorrectionExportTestSource) &&
    !directServiceRegistryTables.includes('catalog_corrections') &&
    callerRpcRegistrySources.includes('catalog_corrections') &&
    /catalog correction export excludes every internal operator field/.test(
      exportRegistryTestSource,
    ) &&
    /intake_request_id/.test(exportRegistryTestSource) &&
    /intake_health_epoch/.test(exportRegistryTestSource) &&
    /intake_request_digest/.test(exportRegistryTestSource) &&
    /create or replace function public\.export_catalog_corrections_for_subject\([\s\S]*?public\.account_access_allowed\(\)/i.test(
      catalogOperatorMigration,
    ),
  'Catalog-correction export must use the authenticated owner-scoped keyset RPC, live account-access admission, count guards, and an exact reporter-facing column allowlist.',
);
block(
  errors,
  SEALED_OWNER_RPC_EXPORT_SOURCES.every((source) => callerRpcRegistrySources.includes(source)) &&
    /paginateHealthSyncSource/.test(exportSource) &&
    /Object\.keys\(HEALTH_SYNC_EXPORT_SOURCES\)/.test(exportSource) &&
    /expectedUserId:\s*userId/.test(exportSource) &&
    /p_after_created_at:\s*cursor\?\.createdAt \?\? null/.test(exportSource) &&
    /p_after_id:\s*cursor\?\.id \?\? null/.test(exportSource) &&
    /export_total_count/.test(healthSyncExportSource) &&
    /OWNER_MISMATCH/.test(healthSyncExportSource) &&
    /NON_MONOTONIC_ORDER/.test(healthSyncExportSource) &&
    /UNSTABLE_SNAPSHOT/.test(healthSyncExportSource) &&
    /UNEXPECTED_COLUMN/.test(healthSyncExportSource) &&
    /request_sha256/.test(healthSyncExportTestSource) &&
    /internal request fingerprints/.test(healthSyncExportTestSource) &&
    /health_sync_request_fingerprints/.test(exportSource) &&
    /create or replace function public\.export_shelf_product_identities_for_subject\(/i.test(
      routineCompletionSyncMigration,
    ) &&
    /create or replace function public\.export_shelf_sync_receipts_for_subject\(/i.test(
      routineCompletionSyncMigration,
    ) &&
    /create or replace function public\.export_routine_completion_sync_receipts_for_subject\(/i.test(
      routineCompletionSyncMigration,
    ) &&
    !/request_sha256['"]?\s*,?\s*$/m.test(
      healthSyncExportSource.match(
        /shelf_sync_receipts:\s*\{[\s\S]*?columns:\s*\[([\s\S]*?)\]/,
      )?.[1] ?? '',
    ) &&
    !/request_sha256['"]?\s*,?\s*$/m.test(
      healthSyncExportSource.match(
        /routine_completion_sync_receipts:\s*\{[\s\S]*?columns:\s*\[([\s\S]*?)\]/,
      )?.[1] ?? '',
    ),
  'Sealed Shelf identity and sync ledgers must use authenticated subject-derived keyset RPCs, exact receipt projections, two-pass count/checksum guards, and an explicit request-fingerprint exclusion.',
);
block(
  errors,
  /table:\s*["']reverse_trial_grants["'][\s\S]*?scope:\s*["']service_role_filtered["'][\s\S]*?selectColumns:\s*["']user_id, granted_at, expires_at, source, metadata["']/.test(
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
  !directServiceRegistryTables.includes('obf_contribution_queue') &&
    serviceOnlyDenylist.includes('obf_contribution_queue') &&
    /delete from public\.obf_contribution_queue;/.test(catalogScanMinimizationMigration) &&
    /alter table public\.obf_contribution_queue force row level security;/.test(
      catalogScanMinimizationMigration,
    ) &&
    /revoke all on table public\.obf_contribution_queue[\s\S]*from public, anon, authenticated, service_role;/.test(
      catalogScanMinimizationMigration,
    ) &&
    /revoke all on function public\.enqueue_obf_contribution_for_correction\(uuid\)[\s\S]*from public, anon, authenticated, service_role;/.test(
      catalogScanMinimizationMigration,
    ),
  'Purged OBF contribution work must be absent from executable export coverage and migration-sealed from every runtime role.',
);

for (const pattern of [
  /CALLER_RLS_EXPORT_TABLES/,
  /SERVICE_ROLE_FILTERED_EXPORTS/,
  /local_only_photo_note/,
  /exclusion_register/,
  /createSignedUrl/,
  /photoPathBelongsToUser/,
  /photo_download_url_omissions/,
  /health_consent_lifecycle/,
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
  /get_health_data_consent_status/.test(exportSource) &&
    /initialHealthLifecycle/.test(exportSource) &&
    /finalHealthLifecycle/.test(exportSource) &&
    /healthReadEpochForExport\(initialHealthLifecycle\)/.test(exportSource) &&
    /'x-health-processing-epoch': String\(healthReadEpoch\)/.test(exportSource) &&
    /item\.clientKind === 'caller' \? healthSupabase : admin/.test(exportSource) &&
    /exportHealthSyncRecords\(healthSupabase, userId, source\)/.test(exportSource) &&
    /healthReadEpochForExport/.test(exportCoreSource) &&
    /healthLifecycleExportDecision/.test(exportSource) &&
    /HEALTH_DATA_WITHDRAWAL_IN_PROGRESS/.test(exportCoreSource) &&
    /Retry-After/.test(exportSource),
  'data-export must pin the initial health epoch for caller reads and reject nonterminal or changing withdrawal snapshots with a retry contract.',
);
block(
  errors,
  /export_schema_version:\s*4/.test(exportSource) &&
    /healthLifecycleExportSnapshot/.test(exportSource) &&
    /processing_epoch/.test(healthLifecycleSource) &&
    !/operation_id:\s*row\.operation_id/.test(
      healthLifecycleSource.match(/healthLifecycleExportSnapshot[\s\S]*?\n\}/)?.[0] ?? '',
    ),
  'data-export schema v4 must include sanitized health lifecycle status without an internal operation id.',
);
block(
  errors,
  /Includes data saved to your account and on this device:/.test(settingsRouteSource) &&
    /completion history, preferences, Progress notes, and pending or terminal shelf and completion sync records\./.test(
      settingsRouteSource,
    ) &&
    /Photo files and thumbnails stay encrypted here;/.test(settingsRouteSource) &&
    /share images individually from Progress\./.test(settingsRouteSource) &&
    /Progress photos stay encrypted here unless you share one\./.test(settingsRouteSource) &&
    !/Photos stay on your device by default\./.test(settingsRouteSource),
  'Settings must disclose local-first export coverage and the Progress media-file exclusion.',
);
block(
  errors,
  /collectLocalDeviceExportData\(lease, expectedUserId\)/.test(settingsActionsSource) &&
    /readLocalDataOwnership\(expectedUserId\)/.test(settingsActionsSource) &&
    /if \(isSupabaseConfigured\)/.test(settingsActionsSource) &&
    /serverAccountDataStatus = 'included'/.test(settingsActionsSource) &&
    /decodeServerDataExport\(response\.data, expectedUserId\)/.test(settingsActionsSource) &&
    /SERVER_DATA_EXPORT_SCHEMA_VERSION = 4/.test(serverDataExportContractSource) &&
    /hasExactKeys\(parsed, expectedTopLevelKeys\)/.test(serverDataExportContractSource) &&
    /hasExactKeys\(manifest\.sources, ALL_MANIFEST_SOURCES\)/.test(
      serverDataExportContractSource,
    ) &&
    /requireOwnerRows/.test(serverDataExportContractSource) &&
    /buildMobileDataExportBundle/.test(settingsActionsSource),
  'Mobile export must combine local device data with a validated configured server account bundle.',
);
block(
  errors,
  /LOCAL_PRIVATE_DATA_KEYS/.test(localDeviceExportSource) &&
    /LOCAL_DEVICE_EXPORT_STORAGE_KEYS/.test(localDeviceExportSource) &&
    /getPrivateItemsForPurposeLimitedExport\(\s*LOCAL_DEVICE_EXPORT_STORAGE_KEYS,\s*accountLease,\s*\)/s.test(
      localDeviceExportSource,
    ) &&
    /decryptPhotoNoteForPurposeLimitedExport\(ciphertext, accountLease\)/.test(
      localDeviceExportSource,
    ) &&
    /accountLease\.assertCurrent\(\)/.test(localDeviceExportSource) &&
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
    /Layerwell/.test(exportSource),
  'data-export attachment filename must use the runtime display name with a Layerwell fallback.',
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
  !/filename="layerwell-export\.json"/.test(exportSource) &&
    !/const dataExportFileName = 'layerwell-export\.json'/.test(exportSource),
  'data-export must not expose the legacy export filename in response headers.',
);

block(
  errors,
  /createDurableDeletionRuntime/.test(deletionSource) &&
    /createDurableDeletionHttpHandler/.test(deletionSource) &&
    /EdgeRuntime/.test(deletionSource) &&
    /waitUntil\(work\)/.test(deletionSource) &&
    /const handler = createDurableDeletionHttpHandler\(dependencies\)/.test(deletionSource) &&
    /Deno\.serve\(\(request\) => stagingTrafficFreezeResponse\(\) \?\? handler\(request\)\)/.test(
      deletionSource,
    ),
  'Account deletion entrypoint must compose the durable runtime, mixed HTTP boundary, best-effort EdgeRuntime acceleration, and staging freeze before handler admission.',
);
const deletionMethodIndex = deletionHandlerSource.search(/request\.method !== ['"]POST['"]/);
const deletionLengthIndex = deletionHandlerSource.indexOf(
  'contentLengthTooLarge(request, dependencies.maxBodyBytes)',
);
const deletionReadIndex = deletionHandlerSource.indexOf('readLimitedJson(');
const deletionParseIndex = deletionHandlerSource.indexOf('parseAccountDeletionRequest(body)');

block(
  errors,
  /request\.method === ['"]OPTIONS['"]/.test(deletionHandlerSource) &&
    deletionMethodIndex !== -1 &&
    deletionLengthIndex !== -1 &&
    deletionReadIndex !== -1 &&
    deletionParseIndex !== -1 &&
    deletionMethodIndex < deletionLengthIndex &&
    deletionLengthIndex < deletionReadIndex &&
    deletionReadIndex < deletionParseIndex,
  'Account deletion HTTP boundary must reject methods and oversized/malformed bodies before auth or side effects.',
);
block(
  errors,
  deletionHandlerSource.search(/parsed\.action === ['"]status['"]/) !== -1 &&
    deletionHandlerSource.indexOf('const token = bearerToken(request)') !== -1 &&
    deletionHandlerSource.search(/parsed\.action === ['"]status['"]/) <
      deletionHandlerSource.indexOf('const token = bearerToken(request)') &&
    /dependencies\.status\(parsed\.capability\)/.test(deletionHandlerSource) &&
    /lookup\.kind !== ['"]not_found['"]\s*&&\s*lookup\.kind !== ['"]expired['"]/.test(
      deletionHandlerSource,
    ) &&
    /mapPublicDeletionStatus\(lookup\)/.test(deletionHandlerSource),
  'Capability status must remain JWT-independent and avoid public write amplification for invalid/expired probes.',
);
block(
  errors,
  /bearerToken\(request\)/.test(deletionHttpSource) &&
    /consumeIntakeRateLimit\(user\.id, user\.sessionId\)/.test(deletionHttpSource) &&
    /dependencies\.begin\(user, parsed\)/.test(deletionHttpSource) &&
    /if \(result\.created\)/.test(deletionHttpSource) &&
    /scheduleAcceleration\(dependencies, result\.operationId, user\.id\)/.test(
      deletionHttpSource,
    ) &&
    /status:\s*['"]accepted['"]/.test(deletionHttpSource) &&
    /,\s*202,?\s*\)/.test(deletionHttpSource) &&
    /x-account-deletion-worker-secret/.test(deletionHttpSource) &&
    /constantTimeEqual\(supplied, dependencies\.workerSecret\)/.test(deletionHttpSource) &&
    /ACCOUNT_DELETION_UNAVAILABLE/.test(deletionHttpSource),
  'Account deletion must separate owner-limited authenticated 202 intake, newly-created targeted acceleration, capability status, and constant-time worker authorization behind stable public errors.',
);
block(
  errors,
  /durable deletion begin authenticates, commits 202, and accelerates work/.test(
    durableDeletionHttpTestSource,
  ) &&
    /capability-only status maps pending, completed, invalid, and expired/.test(
      durableDeletionHttpTestSource,
    ) &&
    /invalid and expired capabilities must not amplify writes/.test(
      durableDeletionHttpTestSource,
    ) &&
    /idempotent begin retries share the owner quota and never fan out acceleration/.test(
      durableDeletionHttpTestSource,
    ) &&
    /worker lane requires the dedicated constant-time header/.test(durableDeletionHttpTestSource) &&
    /dependency failures expose only one stable public code/.test(durableDeletionHttpTestSource),
  'Executable HTTP contracts must cover exact async intake, capability receipts, no-write misses, worker auth, and contained failures.',
);
block(
  errors,
  /DELETION_STATUS_CAPABILITY_DIGEST_CONTEXT/.test(deletionCoreSource) &&
    /DELETION_IDEMPOTENCY_DIGEST_CONTEXT/.test(deletionCoreSource) &&
    /validateDeletionIntakeTokens/.test(deletionRuntimeCoreSource) &&
    /hasExactKeys\(value, expectedKeys\)/.test(deletionRuntimeCoreSource) &&
    /mapPublicDeletionStatus/.test(deletionCoreSource) &&
    /httpStatus: 200/.test(deletionCoreSource) &&
    /httpStatus: 202/.test(deletionCoreSource) &&
    /httpStatus: 404/.test(deletionCoreSource) &&
    /httpStatus: 410/.test(deletionCoreSource) &&
    /capability and idempotency digests match schema domain separation/.test(
      durableDeletionCoreTestSource,
    ),
  'Deletion tokens and public receipts must use exact-key validation, domain-separated digests, and executable 200/202/404/410 mappings.',
);
block(
  errors,
  /create table public\.account_deletion_operations/.test(accountDeletionLifecycleMigration) &&
    /create table public\.account_deletion_barriers/.test(accountDeletionLifecycleMigration) &&
    /create table public\.account_deletion_steps/.test(accountDeletionLifecycleMigration) &&
    /create table public\.account_deletion_receipts/.test(accountDeletionLifecycleMigration) &&
    (accountDeletionLifecycleMigration.match(/force row level security/g)?.length ?? 0) >= 5 &&
    /No Auth FK is deliberate/.test(accountDeletionLifecycleMigration) &&
    /purge_after > expires_at/.test(accountDeletionLifecycleMigration),
  'Durable deletion operations, barriers, steps, and finite receipts must be forced-RLS service state that survives Auth deletion until finalization.',
);
block(
  errors,
  /begin_account_deletion/.test(deletionDatabaseGatewaySource) &&
    /get_account_deletion_status/.test(deletionDatabaseGatewaySource) &&
    /claimOperation/.test(deletionDatabaseGatewaySource) &&
    /claim_account_deletion_step/.test(deletionDatabaseGatewaySource) &&
    /claim_next_account_deletion_step/.test(deletionDatabaseGatewaySource) &&
    /mark_account_deletion_step_request_started/.test(deletionDatabaseGatewaySource) &&
    /record_account_deletion_step/.test(deletionDatabaseGatewaySource) &&
    /finalize_account_deletion/.test(deletionDatabaseGatewaySource) &&
    /purge_expired_account_deletion_artifacts/.test(deletionDatabaseGatewaySource),
  'The runtime database gateway must expose only the reviewed durable lifecycle RPCs, including request-start, finalization, and finite purge.',
);
block(
  errors,
  /readEdgeAppEnvironment\(readEnvironment\)/.test(deletionRuntimeSource) &&
    /deletionIntakeOwnerHmac\(receiptKey\.key, userId\)/.test(deletionRuntimeSource) &&
    /ACCOUNT_DELETION_INTAKE_OWNER_HMAC_CONTEXT/.test(deletionRuntimeCoreSource) &&
    /runtime requires one valid, non-conflicting application environment/.test(
      durableDeletionRuntimeTestSource,
    ) &&
    /caller-minted idempotency keys cannot select intake buckets/.test(
      durableDeletionRuntimeTestSource,
    ) &&
    !/delete from public\.edge_rate_limits\s+where owner_user_id = p_user_id/.test(
      accountDeletionLifecycleMigration,
    ),
  'Deletion runtime must fail closed on environment ambiguity and retain one owner-derived intake quota until Auth cascade.',
);
block(
  errors,
  /process_revenuecat_webhook_event_guarded/.test(revenueCatDeletionBarrierMigration) &&
    /account_deletion_barriers/.test(revenueCatDeletionBarrierMigration) &&
    /revoke all on function public\.process_revenuecat_webhook_event\(/.test(
      revenueCatDeletionBarrierMigration,
    ) &&
    /account_write_allowed\(p_user_id\)/.test(serviceWriterDeletionBarrierMigration) &&
    /ACCOUNT_DELETION_IN_PROGRESS/.test(serviceWriterDeletionBarrierMigration) &&
    /enqueue_obf_contribution_for_correction/.test(serviceWriterDeletionBarrierMigration) &&
    /create table public\.revenuecat_identity_tombstones/.test(
      revenueCatIdentityTombstoneMigration,
    ) &&
    /force row level security/.test(revenueCatIdentityTombstoneMigration) &&
    /establish_revenuecat_deletion_identity_barrier/.test(revenueCatIdentityTombstoneMigration) &&
    /_revenuecat_identity_tombstone_advisory_key/.test(revenueCatIdentityTombstoneMigration) &&
    /purge_expired_revenuecat_identity_tombstones/.test(revenueCatIdentityTombstoneMigration),
  'Webhook and service writers must serialize against deletion while RevenueCat identities remain HMAC-tombstoned, ingress-suppressed, and finitely purgeable.',
);
block(
  errors,
  /insert into public\.reverse_trial_grants/.test(entitlementAuthorityLanesMigration) &&
    /delete from public\.entitlements/.test(entitlementAuthorityLanesMigration) &&
    /metadata = pg_catalog\.jsonb_build_object/.test(entitlementAuthorityLanesMigration) &&
    /public\.account_write_allowed\(p_user_id\)/.test(entitlementAuthorityLanesMigration) &&
    /v_user_id uuid := \(select auth\.uid\(\)\)/.test(entitlementAuthorityLanesMigration) &&
    /REHEARSAL_0051_PRIVACY_SCRUB_COMPATIBILITY_FAILED/.test(
      entitlementAuthorityLanesPostgresRehearsal,
    ) &&
    /ENTITLEMENT_AUTHORITY_LANES_POSTGRES_REHEARSAL_PASS/.test(
      entitlementAuthorityLanesPostgresRehearsal,
    ),
  'Migration 0053 must preserve deletion coverage while separating authority lanes, minimizing recovered app-grant metadata, deriving owner reads, and retaining 0051 privacy-scrub compatibility.',
);
block(
  errors,
  /ACCOUNT_PUBLICATION_FENCE_REQUIRES_ZERO_ACTIVE_DELETIONS/.test(
    accountPublicationFenceMigration,
  ) &&
    /lock table public\.account_deletion_operations,\s*public\.account_deletion_barriers\s*in access exclusive mode/i.test(
      accountPublicationFenceMigration,
    ) &&
    /create table public\.account_publication_leases/.test(accountPublicationFenceMigration) &&
    /alter table public\.account_publication_leases force row level security/.test(
      accountPublicationFenceMigration,
    ) &&
    /reserve_account_publication_lease/.test(accountPublicationFenceMigration) &&
    /activate_account_publication_lease/.test(accountPublicationFenceMigration) &&
    /renew_account_publication_lease/.test(accountPublicationFenceMigration) &&
    /release_account_publication_lease/.test(accountPublicationFenceMigration) &&
    /record_account_deletion_revenuecat_absence_observation/.test(
      accountPublicationFenceMigration,
    ) &&
    /reset_account_deletion_revenuecat_absence_observations/.test(
      accountPublicationFenceMigration,
    ) &&
    /revenuecat_absence_last_claim_digest/.test(accountPublicationFenceMigration) &&
    /interval '60 seconds'/.test(accountPublicationFenceMigration) &&
    /publication_settle_not_before[\s\S]*interval '5 minutes'/.test(
      accountPublicationFenceMigration,
    ) &&
    /alter function public\.begin_account_deletion\([\s\S]*?\) rename to _begin_account_deletion_v0048_unbound/.test(
      accountPublicationFenceMigration,
    ) &&
    /create or replace function public\.begin_account_deletion\(\s*p_user_id uuid,\s*p_session_id uuid,/.test(
      accountPublicationFenceMigration,
    ) &&
    /create or replace function public\.get_account_deletion_barrier_state\(\s*p_user_id uuid,\s*p_session_id uuid\s*\)/.test(
      accountPublicationFenceMigration,
    ) &&
    /create or replace function public\.consume_edge_rate_limit\([\s\S]*?p_owner_user_id uuid,\s*p_session_id uuid\s*\)/.test(
      accountPublicationFenceMigration,
    ) &&
    (accountPublicationFenceMigration.match(/for key share/g)?.length ?? 0) >= 6 &&
    /ACCOUNT_DELETION_SESSION_REJECTED[\s\S]*errcode = '28000'/.test(
      accountPublicationFenceMigration,
    ) &&
    /dblink_send_query/.test(accountPublicationFencePostgresRehearsal) &&
    /REHEARSAL_SIGNED_OUT_SESSION_BEGIN_ALLOWED/.test(accountPublicationFencePostgresRehearsal) &&
    /ACCOUNT_PUBLICATION_FENCE_POSTGRES_REHEARSAL_PASS/.test(
      accountPublicationFencePostgresRehearsal,
    ),
  'Migration 0052 must install only at zero active deletions, bind authenticated intake to an exact live session, drain finite publication authority, require two claim-distinct RevenueCat absence rounds, seal every RPC/table boundary, and retain deterministic concurrency rehearsal coverage.',
);
block(
  errors,
  /sessionId: string/.test(deletionDatabaseGatewaySource) &&
    /begin_account_deletion[\s\S]*p_session_id: input\.sessionId/.test(
      deletionDatabaseGatewaySource,
    ) &&
    /barrierState\(userId: string, sessionId: string\)[\s\S]*p_session_id: sessionId/.test(
      deletionDatabaseGatewaySource,
    ) &&
    /args\.scope === 'account-deletion-intake'[\s\S]*args\.sessionId/.test(
      deletionDatabaseGatewaySource,
    ) &&
    /consumeIntakeRateLimit\(user\.id, user\.sessionId\)/.test(deletionHttpSource) &&
    /barrierState\(user\.id, user\.sessionId\)/.test(deletionHttpSource) &&
    /DELETION_DATABASE_SESSION_REJECTED/.test(deletionDatabaseGatewaySource) &&
    /ACCOUNT_DELETION_SESSION_REJECTED/.test(deletionHttpSource),
  'Edge deletion intake, quota, and preflight must carry the exact authenticated session into migration-0052 RPCs and map only SQLSTATE 28000 to the stable 401 session-rejected response.',
);
block(
  errors,
  /AES-GCM/.test(deletionCryptoSource) &&
    /ACCOUNT_DELETION_PAYLOAD_KEY_HEX/.test(deletionCryptoSource) &&
    /sealDeletionPayload/.test(deletionRuntimeSource) &&
    /openDeletionPayload/.test(deletionEncryptedStateSource) &&
    /update_account_deletion_step_payload/.test(deletionDatabaseGatewaySource),
  'Provider retry state and Apple revocation material must be authenticated-encrypted before durable storage.',
);
block(
  errors,
  /let nextMode: AccountDeletionClaimMode = ['"]reconcile['"]/.test(deletionWorkerSource) &&
    /nextMode === ['"]reconcile['"] \? ['"]dispatch['"] : ['"]reconcile['"]/.test(
      deletionWorkerSource,
    ) &&
    /deadlineAtMs/.test(deletionWorkerSource) &&
    /gateway\.finalize/.test(deletionWorkerSource) &&
    /gateway\.purgeExpiredArtifacts/.test(deletionWorkerSource) &&
    /worker alternates reconcile and dispatch, then finalizes and purges/.test(
      durableDeletionWorkerTestSource,
    ),
  'The bounded worker must prioritize reconciliation, alternate fairly, finalize receipts, and purge finite artifacts.',
);
block(
  errors,
  /apple_revoke[\s\S]*step_order = 10/.test(accountDeletionLifecycleMigration) &&
    /revenuecat_delete[\s\S]*step_order = 20/.test(accountDeletionLifecycleMigration) &&
    /posthog_delete[\s\S]*step_order = 30/.test(accountDeletionLifecycleMigration) &&
    /photo_storage_delete[\s\S]*step_order = 40/.test(accountDeletionLifecycleMigration) &&
    /service_rows_scrub[\s\S]*step_order = 50/.test(accountDeletionLifecycleMigration) &&
    /auth_user_delete[\s\S]*step_order = 60/.test(accountDeletionLifecycleMigration) &&
    /executeAppleDeletionStep/.test(deletionRuntimeSource) &&
    /createRevenueCatV2DeletionExecutor/.test(deletionRuntimeSource) &&
    /createPostHogDeletionExecutor/.test(deletionRuntimeSource) &&
    /executePhotoStorageDeletionStep/.test(deletionRuntimeSource) &&
    /executeServiceRowsDeletionStep/.test(deletionRuntimeSource) &&
    /executeAuthDeletionStep/.test(deletionRuntimeSource),
  'The durable step graph must erase providers before local storage/service rows and hard-delete Auth only last.',
);
block(
  errors,
  /fetcher: fetchWithTimeout/.test(deletionRuntimeSource) &&
    /createDeletionProviderJsonNetwork/.test(deletionRuntimeSource) &&
    /readLimitedResponseText/.test(deletionProviderNetworkSource) &&
    /readLimitedResponseText/.test(appleDeletionNetworkSource) &&
    !/await fetch\(/.test(
      `${deletionRuntimeSource}\n${deletionProviderNetworkSource}\n${appleDeletionNetworkSource}`,
    ) &&
    (durableProviderDeletionSource.match(/redirect: ['"]error['"]/g)?.length ?? 0) >= 1,
  'All credential-bearing deletion calls must use injected timed fetches, bounded bodies, and fail-closed redirects.',
);
block(
  errors,
  deletionManifest.requiredSecrets?.some(
    (group) => group.length === 1 && group[0] === 'REVENUECAT_V2_SECRET_API_KEY',
  ) &&
    /requiredEnv\(\s*readEnvironment,\s*['"]REVENUECAT_V2_SECRET_API_KEY['"]/.test(
      deletionRuntimeSource,
    ) &&
    !/REVENUECAT_SECRET_API_KEY|REVENUECAT_REST_API_KEY/.test(
      `${deletionRuntimeSource}\n${JSON.stringify(deletionManifest)}`,
    ) &&
    /200, 202, and 404 acknowledgements persist before reconciliation transition/.test(
      revenueCatV2DeletionExecutorTestSource,
    ) &&
    /post-send transport ambiguity persists evidence and never redispatches DELETE/.test(
      revenueCatV2DeletionExecutorTestSource,
    ) &&
    /terminal success requires exact GET absence for full identity family/.test(
      revenueCatV2DeletionExecutorTestSource,
    ) &&
    /establishIdentityBarrier/.test(revenueCatV2DeletionExecutorSource),
  'RevenueCat deletion must use only a current V2 secret, persist ambiguous dispatch evidence, reconcile the complete identity family, and establish its tombstone barrier.',
);
block(
  errors,
  /persons\/bulk_delete\//.test(durableProviderDeletionSource) &&
    /delete_events: true/.test(durableProviderDeletionSource) &&
    /delete_recordings: options\.deleteRecordings/.test(durableProviderDeletionSource) &&
    /deleteRecordings: false/.test(postHogDeletionExecutorSource) &&
    /partial statuses and absence observations survive bounded invocations to terminal success/.test(
      postHogDeletionExecutorTestSource,
    ) &&
    /quiescence requires two absences at or beyond the configured interval/.test(
      postHogDeletionExecutorTestSource,
    ) &&
    /recording attestation is explicit, durable, current, and fail-closed/.test(
      postHogDeletionExecutorTestSource,
    ) &&
    !/POSTHOG_ENVIRONMENT_ID|\/api\/environments\//.test(completeDeletionSource),
  'PostHog deletion must durably reconcile asynchronous event/person erasure, prove quiescent absence, and fail closed on recording evidence without deprecated endpoints.',
);
block(
  errors,
  /https:\/\/appleid\.apple\.com\/auth\/token/.test(appleDeletionNetworkSource) &&
    /https:\/\/appleid\.apple\.com\/auth\/revoke/.test(appleDeletionNetworkSource) &&
    /Apple code exchange persists token before idempotent revoke/.test(
      appleDeletionExecutorTestSource,
    ) &&
    /Apple reconciliation never replays an unpersisted one-time exchange/.test(
      appleDeletionExecutorTestSource,
    ) &&
    /persisted Apple token safely retries after crash and transport loss/.test(
      appleDeletionExecutorTestSource,
    ),
  'Apple deletion must durably cross the one-time code exchange before retry-safe token revocation.',
);
block(
  errors,
  /Storage uses the attested worklist and re-counts after removal/.test(
    localDeletionExecutorsTestSource,
  ) &&
    /Service scrub attests atomic success without a fake network marker/.test(
      localDeletionExecutorsTestSource,
    ) &&
    /Auth dispatch hard-deletes once then verifies exact absence/.test(
      authDeletionExecutorTestSource,
    ) &&
    /Auth reconciliation is GET-only and succeeds on exact 404/.test(
      authDeletionExecutorTestSource,
    ) &&
    /hardDeleteUser: \(userId\)/.test(deletionRuntimeSource),
  'Local storage, service rows, and Auth deletion must use exact absence attestations and never replay an ambiguous Auth DELETE.',
);
block(
  errors,
  deletionManifest.access === 'mixed' &&
    deletionManifest.public === true &&
    deletionManifest.verifyJwt === false &&
    /bearer JWT for begin/.test(deletionManifest.auth ?? '') &&
    /256-bit capability for status/.test(deletionManifest.auth ?? '') &&
    /worker secret for scheduled work/.test(deletionManifest.auth ?? '') &&
    deletionManifest.conditionalEnvironment?.some(
      (condition) =>
        /Sign in with Apple identity/.test(condition.when) &&
        condition.anyOf?.length === 1 &&
        condition.anyOf[0] === 'APPLE_SIWA_CLIENT_ID',
    ) &&
    deletionManifest.conditionalSecrets?.some(
      (condition) =>
        /PostHog deletion signal/.test(condition.when) &&
        condition.anyOf?.length === 1 &&
        condition.anyOf[0] === 'POSTHOG_PERSONAL_API_KEY',
    ),
  'Account deletion manifest must declare the mixed boundary and fail closed on Apple/PostHog provider credentials.',
);
block(
  errors,
  /readPersistedSupabaseSessionCandidate\(\)/.test(settingsActionsSource) &&
    /supabase\.auth\.getUser\(session\.access_token\)/.test(settingsActionsSource) &&
    /requireSupabaseRemoteSessionBinding\(session\.access_token, user\.id\)/.test(
      settingsActionsSource,
    ) &&
    /assertStoreTransactionDeletionJournalReadable\(owner\.ownerBinding\)/.test(
      settingsActionsSource,
    ) &&
    /beginSupabaseRemoteDeletionBoundary\(remoteBinding\)/.test(settingsActionsSource) &&
    /startRevenueCatDeletionQuiesce\(expectedUserId\)/.test(settingsActionsSource) &&
    /await quiescing\.publicationQuiescence/.test(settingsActionsSource) &&
    /preparePendingAccountDeletion\(quiescing\.owner\.ownerBinding\)/.test(settingsActionsSource) &&
    /accountDeletionRecordMatchesOwner\(pending, quiescing\.owner\.ownerBinding\)/.test(
      settingsActionsSource,
    ) &&
    /runWithSupabaseAccountDeletionRequestPermit/.test(settingsActionsSource) &&
    /Authorization: `Bearer \$\{owner\.accessToken\}`/.test(settingsActionsSource) &&
    /action: 'begin'/.test(settingsActionsSource) &&
    /idempotencyKey: pending\.idempotencyKey/.test(settingsActionsSource) &&
    /statusCapability: pending\.statusCapability/.test(settingsActionsSource) &&
    /response\.status !== 202/.test(settingsActionsSource) &&
    /markAccountDeletionIntakeState\(['"]accepted['"], ownerBinding\)/.test(
      settingsActionsSource,
    ) &&
    /markAccountDeletionIntakeState\(['"]ambiguous['"], ownerBinding\)/.test(
      settingsActionsSource,
    ) &&
    /commitAmbiguousIntakeAndQuarantine/.test(settingsActionsSource) &&
    /accepted_or_ambiguous/.test(settingsActionsTestSource),
  'Mobile deletion intake must persist independent secrets before the request, accept only exact HTTP 202, and preserve ambiguous transport recovery.',
);
block(
  errors,
  /WHEN_UNLOCKED_THIS_DEVICE_ONLY/.test(accountDeletionClientStateSource) &&
    /loadPendingAccountDeletion/.test(accountDeletionClientStateSource) &&
    /commitCompletedAccountDeletion/.test(accountDeletionClientStateSource) &&
    /clearCompletedAccountDeletionState/.test(accountDeletionClientStateSource) &&
    /credentials: 'omit'/.test(accountDeletionRecoverySource) &&
    /body: JSON\.stringify\(\{ action: 'status', capability: statusCapability \}\)/.test(
      accountDeletionRecoverySource,
    ) &&
    /\[200, 202, 404, 410\]/.test(accountDeletionRecoverySource) &&
    /uses only the capability plus the public project key/.test(
      accountDeletionRecoveryTestSource,
    ) &&
    /AccountDeletionRecoveryGate/.test(accountDeletionRecoveryGateSource),
  'Mobile startup must recover before Auth with a device-only capability, exact receipt parsing, and terminal-local commit ordering.',
);
block(
  errors,
  /scrubAccountServiceRows/.test(deletionRuntimeSource) &&
    /ACCOUNT_SERVICE_SCRUB_FAILED/.test(deletionServiceCleanupSource) &&
    /rpc\(ACCOUNT_SERVICE_SCRUB_RPC/.test(deletionServiceCleanupSource) &&
    /complete\s*!==\s*true/.test(deletionServiceCleanupSource) &&
    /residual_order_attributions\s*!==\s*0/.test(deletionServiceCleanupSource) &&
    /residual_obf_contributions\s*!==\s*0/.test(deletionServiceCleanupSource) &&
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
  /delete\s+from\s+public\.obf_contribution_queue\s+where\s+user_id\s+is\s+null/i.test(
    accountObfErasureMigration,
  ) &&
    /alter\s+column\s+user_id\s+set\s+not\s+null/i.test(accountObfErasureMigration) &&
    /foreign\s+key\s*\(\s*user_id\s*\)[\s\S]*references\s+auth\.users\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i.test(
      accountObfErasureMigration,
    ) &&
    /delete\s+from\s+public\.obf_contribution_queue\s+as\s+contribution[\s\S]*contribution\.user_id\s*=\s*p_user_id/i.test(
      accountObfErasureMigration,
    ) &&
    /REHEARSAL_DIRECT_AUTH_DELETE_LEFT_OBF_PAYLOAD/.test(accountServiceScrubPostgresRehearsal) &&
    /REHEARSAL_OBF_RETRY_NOT_IDEMPOTENT/.test(accountServiceScrubPostgresRehearsal),
  'OBF contribution payloads must have mandatory Auth ownership, atomic scrub coverage, direct-delete cascade, and idempotent rehearsal proof.',
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
  /COM-01A: commerce admission closed/.test(orderAttributionPollSource) &&
    !/(?:Deno\.env|SHOPMY|createClient|fetch|persistOrderAttributionPage|pollOrderReportPages|order_attributions)/i.test(
      orderAttributionPollSource,
    ) &&
    /findKnownClickTokens/.test(orderAttributionCoreSource) &&
    /knownTokens\.has\(candidate\) \? candidate : null/.test(orderAttributionCoreSource) &&
    /ORDER_REPORT_UPSTREAM_FAILED/.test(orderAttributionCoreSource) &&
    /ORDER_REPORT_PAGE_LIMIT_EXCEEDED/.test(orderAttributionCoreSource) &&
    /adaptShopMyOrderReportItem/.test(orderAttributionCoreSource) &&
    /create trigger order_attributions_admission_closed[\s\S]*before insert or update/.test(
      commerceZeroAdmissionMigration,
    ) &&
    /COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED/.test(commerceZeroAdmissionMigration),
  'COM-01A must keep the deployed poll inert and database publication closed while the quarantined adapter retains unknown/deleted click-token safety.',
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
  /dependency failures expose only one stable public code/.test(durableDeletionHttpTestSource) &&
    /invalid secret errors contain only stable codes/.test(durableDeletionCoreTestSource) &&
    /runtime rejects missing mandatory deletion configuration with a stable code/.test(
      durableDeletionRuntimeTestSource,
    ) &&
    !/console\.(?:error|warn|log)\(/.test(completeDeletionSource) &&
    !/return json\(\{ deleted:/.test(deletionHttpSource),
  'Account deletion must contain runtime/provider failures behind stable codes without raw logs or obsolete synchronous success claims.',
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
  !/layerwell-export-\$\{Date\.now\(\)\}/.test(settingsActionsSource) &&
    !/layerwell-export\.json/.test(settingsActionsSource),
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
  /account-deletion\/\*\.test\.ts/.test(
    packageJson.scripts?.['phase9:account-deletion-durable-smoke'] ?? '',
  ) &&
    /--allow-read=supabase/.test(
      packageJson.scripts?.['phase9:account-deletion-durable-smoke'] ?? '',
    ) &&
    /phase9:account-deletion-durable-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:account-deletion-durable-smoke/.test(packageJson.scripts?.['launch:verify'] ?? ''),
  'The complete durable deletion contract suite must be frozen-lock scriptable and required by Phase 9 plus launch verification.',
);
block(
  errors,
  /exportCore\.test\.ts/.test(packageJson.scripts?.['phase9:data-export-contract-smoke'] ?? '') &&
    /healthSyncExportCore\.test\.ts/.test(
      packageJson.scripts?.['phase9:data-export-contract-smoke'] ?? '',
    ) &&
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
    /PHASE9_RUN_LIVE_DATA_RIGHTS/.test(liveHarness) &&
    /env\.APP_ENV === 'staging'/.test(liveHarness) &&
    /resolveHostedSupabaseProjectTarget/.test(liveHarness) &&
    /supabaseTarget\.valid/.test(liveHarness) &&
    /PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX/.test(liveHarness) &&
    /PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK/.test(liveHarness) &&
    /PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS/.test(liveHarness) &&
    /photo_download_url_omissions/.test(liveHarness) &&
    /INVALID_STORAGE_PATH/.test(liveHarness) &&
    /data-export photo signed URLs expire after configured TTL/.test(liveHarness) &&
    /data-export returns 429 after configured data-rights rate limit/.test(liveHarness) &&
    /edge_rate_limits stores keyed hashes only for data-export scope/.test(liveHarness) &&
    /serviceHealthClient\(consent\.epoch\)/.test(liveHarness) &&
    /'submit_catalog_correction'/.test(liveHarness) &&
    /catalog-correction export returned an internal operator field/.test(liveHarness) &&
    /catalog-correction export manifest is incomplete or misclassified/.test(liveHarness) &&
    /data\.export_schema_version === 4/.test(liveHarness) &&
    /'sync_shelf_product'/.test(liveHarness) &&
    /'record_routine_completion'/.test(liveHarness) &&
    /shelf_product_identities/.test(liveHarness) &&
    /shelf_sync_receipts/.test(liveHarness) &&
    /routine_completion_sync_receipts/.test(liveHarness) &&
    /health_sync_request_fingerprints/.test(liveHarness) &&
    /omitted the exact caller receipt or exposed an internal field/.test(liveHarness) &&
    /deleted catalog correction/.test(liveHarness) &&
    /other user catalog correction retained/.test(liveHarness) &&
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
  'Live data-rights harness must be staging-only, bind the reviewed canonical Supabase target, and preserve catalog-correction/reverse-trial export isolation, redacted evidence, blocking cleanup, and rate-limit behavior.',
);
block(
  errors,
  /PHASE9_ALLOW_DESTRUCTIVE_ACCOUNT_DELETION/.test(liveHarness) &&
    /PHASE9_ACCOUNT_DELETION_POLL_TIMEOUT_SECONDS/.test(liveHarness) &&
    /PHASE9_ACCOUNT_DELETION_MAX_POLLS/.test(liveHarness) &&
    /PHASE9_ACCOUNT_DELETION_REQUEST_TIMEOUT_SECONDS/.test(liveHarness) &&
    /AbortSignal\.timeout/.test(liveHarness) &&
    /async function postAccountDeletionBegin/.test(liveHarness) &&
    /async function postAccountDeletionPreflight/.test(liveHarness) &&
    /body: JSON\.stringify\(\{ action: 'preflight' \}\)/.test(liveHarness) &&
    /exactObjectKeys\(response\.body, \['status', 'ownerSubject'\]\)/.test(liveHarness) &&
    /response\.body\.ownerSubject === expectedOwnerSubject/.test(liveHarness) &&
    /active preflight binds the same authenticated owner/.test(liveHarness) &&
    /activeDeletionBarrierAttested/.test(liveHarness) &&
    /Authorization: `Bearer \$\{token\}`/.test(liveHarness) &&
    /async function postAccountDeletionStatus/.test(liveCapabilityStatusSource) &&
    /body: JSON\.stringify\(\{ action: 'status', capability \}\)/.test(
      liveCapabilityStatusSource,
    ) &&
    !/Authorization/.test(liveCapabilityStatusSource) &&
    /response\.status === 202/.test(liveHarness) &&
    /response\.status === 200/.test(liveHarness) &&
    /response\.status === 410/.test(liveHarness) &&
    /post-Auth capability replay/.test(liveHarness) &&
    /deleted owner rate limits/.test(liveHarness) &&
    /terminalDeletion\?\.kind === 'completed'/.test(liveHarness) &&
    /residual checks are forbidden until terminal HTTP 200 completion is attested/.test(
      liveHarness,
    ) &&
    /ACCOUNT_DELETION_RESPONSE_MAX_BYTES/.test(liveHarness) &&
    !/data\?\.deleted === true/.test(liveHarness),
  'Live deletion evidence must require an explicit destructive flag, exact 202/capability receipt contracts, bounded polling, post-Auth replay, and terminal completion before residual checks.',
);
block(
  errors,
  /function assertLocalPhotoExportDisclosure\(bundle\)/.test(liveHarness) &&
    /local_only_photo_note/.test(liveHarness) &&
    /Any server-side photo metadata rows are exported separately in photos\./.test(liveHarness) &&
    (liveHarness.match(/assertLocalPhotoExportDisclosure\(/g)?.length ?? 0) >= 3,
  'Live data-rights harness must verify the local-photo exclusion in normal and rate-limit export responses.',
);

warn(
  warnings,
  evidenceFlagEnabled(process.env.PHASE9_DATA_EXPORT_DELETE_PASS),
  'Missing live data export/delete evidence: PHASE9_DATA_EXPORT_DELETE_PASS=true.',
);

printResult('Phase 9 data rights smoke', errors, warnings);
