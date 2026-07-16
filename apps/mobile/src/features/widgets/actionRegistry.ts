import { randomUUID } from 'expo-crypto';

import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { HEALTH_PROCESSING_STATUS_LEASE_MS } from '@/lib/consent/healthProcessingEpoch';
import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

export const ROUTINE_WIDGET_ACTION_REGISTRY_KEY = 'routinekind.widgetActionMap.v1';
export const ROUTINE_WIDGET_ACTION_REGISTRY_INVALID = 'ROUTINE_WIDGET_ACTION_REGISTRY_INVALID';
export const ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION =
  'ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION';
export const ROUTINE_WIDGET_ACTION_AUTHORITY_STALE = 'ROUTINE_WIDGET_ACTION_AUTHORITY_STALE';
export const ROUTINE_WIDGET_ACTION_EXPIRED = 'ROUTINE_WIDGET_ACTION_EXPIRED';
export const ROUTINE_WIDGET_ACTION_INPUT_INVALID = 'ROUTINE_WIDGET_ACTION_INPUT_INVALID';
export const ROUTINE_WIDGET_ACTION_EXPIRY_OUTSIDE_LEASE =
  'ROUTINE_WIDGET_ACTION_EXPIRY_OUTSIDE_LEASE';

const SCHEMA_VERSION = 1 as const;
const MAX_ACTIONS = 32;
const MAX_STEP_KEY_LENGTH = 512;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ENVELOPE_KEYS = [
  'accountGeneration',
  'actions',
  'createdAt',
  'expiresAt',
  'localDate',
  'ownerUserId',
  'phase',
  'processingEpoch',
  'processingGeneration',
  'snapshotNonce',
  'version',
].sort();
const ACTION_KEYS = ['stepKey', 'token'];

export type RoutineWidgetActionPhase = 'AM' | 'PM';

type RoutineWidgetAction = Readonly<{
  token: string;
  stepKey: string;
}>;

type RoutineWidgetActionRegistryEnvelope = Readonly<{
  version: typeof SCHEMA_VERSION;
  ownerUserId: string;
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

export type PreparedRoutineWidgetActions = Readonly<{
  actionTokens: readonly string[];
  snapshotNonce: string;
}>;

export type ResolvedRoutineWidgetAction =
  | Readonly<{ token: string; stepKey: string; status: 'resolved' }>
  | Readonly<{
      token: string;
      stepKey: null;
      status: 'unknown' | 'expired' | 'stale';
    }>;

export type RoutineWidgetActionResolutionRequest = Readonly<{
  tokens: readonly string[];
  localDate: string;
  phase: RoutineWidgetActionPhase;
  /** Optional in-process freshness check; killed-app reconciliation may omit it. */
  snapshotNonce?: string;
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
  return typeof value === 'string' && UUID_V4_RE.test(value) ? value.toLowerCase() : null;
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

function decodeRegistry(raw: string | null): RoutineWidgetActionRegistryEnvelope | null {
  if (raw === null) return null;
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
  if (!hasExactKeys(parsed, ENVELOPE_KEYS)) throw invalid();

  const ownerUserId =
    typeof parsed.ownerUserId === 'string' &&
    parsed.ownerUserId.length > 0 &&
    parsed.ownerUserId.length <= 128 &&
    parsed.ownerUserId === parsed.ownerUserId.trim()
      ? parsed.ownerUserId
      : null;
  const localDate = normalizeLocalDate(parsed.localDate);
  const phase = normalizePhase(parsed.phase);
  const snapshotNonce = normalizeUuid(parsed.snapshotNonce);
  if (
    ownerUserId === null ||
    !isSafePositiveInteger(parsed.processingEpoch) ||
    !isSafePositiveInteger(parsed.processingGeneration) ||
    !isSafeNonNegativeInteger(parsed.accountGeneration) ||
    localDate === null ||
    phase === null ||
    snapshotNonce === null ||
    !isSafeNonNegativeInteger(parsed.createdAt) ||
    !isSafePositiveInteger(parsed.expiresAt) ||
    parsed.expiresAt <= parsed.createdAt ||
    parsed.expiresAt - parsed.createdAt > HEALTH_PROCESSING_STATUS_LEASE_MS ||
    !Array.isArray(parsed.actions) ||
    parsed.actions.length > MAX_ACTIONS
  ) {
    throw invalid();
  }

  const actions: RoutineWidgetAction[] = [];
  const tokens = new Set<string>();
  const stepKeys = new Set<string>();
  for (const value of parsed.actions) {
    if (!isRecord(value) || !hasExactKeys(value, ACTION_KEYS)) throw invalid();
    const token = normalizeUuid(value.token);
    const stepKey = normalizeStepKey(value.stepKey, phase);
    if (token === null || stepKey === null || tokens.has(token) || stepKeys.has(stepKey)) {
      throw invalid();
    }
    tokens.add(token);
    stepKeys.add(stepKey);
    actions.push(Object.freeze({ token, stepKey }));
  }

  return Object.freeze({
    version: SCHEMA_VERSION,
    ownerUserId,
    processingEpoch: parsed.processingEpoch,
    processingGeneration: parsed.processingGeneration,
    accountGeneration: parsed.accountGeneration,
    localDate,
    phase,
    snapshotNonce,
    createdAt: parsed.createdAt,
    expiresAt: parsed.expiresAt,
    actions: Object.freeze(actions),
  });
}

function encodeRegistry(envelope: RoutineWidgetActionRegistryEnvelope): string {
  return JSON.stringify(envelope);
}

function normalizeTokens(values: readonly string[]): string[] {
  if (!Array.isArray(values) || values.length > MAX_ACTIONS) {
    throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
  }
  const tokens: string[] = [];
  for (const value of values) {
    const token = normalizeUuid(value);
    if (token === null || tokens.includes(token)) {
      throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
    }
    tokens.push(token);
  }
  return tokens;
}

function bindingStatus(
  envelope: RoutineWidgetActionRegistryEnvelope,
  lease: HealthDataWriteOperationLease,
  now: number,
): 'current' | 'expired' | 'stale' {
  if (
    now < envelope.createdAt ||
    envelope.ownerUserId !== lease.ownerUserId ||
    envelope.processingEpoch !== lease.epoch ||
    envelope.processingGeneration !== lease.generation ||
    envelope.accountGeneration !== lease.accountGeneration ||
    (lease.expiresAt !== null && envelope.expiresAt > lease.expiresAt)
  ) {
    return 'stale';
  }
  return now >= envelope.expiresAt ? 'expired' : 'current';
}

function assertCurrentBinding(
  envelope: RoutineWidgetActionRegistryEnvelope,
  lease: HealthDataWriteOperationLease,
  now: number,
): void {
  const status = bindingStatus(envelope, lease, now);
  if (status === 'stale') throw invalid(ROUTINE_WIDGET_ACTION_AUTHORITY_STALE);
  if (status === 'expired') throw invalid(ROUTINE_WIDGET_ACTION_EXPIRED);
}

function nextUniqueUuid(used: Set<string>): string {
  for (let attempt = 0; attempt <= MAX_ACTIONS; attempt += 1) {
    const uuid = normalizeUuid(randomUUID());
    if (uuid !== null && !used.has(uuid)) {
      used.add(uuid);
      return uuid;
    }
  }
  throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
}

/**
 * Replaces the encrypted token map for one widget snapshot. The returned value
 * is deliberately limited to opaque UUIDs that are safe to copy into the App
 * Group; owner, lease, and step identifiers stay inside privateKV.
 */
export async function prepareRoutineWidgetActions(input: {
  localDate: string;
  phase: RoutineWidgetActionPhase;
  snapshotNonce?: string;
  stepKeys: readonly string[];
  expiresAt: number;
}): Promise<PreparedRoutineWidgetActions> {
  return runCurrentHealthDataOperation(async (lease) => {
    const now = Date.now();
    const localDate = normalizeLocalDate(input.localDate);
    const phase = normalizePhase(input.phase);
    if (
      localDate === null ||
      phase === null ||
      !Array.isArray(input.stepKeys) ||
      input.stepKeys.length > MAX_ACTIONS ||
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
    if (snapshotNonce === null) throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);

    const normalizedStepKeys: string[] = [];
    for (const stepKeyValue of input.stepKeys) {
      const stepKey = normalizeStepKey(stepKeyValue, phase);
      if (stepKey === null || normalizedStepKeys.includes(stepKey)) {
        throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
      }
      normalizedStepKeys.push(stepKey);
    }
    const usedUuids = new Set<string>([snapshotNonce]);
    const actions = normalizedStepKeys.map((stepKey) =>
      Object.freeze({ token: nextUniqueUuid(usedUuids), stepKey }),
    );
    const envelope: RoutineWidgetActionRegistryEnvelope = Object.freeze({
      version: SCHEMA_VERSION,
      ownerUserId: lease.ownerUserId,
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
      if (current !== null) {
        try {
          decodeRegistry(current);
        } catch (error) {
          // Corrupt or obsolete ephemeral mappings can be safely replaced, but
          // an older binary must never destroy a registry written by a newer
          // schema it cannot understand.
          if (
            error instanceof Error &&
            error.message === ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION
          ) {
            throw error;
          }
        }
      }
      return encodeRegistry(envelope);
    });
    lease.assertCurrent();
    return Object.freeze({
      actionTokens: Object.freeze(actions.map(({ token }) => token)),
      snapshotNonce,
    });
  });
}

/** Resolve untrusted App Group tokens without returning any registry authority. */
export async function resolveRoutineWidgetActionTokens(
  request: RoutineWidgetActionResolutionRequest,
): Promise<readonly ResolvedRoutineWidgetAction[]> {
  const tokens = normalizeTokens(request.tokens);
  const localDate = normalizeLocalDate(request.localDate);
  const phase = normalizePhase(request.phase);
  const snapshotNonce =
    request.snapshotNonce === undefined ? undefined : normalizeUuid(request.snapshotNonce);
  if (localDate === null || phase === null || snapshotNonce === null) {
    throw invalid(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
  }
  return runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    const raw = await getPrivateItem(ROUTINE_WIDGET_ACTION_REGISTRY_KEY);
    lease.assertCurrent();
    const envelope = decodeRegistry(raw);
    lease.assertCurrent();
    if (envelope === null) {
      return tokens.map((token) =>
        Object.freeze({ token, stepKey: null, status: 'unknown' as const }),
      );
    }

    const binding = bindingStatus(envelope, lease, Date.now());
    const status =
      binding === 'current' &&
      (envelope.localDate !== localDate ||
        envelope.phase !== phase ||
        (snapshotNonce !== undefined && envelope.snapshotNonce !== snapshotNonce))
        ? 'stale'
        : binding;
    if (status !== 'current') {
      return tokens.map((token) => Object.freeze({ token, stepKey: null, status }));
    }
    const actionsByToken = new Map(envelope.actions.map((action) => [action.token, action]));
    return tokens.map((token): ResolvedRoutineWidgetAction => {
      const action = actionsByToken.get(token);
      return action
        ? Object.freeze({ token, stepKey: action.stepKey, status: 'resolved' })
        : Object.freeze({ token, stepKey: null, status: 'unknown' });
    });
  });
}

/** Remove capabilities only after their idempotent canonical completions succeed. */
export async function acknowledgeRoutineWidgetActionTokens(
  tokenValues: readonly string[],
): Promise<number> {
  const tokens = normalizeTokens(tokenValues);
  return runCurrentHealthDataOperation(async (lease) => {
    if (tokens.length === 0) return 0;
    let acknowledged = 0;
    lease.assertCurrent();
    await updatePrivateItem(ROUTINE_WIDGET_ACTION_REGISTRY_KEY, (current) => {
      lease.assertCurrent();
      const envelope = decodeRegistry(current);
      if (envelope === null) return null;
      assertCurrentBinding(envelope, lease, Date.now());
      const tokenSet = new Set(tokens);
      const remaining = envelope.actions.filter(({ token }) => !tokenSet.has(token));
      acknowledged = envelope.actions.length - remaining.length;
      lease.assertCurrent();
      return remaining.length === 0
        ? null
        : encodeRegistry(Object.freeze({ ...envelope, actions: Object.freeze(remaining) }));
    });
    lease.assertCurrent();
    return acknowledged;
  });
}

/** Deletion-only lane used by consent/account cleanup and disabled widget state. */
export async function clearRoutineWidgetActions(): Promise<void> {
  await removePrivateItem(ROUTINE_WIDGET_ACTION_REGISTRY_KEY);
}
