import {
  getPrivateItem,
  removePrivateItem,
  setPrivateItem,
  updatePrivateItem,
} from '@/lib/storage/privateKV';
import { randomUUID } from 'expo-crypto';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  canonicalCompletionSyncInstant,
  canonicalCompletionSyncStepOrder,
  canonicalCompletionSyncTimezone,
  canonicalCompletionSyncUuid,
  completionSyncDateInTimezone,
  completionSyncStepIdentity,
  COMPLETION_DEPENDENCY_TERMINAL,
  createUniqueCompletionSyncUuid,
  decodeCompletionSyncState,
  emptyCompletionSyncState,
  remoteTerminalCompletionSyncCode,
  type CompletionSyncOperation,
  type CompletionSyncRemoteTerminalCode,
  type CompletionSyncRoutineType,
  type CompletionSyncState,
  type CompletionSyncUnavailableReason,
  type CompletionSyncUnsynced,
} from './completionSync';
import { localDateString } from './useToday';

// Local-first daily check-off log (docs/03 §6: the activation + streak loop, and
// the research verdict's #1 lever, "make the daily loop the engine"). This is the
// v1 SOURCE OF TRUTH, following the D-029 local-first pattern shared with the shelf
// / photos / cycle stores. Schema v3 writes the visible completion, stable
// pseudonymous server identities, original timestamp, and replay operation in
// one encrypted transform; the network worker can never create a crash gap.
// A step completion is a (stepKey, localDate) pair. Adherence is deliberately
// stricter: a date counts only after every step in that day's projected PM/recovery
// routine is durable. Replaces the old local-useState check-off in today.tsx that
// never persisted (it broke activation + every streak surface).
const KEY = 'layerwell.completions.v1';
const FIRST_COMPLETION_KEY = 'layerwell.completions.firstCompletion.v1';
const SCHEMA_VERSION = 3 as const;

export const COMPLETION_LOG_INVALID = 'COMPLETION_LOG_INVALID';
export const COMPLETION_LOG_UNSUPPORTED_VERSION = 'COMPLETION_LOG_UNSUPPORTED_VERSION';

type Log = Record<string, string[]>; // localDate -> stepKeys done that day
type CompletionState = {
  days: Log;
  /** Explicit proof that every projected PM/recovery step was completed that day. */
  completedDays: Set<string>;
  /** Stable pseudonymous identities plus the append-only sync journal/outbox. */
  sync: CompletionSyncState;
};
type CompletionLogEnvelope = {
  version: typeof SCHEMA_VERSION;
  days: Log;
  completedDays: string[];
  sync: CompletionSyncState;
};

export type ToggleCompletionResult = {
  done: boolean;
  inserted: boolean;
  firstEver: boolean;
  /** True only for the mutation that first proves the full PM/recovery routine. */
  completionDayInserted: boolean;
  /** Exact day snapshot produced by the same serialized mutation as `inserted`. */
  completedStepKeysAfter: ReadonlySet<string>;
};

export type ScheduledCompletionContext = Readonly<{
  phase: 'PM';
  stepKeys: readonly string[];
}>;

export type CompletionRemoteSyncContext = Readonly<{
  source: 'real_plan';
  timezone: string | null;
  stepOrder: number;
  unavailableReason?: CompletionSyncUnavailableReason;
}>;

export type CompletionSyncOutboxListener = () => void;

const completionSyncOutboxListeners = new Set<CompletionSyncOutboxListener>();

function notifyCompletionSyncOutboxChanged(): void {
  for (const listener of completionSyncOutboxListeners) {
    try {
      listener();
    } catch {
      // Storage has already committed. One observer must never prevent other
      // observers from waking or relabel the user's durable check-off as failed.
    }
  }
}

export function subscribeCompletionSyncOutboxChanges(
  listener: CompletionSyncOutboxListener,
): () => void {
  completionSyncOutboxListeners.add(listener);
  return () => completionSyncOutboxListeners.delete(listener);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function completionLogError(code: string): Error {
  return new Error(code);
}

function normalizeLocalDateISO(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? text
    : null;
}

function normalizeStepKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = /^(AM|PM):(.+)$/.exec(text);
  if (!match) return null;
  const productId = match[2]!.trim();
  return productId.length > 0 ? `${match[1]}:${productId}` : null;
}

function shiftLocalDateISO(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return localDateString(new Date(year, month - 1, day + days));
}

function normalizeCompletionLog(value: unknown, strictCurrentSchema = false): Log {
  if (!isRecord(value)) throw completionLogError(COMPLETION_LOG_INVALID);
  const out: Log = {};
  for (const [date, keys] of Object.entries(value)) {
    const normalizedDate = normalizeLocalDateISO(date);
    if (!normalizedDate || !Array.isArray(keys)) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    if (strictCurrentSchema && normalizedDate !== date) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    const normalizedKeys: string[] = [];
    for (const key of keys) {
      const normalizedKey = normalizeStepKey(key);
      if (!normalizedKey) throw completionLogError(COMPLETION_LOG_INVALID);
      if (
        strictCurrentSchema &&
        (normalizedKey !== key || normalizedKeys.includes(normalizedKey))
      ) {
        throw completionLogError(COMPLETION_LOG_INVALID);
      }
      if (!normalizedKeys.includes(normalizedKey)) normalizedKeys.push(normalizedKey);
    }
    if (strictCurrentSchema && normalizedKeys.length === 0) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    if (normalizedKeys.length > 0) {
      out[normalizedDate] = [...new Set([...(out[normalizedDate] ?? []), ...normalizedKeys])];
    }
  }
  return out;
}

function normalizeCompletedDays(value: unknown, days: Log): Set<string> {
  if (!Array.isArray(value)) throw completionLogError(COMPLETION_LOG_INVALID);
  const out = new Set<string>();
  for (const entry of value) {
    const normalizedDate = normalizeLocalDateISO(entry);
    if (
      !normalizedDate ||
      normalizedDate !== entry ||
      out.has(normalizedDate) ||
      !days[normalizedDate]?.some((key) => key.startsWith('PM:'))
    ) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    out.add(normalizedDate);
  }
  return out;
}

function decodeCompletionLog(raw: string | null): CompletionState {
  if (raw === null) {
    return { days: {}, completedDays: new Set(), sync: emptyCompletionSyncState() };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  if (!isRecord(parsed)) throw completionLogError(COMPLETION_LOG_INVALID);

  if (!hasOwn(parsed, 'version')) {
    return {
      days: normalizeCompletionLog(parsed),
      completedDays: new Set(),
      sync: emptyCompletionSyncState(),
    };
  }
  if (parsed.version === 1) {
    if (Object.keys(parsed).length !== 2 || !hasOwn(parsed, 'days') || !isRecord(parsed.days)) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    return {
      days: normalizeCompletionLog(parsed.days, true),
      // A v1 row proves step taps, not that the then-scheduled PM routine was complete.
      completedDays: new Set(),
      sync: emptyCompletionSyncState(),
    };
  }
  if (parsed.version === 2) {
    if (
      Object.keys(parsed).length !== 3 ||
      !hasOwn(parsed, 'days') ||
      !hasOwn(parsed, 'completedDays') ||
      !isRecord(parsed.days)
    ) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    const days = normalizeCompletionLog(parsed.days, true);
    return {
      days,
      completedDays: normalizeCompletedDays(parsed.completedDays, days),
      // Historical v2 rows have neither an original timestamp nor durable
      // server identity. Never invent remote operations for them.
      sync: emptyCompletionSyncState(),
    };
  }
  if (parsed.version !== SCHEMA_VERSION) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw completionLogError(COMPLETION_LOG_UNSUPPORTED_VERSION);
    }
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  if (
    Object.keys(parsed).length !== 4 ||
    !hasOwn(parsed, 'days') ||
    !hasOwn(parsed, 'completedDays') ||
    !hasOwn(parsed, 'sync') ||
    !isRecord(parsed.days)
  ) {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  const days = normalizeCompletionLog(parsed.days, true);
  const completedDays = normalizeCompletedDays(parsed.completedDays, days);
  try {
    const sync = decodeCompletionSyncState(parsed.sync, {
      hasCompletedStep: (completedDate, step) => days[completedDate]?.includes(step) === true,
      hasCompletedDay: (completedDate) => completedDays.has(completedDate),
    });
    return { days, completedDays, sync };
  } catch {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
}

function encodeCompletionLog(state: CompletionState): string {
  const encoded = JSON.stringify({
    version: SCHEMA_VERSION,
    days: state.days,
    completedDays: [...state.completedDays].sort(),
    sync: state.sync,
  } satisfies CompletionLogEnvelope);
  // The atomic updater must never commit bytes that a fresh v3 read rejects.
  // In particular, legacy product keys admitted to the unsynced lane have
  // stricter bounds than the historical visible step log.
  decodeCompletionLog(encoded);
  return encoded;
}

/** Stable per-step key. Phase-scoped so an AM and a PM step for the same product
 *  never collide. */
export function stepKey(phase: 'AM' | 'PM', productId: string): string {
  const normalized = normalizeStepKey(`${phase}:${productId}`);
  if (!normalized) throw completionLogError(COMPLETION_LOG_INVALID);
  return normalized;
}

function completionSyncUsedIds(sync: CompletionSyncState): Set<string> {
  return new Set([
    ...Object.values(sync.routineIds).flatMap((id) => (id === null ? [] : [id])),
    ...Object.values(sync.stepIds).map(({ id }) => id),
    ...sync.journal.map(({ eventId }) => eventId),
    ...sync.unsynced.map(({ eventId }) => eventId),
  ]);
}

function nextCompletionSyncUuid(sync: CompletionSyncState): string {
  return createUniqueCompletionSyncUuid(
    () => randomUUID().toLowerCase(),
    completionSyncUsedIds(sync),
  );
}

function ensureCompletionSyncRoutineId(
  sync: CompletionSyncState,
  routineType: CompletionSyncRoutineType,
): string {
  const existing = sync.routineIds[routineType];
  if (existing !== null) return existing;
  const routineId = nextCompletionSyncUuid(sync);
  sync.routineIds[routineType] = routineId;
  return routineId;
}

function appendCompletionSyncOperation(
  sync: CompletionSyncState,
  operation: Omit<CompletionSyncOperation, 'eventId'>,
  requestedEventId?: string,
): string {
  const eventId =
    requestedEventId === undefined
      ? nextCompletionSyncUuid(sync)
      : canonicalCompletionSyncUuid(requestedEventId);
  if (eventId === null || completionSyncUsedIds(sync).has(eventId)) {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  sync.journal.push({ eventId, ...operation });
  sync.outbox.push(eventId);
  return eventId;
}

function blockRoutineDayForTerminalStep(
  sync: CompletionSyncState,
  stepEventId: string,
  step: CompletionSyncOperation,
): void {
  if (step.kind !== 'step') return;
  const stepIndex = sync.journal.findIndex((operation) => operation.eventId === stepEventId);
  const marker = sync.journal.find(
    (operation, index) =>
      index > stepIndex &&
      operation.kind === 'routine_day' &&
      operation.routineId === step.routineId &&
      operation.completedDate === step.completedDate,
  );
  if (marker === undefined) return;
  sync.outbox = sync.outbox.filter((eventId) => eventId !== marker.eventId);
  const existingIndex = sync.terminal.findIndex(
    (terminal) =>
      terminal.eventId === marker.eventId && terminal.code === COMPLETION_DEPENDENCY_TERMINAL,
  );
  const existing = existingIndex < 0 ? undefined : sync.terminal[existingIndex];
  const dependencyEventIds = new Set(existing?.dependencyEventIds ?? []);
  dependencyEventIds.add(stepEventId);
  const journalIndex = new Map(sync.journal.map((operation, index) => [operation.eventId, index]));
  const dependencyTerminal = {
    eventId: marker.eventId,
    code: COMPLETION_DEPENDENCY_TERMINAL,
    dependencyEventIds: [...dependencyEventIds].sort(
      (left, right) => journalIndex.get(left)! - journalIndex.get(right)!,
    ),
  } as const;
  if (existingIndex < 0) sync.terminal.push(dependencyTerminal);
  else sync.terminal[existingIndex] = dependencyTerminal;
}

function appendCompletionSyncEvents(input: {
  state: CompletionState;
  step: string;
  completedDate: string;
  completedAt: string;
  remote: CompletionRemoteSyncContext;
  completionDayInserted: boolean;
  recoveredEventId?: string;
}): void {
  const identity = completionSyncStepIdentity(input.step);
  const timezone = canonicalCompletionSyncTimezone(input.remote.timezone);
  const requestedStepOrder = canonicalCompletionSyncStepOrder(input.remote.stepOrder);
  if (
    input.remote.source !== 'real_plan' ||
    input.remote.unavailableReason !== undefined ||
    identity === null ||
    timezone === null ||
    requestedStepOrder === null ||
    canonicalCompletionSyncInstant(input.completedAt) === null
  ) {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }

  const routineId = ensureCompletionSyncRoutineId(input.state.sync, identity.routineType);
  let stepIdentity = input.state.sync.stepIds[input.step];
  if (stepIdentity === undefined) {
    stepIdentity = {
      id: nextCompletionSyncUuid(input.state.sync),
      stepOrder: requestedStepOrder,
    };
    input.state.sync.stepIds[input.step] = stepIdentity;
  }
  appendCompletionSyncOperation(
    input.state.sync,
    {
      kind: 'step',
      routineId,
      routineType: identity.routineType,
      stepId: stepIdentity.id,
      userProductId: identity.userProductId,
      // The first admitted order is immutable identity metadata. Reordering a
      // local plan never rewrites the historical server step.
      stepOrder: stepIdentity.stepOrder,
      completedAt: input.completedAt,
      completedDate: input.completedDate,
      timezone,
    },
    input.recoveredEventId,
  );

  if (input.completionDayInserted) {
    if (identity.routineType !== 'PM') {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    const markerEventId = appendCompletionSyncOperation(input.state.sync, {
      kind: 'routine_day',
      routineId,
      routineType: 'PM',
      stepId: null,
      userProductId: null,
      stepOrder: null,
      completedAt: input.completedAt,
      completedDate: input.completedDate,
      timezone,
    });
    const marker = input.state.sync.journal.find(
      (operation) => operation.eventId === markerEventId,
    )!;
    const priorTerminalSteps = input.state.sync.terminal.flatMap((terminal) => {
      if (terminal.code === COMPLETION_DEPENDENCY_TERMINAL) return [];
      const operation = input.state.sync.journal.find(
        (candidate) => candidate.eventId === terminal.eventId,
      );
      return operation?.kind === 'step' &&
        operation.routineId === marker.routineId &&
        operation.completedDate === marker.completedDate
        ? [{ terminal, operation }]
        : [];
    });
    for (const { terminal, operation } of priorTerminalSteps) {
      blockRoutineDayForTerminalStep(input.state.sync, terminal.eventId, operation);
    }
  }
}

function appendCompletionSyncUnsynced(input: {
  state: CompletionState;
  step: string;
  completedDate: string;
  completedAt: string;
  remote: CompletionRemoteSyncContext;
  completionDayInserted: boolean;
}): void {
  const requestedStepOrder = canonicalCompletionSyncStepOrder(input.remote.stepOrder);
  const identity = completionSyncStepIdentity(input.step);
  const reason = input.remote.unavailableReason;
  const timezoneEvidence =
    input.remote.timezone === null ? null : canonicalCompletionSyncTimezone(input.remote.timezone);
  const routineType = input.step.startsWith('AM:')
    ? 'AM'
    : input.step.startsWith('PM:')
      ? 'PM'
      : null;
  if (
    input.remote.source !== 'real_plan' ||
    requestedStepOrder === null ||
    routineType === null ||
    canonicalCompletionSyncInstant(input.completedAt) === null ||
    (input.remote.timezone !== null &&
      canonicalCompletionSyncTimezone(input.remote.timezone) === null) ||
    (input.completionDayInserted && routineType !== 'PM') ||
    (reason === 'COMPLETION_TIMEZONE_UNAVAILABLE' &&
      (identity === null || input.remote.timezone !== null)) ||
    (reason === 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED' && identity !== null) ||
    (reason !== 'COMPLETION_TIMEZONE_UNAVAILABLE' &&
      reason !== 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED')
  ) {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  input.state.sync.unsynced.push({
    eventId: nextCompletionSyncUuid(input.state.sync),
    stepKey: input.step,
    routineType,
    stepOrder: requestedStepOrder,
    completedAt: input.completedAt,
    completedDate: input.completedDate,
    completionDayInserted: input.completionDayInserted,
    reason,
    disposition:
      reason === 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED' ? 'terminal' : 'recoverable',
    timezoneEvidence,
  });
}

async function load(lease: HealthDataWriteOperationLease): Promise<CompletionState> {
  lease.assertCurrent();
  const raw = await getPrivateItem(KEY);
  lease.assertCurrent();
  return decodeCompletionLog(raw);
}

async function hasFirstCompletionMarker(lease: HealthDataWriteOperationLease): Promise<boolean> {
  try {
    lease.assertCurrent();
    const marker = await getPrivateItem(FIRST_COMPLETION_KEY);
    lease.assertCurrent();
    return marker === 'true';
  } catch {
    lease.assertCurrent();
    return false;
  }
}

async function markFirstCompletion(lease: HealthDataWriteOperationLease): Promise<void> {
  try {
    lease.assertCurrent();
    await setPrivateItem(FIRST_COMPLETION_KEY, 'true');
    lease.assertCurrent();
  } catch {
    lease.assertCurrent();
  }
}

async function getCompletedStepsForLease(
  date: string,
  lease: HealthDataWriteOperationLease,
): Promise<Set<string>> {
  const normalizedDate = normalizeLocalDateISO(date);
  // Even an invalid request must not turn an unreadable record into empty data.
  const log = await load(lease);
  lease.assertCurrent();
  if (!normalizedDate) return new Set();
  return new Set(log.days[normalizedDate] ?? []);
}

/** The step keys checked off on `date`. */
export async function getCompletedSteps(date: string = localDateString()): Promise<Set<string>> {
  return runCurrentHealthDataOperation((lease) => getCompletedStepsForLease(date, lease));
}

/** Whether a completion date is outside the server validation window (docs/03 §6):
 *  backfill is limited to today - 2 local days, and the future side is capped at
 *  today + 1 for timezone tolerance. */
export function isBeyondBackfillCap(date: string, today: string = localDateString()): boolean {
  const normalizedDate = normalizeLocalDateISO(date);
  const normalizedToday = normalizeLocalDateISO(today);
  if (!normalizedDate || !normalizedToday) return true;
  const cutoff = shiftLocalDateISO(normalizedToday, -2);
  const maxFuture = shiftLocalDateISO(normalizedToday, 1);
  return normalizedDate < cutoff || normalizedDate > maxFuture;
}

/** Idempotently record a step's completion for a day. Returns whether it is done,
 *  whether a row was inserted, and whether this was the user's first-ever completion.
 *  Dates outside the server completion window (docs/03 §6) are rejected. */
// Repeated check-offs preserve the row because v1 completions are append-only.
export async function toggleCompletion(
  key: string,
  date: string = localDateString(),
  scheduled?: ScheduledCompletionContext,
  remoteSync?: CompletionRemoteSyncContext,
): Promise<ToggleCompletionResult> {
  return runCurrentHealthDataOperation(async (lease) => {
    const normalizedKey = normalizeStepKey(key);
    const normalizedDate = normalizeLocalDateISO(date);
    if (!normalizedKey || !normalizedDate || isBeyondBackfillCap(normalizedDate)) {
      // Outside the server completion window: do not record, report it as not-done.
      const existing = await getCompletedStepsForLease(normalizedDate ?? date, lease);
      lease.assertCurrent();
      return {
        done: normalizedKey ? existing.has(normalizedKey) : false,
        inserted: false,
        firstEver: false,
        completionDayInserted: false,
        completedStepKeysAfter: existing,
      };
    }
    const completedAt = new Date().toISOString();
    const remoteIdentity = completionSyncStepIdentity(normalizedKey);
    const remoteTimezone =
      remoteSync?.timezone === null || remoteSync === undefined
        ? null
        : canonicalCompletionSyncTimezone(remoteSync.timezone);
    if (
      remoteSync !== undefined &&
      (remoteSync.source !== 'real_plan' ||
        canonicalCompletionSyncStepOrder(remoteSync.stepOrder) === null ||
        canonicalCompletionSyncInstant(completedAt) === null ||
        (remoteSync.timezone !== null && remoteTimezone === null) ||
        (remoteSync.unavailableReason === undefined &&
          (remoteIdentity === null || remoteTimezone === null)) ||
        (remoteSync.unavailableReason === 'COMPLETION_TIMEZONE_UNAVAILABLE' &&
          (remoteIdentity === null || remoteSync.timezone !== null)) ||
        (remoteSync.unavailableReason === 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED' &&
          remoteIdentity !== null) ||
        (remoteSync.unavailableReason !== undefined &&
          remoteSync.unavailableReason !== 'COMPLETION_TIMEZONE_UNAVAILABLE' &&
          remoteSync.unavailableReason !== 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED'))
    ) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    const scheduledStepKeys =
      scheduled === undefined
        ? null
        : scheduled.stepKeys.map((step) => {
            const normalized = normalizeStepKey(step);
            if (!normalized || !normalized.startsWith('PM:')) {
              throw completionLogError(COMPLETION_LOG_INVALID);
            }
            return normalized;
          });
    if (
      scheduled &&
      (scheduled.phase !== 'PM' ||
        scheduledStepKeys?.length === 0 ||
        new Set(scheduledStepKeys).size !== scheduledStepKeys?.length ||
        !normalizedKey.startsWith('PM:') ||
        !scheduledStepKeys?.includes(normalizedKey))
    ) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    const firstCompletionAlreadyMarked = await hasFirstCompletionMarker(lease);
    lease.assertCurrent();
    let result: ToggleCompletionResult = {
      done: false,
      inserted: false,
      firstEver: false,
      completionDayInserted: false,
      completedStepKeysAfter: new Set(),
    };
    let shouldMarkFirstCompletion = false;
    let syncEventsInserted = false;
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const state = decodeCompletionLog(current);
      const hadAny = Object.values(state.days).some((steps) => steps.length > 0);
      const day = new Set(state.days[normalizedDate] ?? []);
      const alreadyCompleted = day.has(normalizedKey);
      if (!alreadyCompleted) day.add(normalizedKey);
      state.days[normalizedDate] = [...day];
      const alreadyCompletedDay = state.completedDays.has(normalizedDate);
      const completedScheduledRoutine =
        !alreadyCompleted &&
        scheduledStepKeys !== null && scheduledStepKeys.every((step) => day.has(step));
      if (completedScheduledRoutine) state.completedDays.add(normalizedDate);

      result = {
        done: true,
        inserted: !alreadyCompleted,
        firstEver: !alreadyCompleted && !hadAny && !firstCompletionAlreadyMarked,
        completionDayInserted: completedScheduledRoutine && !alreadyCompletedDay,
        completedStepKeysAfter: new Set(day),
      };
      if (result.inserted && remoteSync !== undefined) {
        if (remoteSync.unavailableReason === undefined) {
          appendCompletionSyncEvents({
            state,
            step: normalizedKey,
            completedDate: normalizedDate,
            completedAt,
            remote: remoteSync,
            completionDayInserted: result.completionDayInserted,
          });
        } else {
          appendCompletionSyncUnsynced({
            state,
            step: normalizedKey,
            completedDate: normalizedDate,
            completedAt,
            remote: remoteSync,
            completionDayInserted: result.completionDayInserted,
          });
        }
        syncEventsInserted = true;
      }
      shouldMarkFirstCompletion = hadAny || result.firstEver;
      lease.assertCurrent();
      return encodeCompletionLog(state);
    });
    lease.assertCurrent();
    if (shouldMarkFirstCompletion && !firstCompletionAlreadyMarked) {
      await markFirstCompletion(lease);
    }
    lease.assertCurrent();
    if (syncEventsInserted) notifyCompletionSyncOutboxChanged();
    return result;
  });
}

/** Strict FIFO snapshot of replay operations from the same encrypted envelope
 * that owns their visible local evidence. No owner identifier is persisted. */
export async function getPendingCompletionSyncOperations(): Promise<CompletionSyncOperation[]> {
  return runCurrentHealthDataOperation(async (lease) => {
    const state = await load(lease);
    lease.assertCurrent();
    const byEventId = new Map(
      state.sync.journal.map((operation) => [operation.eventId, operation]),
    );
    const pending = state.sync.outbox.map((eventId) => {
      const operation = byEventId.get(eventId);
      if (operation === undefined) throw completionLogError(COMPLETION_LOG_INVALID);
      return operation;
    });
    lease.assertCurrent();
    return pending;
  });
}

/** Real-plan check-offs retained locally because a server-safe operation could
 * not yet be constructed. These records are part of the encrypted local export. */
export async function getCompletionSyncUnsynced(): Promise<CompletionSyncUnsynced[]> {
  return runCurrentHealthDataOperation(async (lease) => {
    const state = await load(lease);
    lease.assertCurrent();
    return state.sync.unsynced.map((entry) => ({ ...entry }));
  });
}

/** Atomically promotes only date-proven timezone-blocked evidence into the
 * normal durable journal/outbox. A later/current zone is never applied in bulk:
 * each exact instant must map back to that event's persisted local date.
 * Product-identity repair records are terminal local evidence and remain
 * visible/exportable until explicit health-data retention cleanup. */
export async function recoverCompletionSyncUnsynced(timezone: string | null): Promise<number> {
  const normalizedTimezone = canonicalCompletionSyncTimezone(timezone);
  if (normalizedTimezone === null) return 0;
  return runCurrentHealthDataOperation(async (lease) => {
    let recovered = 0;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const state = decodeCompletionLog(current);
      const recoverable = state.sync.unsynced.filter(
        (entry) =>
          entry.reason === 'COMPLETION_TIMEZONE_UNAVAILABLE' &&
          entry.disposition === 'recoverable' &&
          entry.timezoneEvidence === null &&
          completionSyncDateInTimezone(entry.completedAt, normalizedTimezone) ===
            entry.completedDate,
      );
      if (recoverable.length === 0) return current;
      const recoverableIds = new Set(recoverable.map(({ eventId }) => eventId));
      state.sync.unsynced = state.sync.unsynced.filter(
        ({ eventId }) => !recoverableIds.has(eventId),
      );
      for (const entry of recoverable) {
        appendCompletionSyncEvents({
          state,
          step: entry.stepKey,
          completedDate: entry.completedDate,
          completedAt: entry.completedAt,
          remote: {
            source: 'real_plan',
            timezone: normalizedTimezone,
            stepOrder: entry.stepOrder,
          },
          completionDayInserted: entry.completionDayInserted,
          recoveredEventId: entry.eventId,
        });
      }
      recovered = recoverable.length;
      lease.assertCurrent();
      return encodeCompletionLog(state);
    });
    lease.assertCurrent();
    if (recovered > 0) notifyCompletionSyncOutboxChanged();
    return recovered;
  });
}

/** Remove only the replay pointer after the server returns an exact accepted or
 * exact-idempotent response. The append-only local journal remains intact. */
export async function acknowledgeCompletionSyncOperation(eventId: string): Promise<boolean> {
  if (canonicalCompletionSyncUuid(eventId) === null) {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  return runCurrentHealthDataOperation(async (lease) => {
    let acknowledged = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const state = decodeCompletionLog(current);
      if (state.sync.outbox[0] !== eventId) return current;
      state.sync.outbox.shift();
      acknowledged = true;
      lease.assertCurrent();
      return encodeCompletionLog(state);
    });
    lease.assertCurrent();
    return acknowledged;
  });
}

/** Quarantine a non-retryable response without deleting the user's original
 * event. Terminal codes are bounded, non-sensitive protocol identifiers. */
export async function rejectCompletionSyncOperation(
  eventId: string,
  code: CompletionSyncRemoteTerminalCode,
): Promise<boolean> {
  const normalizedEventId = canonicalCompletionSyncUuid(eventId);
  const normalizedCode = remoteTerminalCompletionSyncCode(code);
  if (normalizedEventId === null || normalizedCode === null) {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  return runCurrentHealthDataOperation(async (lease) => {
    let rejected = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const state = decodeCompletionLog(current);
      if (state.sync.outbox[0] !== normalizedEventId) return current;
      state.sync.outbox.shift();
      state.sync.terminal.push({ eventId: normalizedEventId, code: normalizedCode });
      const operationIndex = state.sync.journal.findIndex(
        (operation) => operation.eventId === normalizedEventId,
      );
      const operation = state.sync.journal[operationIndex];
      if (operation?.kind === 'step') {
        blockRoutineDayForTerminalStep(state.sync, normalizedEventId, operation);
      }
      rejected = true;
      lease.assertCurrent();
      return encodeCompletionLog(state);
    });
    lease.assertCurrent();
    return rejected;
  });
}

/**
 * Move the exact FIFO-head step and the remaining same-routine/date group
 * through its routine-day marker behind unrelated work. The marker can never
 * overtake an earlier blocked step, and every original event remains replayable
 * after a corrective Shelf operation.
 */
export async function deferCompletionSyncDependencyOperation(
  eventId: string,
  userProductId: string,
): Promise<Readonly<{ deferred: boolean; moved: number }>> {
  const normalizedEventId = canonicalCompletionSyncUuid(eventId);
  const normalizedProductId = canonicalCompletionSyncUuid(userProductId);
  if (normalizedEventId === null || normalizedProductId === null) {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  return runCurrentHealthDataOperation(async (lease) => {
    let deferred = false;
    let moved = 0;
    let outboxChanged = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const state = decodeCompletionLog(current);
      if (state.sync.outbox[0] !== normalizedEventId) return current;
      const operationIndex = state.sync.journal.findIndex(
        (operation) => operation.eventId === normalizedEventId,
      );
      const operation = state.sync.journal[operationIndex];
      if (operation?.kind !== 'step' || operation.userProductId !== normalizedProductId) {
        return current;
      }

      const originalOutbox = [...state.sync.outbox];
      const pendingIds = new Set(originalOutbox);
      const markerIndex = state.sync.journal.findIndex(
        (candidate, index) =>
          index > operationIndex &&
          candidate.kind === 'routine_day' &&
          candidate.routineId === operation.routineId &&
          candidate.completedDate === operation.completedDate &&
          pendingIds.has(candidate.eventId),
      );
      const deferredIds = new Set([normalizedEventId]);
      if (markerIndex > operationIndex) {
        for (let index = operationIndex + 1; index <= markerIndex; index += 1) {
          const candidate = state.sync.journal[index]!;
          if (
            candidate.routineId === operation.routineId &&
            candidate.completedDate === operation.completedDate &&
            pendingIds.has(candidate.eventId)
          ) {
            deferredIds.add(candidate.eventId);
          }
        }
      }
      const deferredEventIds = originalOutbox.filter((pendingEventId) =>
        deferredIds.has(pendingEventId),
      );
      state.sync.outbox = [
        ...originalOutbox.filter((pendingEventId) => !deferredIds.has(pendingEventId)),
        ...deferredEventIds,
      ];
      deferred = true;
      moved = deferredEventIds.length;
      outboxChanged = state.sync.outbox.some(
        (pendingEventId, index) => pendingEventId !== originalOutbox[index],
      );
      if (!outboxChanged) return current;
      lease.assertCurrent();
      return encodeCompletionLog(state);
    });
    lease.assertCurrent();
    return { deferred, moved };
  });
}

/** Dates with at least one completion (the streak's "completion days"). */
export async function getCompletedDates(): Promise<Set<string>> {
  return runCurrentHealthDataOperation(async (lease) => {
    const summary = await getCompletionSummaryForLease(lease);
    lease.assertCurrent();
    return summary.completedDates;
  });
}

/** Per-day completion counts (heat-map intensity). */
export async function getCountByDate(): Promise<Map<string, number>> {
  return runCurrentHealthDataOperation(async (lease) => {
    const summary = await getCompletionSummaryForLease(lease);
    lease.assertCurrent();
    return summary.countByDate;
  });
}

export type CompletionSummary = {
  completedDates: Set<string>;
  countByDate: Map<string, number>;
};

/**
 * One storage snapshot for consumers that need both streak dates and heat-map
 * counts. Deriving both views together prevents duplicate private-store reads and
 * guarantees they describe the same atomic completion-log version.
 */
async function getCompletionSummaryForLease(
  lease: HealthDataWriteOperationLease,
): Promise<CompletionSummary> {
  const log = await load(lease);
  lease.assertCurrent();
  const completedDates = new Set<string>();
  const countByDate = new Map<string, number>();
  for (const [date, keys] of Object.entries(log.days)) {
    if (keys.length === 0) continue;
    countByDate.set(date, keys.length);
  }
  for (const date of log.completedDays) completedDates.add(date);
  lease.assertCurrent();
  return { completedDates, countByDate };
}

export async function getCompletionSummary(): Promise<CompletionSummary> {
  return runCurrentHealthDataOperation(getCompletionSummaryForLease);
}

/** Explicit deletion lane: no health plaintext is read or returned. */
export async function clearCompletions(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    lease.assertCurrent();
    await removePrivateItem(KEY);
    lease.assertCurrent();
    await removePrivateItem(FIRST_COMPLETION_KEY);
    lease.assertCurrent();
  });
}
