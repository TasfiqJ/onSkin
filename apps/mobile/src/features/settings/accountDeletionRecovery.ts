import * as Notifications from 'expo-notifications';
import type { Session } from '@supabase/supabase-js';

import { purgeSensitiveImageMemory } from '@/features/photos/sensitiveImageMemory';
import { resetAnalyticsIdentity } from '@/lib/analytics/track';
import { clearAuthDerivedLocalActivity } from '@/lib/auth/revokedCredentialActivity';
import { clearAccountIsolatedState } from '@/lib/auth/localAccountIsolation';
import {
  localDataOwnerBinding,
  quarantineUnclaimedLocalDataForSignedOutRestore,
  readLocalDataOwnerProofBinding,
  retainLocalDataOwnerForSignedOutRestore,
} from '@/lib/auth/sessionOwner';
import {
  clearPersistedSupabaseSession,
  readPersistedSupabaseSessionCandidate,
  supabase,
} from '@/lib/supabase/client';
import { parseSupabaseAccessTokenClaims } from '@/lib/supabase/authRefreshProtection';
import {
  closeSupabaseRemoteRequestBoundary,
  isSupabaseRemoteRequestAdmissionError,
  runWithSupabaseAccountDeletionRequestPermit,
  runWithSupabaseAuthVerificationPermit,
  setSupabaseRemoteRequestCandidate,
  type SupabaseRemoteRequestTransport,
  waitForSupabaseRemoteResidualSettlement,
} from '@/lib/supabase/remoteRequestGate';
import { env, isSupabaseConfigured } from '@/lib/env';
import { resetRevenueCatIdentity } from '@/lib/iap/revenuecat';
import { convertStoreTransactionNoticeForTerminalDeletion } from '@/lib/iap/storeTransactionNotice';
import { queryClient } from '@/lib/query/queryClient';

import {
  type AccountDeletionClientRecord,
  accountDeletionRecordMatchesOwner,
  clearCompletedAccountDeletionState,
  markAccountDeletionIntakeState,
} from './accountDeletionClientState';
import { queueAppleManualRevocationNotice } from './accountDeletionNotice';

const STATUS_CAPABILITY_PATTERN = /^[a-f0-9]{64}$/;
const LOWERCASE_CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MIN_POLL_SECONDS = 2;
const MAX_POLL_SECONDS = 60;
const MAX_STATUS_BODY_CHARS = 4_096;
const ACCOUNT_DELETION_REQUEST_TIMEOUT_MS = 15_000;

const STATUS_PHASES = [
  'queued',
  'processing',
  'local_erasing',
  'provider_verifying',
  'delayed',
] as const;

export type AccountDeletionPublicPhase = (typeof STATUS_PHASES)[number];

export type AccountDeletionStatusOutcome =
  | {
      kind: 'pending';
      status: 'pending' | 'delayed';
      phase: AccountDeletionPublicPhase;
      nextPollAfterSeconds: number;
    }
  | {
      kind: 'completed';
      notice: 'remove_apple_authorization' | null;
    }
  | { kind: 'invalid' }
  | { kind: 'expired' };

export type AccountDeletionStatusTransport = SupabaseRemoteRequestTransport;

export type AccountDeletionSessionDependencies = {
  clearSession: () => Promise<void>;
  clearIsolatedState: () => Promise<void>;
  clearAuthDerivedActivity: () => Promise<void>;
  quarantineUnclaimedLocalData: () => Promise<void>;
  retainLocalDataOwner: () => Promise<void>;
};

export type AccountDeletionFinalizationDependencies = AccountDeletionSessionDependencies & {
  convertStoreSafetyNotice: (ownerBinding: string) => Promise<void>;
  queueAppleNotice: () => unknown;
  clearCompletedState: () => Promise<void>;
};

export type AcceptedAccountDeletionDependencies = AccountDeletionSessionDependencies & {
  markAccepted: (ownerBinding: string) => Promise<AccountDeletionClientRecord>;
};

export type AccountDeletionQuarantineDependencies = Pick<
  AccountDeletionSessionDependencies,
  'clearIsolatedState' | 'clearAuthDerivedActivity'
>;

export type AccountDeletionCleanupOptions = {
  clearIsolatedState: boolean;
  clearSession: boolean;
  quarantineUnclaimedLocalData: boolean;
  retainLocalDataOwner: boolean;
};

export type AccountDeletionRecoveryOwnership = {
  localData: 'foreign' | 'match' | 'unclaimed';
  session: 'foreign' | 'match' | 'none' | 'rejected' | 'unverified';
};

export type AccountDeletionOwnershipDependencies = {
  readSessionCandidate: () => Promise<Session | null>;
  verifyUser: typeof supabase.auth.getUser;
  readLocalOwnerBinding: () => Promise<string | null>;
};

type AccountDeletionRecoveryErrorCode =
  | 'ACCOUNT_DELETION_STATUS_UNAVAILABLE'
  | 'ACCOUNT_DELETION_STATUS_RESPONSE_INVALID'
  | 'ACCOUNT_DELETION_COMPLETION_INVALID'
  | 'ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE';

class AccountDeletionRecoveryError extends Error {
  constructor(readonly code: AccountDeletionRecoveryErrorCode) {
    super(code);
    this.name = 'AccountDeletionRecoveryError';
  }
}

async function closeRemoteBeforeAuthStorageMutation(): Promise<void> {
  try {
    await closeSupabaseRemoteRequestBoundary();
  } catch (error) {
    if (
      !isSupabaseRemoteRequestAdmissionError(
        error,
        'SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED',
      )
    ) {
      throw error;
    }
    // A drain deadline closes admission but does not prove an SDK continuation
    // stopped. Preserve the encrypted session until that continuation truly
    // settles, then repeat close so no stale completion can republish it.
    await waitForSupabaseRemoteResidualSettlement();
    await closeSupabaseRemoteRequestBoundary();
  }
}

async function clearRecoverySupabaseSession(): Promise<void> {
  // Central remote authority must be closed and fully drained before encrypted
  // auth storage changes.
  await closeRemoteBeforeAuthStorageMutation();
  let firstFailure: unknown = null;
  // Do not call auth.signOut({ scope: 'local' }): auth-js routes it through
  // _useSession/getSession and may implicitly refresh a near-expiry token. The
  // pre-Auth recovery gate owns no mounted AuthProvider state; clearing the
  // encrypted backing store after true remote quiescence is the local signout.
  try {
    await closeRemoteBeforeAuthStorageMutation();
    await clearPersistedSupabaseSession();
  } catch (error) {
    firstFailure ??= error;
  }
  if (firstFailure) throw firstFailure;
}

const clearDefaultAuthDerivedActivity = () =>
  clearAuthDerivedLocalActivity({
    cancelQueries: () => queryClient.cancelQueries(),
    cancelScheduledNotifications: () => Notifications.cancelAllScheduledNotificationsAsync(),
    clearQueries: () => queryClient.clear(),
    purgeSensitiveImageMemory,
    resetAnalyticsIdentity,
    resetRevenueCatIdentity,
  });

const defaultSessionDependencies: AccountDeletionSessionDependencies = {
  clearSession: clearRecoverySupabaseSession,
  clearIsolatedState: clearAccountIsolatedState,
  clearAuthDerivedActivity: clearDefaultAuthDerivedActivity,
  quarantineUnclaimedLocalData: quarantineUnclaimedLocalDataForSignedOutRestore,
  retainLocalDataOwner: retainLocalDataOwnerForSignedOutRestore,
};

const defaultQuarantineDependencies: AccountDeletionQuarantineDependencies = {
  clearIsolatedState: clearAccountIsolatedState,
  clearAuthDerivedActivity: clearDefaultAuthDerivedActivity,
};

const defaultFinalizationDependencies: AccountDeletionFinalizationDependencies = {
  ...defaultSessionDependencies,
  convertStoreSafetyNotice: convertStoreTransactionNoticeForTerminalDeletion,
  queueAppleNotice: queueAppleManualRevocationNotice,
  clearCompletedState: clearCompletedAccountDeletionState,
};

const defaultAcceptedDependencies: AcceptedAccountDeletionDependencies = {
  ...defaultSessionDependencies,
  markAccepted: (ownerBinding) => markAccountDeletionIntakeState('accepted', ownerBinding),
};

async function verifyPersistedRecoveryUser(accessToken: string) {
  const claims = parseSupabaseAccessTokenClaims(accessToken);
  if (claims === null || !LOWERCASE_CANONICAL_UUID_PATTERN.test(claims.subject)) {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE');
  }

  // This gate mounts before AuthProvider, so normal active-session admission is
  // deliberately closed. Establish only an exact candidate bearer and only an
  // auth-verify semantic permit; never open the general Supabase lane or let
  // auth-js refresh the retained deletion-recovery session.
  await closeRemoteBeforeAuthStorageMutation();
  const binding = setSupabaseRemoteRequestCandidate(accessToken, claims.subject);
  try {
    return await runWithSupabaseAuthVerificationPermit(
      binding,
      () => supabase.auth.getUser(accessToken),
      ACCOUNT_DELETION_REQUEST_TIMEOUT_MS,
    );
  } finally {
    // Recovery ownership proof is a one-request capability. Close and truly
    // drain it before status polling or any eventual encrypted-session clear.
    await closeRemoteBeforeAuthStorageMutation();
  }
}

const defaultOwnershipDependencies: AccountDeletionOwnershipDependencies = {
  readSessionCandidate: readPersistedSupabaseSessionCandidate,
  verifyUser: verifyPersistedRecoveryUser,
  readLocalOwnerBinding: readLocalDataOwnerProofBinding,
};

function isAuthoritativeSessionRejection(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || Array.isArray(error)) return false;
  const status = (error as { status?: unknown }).status;
  return status === 401 || status === 403;
}

/**
 * Prove which retained authorities belong to the durable deletion owner. A
 * legacy record has no owner binding and therefore authorizes no private-data
 * cleanup; any existing local owner is foreign and must survive forced sign-out.
 */
export async function resolveAccountDeletionRecoveryOwnership(
  record: AccountDeletionClientRecord,
  dependencies: AccountDeletionOwnershipDependencies = defaultOwnershipDependencies,
): Promise<AccountDeletionRecoveryOwnership> {
  let storedLocalOwner: string | null;
  try {
    storedLocalOwner = await dependencies.readLocalOwnerBinding();
  } catch {
    // Storage uncertainty is not equivalent to an unclaimed device. Keep the
    // pre-Auth recovery gate closed so a foreign session cannot be cleared and
    // strand still-owned private data without a durable retention marker.
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE');
  }
  const localData =
    storedLocalOwner === null
      ? 'unclaimed'
      : record.version === 2 && storedLocalOwner === record.ownerBinding
        ? 'match'
        : 'foreign';

  if (record.version !== 2) return { localData, session: 'unverified' };

  let candidate: Session | null;
  try {
    candidate = await dependencies.readSessionCandidate();
  } catch {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE');
  }
  if (!candidate) return { localData, session: 'none' };

  let verified: Awaited<ReturnType<AccountDeletionOwnershipDependencies['verifyUser']>>;
  try {
    verified = await dependencies.verifyUser(candidate.access_token);
  } catch {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE');
  }
  if (verified.error) {
    if (isAuthoritativeSessionRejection(verified.error)) {
      return { localData, session: 'rejected' };
    }
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE');
  }
  const user = verified.data.user;
  if (!user || typeof user.id !== 'string' || !LOWERCASE_CANONICAL_UUID_PATTERN.test(user.id)) {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE');
  }

  try {
    // The bearer verification response is authoritative. The cached session
    // user object is not cleanup or retry authority and may be stale/corrupt.
    const binding = await localDataOwnerBinding(user.id);
    return {
      localData,
      session: accountDeletionRecordMatchesOwner(record, binding) ? 'match' : 'foreign',
    };
  } catch {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE');
  }
}

export function accountDeletionCleanupOptions(
  ownership: AccountDeletionRecoveryOwnership,
): AccountDeletionCleanupOptions {
  return {
    // An authoritatively foreign, missing, or rejected session must not survive
    // a deletion recovery gate. Transient/unclassified Auth failures throw
    // before this decision and leave the retry session and durable proof intact.
    // It could otherwise remount Auth/vendor/query state behind A's durable
    // record. Only the retry quarantine path intentionally skips session
    // cleanup, and that path is entered only for a server-verified owner match.
    clearSession: true,
    // The v2 owner binding was created from a server-verified token before the
    // request, so its match with the existing local owner hash remains valid
    // private-cleanup authority after A's Auth session has already disappeared.
    clearIsolatedState: ownership.localData === 'match',
    // Recovery for A must not turn its forced sign-out of a valid retained B
    // owner into a cold-start wipe. The owner-bound marker is committed before
    // Auth is cleared and is consumable only by B's exact reauthentication.
    retainLocalDataOwner: ownership.localData === 'foreign',
    // Ownerless data has no subject proof. Commit a durable quarantine before
    // forced sign-out so cold restore preserves it, while every later login
    // must complete the destructive boundary before ownership can be claimed.
    quarantineUnclaimedLocalData: ownership.localData === 'unclaimed',
  };
}

function accountDeletionRecoveryError(code: AccountDeletionRecoveryErrorCode): Error {
  return new AccountDeletionRecoveryError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validPollSeconds(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= MIN_POLL_SECONDS &&
    value <= MAX_POLL_SECONDS
  );
}

function isStatusPhase(value: unknown): value is AccountDeletionPublicPhase {
  return typeof value === 'string' && STATUS_PHASES.some((phase) => phase === value);
}

export function parseAccountDeletionStatusResponse(
  httpStatus: number,
  body: unknown,
): AccountDeletionStatusOutcome {
  if (!isRecord(body)) {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_STATUS_RESPONSE_INVALID');
  }

  if (httpStatus === 200) {
    const hasNotice = Object.prototype.hasOwnProperty.call(body, 'notice');
    if (
      !hasExactKeys(body, hasNotice ? ['status', 'notice'] : ['status']) ||
      body.status !== 'completed' ||
      (hasNotice && body.notice !== 'remove_apple_authorization')
    ) {
      throw accountDeletionRecoveryError('ACCOUNT_DELETION_STATUS_RESPONSE_INVALID');
    }
    return {
      kind: 'completed',
      notice: hasNotice ? 'remove_apple_authorization' : null,
    };
  }

  if (httpStatus === 202) {
    if (
      !hasExactKeys(body, ['status', 'phase', 'nextPollAfterSeconds']) ||
      (body.status !== 'pending' && body.status !== 'delayed') ||
      !isStatusPhase(body.phase) ||
      !validPollSeconds(body.nextPollAfterSeconds) ||
      (body.status === 'delayed') !== (body.phase === 'delayed')
    ) {
      throw accountDeletionRecoveryError('ACCOUNT_DELETION_STATUS_RESPONSE_INVALID');
    }
    return {
      kind: 'pending',
      status: body.status,
      phase: body.phase,
      nextPollAfterSeconds: body.nextPollAfterSeconds,
    };
  }

  if (httpStatus === 404 && hasExactKeys(body, ['status']) && body.status === 'invalid') {
    return { kind: 'invalid' };
  }
  if (httpStatus === 410 && hasExactKeys(body, ['status']) && body.status === 'expired') {
    return { kind: 'expired' };
  }

  throw accountDeletionRecoveryError('ACCOUNT_DELETION_STATUS_RESPONSE_INVALID');
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0 || text.length > MAX_STATUS_BODY_CHARS) {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_STATUS_RESPONSE_INVALID');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_STATUS_RESPONSE_INVALID');
  }
}

/**
 * Status is authorized only by the random capability. Deliberately use a raw
 * request with the public project key instead of the Supabase Auth client so a
 * stale account JWT is neither required nor consulted during startup recovery.
 */
export async function fetchAccountDeletionStatus(
  statusCapability: string,
  transport: AccountDeletionStatusTransport = (input, init) => fetch(input, init),
): Promise<AccountDeletionStatusOutcome> {
  if (!STATUS_CAPABILITY_PATTERN.test(statusCapability) || !isSupabaseConfigured) {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_STATUS_UNAVAILABLE');
  }

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(accountDeletionRecoveryError('ACCOUNT_DELETION_STATUS_UNAVAILABLE'));
    }, ACCOUNT_DELETION_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      (async () => {
        const response = await runWithSupabaseAccountDeletionRequestPermit(
          { action: 'status', timeoutMs: ACCOUNT_DELETION_REQUEST_TIMEOUT_MS },
          transport,
          (gatedTransport) =>
            gatedTransport(
              new URL('/functions/v1/account-deletion', env.supabaseUrl).toString(),
              {
                method: 'POST',
                headers: {
                  apikey: env.supabasePublishableKey,
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'status', capability: statusCapability }),
                cache: 'no-store',
                credentials: 'omit',
                signal: controller.signal,
              },
            ),
        );

        if (![200, 202, 404, 410].includes(response.status)) {
          throw accountDeletionRecoveryError('ACCOUNT_DELETION_STATUS_UNAVAILABLE');
        }
        const body = await readBoundedJson(response);
        return parseAccountDeletionStatusResponse(response.status, body);
      })(),
      deadline,
    ]);
  } catch (error) {
    if (error instanceof AccountDeletionRecoveryError) throw error;
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_STATUS_UNAVAILABLE');
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/**
 * Clear every account/vendor/query surface while intentionally preserving the
 * encrypted Supabase session for one authenticated idempotent retry.
 */
export async function quarantineAccountDeletionSession(
  dependencies: AccountDeletionQuarantineDependencies = defaultQuarantineDependencies,
  options: Pick<AccountDeletionCleanupOptions, 'clearIsolatedState'> = {
    clearIsolatedState: true,
  },
): Promise<void> {
  let firstFailure: unknown = null;
  if (options.clearIsolatedState) {
    try {
      await dependencies.clearIsolatedState();
    } catch (error) {
      firstFailure = error;
    }
  }
  try {
    await dependencies.clearAuthDerivedActivity();
  } catch (error) {
    firstFailure ??= error;
  }
  if (firstFailure) throw firstFailure;
}

/** Clear both Supabase in-memory/persisted auth and every account-local surface. */
export async function completeAccountDeletionLocalSignOut(
  dependencies: AccountDeletionSessionDependencies = defaultSessionDependencies,
  options: AccountDeletionCleanupOptions = {
    clearSession: true,
    clearIsolatedState: true,
    quarantineUnclaimedLocalData: false,
    retainLocalDataOwner: false,
  },
): Promise<void> {
  const mustPreserveBeforeSignOut =
    options.retainLocalDataOwner || options.quarantineUnclaimedLocalData;
  if (
    (options.retainLocalDataOwner && options.quarantineUnclaimedLocalData) ||
    (mustPreserveBeforeSignOut && (!options.clearSession || options.clearIsolatedState))
  ) {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_COMPLETION_INVALID');
  }
  let firstFailure: unknown = null;
  let preservationCommitted = !mustPreserveBeforeSignOut;
  if (options.retainLocalDataOwner) {
    try {
      await dependencies.retainLocalDataOwner();
      preservationCommitted = true;
    } catch (error) {
      firstFailure = error;
    }
  } else if (options.quarantineUnclaimedLocalData) {
    try {
      await dependencies.quarantineUnclaimedLocalData();
      preservationCommitted = true;
    } catch (error) {
      firstFailure = error;
    }
  }
  if (options.clearSession && preservationCommitted) {
    try {
      await dependencies.clearSession();
    } catch (error) {
      firstFailure = error;
    }
  }
  if (options.clearIsolatedState) {
    try {
      await dependencies.clearIsolatedState();
    } catch (error) {
      firstFailure ??= error;
    }
  }
  try {
    await dependencies.clearAuthDerivedActivity();
  } catch (error) {
    firstFailure ??= error;
  }
  if (firstFailure) throw firstFailure;
}

/** Persist capability proof before the retained retry session is destroyed. */
export async function acceptAccountDeletionAndSignOut(
  record: AccountDeletionClientRecord,
  dependencies: AcceptedAccountDeletionDependencies = defaultAcceptedDependencies,
  options: AccountDeletionCleanupOptions = {
    clearSession: true,
    clearIsolatedState: true,
    quarantineUnclaimedLocalData: false,
    retainLocalDataOwner: false,
  },
): Promise<void> {
  if (record.version !== 2) {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_COMPLETION_INVALID');
  }
  await dependencies.markAccepted(record.ownerBinding);
  await completeAccountDeletionLocalSignOut(dependencies, options);
}

/**
 * Terminal completion has already been committed in SecureStore. Finish the
 * account boundary, queue any required Apple instruction, and only then erase
 * the capability. Any failure keeps the durable completed record retryable.
 */
export async function finalizeCompletedAccountDeletion(
  record: AccountDeletionClientRecord,
  dependencies: AccountDeletionFinalizationDependencies = defaultFinalizationDependencies,
  options: AccountDeletionCleanupOptions = {
    clearSession: true,
    clearIsolatedState: true,
    quarantineUnclaimedLocalData: false,
    retainLocalDataOwner: false,
  },
): Promise<'cleared' | 'manual_notice_pending'> {
  if (record.state !== 'completed') {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_COMPLETION_INVALID');
  }

  if (record.version !== 2 || !STATUS_CAPABILITY_PATTERN.test(record.ownerBinding)) {
    throw accountDeletionRecoveryError('ACCOUNT_DELETION_COMPLETION_INVALID');
  }
  // The server has terminally deleted this subject. Remove the final local
  // owner correlation before any later cleanup failure can leave it retained.
  // The ownerless tombstone remains a device-only purchase safety bit.
  await dependencies.convertStoreSafetyNotice(record.ownerBinding);
  await completeAccountDeletionLocalSignOut(dependencies, options);
  if (record.notice === 'remove_apple_authorization') {
    dependencies.queueAppleNotice();
    // The completed record remains the durable notice authority until the
    // recovery screen is visibly acknowledged by the user.
    return 'manual_notice_pending';
  }
  await dependencies.clearCompletedState();
  return 'cleared';
}
