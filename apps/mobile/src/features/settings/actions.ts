import * as Sharing from 'expo-sharing';

import { HEALTH_DATA_WITHDRAWAL } from '@/features/onboarding/consentCopy';
import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { freezeAnalyticsIdentityForAccountDeletion } from '@/lib/analytics/track';
import {
  armAccountDeletionVendorFreeze,
  markAccountDeletionBackendDeleted,
  markAccountDeletionBackendDeletedFromCompletion,
  readAccountDeletionRecoveryCapability,
} from '@/lib/auth/accountDeletionVendorFreeze';
import { lookupAccountDeletionCompletion } from '@/lib/auth/accountDeletionCompletion';
import { getAppleAuthorizationCodeForRevocation, userHasAppleIdentity } from '@/lib/auth/apple';
import { BRAND } from '@/lib/brand';
import { recordConsent } from '@/lib/consent/consent';
import { isSupabaseConfigured } from '@/lib/env';
import {
  freezeRevenueCatIdentityForAccountDeletion,
  waitForRevenueCatOperationsToSettle,
} from '@/lib/iap/revenuecat';
import { invokeEdgeFunction } from '@/lib/network/edgeFunctions';
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
import { writeMobileDataExportFile } from './mobileDataExportWriter';

const DATA_RIGHTS_BACKEND_UNAVAILABLE = 'DATA_RIGHTS_BACKEND_UNAVAILABLE';
const DATA_EXPORT_USER_UNAVAILABLE = 'DATA_EXPORT_USER_UNAVAILABLE';
const DATA_EXPORT_RESPONSE_OWNER_MISMATCH = 'DATA_EXPORT_RESPONSE_OWNER_MISMATCH';
const ACCOUNT_DELETION_USER_UNAVAILABLE = 'ACCOUNT_DELETION_USER_UNAVAILABLE';
const APPLE_REAUTHORIZATION_REQUIRED = 'APPLE_REAUTHORIZATION_REQUIRED';
const ACCOUNT_DELETION_RESPONSE_INVALID = 'ACCOUNT_DELETION_RESPONSE_INVALID';
const ACCOUNT_DELETION_VENDOR_RESET_WAIT_MS = 8_000;
const ACCOUNT_DELETION_VENDOR_OPERATION_WAIT_MS = 1_500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertDataRightsBackendAvailable(): void {
  if (!isSupabaseConfigured) throw new Error(DATA_RIGHTS_BACKEND_UNAVAILABLE);
}

function assertAccountDeletionResponse(data: unknown): void {
  if (
    !isRecord(data) ||
    data.deleted !== true ||
    typeof data.request_id !== 'string' ||
    !UUID_PATTERN.test(data.request_id) ||
    (data.apple !== 'revoked' && data.apple !== 'skipped') ||
    (data.posthog !== 'deleted' && data.posthog !== 'already_absent' && data.posthog !== 'skipped')
  ) {
    throw new Error(ACCOUNT_DELETION_RESPONSE_INVALID);
  }
}

async function settleVendorIdentityResetsWithinBound(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  // Both SDKs are hard preconditions. RevenueCat's configure API returns void,
  // so its reset performs a supported async native read before logout; PostHog
  // seals and drains its persisted queues. Proceeding after either fails could
  // recreate vendor identity after the backend provider deletion.
  const resets = Promise.all([
    freezeAnalyticsIdentityForAccountDeletion(),
    freezeRevenueCatIdentityForAccountDeletion(),
  ]).then(() => undefined);
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('ACCOUNT_DELETION_VENDOR_RESET_TIMEOUT')),
      ACCOUNT_DELETION_VENDOR_RESET_WAIT_MS,
    );
  });

  try {
    await Promise.race([resets, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function requireRevenueCatOperationsSettledWithinBound(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('ACCOUNT_DELETION_VENDOR_ACTIVITY_IN_FLIGHT')),
      ACCOUNT_DELETION_VENDOR_OPERATION_WAIT_MS,
    );
  });

  try {
    await Promise.race([waitForRevenueCatOperationsToSettle(), deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// Account deletion (Apple 5.1.1(v) / docs/01 §4): calls the service-role Edge
// Function which revokes the SIWA token, deletes the auth user (FK-cascades all
// tables), purges Storage, and removes the RC/PostHog records, then signs out.
async function requestAccountDeletion(lease: AccountGenerationLease): Promise<void> {
  const { data, error: userError } = await awaitAccountGenerationLease(lease, () =>
    supabase.auth.getUser(),
  );
  lease.assertCurrent();
  if (userError || !data.user) {
    // A guarded auth.users delete can commit while its final Edge response is
    // lost. The owner-independent capability reveals only a terminal receipt;
    // it cannot start or advance deletion and remains usable after relaunch.
    const capability = await readAccountDeletionRecoveryCapability();
    lease.assertCurrent();
    const completion = capability
      ? await lookupAccountDeletionCompletion(capability.completionToken, lease.signal)
      : null;
    lease.assertCurrent();
    if (!capability || !completion) throw new Error(ACCOUNT_DELETION_USER_UNAVAILABLE);
    await markAccountDeletionBackendDeletedFromCompletion(capability.completionToken);
    lease.assertCurrent();
    return;
  }

  let appleAuthorizationCode: string | null = null;
  if (userHasAppleIdentity(data.user)) {
    // Apple authorization codes are single-use. Cancellation, native failure,
    // or a blank refresh result must abort before the Edge Function can record
    // and freeze a deletion request. Every explicit retry reauthenticates again.
    try {
      appleAuthorizationCode = await awaitAccountGenerationLease(lease, () =>
        getAppleAuthorizationCodeForRevocation(data.user),
      );
    } catch (error) {
      // A prompt that ignores cancellation must not pin account isolation, and
      // its late native error must never replace generation invalidation.
      lease.assertCurrent();
      throw error;
    }
    lease.assertCurrent();
    if (!appleAuthorizationCode) throw new Error(APPLE_REAUTHORIZATION_REQUIRED);
  }
  // Unlike detached provider reads, this durable local write must remain part
  // of the tracked owner operation so an account boundary drains it before
  // cleanup can remove the receipt.
  const completionToken = await armAccountDeletionVendorFreeze(data.user.id);
  lease.assertCurrent();
  // Refuse backend deletion while a locally-started purchase, restore, fetch,
  // configure, or login can still recreate the provider subscriber afterward.
  // A force-quit drops the native promise while the durable gate remains armed,
  // so a later retry can safely continue instead of waiting forever.
  await awaitAccountGenerationLease(lease, requireRevenueCatOperationsSettledWithinBound);
  lease.assertCurrent();
  // Both vendor freezes are hard preconditions: queued telemetry or an
  // already-started native subscriber initialization could otherwise recreate
  // provider state after Edge deletes it.
  await awaitAccountGenerationLease(lease, settleVendorIdentityResetsWithinBound);
  lease.assertCurrent();
  const requestBody = {
    ...(appleAuthorizationCode ? { appleAuthorizationCode } : {}),
    completionToken,
  };
  let primaryError: unknown = null;
  try {
    const response = await invokeEdgeFunction<unknown>('account-deletion', {
      method: 'POST',
      body: requestBody,
      signal: lease.signal,
    });
    lease.assertCurrent();
    assertAccountDeletionResponse(response);
  } catch (error) {
    lease.assertCurrent();
    primaryError = error;
    try {
      // This never replays the single-use Apple code or deletion actions. It
      // only proves that the guarded auth-delete transaction already committed
      // when the worker/process/network lost the final response.
      const completion = await lookupAccountDeletionCompletion(completionToken, lease.signal);
      lease.assertCurrent();
      if (!completion) throw new Error('ACCOUNT_DELETION_NOT_COMPLETE');
    } catch {
      lease.assertCurrent();
      throw primaryError;
    }
  }
  // This durable state is the only authority allowed to remove the receipt
  // during the subsequent local cleanup, including after a force-quit/relaunch.
  await markAccountDeletionBackendDeleted(data.user.id);
  lease.assertCurrent();
}

async function completeDeletionBoundaryHandoff(
  lease: AccountGenerationLease,
  completeLocalSignOut: () => Promise<void>,
): Promise<void> {
  const endHandoff = lease.beginBoundaryHandoff();
  try {
    await completeLocalSignOut();
  } finally {
    endHandoff();
  }
}

export async function deleteAccount(completeLocalSignOut: () => Promise<void>): Promise<void> {
  assertDataRightsBackendAvailable();

  await runAccountGenerationOperation(async (lease) => {
    await requestAccountDeletion(lease);
    await completeDeletionBoundaryHandoff(lease, completeLocalSignOut);
  });
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

  await runAccountGenerationOperation(async (lease) => {
    try {
      await recordConsent({
        type: 'health_data_collection',
        granted: false,
        version: HEALTH_DATA_WITHDRAWAL.version,
        consentText: HEALTH_DATA_WITHDRAWAL.fullText,
      });
      lease.assertCurrent();
    } catch {
      // Ordinary ledger outages do not weaken deletion, but a boundary makes
      // this assertion fail so an owner-A withdrawal can never delete owner B.
      lease.assertCurrent();
    }
    await requestAccountDeletion(lease);
    await completeDeletionBoundaryHandoff(lease, completeLocalSignOut);
  });
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
    await waitForExportE2EDelay(lease.signal);
    lease.assertCurrent();
    let expectedUserId: string | null = null;
    if (isSupabaseConfigured) {
      const { data, error } = await awaitAccountGenerationLease(lease, () =>
        supabase.auth.getUser(),
      );
      lease.assertCurrent();
      if (error) throw error;
      const userId = data.user?.id.trim();
      if (!userId) throw new Error(DATA_EXPORT_USER_UNAVAILABLE);
      expectedUserId = userId;
    }

    const localDeviceData = await collectLocalDeviceExportData();
    lease.assertCurrent();
    let serverAccountData: unknown | null = null;
    let serverAccountDataStatus: MobileDataExportBundle['server_account_data_status'] =
      'backend_not_configured';

    if (expectedUserId) {
      let responseData: unknown;
      try {
        responseData = await invokeEdgeFunction('data-export', {
          method: 'POST',
          signal: lease.signal,
        });
      } catch (error) {
        lease.assertCurrent();
        throw error;
      }
      lease.assertCurrent();
      serverAccountData = parseServerExport(responseData, expectedUserId);
      serverAccountDataStatus = 'included';
    }

    const staging = await reservePlaintextStaging('data_export_json');
    try {
      const bundle = buildMobileDataExportBundle({
        localDeviceData,
        serverAccountData,
        serverAccountDataStatus,
      });
      lease.assertCurrent();
      await writeMobileDataExportFile(staging.uri, bundle, lease);
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
