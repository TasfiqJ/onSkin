import { describe, expect, it } from 'vitest';

import type { StoredEntitlement } from './entitlement';
import {
  advanceEntitlementClock,
  compareServerProjectionRevisions,
  effectiveEntitlementProjection,
  emptyEntitlementEnvelope,
  isServerProjectionRevision,
  mergeEntitlementEnvelope,
  quarantineServerProjection,
  type EntitlementEvidence,
  type ServerProjectionCursor,
} from './entitlementEvidence';

const OWNER = 'a'.repeat(64);
const STREAM = '11111111-1111-4111-8111-111111111111';
const BEFORE = '2026-10-07T10:00:00.000Z';
const HORIZON = '2026-10-07T11:00:00.000Z';
const AFTER = '2026-10-07T12:00:00.000Z';
const EXPIRY = '2026-11-07T10:00:00.000Z';

function paid(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro', isActive: true, periodType: 'normal', store: 'app_store',
    productId: 'layerwell_pro_monthly', expiresAt: EXPIRY, willRenew: true,
    grantedAt: BEFORE, source: 'revenuecat', environment: 'production',
    managementUrl: null, verifiedAt: HORIZON, offeringId: null,
    packageId: null, storeUserId: null, priceLabel: null, ...overrides,
  };
}

function publication(
  revision: string,
  entitlement: StoredEntitlement | null = paid(),
  providerAt = HORIZON,
): Extract<EntitlementEvidence, { kind: 'server_projection' }> {
  return {
    kind: 'server_projection',
    cursor: {
      kind: 'server_projection', version: 1, streamId: STREAM, revision,
      provider: { kind: 'revenuecat_webhook', eventAt: providerAt, priority: 50, eventId: 'real-provider-event' },
    },
    state: entitlement?.isActive ? 'active' : entitlement ? 'inactive' : 'empty',
    entitlement,
  };
}

function sdk(at: string, entitlement: StoredEntitlement | null): EntitlementEvidence {
  return {
    kind: 'store_definitive',
    cursor: { kind: 'revenuecat_snapshot', requestDate: at, fingerprint: `verified:${at}` },
    state: entitlement?.isActive ? 'active' : entitlement ? 'inactive' : 'empty',
    entitlement,
    provenance: 'revenuecat_verified',
  };
}

function provisional(at = AFTER): EntitlementEvidence {
  return {
    kind: 'store_provisional_active',
    cursor: { kind: 'revenuecat_snapshot', requestDate: at, fingerprint: `on-device:${at}` },
    entitlement: paid({ verifiedAt: null }), provenance: 'revenuecat_verified_on_device',
  };
}

function initial(evidence: EntitlementEvidence) {
  return mergeEntitlementEnvelope(emptyEntitlementEnvelope(OWNER), evidence).envelope;
}

describe('server materialization publication contract', () => {
  it.each(['1', '9007199254740992', '9007199254740993', '9223372036854775807'])(
    'accepts canonical bounded SQL bigint string %s', (value) => expect(isServerProjectionRevision(value)).toBe(true),
  );
  it.each([null, undefined, 1, 9007199254740992, '', '0', '-1', '+1', '01', ' 1', '1 ', '1.0', '1e3', '9223372036854775808', '99999999999999999999'])(
    'rejects malformed/missing/overflowed revision %s', (value) => expect(isServerProjectionRevision(value)).toBe(false),
  );

  it('orders losslessly beyond Number safe integer without changing any provider fact', () => {
    expect(compareServerProjectionRevisions('9007199254740993', '9007199254740992')).toBe(1);
    expect(compareServerProjectionRevisions('10', '9')).toBe(1);
    const first = publication('9007199254740992');
    const old = initial(first);
    const corrected = publication('9007199254740993', paid({ isActive: false, willRenew: false }));
    const next = mergeEntitlementEnvelope(old, corrected);
    expect(next.disposition).toBe('applied');
    expect(next.envelope.store.serverProjection?.cursor.provider).toEqual(first.cursor.provider);
    expect(next.envelope.store.serverProjection?.entitlement?.verifiedAt).toBe(HORIZON);
    expect(next.envelope.store.serverProjection?.entitlement?.expiresAt).toBe(EXPIRY);
    expect(next.envelope.clockAnchor).toBe(old.clockAnchor);
    expect(next.envelope.revision).toBe(old.revision + 1);
    expect(effectiveEntitlementProjection(next.envelope, AFTER).activeStoreEntitlement).toBeNull();
    const delayed = mergeEntitlementEnvelope(next.envelope, first);
    expect(delayed).toMatchObject({ changed: false, disposition: 'stale' });
    expect(delayed.envelope).toBe(next.envelope);
    const duplicate = mergeEntitlementEnvelope(next.envelope, corrected);
    expect(duplicate).toMatchObject({ changed: false, disposition: 'duplicate' });
    expect(duplicate.envelope).toBe(next.envelope);
  });

  it.each([
    { isActive: false }, { willRenew: false }, { expiresAt: '2026-12-07T10:00:00.000Z' },
    { verifiedAt: AFTER }, { environment: 'sandbox' as const }, { managementUrl: 'https://apps.apple.com/account/subscriptions' },
    { offeringId: 'another' }, { packageId: 'another' },
  ])('same revision and changed state/provenance is sticky, including %j', (change) => {
    const first = publication('7');
    const conflict = mergeEntitlementEnvelope(initial(first), publication('7', paid(change)));
    expect(conflict.disposition).toBe('conflict');
    expect(effectiveEntitlementProjection(conflict.envelope, AFTER)).toMatchObject({ hasConflict: true, activeStoreEntitlement: null });
    const duplicate = mergeEntitlementEnvelope(conflict.envelope, first);
    expect(duplicate.requiresUncachedRefresh).toBe(true);
    const freshSdk = mergeEntitlementEnvelope(conflict.envelope, sdk(AFTER, paid()));
    expect(effectiveEntitlementProjection(freshSdk.envelope, AFTER).activeStoreEntitlement).toBeNull();
    const recovered = mergeEntitlementEnvelope(conflict.envelope, publication('8', paid({ willRenew: false })));
    expect(recovered.requiresUncachedRefresh).toBe(false);
    expect(effectiveEntitlementProjection(recovered.envelope, AFTER).activeStoreEntitlement?.willRenew).toBe(false);
  });

  it('same revision with changed real provider provenance also conflicts', () => {
    const changed = publication('1');
    const cursor: ServerProjectionCursor = { ...changed.cursor,
      provider: { kind: 'revenuecat_snapshot', requestDate: HORIZON, fingerprint: 'real-snapshot' },
    };
    const result = mergeEntitlementEnvelope(initial(publication('1')), { ...changed, cursor });
    expect(result.disposition).toBe('conflict');
  });

  it('does not treat a different server stream as greater authority', () => {
    const changed = publication('9999');
    const result = mergeEntitlementEnvelope(initial(publication('1')), {
      ...changed, cursor: { ...changed.cursor, streamId: '22222222-2222-4222-8222-222222222222' },
    });
    expect(result.disposition).toBe('conflict');
    expect(effectiveEntitlementProjection(result.envelope, AFTER).activeStoreEntitlement).toBeNull();
  });

  it('keeps finite expiry and freshness immutable through retries, clock passage and publication', () => {
    const proof = publication('1');
    const first = initial(proof);
    const expired = advanceEntitlementClock(first, EXPIRY);
    expect(effectiveEntitlementProjection(expired, BEFORE).activeStoreEntitlement).toBeNull();
    expect(expired.store.serverProjection).toBe(first.store.serverProjection);
    const next = mergeEntitlementEnvelope(expired, publication('2', paid({ willRenew: false })));
    expect(effectiveEntitlementProjection(next.envelope, BEFORE).activeStoreEntitlement).toBeNull();
    expect(next.envelope.store.serverProjection?.entitlement).toMatchObject({ verifiedAt: HORIZON, expiresAt: EXPIRY, isActive: true });
  });

  it.each(['server_webhook', 'server_snapshot'] as const)(
    'supersedes %s cache representation and rejects its later callbacks', (provenance) => {
      const legacy: EntitlementEvidence = {
        kind: 'store_definitive',
        cursor: provenance === 'server_webhook'
          ? { kind: 'revenuecat_webhook', eventAt: AFTER, priority: 100, eventId: 'cached-r1' }
          : { kind: 'revenuecat_snapshot', requestDate: AFTER, fingerprint: 'cached-snapshot' },
        state: 'active', entitlement: paid(), provenance,
      };
      const corrected = mergeEntitlementEnvelope(initial(legacy), publication('1', paid({ isActive: false })));
      expect(corrected.disposition).toBe('applied');
      expect(effectiveEntitlementProjection(corrected.envelope, AFTER).activeStoreEntitlement).toBeNull();
      expect(mergeEntitlementEnvelope(corrected.envelope, legacy).disposition).toBe('stale');
    },
  );

  it('cannot restore server-revoked access with an older verified SDK or any provisional callback', () => {
    const inactive = initial(publication('5', paid({ isActive: false })));
    for (const evidence of [sdk(BEFORE, paid()), provisional(), provisional('2027-01-01T00:00:00.000Z')]) {
      const next = mergeEntitlementEnvelope(inactive, evidence);
      expect(next.disposition).toBe('stale');
      expect(effectiveEntitlementProjection(next.envelope, AFTER).activeStoreEntitlement).toBeNull();
    }
  });

  it('does not discard a newer SDK provisional integrity conflict just because an older server fact exists', () => {
    const first = provisional();
    if (first.kind !== 'store_provisional_active') throw new Error('Expected provisional proof');
    const conflicted = mergeEntitlementEnvelope(initial(first), {
      ...first, entitlement: paid({ willRenew: false, verifiedAt: null }),
    });
    const server = mergeEntitlementEnvelope(conflicted.envelope, publication('1'));
    expect(server.requiresUncachedRefresh).toBe(true);
    expect(effectiveEntitlementProjection(server.envelope, AFTER).activeStoreEntitlement).toBeNull();
    const recovered = mergeEntitlementEnvelope(server.envelope,
      publication('2', paid(), '2026-10-07T13:00:00.000Z'));
    expect(recovered.requiresUncachedRefresh).toBe(false);
    expect(effectiveEntitlementProjection(recovered.envelope, AFTER).activeStoreEntitlement).not.toBeNull();
  });

  it('lets genuinely later fully verified SDK knowledge win in either response order while retaining server watermark', () => {
    const revoked = publication('9007199254740993', paid({ isActive: false }));
    const newerSdk = sdk(AFTER, paid({ verifiedAt: AFTER, willRenew: false }));
    for (const [first, second] of [[revoked, newerSdk], [newerSdk, revoked]]) {
      const result = mergeEntitlementEnvelope(initial(first), second);
      expect(result.requiresUncachedRefresh).toBe(false);
      expect(effectiveEntitlementProjection(result.envelope, AFTER).activeStoreEntitlement?.verifiedAt).toBe(AFTER);
      expect(result.envelope.store.serverProjection?.cursor.revision).toBe('9007199254740993');
      const delayed = mergeEntitlementEnvelope(result.envelope, publication('9007199254740992'));
      expect(delayed.disposition).toBe('stale');
      expect(delayed.envelope.store.serverProjection?.cursor.revision).toBe('9007199254740993');
      const laterFact = mergeEntitlementEnvelope(result.envelope,
        publication('9007199254740994', paid({ isActive: false }), '2026-10-07T13:00:00.000Z'));
      expect(effectiveEntitlementProjection(laterFact.envelope, AFTER).activeStoreEntitlement).toBeNull();
    }
  });

  it('fails closed for equal-time mixed disagreement and recovers on truly later verified knowledge', () => {
    const first = initial(publication('1', paid({ isActive: false })));
    const sameTime = mergeEntitlementEnvelope(first, sdk(HORIZON, paid()));
    expect(sameTime.requiresUncachedRefresh).toBe(true);
    expect(effectiveEntitlementProjection(sameTime.envelope, AFTER)).toMatchObject({ hasConflict: true, activeStoreEntitlement: null });
    const weak = mergeEntitlementEnvelope(sameTime.envelope, provisional());
    expect(effectiveEntitlementProjection(weak.envelope, AFTER).activeStoreEntitlement).toBeNull();
    const newer = mergeEntitlementEnvelope(sameTime.envelope, sdk(AFTER, paid({ verifiedAt: AFTER })));
    expect(newer.requiresUncachedRefresh).toBe(false);
    expect(effectiveEntitlementProjection(newer.envelope, AFTER).activeStoreEntitlement).not.toBeNull();
  });

  it('does not revive legacy positives after a definitive empty projection', () => {
    const first = initial(publication('1', null));
    const legacy: EntitlementEvidence = { kind: 'legacy_positive', provenance: 'server_missing_cursor', entitlement: paid() };
    expect(mergeEntitlementEnvelope(first, legacy).disposition).toBe('ignored');
    expect(effectiveEntitlementProjection(first, AFTER).activeStoreEntitlement).toBeNull();
  });

  it('a protocol quarantine retains evidence and cannot clear an equal-revision integrity conflict', () => {
    const original = publication('1');
    const first = initial(original);
    const conflict = mergeEntitlementEnvelope(first, publication('1', paid({ willRenew: false })));
    const blocked = quarantineServerProjection(conflict.envelope);
    expect(blocked.store.serverProjection).toBe(first.store.serverProjection);
    expect(quarantineServerProjection(blocked)).toBe(blocked);
    const duplicate = mergeEntitlementEnvelope(blocked, original, true);
    expect(effectiveEntitlementProjection(duplicate.envelope, AFTER)).toMatchObject({ hasConflict: true, activeStoreEntitlement: null });
    const corrected = mergeEntitlementEnvelope(blocked, publication('2', paid({ willRenew: false })), true);
    expect(corrected.requiresUncachedRefresh).toBe(false);
    expect(corrected.envelope.store.serverProtocolRejected).toBe(false);
  });

  it.each(['1', '2'])('revision %s cannot itself authorize protocol recovery', (revision) => {
    const original = publication('1');
    const blocked = quarantineServerProjection(initial(original));
    const result = mergeEntitlementEnvelope(blocked, publication(revision));
    expect(result.envelope.store.serverProtocolRejected).toBe(true);
    expect(effectiveEntitlementProjection(result.envelope, AFTER)).toMatchObject({
      hasConflict: true, activeStoreEntitlement: null,
    });
    // The store grants this separate authority only after checking the real
    // authenticated read's local capability inside its atomic update.
    const recovered = mergeEntitlementEnvelope(result.envelope, publication(revision), true);
    expect(recovered.envelope.store.serverProtocolRejected).toBe(false);
    expect(effectiveEntitlementProjection(recovered.envelope, AFTER).activeStoreEntitlement?.isActive).toBe(true);
  });
});
