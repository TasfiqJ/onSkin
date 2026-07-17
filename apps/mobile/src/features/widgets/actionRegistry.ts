import { randomUUID } from 'expo-crypto';

import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { HEALTH_PROCESSING_STATUS_LEASE_MS } from '@/lib/consent/healthProcessingEpoch';
import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

export const ROUTINE_WIDGET_ACTION_REGISTRY_KEY = 'routinekind.widgetActionMap.v2';
export const ROUTINE_WIDGET_LEGACY_ACTION_REGISTRY_KEY = 'routinekind.widgetActionMap.v1';
export const ROUTINE_WIDGET_ACTION_REGISTRY_INVALID = 'ROUTINE_WIDGET_ACTION_REGISTRY_INVALID';
export const ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION =
  'ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION';
export const ROUTINE_WIDGET_ACTION_REGISTRY_FULL = 'ROUTINE_WIDGET_ACTION_REGISTRY_FULL';
export const ROUTINE_WIDGET_ACTION_AUTHORITY_STALE = 'ROUTINE_WIDGET_ACTION_AUTHORITY_STALE';
export const ROUTINE_WIDGET_ACTION_EXPIRED = 'ROUTINE_WIDGET_ACTION_EXPIRED';
export const ROUTINE_WIDGET_ACTION_INPUT_INVALID = 'ROUTINE_WIDGET_ACTION_INPUT_INVALID';
export const ROUTINE_WIDGET_ACTION_EXPIRY_OUTSIDE_LEASE =
  'ROUTINE_WIDGET_ACTION_EXPIRY_OUTSIDE_LEASE';

const SCHEMA_VERSION = 2 as const;
const MAX_ACTIONS_PER_SNAPSHOT = 32;
const MAX_SNAPSHOTS = 8;
const MAX_TOTAL_ACTIONS = 128;
const MAX_STEP_KEY_LENGTH = 512;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const STORE_KEYS = ['snapshots', 'version'].sort();
const SNAPSHOT_KEYS = [
  'accountGeneration',
  'actions',
  'createdAt',
  'expiresAt',
  'localDate',
  'ownerGeneration',
  'ownerUserId',
  'phase',
  'processingEpoch',
  'processingGeneration',
  'snapshotNonce',
].sort();
const ACTION_KEYS = ['stepKey', 'token'];
const ACCEPTED_ACTION_PROOF_KEYS = ['createdAtMs', 'token'];

export type RoutineWidgetActionPhase = 'AM' | 'PM';

type RoutineWidgetAction = Readonly<{
  token: string;
  stepKey: string;
}>;

type RoutineWidgetActionSnapshot = Readonly<{
  ownerUserId: string;
  ownerGeneration: string;
  processingEpoch: number;
  processingGeneration: number;
  accountGeneration: number;
  localDate: string;
  phase: RoutineWidgetActionPhase;
  snapshotNonce: string;
  createdAt: number;
  expiresAt: number;
  actions: readonly RoutineWidgetAction[];
}>;

type RoutineWidgetActionRegistryStore = Readonly<{
  version: typeof SCHEMA_VERSION;
  snapshots: readonly RoutineWidgetActionSnapshot[];
}>;

export type PreparedRoutineWidgetActions = Readonly<{
  actionTokens: readonly string[];
  ownerGeneration: string;
  snapshotNonce: string;
}>;

export type ResolvedRoutineWidgetAction =
  | Readonly<{ token: string; stepKey: string; status: 'resolved' }>
  | Readonly<{
      token: string;
      stepKey: null;
      status: 'unknown' | 'expired' | 'stale';
    }>;

export type RoutineWidgetAcceptedActionProof = Readonly<{
  token: string;
  createdAtMs: number;
}>;

export type RoutineWidgetActionResolutionRequest = Readonly<{
  events: readonly RoutineWidgetAcceptedActionProof[];
  ownerGeneration: string;
  snapshotNonce: string;
  localDate: string;
  phase: RoutineWidgetActionPhase;
}>;

export type RoutineWidgetActionAcknowledgementRequest = Readonly<{
  events: readonly RoutineWidgetAcceptedActionProof[];
  ownerGeneration: string;
  snapshotNonce: string;
}>;

function invalid(code = ROUTINE_WIDGET_ACTION_REGISTRY_INVALID): Error {
  return new Error(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function normalizeUuid(value: unknown): string | null {
  return typeof value === 'string' && value === value.toLowerCase() && UUID_V4_RE.test(value)
    ? value
    : null;
}

function normalizeLocalDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = LOCAL_DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? value
    : null;
}

function normalizePhase(value: unknown): RoutineWidgetActionPhase | null {
  return value === 'AM' || value === 'PM' ? value : null;
}

function normalizeStepKey(value: unknown, phase: RoutineWidgetActionPhase): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_STEP_KEY_LENGTH) {
    return null;
  }
  if (
    value !== value.trim() ||
    !value.startsWith(`${phase}:`) ||
    value.length === phase.length + 1
  ) {
    return null;
  }
  return value;
}

function decodeSnapshot(value: unknown): RoutineWidgetActionSnapshot {
  if (!isRecord(value) || !hasExactKeys(value, SNAPSHOT_KEYS)) throw invalid();
  const ownerUserId =
    typeof value.ownerUserId === 'string' &&
    value.ownerUserId.length > 0 &&
    value.ownerUserId.length <= 128 &&
    value.ownerUserId === value.ownerUserId.trim()
      ? value.ownerUserId
      : null;
  const ownerGeneration = normalizeUuid(value.ownerGeneration);
  const localDate = normalizeLocalDate(value.localDate);
  const phase = normalizePhase(value.phase);
  const snapshotNonce = normalizeUuid(value.snapshotNonce);
  if (
    ownerUserId === null ||
    ownerGeneration === null ||
    snapshotNonce === null ||
    ownerGeneration === snapshotNonce ||
    !isSafePositiveInteger(value.processingEpoch) ||
    !isSafePositiveInteger(value.processingGeneration) ||
    !isSafeNonNegativeInteger(value.accountGeneration) ||
    localDate === null ||
    phase === null ||
    !isSafeNonNegativeInteger(value.createdAt) ||
    !isSafePositiveInteger(value.expiresAt) ||
    value.expiresAt <= value.createdAt ||
    value.expiresAt - value.createdAt > HEALTH_PROCESSING_STATUS_LEASE_MS ||
    !Array.isArray(value.actions) ||
    value.actions.length > MAX_ACTIONS_PER_SNAPSHOT
  ) {
    throw invalid();
  }

  const actions: RoutineWidgetAction[] = [];
  const tokens = new Set<string>();
  const stepKeys = new Set<string>();
  for (const candidate of value.actions) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ACTION_KEYS)) throw invalid();
    const token = normalizeUuid(candidate.token);
    const stepKey = normalizeStepKey(candidate.stepKey, phase);
    if (token === null || stepKey === null || tokens.has(token) || stepKeys.has(stepKey)) {
      throw invalid();
    }
    tokens.add(token);
    stepKeys.add(stepKey);
    actions.push(Object.freeze({ token, stepKey }));
  }

  return Object.freeze({
    ownerUserId,
    ownerGeneration,
    processingEpoch: value.processingEpoch,
    processingGeneration: value.processingGeneration,
    accountGeneration: value.accountGeneration,
    localDate,
    phase,
    snapshotNonce,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    actions: Object.freeze(actions),
  });
}

function decodeRegistry(raw: string | null): RoutineWidgetActionRegistryStore {
  if (raw === null) return Object.freeze({ version: SCHEMA_VERSION, snapshots: Object.freeze([]) });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw invalid();
  }
  if (!isRecord(parsed)) throw invalid();
  if (parsed.version !== SCHEMA_VERSION) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw invalid(ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION);
    }
    throw invalid();
  }
  if (!hasExactKeys(parsed, STORE_KEYS) || !Array.isArray(parsed.snapshots)) throw invalid();
  if (parsed.snapshots.length > MAX_SNAPSHOTS) throw invalid();
  const snapshots = parsed.snapshots.map(decodeSnapshot);
  const identities = new Set<string>();
  const allTokens = new Set<string>();
  let totalActions = 0;
  for (const snapshot of snapshots) {
    const identity = `${snapshot.ownerGeneration}\u0000${snapshot.snapshotNonce}`;
    if (identities.has(identity)) throw invalid();
    identities.add(identity);
    totalActions += snapshot.actions.length;
    for (const action of snapshot.actions) {
      if (allTokens.has(action.token)) throw invalid();
      allTokens.add(action.token);
    }
  }
  if (totalActions > MAX_TOTAL_ACTIONS) throw invalid();
  return Object.freeze({ version: SCHEMA_VERSION, snapshots: Object.freeze(snapshots) });
}

function encodeRegistry(snapshots: readonly RoutineWidgetActionSnapshot[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, snapshots });
}

function normalizeAcceptedActionProofs(
  values: readonly RoutineWidgetAcceptedActionProof[],
): RoutineWidgetAcceptedActionProof[] {
  if (!Array.isArray(values) || values.length > MAX_ACTIONS_PER_SNAPSHOT) {
    throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
  }
  const events: RoutineWidgetAcceptedActionProof[] = [];
  const tokens = new Set<string>();
  for (const value of values) {
    if (!isRecord(value) || !hasExactKeys(value, ACCEPTED_ACTION_PROOF_KEYS)) {
      throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
    }
    const token = normalizeUuid(value.token);
    if (token === null || tokens.has(token) || !isSafeNonNegativeInteger(value.createdAtMs)) {
      throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
    }
    tokens.add(token);
    events.push(Object.freeze({ token, createdAtMs: value.createdAtMs }));
  }
  return events;
}

function authorityStatus(
  snapshot: RoutineWidgetActionSnapshot,
  lease: HealthDataWriteOperationLease,
  now: number,
): 'current' | 'stale' {
  if (
    now < snapshot.createdAt ||
    snapshot.ownerUserId !== lease.ownerUserId ||
    snapshot.processingEpoch !== lease.epoch ||
    snapshot.processingGeneration !== lease.generation ||
    snapshot.accountGeneration !== lease.accountGeneration ||
    (lease.expiresAt !== null && snapshot.expiresAt > lease.expiresAt)
  ) {
    return 'stale';
  }
  return 'current';
}

function acceptedDuringSnapshot(
  event: RoutineWidgetAcceptedActionProof,
  snapshot: RoutineWidgetActionSnapshot,
  now: number,
): boolean {
  return (
    event.createdAtMs >= snapshot.createdAt &&
    event.createdAtMs < snapshot.expiresAt &&
    event.createdAtMs <= now
  );
}

function nextUniqueUuid(used: Set<string>): string {
  for (let attempt = 0; attempt <= MAX_ACTIONS_PER_SNAPSHOT; attempt += 1) {
    const uuid = normalizeUuid(randomUUID());
    if (uuid !== null && !used.has(uuid)) {
      used.add(uuid);
      return uuid;
    }
  }
  throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
}

/**
 * Retains multiple unexpired snapshot maps so a native intent from snapshot A
 * remains resolvable while the app prepares snapshot B.
 */
export async function prepareRoutineWidgetActions(input: {
  ownerGeneration: string;
  localDate: string;
  phase: RoutineWidgetActionPhase;
  snapshotNonce?: string;
  stepKeys: readonly string[];
  expiresAt: number;
}): Promise<PreparedRoutineWidgetActions> {
  return runCurrentHealthDataOperation(async (lease) => {
    const now = Date.now();
    const ownerGeneration = normalizeUuid(input.ownerGeneration);
    const localDate = normalizeLocalDate(input.localDate);
    const phase = normalizePhase(input.phase);
    if (
      ownerGeneration === null ||
      localDate === null ||
      phase === null ||
      !Array.isArray(input.stepKeys) ||
      input.stepKeys.length > MAX_ACTIONS_PER_SNAPSHOT ||
      !isSafePositiveInteger(input.expiresAt) ||
      input.expiresAt <= now
    ) {
      throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
    }
    const maximumExpiry = Math.min(
      now + HEALTH_PROCESSING_STATUS_LEASE_MS,
      lease.expiresAt ?? Number.MAX_SAFE_INTEGER,
    );
    if (input.expiresAt > maximumExpiry) {
      throw invalid(ROUTINE_WIDGET_ACTION_EXPIRY_OUTSIDE_LEASE);
    }
    const snapshotNonce =
      input.snapshotNonce === undefined
        ? normalizeUuid(randomUUID())
        : normalizeUuid(input.snapshotNonce);
    if (snapshotNonce === null || snapshotNonce === ownerGeneration) {
      throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
    }

    const normalizedStepKeys: string[] = [];
    for (const stepKeyValue of input.stepKeys) {
      const stepKey = normalizeStepKey(stepKeyValue, phase);
      if (stepKey === null || normalizedStepKeys.includes(stepKey)) {
        throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
      }
      normalizedStepKeys.push(stepKey);
    }
    const usedUuids = new Set<string>([ownerGeneration, snapshotNonce]);
    const actions = normalizedStepKeys.map((stepKey) =>
      Object.freeze({ token: nextUniqueUuid(usedUuids), stepKey }),
    );
    const snapshot: RoutineWidgetActionSnapshot = Object.freeze({
      ownerUserId: lease.ownerUserId,
      ownerGeneration,
      processingEpoch: lease.epoch,
      processingGeneration: lease.generation,
      accountGeneration: lease.accountGeneration,
      localDate,
      phase,
      snapshotNonce,
      createdAt: now,
      expiresAt: input.expiresAt,
      actions: Object.freeze(actions),
    });

    lease.assertCurrent();
    await updatePrivateItem(ROUTINE_WIDGET_ACTION_REGISTRY_KEY, (current) => {
      lease.assertCurrent();
      let store: RoutineWidgetActionRegistryStore;
      try {
        store = decodeRegistry(current);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION
        ) {
          throw error;
        }
        store = Object.freeze({ version: SCHEMA_VERSION, snapshots: Object.freeze([]) });
      }
      const retained = store.snapshots.filter(
        (candidate) =>
          authorityStatus(candidate, lease, now) === 'current' &&
          now < candidate.expiresAt &&
          !(
            candidate.ownerGeneration === ownerGeneration &&
            candidate.snapshotNonce === snapshotNonce
          ),
      );
      if (retained.length >= MAX_SNAPSHOTS) throw invalid(ROUTINE_WIDGET_ACTION_REGISTRY_FULL);
      const totalActions = retained.reduce((sum, candidate) => sum + candidate.actions.length, 0);
      if (totalActions + actions.length > MAX_TOTAL_ACTIONS) {
        throw invalid(ROUTINE_WIDGET_ACTION_REGISTRY_FULL);
      }
      return encodeRegistry([...retained, snapshot]);
    });
    lease.assertCurrent();
    return Object.freeze({
      actionTokens: Object.freeze(actions.map(({ token }) => token)),
      ownerGeneration,
      snapshotNonce,
    });
  });
}

/** Resolve untrusted App Group tokens only inside their exact snapshot identity. */
export async function resolveRoutineWidgetActionTokens(
  request: RoutineWidgetActionResolutionRequest,
): Promise<readonly ResolvedRoutineWidgetAction[]> {
  const events = normalizeAcceptedActionProofs(request.events);
  const ownerGeneration = normalizeUuid(request.ownerGeneration);
  const snapshotNonce = normalizeUuid(request.snapshotNonce);
  const localDate = normalizeLocalDate(request.localDate);
  const phase = normalizePhase(request.phase);
  if (
    ownerGeneration === null ||
    snapshotNonce === null ||
    ownerGeneration === snapshotNonce ||
    localDate === null ||
    phase === null
  ) {
    throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
  }
  return runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    const store = decodeRegistry(await getPrivateItem(ROUTINE_WIDGET_ACTION_REGISTRY_KEY));
    lease.assertCurrent();
    const snapshot = store.snapshots.find(
      (candidate) =>
        candidate.ownerGeneration === ownerGeneration && candidate.snapshotNonce === snapshotNonce,
    );
    if (!snapshot) {
      return events.map(({ token }) =>
        Object.freeze({ token, stepKey: null, status: 'unknown' as const }),
      );
    }
    const now = Date.now();
    const authority = authorityStatus(snapshot, lease, now);
    if (authority !== 'current' || snapshot.localDate !== localDate || snapshot.phase !== phase) {
      return events.map(({ token }) =>
        Object.freeze({ token, stepKey: null, status: 'stale' as const }),
      );
    }
    const actionsByToken = new Map(snapshot.actions.map((action) => [action.token, action]));
    return events.map((event): ResolvedRoutineWidgetAction => {
      const { token } = event;
      if (!acceptedDuringSnapshot(event, snapshot, now)) {
        return Object.freeze({ token, stepKey: null, status: 'expired' });
      }
      const action = actionsByToken.get(token);
      return action
        ? Object.freeze({ token, stepKey: action.stepKey, status: 'resolved' })
        : Object.freeze({ token, stepKey: null, status: 'unknown' });
    });
  });
}

/** Remove capabilities only from the exact snapshot after canonical completion. */
export async function acknowledgeRoutineWidgetActionTokens(
  request: RoutineWidgetActionAcknowledgementRequest,
): Promise<number> {
  const events = normalizeAcceptedActionProofs(request.events);
  const ownerGeneration = normalizeUuid(request.ownerGeneration);
  const snapshotNonce = normalizeUuid(request.snapshotNonce);
  if (ownerGeneration === null || snapshotNonce === null || ownerGeneration === snapshotNonce) {
    throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
  }
  return runCurrentHealthDataOperation(async (lease) => {
    if (events.length === 0) return 0;
    let acknowledged = 0;
    lease.assertCurrent();
    await updatePrivateItem(ROUTINE_WIDGET_ACTION_REGISTRY_KEY, (current) => {
      lease.assertCurrent();
      const store = decodeRegistry(current);
      const index = store.snapshots.findIndex(
        (candidate) =>
          candidate.ownerGeneration === ownerGeneration &&
          candidate.snapshotNonce === snapshotNonce,
      );
      if (index < 0) return current;
      const snapshot = store.snapshots[index]!;
      const now = Date.now();
      if (authorityStatus(snapshot, lease, now) === 'stale') {
        throw invalid(ROUTINE_WIDGET_ACTION_AUTHORITY_STALE);
      }
      if (events.some((event) => !acceptedDuringSnapshot(event, snapshot, now))) {
        throw invalid(ROUTINE_WIDGET_ACTION_EXPIRED);
      }
      const tokenSet = new Set(events.map(({ token }) => token));
      const remaining = snapshot.actions.filter(({ token }) => !tokenSet.has(token));
      acknowledged = snapshot.actions.length - remaining.length;
      const snapshots = [...store.snapshots];
      if (remaining.length === 0) snapshots.splice(index, 1);
      else snapshots[index] = Object.freeze({ ...snapshot, actions: Object.freeze(remaining) });
      lease.assertCurrent();
      return snapshots.length === 0 ? null : encodeRegistry(snapshots);
    });
    lease.assertCurrent();
    return acknowledged;
  });
}

/** Remove a prepared snapshot only when native publication proves it was never installed. */
export async function discardRoutineWidgetPreparedActions(input: {
  ownerGeneration: string;
  snapshotNonce: string;
}): Promise<void> {
  const ownerGeneration = normalizeUuid(input.ownerGeneration);
  const snapshotNonce = normalizeUuid(input.snapshotNonce);
  if (ownerGeneration === null || snapshotNonce === null || ownerGeneration === snapshotNonce) {
    throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
  }
  await runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    await updatePrivateItem(ROUTINE_WIDGET_ACTION_REGISTRY_KEY, (current) => {
      lease.assertCurrent();
      const store = decodeRegistry(current);
      const retained = store.snapshots.filter(
        (snapshot) =>
          snapshot.ownerGeneration !== ownerGeneration || snapshot.snapshotNonce !== snapshotNonce,
      );
      return retained.length === 0 ? null : encodeRegistry(retained);
    });
    lease.assertCurrent();
  });
}

/** Native replacement makes every older snapshot incapable of AppIntent admission. */
export async function retainOnlyPublishedRoutineWidgetActions(input: {
  ownerGeneration: string;
  snapshotNonce: string | null;
}): Promise<void> {
  const ownerGeneration = normalizeUuid(input.ownerGeneration);
  const snapshotNonce = input.snapshotNonce === null ? null : normalizeUuid(input.snapshotNonce);
  if (
    ownerGeneration === null ||
    (input.snapshotNonce !== null && snapshotNonce === null) ||
    ownerGeneration === snapshotNonce
  ) {
    throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
  }
  await runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    await updatePrivateItem(ROUTINE_WIDGET_ACTION_REGISTRY_KEY, (current) => {
      lease.assertCurrent();
      const store = decodeRegistry(current);
      const retained = store.snapshots.filter(
        (snapshot) =>
          snapshot.ownerGeneration !== ownerGeneration || snapshot.snapshotNonce === snapshotNonce,
      );
      return retained.length === 0 ? null : encodeRegistry(retained);
    });
    lease.assertCurrent();
  });
}

/** Deletion-only lane used by consent/account cleanup and disabled widget state. */
export async function clearRoutineWidgetActions(): Promise<void> {
  const removals = await Promise.allSettled([
    removePrivateItem(ROUTINE_WIDGET_ACTION_REGISTRY_KEY),
    removePrivateItem(ROUTINE_WIDGET_LEGACY_ACTION_REGISTRY_KEY),
  ]);
  const failure = removals.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failure) throw failure.reason;
}
