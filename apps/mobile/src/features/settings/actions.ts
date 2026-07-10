import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { HEALTH_DATA_WITHDRAWAL } from '@/features/onboarding/consentCopy';
import { recordConsent } from '@/lib/consent/consent';
import { getAppleAuthorizationCodeForRevocation } from '@/lib/auth/apple';
import { BRAND, brandCachePrefix } from '@/lib/brand';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase/client';

import { clearLocalPrivateData } from './localPrivateData';
import {
  buildMobileDataExportBundle,
  collectLocalDeviceExportData,
  type MobileDataExportBundle,
} from './localDeviceExport';

const DATA_RIGHTS_BACKEND_UNAVAILABLE = 'DATA_RIGHTS_BACKEND_UNAVAILABLE';

function assertDataRightsBackendAvailable(): void {
  if (!isSupabaseConfigured) throw new Error(DATA_RIGHTS_BACKEND_UNAVAILABLE);
}

// Account deletion (Apple 5.1.1(v) / docs/01 §4): calls the service-role Edge
// Function which revokes the SIWA token, deletes the auth user (FK-cascades all
// tables), purges Storage, and removes the RC/PostHog records, then signs out.
export async function deleteAccount(): Promise<void> {
  assertDataRightsBackendAvailable();

  const { data } = await supabase.auth.getUser();
  const appleAuthorizationCode = data.user
    ? await getAppleAuthorizationCodeForRevocation(data.user).catch(() => null)
    : null;
  const { error } = await supabase.functions.invoke('account-deletion', {
    method: 'POST',
    body: appleAuthorizationCode ? { appleAuthorizationCode } : {},
  });
  if (error) throw error;
  try {
    await supabase.auth.signOut();
  } finally {
    await clearLocalPrivateData();
  }
}

// Health-data consent withdrawal (docs/01 §4: MHMDA/GDPR right to withdraw,
// which must be as easy as granting). The skin profile, quiz answers, and
// goals ARE the account, so withdrawing health-data-collection consent records
// an immutable granted=false ledger row (proof of the withdrawal) and then
// deletes the account and all data via the same cascade as deleteAccount. The
// You-tab copy that promises "your data is then deleted" is now backed by code.
export async function withdrawHealthDataConsent(): Promise<void> {
  assertDataRightsBackendAvailable();

  try {
    await recordConsent({
      type: 'health_data_collection',
      granted: false,
      version: HEALTH_DATA_WITHDRAWAL.version,
      consentText: HEALTH_DATA_WITHDRAWAL.fullText,
    });
  } catch {
    // The deletion below is the substantive guarantee and runs even if the
    // consent-ledger write is temporarily unavailable.
  }
  await deleteAccount();
}

// GDPR Art. 20 export (docs/01 §4): the Edge Function assembles a JSON bundle;
// the mobile layer adds every registered private device record after removing
// local media paths, credentials, and encryption material. We then write the
// combined bundle to a one-time cache file and remove it after the share attempt.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseServerExport(data: unknown): Record<string, unknown> {
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      throw new Error('DATA_EXPORT_RESPONSE_INVALID');
    }
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.user_id !== 'string' ||
    parsed.user_id.trim().length === 0 ||
    typeof parsed.export_schema_version !== 'number' ||
    !Number.isInteger(parsed.export_schema_version) ||
    parsed.export_schema_version < 1
  ) {
    throw new Error('DATA_EXPORT_RESPONSE_INVALID');
  }
  return parsed;
}

export async function exportData(): Promise<boolean> {
  const localDeviceData = await collectLocalDeviceExportData();
  let serverAccountData: unknown | null = null;
  let serverAccountDataStatus: MobileDataExportBundle['server_account_data_status'] =
    'backend_not_configured';

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.functions.invoke('data-export', { method: 'POST' });
    if (error) throw error;
    serverAccountData = parseServerExport(data);
    serverAccountDataStatus = 'included';
  }

  const json = JSON.stringify(
    buildMobileDataExportBundle({
      localDeviceData,
      serverAccountData,
      serverAccountDataStatus,
    }),
    null,
    2,
  );
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('DATA_EXPORT_CACHE_UNAVAILABLE');
  const exportCachePrefix = brandCachePrefix('export');
  const uri = `${cacheDirectory}${exportCachePrefix}${Date.now()}.json`;
  try {
    await FileSystem.writeAsStringAsync(uri, json);
    if (!(await Sharing.isAvailableAsync().catch(() => false))) return false;
    try {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: `Export your ${BRAND.appName} data`,
      });
      return true;
    } catch {
      return false;
    }
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}
