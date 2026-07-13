import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { HEALTH_DATA_WITHDRAWAL } from '@/features/onboarding/consentCopy';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { getAppleAuthorizationCodeForRevocation } from '@/lib/auth/apple';
import { BRAND } from '@/lib/brand';
import { recordConsent } from '@/lib/consent/consent';
import { isSupabaseConfigured } from '@/lib/env';
import {
  cleanupPlaintextStaging,
  markPlaintextStagingState,
  reservePlaintextStaging,
} from '@/lib/storage/plaintextStaging';
import { supabase } from '@/lib/supabase/client';

import {
  buildMobileDataExportBundle,
  collectLocalDeviceExportData,
  type MobileDataExportBundle,
} from './localDeviceExport';

const DATA_RIGHTS_BACKEND_UNAVAILABLE = 'DATA_RIGHTS_BACKEND_UNAVAILABLE';
const DATA_EXPORT_USER_UNAVAILABLE = 'DATA_EXPORT_USER_UNAVAILABLE';
const DATA_EXPORT_RESPONSE_OWNER_MISMATCH = 'DATA_EXPORT_RESPONSE_OWNER_MISMATCH';

function assertDataRightsBackendAvailable(): void {
  if (!isSupabaseConfigured) throw new Error(DATA_RIGHTS_BACKEND_UNAVAILABLE);
}

// Account deletion (Apple 5.1.1(v) / docs/01 §4): calls the service-role Edge
// Function which revokes the SIWA token, deletes the auth user (FK-cascades all
// tables), purges Storage, and removes the RC/PostHog records, then signs out.
export async function deleteAccount(completeLocalSignOut: () => Promise<void>): Promise<void> {
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
  await completeLocalSignOut();
}

// Health-data consent withdrawal (docs/01 §4: MHMDA/GDPR right to withdraw,
// which must be as easy as granting). The skin profile, quiz answers, and
// goals ARE the account, so withdrawing health-data-collection consent records
// an immutable granted=false ledger row (proof of the withdrawal) and then
// deletes the account and all data via the same cascade as deleteAccount. The
// You-tab copy that promises "your data is then deleted" is now backed by code.
export async function withdrawHealthDataConsent(
  completeLocalSignOut: () => Promise<void>,
): Promise<void> {
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
  await deleteAccount(completeLocalSignOut);
}

// GDPR Art. 20 export (docs/01 §4): the Edge Function assembles a JSON bundle;
// the mobile layer adds every registered private device record after removing
// local media paths, credentials, and encryption material. We then write the
// combined bundle to a one-time cache file and remove it after the share attempt.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseServerExport(data: unknown, expectedUserId: string): Record<string, unknown> {
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
  if (parsed.user_id !== expectedUserId) {
    throw new Error(DATA_EXPORT_RESPONSE_OWNER_MISMATCH);
  }
  return parsed;
}

async function waitForExportE2EDelay(signal: AbortSignal): Promise<void> {
  const rawDelay =
    typeof __DEV__ !== 'undefined' && __DEV__
      ? process.env.EXPO_PUBLIC_E2E_DATA_EXPORT_DELAY_MS
      : undefined;
  const delayMs = Number(rawDelay);
  if (!Number.isFinite(delayMs) || delayMs <= 0) return;

  await new Promise<void>((resolve) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (timeout) clearTimeout(timeout);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    timeout = setTimeout(finish, Math.min(delayMs, 10_000));
    if (signal.aborted) finish();
    else signal.addEventListener('abort', finish, { once: true });
  });
}

export async function exportData(): Promise<boolean> {
  return runAccountGenerationOperation(async (lease) => {
    let expectedUserId: string | null = null;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.getUser();
      lease.assertCurrent();
      if (error) throw error;
      const userId = data.user?.id.trim();
      if (!userId) throw new Error(DATA_EXPORT_USER_UNAVAILABLE);
      expectedUserId = userId;
    }

    const localDeviceData = await collectLocalDeviceExportData();
    lease.assertCurrent();
    await waitForExportE2EDelay(lease.signal);
    lease.assertCurrent();
    let serverAccountData: unknown | null = null;
    let serverAccountDataStatus: MobileDataExportBundle['server_account_data_status'] =
      'backend_not_configured';

    if (expectedUserId) {
      let response;
      try {
        response = await supabase.functions.invoke('data-export', {
          method: 'POST',
          signal: lease.signal,
        });
      } catch (error) {
        lease.assertCurrent();
        throw error;
      }
      lease.assertCurrent();
      if (response.error) throw response.error;
      serverAccountData = parseServerExport(response.data, expectedUserId);
      serverAccountDataStatus = 'included';
    }

    const staging = await reservePlaintextStaging('data_export_json');
    try {
      const json = JSON.stringify(
        buildMobileDataExportBundle({
          localDeviceData,
          serverAccountData,
          serverAccountDataStatus,
        }),
        null,
        2,
      );
      lease.assertCurrent();
      await FileSystem.writeAsStringAsync(staging.uri, json);
      lease.assertCurrent();
      await markPlaintextStagingState(staging, 'plaintext_written');
      lease.assertCurrent();
      const sharingAvailable = await Sharing.isAvailableAsync().catch(() => false);
      lease.assertCurrent();
      if (!sharingAvailable) return false;
      try {
        await markPlaintextStagingState(staging, 'sharing');
        lease.assertCurrent();
        await Sharing.shareAsync(staging.uri, {
          mimeType: 'application/json',
          dialogTitle: `Export your ${BRAND.appName} data`,
        });
        lease.assertCurrent();
        return true;
      } catch {
        lease.assertCurrent();
        return false;
      }
    } finally {
      await cleanupPlaintextStaging(staging).catch(() => undefined);
    }
  });
}
