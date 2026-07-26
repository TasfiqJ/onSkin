import { decryptPhotoNoteForPurposeLimitedExport } from '@/features/photos/encryptedStorage';
import { normalizeConflictChoicesForExport } from '@/features/intelligence/overrides';
import { AGE_POLICY_RECEIPT_KEY } from '@/features/onboarding/ageGate';
import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';
import { purgeExpiredCatalogLookupQueueForPurposeLimitedExport } from '@/lib/offline/catalogLookupQueue';
import { getPrivateItemsForPurposeLimitedExport } from '@/lib/storage/privateKV';

import { LOCAL_PRIVATE_DATA_KEYS } from './localPrivateDataKeys';

type LocalPrivateDataKey = (typeof LOCAL_PRIVATE_DATA_KEYS)[number];
type LocalExportSection =
  | 'account_and_privacy'
  | 'profile_and_preferences'
  | 'shelf_and_routine'
  | 'activity_and_app_state'
  | 'subscription';

type LocalExportSpec = {
  key: Exclude<
    LocalPrivateDataKey,
    | 'onskin.photos.v1'
    | 'routinekind.widgetActionMap.v1'
    | 'routinekind.widgetActionMap.v2'
    | 'routinekind.widgetOwnerAuthority.v1'
  >;
  section: LocalExportSection;
  field: string;
};

const PHOTO_RECORDS_KEY = 'onskin.photos.v1' as const;

/** Ephemeral security capabilities are accounted for but never read into an export. */
export const LOCAL_DEVICE_EXPORT_EXCLUDED_STORAGE_KEYS = [
  'routinekind.widgetActionMap.v1',
  'routinekind.widgetActionMap.v2',
  'routinekind.widgetOwnerAuthority.v1',
] as const satisfies readonly LocalPrivateDataKey[];

const LOCAL_EXPORT_SPECS = [
  {
    key: AGE_POLICY_RECEIPT_KEY,
    section: 'account_and_privacy',
    field: 'age_policy_receipt',
  },
  {
    key: 'onskin.appLock.enabled',
    section: 'account_and_privacy',
    field: 'app_lock_enabled',
  },
  {
    key: 'onskin.ask.consent.v1',
    section: 'account_and_privacy',
    field: 'ask_consent',
  },
  {
    key: 'onskin.commerceConsent.v1',
    section: 'account_and_privacy',
    field: 'commerce_consent',
  },
  {
    key: 'routinekind.catalog.lookupQueue.v1',
    section: 'shelf_and_routine',
    field: 'pending_catalog_lookups',
  },
  {
    key: 'onskin.communityAge16.v1',
    section: 'account_and_privacy',
    field: 'community_age_16_verified',
  },
  {
    key: 'onskin.communityConsent.v1',
    section: 'account_and_privacy',
    field: 'community_consent',
  },
  {
    key: 'onskin.healthDataCollectionConsent.v1',
    section: 'account_and_privacy',
    field: 'health_data_collection_consent',
  },
  {
    key: 'routinekind.healthDataLifecycle.v1',
    section: 'account_and_privacy',
    field: 'health_data_lifecycle',
  },
  {
    key: 'onskin.photos.captureConsent',
    section: 'account_and_privacy',
    field: 'legacy_photo_capture_consent',
  },
  {
    key: 'onskin.photos.captureConsent.v1',
    section: 'account_and_privacy',
    field: 'photo_capture_consent',
  },
  {
    key: 'onskin.photos.cloudBackup',
    section: 'account_and_privacy',
    field: 'legacy_unavailable_cloud_backup_preference',
  },
  {
    key: 'onskin.trendInsights.v1',
    section: 'account_and_privacy',
    field: 'photo_trend_insights_consent',
  },
  {
    key: 'onskin.notifPrefs.v1',
    section: 'profile_and_preferences',
    field: 'notification_preferences',
  },
  {
    key: 'onskin.recPrefs.v1',
    section: 'profile_and_preferences',
    field: 'recommendation_preferences',
  },
  {
    key: 'onskin.skinprofile.v1',
    section: 'profile_and_preferences',
    field: 'skin_profile',
  },
  {
    key: 'onskin.completions.firstCompletion.v1',
    section: 'shelf_and_routine',
    field: 'first_completion_marker',
  },
  {
    key: 'onskin.completions.pending',
    section: 'shelf_and_routine',
    field: 'pending_completion_sync',
  },
  {
    key: 'onskin.completions.v1',
    section: 'shelf_and_routine',
    field: 'completion_history',
  },
  {
    key: 'onskin.conflict.overrides',
    section: 'shelf_and_routine',
    field: 'conflict_overrides',
  },
  {
    key: 'onskin.cycle.v1',
    section: 'shelf_and_routine',
    field: 'legacy_cycle_configuration',
  },
  {
    key: 'routinekind.cycle.v2',
    section: 'shelf_and_routine',
    field: 'cycle_configuration',
  },
  {
    key: 'onskin.cycleAnchor',
    section: 'shelf_and_routine',
    field: 'legacy_cycle_anchor',
  },
  {
    key: 'routinekind.routineOrder.v1',
    section: 'shelf_and_routine',
    field: 'routine_order_overrides',
  },
  { key: 'onskin.ramp.v1', section: 'shelf_and_routine', field: 'active_ramps' },
  { key: 'onskin.shelf.v1', section: 'shelf_and_routine', field: 'shelf_products' },
  {
    key: 'onskin.ask.groundedTurns.v1',
    section: 'activity_and_app_state',
    field: 'ask_grounded_turn_counts',
  },
  {
    key: 'onskin.community.reactions.v1',
    section: 'activity_and_app_state',
    field: 'community_reactions',
  },
  {
    key: 'onskin.milestones.v1',
    section: 'activity_and_app_state',
    field: 'seen_milestones',
  },
  {
    key: 'onskin.notiflog.v1',
    section: 'activity_and_app_state',
    field: 'notification_delivery_log',
  },
  {
    key: 'onskin.recDismissed.v1',
    section: 'activity_and_app_state',
    field: 'dismissed_recommendations',
  },
  {
    key: 'onskin.reviewPrompt.v1',
    section: 'activity_and_app_state',
    field: 'review_prompt_state',
  },
  {
    key: 'routinekind.routineActivation.v1',
    section: 'activity_and_app_state',
    field: 'routine_activation_state',
  },
  {
    key: 'onskin.trendState.v1',
    section: 'activity_and_app_state',
    field: 'photo_trend_state',
  },
  {
    key: 'onskin.entitlement.v1',
    section: 'subscription',
    field: 'legacy_entitlement_cache',
  },
  {
    key: 'onskin.entitlement.v2',
    section: 'subscription',
    field: 'entitlement_cache',
  },
  {
    key: 'onskin.subscription.freeConflictCheckRuleIds.v1',
    section: 'subscription',
    field: 'free_conflict_check_rule_ids',
  },
  {
    key: 'onskin.subscription.promptedExpiry',
    section: 'subscription',
    field: 'prompted_expiry',
  },
] as const satisfies readonly LocalExportSpec[];

export const LOCAL_DEVICE_EXPORT_STORAGE_KEYS = [
  ...LOCAL_EXPORT_SPECS.map((spec) => spec.key),
  PHOTO_RECORDS_KEY,
] as const;

const REDACTED_LOCAL_FIELD_NAMES = new Set([
  'encryptedLocalUri',
  'idempotencyKey',
  'keyId',
  'localUri',
  'notesCiphertext',
  'ownerUserId',
  'storagePath',
  'thumbnailLocalUri',
  'thumbnailPath',
]);

const SAFE_PHOTO_FIELDS = [
  'id',
  'series',
  'takenLocalDate',
  'takenAt',
  'timeOfDay',
  'alignmentScore',
  'lightingScore',
  'isReference',
  'referencePhotoId',
  'captureSessionId',
  'headRoll',
  'headYaw',
  'headPitch',
  'qualitySource',
  'localOnly',
  'faceRegionRedacted',
] as const;

type ExportSectionRecords = Record<LocalExportSection, Record<string, unknown>>;

export type LocalDeviceExportData = {
  schema_version: 1;
  collected_at: string;
  storage_scope: 'encrypted_private_storage_on_this_device';
  sections: ExportSectionRecords & {
    progress: {
      photo_records?: {
        records: Record<string, unknown>[];
        omitted_invalid_record_count: number;
        photo_files_included: false;
        thumbnails_included: false;
      };
    };
  };
  exclusions: { data_class: string; reason: string }[];
};

export type MobileDataExportBundle = {
  mobile_export_schema_version: 1;
  exported_at: string;
  server_account_data_status: 'included' | 'backend_not_configured';
  server_account_data: unknown | null;
  local_device_data: LocalDeviceExportData;
  local_media_note: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredValue(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function redactLocalFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLocalFields);
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!REDACTED_LOCAL_FIELD_NAMES.has(key)) sanitized[key] = redactLocalFields(child);
  }
  return sanitized;
}

async function exportPhotoRecords(
  raw: string,
  accountLease: AccountGenerationLease,
): Promise<{
  records: Record<string, unknown>[];
  omitted_invalid_record_count: number;
  photo_files_included: false;
  thumbnails_included: false;
}> {
  const parsed = parseStoredValue(raw);
  if (!Array.isArray(parsed)) throw new Error('LOCAL_DEVICE_EXPORT_INVALID:progress_photo_records');

  const records: Record<string, unknown>[] = [];
  let omittedInvalidRecordCount = 0;

  for (const value of parsed) {
    if (!isRecord(value)) {
      omittedInvalidRecordCount += 1;
      continue;
    }

    const record: Record<string, unknown> = {};
    for (const field of SAFE_PHOTO_FIELDS) {
      if (field in value) record[field] = redactLocalFields(value[field]);
    }

    const legacyNote = typeof value.notes === 'string' ? value.notes : null;
    const ciphertext = typeof value.notesCiphertext === 'string' ? value.notesCiphertext : null;
    const decryptedNote = ciphertext
      ? await decryptPhotoNoteForPurposeLimitedExport(ciphertext, accountLease)
      : null;
    accountLease.assertCurrent();
    record.notes = ciphertext ? decryptedNote : legacyNote;
    record.notesExportStatus = ciphertext
      ? decryptedNote === null
        ? 'unavailable'
        : 'included'
      : legacyNote === null
        ? 'none'
        : 'included';
    records.push(record);
  }

  return {
    records,
    omitted_invalid_record_count: omittedInvalidRecordCount,
    photo_files_included: false,
    thumbnails_included: false,
  };
}

function emptySections(): LocalDeviceExportData['sections'] {
  return {
    account_and_privacy: {},
    profile_and_preferences: {},
    shelf_and_routine: {},
    activity_and_app_state: {},
    subscription: {},
    progress: {},
  };
}

export async function collectLocalDeviceExportData(
  accountLease: AccountGenerationLease,
  expectedUserId: string | null,
  collectedAt = new Date().toISOString(),
): Promise<LocalDeviceExportData> {
  accountLease.assertCurrent();
  await purgeExpiredCatalogLookupQueueForPurposeLimitedExport(
    accountLease,
    expectedUserId,
    new Date(collectedAt),
  );
  accountLease.assertCurrent();
  const sections = emptySections();
  const stored = await getPrivateItemsForPurposeLimitedExport(
    LOCAL_DEVICE_EXPORT_STORAGE_KEYS,
    accountLease,
  );
  accountLease.assertCurrent();

  for (const spec of LOCAL_EXPORT_SPECS) {
    const raw = stored.get(spec.key) ?? null;
    if (raw !== null) {
      const parsed = parseStoredValue(raw);
      const exportValue =
        spec.key === 'onskin.conflict.overrides'
          ? normalizeConflictChoicesForExport(parsed)
          : parsed;
      sections[spec.section][spec.field] = redactLocalFields(exportValue);
    }
  }

  const photoRaw = stored.get(PHOTO_RECORDS_KEY) ?? null;
  if (photoRaw !== null) {
    sections.progress.photo_records = await exportPhotoRecords(photoRaw, accountLease);
  }
  accountLease.assertCurrent();

  return {
    schema_version: 1,
    collected_at: collectedAt,
    storage_scope: 'encrypted_private_storage_on_this_device',
    sections,
    exclusions: [
      {
        data_class: 'progress_photo_files_and_thumbnails',
        reason:
          'Encrypted image files and thumbnail bytes remain on this device. Sanitized photo metadata and notes are included when available.',
      },
      {
        data_class: 'device_file_paths',
        reason: 'Shelf thumbnail paths and Progress photo file paths are removed from the export.',
      },
      {
        data_class: 'encryption_keys_and_auth_credentials',
        reason: 'Device encryption keys and Supabase session credentials are never exported.',
      },
      {
        data_class: 'temporary_export_and_share_cache',
        reason: 'One-time cache files are deleted after each share attempt and are not exported.',
      },
      {
        data_class: 'privacy_request_recovery_capabilities',
        reason:
          'Owner bindings, idempotency keys, and recovery capabilities used to finish deletion or consent-withdrawal requests are security control data and are never exported.',
      },
      {
        data_class: 'widget_action_capabilities',
        reason:
          'Ephemeral widget action tokens, owner bindings, and private step mappings are security control data and are never exported.',
      },
    ],
  };
}

export function buildMobileDataExportBundle(params: {
  exportedAt?: string;
  serverAccountData: unknown | null;
  serverAccountDataStatus: MobileDataExportBundle['server_account_data_status'];
  localDeviceData: LocalDeviceExportData;
}): MobileDataExportBundle {
  return {
    mobile_export_schema_version: 1,
    exported_at: params.exportedAt ?? new Date().toISOString(),
    server_account_data_status: params.serverAccountDataStatus,
    server_account_data: params.serverAccountData,
    local_device_data: params.localDeviceData,
    local_media_note:
      'Progress photo files and thumbnails are not included. Sanitized photo metadata and notes saved on this device are included under local_device_data.sections.progress.',
  };
}
