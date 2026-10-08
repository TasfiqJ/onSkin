import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SubscriptionState } from './entitlement';
import type { EntitlementSnapshotRead } from './store';
import { useEntitlement } from './useEntitlement';

const NOW = '2026-10-07T12:00:00.000Z';
const OWNER = 'a'.repeat(64);
const mocks = vi.hoisted(() => ({
  local: null as EntitlementSnapshotRead | null,
  queryFn: null as (() => Promise<SubscriptionState>) | null,
  server: vi.fn(), read: vi.fn(), merge: vi.fn(),
  ownerChanged: false,
}));

vi.mock('react', () => ({
  useEffect: vi.fn(),
  useState: (initial: unknown) => [typeof initial === 'function'
    ? Date.parse('2026-10-07T12:00:00.000Z')
    : { userId: 'account-a', status: 'ready', context: { ownerBinding: 'a'.repeat(64) }, error: null }, vi.fn()],
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: () => Promise<SubscriptionState> }) => {
    mocks.queryFn = options.queryFn;
    return { refetch: vi.fn(), data: undefined };
  },
  useQueryClient: vi.fn(), useMutation: vi.fn(),
}));
vi.mock('@/lib/env', () => ({ env: { appEnvironment: 'production' } }));
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'account-a' } }) }));
vi.mock('@/lib/auth/accountGeneration', () => ({
  runAccountGenerationOperation: async (operation: (lease: unknown) => Promise<unknown>) => operation({
    signal: new AbortController().signal,
    assertCurrent: () => { if (mocks.ownerChanged) throw new Error('ACCOUNT_GENERATION_CHANGED'); },
  }),
}));
vi.mock('@/features/notifications/deliver', () => ({ cancelTrialReminder: vi.fn(), scheduleTrialReminder: vi.fn() }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/iap/revenuecat', () => ({
  assertRevenueCatResultCurrent: vi.fn(), customerInfoToStoredEntitlement: vi.fn(),
  purchasePackage: vi.fn(), purchaseWinBackPackage: vi.fn(), restorePurchases: vi.fn(),
  runRevenueCatResultWrite: vi.fn(),
}));
vi.mock('@/lib/iap/storeTransactionNotice', () => ({ runOwnedStoreTransaction: vi.fn() }));
vi.mock('./store', () => ({
  ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED: 'ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED',
  assertEntitlementSnapshotCurrent: vi.fn(),
  downgradeToFree: vi.fn(), entitlementOwnerContextForUser: vi.fn(),
  fetchServerEvidence: mocks.server, readEntitlementSnapshot: mocks.read,
  mergeEntitlementEvidenceBatch: mocks.merge, isDurablyAdmissibleStoreResult: vi.fn(),
  publishCustomerInfoEvidence: vi.fn(), startReverseTrialOnServer: vi.fn(),
}));

function snapshot(isActive: boolean): EntitlementSnapshotRead {
  const entitlement = {
    tier: 'pro' as const, isActive, periodType: 'normal' as const, store: 'app_store' as const,
    productId: 'layerwell_pro_monthly', expiresAt: '2026-11-07T12:00:00.000Z',
    willRenew: false, grantedAt: '2026-10-01T12:00:00.000Z', source: 'revenuecat' as const,
    verifiedAt: '2026-10-07T11:00:00.000Z',
  };
  return { status: 'available', snapshot: {
    ownerBinding: OWNER, revision: isActive ? 1 : 2, entitlement,
    activeStoreEntitlement: isActive ? entitlement : null,
    activeAppGrantEntitlement: null, priorEntitlement: { ...entitlement, isActive: false },
    effectiveNowISO: NOW, hasConflict: false, requiresUncachedRefresh: false,
  } };
}

function QueryHarness() {
  useEntitlement();
  if (!mocks.queryFn) throw new Error('Actual query callback was not captured');
  return mocks.queryFn();
}

describe('actual useEntitlement publication query adapter', () => {
  beforeEach(() => {
    mocks.local = snapshot(true);
    mocks.ownerChanged = false;
    mocks.server.mockReset();
    mocks.read.mockReset().mockImplementation(async () => mocks.local);
    mocks.merge.mockReset();
  });

  it('a delayed transport failure cannot publish the paid snapshot captured before a revocation', async () => {
    let release!: () => void;
    let started!: () => void;
    const began = new Promise<void>((resolve) => { started = resolve; });
    mocks.server.mockImplementation(async () => {
      started();
      await new Promise<void>((resolve) => { release = resolve; });
      return { status: 'transport_error', reason: 'offline' };
    });
    const pending = QueryHarness();
    await began;
    mocks.local = snapshot(false);
    release();
    expect(await pending).toMatchObject({ isPro: false });
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });

  it('an observed server correction whose atomic cache write fails cannot return prior cached Pro', async () => {
    mocks.server.mockResolvedValue({ status: 'evidence', evidence: ['authenticated-revocation'] });
    mocks.merge.mockResolvedValue({ status: 'blocked', snapshot: null, reason: 'PRIVATE_KV_WRITE_FAILED' });
    expect(await QueryHarness()).toMatchObject({ isPro: false, evidenceStatus: 'unavailable' });
    expect(mocks.merge).toHaveBeenCalledWith({ ownerBinding: OWNER }, ['authenticated-revocation']);
  });

  it('an invalid publication version closes access even when useful older cache bytes remain', async () => {
    mocks.server.mockResolvedValue({ status: 'rejected', reason: 'server_projection_invalid' });
    expect(await QueryHarness()).toMatchObject({ isPro: false, evidenceStatus: 'unavailable' });
  });

  it('an ordinary offline response still admits current finite cached proof', async () => {
    mocks.server.mockResolvedValue({ status: 'transport_error', reason: 'offline' });
    expect(await QueryHarness()).toMatchObject({ isPro: true, evidenceStatus: 'reconciliation_due' });
  });

  it('an owner boundary during the request prevents cache fallback or publication', async () => {
    mocks.server.mockImplementation(async () => {
      mocks.ownerChanged = true;
      return { status: 'transport_error', reason: 'offline' };
    });
    await expect(QueryHarness()).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
    expect(mocks.merge).not.toHaveBeenCalled();
  });
});
