import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { Session, User } from '@supabase/supabase-js';

import { beginHealthDataConsentWithdrawal } from '@/features/healthConsent/lifecycle';
import { beginAccountDeletionIntakeHold } from '@/features/settings/accountDeletionBarrier';
import {
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { getAppleAuthorizationCodeForRevocation } from '@/lib/auth/apple';
import { readLocalDataOwnership } from '@/lib/auth/sessionOwner';
import { BRAND } from '@/lib/brand';
import { env, isSupabaseConfigured } from '@/lib/env';
import { startRevenueCatDeletionQuiesce } from '@/lib/iap/revenuecat';
import { assertStoreTransactionDeletionJournalReadable } from '@/lib/iap/storeTransactionNotice';
import {
  cleanupPlaintextStaging,
  markPlaintextStagingState,
  reservePlaintextStaging,
} from '@/lib/storage/plaintextStaging';
import { readPersistedSupabaseSessionCandidate, supabase } from '@/lib/supabase/client';
import {
  beginSupabaseRemoteDeletionBoundary,
  closeSupabaseRemoteRequestBoundary,
  requireSupabaseRemoteSessionBinding,
  runWithSupabaseAccountDeletionRequestPermit,
  type SupabaseRemoteSessionBinding,
} from '@/lib/supabase/remoteRequestGate';

import {
  buildMobileDataExportBundle,
  collectLocalDeviceExportData,
  type MobileDataExportBundle,
} from './localDeviceExport';
import {
  type AccountDeletionClientRecord,
  accountDeletionRecordMatchesOwner,
  createAccountDeletionOwnerBinding,
  markAccountDeletionIntakeState,
  preparePendingAccountDeletion,
  requestAccountDeletionRecovery,
} from './accountDeletionClientState';
import { quarantineAccountDeletionSession } from './accountDeletionRecovery';

const DATA_RIGHTS_BACKEND_UNAVAILABLE = 'DATA_RIGHTS_BACKEND_UNAVAILABLE';
const DATA_EXPORT_USER_UNAVAILABLE = 'DATA_EXPORT_USER_UNAVAILABLE';
const DATA_EXPORT_LOCAL_OWNER_MISMATCH = 'DATA_EXPORT_LOCAL_OWNER_MISMATCH';
const DATA_EXPORT_RESPONSE_OWNER_MISMATCH = 'DATA_EXPORT_RESPONSE_OWNER_MISMATCH';
const ACCOUNT_DELETION_RESPONSE_INVALID = 'ACCOUNT_DELETION_RESPONSE_INVALID';
const ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE = 'ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE';
const ACCOUNT_DELETION_ACCEPTED_LOCAL_SIGN_OUT_INCOMPLETE =
  'ACCOUNT_DELETION_ACCEPTED_LOCAL_SIGN_OUT_INCOMPLETE';
const ACCOUNT_DELETION_REQUEST_TIMEOUT_MS = 15_000;
const ACCOUNT_DELETION_RESPONSE_MAX_CHARS = 4_096;

export type AccountDeletionResult = {
  status: 'accepted_or_ambiguous';
  phase: 'queued' | 'delayed' | 'unknown';
  nextPollAfterSeconds: number | null;
};

export type AccountDeletionIntakeTransport = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type VerifiedDeletionOwner = {
  accessToken: string;
  ownerBinding: string;
  remoteBinding: SupabaseRemoteSessionBinding;
  user: User;
};

type AccountDeletionInitiator = Readonly<{
  generation: number;
  userId: string;
}>;

function startDeletionIntakeHandoff(
  expectedUserId: string,
  remoteBinding: SupabaseRemoteSessionBinding,
): {
  publicationQuiescence: Promise<void>;
  releaseIntakeHold: () => void;
} {
  // Enter the exact-session remote deletion state before the local hold emits.
  // AuthProvider observes the already-entered state and must preserve it; this
  // prevents the hold notification from collapsing the only lane authorized to
  // durably enqueue the deletion.
  const remoteQuiescence = beginSupabaseRemoteDeletionBoundary(remoteBinding);
  const releaseIntakeHold = beginAccountDeletionIntakeHold();
  try {
    return {
      publicationQuiescence: Promise.all([
        remoteQuiescence,
        startRevenueCatDeletionQuiesce(expectedUserId),
      ]).then(() => undefined),
      releaseIntakeHold,
    };
  } catch (error) {
    void remoteQuiescence.catch(() => undefined);
    // close() publishes the closed state synchronously. The returned drain may
    // still be waiting for an abort-ignoring platform transport, so do not turn
    // that provider defect into an unhandled rejection.
    void closeSupabaseRemoteRequestBoundary().catch(() => undefined);
    releaseIntakeHold();
    throw error;
  }
}

function assertDataRightsBackendAvailable(): void {
  if (!isSupabaseConfigured) throw new Error(DATA_RIGHTS_BACKEND_UNAVAILABLE);
}

// Account deletion (Apple 5.1.1(v) / docs/01 §4): durably enqueue the server
// lifecycle, preserve recovery authority across lost responses, then sign out.
// Provider/storage/Auth completion is proven only by capability status polling.
function parseAccountDeletionResponse(data: unknown): AccountDeletionResult {
  if (
    !isRecord(data) ||
    Object.keys(data).sort().join(',') !== 'nextPollAfterSeconds,phase,status' ||
    data.status !== 'accepted' ||
    (data.phase !== 'queued' && data.phase !== 'delayed') ||
    typeof data.nextPollAfterSeconds !== 'number' ||
    !Number.isSafeInteger(data.nextPollAfterSeconds) ||
    data.nextPollAfterSeconds < 2 ||
    data.nextPollAfterSeconds > 60
  ) {
    throw new Error(ACCOUNT_DELETION_RESPONSE_INVALID);
  }
  return {
    status: 'accepted_or_ambiguous',
    phase: data.phase,
    nextPollAfterSeconds: data.nextPollAfterSeconds,
  };
}

export function isAccountDeletionAuthSessionUnavailable(error: unknown): boolean {
  return error instanceof Error && error.message === ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE;
}

export function isAcceptedAccountDeletionLocalSignOutIncomplete(error: unknown): boolean {
  return (
    error instanceof Error && error.message === ACCOUNT_DELETION_ACCEPTED_LOCAL_SIGN_OUT_INCOMPLETE
  );
}

class AccountDeletionTransportLostError extends Error {
  constructor() {
    super('ACCOUNT_DELETION_TRANSPORT_LOST');
    this.name = 'AccountDeletionTransportLostError';
  }
}

function isTransportLostInvocationError(error: unknown): boolean {
  return error instanceof AccountDeletionTransportLostError;
}

function validAccessToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 16_384 &&
    value.trim() === value
  );
}

async function captureVerifiedDeletionOwner(
  lease: AccountGenerationLease,
): Promise<VerifiedDeletionOwner> {
  let session: Session | null;
  try {
    session = await readPersistedSupabaseSessionCandidate();
  } catch {
    throw new Error(ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE);
  }
  lease.assertCurrent();
  if (!session || !validAccessToken(session.access_token)) {
    throw new Error(ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE);
  }

  let userResponse: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    userResponse = await supabase.auth.getUser(session.access_token);
  } catch {
    throw new Error(ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE);
  }
  const { data: userData, error: userError } = userResponse;
  lease.assertCurrent();
  const user = userData.user;
  if (userError || !user || user.id !== session.user.id) {
    throw new Error(ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE);
  }
  let remoteBinding: SupabaseRemoteSessionBinding;
  try {
    remoteBinding = requireSupabaseRemoteSessionBinding(session.access_token, user.id);
  } catch {
    throw new Error(ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE);
  }
  const ownerBinding = await createAccountDeletionOwnerBinding(user.id);
  lease.assertCurrent();
  return { accessToken: session.access_token, ownerBinding, remoteBinding, user };
}

async function readBoundedAccountDeletionResponse(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > ACCOUNT_DELETION_RESPONSE_MAX_CHARS) {
    throw new Error(ACCOUNT_DELETION_RESPONSE_INVALID);
  }
  const serialized = await response.text();
  if (serialized.length === 0 || serialized.length > ACCOUNT_DELETION_RESPONSE_MAX_CHARS) {
    throw new Error(ACCOUNT_DELETION_RESPONSE_INVALID);
  }
  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    throw new Error(ACCOUNT_DELETION_RESPONSE_INVALID);
  }
}

async function invokeAccountDeletionWithDeadline(
  pending: AccountDeletionClientRecord,
  owner: VerifiedDeletionOwner,
  appleAuthorizationCode: string | null,
  transport: AccountDeletionIntakeTransport,
): Promise<AccountDeletionResult> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new AccountDeletionTransportLostError());
    }, ACCOUNT_DELETION_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      (async () => {
        let response: Response;
        try {
          response = await runWithSupabaseAccountDeletionRequestPermit(
            {
              action: 'begin',
              binding: owner.remoteBinding,
              timeoutMs: ACCOUNT_DELETION_REQUEST_TIMEOUT_MS,
            },
            transport,
            (gatedTransport) =>
              gatedTransport(
                new URL('/functions/v1/account-deletion', env.supabaseUrl).toString(),
                {
                  method: 'POST',
                  headers: {
                    Accept: 'application/json',
                    apikey: env.supabasePublishableKey,
                    Authorization: `Bearer ${owner.accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    action: 'begin',
                    idempotencyKey: pending.idempotencyKey,
                    statusCapability: pending.statusCapability,
                    ...(appleAuthorizationCode ? { appleAuthorizationCode } : {}),
                  }),
                  cache: 'no-store',
                  credentials: 'omit',
                  redirect: 'error',
                  signal: controller.signal,
                },
              ),
          );
        } catch {
          throw new AccountDeletionTransportLostError();
        }
        if (response.status !== 202) throw new Error(ACCOUNT_DELETION_RESPONSE_INVALID);
        return parseAccountDeletionResponse(await readBoundedAccountDeletionResponse(response));
      })(),
      deadline,
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    // State closes synchronously even when a native transport ignores abort.
    // This must happen before any failed pre-durable attempt can release its
    // hold and allow AuthProvider to reacquire candidate authority.
    void closeSupabaseRemoteRequestBoundary().catch(() => undefined);
  }
}

async function commitExplicitAcceptance(ownerBinding: string): Promise<void> {
  try {
    await markAccountDeletionIntakeState('accepted', ownerBinding);
  } catch {
    requestAccountDeletionRecovery();
    throw new Error(ACCOUNT_DELETION_ACCEPTED_LOCAL_SIGN_OUT_INCOMPLETE);
  }
  // The owner-aware pre-Auth gate performs cleanup after the account-generation
  // lease has settled; this callback must not sign out a newly switched owner.
  requestAccountDeletionRecovery();
}

async function commitAmbiguousIntakeAndQuarantine(ownerBinding: string): Promise<void> {
  try {
    await markAccountDeletionIntakeState('ambiguous', ownerBinding);
  } catch {
    requestAccountDeletionRecovery();
    throw new Error(ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE);
  }

  // The outer gate verifies the retained session owner before it touches any
  // owner-bound local state. It deliberately preserves only the matching
  // encrypted session for an idempotent retry after a 404.
  requestAccountDeletionRecovery();
}

export async function deleteAccount(
  _completeLocalSignOut: () => Promise<void>,
  _quarantineLocalAccount: () => Promise<void> = quarantineAccountDeletionSession,
  transport: AccountDeletionIntakeTransport = (input, init) => fetch(input, init),
  expectedInitiator?: AccountDeletionInitiator,
): Promise<AccountDeletionResult> {
  assertDataRightsBackendAvailable();

  let intake:
    | { kind: 'accepted'; ownerBinding: string; result: AccountDeletionResult }
    | { kind: 'ambiguous'; ownerBinding: string; result: AccountDeletionResult };
  let releaseIntakeHold: (() => void) | null = null;
  try {
    const quiescing = await runAccountGenerationOperation(async (lease) => {
      if (expectedInitiator && lease.generation !== expectedInitiator.generation) {
        throw new Error(ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE);
      }
      const owner = await captureVerifiedDeletionOwner(lease);
      if (expectedInitiator && owner.user.id !== expectedInitiator.userId) {
        throw new Error(ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE);
      }
      const appleAuthorizationCode = await getAppleAuthorizationCodeForRevocation(owner.user).catch(
        () => null,
      );
      lease.assertCurrent();
      await assertStoreTransactionDeletionJournalReadable(owner.ownerBinding);
      lease.assertCurrent();

      // This helper must remain the final account-generation action. It closes
      // account/vendor admission synchronously and starts exact-owner commerce
      // quiescence in the same call stack. Its promise may outlive the
      // intentional account-boundary abort while native/provider work drains.
      // Do not await it or assert this lease after starting it.
      return {
        appleAuthorizationCode,
        owner,
        ...startDeletionIntakeHandoff(owner.user.id, owner.remoteBinding),
      } as const;
    });
    releaseIntakeHold = quiescing.releaseIntakeHold;

    // Wait outside the intentionally abortable generation operation. Neither
    // durable preparation for this attempt nor transport may begin until the
    // captured owner's commerce controller proves exact closed quiescence.
    await quiescing.publicationQuiescence;

    let pending: AccountDeletionClientRecord;
    try {
      pending = await preparePendingAccountDeletion(quiescing.owner.ownerBinding);
    } catch (error) {
      if (error instanceof Error && error.message === 'ACCOUNT_DELETION_OWNER_MISMATCH') {
        throw new Error(ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE);
      }
      throw error;
    }
    if (!accountDeletionRecordMatchesOwner(pending, quiescing.owner.ownerBinding)) {
      throw new Error(ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE);
    }

    // `preparePendingAccountDeletion` publishes the durable process-local
    // block before its successful persistence resolves. Releasing only after
    // the owner-bound record is verified transfers authority without an open
    // provider/Auth admission edge.
    const releasePreparedIntakeHold = releaseIntakeHold;
    releaseIntakeHold = null;
    releasePreparedIntakeHold();

    try {
      const result = await invokeAccountDeletionWithDeadline(
        pending,
        quiescing.owner,
        quiescing.appleAuthorizationCode,
        transport,
      );
      intake = {
        kind: 'accepted',
        ownerBinding: quiescing.owner.ownerBinding,
        result,
      };
    } catch (error) {
      if (!isTransportLostInvocationError(error)) throw error;
      intake = {
        kind: 'ambiguous',
        ownerBinding: quiescing.owner.ownerBinding,
        result: {
          status: 'accepted_or_ambiguous',
          phase: 'unknown',
          nextPollAfterSeconds: null,
        },
      };
    }
  } catch (error) {
    // close() changes state before returning its drain promise. Do this before
    // releasing a pre-durable hold so no lifecycle observer can resume on the
    // failed deletion session.
    if (releaseIntakeHold !== null) {
      void closeSupabaseRemoteRequestBoundary().catch(() => undefined);
    }
    releaseIntakeHold?.();
    requestAccountDeletionRecovery();
    throw error;
  }
  if (intake.kind === 'ambiguous') {
    await commitAmbiguousIntakeAndQuarantine(intake.ownerBinding);
  } else {
    await commitExplicitAcceptance(intake.ownerBinding);
  }
  return intake.result;
}

// Health-data withdrawal is purpose-limited. It freezes health processing and
// removes that purpose's data while preserving Auth, billing, entitlements,
// App Lock, and the device's store-transaction safety journal. Full account
// deletion remains a separate user action.
export async function withdrawHealthDataConsent(ownerUserId: string): Promise<void> {
  await beginHealthDataConsentWithdrawal(ownerUserId);
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
      const candidate = await readPersistedSupabaseSessionCandidate();
      lease.assertCurrent();
      if (!candidate || !validAccessToken(candidate.access_token)) {
        throw new Error(DATA_EXPORT_USER_UNAVAILABLE);
      }
      const { data, error } = await supabase.auth.getUser(candidate.access_token);
      lease.assertCurrent();
      if (error) throw error;
      const userId = data.user?.id.trim();
      if (!userId || userId !== candidate.user.id) {
        throw new Error(DATA_EXPORT_USER_UNAVAILABLE);
      }
      expectedUserId = userId;
    }

    const localOwnership = await readLocalDataOwnership(expectedUserId);
    lease.assertCurrent();
    if (
      (expectedUserId !== null && localOwnership !== 'match') ||
      (expectedUserId === null && localOwnership !== 'unclaimed')
    ) {
      throw new Error(DATA_EXPORT_LOCAL_OWNER_MISMATCH);
    }

    // The purpose-limited collector can read health-classified local bytes
    // while processing is paused only because this exact account generation
    // has just verified the durable local owner proof.
    const localDeviceData = await collectLocalDeviceExportData(lease, expectedUserId);
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
