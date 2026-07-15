import type { SubscriptionState } from './entitlement';
import {
  ENTITLEMENT_OFFLINE_GRACE_MS,
  ENTITLEMENT_RECONCILIATION_INTERVAL_MS,
  ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS,
} from './entitlementEvidence';

const MAX_TIMER_DELAY_MS = 2_147_000_000;

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAppGrantedReverseTrial(state: SubscriptionState): boolean {
  return state.store === 'app_granted' && state.priorPeriodType === 'reverse_trial';
}

function isClosedAccessState(
  state: SubscriptionState,
  evidenceStatus: 'expired' | 'invalid' | 'stale',
): boolean {
  return (
    state.tier === 'free' &&
    !state.isPro &&
    state.periodType === null &&
    state.expiresAt === null &&
    state.daysLeft === null &&
    state.willRenew === null &&
    state.productId === null &&
    !state.inReverseTrial &&
    !state.inTrial &&
    state.expired === (evidenceStatus === 'expired') &&
    state.evidenceStatus === evidenceStatus
  );
}

function closeActiveAccess(
  state: SubscriptionState,
  evidenceStatus: 'expired' | 'invalid' | 'stale',
): SubscriptionState {
  if (isClosedAccessState(state, evidenceStatus)) return state;
  return {
    ...state,
    tier: 'free',
    isPro: false,
    periodType: null,
    expiresAt: null,
    daysLeft: null,
    willRenew: null,
    productId: null,
    inReverseTrial: false,
    inTrial: false,
    expired: evidenceStatus === 'expired',
    evidenceStatus,
  };
}

export function nextEntitlementTrustBoundary(
  state: SubscriptionState,
  nowMs: number,
): number | null {
  const verifiedAt = timestamp(state.verifiedAt);
  if (
    verifiedAt !== null &&
    verifiedAt - nowMs > ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS
  ) {
    return isClosedAccessState(state, 'invalid') ? null : nowMs;
  }
  if (!state.isPro) {
    return state.source === 'revenuecat' &&
      state.evidenceStatus === 'absent' &&
      verifiedAt !== null
      ? Math.max(nowMs, verifiedAt + ENTITLEMENT_OFFLINE_GRACE_MS)
      : null;
  }
  const candidates: number[] = [];
  const expiry = timestamp(state.expiresAt);
  if (expiry !== null) candidates.push(expiry);

  if (verifiedAt !== null && !isAppGrantedReverseTrial(state)) {
    if (state.evidenceStatus === 'fresh') {
      candidates.push(verifiedAt + ENTITLEMENT_RECONCILIATION_INTERVAL_MS);
    }
    candidates.push(verifiedAt + ENTITLEMENT_OFFLINE_GRACE_MS);
  }
  if (candidates.length === 0) return null;
  return Math.max(nowMs, Math.min(...candidates));
}

export function advanceEntitlementStateAtBoundary(
  state: SubscriptionState,
  nowMs: number,
  options: Readonly<{ clockRollbackDetected?: boolean }> = {},
): SubscriptionState {
  if (options.clockRollbackDetected) return closeActiveAccess(state, 'invalid');
  const verifiedAt = timestamp(state.verifiedAt);
  if (
    verifiedAt !== null &&
    verifiedAt - nowMs > ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS
  ) {
    return closeActiveAccess(state, 'invalid');
  }
  if (!state.isPro) {
    if (
      state.source === 'revenuecat' &&
      state.evidenceStatus === 'absent' &&
      verifiedAt !== null &&
      verifiedAt + ENTITLEMENT_OFFLINE_GRACE_MS <= nowMs
    ) {
      return { ...state, evidenceStatus: 'stale' };
    }
    return state;
  }
  const expiry = timestamp(state.expiresAt);
  if (expiry !== null && expiry <= nowMs) {
    return closeActiveAccess(state, 'expired');
  }

  if (
    verifiedAt !== null &&
    !isAppGrantedReverseTrial(state) &&
    verifiedAt + ENTITLEMENT_OFFLINE_GRACE_MS <= nowMs
  ) {
    return closeActiveAccess(state, 'stale');
  }
  if (
    verifiedAt !== null &&
    !isAppGrantedReverseTrial(state) &&
    state.evidenceStatus === 'fresh' &&
    verifiedAt + ENTITLEMENT_RECONCILIATION_INTERVAL_MS <= nowMs
  ) {
    return { ...state, evidenceStatus: 'reconciliation_due' };
  }
  return state;
}

type ScheduledEntry = {
  subscriptions: Map<
    symbol,
    Readonly<{
      boundaryMs: number;
      callback: (event: EntitlementBoundaryEvent) => void;
    }>
  >;
  timer: ReturnType<typeof setTimeout> | null;
  armedAtMs: number | null;
  armedDelayMs: number | null;
};

export type EntitlementBoundaryEvent = Readonly<{
  clockRollbackDetected: boolean;
}>;

/** One bounded timer per owner-generation entitlement key, shared by all observers. */
export class EntitlementBoundaryScheduler {
  private readonly entries = new Map<string, ScheduledEntry>();

  subscribe(
    key: string,
    boundaryMs: number,
    callback: (event: EntitlementBoundaryEvent) => void,
  ): () => void {
    const token = Symbol(key);
    const entry: ScheduledEntry = this.entries.get(key) ?? {
      subscriptions: new Map<
        symbol,
        Readonly<{
          boundaryMs: number;
          callback: (event: EntitlementBoundaryEvent) => void;
        }>
      >(),
      timer: null,
      armedAtMs: null,
      armedDelayMs: null,
    };
    entry.subscriptions.set(token, { boundaryMs, callback });
    this.entries.set(key, entry);
    this.arm(key, entry);

    return () => {
      const entry = this.entries.get(key);
      if (!entry) return;
      entry.subscriptions.delete(token);
      if (entry.subscriptions.size === 0) {
        if (entry.timer !== null) clearTimeout(entry.timer);
        entry.armedAtMs = null;
        entry.armedDelayMs = null;
        this.entries.delete(key);
        return;
      }
      this.arm(key, entry);
    };
  }

  private arm(key: string, entry: ScheduledEntry): void {
    if (entry.timer !== null) clearTimeout(entry.timer);
    const boundaryMs = Math.min(
      ...Array.from(entry.subscriptions.values(), (subscription) => subscription.boundaryMs),
    );
    const armedAtMs = Date.now();
    const remaining = Math.max(0, boundaryMs - armedAtMs);
    const armedDelayMs = Math.min(remaining, MAX_TIMER_DELAY_MS);
    entry.armedAtMs = armedAtMs;
    entry.armedDelayMs = armedDelayMs;
    entry.timer = setTimeout(() => {
      if (this.entries.get(key) !== entry) return;
      const nowMs = Date.now();
      const due = Array.from(entry.subscriptions.entries()).filter(
        ([, subscription]) => subscription.boundaryMs <= nowMs,
      );
      if (due.length === 0) {
        const expectedWakeMs =
          entry.armedAtMs !== null && entry.armedDelayMs !== null
            ? entry.armedAtMs + entry.armedDelayMs
            : null;
        const clockMovedBackward = expectedWakeMs !== null && nowMs < expectedWakeMs;
        const subscriptions = clockMovedBackward
          ? Array.from(entry.subscriptions.values())
          : [];
        entry.timer = null;
        entry.armedAtMs = null;
        entry.armedDelayMs = null;
        this.arm(key, entry);
        // Keep the original subscription armed until its owner observes the
        // callback. The callback's state advancement closes future-skew proof;
        // its React cleanup then removes this defensive re-armed timer.
        for (const subscription of subscriptions) {
          try {
            subscription.callback({ clockRollbackDetected: true });
          } catch {
            // One observer cannot suppress another observer's trust transition.
          }
        }
        return;
      }

      for (const [token] of due) entry.subscriptions.delete(token);
      entry.timer = null;
      entry.armedAtMs = null;
      entry.armedDelayMs = null;
      if (entry.subscriptions.size === 0) this.entries.delete(key);
      else this.arm(key, entry);

      for (const [, subscription] of due) {
        try {
          subscription.callback({ clockRollbackDetected: false });
        } catch {
          // Due entries have already been retired; continue notifying peers.
        }
      }
    }, armedDelayMs);
  }
}

export const entitlementBoundaryScheduler = new EntitlementBoundaryScheduler();
