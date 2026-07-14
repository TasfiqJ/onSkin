import { decryptPhotoNote, isPhotoEncryptionReadError } from '@/features/photos/encryptedStorage';
import { decodePhotoStoreItemsForExport } from '@/features/photos/photoStoreEnvelope';
import { normalizeConflictChoicesForExport } from '@/features/intelligence/overrides';
import { getPrivateItems } from '@/lib/storage/privateKV';

import {
  LOCAL_PRIVATE_EXPORT_SPECS,
  type LocalPrivateExportSection,
} from './localPrivateDataRegistry';

export const LOCAL_DEVICE_EXPORT_STORAGE_KEYS = LOCAL_PRIVATE_EXPORT_SPECS.map((spec) => spec.key);

const REDACTED_LOCAL_FIELD_NAMES = new Set(
  [
    'encryptedLocalUri',
    'keyId',
    'localUri',
    'notesCiphertext',
    'storagePath',
    'thumbnailLocalUri',
    'thumbnailPath',
  ].map((field) => field.toLowerCase()),
);

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

type ExportSectionRecords = Record<
  Exclude<LocalPrivateExportSection, 'progress'>,
  Record<string, unknown>
>;

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

export const LOCAL_DEVICE_EXPORT_RECORD_INVALID = 'LOCAL_DEVICE_EXPORT_RECORD_INVALID';

function invalidExportRecord(key: string): never {
  throw new Error(`${LOCAL_DEVICE_EXPORT_RECORD_INVALID}:${key}`);
}

function parseStructuredStoredValue(raw: string, key: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return invalidExportRecord(key);
  }
}

const SAFE_SCALAR = /^(?:v[1-9]\d*:[A-Za-z0-9._-]{1,128}|\d{4}-\d{2}-\d{2}|true|false|0|1)$/;

function parseSafeScalarOrJson(raw: string, key: string): unknown {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed === null ||
      typeof parsed === 'boolean' ||
      (typeof parsed === 'number' && (parsed === 0 || parsed === 1)) ||
      typeof parsed === 'object'
    ) {
      return parsed;
    }
    if (typeof parsed === 'string' && SAFE_SCALAR.test(parsed)) return parsed;
    return invalidExportRecord(key);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(LOCAL_DEVICE_EXPORT_RECORD_INVALID)) {
      throw error;
    }
    if (SAFE_SCALAR.test(raw)) return raw;
    return invalidExportRecord(key);
  }
}

function isLocalPathString(value: string): boolean {
  return (
    /(?:file|content|ph|assets-library|ms-appdata):\/\//i.test(value) ||
    /(?:^|[\s"'(])\/(?:data|private|storage|var)\//i.test(value) ||
    /(?:^|[\s"'(])[A-Za-z]:[\\/]/.test(value)
  );
}

function redactLocalFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLocalFields);
  if (typeof value === 'string' && isLocalPathString(value)) return '[redacted_local_path]';
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!REDACTED_LOCAL_FIELD_NAMES.has(key.toLowerCase())) {
      sanitized[key] = redactLocalFields(child);
    }
  }
  return sanitized;
}

async function exportPhotoRecords(raw: string): Promise<{
  records: Record<string, unknown>[];
  omitted_invalid_record_count: number;
  photo_files_included: false;
  thumbnails_included: false;
}> {
  const parsed = decodePhotoStoreItemsForExport(raw);

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
    let decryptedNote: string | null = null;
    if (ciphertext) {
      try {
        decryptedNote = await decryptPhotoNote(ciphertext);
      } catch (error) {
        if (!isPhotoEncryptionReadError(error)) throw error;
      }
    }
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
  collectedAt = new Date().toISOString(),
): Promise<LocalDeviceExportData> {
  const sections = emptySections();
  const stored = await getPrivateItems(LOCAL_DEVICE_EXPORT_STORAGE_KEYS);

  for (const spec of LOCAL_PRIVATE_EXPORT_SPECS) {
    const raw = stored.get(spec.key) ?? null;
    if (raw === null) continue;

    let exportValue: unknown;
    if (spec.transform === 'photo_records') {
      exportValue = await exportPhotoRecords(raw);
    } else if (spec.transform === 'conflict_choices') {
      exportValue = normalizeConflictChoicesForExport(parseStructuredStoredValue(raw, spec.key));
    } else if (spec.transform === 'safe_scalar_or_json') {
      exportValue = parseSafeScalarOrJson(raw, spec.key);
    } else {
      exportValue = parseStructuredStoredValue(raw, spec.key);
    }

    (sections[spec.section] as unknown as Record<string, unknown>)[spec.field] =
      spec.transform === 'photo_records' ? exportValue : redactLocalFields(exportValue);
  }

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
