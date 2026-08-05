import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveState, type EntitlementOwnerContext, type StoredEntitlement } from './entitlement';
import {
  ENTITLEMENT_CACHE_FOREIGN_OWNER,
  ENTITLEMENT_EVIDENCE_CURSOR_REQUIRED,
  clearEntitlement,
  clearStoreEntitlementIfRevenueCatVerifiedEmpty,
  customerInfoToEvidence,
  entitlementOwnerContextForUser,
  fetchServerEvidence,
  isDurablyAdmissibleStoreResult,
  mergeEntitlementEvidence,
  mergeEntitlementEvidenceBatch,
  publishCustomerInfoEvidence,
  readEntitlementSnapshot,
  rowToEvidence,
  saveVerifiedEntitlement,
  startReverseTrialOnServer,
} from './store';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const KEY = 'onskin.entitlement.v2';
const LEGACY_KEY = 'onskin.entitlement.v1';
const NOW = '2026-07-14T12:00:00.000Z';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  mutationTails: new Map<string, Promise<void>>(),
  nextMutationReadError: null as Error | null,
  nextMutationWriteError: null as Error | null,
  currentOwnerBinding: 'a'.repeat(64) as string | null,
  appEnvironment: 'development' as 'development' | 'staging' | 'production',
  customProGrantEnabled: false,
  isSupabaseConfigured: false,
  from: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
  writes: 0,
}));

vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: vi.fn(async (userId: string) => (userId === 'account-a' ? A : B)),
  readLocalDataOwnerProofBinding: vi.fn(async () => mocks.currentOwnerBinding),
}));

vi.mock('@/lib/env', () => ({
  env: {
    get appEnvironment() {
      return mocks.appEnvironment;
    },
    get customProGrantEnabled() {
      return mocks.customProGrantEnabled;
    },
    revenueCatEntitlementId: 'pro',
  },
  get isSupabaseConfigured() {
    return mocks.isSupabaseConfigured;
  },
}));

vi.mock('@/lib/storage/privateKV', () => ({
  PRIVATE_KV_DECRYPTION_FAILED: 'PRIVATE_KV_DECRYPTION_FAILED',
  PRIVATE_KV_ENVELOPE_INVALID: 'PRIVATE_KV_ENVELOPE_INVALID',
  PRIVATE_KV_ENVELOPE_UNSUPPORTED: 'PRIVATE_KV_ENVELOPE_UNSUPPORTED',
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  multiRemovePrivateItems: vi.fn(async (keys: readonly string[]) => {
    for (const key of keys) {
      if (mocks.storage.delete(key)) mocks.writes += 1;
    }
  }),
  updatePrivateItem: vi.fn(
    (key: string, updater: (current: string | null) => string | null): Promise<void> => {
      const previous = mocks.mutationTails.get(key) ?? Promise.resolve();
      const operation = previous
        .catch(() => undefined)
        .then(() => {
          if (mocks.nextMutationReadError) {
            const error = mocks.nextMutationReadError;
            mocks.nextMutationReadError = null;
            throw error;
          }
          const current = mocks.storage.get(key) ?? null;
          const next = updater(current);
          if (mocks.nextMutationWriteError) {
            const error = mocks.nextMutationWriteError;
            mocks.nextMutationWriteError = null;
            throw error;
          }
          if (next === current) return;
          if (next === null) mocks.storage.delete(key);
          else mocks.storage.set(key, next);
          mocks.writes += 1;
        });
      const settled = operation.then(
        () => undefined,
        () => undefined,
      );
      mocks.mutationTails.set(key, settled);
      void settled.finally(() => {
        if (mocks.mutationTails.get(key) === settled) mocks.mutationTails.delete(key);
      });
      return operation;
    },
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
  },
}));

const contextA: EntitlementOwnerContext = { ownerBinding: A };

function storeEntitlement(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId: 'routinekind_pro_annual',
    expiresAt: '2027-07-14T12:00:00.000Z',
    willRenew: true,
    grantedAt: '2026-07-01T00:00:00.000Z',
    source: 'revenuecat',
    environment: 'sandbox',
    managementUrl: 'https://apps.apple.com/account/subscriptions',
    verifiedAt: '2026-07-14T10:00:00.000Z',
    offeringId: 'default',
    packageId: 'annual',
    storeUserId: 'provider-user',
    priceLabel: '$49.99/year',
    ...overrides,
  };
}

function appGrant(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'reverse_trial',
    store: 'app_granted',
    productId: null,
    expiresAt: '2026-07-21T12:00:00.000Z',
    willRenew: false,
    grantedAt: '2026-07-14T09:00:00.000Z',
    source: 'app_granted',
    environment: 'production',
    managementUrl: null,
    verifiedAt: '2026-07-14T09:00:00.000Z',
    offeringId: null,
    packageId: null,
    storeUserId: null,
    priceLabel: null,
    ...overrides,
  };
}

function customerInfo(
  verification: 'VERIFIED' | 'VERIFIED_ON_DEVICE' | 'NOT_REQUESTED' | 'FAILED',
  requestDate: string,
  activeVerification:
    | 'VERIFIED'
    | 'VERIFIED_ON_DEVICE'
    | 'NOT_REQUESTED'
    | 'FAILED'
    | null = verification,
) {
  return {
    requestDate,
    entitlements: {
      verification,
      active:
        activeVerification !== null
          ? {
              pro: {
                verification: activeVerification,
                isActive: true,
                productIdentifier: 'routinekind_pro_annual',
              },
            }
          : {},
      all: {},
    },
  } as Parameters<typeof customerInfoToEvidence>[0];
}

function snapshotEvidence(requestDate: string, entitlement: StoredEntitlement | null) {
  const converted = customerInfoToEvidence(
    customerInfo('VERIFIED', requestDate, entitlement ? 'VERIFIED' : null),
    entitlement,
  );
  if (converted.status !== 'evidence') throw new Error('fixture conversion failed');
  return converted.evidence;
}

function webhookRow(overrides: Record<string, unknown> = {}) {
  return {
    entitlement: 'pro',
    is_active: true,
    period_type: 'normal',
    store: 'app_store',
    product_id: 'routinekind_pro_annual',
    expires_at: '2027-07-14T12:00:00.000Z',
    will_renew: true,
    original_purchase_at: '2026-07-01T00:00:00.000Z',
    source: 'server',
    environment: 'production',
    management_url: null,
    verified_at: '2026-07-14T11:00:00.000Z',
    store_user_id: 'provider-user',
    offering_id: 'default',
    package_id: 'annual',
    rc_event_at: '2026-07-14T11:00:00.000Z',
    rc_event_priority: 50,
    rc_event_id: 'event-1',
    ...overrides,
  };
}

function storeProjectionRow(overrides: Record<string, unknown> = {}) {
  return {
    tier: 'pro',
    is_active: true,
    product_id: 'routinekind_pro_annual',
    expires_at: '2027-07-14T12:00:00.000Z',
    store: 'app_store',
    period_type: 'normal',
    will_renew: true,
    granted_at: '2026-07-01T00:00:00.000Z',
    source: 'revenuecat',
    environment: 'production',
    management_url: 'https://apps.apple.com/account/subscriptions',
    verified_at: '2026-07-14T11:00:00.000Z',
    offering_id: 'default',
    package_id: 'annual',
    cursor: {
      kind: 'rc_webhook',
      at: '2026-07-14T11:00:00.000Z',
      priority: 50,
      event_id: 'event-1',
    },
    ...overrides,
  };
}

function appGrantProjectionRow(overrides: Record<string, unknown> = {}) {
  return {
    tier: 'pro',
    is_active: true,
    product_id: null,
    expires_at: '2026-07-21T12:00:00.000Z',
    store: 'app_granted',
    period_type: 'reverse_trial',
    will_renew: false,
    granted_at: '2026-07-14T09:00:00.000Z',
    source: 'app_granted',
    environment: 'production',
    management_url: null,
    verified_at: '2026-07-14T09:00:00.000Z',
    offering_id: null,
    package_id: null,
    cursor: null,
    ...overrides,
  };
}

function projectionResponse(
  storeProjection: Record<string, unknown> = { state: 'absent', row: null },
  appGrantProjection: Record<string, unknown> = { state: 'absent', row: null },
) {
  return {
    schema_version: 1,
    store_projection: storeProjection,
    app_grant_projection: appGrantProjection,
  };
}

function projectionRpcBuilder(...results: readonly Readonly<{ data: unknown; error: unknown }>[]) {
  const abortSignal = vi.fn();
  for (const result of results) abortSignal.mockResolvedValueOnce(result);
  const builder = { abortSignal };
  mocks.rpc.mockReturnValue(builder);
  return builder;
}

async function mergeAppGrant(entitlement = appGrant()) {
  return mergeEntitlementEvidence(
    contextA,
    {
      kind: 'app_grant',
      grantAt: entitlement.grantedAt!,
      entitlement,
    },
    NOW,
  );
}

describe('owner-bound entitlement evidence store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    mocks.storage.clear();
    mocks.mutationTails.clear();
    mocks.nextMutationReadError = null;
    mocks.nextMutationWriteError = null;
    mocks.currentOwnerBinding = A;
    mocks.appEnvironment = 'development';
    mocks.customProGrantEnabled = false;
    mocks.isSupabaseConfigured = false;
    mocks.from.mockReset();
    mocks.rpc.mockReset();
    mocks.invoke.mockReset();
    mocks.writes = 0;
  });

  it('creates contexts with the canonical localDataOwnerBinding and rejects a foreign proof', async () => {
    await expect(entitlementOwnerContextForUser('account-a')).resolves.toEqual(contextA);
    await expect(entitlementOwnerContextForUser('account-b')).rejects.toThrow(
      ENTITLEMENT_CACHE_FOREIGN_OWNER,
    );
  });

  it('persists a definitive empty tombstone across relaunch without reviving prior access', async () => {
    await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T10:00:00.000Z', storeEntitlement()),
      NOW,
    );
    const empty = await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', null),
      NOW,
    );

    expect(empty.status).toBe('committed');
    expect(empty.snapshot?.activeStoreEntitlement).toBeNull();
    expect(empty.snapshot?.priorEntitlement).toMatchObject({
      productId: 'routinekind_pro_annual',
      isActive: false,
    });
    const raw = mocks.storage.get(KEY)!;
    expect(JSON.parse(raw).store.definitive).toMatchObject({
      state: 'empty',
      entitlement: null,
      priorEntitlement: { productId: 'routinekind_pro_annual' },
    });

    const relaunched = await readEntitlementSnapshot(contextA, '2026-07-14T12:01:00.000Z');
    expect(relaunched.status).toBe('available');
    if (relaunched.status === 'available') {
      expect(
        deriveState(relaunched.snapshot.entitlement, relaunched.snapshot.effectiveNowISO).isPro,
      ).toBe(false);
      expect(relaunched.snapshot.activeStoreEntitlement).toBeNull();
    }
  });

  it('preserves the app-grant lane when RevenueCat definitively verifies an empty store lane', async () => {
    await mergeAppGrant();
    await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', null),
      NOW,
    );
    const read = await readEntitlementSnapshot(contextA, NOW);
    expect(read.status).toBe('available');
    if (read.status === 'available') {
      expect(read.snapshot.activeStoreEntitlement).toBeNull();
      expect(read.snapshot.activeAppGrantEntitlement).toMatchObject({
        periodType: 'reverse_trial',
        isActive: true,
      });
      expect(deriveState(read.snapshot.entitlement, read.snapshot.effectiveNowISO).isPro).toBe(
        true,
      );
    }
  });

  it('keeps VERIFIED_ON_DEVICE positive evidence provisional and ignores its empty result', async () => {
    const positive = customerInfoToEvidence(
      customerInfo('VERIFIED_ON_DEVICE', '2026-07-14T11:00:00.000Z'),
      storeEntitlement(),
    );
    expect(positive.status).toBe('evidence');
    if (positive.status === 'evidence') {
      expect(positive.evidence.kind).toBe('store_provisional_active');
      await mergeEntitlementEvidence(contextA, positive.evidence, NOW);
    }
    expect(
      customerInfoToEvidence(
        customerInfo('VERIFIED_ON_DEVICE', '2026-07-14T12:00:00.000Z', null),
        null,
      ),
    ).toEqual({ status: 'ignored', reason: 'verified_on_device_empty' });

    const read = await readEntitlementSnapshot(contextA, NOW);
    expect(read.status === 'available' && read.snapshot.activeStoreEntitlement?.isActive).toBe(
      true,
    );
    expect(JSON.parse(mocks.storage.get(KEY)!).store.definitive).toBeNull();
  });

  it('rejects FAILED and NOT_REQUESTED verification without creating positive evidence', async () => {
    expect(
      customerInfoToEvidence(
        customerInfo('FAILED', '2026-07-14T11:00:00.000Z'),
        storeEntitlement(),
      ),
    ).toEqual({ status: 'rejected', reason: 'verification_failed' });
    expect(
      customerInfoToEvidence(customerInfo('NOT_REQUESTED', '2026-07-14T11:00:00.000Z'), null),
    ).toEqual({ status: 'rejected', reason: 'verification_not_requested' });

    const weak = customerInfoToEvidence(
      customerInfo('NOT_REQUESTED', '2026-07-14T11:00:00.000Z'),
      storeEntitlement(),
    );
    expect(weak).toEqual({ status: 'rejected', reason: 'verification_not_requested' });
  });

  it.each([
    ['VERIFIED', true, 'store_definitive', 'evidence'],
    ['VERIFIED', false, 'store_definitive', 'evidence'],
    ['VERIFIED_ON_DEVICE', true, 'store_provisional_active', 'evidence'],
    ['VERIFIED_ON_DEVICE', false, null, 'ignored'],
    ['NOT_REQUESTED', true, null, 'rejected'],
    ['NOT_REQUESTED', false, null, 'rejected'],
    ['FAILED', true, null, 'rejected'],
    ['FAILED', false, null, 'rejected'],
  ] as const)(
    'maps aggregate %s with mapped-active=%s to %s/%s',
    (verification, mappedActive, expectedKind, expectedStatus) => {
      const converted = customerInfoToEvidence(
        customerInfo(verification, '2026-07-14T11:00:00.000Z', mappedActive ? verification : null),
        mappedActive ? storeEntitlement() : null,
      );
      expect(converted.status).toBe(expectedStatus);
      if (converted.status === 'evidence') expect(converted.evidence.kind).toBe(expectedKind);
    },
  );

  it('rejects a failed active entitlement even when the aggregate claims VERIFIED', () => {
    expect(
      customerInfoToEvidence(
        customerInfo('VERIFIED', '2026-07-14T11:00:00.000Z', 'FAILED'),
        storeEntitlement(),
      ),
    ).toEqual({ status: 'rejected', reason: 'verification_failed' });
  });

  it.each(['NOT_REQUESTED', 'VERIFIED_ON_DEVICE'] as const)(
    'rejects selected-child %s beneath aggregate VERIFIED',
    (activeVerification) => {
      expect(
        customerInfoToEvidence(
          customerInfo('VERIFIED', '2026-07-14T11:00:00.000Z', activeVerification),
          storeEntitlement(),
        ),
      ).toEqual({ status: 'rejected', reason: 'verification_mismatch' });
    },
  );

  it('persists an equal-provider-time contradiction as a fail-closed conflict requiring refresh', async () => {
    await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', storeEntitlement()),
      NOW,
    );
    const webhook = rowToEvidence(
      webhookRow({
        is_active: false,
        rc_event_at: '2026-07-14T11:00:00.000Z',
      }),
    );
    expect(webhook.status).toBe('evidence');
    if (webhook.status !== 'evidence') return;

    const conflict = await mergeEntitlementEvidence(contextA, webhook.evidence, NOW);
    expect(conflict).toMatchObject({
      status: 'conflict',
      disposition: 'conflict',
      requiresUncachedRefresh: true,
    });
    expect(conflict.snapshot?.activeStoreEntitlement).toBeNull();
    expect(conflict.snapshot?.hasConflict).toBe(true);

    const staleRetry = await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', storeEntitlement()),
      NOW,
    );
    expect(staleRetry).toMatchObject({ status: 'unchanged', requiresUncachedRefresh: true });

    const refreshed = await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:01.000Z', storeEntitlement()),
      NOW,
    );
    expect(refreshed).toMatchObject({ status: 'committed', requiresUncachedRefresh: false });
    expect(refreshed.snapshot?.activeStoreEntitlement?.isActive).toBe(true);
  });

  it('uses webhook provider cursor priority/id and never processing timestamps for precedence', async () => {
    const newerPriority = rowToEvidence(
      webhookRow({ rc_event_priority: 60, rc_event_id: 'event-a' }),
    );
    const olderPriority = rowToEvidence(
      webhookRow({
        is_active: false,
        rc_event_priority: 50,
        rc_event_id: 'event-z',
        verified_at: '2099-01-01T00:00:00.000Z',
        updated_at: '2099-01-01T00:00:00.000Z',
      }),
    );
    if (newerPriority.status !== 'evidence' || olderPriority.status !== 'evidence') {
      throw new Error('fixture conversion failed');
    }
    await mergeEntitlementEvidence(contextA, newerPriority.evidence, NOW);
    const stale = await mergeEntitlementEvidence(contextA, olderPriority.evidence, NOW);
    expect(stale.disposition).toBe('stale');
    expect(stale.snapshot?.activeStoreEntitlement?.isActive).toBe(true);

    const idTieBreak = rowToEvidence(
      webhookRow({ is_active: false, rc_event_priority: 60, rc_event_id: 'event-z' }),
    );
    if (idTieBreak.status !== 'evidence') throw new Error('fixture conversion failed');
    const applied = await mergeEntitlementEvidence(contextA, idTieBreak.evidence, NOW);
    expect(applied.disposition).toBe('applied');
    expect(applied.snapshot?.activeStoreEntitlement).toBeNull();
  });

  it('does not let missing-cursor legacy evidence override a definitive watermark', async () => {
    await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', null),
      NOW,
    );
    const legacy = rowToEvidence(
      webhookRow({ rc_event_at: null, rc_event_priority: null, rc_event_id: null }),
    );
    expect(legacy.status === 'evidence' && legacy.evidence.kind).toBe('legacy_positive');
    if (legacy.status !== 'evidence') return;
    const merge = await mergeEntitlementEvidence(contextA, legacy.evidence, NOW);
    expect(merge.disposition).toBe('ignored');
    expect(merge.snapshot?.activeStoreEntitlement).toBeNull();

    expect(
      rowToEvidence(
        webhookRow({
          is_active: false,
          rc_event_at: null,
          rc_event_priority: null,
          rc_event_id: null,
        }),
      ),
    ).toEqual({ status: 'ignored', reason: 'missing_store_cursor' });
  });

  it('replaces an exact owner-bound retired NOT_REQUESTED cache with fresh definitive evidence', async () => {
    const legacy = rowToEvidence(
      webhookRow({ rc_event_at: null, rc_event_priority: null, rc_event_id: null }),
    );
    if (legacy.status !== 'evidence') throw new Error('legacy fixture conversion failed');
    await mergeEntitlementEvidence(contextA, legacy.evidence, NOW);

    const seeded = JSON.parse(mocks.storage.get(KEY)!) as {
      legacy: { provenance: string };
    };
    seeded.legacy.provenance = 'revenuecat_not_requested';
    mocks.storage.set(KEY, JSON.stringify(seeded));

    await expect(readEntitlementSnapshot(contextA, NOW)).resolves.toMatchObject({
      status: 'corrupt',
    });

    const repaired = await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', storeEntitlement()),
      NOW,
    );
    expect(repaired).toMatchObject({ status: 'committed', disposition: 'applied' });
    expect(repaired.snapshot?.activeStoreEntitlement?.isActive).toBe(true);
    expect(mocks.storage.get(KEY)).not.toContain('revenuecat_not_requested');
    await expect(readEntitlementSnapshot(contextA, NOW)).resolves.toMatchObject({
      status: 'available',
      snapshot: { activeStoreEntitlement: { isActive: true } },
    });
  });

  it('scrubs only the retired proof while retaining newer inactive, app-grant, revision, and clock authority', async () => {
    const legacy = rowToEvidence(
      webhookRow({ rc_event_at: null, rc_event_priority: null, rc_event_id: null }),
    );
    if (legacy.status !== 'evidence') throw new Error('legacy fixture conversion failed');
    await mergeEntitlementEvidence(contextA, legacy.evidence, NOW);
    const retiredProof = (JSON.parse(mocks.storage.get(KEY)!) as { legacy: unknown }).legacy;

    mocks.storage.delete(KEY);
    await mergeAppGrant();
    await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', storeEntitlement()),
      NOW,
    );
    await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T12:00:00.000Z', null),
      NOW,
    );
    const seeded = JSON.parse(mocks.storage.get(KEY)!) as {
      revision: number;
      clockAnchor: string;
      store: { definitive: unknown };
      appGrant: { definitive: unknown };
      legacy: { provenance: string } | null;
    };
    seeded.legacy = retiredProof as { provenance: string };
    seeded.legacy.provenance = 'revenuecat_not_requested';
    const expected = {
      revision: seeded.revision,
      clockAnchor: seeded.clockAnchor,
      storeDefinitive: seeded.store.definitive,
      appGrantDefinitive: seeded.appGrant.definitive,
    };
    mocks.storage.set(KEY, JSON.stringify(seeded));

    const repaired = await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:30:00.000Z', storeEntitlement()),
      NOW,
    );
    expect(repaired.disposition).toBe('stale');
    expect(repaired.snapshot?.activeStoreEntitlement).toBeNull();
    expect(repaired.snapshot?.activeAppGrantEntitlement?.isActive).toBe(true);
    const saved = JSON.parse(mocks.storage.get(KEY)!) as typeof seeded;
    expect(saved.legacy).toBeNull();
    expect(saved.revision).toBe(expected.revision);
    expect(saved.clockAnchor).toBe(expected.clockAnchor);
    expect(saved.store.definitive).toEqual(expected.storeDefinitive);
    expect(saved.appGrant.definitive).toEqual(expected.appGrantDefinitive);
  });

  it('scrubs only the retired proof while retaining a fail-closed conflict', async () => {
    const legacy = rowToEvidence(
      webhookRow({ rc_event_at: null, rc_event_priority: null, rc_event_id: null }),
    );
    if (legacy.status !== 'evidence') throw new Error('legacy fixture conversion failed');
    await mergeEntitlementEvidence(contextA, legacy.evidence, NOW);
    const retiredProof = (JSON.parse(mocks.storage.get(KEY)!) as { legacy: unknown }).legacy;

    mocks.storage.delete(KEY);
    await mergeAppGrant();
    await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', storeEntitlement()),
      NOW,
    );
    const contradictory = rowToEvidence(
      webhookRow({ is_active: false, rc_event_at: '2026-07-14T11:00:00.000Z' }),
    );
    if (contradictory.status !== 'evidence') throw new Error('conflict fixture conversion failed');
    await mergeEntitlementEvidence(contextA, contradictory.evidence, NOW);
    const seeded = JSON.parse(mocks.storage.get(KEY)!) as {
      revision: number;
      clockAnchor: string;
      store: { conflict: unknown };
      appGrant: { definitive: unknown };
      legacy: { provenance: string } | null;
    };
    seeded.legacy = retiredProof as { provenance: string };
    seeded.legacy.provenance = 'revenuecat_not_requested';
    const expected = {
      revision: seeded.revision,
      clockAnchor: seeded.clockAnchor,
      conflict: seeded.store.conflict,
      appGrantDefinitive: seeded.appGrant.definitive,
    };
    mocks.storage.set(KEY, JSON.stringify(seeded));

    const repaired = await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T10:00:00.000Z', storeEntitlement()),
      NOW,
    );
    expect(repaired.snapshot?.hasConflict).toBe(true);
    expect(repaired.snapshot?.activeStoreEntitlement).toBeNull();
    expect(repaired.snapshot?.activeAppGrantEntitlement?.isActive).toBe(true);
    const saved = JSON.parse(mocks.storage.get(KEY)!) as typeof seeded;
    expect(saved.legacy).toBeNull();
    expect(saved.revision).toBe(expected.revision);
    expect(saved.clockAnchor).toBe(expected.clockAnchor);
    expect(saved.store.conflict).toEqual(expected.conflict);
    expect(saved.appGrant.definitive).toEqual(expected.appGrantDefinitive);
  });

  it('does not let weak evidence adopt a retired NOT_REQUESTED cache', async () => {
    const legacy = rowToEvidence(
      webhookRow({ rc_event_at: null, rc_event_priority: null, rc_event_id: null }),
    );
    if (legacy.status !== 'evidence') throw new Error('legacy fixture conversion failed');
    await mergeEntitlementEvidence(contextA, legacy.evidence, NOW);

    const seeded = JSON.parse(mocks.storage.get(KEY)!) as {
      legacy: { provenance: string };
    };
    seeded.legacy.provenance = 'revenuecat_not_requested';
    const raw = JSON.stringify(seeded);
    mocks.storage.set(KEY, raw);

    const blocked = await mergeEntitlementEvidence(contextA, legacy.evidence, NOW);
    expect(blocked.status).toBe('blocked');
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it.each(['foreign owner', 'forged fingerprint'] as const)(
    'does not scrub a %s retired cache during repair',
    async (label) => {
      const legacy = rowToEvidence(
        webhookRow({ rc_event_at: null, rc_event_priority: null, rc_event_id: null }),
      );
      if (legacy.status !== 'evidence') throw new Error('legacy fixture conversion failed');
      await mergeEntitlementEvidence(contextA, legacy.evidence, NOW);

      const seeded = JSON.parse(mocks.storage.get(KEY)!) as {
        ownerBinding: string;
        legacy: { provenance: string; fingerprint: string };
      };
      seeded.legacy.provenance = 'revenuecat_not_requested';
      if (label === 'foreign owner') seeded.ownerBinding = B;
      else seeded.legacy.fingerprint = 'forged';
      const raw = JSON.stringify(seeded);
      mocks.storage.set(KEY, raw);

      const blocked = await mergeEntitlementEvidence(
        contextA,
        snapshotEvidence('2026-07-14T11:00:00.000Z', storeEntitlement()),
        NOW,
      );
      expect(blocked.status).toBe('blocked');
      expect(mocks.storage.get(KEY)).toBe(raw);
    },
  );

  it.each([
    ['corrupt', '{not-json', 'corrupt'],
    ['future', JSON.stringify({ version: 999 }), 'unsupported_version'],
  ])('preserves %s bytes and blocks authoritative overwrite', async (_label, raw, status) => {
    mocks.storage.set(KEY, raw);
    await expect(readEntitlementSnapshot(contextA, NOW)).resolves.toMatchObject({ status });
    const merge = await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', storeEntitlement()),
      NOW,
    );
    expect(merge.status).toBe('blocked');
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('never grants owner A evidence to owner B after an account transition', async () => {
    await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', storeEntitlement()),
      NOW,
    );
    mocks.currentOwnerBinding = B;
    const contextB = await entitlementOwnerContextForUser('account-b');
    const foreign = await readEntitlementSnapshot(contextB, NOW);
    expect(foreign).toEqual({ status: 'foreign_owner', snapshot: null });
    expect(mocks.storage.get(KEY)).toContain(A);

    await clearEntitlement();
    const cleanB = await mergeEntitlementEvidence(
      contextB,
      snapshotEvidence('2026-07-14T12:00:00.000Z', storeEntitlement()),
      NOW,
    );
    expect(cleanB.snapshot?.ownerBinding).toBe(B);
  });

  it('does not adopt an unbound legacy cache but can replace it with authoritative owner evidence', async () => {
    const legacy = JSON.stringify({ version: 1, entitlement: storeEntitlement() });
    mocks.storage.set(KEY, legacy);
    mocks.storage.set(LEGACY_KEY, JSON.stringify(storeEntitlement()));
    await expect(readEntitlementSnapshot(contextA, NOW)).resolves.toEqual({
      status: 'legacy_unbound',
      snapshot: null,
    });
    expect(mocks.storage.get(KEY)).toBe(legacy);

    const merged = await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', storeEntitlement()),
      NOW,
    );
    expect(merged.status).toBe('committed');
    expect(JSON.parse(mocks.storage.get(KEY)!).ownerBinding).toBe(A);
    expect(mocks.storage.get(LEGACY_KEY)).toBeDefined();
  });

  it('serializes concurrent evidence and keeps the provider-newest result', async () => {
    const newer = mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T12:00:00.000Z', storeEntitlement({ productId: 'new' })),
      NOW,
    );
    const older = mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', storeEntitlement({ productId: 'old' })),
      NOW,
    );
    await Promise.all([newer, older]);
    const read = await readEntitlementSnapshot(contextA, NOW);
    expect(read.status === 'available' && read.snapshot.activeStoreEntitlement?.productId).toBe(
      'new',
    );
  });

  it('leaves prior bytes and access neutral when the atomic write fails', async () => {
    await mergeAppGrant();
    const before = mocks.storage.get(KEY);
    mocks.nextMutationWriteError = new Error('PRIVATE_KV_WRITE_FAILED');
    const result = await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T11:00:00.000Z', null),
      NOW,
    );
    expect(result).toMatchObject({ status: 'blocked', snapshot: null });
    expect(mocks.storage.get(KEY)).toBe(before);
    const read = await readEntitlementSnapshot(contextA, NOW);
    expect(read.status === 'available' && read.snapshot.activeAppGrantEntitlement?.isActive).toBe(
      true,
    );
  });

  it('publishes only the exact owner query after cancellation and committed merge', async () => {
    const queryClient = {
      cancelQueries: vi.fn(async () => undefined),
      setQueryData: vi.fn(),
    };
    const result = await publishCustomerInfoEvidence({
      context: contextA,
      customerInfo: customerInfo('VERIFIED', '2026-07-14T11:00:00.000Z'),
      entitlement: storeEntitlement(),
      queryClient,
      observedAtISO: NOW,
    });
    expect(result.status).toBe('committed');
    expect(queryClient.cancelQueries).toHaveBeenCalledWith({
      queryKey: ['entitlement', A],
      exact: true,
    });
    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      ['entitlement', A],
      expect.objectContaining({ isPro: true }),
    );
    expect(isDurablyAdmissibleStoreResult('VERIFIED', result)).toBe(true);
    expect(isDurablyAdmissibleStoreResult('NOT_REQUESTED', result)).toBe(false);
  });

  it('re-publishes trusted local state when non-definitive empty evidence is ignored', async () => {
    await mergeAppGrant();
    const queryClient = {
      cancelQueries: vi.fn(async () => undefined),
      setQueryData: vi.fn(),
    };
    const result = await publishCustomerInfoEvidence({
      context: contextA,
      customerInfo: customerInfo('VERIFIED_ON_DEVICE', '2026-07-14T11:00:00.000Z', null),
      entitlement: null,
      queryClient,
      observedAtISO: NOW,
    });

    expect(result).toMatchObject({ status: 'ignored', reason: 'verified_on_device_empty' });
    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      ['entitlement', A],
      expect.objectContaining({ isPro: true, source: 'app_granted' }),
    );
  });

  it('marks only applied or exact-duplicate admissible provider evidence as durably persisted', async () => {
    const queryClient = {
      cancelQueries: vi.fn(async () => undefined),
      setQueryData: vi.fn(),
    };
    const first = await publishCustomerInfoEvidence({
      context: contextA,
      customerInfo: customerInfo('VERIFIED', '2026-07-14T11:00:00.000Z'),
      entitlement: storeEntitlement(),
      queryClient,
      observedAtISO: NOW,
    });
    const duplicate = await publishCustomerInfoEvidence({
      context: contextA,
      customerInfo: customerInfo('VERIFIED', '2026-07-14T11:00:00.000Z'),
      entitlement: storeEntitlement(),
      queryClient,
      observedAtISO: NOW,
    });
    const stale = await publishCustomerInfoEvidence({
      context: contextA,
      customerInfo: customerInfo('VERIFIED', '2026-07-14T10:00:00.000Z'),
      entitlement: storeEntitlement(),
      queryClient,
      observedAtISO: NOW,
    });
    expect(first.disposition).toBe('applied');
    expect(duplicate.disposition).toBe('duplicate');
    expect(stale.disposition).toBe('stale');
    expect(isDurablyAdmissibleStoreResult('VERIFIED', first)).toBe(true);
    expect(isDurablyAdmissibleStoreResult('VERIFIED', duplicate)).toBe(true);
    expect(isDurablyAdmissibleStoreResult('VERIFIED', stale)).toBe(false);
  });

  it('keeps server absence and transport error distinct and non-clearing', async () => {
    mocks.isSupabaseConfigured = true;
    const builder = projectionRpcBuilder(
      { data: projectionResponse(), error: null },
      { data: null, error: new Error('offline') },
    );
    const firstSignal = new AbortController().signal;
    await expect(fetchServerEvidence(contextA, firstSignal)).resolves.toEqual({
      status: 'absent',
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'read_entitlement_projections');
    expect(builder.abortSignal).toHaveBeenNthCalledWith(1, firstSignal);
    await expect(fetchServerEvidence(contextA, new AbortController().signal)).resolves.toEqual({
      status: 'transport_error',
      reason: 'server_projection_query_failed',
    });
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('rejects a projection that completes after the local owner changes', async () => {
    mocks.isSupabaseConfigured = true;
    const builder = {
      abortSignal: vi.fn(async () => {
        mocks.currentOwnerBinding = B;
        return {
          data: projectionResponse({ state: 'active', row: storeProjectionRow() }),
          error: null,
        };
      }),
    };
    mocks.rpc.mockReturnValue(builder);

    await expect(fetchServerEvidence(contextA, new AbortController().signal)).resolves.toEqual({
      status: 'blocked',
      reason: ENTITLEMENT_CACHE_FOREIGN_OWNER,
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('maps both server authority lanes and commits them in one atomic transform', async () => {
    mocks.isSupabaseConfigured = true;
    projectionRpcBuilder({
      data: projectionResponse(
        { state: 'active', row: storeProjectionRow() },
        { state: 'active', row: appGrantProjectionRow() },
      ),
      error: null,
    });

    const fetched = await fetchServerEvidence(contextA, new AbortController().signal);
    expect(fetched.status).toBe('evidence');
    if (fetched.status !== 'evidence') throw new Error('expected projection evidence');
    expect(fetched.evidence).toHaveLength(2);
    const merged = await mergeEntitlementEvidenceBatch(contextA, fetched.evidence, NOW);
    expect(merged.status).toBe('committed');
    expect(merged.snapshot?.activeStoreEntitlement).toMatchObject({
      source: 'revenuecat',
      productId: 'routinekind_pro_annual',
    });
    expect(merged.snapshot?.activeAppGrantEntitlement).toMatchObject({
      source: 'app_granted',
      periodType: 'reverse_trial',
    });
    expect(mocks.writes).toBe(1);
  });

  it('reconciles a legacy-unknown store row once and re-reads one authoritative tombstone', async () => {
    mocks.isSupabaseConfigured = true;
    const legacy = projectionResponse({
      state: 'legacy_unknown',
      row: storeProjectionRow({ is_active: false, cursor: null }),
    });
    const tombstone = projectionResponse({
      state: 'inactive',
      row: storeProjectionRow({
        tier: null,
        is_active: false,
        product_id: null,
        expires_at: null,
        store: null,
        period_type: null,
        will_renew: false,
        granted_at: null,
        management_url: null,
        offering_id: null,
        package_id: null,
        cursor: {
          kind: 'rc_snapshot',
          at: '2026-07-14T11:30:00+00:00',
          fingerprint: 'verified-empty',
        },
      }),
    });
    const builder = projectionRpcBuilder(
      { data: legacy, error: null },
      { data: tombstone, error: null },
    );
    mocks.invoke.mockResolvedValue({ data: { outcome: 'reconciled' }, error: null });
    const signal = new AbortController().signal;

    const fetched = await fetchServerEvidence(contextA, signal);
    expect(fetched).toMatchObject({
      status: 'evidence',
      evidence: [
        {
          kind: 'store_definitive',
          state: 'empty',
          entitlement: null,
          cursor: {
            kind: 'revenuecat_snapshot',
            requestDate: '2026-07-14T11:30:00.000Z',
          },
        },
      ],
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(builder.abortSignal).toHaveBeenCalledTimes(2);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith('subscription-reconciliation', {
      body: {},
      signal,
    });
  });

  it('does not clear trusted local store evidence when legacy reconciliation fails', async () => {
    await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T10:00:00.000Z', storeEntitlement()),
      NOW,
    );
    const before = mocks.storage.get(KEY);
    mocks.isSupabaseConfigured = true;
    projectionRpcBuilder({
      data: projectionResponse({
        state: 'legacy_unknown',
        row: storeProjectionRow({ is_active: false, cursor: null }),
      }),
      error: null,
    });
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('offline') });

    await expect(fetchServerEvidence(contextA, new AbortController().signal)).resolves.toEqual({
      status: 'transport_error',
      reason: 'subscription_reconciliation_failed',
    });
    expect(mocks.storage.get(KEY)).toBe(before);
    const read = await readEntitlementSnapshot(contextA, NOW);
    expect(read.status === 'available' && read.snapshot.activeStoreEntitlement?.isActive).toBe(
      true,
    );
  });

  it('retains an independent app grant even when legacy store reconciliation fails', async () => {
    mocks.isSupabaseConfigured = true;
    projectionRpcBuilder({
      data: projectionResponse(
        {
          state: 'legacy_unknown',
          row: storeProjectionRow({ is_active: false, cursor: null }),
        },
        { state: 'active', row: appGrantProjectionRow() },
      ),
      error: null,
    });
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('offline') });

    const fetched = await fetchServerEvidence(contextA, new AbortController().signal);
    expect(fetched).toMatchObject({
      status: 'evidence',
      evidence: [{ kind: 'app_grant' }],
    });
  });

  it('rejects incoherent projection shapes without mutating trusted bytes', async () => {
    await mergeAppGrant();
    const before = mocks.storage.get(KEY);
    mocks.isSupabaseConfigured = true;
    projectionRpcBuilder({
      data: projectionResponse({
        state: 'inactive',
        row: storeProjectionRow({ is_active: true }),
      }),
      error: null,
    });

    await expect(fetchServerEvidence(contextA, new AbortController().signal)).resolves.toEqual({
      status: 'rejected',
      reason: 'server_projection_invalid',
    });
    expect(mocks.storage.get(KEY)).toBe(before);
  });

  it('keeps the compatibility save wrapper app-grant-only', async () => {
    await expect(saveVerifiedEntitlement(storeEntitlement())).rejects.toThrow(
      ENTITLEMENT_EVIDENCE_CURSOR_REQUIRED,
    );
    await expect(saveVerifiedEntitlement(appGrant())).resolves.toMatchObject({
      source: 'app_granted',
    });
  });

  it('keeps the compatibility empty wrapper aggregate-VERIFIED-only', async () => {
    await mergeEntitlementEvidence(
      contextA,
      snapshotEvidence('2026-07-14T10:00:00.000Z', storeEntitlement()),
      NOW,
    );
    await expect(clearStoreEntitlementIfRevenueCatVerifiedEmpty()).resolves.toBe('blocked');
    await expect(
      clearStoreEntitlementIfRevenueCatVerifiedEmpty(
        customerInfo('VERIFIED_ON_DEVICE', '2026-07-14T11:00:00.000Z', null),
      ),
    ).resolves.toBe('blocked');
    await expect(
      clearStoreEntitlementIfRevenueCatVerifiedEmpty(
        customerInfo('VERIFIED', '2026-07-14T11:00:00.000Z', null),
      ),
    ).resolves.toBe('committed');
    const read = await readEntitlementSnapshot(contextA, NOW);
    expect(read.status === 'available' && read.snapshot.activeStoreEntitlement).toBeNull();
  });

  it('rejects an unconfigured reverse trial without invoking or writing authority', async () => {
    mocks.customProGrantEnabled = true;
    await expect(startReverseTrialOnServer()).rejects.toThrow(
      'Reverse trial is unavailable until Supabase is configured.',
    );
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('keeps the custom full-Pro grant disabled unless the development exception is explicit', async () => {
    mocks.isSupabaseConfigured = true;
    await expect(startReverseTrialOnServer()).rejects.toThrow('CUSTOM_PRO_GRANT_DISABLED');
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
  });

  it('commits a reverse trial only from the configured server response', async () => {
    mocks.customProGrantEnabled = true;
    mocks.isSupabaseConfigured = true;
    const grantedAt = '2026-07-14T12:00:00.000Z';
    mocks.invoke.mockResolvedValue({
      data: {
        entitlement: webhookRow({
          period_type: 'reverse_trial',
          store: 'app_granted',
          product_id: null,
          expires_at: '2026-07-21T12:00:00.000Z',
          will_renew: false,
          original_purchase_at: grantedAt,
          source: 'app_granted',
          environment: 'production',
          management_url: null,
          verified_at: grantedAt,
          store_user_id: null,
          offering_id: null,
          package_id: null,
          rc_event_at: null,
          rc_event_priority: null,
          rc_event_id: null,
        }),
      },
      error: null,
    });

    const grant = await startReverseTrialOnServer();
    expect(mocks.invoke).toHaveBeenCalledWith('subscription-grants', {
      body: { action: 'start_reverse_trial' },
      signal: expect.any(AbortSignal),
    });
    expect(grant).toMatchObject({
      source: 'app_granted',
      store: 'app_granted',
      productId: null,
      isActive: true,
      grantedAt,
    });
    expect(JSON.parse(mocks.storage.get(KEY)!)).toMatchObject({ version: 2, ownerBinding: A });
  });

  it('explicit reset removes both entitlement cache keys', async () => {
    await mergeAppGrant();
    mocks.storage.set(LEGACY_KEY, 'legacy');
    await clearEntitlement();
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.storage.has(LEGACY_KEY)).toBe(false);
  });
});
