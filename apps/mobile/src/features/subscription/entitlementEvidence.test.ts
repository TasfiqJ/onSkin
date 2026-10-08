import { describe, expect, it } from 'vitest';

import type { StoredEntitlement } from './entitlement';
import {
  advanceEntitlementClock,
  compareStoreEvidenceCursors,
  effectiveEntitlementProjection,
  emptyEntitlementEnvelope,
  mergeEntitlementEnvelope,
  type EntitlementCacheEnvelopeV3,
  type EntitlementEvidence,
} from './entitlementEvidence';

const OWNER = 'a'.repeat(64);
const NOW = '2026-07-14T12:00:00.000Z';

function storeEntitlement(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId: 'annual',
    expiresAt: '2027-07-14T12:00:00.000Z',
    willRenew: true,
    grantedAt: '2026-07-01T00:00:00.000Z',
    source: 'revenuecat',
    environment: 'production',
    managementUrl: null,
    verifiedAt: '2026-07-14T10:00:00.000Z',
    offeringId: null,
    packageId: null,
    storeUserId: null,
    priceLabel: null,
    ...overrides,
  };
}

function appGrant(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return storeEntitlement({
    periodType: 'reverse_trial',
    store: 'app_granted',
    productId: null,
    expiresAt: '2026-07-21T12:00:00.000Z',
    willRenew: false,
    grantedAt: '2026-07-14T09:00:00.000Z',
    source: 'app_granted',
    offeringId: null,
    packageId: null,
    ...overrides,
  });
}

function snapshot(requestDate: string, entitlement: StoredEntitlement | null): EntitlementEvidence {
  return {
    kind: 'store_definitive',
    cursor: { kind: 'revenuecat_snapshot', requestDate, fingerprint: `snapshot:${requestDate}` },
    state: entitlement?.isActive ? 'active' : entitlement ? 'inactive' : 'empty',
    entitlement,
    provenance: 'revenuecat_verified',
  };
}

function merge(
  envelope: EntitlementCacheEnvelopeV3,
  evidence: EntitlementEvidence,
): EntitlementCacheEnvelopeV3 {
  return mergeEntitlementEnvelope(envelope, evidence).envelope;
}

describe('pure entitlement evidence merge', () => {
  it('orders webhook cursors by provider time, priority, then event id', () => {
    const base = {
      kind: 'revenuecat_webhook' as const,
      eventAt: '2026-07-14T10:00:00.000Z',
      priority: 20,
      eventId: 'a',
    };
    expect(
      compareStoreEvidenceCursors({ ...base, eventAt: '2026-07-14T09:00:00.000Z' }, base),
    ).toBe(-1);
    expect(compareStoreEvidenceCursors({ ...base, priority: 21 }, base)).toBe(1);
    expect(compareStoreEvidenceCursors({ ...base, eventId: 'b' }, base)).toBe(1);
  });

  it('lets a newer provisional positive bridge an older definitive empty, then yields to newer definitive evidence', () => {
    let envelope = merge(
      emptyEntitlementEnvelope(OWNER),
      snapshot('2026-07-14T10:00:00.000Z', null),
    );
    envelope = merge(envelope, {
      kind: 'store_provisional_active',
      cursor: {
        kind: 'revenuecat_snapshot',
        requestDate: '2026-07-14T11:00:00.000Z',
        fingerprint: 'on-device-positive',
      },
      entitlement: storeEntitlement({ verifiedAt: null }),
      provenance: 'revenuecat_verified_on_device',
    });
    expect(effectiveEntitlementProjection(envelope, NOW).activeStoreEntitlement?.isActive).toBe(
      true,
    );

    envelope = merge(envelope, snapshot('2026-07-14T12:00:00.000Z', null));
    expect(effectiveEntitlementProjection(envelope, NOW).activeStoreEntitlement).toBeNull();
    expect(envelope.store.provisionalActive).toBeNull();
  });

  it('fails closed on equal direct/webhook contradictions and requires strictly later evidence', () => {
    let envelope = merge(
      emptyEntitlementEnvelope(OWNER),
      snapshot('2026-07-14T10:00:00.000Z', storeEntitlement()),
    );
    const conflict = mergeEntitlementEnvelope(envelope, {
      kind: 'store_definitive',
      cursor: {
        kind: 'revenuecat_webhook',
        eventAt: '2026-07-14T10:00:00.000Z',
        priority: 100,
        eventId: 'expiration',
      },
      state: 'inactive',
      entitlement: storeEntitlement({ isActive: false, willRenew: false }),
      provenance: 'server_webhook',
    });
    expect(conflict).toMatchObject({
      disposition: 'conflict',
      requiresUncachedRefresh: true,
    });
    envelope = conflict.envelope;
    expect(effectiveEntitlementProjection(envelope, NOW).activeStoreEntitlement).toBeNull();

    const equalRetry = mergeEntitlementEnvelope(
      envelope,
      snapshot('2026-07-14T10:00:00.000Z', storeEntitlement()),
    );
    expect(equalRetry).toMatchObject({ changed: false, requiresUncachedRefresh: true });
    const later = mergeEntitlementEnvelope(
      envelope,
      snapshot('2026-07-14T10:00:01.000Z', storeEntitlement()),
    );
    expect(later.requiresUncachedRefresh).toBe(false);
    expect(
      effectiveEntitlementProjection(later.envelope, NOW).activeStoreEntitlement,
    ).not.toBeNull();
  });

  it('projects the union of independent store and app-grant lanes', () => {
    let envelope = merge(
      emptyEntitlementEnvelope(OWNER),
      snapshot('2026-07-14T10:00:00.000Z', null),
    );
    const grant = appGrant();
    envelope = merge(envelope, {
      kind: 'app_grant',
      grantAt: grant.grantedAt!,
      entitlement: grant,
    });
    const projection = effectiveEntitlementProjection(envelope, NOW);
    expect(projection.activeStoreEntitlement).toBeNull();
    expect(projection.activeAppGrantEntitlement).toMatchObject({ isActive: true });
    expect(projection.entitlement?.periodType).toBe('reverse_trial');
  });

  it('never lets weak legacy evidence override a trusted watermark', () => {
    const envelope = merge(
      emptyEntitlementEnvelope(OWNER),
      snapshot('2026-07-14T10:00:00.000Z', null),
    );
    const result = mergeEntitlementEnvelope(envelope, {
      kind: 'legacy_positive',
      provenance: 'server_missing_cursor',
      entitlement: storeEntitlement({ source: 'server', verifiedAt: null }),
    });
    expect(result).toMatchObject({ changed: false, disposition: 'ignored' });
    expect(effectiveEntitlementProjection(result.envelope, NOW).activeStoreEntitlement).toBeNull();
  });

  it('keeps expiry clock advancement nondecreasing and separate from evidence revision ordering', () => {
    const empty = emptyEntitlementEnvelope(OWNER);
    const advanced = advanceEntitlementClock(empty, '2026-07-14T12:00:00.000Z');
    const rolledBack = advanceEntitlementClock(advanced, '2026-07-13T12:00:00.000Z');
    expect(advanced.clockAnchor).toBe('2026-07-14T12:00:00.000Z');
    expect(rolledBack).toBe(advanced);
    expect(advanced.store.definitive).toBeNull();
  });
});
