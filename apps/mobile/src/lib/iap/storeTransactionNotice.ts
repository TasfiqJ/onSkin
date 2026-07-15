import AsyncStorage from '@react-native-async-storage/async-storage';

import { env, type AppEnvironment } from '@/lib/env';
import { localDataOwnerBinding } from '@/lib/auth/sessionOwner';

import {
  isRevenueCatCancellationAmbiguous,
  isRevenueCatPaymentPendingError,
  revenueCatUnconfirmedStoreMessage,
} from './revenuecat';

export const STORE_TRANSACTION_NOTICE_STORAGE_KEY = 'routinekind.store_transaction_notice.v2';
export const STORE_TRANSACTION_PURCHASE_BLOCKED = 'STORE_TRANSACTION_PURCHASE_BLOCKED';
export const STORE_TRANSACTION_OPERATION_IN_PROGRESS = 'STORE_TRANSACTION_OPERATION_IN_PROGRESS';
export const STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE =
  'STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE';
export const STORE_TRANSACTION_AUTH_REQUIRED = 'STORE_TRANSACTION_AUTH_REQUIRED';
export const STORE_TRANSACTION_COMPLETION_UNCONFIRMED = 'STORE_TRANSACTION_COMPLETION_UNCONFIRMED';

export const STORE_TRANSACTION_NOTICE_REVIEW_DAYS = 30;
const SCHEMA_VERSION = 2 as const;
const OWNER_BINDING_PATTERN = /^[a-f0-9]{64}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const REVIEW_WINDOW_MS = STORE_TRANSACTION_NOTICE_REVIEW_DAYS * 24 * 60 * 60 * 1_000;

export type StoreTransactionAction = 'purchase' | 'restore';
export type StoreTransactionNoticeReason = 'completion_unconfirmed' | 'payment_pending';

export type StoreTransactionNativeCall = Readonly<{
  /** Commit the write-ahead record immediately before the provider call. */
  beforeNativeStoreCall: () => Promise<void>;
  /** Mark the no-await handoff from the second authority check into the SDK. */
  markNativeCallStarted: () => void;
  /** Record RevenueCat's documented no-charge user cancellation. */
  markDefinitiveCancellation: () => void;
  /** Record that CustomerInfo and every required local write have committed. */
  markProviderResultPersisted: (hasActiveEntitlement: boolean) => void;
}>;

type StoredNotice = Readonly<{
  createdAt: string;
  expiresAt: string | null;
  ownerBinding: string;
  reason: StoreTransactionNoticeReason | null;
  status: 'in_flight' | 'unconfirmed';
}>;

type DeletedOwnerSafetyTombstone = Readonly<{
  createdAt: string;
  expiresAt: string;
  kind: 'deleted_owner_store_safety';
}>;

type StoredEnvelope = Readonly<{
  deletedOwnerSafety: DeletedOwnerSafetyTombstone | null;
  notices: readonly StoredNotice[];
  version: typeof SCHEMA_VERSION;
}>;

export type StoreTransactionNoticeView =
  | Readonly<{
      kind: 'owner_pending';
      reason: StoreTransactionNoticeReason;
    }>
  | Readonly<{
      kind: 'another_account_pending';
    }>
  | Readonly<{
      kind: 'deleted_account_pending';
    }>;

type NoticeEvent = Readonly<{
  attention: boolean;
}>;

type NoticeListener = (event: NoticeEvent) => void;

export class StoreTransactionSafetyError extends Error {
  constructor(
    public readonly code:
      | typeof STORE_TRANSACTION_PURCHASE_BLOCKED
      | typeof STORE_TRANSACTION_OPERATION_IN_PROGRESS
      | typeof STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE
      | typeof STORE_TRANSACTION_AUTH_REQUIRED
      | typeof STORE_TRANSACTION_COMPLETION_UNCONFIRMED,
  ) {
    super(code);
    this.name = 'StoreTransactionSafetyError';
  }
}

const listeners = new Set<NoticeListener>();
const emergencyNotices = new Map<string, StoredNotice>();
let storageTail = Promise.resolve();
let activeOperation: Promise<unknown> | null = null;

function safetyError(code: StoreTransactionSafetyError['code']): StoreTransactionSafetyError {
  return new StoreTransactionSafetyError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function parseNotice(value: unknown): StoredNotice {
  if (!isRecord(value)) throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  if (!hasExactKeys(value, ['createdAt', 'expiresAt', 'ownerBinding', 'reason', 'status'])) {
    throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  }
  if (
    typeof value.ownerBinding !== 'string' ||
    !OWNER_BINDING_PATTERN.test(value.ownerBinding) ||
    (value.status !== 'in_flight' && value.status !== 'unconfirmed') ||
    (value.reason !== null &&
      value.reason !== 'completion_unconfirmed' &&
      value.reason !== 'payment_pending') ||
    !isTimestamp(value.createdAt) ||
    (value.expiresAt !== null && !isTimestamp(value.expiresAt)) ||
    (value.status === 'in_flight' && (value.reason !== null || value.expiresAt !== null)) ||
    (value.status === 'unconfirmed' && value.reason === null) ||
    (value.reason === 'payment_pending' &&
      (value.expiresAt === null ||
        Date.parse(value.expiresAt) - Date.parse(value.createdAt) !== REVIEW_WINDOW_MS)) ||
    (value.reason !== 'payment_pending' && value.expiresAt !== null)
  ) {
    throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  }
  return {
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    ownerBinding: value.ownerBinding,
    reason: value.reason,
    status: value.status,
  };
}

function parseDeletedOwnerSafety(value: unknown): DeletedOwnerSafetyTombstone | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['createdAt', 'expiresAt', 'kind']) ||
    value.kind !== 'deleted_owner_store_safety' ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.expiresAt) ||
    Date.parse(value.expiresAt) - Date.parse(value.createdAt) !== REVIEW_WINDOW_MS
  ) {
    throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  }
  return {
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    kind: 'deleted_owner_store_safety',
  };
}

function emptyEnvelope(): StoredEnvelope {
  return { deletedOwnerSafety: null, notices: [], version: SCHEMA_VERSION };
}

function parseEnvelope(raw: string | null): StoredEnvelope {
  if (raw === null) return emptyEnvelope();
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  }
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['deletedOwnerSafety', 'notices', 'version']) ||
    value.version !== SCHEMA_VERSION ||
    !Array.isArray(value.notices)
  ) {
    throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  }
  const notices = value.notices.map(parseNotice);
  if (new Set(notices.map((notice) => notice.ownerBinding)).size !== notices.length) {
    throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  }
  return {
    deletedOwnerSafety: parseDeletedOwnerSafety(value.deletedOwnerSafety),
    notices,
    version: SCHEMA_VERSION,
  };
}

function serializeStorage<T>(operation: () => Promise<T>): Promise<T> {
  const completion = storageTail.then(operation, operation);
  storageTail = completion.then(
    () => undefined,
    () => undefined,
  );
  return completion;
}

async function readPersistedEnvelope(): Promise<StoredEnvelope> {
  try {
    return parseEnvelope(await AsyncStorage.getItem(STORE_TRANSACTION_NOTICE_STORAGE_KEY));
  } catch (error) {
    if (error instanceof StoreTransactionSafetyError) throw error;
    throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  }
}

async function writeEnvelope(envelope: StoredEnvelope): Promise<void> {
  try {
    const serialized = JSON.stringify(envelope);
    await AsyncStorage.setItem(STORE_TRANSACTION_NOTICE_STORAGE_KEY, serialized);
    const readBack = await AsyncStorage.getItem(STORE_TRANSACTION_NOTICE_STORAGE_KEY);
    if (readBack !== serialized) {
      throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
    }
    parseEnvelope(readBack);
  } catch {
    throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  }
}

function emit(attention: boolean): void {
  for (const listener of listeners) listener({ attention });
}

function nowIso(): string {
  return new Date().toISOString();
}

function withNotices(envelope: StoredEnvelope, notices: readonly StoredNotice[]): StoredEnvelope {
  return { ...envelope, notices };
}

/**
 * Emergency memory exists only when a native operation may have completed but
 * the durable promotion failed. Every subsequent storage access must commit
 * those records first; merely displaying memory may never reopen checkout.
 */
async function reconcileEmergencyNotices(): Promise<StoredEnvelope> {
  const persisted = await readPersistedEnvelope();
  if (emergencyNotices.size === 0) return persisted;
  const byOwner = new Map(
    persisted.notices.map((notice) => [notice.ownerBinding, notice] as const),
  );
  for (const notice of emergencyNotices.values()) byOwner.set(notice.ownerBinding, notice);
  const reconciled = withNotices(persisted, [...byOwner.values()]);
  await writeEnvelope(reconciled);
  for (const ownerBinding of emergencyNotices.keys()) emergencyNotices.delete(ownerBinding);
  return reconciled;
}

function replaceOwnerNotice(envelope: StoredEnvelope, notice: StoredNotice): StoredEnvelope {
  return withNotices(envelope, [
    ...envelope.notices.filter((candidate) => candidate.ownerBinding !== notice.ownerBinding),
    notice,
  ]);
}

type WriteAheadReceipt = Readonly<{
  deletedOwnerSafetyPresent: boolean;
  journalCreatedAt: string;
  previousNotice: StoredNotice | null;
}>;

async function beginWriteAhead(ownerBinding: string): Promise<WriteAheadReceipt> {
  return serializeStorage(async () => {
    const envelope = await reconcileEmergencyNotices();
    const existing = envelope.notices.find((notice) => notice.ownerBinding === ownerBinding);
    const journalCreatedAt = existing?.createdAt ?? nowIso();
    // An unresolved prior record is already a stronger write-ahead journal.
    // Keep it byte-for-byte so process death during Restore cannot erase a
    // PAYMENT_PENDING reason/review marker that only the killed process remembered.
    await writeEnvelope(
      existing
        ? envelope
        : replaceOwnerNotice(envelope, {
            createdAt: journalCreatedAt,
            expiresAt: null,
            ownerBinding,
            reason: null,
            status: 'in_flight',
          }),
    );
    return {
      deletedOwnerSafetyPresent: envelope.deletedOwnerSafety !== null,
      journalCreatedAt,
      previousNotice: existing ?? null,
    };
  });
}

async function compensateUnstartedWriteAhead(
  ownerBinding: string,
  previousNotice: StoredNotice | null,
): Promise<void> {
  await serializeStorage(async () => {
    const envelope = await reconcileEmergencyNotices();
    const restored = previousNotice
      ? replaceOwnerNotice(envelope, previousNotice)
      : withNotices(
          envelope,
          envelope.notices.filter((notice) => notice.ownerBinding !== ownerBinding),
        );
    await writeEnvelope(restored);
    emergencyNotices.delete(ownerBinding);
  });
  emit(false);
}

async function promoteUnconfirmed(
  ownerBinding: string,
  reason: StoreTransactionNoticeReason = 'completion_unconfirmed',
  createdAt: string = nowIso(),
): Promise<void> {
  const fallback: StoredNotice = {
    createdAt,
    expiresAt:
      reason === 'payment_pending'
        ? new Date(Date.parse(createdAt) + REVIEW_WINDOW_MS).toISOString()
        : null,
    ownerBinding,
    reason,
    status: 'unconfirmed',
  };
  emergencyNotices.set(ownerBinding, fallback);
  emit(true);
  await serializeStorage(async () => {
    const envelope = await reconcileEmergencyNotices();
    await writeEnvelope(replaceOwnerNotice(envelope, fallback));
    emergencyNotices.delete(ownerBinding);
  });
  emit(true);
}

async function promoteAbandonedInFlight(envelope: StoredEnvelope): Promise<StoredEnvelope> {
  if (!envelope.notices.some((notice) => notice.status === 'in_flight')) return envelope;
  const promoted = withNotices(
    envelope,
    envelope.notices.map((notice) =>
      notice.status === 'in_flight'
        ? {
            ...notice,
            reason: 'completion_unconfirmed' as const,
            status: 'unconfirmed' as const,
          }
        : notice,
    ),
  );
  await writeEnvelope(promoted);
  return promoted;
}

async function resolveAfterVerifiedRestore(
  ownerBinding: string,
  receipt: WriteAheadReceipt,
  hasActiveEntitlement: boolean,
): Promise<void> {
  await serializeStorage(async () => {
    const envelope = await reconcileEmergencyNotices();
    const mustRetainPriorPending =
      !hasActiveEntitlement && receipt.previousNotice?.reason === 'payment_pending';
    const notices = mustRetainPriorPending
      ? replaceOwnerNotice(envelope, receipt.previousNotice!).notices
      : envelope.notices.filter((notice) => notice.ownerBinding !== ownerBinding);
    await writeEnvelope({
      ...envelope,
      deletedOwnerSafety: hasActiveEntitlement ? null : envelope.deletedOwnerSafety,
      notices,
    });
    emergencyNotices.delete(ownerBinding);
  });
  emit(
    !hasActiveEntitlement &&
      (receipt.deletedOwnerSafetyPresent || receipt.previousNotice?.reason === 'payment_pending'),
  );
}

async function resolveAfterVerifiedPurchase(ownerBinding: string): Promise<void> {
  await serializeStorage(async () => {
    const envelope = await reconcileEmergencyNotices();
    const notices = envelope.notices.filter((notice) => notice.ownerBinding !== ownerBinding);
    await writeEnvelope(withNotices(envelope, notices));
    emergencyNotices.delete(ownerBinding);
  });
  emit(false);
}

async function assertPurchaseAllowed(): Promise<void> {
  let blocked = false;
  try {
    blocked = await serializeStorage(async () => {
      const envelope = await reconcileEmergencyNotices();
      return envelope.deletedOwnerSafety !== null || envelope.notices.length > 0;
    });
  } catch (error) {
    emit(true);
    throw error;
  }
  if (blocked) {
    emit(true);
    throw safetyError(STORE_TRANSACTION_PURCHASE_BLOCKED);
  }
}

export function isStoreTransactionSafetyError(
  error: unknown,
  code?: StoreTransactionSafetyError['code'],
): error is StoreTransactionSafetyError {
  return (
    error instanceof StoreTransactionSafetyError && (code === undefined || error.code === code)
  );
}

/**
 * One owner-aware admission point for every native purchase and restore.
 * The raw Auth subject exists only long enough to derive the canonical local
 * owner binding. Storage and events contain no Auth or provider identifier.
 */
export async function runOwnedStoreTransaction<T>(input: {
  action: StoreTransactionAction;
  ownerUserId: string | null | undefined;
  operation: (nativeCall: StoreTransactionNativeCall) => Promise<T>;
}): Promise<T> {
  if (!input.ownerUserId) throw safetyError(STORE_TRANSACTION_AUTH_REQUIRED);
  const ownerBinding = await localDataOwnerBinding(input.ownerUserId);
  if (activeOperation) throw safetyError(STORE_TRANSACTION_OPERATION_IN_PROGRESS);

  const completion = (async () => {
    if (input.action === 'purchase') await assertPurchaseAllowed();
    let journalCommitted = false;
    let nativeCallStarted = false;
    let receipt: WriteAheadReceipt | null = null;
    const operationState: {
      resolution: 'unresolved' | 'cancelled' | 'verified_active' | 'verified_empty';
    } = { resolution: 'unresolved' };
    const setResolution = (next: 'cancelled' | 'verified_active' | 'verified_empty'): void => {
      if (!nativeCallStarted || operationState.resolution !== 'unresolved') {
        throw safetyError(STORE_TRANSACTION_OPERATION_IN_PROGRESS);
      }
      operationState.resolution = next;
    };
    const nativeCall: StoreTransactionNativeCall = Object.freeze({
      beforeNativeStoreCall: async () => {
        if (journalCommitted || nativeCallStarted) {
          throw safetyError(STORE_TRANSACTION_OPERATION_IN_PROGRESS);
        }
        receipt = await beginWriteAhead(ownerBinding);
        journalCommitted = true;
      },
      markNativeCallStarted: () => {
        if (!journalCommitted || nativeCallStarted) {
          throw safetyError(STORE_TRANSACTION_OPERATION_IN_PROGRESS);
        }
        nativeCallStarted = true;
      },
      markDefinitiveCancellation: () => setResolution('cancelled'),
      markProviderResultPersisted: (hasActiveEntitlement) =>
        setResolution(hasActiveEntitlement ? 'verified_active' : 'verified_empty'),
    });
    try {
      const result = await input.operation(nativeCall);
      if (journalCommitted && !nativeCallStarted) {
        await compensateUnstartedWriteAhead(ownerBinding, receipt!.previousNotice);
      } else if (nativeCallStarted && operationState.resolution === 'cancelled') {
        await resolveAfterVerifiedPurchase(ownerBinding);
      } else if (nativeCallStarted && operationState.resolution === 'verified_active') {
        if (input.action === 'restore') {
          await resolveAfterVerifiedRestore(ownerBinding, receipt!, true);
        } else {
          await resolveAfterVerifiedPurchase(ownerBinding);
        }
      } else if (
        nativeCallStarted &&
        operationState.resolution === 'verified_empty' &&
        input.action === 'restore'
      ) {
        await resolveAfterVerifiedRestore(ownerBinding, receipt!, false);
      } else if (nativeCallStarted) {
        if (receipt!.previousNotice) {
          await compensateUnstartedWriteAhead(ownerBinding, receipt!.previousNotice);
          emit(true);
        } else {
          await promoteUnconfirmed(
            ownerBinding,
            'completion_unconfirmed',
            receipt!.journalCreatedAt,
          );
        }
        throw safetyError(STORE_TRANSACTION_COMPLETION_UNCONFIRMED);
      }
      return result;
    } catch (error) {
      if (journalCommitted && !nativeCallStarted) {
        try {
          await compensateUnstartedWriteAhead(ownerBinding, receipt!.previousNotice);
        } catch {
          // A committed write-ahead record is the safe fallback if live
          // compensation cannot be persisted.
          emit(true);
          throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
        }
      } else if (
        nativeCallStarted &&
        !isStoreTransactionSafetyError(error, STORE_TRANSACTION_COMPLETION_UNCONFIRMED)
      ) {
        try {
          const nextReason = isRevenueCatPaymentPendingError(error)
            ? 'payment_pending'
            : 'completion_unconfirmed';
          const previous = receipt!.previousNotice;
          if (
            previous &&
            (previous.reason === 'payment_pending' || nextReason === 'completion_unconfirmed')
          ) {
            await compensateUnstartedWriteAhead(ownerBinding, previous);
            emit(true);
          } else {
            await promoteUnconfirmed(ownerBinding, nextReason, receipt!.journalCreatedAt);
          }
        } catch {
          // Keep the in-memory fail-closed notice and surface the storage fault.
          throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
        }
      }
      throw error;
    }
  })();
  activeOperation = completion;
  try {
    return await completion;
  } finally {
    if (activeOperation === completion) activeOperation = null;
  }
}

/** Read only the current owner's detail; foreign records collapse to one bit. */
export async function readStoreTransactionNotice(
  ownerUserId: string,
): Promise<StoreTransactionNoticeView | null> {
  const ownerBinding = await localDataOwnerBinding(ownerUserId);
  return serializeStorage(async () => {
    const reconciled = await reconcileEmergencyNotices();
    const envelope = await promoteAbandonedInFlight(reconciled);
    const own = envelope.notices.find((notice) => notice.ownerBinding === ownerBinding);
    if (own) {
      return {
        kind: 'owner_pending',
        reason: own.reason ?? 'completion_unconfirmed',
      };
    }
    if (envelope.deletedOwnerSafety) return { kind: 'deleted_account_pending' };
    return envelope.notices.length > 0 ? { kind: 'another_account_pending' } : null;
  });
}

/**
 * Pre-intake integrity gate for account deletion. A valid unresolved record is
 * deliberately allowed: Apple deletion cannot wait indefinitely for commerce
 * recovery, and terminal finalization converts it to an ownerless tombstone.
 */
export async function assertStoreTransactionDeletionJournalReadable(
  ownerBinding: string,
): Promise<void> {
  if (!OWNER_BINDING_PATTERN.test(ownerBinding)) {
    throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  }
  await serializeStorage(async () => {
    await reconcileEmergencyNotices();
  });
}

/**
 * Server-verified terminal deletion removes the last owner correlation without
 * blocking deletion itself. The replacement is one device-only safety bit with
 * a fresh conversion timestamp and a counsel-reviewable 30-day review marker.
 * Mutable device time never clears the bit or reopens Store admission.
 */
export async function convertStoreTransactionNoticeForTerminalDeletion(
  ownerBinding: string,
): Promise<void> {
  if (!OWNER_BINDING_PATTERN.test(ownerBinding)) {
    throw safetyError(STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE);
  }
  await serializeStorage(async () => {
    const envelope = await reconcileEmergencyNotices();
    const matching = envelope.notices.some((notice) => notice.ownerBinding === ownerBinding);
    if (!matching) return;
    const createdAt = nowIso();
    const deletedOwnerSafety: DeletedOwnerSafetyTombstone = {
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + REVIEW_WINDOW_MS).toISOString(),
      kind: 'deleted_owner_store_safety',
    };
    await writeEnvelope({
      ...envelope,
      deletedOwnerSafety,
      notices: envelope.notices.filter((notice) => notice.ownerBinding !== ownerBinding),
    });
    emergencyNotices.delete(ownerBinding);
  });
  emit(true);
}

export function subscribeToStoreTransactionNotice(listener: NoticeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function storeTransactionRecoveryMessage(
  error: unknown,
  action: StoreTransactionAction,
): string | null {
  const unconfirmed = revenueCatUnconfirmedStoreMessage(error, action);
  if (unconfirmed) return unconfirmed;
  if (isRevenueCatPaymentPendingError(error)) {
    return 'The store says this purchase is waiting for approval or another required step. Follow the store instructions and do not buy again. The status may update later; use Restore purchases to check again.';
  }
  if (isRevenueCatCancellationAmbiguous(error)) {
    return 'The store reported a cancellation or an item that may already be owned. Do not buy again yet. Use Restore purchases to safely check the account.';
  }
  if (isStoreTransactionSafetyError(error, STORE_TRANSACTION_COMPLETION_UNCONFIRMED)) {
    return 'The store completed a response, but active access could not be safely confirmed. Do not buy again. Use Restore purchases to check the status.';
  }
  if (isStoreTransactionSafetyError(error, STORE_TRANSACTION_PURCHASE_BLOCKED)) {
    return 'A store transaction on this device still needs confirmation. Do not buy again. Sign in to the account used at checkout and use Restore purchases first.';
  }
  if (isStoreTransactionSafetyError(error, STORE_TRANSACTION_OPERATION_IN_PROGRESS)) {
    return 'A store status check is already in progress. Wait for it to finish before trying again.';
  }
  if (isStoreTransactionSafetyError(error, STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE)) {
    return 'We could not safely save or read the store transaction status. Do not buy again. Keep the app open and try Restore purchases again.';
  }
  if (isStoreTransactionSafetyError(error, STORE_TRANSACTION_AUTH_REQUIRED)) {
    return 'Sign in before checking or changing purchases for this account.';
  }
  return null;
}

export function shouldSeedStoreTransactionNoticeE2E(
  input: {
    appEnvironment?: AppEnvironment;
    fixture?: string;
    isDev?: boolean;
  } = {},
): boolean {
  const isDev = input.isDev ?? (typeof __DEV__ !== 'undefined' && __DEV__);
  const appEnvironment = input.appEnvironment ?? env.appEnvironment;
  const fixture = input.fixture ?? process.env.EXPO_PUBLIC_E2E_STORE_TRANSACTION_NOTICE;
  const normalizedFixture = fixture?.trim().toLowerCase();
  return (
    isDev &&
    appEnvironment === 'development' &&
    (normalizedFixture === 'purchase_unconfirmed' ||
      normalizedFixture === 'payment_pending' ||
      normalizedFixture === 'deleted_account_pending' ||
      normalizedFixture === 'foreign_pending')
  );
}

/** Development-only UI fixture. It writes the same redacted record as the real catcher. */
export async function seedStoreTransactionNoticeE2E(ownerUserId: string): Promise<void> {
  if (!shouldSeedStoreTransactionNoticeE2E()) return;
  const fixture = process.env.EXPO_PUBLIC_E2E_STORE_TRANSACTION_NOTICE?.trim().toLowerCase();
  const ownerBinding = await localDataOwnerBinding(ownerUserId);
  if (fixture === 'payment_pending') {
    await promoteUnconfirmed(ownerBinding, 'payment_pending');
    return;
  }
  if (fixture === 'deleted_account_pending') {
    await promoteUnconfirmed(ownerBinding);
    await convertStoreTransactionNoticeForTerminalDeletion(ownerBinding);
    return;
  }
  if (fixture === 'foreign_pending') {
    await promoteUnconfirmed('0'.repeat(64));
    return;
  }
  await promoteUnconfirmed(ownerBinding);
}
