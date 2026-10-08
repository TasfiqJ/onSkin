import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import type { MutationObserver, MutationObserverOptions } from '@tanstack/query-core';

import type { StoreTransactionNativeCall } from '@/lib/iap/storeTransactionNotice';
import type { StoredEntitlement, SubscriptionState } from './entitlement';
import type { EntitlementActionResult } from './useEntitlement';

const OWNER = 'a'.repeat(64);
const KEY = 'layerwell.entitlement.v2';
const JOURNAL = 'layerwell.store_transaction_notice.v2';
const NOW = '2026-10-07T12:00:00.000Z';
const PROVIDER_AT = '2026-10-07T11:00:00.000Z';
const EXPIRY = '2026-11-07T12:00:00.000Z';
type Verification = 'VERIFIED' | 'VERIFIED_ON_DEVICE';
type NativeAction = 'startTrial' | 'purchasePlan' | 'purchase' | 'restore' | 'winback';
type Observer = MutationObserver<EntitlementActionResult, Error, unknown, unknown>;
const ACTIONS: readonly NativeAction[] = ['startTrial', 'purchasePlan', 'purchase', 'restore', 'winback'];
const VERIFICATIONS: readonly Verification[] = ['VERIFIED', 'VERIFIED_ON_DEVICE'];
const SCENARIOS = ['live-control', 'protocol-rejection', 'newer-denial', 'equal-conflict',
  'expired', 'fresh-ticket-control', 'stale-ticket'] as const;
type Scenario = typeof SCENARIOS[number];

const ports = vi.hoisted(() => ({
  privateStorage: new Map<string, string>(), journalStorage: new Map<string, string>(),
  mutationTails: new Map<string, Promise<void>>(), ownerBinding: 'a'.repeat(64),
  queryFn: null as (() => Promise<SubscriptionState>) | null,
  observer: null as Observer | null,
  rpc: vi.fn(), invoke: vi.fn(), track: vi.fn(),
  setQueryData: vi.fn(), cancelQueries: vi.fn(), invalidateQueries: vi.fn(),
  scheduleReminder: vi.fn(), cancelReminder: vi.fn(),
  assertRcCurrent: vi.fn(), runRcWrite: vi.fn(),
  purchasePackage: vi.fn(), purchaseWinBackPackage: vi.fn(), restorePurchases: vi.fn(),
  parsedEntitlement: null as StoredEntitlement | null,
  afterNativeStart: null as (() => Promise<void>) | null,
  nativeCalls: 0,
  beforePrivateWrite: null as null | (() => Promise<void>),
  afterPrivateWrite: null as null | (() => Promise<void>),
}));

// Register the real hook options without mounting React Native. Every mutation
// runs the pinned Query Core observer, including its awaited success/settled
// callbacks, mutation-data publication and mutateAsync resolution.
vi.mock('react', () => ({
  useEffect: vi.fn(),
  useState: (initial: unknown) => [typeof initial === 'function' ? Date.now() : {
    userId: 'account-a', status: 'ready', context: { ownerBinding: ports.ownerBinding }, error: null,
  }, vi.fn()],
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() } }));
vi.mock('@tanstack/react-query', async () => {
  const { MutationObserver: CoreObserver, QueryClient } = await import('@tanstack/query-core');
  const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });
  return {
    useQuery: (options: { queryFn: () => Promise<SubscriptionState> }) => {
      ports.queryFn = options.queryFn;
      return { refetch: vi.fn(), data: undefined };
    },
    useQueryClient: () => ({ cancelQueries: ports.cancelQueries,
      setQueryData: ports.setQueryData, invalidateQueries: ports.invalidateQueries }),
    useMutation: (options: MutationObserverOptions<EntitlementActionResult, Error, unknown, unknown>) => {
      const observer = new CoreObserver(queryClient, options);
      return { mutateAsync: (variables?: unknown) => {
        ports.observer = observer;
        return observer.mutate(variables);
      } };
    },
  };
});
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'account-a' } }) }));
vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: async () => 'a'.repeat(64),
  readLocalDataOwnerProofBinding: async () => ports.ownerBinding,
}));
vi.mock('@/lib/auth/accountPublicationFence', () => ({
  createAccountPublicationCapability: async () => 'b'.repeat(64),
  exchangeAccountPublicationFence: async () => 'active',
}));
vi.mock('@/lib/env', () => ({
  env: { appEnvironment: 'production', revenueCatEntitlementId: 'pro', customProGrantEnabled: false },
  isSupabaseConfigured: true,
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: { rpc: ports.rpc, functions: { invoke: ports.invoke } } }));
// The real serialized evidence updater and codec run over plaintext I/O ports.
// Physical encryption/private-KV execution belongs to its separate regressions.
vi.mock('@/lib/storage/privateKV', () => ({
  PRIVATE_KV_DECRYPTION_FAILED: 'PRIVATE_KV_DECRYPTION_FAILED',
  PRIVATE_KV_ENVELOPE_INVALID: 'PRIVATE_KV_ENVELOPE_INVALID',
  PRIVATE_KV_ENVELOPE_UNSUPPORTED: 'PRIVATE_KV_ENVELOPE_UNSUPPORTED',
  getPrivateItem: async (key: string) => ports.privateStorage.get(key) ?? null,
  multiRemovePrivateItems: async (keys: readonly string[]) => {
    for (const key of keys) ports.privateStorage.delete(key);
  },
  updatePrivateItem: (key: string, updater: (raw: string | null) => string | null,
    assertAdditionalMutationCurrent?: () => void) => {
    const previous = ports.mutationTails.get(key) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const current = ports.privateStorage.get(key) ?? null;
      assertAdditionalMutationCurrent?.();
      const next = updater(current);
      assertAdditionalMutationCurrent?.();
      if (next === current) return;
      const beforeWrite = ports.beforePrivateWrite; ports.beforePrivateWrite = null;
      await beforeWrite?.();
      if (next === null) ports.privateStorage.delete(key); else ports.privateStorage.set(key, next);
      try {
        const afterWrite = ports.afterPrivateWrite; ports.afterPrivateWrite = null;
        await afterWrite?.();
        assertAdditionalMutationCurrent?.();
      } catch (error) {
        if (current === null) ports.privateStorage.delete(key); else ports.privateStorage.set(key, current);
        throw error;
      }
    });
    const settled = operation.then(() => undefined, () => undefined);
    ports.mutationTails.set(key, settled);
    void settled.finally(() => {
      if (ports.mutationTails.get(key) === settled) ports.mutationTails.delete(key);
    });
    return operation;
  },
}));
// The actual storeTransactionNotice write-ahead/resolution implementation runs;
// only its native AsyncStorage boundary is controlled.
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => ports.journalStorage.get(key) ?? null,
  setItem: async (key: string, raw: string) => { ports.journalStorage.set(key, raw); },
} }));
vi.mock('@/features/notifications/deliver', () => ({
  cancelTrialReminder: ports.cancelReminder, scheduleTrialReminder: ports.scheduleReminder,
}));
vi.mock('@/lib/analytics/track', () => ({ track: ports.track }));
vi.mock('@/lib/iap/revenuecat', () => ({
  assertRevenueCatResultCurrent: ports.assertRcCurrent,
  customerInfoToStoredEntitlement: () => ports.parsedEntitlement,
  purchasePackage: ports.purchasePackage, purchaseWinBackPackage: ports.purchaseWinBackPackage,
  restorePurchases: ports.restorePurchases, runRevenueCatResultWrite: ports.runRcWrite,
  isRevenueCatCancellationAmbiguous: () => false,
  isRevenueCatPaymentPendingError: () => false,
  revenueCatUnconfirmedStoreMessage: () => null,
}));

let store: typeof import('@/features/subscription/store');
let hook: typeof import('@/features/subscription/useEntitlement');
let account: typeof import('@/lib/auth/accountGeneration');
let client: typeof import('@/features/subscription/clientEntitlement');
let journal: typeof import('@/lib/iap/storeTransactionNotice');
const observations: Record<string, unknown>[] = [];
const context = () => ({ ownerBinding: ports.ownerBinding });
const at = (elapsed: number) => new Date(Date.parse(NOW) + elapsed).toISOString();
const envelope = () => JSON.parse(ports.privateStorage.get(KEY)!);

function gate() {
  let entered!: () => void;
  let release!: () => void;
  return { entered: new Promise<void>((resolve) => { entered = resolve; }),
    wait: new Promise<void>((resolve) => { release = resolve; }),
    markEntered: () => entered(), release: () => release() };
}

function wire(expiry = EXPIRY, periodType: 'normal' | 'trial' = 'normal') {
  return { schema_version: 2, store_projection: { state: 'active', row: {
    tier: 'pro', is_active: true, product_id: 'layerwell_pro_monthly', expires_at: expiry,
    store: 'app_store', period_type: periodType, will_renew: false,
    granted_at: '2026-10-01T12:00:00.000Z', source: 'revenuecat', environment: 'production',
    management_url: null, verified_at: PROVIDER_AT, offering_id: null, package_id: null,
    cursor: { kind: 'server_projection', version: 1,
      stream_id: '11111111-1111-4111-8111-111111111111', revision: '60',
      provider: { kind: 'rc_webhook', at: PROVIDER_AT, priority: 60, event_id: 'publication-provider-event' } },
  } }, app_grant_projection: { state: 'absent', row: null } };
}

function respond(data: unknown) {
  ports.rpc.mockImplementationOnce(() => ({ abortSignal: async () => ({ data, error: null }) }));
}

async function loadModules() {
  store = await import('@/features/subscription/store'); hook = await import('@/features/subscription/useEntitlement');
  account = await import('@/lib/auth/accountGeneration'); client = await import('@/features/subscription/clientEntitlement');
  journal = await import('@/lib/iap/storeTransactionNotice');
}

async function query() {
  hook.useEntitlement();
  if (!ports.queryFn) throw new Error('Actual subscription query was not registered');
  return ports.queryFn();
}

function sdkInput(verification: Verification, expiry = EXPIRY, periodType: 'normal' | 'trial' = 'normal') {
  const entitlement: StoredEntitlement = {
    tier: 'pro', isActive: true, periodType, store: 'app_store', productId: 'layerwell_pro_monthly',
    expiresAt: expiry, willRenew: false, grantedAt: '2026-10-01T12:00:00.000Z',
    source: 'revenuecat', environment: 'production', verifiedAt: NOW, managementUrl: null,
    offeringId: null, packageId: null,
  };
  const customerInfo = { requestDate: NOW, entitlements: { verification,
    active: { pro: { verification, isActive: true, productIdentifier: 'layerwell_pro_monthly' } }, all: {} },
  } as unknown as Parameters<typeof store.customerInfoToEvidence>[0];
  return { customerInfo, entitlement };
}

function configureNativeResult(verification: Verification, expiry: string, periodType: 'normal' | 'trial') {
  const sdk = sdkInput(verification, expiry, periodType);
  ports.parsedEntitlement = sdk.entitlement;
  const nativeResult = async (nativeCall: StoreTransactionNativeCall) => {
    await nativeCall.beforeNativeStoreCall();
    nativeCall.markNativeCallStarted();
    ports.nativeCalls += 1;
    await ports.afterNativeStart?.();
    return { customerInfo: sdk.customerInfo, productId: sdk.entitlement.productId };
  };
  ports.purchasePackage.mockImplementation((_plan: unknown, _owner: unknown, nativeCall: StoreTransactionNativeCall) => nativeResult(nativeCall));
  ports.restorePurchases.mockImplementation((_owner: unknown, nativeCall: StoreTransactionNativeCall) => nativeResult(nativeCall));
  ports.purchaseWinBackPackage.mockImplementation((_owner: unknown, nativeCall: StoreTransactionNativeCall) => nativeResult(nativeCall));
}

function action(name: NativeAction) {
  const actions = hook.useEntitlementActions();
  const pending = name === 'purchasePlan' ? actions.purchasePlan.mutateAsync('monthly') : actions[name].mutateAsync();
  return pending.then((value) => ({ outcome: 'resolved' as const, value }),
    (error: unknown) => ({ outcome: 'rejected' as const, error: String(error) }));
}

async function bindRealProviderTicket() {
  const { AccountPublicationController } = await import('@/lib/auth/accountPublicationController');
  const controller = new AccountPublicationController({
    createCapability: async () => 'b'.repeat(64),
    exchange: async (operation) => operation === 'publication_reserve' ? 'reserved' :
      operation === 'publication_release' ? 'released' : 'active',
    isAccountActivityBlocked: () => false,
    now: Date.now, monotonicNow: () => Date.now() - Date.parse(NOW),
    resetProviderIdentity: async () => undefined,
  });
  const binding = { subject: 'account-a', sessionId: 'session-a', accessToken: 'controlled-session-token' };
  await controller.reserve(binding);
  const ticket = await controller.activate(binding);
  const generation = account.captureAccountIdentityGeneration();
  ports.assertRcCurrent.mockImplementation(() => {
    account.assertAccountIdentityGeneration(generation);
    if (ports.ownerBinding !== OWNER) throw new Error('STALE_PROVIDER_OWNER');
    ticket.assertCurrent();
  });
  return ticket;
}

async function acceptInvalidation(scenario: Scenario, expiry: string, periodType: 'normal' | 'trial') {
  const negative = wire(expiry, periodType);
  if (scenario === 'protocol-rejection') {
    Reflect.deleteProperty(negative.store_projection.row.cursor, 'revision');
  } else {
    negative.store_projection.state = 'inactive';
    negative.store_projection.row.is_active = false;
    if (scenario === 'newer-denial') {
      negative.store_projection.row.cursor.revision = '61';
      negative.store_projection.row.cursor.provider.at = at(100);
      negative.store_projection.row.verified_at = at(100);
    }
  }
  vi.setSystemTime(new Date(at(200)));
  respond(negative); expect((await query()).isPro).toBe(false);
  expect(envelope().store.serverProtocolRejected).toBe(scenario === 'protocol-rejection');
  expect(envelope().store.serverConflict !== null).toBe(scenario === 'equal-conflict');
  return ports.privateStorage.get(KEY)!;
}

async function verifyRecovery(scenario: Scenario, bytes: string, expiry: string, periodType: 'normal' | 'trial') {
  expect(ports.privateStorage.get(KEY), 'Exact accepted negative/conflict bytes survive the old action').toBe(bytes);
  const retained = structuredClone(envelope().store);
  const current = await store.readEntitlementSnapshot(context(), new Date().toISOString());
  expect(current.status === 'available' && client.stateFromEntitlementSnapshot(current.snapshot).isPro).toBe(false);
  const privateBytes = Object.fromEntries(ports.privateStorage);
  const journalBytes = Object.fromEntries(ports.journalStorage);
  vi.resetModules(); await loadModules();
  expect(Object.fromEntries(ports.privateStorage)).toEqual(privateBytes);
  expect(Object.fromEntries(ports.journalStorage)).toEqual(journalBytes);
  const cold = await store.readEntitlementSnapshot(context(), new Date().toISOString());
  expect(cold.status === 'available' && client.stateFromEntitlementSnapshot(cold.snapshot).isPro).toBe(false);
  const recovery = wire(expiry, periodType);
  if (scenario !== 'protocol-rejection') {
    recovery.store_projection.row.cursor.revision = scenario === 'newer-denial' ? '62' : '61';
    recovery.store_projection.row.cursor.provider.at = at(300);
    recovery.store_projection.row.verified_at = at(300);
  }
  vi.setSystemTime(new Date(at(400)));
  respond(recovery); expect((await query()).isPro).toBe(true);
  expect(envelope().store.serverProtocolRejected).toBe(false);
  expect(envelope().store.serverConflict).toBeNull();
  expect(envelope().store.serverProjection.cursor.revision).toBe(recovery.store_projection.row.cursor.revision);
  expect(envelope().store.serverProjection.entitlement.verifiedAt).toBe(recovery.store_projection.row.verified_at);
  expect(envelope().store.serverProjection.entitlement.expiresAt).toBe(expiry);
  return { retainedBytes: bytes, retainedStore: retained, currentReadPaid: false, coldReadPaid: false,
    recoveredStore: structuredClone(envelope().store), freshRecoveryPaid: true };
}

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date(NOW));
  ports.privateStorage.clear(); ports.journalStorage.clear(); ports.mutationTails.clear();
  ports.ownerBinding = OWNER; ports.queryFn = null; ports.observer = null;
  ports.nativeCalls = 0; ports.afterNativeStart = null; ports.parsedEntitlement = null;
  ports.beforePrivateWrite = null; ports.afterPrivateWrite = null;
  ports.rpc.mockReset(); ports.invoke.mockReset(); ports.track.mockReset();
  ports.setQueryData.mockReset(); ports.cancelQueries.mockReset().mockResolvedValue(undefined);
  ports.invalidateQueries.mockReset().mockResolvedValue(undefined);
  ports.scheduleReminder.mockReset().mockResolvedValue(undefined);
  ports.cancelReminder.mockReset().mockResolvedValue(undefined);
  ports.purchasePackage.mockReset(); ports.purchaseWinBackPackage.mockReset(); ports.restorePurchases.mockReset();
  await loadModules();
  ports.assertRcCurrent.mockReset();
  ports.runRcWrite.mockReset().mockImplementation(async (_input: unknown, operation: () => Promise<unknown>) =>
    account.runAccountGenerationOperation(async (lease) => {
      lease.assertCurrent(); ports.assertRcCurrent();
      const value = await operation();
      lease.assertCurrent(); ports.assertRcCurrent();
      return value;
    }));
});
afterEach(() => vi.useRealTimers());
afterAll(() => {
  if (process.env.R5_CALLER_OBSERVATIONS) writeFileSync(process.env.R5_CALLER_OBSERVATIONS,
    JSON.stringify({ source: process.env.R5_REPOSITORY,
      fidelity: 'Actual locked Query Core MutationObserver and actual subscription/account/journal JavaScript; controlled React registration, native RevenueCat/preflight/parser, owner/fence, query-invalidation, reminders and private-KV/AsyncStorage I/O; no mounted React, physical SDK/encryption or process-kill claim.',
      observations }, null, 2) + '\n');
});

describe('R5 current paid access through the actual mutation lifecycle', () => {
  for (const name of ACTIONS) for (const verification of VERIFICATIONS) for (const scenario of SCENARIOS) {
    it(`${name}/${verification}: ${scenario} across awaited onSettled`, async () => {
      const ticket = await bindRealProviderTicket();
      const periodType = name === 'startTrial' ? 'trial' : 'normal';
      const expiry = scenario === 'live-control' || scenario === 'expired' ? at(1000) : EXPIRY;
      respond({ ...wire(), store_projection: { state: 'absent', row: null } });
      expect((await query()).isPro, 'Every native action begins from authenticated absence/free').toBe(false);
      // Accept the paid seed only after native admission starts. Purchasing
      // while already paid is not assumed by this controlled preflight port.
      ports.afterNativeStart = async () => {
        expect(ports.nativeCalls).toBe(1);
        respond(wire(expiry, periodType)); expect((await query()).isPro).toBe(true);
      };
      configureNativeResult(verification, expiry, periodType);
      const invalidation = gate();
      ports.invalidateQueries.mockImplementationOnce(async () => {
        invalidation.markEntered(); await invalidation.wait;
      });
      const generation = account.captureAccountIdentityGeneration();
      const pending = action(name);
      await Promise.race([invalidation.entered, pending.then((result) => {
        throw new Error(`Action settled before onSettled: ${JSON.stringify(result)}`);
      })]);
      const observer = ports.observer!;
      expect(observer.getCurrentResult().status).toBe('pending');
      expect(ports.setQueryData).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ isPro: true }));
      expect(await journal.readStoreTransactionNotice('account-a'), 'The real provider journal resolves before onSettled').toBeNull();
      const journalBytes = ports.journalStorage.get(JOURNAL);
      const providerFacts = structuredClone(envelope().store);
      const isNegative = scenario === 'protocol-rejection' || scenario === 'newer-denial' || scenario === 'equal-conflict';
      const negativeBytes = isNegative ? await acceptInvalidation(scenario, expiry, periodType) : null;
      const elapsed = scenario === 'expired' ? 2000 : scenario === 'fresh-ticket-control' ? 29000 :
        scenario === 'stale-ticket' ? 31000 : 500;
      if (!isNegative) vi.setSystemTime(new Date(at(elapsed)));
      if (scenario === 'stale-ticket') expect(() => ticket.assertCurrent()).toThrow();
      else expect(() => ticket.assertCurrent()).not.toThrow();
      invalidation.release();
      const result = await pending;
      const lifecycle = observer.getCurrentResult();
      const returnedActive = result.outcome === 'resolved' && result.value.active;
      const mutationDataActive = lifecycle.data?.active === true;
      expect(ports.invalidateQueries, 'TanStack error settlement does not duplicate completed invalidation').toHaveBeenCalledTimes(1);
      expect(ports.nativeCalls).toBe(1);
      expect(account.captureAccountIdentityGeneration()).toBe(generation);
      expect(await journal.readStoreTransactionNotice('account-a')).toBeNull();
      expect(ports.journalStorage.get(JOURNAL), 'Later access invalidation never reverses a resolved provider journal').toBe(journalBytes);
      const expectedActive = scenario === 'live-control' || scenario === 'fresh-ticket-control';
      let preserved: Record<string, unknown>;
      if (negativeBytes !== null) {
        preserved = await verifyRecovery(scenario, negativeBytes, expiry, periodType);
      } else {
        expect(envelope().store, 'Time passage does not rewrite provider evidence').toEqual(providerFacts);
        const current = await store.readEntitlementSnapshot(context(), new Date().toISOString());
        const localPaid = current.status === 'available' && client.stateFromEntitlementSnapshot(current.snapshot).isPro;
        expect(localPaid).toBe(scenario !== 'expired');
        const beforeReload = Object.fromEntries(ports.privateStorage);
        vi.resetModules(); await loadModules();
        expect(Object.fromEntries(ports.privateStorage)).toEqual(beforeReload);
        const cold = await store.readEntitlementSnapshot(context(), new Date().toISOString());
        const coldPaid = cold.status === 'available' && client.stateFromEntitlementSnapshot(cold.snapshot).isPro;
        expect(coldPaid).toBe(localPaid);
        expect(envelope().store).toEqual(providerFacts);
        preserved = { localPaid, coldPaid, retainedProviderFacts: providerFacts };
      }
      observations.push({ boundary: 'actual-QueryCore-onSettled', action: name, verification, scenario,
        initialServerState: 'absent', activeSeedAfterNativeStart: true, expiry,
        providerTicketCurrent: scenario !== 'stale-ticket', outcome: result.outcome,
        returnedActive, mutationStatus: lifecycle.status, mutationDataActive,
        expectedActive, journalNotice: null, journalBytes, ...preserved });
      expect.soft(mutationDataActive, 'Real mutation data cannot publish stale paid access').toBe(expectedActive);
      expect.soft(returnedActive, 'Actual mutateAsync must remain safe through awaited onSettled').toBe(expectedActive);
    });
  }
});

describe('R5 retained snapshots respect the persisted expiry clock after wall-clock rollback', () => {
  for (const verification of VERIFICATIONS) it(`${verification}: expiry cannot revive a retained snapshot`, async () => {
    const sdk = sdkInput(verification, at(1000));
    const published = await store.publishCustomerInfoEvidence({ context: context(), ...sdk,
      queryClient: { cancelQueries: ports.cancelQueries, setQueryData: ports.setQueryData }, observedAtISO: NOW });
    expect(published.snapshot).not.toBeNull();
    const snapshot = published.snapshot!;
    expect(() => store.assertEntitlementSnapshotCurrent(snapshot), 'Before expiry the exact snapshot remains usable').not.toThrow();
    const facts = structuredClone(envelope().store);
    vi.setSystemTime(new Date(at(2000)));
    const expired = await store.readEntitlementSnapshot(context(), at(2000));
    expect(expired.status === 'available' && client.stateFromEntitlementSnapshot(expired.snapshot).isPro).toBe(false);
    vi.setSystemTime(new Date(at(500)));
    const current = await store.readEntitlementSnapshot(context(), at(500));
    expect(current.status === 'available' && client.stateFromEntitlementSnapshot(current.snapshot).isPro).toBe(false);
    expect(envelope().clockAnchor).toBe(at(2000));
    expect(envelope().store).toEqual(facts);
    let retainedAllowed = true;
    try { store.assertEntitlementSnapshotCurrent(snapshot); } catch { retainedAllowed = false; }
    observations.push({ boundary: 'retained-snapshot-clock-rollback', verification, expiry: at(1000),
      currentWallTime: at(500), persistedClockAnchor: envelope().clockAnchor,
      currentReadPaid: false, retainedAllowed, retainedProviderFacts: facts });
    expect(retainedAllowed, 'A retained paid snapshot cannot revive behind the persisted clock high watermark').toBe(false);
  });
});

async function acceptPublication(revision: string, expiry: string, providerAt: string) {
  const response = wire(expiry);
  response.store_projection.row.cursor.revision = revision;
  response.store_projection.row.cursor.provider.at = providerAt;
  response.store_projection.row.verified_at = providerAt;
  respond(response);
  const evidence = await store.fetchServerEvidence(context(), new AbortController().signal);
  expect(evidence.status).toBe('evidence');
  if (evidence.status !== 'evidence') throw new Error('Expected authenticated evidence');
  return store.mergeEntitlementEvidenceBatch(context(), evidence.evidence, new Date().toISOString());
}

function retainedAllowed(snapshot: Parameters<typeof store.assertEntitlementSnapshotCurrent>[0]) {
  try { store.assertEntitlementSnapshotCurrent(snapshot); return true; }
  catch { return false; }
}

const PROBES = ['before-write-failure', 'ambiguous-write-rollback', 'pending-write-failure',
  'live-short-control', 'fresh-success-control'] as const;

describe('R5 failed positive publication cannot relax durable current admission', () => {
  for (const scenario of PROBES) it(scenario, async () => {
    const original = await acceptPublication('60', EXPIRY, PROVIDER_AT);
    expect(original.status).toBe('committed');
    expect(original.snapshot).not.toBeNull();
    const retained = original.snapshot!;
    expect(retainedAllowed(retained)).toBe(true);

    vi.setSystemTime(new Date(at(100)));
    const shorter = await acceptPublication('61', at(1000), at(100));
    expect(shorter.status).toBe('committed');
    expect(shorter.snapshot).not.toBeNull();
    expect(client.stateFromEntitlementSnapshot(shorter.snapshot!).isPro).toBe(true);
    expect(retainedAllowed(retained)).toBe(true);
    const durableShortBytes = ports.privateStorage.get(KEY)!;
    expect(envelope().store.serverProjection.cursor.revision).toBe('61');
    expect(envelope().store.serverProjection.entitlement.expiresAt).toBe(at(1000));

    const liveControl = scenario === 'live-short-control';
    vi.setSystemTime(new Date(at(liveControl ? 500 : 2000)));
    const currentTime = new Date().toISOString();
    const shortProjectionPaid = client.stateFromEntitlementSnapshot({
      ...shorter.snapshot!, effectiveNowISO: currentTime,
    }).isPro;
    expect(shortProjectionPaid).toBe(liveControl);

    const failure = new Error('CONTROLLED_NATIVE_WRITE_FAILURE');
    const pendingGate = gate();
    if (scenario === 'before-write-failure' || liveControl) ports.beforePrivateWrite = async () => { throw failure; };
    if (scenario === 'ambiguous-write-rollback') ports.afterPrivateWrite = async () => { throw failure; };
    if (scenario === 'pending-write-failure') ports.beforePrivateWrite = async () => {
      pendingGate.markEntered(); await pendingGate.wait; throw failure;
    };
    const pending = acceptPublication('62', EXPIRY, currentTime);
    let allowedDuringPending: boolean | null = null;
    if (scenario === 'pending-write-failure') {
      await pendingGate.entered;
      expect(ports.privateStorage.get(KEY)).toBe(durableShortBytes);
      allowedDuringPending = retainedAllowed(retained);
      pendingGate.release();
    }
    const attempted = await pending;
    const succeeds = scenario === 'fresh-success-control';
    expect(attempted.status).toBe(succeeds ? 'committed' : 'blocked');
    if (!succeeds) {
      expect(attempted.reason).toBe('CONTROLLED_NATIVE_WRITE_FAILURE');
      expect(ports.privateStorage.get(KEY), 'Exact shorter durable cache survives failed positive').toBe(durableShortBytes);
    }
    const durableBeforeAnyRead = ports.privateStorage.get(KEY)!;
    const allowedBeforeAnyCurrentRead = retainedAllowed(retained);
    const actualCurrent = await store.readEntitlementSnapshot(context(), currentTime);
    const currentReadPaid = actualCurrent.status === 'available' && client.stateFromEntitlementSnapshot(actualCurrent.snapshot).isPro;
    expect(currentReadPaid).toBe(liveControl || succeeds);
    const allowedAfterCurrentRead = retainedAllowed(retained);
    observations.push({ boundary: 'accepted-positive-publication-write', scenario, originalRevision: '60', durableShortRevision: '61', attemptedRevision: '62',
      originalExpiry: EXPIRY, durableShortExpiry: at(1000), currentTime,
      shortProjectionPaid, attemptedStatus: attempted.status, attemptedReason: attempted.reason ?? null,
      allowedDuringPending, allowedBeforeAnyCurrentRead, currentReadPaid, allowedAfterCurrentRead,
      exactShortBytesPreserved: !succeeds && durableBeforeAnyRead === durableShortBytes,
      durableShortBytes, durableBeforeAnyRead, expectedRetainedAllowed: liveControl || succeeds });
    if (scenario === 'pending-write-failure') expect.soft(allowedDuringPending,
      'An uncommitted longer positive cannot relax the last durable shorter expiry while native work awaits').toBe(false);
    expect.soft(allowedBeforeAnyCurrentRead,
      'Failed positive evidence cannot make a retained old paid snapshot pass current admission').toBe(liveControl || succeeds);
    expect(allowedAfterCurrentRead).toBe(liveControl || succeeds);
  });
});
