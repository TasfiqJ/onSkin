import {
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_CLAIM_INTENT_KEY,
  LOCAL_DATA_OWNER_CLAIM_NONCE_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
} from '@/lib/auth/sessionOwnerKey';
import { ACCOUNT_DELETION_VENDOR_FREEZE_KEY } from '@/lib/auth/accountDeletionVendorFreezeKey';
import { PLAINTEXT_STAGING_JOURNAL_KEY } from '@/lib/storage/plaintextStagingCore';
import { PRIVATE_KV_TRANSACTION_JOURNAL_KEY } from '@/lib/storage/privateKVTransactionCore';
import {
  OUTBOX_LEGACY_SCHEMA_VERSIONS,
  OUTBOX_SCHEMA_VERSION,
  OUTBOX_STORAGE_KEY,
} from '@/lib/offline/outbox.pure';

export type LocalPrivateKeyCategory = 'data' | 'secure_store' | 'metadata' | 'control';
export type LocalPrivateKeyLifecycle =
  | 'current'
  | 'legacy_read'
  | 'legacy_retained'
  | 'reserved'
  | 'key_material'
  | 'metadata'
  | 'control';
export type LocalPrivateExportSection =
  | 'account_and_privacy'
  | 'profile_and_preferences'
  | 'shelf_and_routine'
  | 'activity_and_app_state'
  | 'subscription'
  | 'progress';
export type LocalPrivateExportTransform =
  | 'structured_json'
  | 'safe_scalar_or_json'
  | 'conflict_choices'
  | 'shelf_products'
  | 'photo_records';

type Contract<T extends object> =
  | ({ status: 'enforced' } & T)
  | { status: 'gap'; issue: string }
  | { status: 'not_applicable'; reason: string };

type CodecContract = Contract<{
  codecId: string;
  currentVersion: string | number;
  legacyVersions: readonly (string | number)[];
}>;

type TypedReadContract = Contract<{
  mode: 'domain_result' | 'typed_adapter' | 'control_state_machine' | 'key_material_error_taxonomy';
}>;

type MutationContract = Contract<{
  mode:
    | 'private_kv_atomic_transform'
    | 'private_kv_transaction_journal'
    | 'photo_two_phase_journal'
    | 'serialized_verified_control'
    | 'single_flight_key_write'
    | 'replace_only_control'
    | 'read_only';
}>;

type OwnerBindingContract = Contract<{
  mode:
    | 'private_kv_account_boundary'
    | 'photo_account_generation'
    | 'owner_hash_control'
    | 'owner_bound_deletion_receipt'
    | 'verified_owner_startup_control';
}>;

export type LocalPrivateExportPolicy = Contract<
  | {
      mode: 'include';
      section: LocalPrivateExportSection;
      field: string;
      transform: LocalPrivateExportTransform;
    }
  | { mode: 'exclude'; reason: string }
>;

type CleanupContract = Contract<{
  mode:
    | 'authorized_private_kv_bulk'
    | 'photo_storage_delegate'
    | 'private_kv_key_delegate'
    | 'preserve_control'
    | 'clear_after_verified_cleanup';
  handler: string;
}>;

type ResetContract = Contract<{
  authority:
    | 'account_isolation_only'
    | 'device_authenticated_setting_repair'
    | 'backend_deletion_completion_only'
    | 'startup_recovery_only'
    | 'none';
}>;

type RecoveryContract = Contract<{
  mode:
    | 'preserve_bytes_and_retry'
    | 'device_authenticated_setting_reset'
    | 'journal_replay_before_mount'
    | 'transaction_roll_forward_before_read'
    | 'preserve_key_material_no_rotation'
    | 'fail_closed_control_retry'
    | 'authenticated_claim_repair'
    | 'pending_key_fingerprint_reconciliation'
    | 'explicit_domain_delete';
}>;

export type LocalPrivateKeyDescriptor = Readonly<{
  key: string;
  category: LocalPrivateKeyCategory;
  storage: 'private_kv' | 'secure_store_with_legacy_fallback' | 'async_storage_control';
  lifecycle: LocalPrivateKeyLifecycle;
  discovery: 'production_literal' | 'retained_inventory';
  codec: CodecContract;
  typedRead: TypedReadContract;
  mutation: MutationContract;
  ownerBinding: OwnerBindingContract;
  export: LocalPrivateExportPolicy;
  cleanup: CleanupContract;
  reset: ResetContract;
  recovery: RecoveryContract;
}>;

const enforced = <const T extends object>(value: T) => ({ status: 'enforced', ...value }) as const;
const notApplicable = (reason: string) => ({ status: 'not_applicable', reason }) as const;

const PRIVATE_KV_MUTATION = enforced({ mode: 'private_kv_atomic_transform' as const });
const PRIVATE_KV_OWNER = enforced({ mode: 'private_kv_account_boundary' as const });
const PRIVATE_KV_CLEANUP = enforced({
  mode: 'authorized_private_kv_bulk' as const,
  handler: 'removePrivateItemsForAuthorizedReset',
});
const ACCOUNT_RESET = enforced({ authority: 'account_isolation_only' as const });
const PRESERVE_PRIVATE_BYTES = enforced({ mode: 'preserve_bytes_and_retry' as const });

type PrivateDataInput = Readonly<{
  key: string;
  lifecycle: Extract<
    LocalPrivateKeyLifecycle,
    'current' | 'legacy_read' | 'legacy_retained' | 'reserved'
  >;
  discovery?: LocalPrivateKeyDescriptor['discovery'];
  codec: CodecContract;
  typedRead: TypedReadContract;
  mutation?: MutationContract;
  ownerBinding?: OwnerBindingContract;
  export: LocalPrivateExportPolicy;
  cleanup?: CleanupContract;
  reset?: ResetContract;
  recovery?: RecoveryContract;
}>;

function privateData<const T extends PrivateDataInput>(entry: T) {
  return {
    category: 'data' as const,
    storage: 'private_kv' as const,
    mutation: PRIVATE_KV_MUTATION,
    ownerBinding: PRIVATE_KV_OWNER,
    cleanup: PRIVATE_KV_CLEANUP,
    reset: ACCOUNT_RESET,
    recovery: PRESERVE_PRIVATE_BYTES,
    ...entry,
    discovery: entry.discovery ?? ('production_literal' as const),
  } as const;
}

const jsonCodec = (
  codecId: string,
  currentVersion: number,
  legacyVersions: readonly number[] = [],
) => enforced({ codecId, currentVersion, legacyVersions });
const scalarCodec = (
  codecId: string,
  currentVersion: string,
  legacyVersions: readonly string[] = [],
) => enforced({ codecId, currentVersion, legacyVersions });
const typedDomainRead = enforced({ mode: 'domain_result' as const });
const typedAdapterRead = enforced({ mode: 'typed_adapter' as const });
const include = (
  section: LocalPrivateExportSection,
  field: string,
  transform: LocalPrivateExportTransform = 'structured_json',
) => enforced({ mode: 'include' as const, section, field, transform });

export const LOCAL_PRIVATE_KEY_REGISTRY = [
  privateData({
    key: 'onskin.ageVerified',
    lifecycle: 'current',
    codec: scalarCodec('private_boolean', 'v1', ['legacy_boolean']),
    typedRead: typedAdapterRead,
    export: include('account_and_privacy', 'age_verified', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.appLock.enabled',
    lifecycle: 'current',
    codec: scalarCodec('app_lock_boolean', 'v1', ['legacy_boolean']),
    typedRead: typedDomainRead,
    reset: enforced({ authority: 'device_authenticated_setting_repair' as const }),
    recovery: enforced({ mode: 'device_authenticated_setting_reset' as const }),
    export: include('account_and_privacy', 'app_lock_enabled', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.ask.consent.v1',
    lifecycle: 'current',
    codec: scalarCodec('private_boolean', 'v1', ['legacy_boolean']),
    typedRead: typedAdapterRead,
    export: include('account_and_privacy', 'ask_consent', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.ask.groundedTurns.v1',
    lifecycle: 'current',
    codec: jsonCodec('ask_grounded_turns', 2, [0, 1]),
    typedRead: typedDomainRead,
    export: include('activity_and_app_state', 'ask_grounded_turn_counts'),
  }),
  privateData({
    key: 'onskin.commerceConsent.v1',
    lifecycle: 'current',
    codec: scalarCodec('private_boolean', 'v1', ['legacy_boolean']),
    typedRead: typedAdapterRead,
    export: include('account_and_privacy', 'commerce_consent', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.community.reactions.v1',
    lifecycle: 'current',
    codec: jsonCodec('private_string_set', 1, [0]),
    typedRead: typedDomainRead,
    export: include('activity_and_app_state', 'community_reactions'),
  }),
  privateData({
    key: 'onskin.communityAge16.v1',
    lifecycle: 'current',
    codec: scalarCodec('private_boolean', 'v1', ['legacy_boolean']),
    typedRead: typedAdapterRead,
    export: include('account_and_privacy', 'community_age_16_verified', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.communityConsent.v1',
    lifecycle: 'current',
    codec: scalarCodec('private_boolean', 'v1', ['legacy_boolean']),
    typedRead: typedAdapterRead,
    export: include('account_and_privacy', 'community_consent', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.completions.firstCompletion.v1',
    lifecycle: 'legacy_read',
    codec: scalarCodec('legacy_first_completion_boolean', 'legacy_boolean'),
    typedRead: typedDomainRead,
    mutation: enforced({ mode: 'read_only' as const }),
    export: include('shelf_and_routine', 'first_completion_marker', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.completions.pending',
    lifecycle: 'current',
    codec: jsonCodec('completion_queue', 1, [0]),
    typedRead: typedDomainRead,
    export: include('shelf_and_routine', 'pending_completion_sync'),
  }),
  privateData({
    key: OUTBOX_STORAGE_KEY,
    lifecycle: 'current',
    codec: jsonCodec(
      'transactional_outbox',
      OUTBOX_SCHEMA_VERSION,
      OUTBOX_LEGACY_SCHEMA_VERSIONS,
    ),
    typedRead: typedDomainRead,
    export: include('activity_and_app_state', 'transactional_outbox'),
  }),
  privateData({
    key: 'onskin.completions.v1',
    lifecycle: 'current',
    codec: jsonCodec('completion_log', 2, [0, 1]),
    typedRead: typedDomainRead,
    export: include('shelf_and_routine', 'completion_history'),
  }),
  privateData({
    key: 'onskin.cycleNightAnalytics.v1',
    lifecycle: 'current',
    codec: jsonCodec('cycle_night_analytics_receipts', 1),
    typedRead: typedDomainRead,
    export: include('activity_and_app_state', 'cycle_night_analytics_receipts'),
  }),
  privateData({
    key: 'onskin.conflict.overrides',
    lifecycle: 'current',
    codec: jsonCodec('conflict_choices', 1, [0]),
    typedRead: typedDomainRead,
    export: include('shelf_and_routine', 'conflict_overrides', 'conflict_choices'),
  }),
  privateData({
    key: 'onskin.cycle.v1',
    lifecycle: 'legacy_read',
    codec: jsonCodec('legacy_cycle_config', 1, [0]),
    typedRead: typedDomainRead,
    mutation: enforced({ mode: 'read_only' as const }),
    export: include('shelf_and_routine', 'legacy_cycle_configuration'),
  }),
  privateData({
    key: 'onskin.cycleAnchor',
    lifecycle: 'current',
    codec: jsonCodec('cycle_anchor', 1, [0]),
    typedRead: typedDomainRead,
    export: include('shelf_and_routine', 'legacy_cycle_anchor', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.entitlement.v1',
    lifecycle: 'current',
    // Known-key rollback bridge: v2 is the strict RevenueCat revocation +
    // trusted-proof-marker sidecar; raw v0 and envelope v1 remain legacy
    // entitlement readers.
    codec: jsonCodec('entitlement_legacy_or_revenuecat_sidecar', 2, [0, 1]),
    typedRead: typedDomainRead,
    export: include('subscription', 'entitlement_legacy_or_revenuecat_sidecar'),
  }),
  privateData({
    key: 'onskin.entitlement.v2',
    lifecycle: 'current',
    // Rollback bridge: current writers intentionally emit the normalized raw
    // v0 record; readers also accept the former strict v1 envelope.
    codec: jsonCodec('entitlement_cache_rollback_bridge', 0, [1]),
    typedRead: typedDomainRead,
    export: include('subscription', 'entitlement_cache'),
  }),
  privateData({
    key: 'onskin.healthDataCollectionConsent.v1',
    lifecycle: 'current',
    codec: jsonCodec('health_data_consent', 1),
    typedRead: typedDomainRead,
    export: include('account_and_privacy', 'health_data_collection_consent'),
  }),
  privateData({
    key: 'onskin.milestones.v1',
    lifecycle: 'current',
    codec: jsonCodec('private_string_set', 1, [0]),
    typedRead: typedDomainRead,
    export: include('activity_and_app_state', 'seen_milestones'),
  }),
  privateData({
    key: 'onskin.notifPrefs.v1',
    lifecycle: 'current',
    codec: jsonCodec('notification_preferences', 1, [0]),
    typedRead: typedDomainRead,
    export: include('profile_and_preferences', 'notification_preferences'),
  }),
  privateData({
    key: 'onskin.notiflog.v1',
    lifecycle: 'current',
    codec: jsonCodec('notification_sent_ledger', 1, [0]),
    typedRead: typedDomainRead,
    export: include('activity_and_app_state', 'notification_delivery_log'),
  }),
  privateData({
    key: 'onskin.photos.captureConsent',
    lifecycle: 'legacy_read',
    codec: scalarCodec('private_boolean', 'v1', ['legacy_boolean']),
    typedRead: typedDomainRead,
    mutation: enforced({ mode: 'read_only' as const }),
    export: include('account_and_privacy', 'legacy_photo_capture_consent', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.photos.captureConsent.v1',
    lifecycle: 'current',
    codec: jsonCodec('photo_capture_consent', 1, [0]),
    typedRead: typedDomainRead,
    export: include('account_and_privacy', 'photo_capture_consent'),
  }),
  privateData({
    key: 'onskin.photos.cloudBackup',
    lifecycle: 'legacy_retained',
    discovery: 'retained_inventory',
    codec: scalarCodec('private_boolean', 'legacy_boolean'),
    typedRead: notApplicable('Cloud backup is unavailable and has no active reader.'),
    mutation: enforced({ mode: 'read_only' as const }),
    export: include(
      'account_and_privacy',
      'legacy_unavailable_cloud_backup_preference',
      'safe_scalar_or_json',
    ),
  }),
  privateData({
    key: 'onskin.photos.v1',
    lifecycle: 'current',
    codec: jsonCodec('photo_store', 2, [1]),
    typedRead: typedDomainRead,
    mutation: enforced({ mode: 'photo_two_phase_journal' as const }),
    ownerBinding: enforced({ mode: 'photo_account_generation' as const }),
    recovery: enforced({ mode: 'journal_replay_before_mount' as const }),
    export: include('progress', 'photo_records', 'photo_records'),
  }),
  privateData({
    key: 'onskin.ramp.v1',
    lifecycle: 'current',
    codec: jsonCodec('ramp_state', 1, [0]),
    typedRead: typedDomainRead,
    export: include('shelf_and_routine', 'active_ramps'),
  }),
  privateData({
    key: 'onskin.recDismissed.v1',
    lifecycle: 'current',
    codec: jsonCodec('private_string_set', 1, [0]),
    typedRead: typedDomainRead,
    export: include('activity_and_app_state', 'dismissed_recommendations'),
  }),
  privateData({
    key: 'onskin.recPrefs.v1',
    lifecycle: 'current',
    codec: jsonCodec('recommendation_preferences', 1, [0]),
    typedRead: typedDomainRead,
    export: include('profile_and_preferences', 'recommendation_preferences'),
  }),
  privateData({
    key: 'onskin.reviewPrompt.v1',
    lifecycle: 'current',
    codec: jsonCodec('review_prompt_state', 1, [0]),
    typedRead: typedDomainRead,
    export: include('activity_and_app_state', 'review_prompt_state'),
  }),
  privateData({
    key: 'routinekind.cycle.v2',
    lifecycle: 'current',
    codec: jsonCodec('cycle_config', 1),
    typedRead: typedDomainRead,
    export: include('shelf_and_routine', 'cycle_configuration'),
  }),
  privateData({
    key: 'routinekind.routineActivation.v1',
    lifecycle: 'current',
    codec: jsonCodec('routine_activation_analytics', 1, [0]),
    typedRead: typedDomainRead,
    export: include('activity_and_app_state', 'routine_activation_state'),
  }),
  privateData({
    key: 'routinekind.routineOrder.v1',
    lifecycle: 'current',
    codec: jsonCodec('routine_order', 1, [0]),
    typedRead: typedDomainRead,
    export: include('shelf_and_routine', 'routine_order_overrides'),
  }),
  privateData({
    key: 'onskin.shelf.v1',
    lifecycle: 'current',
    codec: jsonCodec('shelf_state', 3, [0, 1, 2]),
    typedRead: typedDomainRead,
    export: include('shelf_and_routine', 'shelf_products', 'shelf_products'),
  }),
  privateData({
    key: 'onskin.skinprofile.v1',
    lifecycle: 'current',
    codec: jsonCodec('skin_profile', 1, [0]),
    typedRead: typedDomainRead,
    export: include('profile_and_preferences', 'skin_profile'),
  }),
  privateData({
    key: 'onskin.subscription.freeConflictCheckRuleIds.v1',
    lifecycle: 'current',
    codec: jsonCodec('free_conflict_quota', 1, [0]),
    typedRead: typedDomainRead,
    export: include('subscription', 'free_conflict_check_rule_ids'),
  }),
  privateData({
    key: 'onskin.subscription.promptedExpiry',
    lifecycle: 'current',
    codec: jsonCodec('subscription_prompt', 3, [0, 1, 2]),
    typedRead: typedDomainRead,
    export: include('subscription', 'prompted_expiry', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.trendInsights.v1',
    lifecycle: 'current',
    codec: scalarCodec('private_boolean', 'v1', ['legacy_boolean']),
    typedRead: typedAdapterRead,
    export: include('account_and_privacy', 'photo_trend_insights_consent', 'safe_scalar_or_json'),
  }),
  privateData({
    key: 'onskin.trendState.v1',
    lifecycle: 'reserved',
    codec: notApplicable('This reserved deletion key has never had a production writer.'),
    typedRead: notApplicable('The reserved deletion key has no payload reader.'),
    mutation: enforced({ mode: 'read_only' as const }),
    recovery: enforced({ mode: 'explicit_domain_delete' as const }),
    export: include('activity_and_app_state', 'photo_trend_state'),
  }),
  {
    key: 'onskin.photo.content_key.v1',
    category: 'secure_store',
    storage: 'secure_store_with_legacy_fallback',
    lifecycle: 'key_material',
    discovery: 'production_literal',
    codec: scalarCodec('xchacha20poly1305_key_hex', 'v1'),
    typedRead: enforced({ mode: 'key_material_error_taxonomy' as const }),
    mutation: enforced({ mode: 'single_flight_key_write' as const }),
    ownerBinding: enforced({ mode: 'photo_account_generation' as const }),
    export: enforced({ mode: 'exclude' as const, reason: 'encryption_key_material' }),
    cleanup: enforced({
      mode: 'photo_storage_delegate' as const,
      handler: 'clearEncryptedPhotoStorage',
    }),
    reset: ACCOUNT_RESET,
    recovery: enforced({ mode: 'preserve_key_material_no_rotation' as const }),
  },
  {
    key: 'onskin.private_kv.content_key.v1',
    category: 'secure_store',
    storage: 'secure_store_with_legacy_fallback',
    lifecycle: 'key_material',
    discovery: 'production_literal',
    codec: scalarCodec('xchacha20poly1305_key_hex', 'v1'),
    typedRead: enforced({ mode: 'key_material_error_taxonomy' as const }),
    mutation: enforced({ mode: 'single_flight_key_write' as const }),
    ownerBinding: PRIVATE_KV_OWNER,
    export: enforced({ mode: 'exclude' as const, reason: 'encryption_key_material' }),
    cleanup: enforced({
      mode: 'private_kv_key_delegate' as const,
      handler: 'clearPrivateKVContentKey',
    }),
    reset: ACCOUNT_RESET,
    recovery: enforced({ mode: 'preserve_key_material_no_rotation' as const }),
  },
  {
    key: PRIVATE_KV_TRANSACTION_JOURNAL_KEY,
    category: 'metadata',
    storage: 'private_kv',
    lifecycle: 'metadata',
    discovery: 'production_literal',
    codec: jsonCodec('private_kv_transaction_journal', 1),
    typedRead: enforced({ mode: 'control_state_machine' as const }),
    mutation: enforced({ mode: 'private_kv_transaction_journal' as const }),
    ownerBinding: PRIVATE_KV_OWNER,
    export: enforced({
      mode: 'exclude' as const,
      reason: 'encrypted_transaction_recovery_metadata',
    }),
    cleanup: PRIVATE_KV_CLEANUP,
    reset: ACCOUNT_RESET,
    recovery: enforced({ mode: 'transaction_roll_forward_before_read' as const }),
  },
  {
    key: 'onskin.photo.content_key_created.v1',
    category: 'metadata',
    storage: 'async_storage_control',
    lifecycle: 'metadata',
    discovery: 'production_literal',
    codec: scalarCodec('photo_key_presence_marker', 'v1:created:<sha256>|v1:pending:<sha256>', [
      '1',
      'v1:created',
    ]),
    typedRead: enforced({ mode: 'control_state_machine' as const }),
    mutation: enforced({ mode: 'replace_only_control' as const }),
    ownerBinding: enforced({ mode: 'photo_account_generation' as const }),
    export: enforced({ mode: 'exclude' as const, reason: 'encryption_internal_metadata' }),
    cleanup: PRIVATE_KV_CLEANUP,
    reset: ACCOUNT_RESET,
    recovery: enforced({ mode: 'pending_key_fingerprint_reconciliation' as const }),
  },
  {
    key: LOCAL_DATA_OWNER_HASH_KEY,
    category: 'metadata',
    storage: 'async_storage_control',
    lifecycle: 'metadata',
    discovery: 'production_literal',
    codec: scalarCodec('owner_hash_control', 'v1', ['raw_sha256']),
    typedRead: enforced({ mode: 'control_state_machine' as const }),
    mutation: enforced({ mode: 'replace_only_control' as const }),
    ownerBinding: enforced({ mode: 'owner_hash_control' as const }),
    export: enforced({ mode: 'exclude' as const, reason: 'owner_isolation_metadata' }),
    cleanup: PRIVATE_KV_CLEANUP,
    reset: ACCOUNT_RESET,
    recovery: enforced({ mode: 'fail_closed_control_retry' as const }),
  },
  {
    key: LOCAL_DATA_OWNER_CLAIM_INTENT_KEY,
    category: 'metadata',
    storage: 'async_storage_control',
    lifecycle: 'metadata',
    discovery: 'production_literal',
    codec: scalarCodec('owner_claim_intent_control', 'v1:<claim_sha256>'),
    typedRead: enforced({ mode: 'control_state_machine' as const }),
    mutation: enforced({ mode: 'replace_only_control' as const }),
    ownerBinding: enforced({ mode: 'verified_owner_startup_control' as const }),
    export: enforced({ mode: 'exclude' as const, reason: 'owner_isolation_metadata' }),
    cleanup: PRIVATE_KV_CLEANUP,
    reset: ACCOUNT_RESET,
    recovery: enforced({ mode: 'authenticated_claim_repair' as const }),
  },
  {
    key: LOCAL_DATA_OWNER_CLAIM_NONCE_KEY,
    category: 'metadata',
    storage: 'async_storage_control',
    lifecycle: 'metadata',
    discovery: 'production_literal',
    codec: scalarCodec('owner_claim_nonce_control', 'v1:<sha256>'),
    typedRead: enforced({ mode: 'control_state_machine' as const }),
    mutation: enforced({ mode: 'replace_only_control' as const }),
    ownerBinding: enforced({ mode: 'verified_owner_startup_control' as const }),
    export: enforced({ mode: 'exclude' as const, reason: 'owner_isolation_metadata' }),
    cleanup: PRIVATE_KV_CLEANUP,
    reset: ACCOUNT_RESET,
    recovery: enforced({ mode: 'authenticated_claim_repair' as const }),
  },
  {
    key: LOCAL_DATA_CLEANUP_REQUIRED_KEY,
    category: 'control',
    storage: 'async_storage_control',
    lifecycle: 'control',
    discovery: 'production_literal',
    codec: scalarCodec('cleanup_required_presence_marker', 'v1:required', ['1']),
    typedRead: enforced({ mode: 'control_state_machine' as const }),
    mutation: enforced({ mode: 'replace_only_control' as const }),
    ownerBinding: enforced({ mode: 'verified_owner_startup_control' as const }),
    export: enforced({ mode: 'exclude' as const, reason: 'account_boundary_recovery_control' }),
    cleanup: enforced({
      mode: 'clear_after_verified_cleanup' as const,
      handler: 'clearLocalDataCleanupRequired',
    }),
    reset: enforced({ authority: 'startup_recovery_only' as const }),
    recovery: enforced({ mode: 'fail_closed_control_retry' as const }),
  },
  {
    key: ACCOUNT_DELETION_VENDOR_FREEZE_KEY,
    category: 'control',
    storage: 'async_storage_control',
    lifecycle: 'control',
    discovery: 'production_literal',
    codec: jsonCodec('account_deletion_vendor_freeze', 2),
    typedRead: enforced({ mode: 'control_state_machine' as const }),
    mutation: enforced({ mode: 'serialized_verified_control' as const }),
    ownerBinding: enforced({ mode: 'owner_bound_deletion_receipt' as const }),
    export: enforced({ mode: 'exclude' as const, reason: 'account_deletion_recovery_capability' }),
    cleanup: enforced({
      mode: 'clear_after_verified_cleanup' as const,
      handler: 'clearAccountDeletionVendorFreezeAfterCleanup',
    }),
    reset: enforced({ authority: 'backend_deletion_completion_only' as const }),
    recovery: enforced({ mode: 'fail_closed_control_retry' as const }),
  },
  {
    key: PLAINTEXT_STAGING_JOURNAL_KEY,
    category: 'control',
    storage: 'async_storage_control',
    lifecycle: 'control',
    discovery: 'production_literal',
    codec: jsonCodec('plaintext_staging_journal', 1),
    typedRead: enforced({ mode: 'control_state_machine' as const }),
    mutation: enforced({ mode: 'serialized_verified_control' as const }),
    ownerBinding: enforced({ mode: 'verified_owner_startup_control' as const }),
    export: enforced({ mode: 'exclude' as const, reason: 'temporary_plaintext_recovery_control' }),
    cleanup: enforced({
      mode: 'preserve_control' as const,
      handler: 'scavengePlaintextStaging',
    }),
    reset: enforced({ authority: 'startup_recovery_only' as const }),
    recovery: enforced({ mode: 'journal_replay_before_mount' as const }),
  },
] as const satisfies readonly LocalPrivateKeyDescriptor[];

export type LocalPrivateRegistryEntry = (typeof LOCAL_PRIVATE_KEY_REGISTRY)[number];
export type LocalPrivateDataKey = Extract<LocalPrivateRegistryEntry, { category: 'data' }>['key'];
export type LocalPrivateRegistryAxis =
  | 'codec'
  | 'typedRead'
  | 'mutation'
  | 'ownerBinding'
  | 'export'
  | 'cleanup'
  | 'reset'
  | 'recovery';

const CONTRACT_AXES = [
  'codec',
  'typedRead',
  'mutation',
  'ownerBinding',
  'export',
  'cleanup',
  'reset',
  'recovery',
] as const satisfies readonly LocalPrivateRegistryAxis[];

export function localPrivateRegistryGaps(
  registry: readonly LocalPrivateKeyDescriptor[] = LOCAL_PRIVATE_KEY_REGISTRY,
): string[] {
  return registry
    .flatMap((entry) =>
      CONTRACT_AXES.flatMap((axis) =>
        entry[axis].status === 'gap' ? [`${entry.key}:${axis}`] : [],
      ),
    )
    .sort();
}

export function validateLocalPrivateKeyRegistry(
  registry: readonly LocalPrivateKeyDescriptor[] = LOCAL_PRIVATE_KEY_REGISTRY,
): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  const destinations = new Set<string>();

  for (const entry of registry) {
    if (!/^(onskin|routinekind)\.[A-Za-z0-9._-]+$/.test(entry.key)) {
      errors.push(`invalid_key:${entry.key}`);
    }
    if (keys.has(entry.key)) errors.push(`duplicate_key:${entry.key}`);
    keys.add(entry.key);

    for (const axis of CONTRACT_AXES) {
      const contract = entry[axis];
      if (contract.status === 'gap' && contract.issue.trim().length === 0) {
        errors.push(`empty_gap:${entry.key}:${axis}`);
      }
      if (contract.status === 'not_applicable' && contract.reason.trim().length === 0) {
        errors.push(`empty_not_applicable:${entry.key}:${axis}`);
      }
    }

    if (entry.category === 'data') {
      if (entry.storage !== 'private_kv') errors.push(`data_storage:${entry.key}`);
      if (entry.export.status !== 'enforced' || entry.export.mode !== 'include') {
        errors.push(`data_export:${entry.key}`);
      }
      if (
        entry.cleanup.status !== 'enforced' ||
        entry.cleanup.mode !== 'authorized_private_kv_bulk'
      ) {
        errors.push(`data_cleanup:${entry.key}`);
      }
    } else if (entry.export.status !== 'enforced' || entry.export.mode !== 'exclude') {
      errors.push(`non_data_export:${entry.key}`);
    }

    if (entry.lifecycle === 'reserved') {
      if (entry.codec.status !== 'not_applicable') errors.push(`reserved_codec:${entry.key}`);
      if (entry.typedRead.status !== 'not_applicable') {
        errors.push(`reserved_typed_read:${entry.key}`);
      }
      if (entry.mutation.status !== 'enforced' || entry.mutation.mode !== 'read_only') {
        errors.push(`reserved_mutation:${entry.key}`);
      }
      if (
        entry.recovery.status !== 'enforced' ||
        entry.recovery.mode !== 'explicit_domain_delete'
      ) {
        errors.push(`reserved_recovery:${entry.key}`);
      }
    }

    if (entry.category === 'control' && entry.cleanup.status === 'enforced') {
      if (entry.cleanup.mode === 'authorized_private_kv_bulk') {
        errors.push(`control_bulk_cleanup:${entry.key}`);
      }
    }

    if (entry.export.status === 'enforced' && entry.export.mode === 'include') {
      const destination = `${entry.export.section}:${entry.export.field}`;
      if (destinations.has(destination)) errors.push(`duplicate_export_destination:${destination}`);
      destinations.add(destination);
    }
  }

  return errors.sort();
}

export const LOCAL_PRIVATE_DATA_KEYS = Object.freeze(
  LOCAL_PRIVATE_KEY_REGISTRY.filter(
    (entry): entry is Extract<LocalPrivateRegistryEntry, { category: 'data' }> =>
      entry.category === 'data',
  ).map((entry) => entry.key),
);

export const LOCAL_PRIVATE_SECURE_STORE_KEYS = Object.freeze(
  LOCAL_PRIVATE_KEY_REGISTRY.filter(
    (entry): entry is Extract<LocalPrivateRegistryEntry, { category: 'secure_store' }> =>
      entry.category === 'secure_store',
  ).map((entry) => entry.key),
);

export const LOCAL_PRIVATE_METADATA_KEYS = Object.freeze(
  LOCAL_PRIVATE_KEY_REGISTRY.filter(
    (entry): entry is Extract<LocalPrivateRegistryEntry, { category: 'metadata' }> =>
      entry.category === 'metadata',
  ).map((entry) => entry.key),
);

export const LOCAL_PRIVATE_CONTROL_KEYS = Object.freeze(
  LOCAL_PRIVATE_KEY_REGISTRY.filter(
    (entry): entry is Extract<LocalPrivateRegistryEntry, { category: 'control' }> =>
      entry.category === 'control',
  ).map((entry) => entry.key),
);

export const LOCAL_PRIVATE_BULK_CLEANUP_KEYS = Object.freeze(
  LOCAL_PRIVATE_KEY_REGISTRY.flatMap((entry) =>
    entry.cleanup.status === 'enforced' && entry.cleanup.mode === 'authorized_private_kv_bulk'
      ? [entry.key]
      : [],
  ),
);

/** Keys retained only for compatibility, export, or explicit deletion. Private
 * KV enforces this list at the write boundary while still allowing reads and
 * domain-authorized removal. */
export const LOCAL_PRIVATE_READ_ONLY_KEYS = Object.freeze(
  (LOCAL_PRIVATE_KEY_REGISTRY as readonly LocalPrivateKeyDescriptor[]).flatMap((entry) =>
    entry.mutation.status === 'enforced' && entry.mutation.mode === 'read_only' ? [entry.key] : [],
  ),
);

export const LOCAL_PRIVATE_EXPORT_SPECS = Object.freeze(
  LOCAL_PRIVATE_KEY_REGISTRY.flatMap((entry) =>
    entry.export.status === 'enforced' && entry.export.mode === 'include'
      ? [{ key: entry.key as LocalPrivateDataKey, ...entry.export }]
      : [],
  ),
);
