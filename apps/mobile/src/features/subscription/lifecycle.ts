import { randomUUID } from 'expo-crypto';

import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import {
  getPrivateItem,
  PRIVATE_KV_CONTENT_KEY_INVALID,
  PRIVATE_KV_DECRYPTION_FAILED,
  PRIVATE_KV_ENVELOPE_INVALID,
  PRIVATE_KV_ENVELOPE_UNSUPPORTED,
  PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  readPrivateItem,
  updatePrivateItem,
  type PrivateKVReadFailureReason,
} from '@/lib/storage/privateKV';

import { readEntitlementCache } from './store';

/**
 * The reverse-trial / paid expiry -> re-offer / graceful-downgrade trigger.
 *
 * A V2 record is a two-phase delivery journal. `prepared` means navigation may
 * be retried after a new JS process starts. Only the mounted target paywall may
 * acknowledge `presented`, after its real surface has committed.
 */
const PROMPT_KEY = 'onskin.subscription.promptedExpiry';
const SCHEMA_VERSION = 2 as const;
const LEGACY_SCHEMA_VERSION = 1 as const;
const OPAQUE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SUBSCRIPTION_PROMPT_INVALID = 'SUBSCRIPTION_PROMPT_INVALID';
export const SUBSCRIPTION_PROMPT_UNSUPPORTED_VERSION = 'SUBSCRIPTION_PROMPT_UNSUPPORTED_VERSION';
export const MAX_SUBSCRIPTION_PROMPT_RECORD_CHARS = 2_048;

export type LifecycleRoute = '/paywall/reoffer' | '/paywall/downgrade';
export type LifecyclePrompt = Readonly<{
  promptId: string;
  route: LifecycleRoute;
}>;
export type LifecyclePromptReservationResult =
  | { status: 'route'; prompt: LifecyclePrompt }
  | { status: 'none' }
  | {
      status: 'unavailable';
      reason:
        | 'entitlement_unavailable'
        | 'invalid_clock'
        | 'prompt_storage_unavailable'
        | 'write_unconfirmed';
    }
  | {
      status: 'corrupt';
      reason: 'entitlement_corrupt' | 'invalid_payload' | 'private_storage_corrupt';
    }
  | { status: 'unsupported_version' }
  | { status: 'account_boundary' };

type LifecyclePromptReservationFailure = Exclude<
  LifecyclePromptReservationResult,
  { status: 'route' } | { status: 'none' }
>;

type PromptPhase = 'prepared' | 'presented';

type PromptedExpiryEnvelope = {
  version: typeof SCHEMA_VERSION;
  expiresAt: string;
  route: LifecycleRoute;
  promptId: string;
  deliverySessionId: string;
  phase: PromptPhase;
};

type DecodedPromptState =
  | { format: 'absent' }
  | { format: 'legacy_presented'; expiresAt: string }
  | { format: 'v2'; envelope: PromptedExpiryEnvelope };

export type LifecyclePromptPersistedState =
  | { format: 'legacy_presented'; expiresAt: string; phase: 'presented' }
  | {
      format: 'current';
      expiresAt: string;
      route: LifecycleRoute;
      promptId: string;
      deliverySessionId: string;
      phase: PromptPhase;
    };

export type LifecyclePromptStateRead =
  | { status: 'absent'; state: null }
  | { status: 'available'; state: LifecyclePromptPersistedState }
  | { status: 'unavailable'; state: null; reason: PrivateKVReadFailureReason }
  | {
      status: 'corrupt';
      state: null;
      reason: 'content_key_invalid' | 'decryption_failed' | 'envelope_invalid' | 'invalid_payload';
    }
  | { status: 'unsupported_version'; state: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function canonicalRFC3339(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) return null;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    zoneHourText,
    zoneMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const zoneHour = zoneHourText === undefined ? 0 : Number(zoneHourText);
  const zoneMinute = zoneMinuteText === undefined ? 0 : Number(zoneMinuteText);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    zoneHour > 23 ||
    zoneMinute > 59
  ) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function isLifecycleRoute(value: unknown): value is LifecycleRoute {
  return value === '/paywall/reoffer' || value === '/paywall/downgrade';
}

function isPromptPhase(value: unknown): value is PromptPhase {
  return value === 'prepared' || value === 'presented';
}

function normalizeOpaqueId(value: unknown): string | null {
  if (typeof value !== 'string' || !OPAQUE_ID.test(value)) return null;
  return value.toLowerCase();
}

function createOpaqueId(): string {
  const value = normalizeOpaqueId(randomUUID());
  if (!value) throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  return value;
}

// A prepared delivery is offered at most once in one JS process, while a new
// process gets a different session ID and therefore replays the same prompt.
const DELIVERY_SESSION_ID = createOpaqueId();

function decodePromptState(raw: string | null): DecodedPromptState {
  if (raw === null) return { format: 'absent' };
  if (raw.length > MAX_SUBSCRIPTION_PROMPT_RECORD_CHARS) {
    throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  }

  // Pre-envelope values were stored as the ISO string itself. They represented
  // the old one-phase "already prompted" state, so retain that interpretation.
  if (!raw.startsWith('{')) {
    const legacy = canonicalRFC3339(raw);
    if (!legacy) throw new Error(SUBSCRIPTION_PROMPT_INVALID);
    return { format: 'legacy_presented', expiresAt: legacy };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  if (
    typeof parsed.version === 'number' &&
    Number.isSafeInteger(parsed.version) &&
    parsed.version > SCHEMA_VERSION
  ) {
    throw new Error(SUBSCRIPTION_PROMPT_UNSUPPORTED_VERSION);
  }

  if (parsed.version === LEGACY_SCHEMA_VERSION) {
    if (!hasExactKeys(parsed, ['version', 'expiresAt'])) {
      throw new Error(SUBSCRIPTION_PROMPT_INVALID);
    }
    const expiresAt = canonicalRFC3339(parsed.expiresAt);
    if (!expiresAt) throw new Error(SUBSCRIPTION_PROMPT_INVALID);
    return { format: 'legacy_presented', expiresAt };
  }

  if (
    parsed.version !== SCHEMA_VERSION ||
    !hasExactKeys(parsed, [
      'version',
      'expiresAt',
      'route',
      'promptId',
      'deliverySessionId',
      'phase',
    ])
  ) {
    throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  }

  const expiresAt = canonicalRFC3339(parsed.expiresAt);
  const promptId = normalizeOpaqueId(parsed.promptId);
  const deliverySessionId = normalizeOpaqueId(parsed.deliverySessionId);
  if (
    !expiresAt ||
    parsed.expiresAt !== expiresAt ||
    !isLifecycleRoute(parsed.route) ||
    !promptId ||
    parsed.promptId !== promptId ||
    !deliverySessionId ||
    parsed.deliverySessionId !== deliverySessionId ||
    !isPromptPhase(parsed.phase)
  ) {
    throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  }

  return {
    format: 'v2',
    envelope: {
      version: SCHEMA_VERSION,
      expiresAt,
      route: parsed.route,
      promptId,
      deliverySessionId,
      phase: parsed.phase,
    },
  };
}

function encodePromptState(envelope: PromptedExpiryEnvelope): string {
  const encoded = JSON.stringify(envelope);
  if (encoded.length > MAX_SUBSCRIPTION_PROMPT_RECORD_CHARS) {
    throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  }
  return encoded;
}

function persistedPromptState(
  decoded: Exclude<DecodedPromptState, { format: 'absent' }>,
): LifecyclePromptPersistedState {
  if (decoded.format === 'legacy_presented') {
    return { format: 'legacy_presented', expiresAt: decoded.expiresAt, phase: 'presented' };
  }
  return {
    format: 'current',
    expiresAt: decoded.envelope.expiresAt,
    route: decoded.envelope.route,
    promptId: decoded.envelope.promptId,
    deliverySessionId: decoded.envelope.deliverySessionId,
    phase: decoded.envelope.phase,
  };
}

async function readLifecyclePromptStateWithLease(
  lease: AccountGenerationLease,
): Promise<LifecyclePromptStateRead> {
  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await awaitAccountGenerationLease(lease, () => readPrivateItem(PROMPT_KEY));
  } catch {
    lease.assertCurrent();
    return { status: 'unavailable', state: null, reason: 'storage_unavailable' };
  }
  lease.assertCurrent();

  if (stored.status === 'absent') return { status: 'absent', state: null };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', state: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', state: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', state: null };
  }

  try {
    const decoded = decodePromptState(stored.value);
    if (decoded.format === 'absent') return { status: 'absent', state: null };
    return { status: 'available', state: persistedPromptState(decoded) };
  } catch (error) {
    return error instanceof Error && error.message === SUBSCRIPTION_PROMPT_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', state: null }
      : { status: 'corrupt', state: null, reason: 'invalid_payload' };
  }
}

/** Inspect the persisted delivery journal without reserving, acknowledging,
 * repairing, migrating, or publishing a stale account generation. */
export async function readLifecyclePromptState(): Promise<LifecyclePromptStateRead> {
  try {
    return await runAccountGenerationOperation(readLifecyclePromptStateWithLease);
  } catch (error) {
    return {
      status: 'unavailable',
      state: null,
      reason:
        error instanceof AccountGenerationLeaseError ? 'account_boundary' : 'storage_unavailable',
    };
  }
}

function reservationFailure(error: unknown): LifecyclePromptReservationFailure {
  if (error instanceof AccountGenerationLeaseError) return { status: 'account_boundary' };
  const message = error instanceof Error ? error.message : '';
  if (message === PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY) {
    return { status: 'account_boundary' };
  }
  if (
    message === SUBSCRIPTION_PROMPT_UNSUPPORTED_VERSION ||
    message === PRIVATE_KV_ENVELOPE_UNSUPPORTED
  ) {
    return { status: 'unsupported_version' };
  }
  if (message === SUBSCRIPTION_PROMPT_INVALID) {
    return { status: 'corrupt', reason: 'invalid_payload' };
  }
  if (
    message === PRIVATE_KV_CONTENT_KEY_INVALID ||
    message === PRIVATE_KV_ENVELOPE_INVALID ||
    message === PRIVATE_KV_DECRYPTION_FAILED
  ) {
    return { status: 'corrupt', reason: 'private_storage_corrupt' };
  }
  return { status: 'unavailable', reason: 'prompt_storage_unavailable' };
}

async function exactPromptReadback(
  lease: AccountGenerationLease,
  expectedRaw: string,
): Promise<boolean> {
  try {
    const stored = await awaitAccountGenerationLease(lease, () => getPrivateItem(PROMPT_KEY));
    lease.assertCurrent();
    return stored === expectedRaw;
  } catch {
    lease.assertCurrent();
    return false;
  }
}

function routeForPeriod(periodType: string | null | undefined): LifecycleRoute {
  return periodType === 'reverse_trial' ? '/paywall/reoffer' : '/paywall/downgrade';
}

function expiryForState(state: Exclude<DecodedPromptState, { format: 'absent' }>): string {
  return state.format === 'v2' ? state.envelope.expiresAt : state.expiresAt;
}

/**
 * Atomically reserves one durable delivery intent and classifies every
 * non-delivery outcome. A prepared intent from another JS process is replayed;
 * one from this process is not duplicated. It remains prepared until the
 * target route explicitly acknowledges presentation.
 */
export async function pendingLifecycleRouteResult(
  nowISO: string,
): Promise<LifecyclePromptReservationResult> {
  const canonicalNow = canonicalRFC3339(nowISO);
  if (!canonicalNow) return { status: 'unavailable', reason: 'invalid_clock' };
  const now = Date.parse(canonicalNow);

  try {
    return await runAccountGenerationOperation(async (lease) => {
      let entitlementRead: Awaited<ReturnType<typeof readEntitlementCache>>;
      try {
        entitlementRead = await awaitAccountGenerationLease(lease, readEntitlementCache);
      } catch {
        lease.assertCurrent();
        return { status: 'unavailable', reason: 'entitlement_unavailable' };
      }
      lease.assertCurrent();
      if (entitlementRead.status !== 'available') {
        if (entitlementRead.status === 'absent') return { status: 'none' };
        if (entitlementRead.status === 'unavailable') {
          return { status: 'unavailable', reason: 'entitlement_unavailable' };
        }
        if (entitlementRead.status === 'corrupt') {
          return { status: 'corrupt', reason: 'entitlement_corrupt' };
        }
        return { status: 'unsupported_version' };
      }
      const entitlement = entitlementRead.entitlement;
      if (!entitlement.tier || !entitlement.expiresAt) return { status: 'none' };
      const entitlementExpiresAt = canonicalRFC3339(entitlement.expiresAt);
      if (!entitlementExpiresAt || entitlementExpiresAt !== entitlement.expiresAt) {
        return { status: 'corrupt', reason: 'entitlement_corrupt' };
      }
      const expiry = Date.parse(entitlementExpiresAt);
      const lapsed = !entitlement.isActive || expiry <= now;
      if (!lapsed) return { status: 'none' };

      const route = routeForPeriod(entitlement.periodType);
      const mutation: {
        expectedRaw: string | null;
        delivery: LifecyclePrompt | null;
      } = { expectedRaw: null, delivery: null };
      let failure: LifecyclePromptReservationFailure | null = null;

      try {
        await awaitAccountGenerationLease(lease, () =>
          updatePrivateItem(PROMPT_KEY, (raw) => {
            const current = decodePromptState(raw);

            if (current.format !== 'absent' && expiryForState(current) === entitlementExpiresAt) {
              if (current.format === 'legacy_presented') return raw;
              if (
                current.envelope.phase === 'presented' ||
                current.envelope.deliverySessionId === DELIVERY_SESSION_ID
              ) {
                return raw;
              }

              const replayed: PromptedExpiryEnvelope = {
                ...current.envelope,
                deliverySessionId: DELIVERY_SESSION_ID,
              };
              mutation.delivery = {
                promptId: replayed.promptId,
                route: current.envelope.route,
              };
              mutation.expectedRaw = encodePromptState(replayed);
              return mutation.expectedRaw;
            }

            const prepared: PromptedExpiryEnvelope = {
              version: SCHEMA_VERSION,
              expiresAt: entitlementExpiresAt,
              route,
              promptId: createOpaqueId(),
              deliverySessionId: DELIVERY_SESSION_ID,
              phase: 'prepared',
            };
            mutation.delivery = { promptId: prepared.promptId, route: prepared.route };
            mutation.expectedRaw = encodePromptState(prepared);
            return mutation.expectedRaw;
          }),
        );
      } catch (error) {
        // A native write may commit and then reject. Only the exact readback
        // below is allowed to turn that ambiguous outcome into a delivery.
        lease.assertCurrent();
        if (mutation.expectedRaw === null || mutation.delivery === null) {
          failure = reservationFailure(error);
        }
      }

      lease.assertCurrent();
      if (failure) return failure;
      if (mutation.expectedRaw === null || mutation.delivery === null) return { status: 'none' };
      if (!(await exactPromptReadback(lease, mutation.expectedRaw))) {
        return { status: 'unavailable', reason: 'write_unconfirmed' };
      }
      lease.assertCurrent();
      return { status: 'route', prompt: mutation.delivery };
    });
  } catch (error) {
    return reservationFailure(error);
  }
}

/** Compatibility adapter for the existing fire-and-forget mount effect. Typed
 * callers should use `pendingLifecycleRouteResult`; visible navigation remains
 * intentionally unchanged while failures now stay observable to domain code. */
export async function pendingLifecycleRoute(nowISO: string): Promise<LifecyclePrompt | null> {
  const result = await pendingLifecycleRouteResult(nowISO);
  return result.status === 'route' ? result.prompt : null;
}

/**
 * Durable presentation acknowledgement. Call only from the mounted target
 * route after the non-loading paywall surface has committed.
 */
export async function acknowledgeLifecyclePromptPresented(
  prompt: LifecyclePrompt,
): Promise<boolean> {
  const promptId = normalizeOpaqueId(prompt.promptId);
  if (!promptId || !isLifecycleRoute(prompt.route)) return false;

  try {
    return await runAccountGenerationOperation(async (lease) => {
      let expectedRaw: string | null = null;
      let matched = false;

      try {
        await awaitAccountGenerationLease(lease, () =>
          updatePrivateItem(PROMPT_KEY, (raw) => {
            const current = decodePromptState(raw);
            if (
              current.format !== 'v2' ||
              current.envelope.promptId !== promptId ||
              current.envelope.route !== prompt.route
            ) {
              return raw;
            }

            matched = true;
            const presented: PromptedExpiryEnvelope =
              current.envelope.phase === 'presented'
                ? current.envelope
                : { ...current.envelope, phase: 'presented' };
            expectedRaw = encodePromptState(presented);
            return expectedRaw;
          }),
        );
      } catch {
        // Exact readback decides whether a commit-then-reject acknowledgement
        // is durable. Other failures remain retryable as `prepared`.
        lease.assertCurrent();
      }

      lease.assertCurrent();
      if (!matched || expectedRaw === null) return false;
      return exactPromptReadback(lease, expectedRaw);
    });
  } catch (error) {
    if (error instanceof AccountGenerationLeaseError) return false;
    return false;
  }
}
