import { afterEach, describe, expect, it, vi } from 'vitest';

import { deriveState, type StoredEntitlement } from './entitlement';
import {
  advanceEntitlementStateAtBoundary,
  EntitlementBoundaryScheduler,
  nextEntitlementTrustBoundary,
} from './entitlementBoundaryScheduler';
import {
  ENTITLEMENT_OFFLINE_GRACE_MS,
  ENTITLEMENT_RECONCILIATION_INTERVAL_MS,
  ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS,
  resolveEntitlementCacheRead,
} from './entitlementEvidence';

const NOW = '2026-07-05T12:00:00.000Z';
const NOW_MS = Date.parse(NOW);

function entitlement(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId: 'routinekind_pro_annual',
    expiresAt: '2027-07-05T12:00:00.000Z',
    willRenew: true,
    grantedAt: NOW,
    source: 'revenuecat',
    environment: 'production',
    verifiedAt: NOW,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('entitlement trust boundaries', () => {
  it('advances a store proof at the exact reconciliation and offline cutoffs', () => {
    const fresh = deriveState(entitlement(), NOW, 'fresh');
    const reconciliationAt = NOW_MS + ENTITLEMENT_RECONCILIATION_INTERVAL_MS;
    const offlineCutoff = NOW_MS + ENTITLEMENT_OFFLINE_GRACE_MS;

    expect(nextEntitlementTrustBoundary(fresh, NOW_MS)).toBe(reconciliationAt);
    expect(advanceEntitlementStateAtBoundary(fresh, reconciliationAt - 1)).toBe(fresh);

    const reconciliationDue = advanceEntitlementStateAtBoundary(fresh, reconciliationAt);
    expect(reconciliationDue).toMatchObject({
      isPro: true,
      evidenceStatus: 'reconciliation_due',
    });
    expect(nextEntitlementTrustBoundary(reconciliationDue, reconciliationAt)).toBe(offlineCutoff);
    expect(advanceEntitlementStateAtBoundary(reconciliationDue, offlineCutoff - 1)).toBe(
      reconciliationDue,
    );
    expect(advanceEntitlementStateAtBoundary(reconciliationDue, offlineCutoff)).toMatchObject({
      isPro: false,
      evidenceStatus: 'stale',
    });
  });

  it('keeps an app-granted reverse trial open until its exact expiry without a 72h cutoff', () => {
    const expiresAt = new Date(NOW_MS + 5 * 86_400_000).toISOString();
    const state = deriveState(
      entitlement({
        periodType: 'reverse_trial',
        store: 'app_granted',
        productId: 'reverse_trial',
        expiresAt,
        willRenew: false,
        source: 'app_granted',
      }),
      NOW,
      'fresh',
    );

    expect(nextEntitlementTrustBoundary(state, NOW_MS)).toBe(Date.parse(expiresAt));
    expect(advanceEntitlementStateAtBoundary(state, Date.parse(expiresAt) - 1)).toBe(state);
    expect(advanceEntitlementStateAtBoundary(state, Date.parse(expiresAt))).toMatchObject({
      isPro: false,
      expired: true,
      evidenceStatus: 'expired',
    });
  });

  it('ages verified RevenueCat-empty evidence at the exact offline cutoff', () => {
    const empty = resolveEntitlementCacheRead(
      {
        status: 'absent',
        entitlement: null,
        revenueCatEmpty: { verifiedAt: NOW, storeUserId: 'owner-a' },
      },
      NOW,
      'production',
    );
    const offlineCutoff = NOW_MS + ENTITLEMENT_OFFLINE_GRACE_MS;

    expect(nextEntitlementTrustBoundary(empty, NOW_MS)).toBe(offlineCutoff);
    expect(advanceEntitlementStateAtBoundary(empty, offlineCutoff - 1)).toBe(empty);
    expect(advanceEntitlementStateAtBoundary(empty, offlineCutoff)).toMatchObject({
      isPro: false,
      evidenceStatus: 'stale',
      source: 'revenuecat',
    });
  });

  it('fails closed when the verification clock moves beyond the allowed future skew', () => {
    const fresh = deriveState(entitlement(), NOW, 'fresh');
    const rolledBackNow = NOW_MS - ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS - 1;

    expect(nextEntitlementTrustBoundary(fresh, rolledBackNow)).toBe(rolledBackNow);
    const invalid = advanceEntitlementStateAtBoundary(fresh, rolledBackNow);
    expect(invalid).toMatchObject({
      isPro: false,
      expired: false,
      evidenceStatus: 'invalid',
      verifiedAt: NOW,
    });
    expect(advanceEntitlementStateAtBoundary(invalid, rolledBackNow)).toBe(invalid);
    expect(nextEntitlementTrustBoundary(invalid, rolledBackNow)).toBeNull();
  });
});

describe('EntitlementBoundaryScheduler', () => {
  it('shares one timer while firing observers at their own boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    const scheduler = new EntitlementBoundaryScheduler();
    const earlier = vi.fn();
    const later = vi.fn();

    scheduler.subscribe('owner-a:1', NOW_MS + 2_000, later);
    scheduler.subscribe('owner-a:1', NOW_MS + 1_000, earlier);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(999);
    expect(earlier).not.toHaveBeenCalled();
    expect(later).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(earlier).toHaveBeenCalledOnce();
    expect(later).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1_000);
    expect(later).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('re-arms for the remaining observer when the earlier observer unsubscribes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    const scheduler = new EntitlementBoundaryScheduler();
    const earlier = vi.fn();
    const later = vi.fn();

    scheduler.subscribe('owner-a:1', NOW_MS + 2_000, later);
    const unsubscribeEarlier = scheduler.subscribe('owner-a:1', NOW_MS + 1_000, earlier);
    unsubscribeEarlier();

    vi.advanceTimersByTime(1_000);
    expect(earlier).not.toHaveBeenCalled();
    expect(later).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(later).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('chunks boundaries beyond the maximum safe JavaScript timer delay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    const scheduler = new EntitlementBoundaryScheduler();
    const callback = vi.fn();
    const maximumChunkMs = 2_147_000_000;

    scheduler.subscribe('owner-a:1', NOW_MS + maximumChunkMs + 500, callback);
    vi.advanceTimersByTime(maximumChunkMs);
    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('fails closed on a smaller rollback at the originally armed real-time boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    const scheduler = new EntitlementBoundaryScheduler();
    const verifiedAt = NOW_MS - ENTITLEMENT_OFFLINE_GRACE_MS + 3_600_000;
    let state = deriveState(
      entitlement({ verifiedAt: new Date(verifiedAt).toISOString() }),
      NOW,
      'reconciliation_due',
    );
    const callback = vi.fn((event: { clockRollbackDetected: boolean }) => {
      state = advanceEntitlementStateAtBoundary(state, Date.now(), event);
    });
    const boundary = nextEntitlementTrustBoundary(state, NOW_MS);

    expect(boundary).toBe(NOW_MS + 3_600_000);
    scheduler.subscribe('owner-a:1', boundary!, callback);
    vi.setSystemTime(NOW_MS - 1_800_000);
    vi.advanceTimersByTime(3_600_000);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({ clockRollbackDetected: true });
    expect(state).toMatchObject({ isPro: false, evidenceStatus: 'invalid' });
    // The defensive timer remains until the observer processes the callback
    // and unsubscribes; the clock anomaly is never silently re-armed.
    expect(vi.getTimerCount()).toBe(1);
  });

  it('contains a throwing observer so peers at the same boundary still fire', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    const scheduler = new EntitlementBoundaryScheduler();
    const throwing = vi.fn(() => {
      throw new Error('observer failed');
    });
    const peer = vi.fn();

    scheduler.subscribe('owner-a:1', NOW_MS + 1_000, throwing);
    scheduler.subscribe('owner-a:1', NOW_MS + 1_000, peer);
    vi.advanceTimersByTime(1_000);

    expect(throwing).toHaveBeenCalledOnce();
    expect(peer).toHaveBeenCalledWith({ clockRollbackDetected: false });
    expect(vi.getTimerCount()).toBe(0);
  });
});
