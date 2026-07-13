import { randomUUID } from 'expo-crypto';

import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import { loadEntitlement } from './store';

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

export type LifecycleRoute = '/paywall/reoffer' | '/paywall/downgrade';
export type LifecyclePrompt = Readonly<{
  promptId: string;
  route: LifecycleRoute;
}>;

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

function validISO(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
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

  // Pre-envelope values were stored as the ISO string itself. They represented
  // the old one-phase "already prompted" state, so retain that interpretation.
  if (!raw.startsWith('{')) {
    const legacy = validISO(raw);
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
    const expiresAt = validISO(parsed.expiresAt);
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

  const expiresAt = validISO(parsed.expiresAt);
  const promptId = normalizeOpaqueId(parsed.promptId);
  const deliverySessionId = normalizeOpaqueId(parsed.deliverySessionId);
  if (
    !expiresAt ||
    !isLifecycleRoute(parsed.route) ||
    !promptId ||
    !deliverySessionId ||
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
  return JSON.stringify(envelope);
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
 * Returns one durable delivery intent. A prepared intent from another JS
 * process is replayed; one from this process is not duplicated. It remains
 * prepared until the target route explicitly acknowledges presentation.
 */
export async function pendingLifecycleRoute(nowISO: string): Promise<LifecyclePrompt | null> {
  const now = Date.parse(nowISO);
  if (!Number.isFinite(now)) return null;

  try {
    return await runAccountGenerationOperation(async (lease) => {
      const entitlement = await awaitAccountGenerationLease(lease, loadEntitlement);
      lease.assertCurrent();
      if (!entitlement?.tier || !entitlement.expiresAt) return null;
      const expiry = Date.parse(entitlement.expiresAt);
      if (!Number.isFinite(expiry)) return null;
      const lapsed = !entitlement.isActive || expiry <= now;
      if (!lapsed) return null;

      const route = routeForPeriod(entitlement.periodType);
      const mutation: {
        expectedRaw: string | null;
        delivery: LifecyclePrompt | null;
      } = { expectedRaw: null, delivery: null };

      try {
        await awaitAccountGenerationLease(lease, () =>
          updatePrivateItem(PROMPT_KEY, (raw) => {
            const current = decodePromptState(raw);

            if (current.format !== 'absent' && expiryForState(current) === entitlement.expiresAt) {
              if (current.format === 'legacy_presented') return raw;
              if (
                current.envelope.phase === 'presented' ||
                current.envelope.route !== route ||
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
                route: replayed.route,
              };
              mutation.expectedRaw = encodePromptState(replayed);
              return mutation.expectedRaw;
            }

            const prepared: PromptedExpiryEnvelope = {
              version: SCHEMA_VERSION,
              expiresAt: entitlement.expiresAt!,
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
      } catch {
        // A native write may commit and then reject. Only the exact readback
        // below is allowed to turn that ambiguous outcome into a delivery.
        lease.assertCurrent();
      }

      lease.assertCurrent();
      if (mutation.expectedRaw === null || mutation.delivery === null) return null;
      if (!(await exactPromptReadback(lease, mutation.expectedRaw))) return null;
      lease.assertCurrent();
      return mutation.delivery;
    });
  } catch (error) {
    // This API feeds a fire-and-forget mount effect. Owner replacement and
    // private-storage failures are cancelled routing decisions.
    if (error instanceof AccountGenerationLeaseError) return null;
    return null;
  }
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
