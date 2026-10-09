import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { deriveState, type StoredEntitlement } from './entitlement';
import {
  advanceSubscriptionState,
  bindEntitlementSnapshotState,
  confirmedFreePlan,
  stateFromEntitlementSnapshot,
  stateWithoutServerEvidence,
} from './clientEntitlement';

const NOW = '2026-10-09T12:00:00.000Z';
const EXPIRY = '2026-11-09T12:00:00.000Z';

function paid(): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId: 'layerwell_pro_monthly',
    expiresAt: EXPIRY,
    willRenew: true,
    grantedAt: NOW,
    source: 'revenuecat',
    environment: 'production',
    verifiedAt: NOW,
  };
}

function boundSnapshot(check: () => void) {
  const snapshot = {
    entitlement: paid(),
    effectiveNowISO: NOW,
    hasConflict: false,
    requiresUncachedRefresh: false,
  };
  bindEntitlementSnapshotState(snapshot, check);
  return snapshot;
}

describe('Expo-compatible current entitlement wrapper', () => {
  it('retains own enumerable live getters, non-plain identity, and a frozen instance', () => {
    let permitted = true;
    const snapshot = boundSnapshot(() => { if (!permitted) throw new Error('REVOKED'); });
    const state = stateFromEntitlementSnapshot(snapshot);
    const fields = Object.keys(deriveState(snapshot.entitlement, NOW));

    expect(Object.getPrototypeOf(state)).not.toBe(Object.prototype);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.keys(state)).toEqual(fields);
    for (const key of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(state, key);
      expect(descriptor).toMatchObject({ enumerable: true, configurable: false });
      expect(typeof descriptor?.get).toBe('function');
      expect(descriptor).not.toHaveProperty('value');
      expect(descriptor).not.toHaveProperty('writable');
    }
    expect(state.isPro).toBe(true);
    expect(state.tier).toBe('pro');

    permitted = false;
    expect(state.isPro).toBe(false);
    expect(state.tier).toBe('free');
    expect(state.evidenceStatus).toBe('unavailable');
    expect(confirmedFreePlan({ data: state })).toBe(false);
    expect(JSON.parse(JSON.stringify(state)).isPro).toBe(false);
  });

  it('keeps a new live wrapper through default Query Core structural sharing', () => {
    let firstCurrent = true;
    let secondCurrent = true;
    const first = stateFromEntitlementSnapshot(boundSnapshot(() => {
      if (!firstCurrent) throw new Error('REVOKED');
    }));
    const second = stateFromEntitlementSnapshot(boundSnapshot(() => {
      if (!secondCurrent) throw new Error('REVOKED');
    }));
    const queryClient = new QueryClient();
    const key = ['entitlement', 'current-publication-regression'] as const;
    try {
      queryClient.setQueryData(key, first);
      expect(queryClient.getQueryData(key)).toBe(first);
      queryClient.setQueryData(key, second);
      expect(queryClient.getQueryData(key)).toBe(second);
      expect(queryClient.getQueryData<typeof second>(key)?.isPro).toBe(true);
      firstCurrent = false; // The retired source must not determine the current result.
      expect(queryClient.getQueryData<typeof second>(key)?.isPro).toBe(true);
      secondCurrent = false;
      expect(queryClient.getQueryData<typeof second>(key)?.isPro).toBe(false);
      expect(queryClient.getQueryData<typeof second>(key)?.evidenceStatus).toBe('unavailable');
    } finally {
      queryClient.clear();
    }
  });

  it('rechecks revocation and finite expiry after retained-state transformations', () => {
    let current = true;
    const snapshot = boundSnapshot(() => { if (!current) throw new Error('REVOKED'); });
    const state = stateFromEntitlementSnapshot(snapshot);
    const expired = advanceSubscriptionState(state, Date.parse(EXPIRY) + 1);
    expect(expired.isPro).toBe(false);
    expect(expired.evidenceStatus).toBe('expired');

    const offline = stateWithoutServerEvidence({
      local: snapshot, localStatus: 'available', serverStatus: 'failed',
      nowISO: NOW, development: false,
    });
    expect(offline.isPro).toBe(true);
    expect(offline.evidenceStatus).toBe('reconciliation_due');
    current = false;
    expect(offline.isPro).toBe(false);
    expect(offline.evidenceStatus).toBe('unavailable');
    expect(expired.isPro).toBe(false);
    expect(confirmedFreePlan({ data: offline })).toBe(false);
  });
});
