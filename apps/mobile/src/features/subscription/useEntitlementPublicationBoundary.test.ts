import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import type { MutationObserver, MutationObserverOptions } from '@tanstack/query-core';

import type { StoreTransactionNativeCall } from '@/lib/iap/storeTransactionNotice';
import type { StoredEntitlement, SubscriptionState } from './entitlement';
import type { EntitlementActionResult } from './useEntitlement';

const OWNER = 'a'.repeat(64);
const KEY = 'layerwell.entitlement.v2';
const NOW = '2026-10-07T12:00:00.000Z';
const PROVIDER_AT = '2026-10-07T11:00:00.000Z';
const EXPIRY = '2026-11-07T12:00:00.000Z';
type Verification = 'VERIFIED' | 'VERIFIED_ON_DEVICE';
type NativeAction = 'startTrial' | 'purchasePlan' | 'purchase' | 'restore' | 'winback';
type Observer = MutationObserver<EntitlementActionResult, Error, unknown, unknown>;
const ACTIONS: readonly NativeAction[] = ['startTrial', 'purchasePlan', 'purchase', 'restore', 'winback'];
const VERIFICATIONS: readonly Verification[] = ['VERIFIED', 'VERIFIED_ON_DEVICE'];

const ports = vi.hoisted(() => ({
  privateStorage: new Map<string, string>(), journalStorage: new Map<string, string>(),
  mutationTails: new Map<string, Promise<void>>(), ownerBinding: 'a'.repeat(64),
  queryFn: null as (() => Promise<SubscriptionState>) | null,
  observer: null as Observer | null,
  consumer: 'promise' as 'promise' | 'callbacks',
  rpc: vi.fn(), invoke: vi.fn(), track: vi.fn(),
  setQueryData: vi.fn(), cancelQueries: vi.fn(), invalidateQueries: vi.fn(),
  scheduleReminder: vi.fn(), cancelReminder: vi.fn(),
  assertRcCurrent: vi.fn(), runRcWrite: vi.fn(),
  purchasePackage: vi.fn(), purchaseWinBackPackage: vi.fn(), restorePurchases: vi.fn(),
  parsedEntitlement: null as StoredEntitlement | null,
  afterNativeStart: null as (() => Promise<void>) | null,
  nativeCalls: 0,
  ownerReadHook: null as null | (() => Promise<void> | null),
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
      // React's production hook subscribes while mounted. This controlled
      // registration supplies only that subscription for mutate callbacks;
      // promise-only cases deliberately have no subscriber at all.
      if (ports.consumer === 'callbacks') observer.subscribe(() => undefined);
      return {
        get data() { return observer.getCurrentResult().data; },
        get isPending() { return observer.getCurrentResult().isPending; },
        mutate: (variables?: unknown, callbacks?: Parameters<Observer['mutate']>[1]) => {
          ports.observer = observer;
          void observer.mutate(variables, callbacks).catch(() => undefined);
        },
        mutateAsync: (variables?: unknown, callbacks?: Parameters<Observer['mutate']>[1]) => {
          ports.observer = observer;
          return observer.mutate(variables, callbacks);
        },
      };
    },
  };
});
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'account-a' } }) }));
vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: async () => 'a'.repeat(64),
  readLocalDataOwnerProofBinding: async () => {
    const pending = ports.ownerReadHook?.(); if (pending) await pending;
    return ports.ownerBinding;
  },
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

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date(NOW));
  ports.privateStorage.clear(); ports.journalStorage.clear(); ports.mutationTails.clear();
  ports.ownerBinding = OWNER; ports.queryFn = null; ports.observer = null; ports.consumer = 'promise';
  ports.ownerReadHook = null;
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
  if (process.env.R6_BOUNDARY_OBSERVATIONS) writeFileSync(process.env.R6_BOUNDARY_OBSERVATIONS,
    JSON.stringify({ source: process.env.R6_REPOSITORY,
      fidelity: 'Actual locked Query Core MutationObserver and actual subscription/account/journal JavaScript; controlled React registration, native RevenueCat/preflight/parser, owner/fence, query-invalidation, reminders and private-KV/AsyncStorage I/O; no mounted React, physical SDK/encryption or process-kill claim.',
      observations }, null, 2) + '\n');
});



type ActionName = NativeAction | 'downgrade' | 'startReverseTrial';
type Outcome = { outcome: 'resolved'; value: EntitlementActionResult } | { outcome: 'rejected'; error: string };
type Schedule = 'negative-before' | 'concurrent' | 'negative-after';
type Consumer = 'observer' | 'no-subscriber' | 'callbacks';

function launch(name: ActionName, consumer: Consumer) {
  ports.consumer = consumer === 'callbacks' ? 'callbacks' : 'promise';
  const actions = hook.useEntitlementActions();
  const selected = actions[name];
  const callbacks: Record<string, unknown>[] = [];
  let pending: Promise<Outcome>;
  if (consumer === 'callbacks') {
    pending = new Promise<Outcome>((resolve) => {
      const options = {
        onSuccess: (value: EntitlementActionResult) => {
          callbacks.push({ event: 'onSuccess', active: value.active, accessStatus: value.accessStatus });
          resolve({ outcome: 'resolved', value });
        },
        onError: (error: Error) => {
          callbacks.push({ event: 'onError', error: error.message });
          resolve({ outcome: 'rejected', error: String(error) });
        },
        onSettled: (value: EntitlementActionResult | undefined, error: Error | null) => {
          callbacks.push({ event: 'onSettled', active: value?.active === true, error: error?.message ?? null });
        },
      };
      if (name === 'purchasePlan') actions.purchasePlan.mutate('monthly', options);
      else selected.mutate(undefined as never, options);
    });
  } else {
    const promise = name === 'purchasePlan'
      ? actions.purchasePlan.mutateAsync('monthly')
      : selected.mutateAsync(undefined as never);
    pending = promise.then((value) => ({ outcome: 'resolved' as const, value }),
      (error: unknown) => ({ outcome: 'rejected' as const, error: String(error) }));
  }
  return { pending, callbacks };
}

async function exerciseFinalBoundary(name: ActionName, verification: Verification,
  schedule: Schedule, consumer: Consumer) {
  const native = name !== 'downgrade' && name !== 'startReverseTrial';
  const periodType = name === 'startTrial' ? 'trial' : 'normal';
  await bindRealProviderTicket();
  respond(wire(EXPIRY, periodType)); expect((await query()).isPro).toBe(true);
  configureNativeResult(verification, EXPIRY, periodType);
  const invalidation = gate();
  ports.invalidateQueries.mockImplementationOnce(async () => {
    invalidation.markEntered(); await invalidation.wait;
  });
  const operation = launch(name, consumer);
  await Promise.race([invalidation.entered, operation.pending.then((value) => {
    throw new Error('Action completed before held onSettled: ' + JSON.stringify(value));
  })]);
  const observer = ports.observer!;
  expect(observer.getCurrentResult().status).toBe('pending');
  expect(await journal.readStoreTransactionNotice('account-a')).toBeNull();
  const journalBytes = Object.fromEntries(ports.journalStorage);
  expect(ports.nativeCalls).toBe(native ? 1 : 0);
  if (native) expect(periodType === 'trial' ? ports.scheduleReminder : ports.cancelReminder).toHaveBeenCalledTimes(1);
  const read = await store.readEntitlementSnapshot(context(), NOW);
  if (read.status !== 'available') throw new Error('Expected current paid snapshot');
  const captured = read.snapshot;
  expect(() => store.assertEntitlementSnapshotCurrent(captured)).not.toThrow();
  const publications: Record<string, unknown>[] = [];
  const unsubscribe = consumer === 'observer' ? observer.subscribe((current) => {
    if (current.status !== 'success' && current.status !== 'error') return;
    let currentAuthority = true;
    try { store.assertEntitlementSnapshotCurrent(captured); } catch { currentAuthority = false; }
    // Read the actual data object held by Core, before the caller wrapper can
    // deliver or reject its promise. Never substitute a facade for this check.
    publications.push({ status: current.status, active: current.data?.active === true,
      accessStatus: current.data?.accessStatus ?? null, currentAuthority,
      durableProtocolRejected: envelope().store.serverProtocolRejected });
  }) : () => undefined;
  const ownerProof = gate();
  let ownerReads = 0;
  ports.ownerReadHook = () => {
    ownerReads += 1;
    if (ownerReads === 4) { ownerProof.markEntered(); return ownerProof.wait; }
    return null;
  };
  const bad = wire(EXPIRY, periodType); Reflect.deleteProperty(bad.store_projection.row.cursor, 'revision');
  respond(bad);
  const negativePending = query();
  await ownerProof.entered;
  ports.ownerReadHook = null;
  expect(ownerReads).toBe(4);
  expect(envelope().store.serverProtocolRejected).toBe(false);
  expect(() => store.assertEntitlementSnapshotCurrent(captured)).not.toThrow();
  let completedWhileCurrent = false;
  if (schedule === 'negative-before') {
    ownerProof.release(); expect((await negativePending).isPro).toBe(false);
    invalidation.release();
  } else if (schedule === 'concurrent') {
    // Resume only the two existing I/O promises, in the exact demonstrated
    // order. No mutation options or framework callbacks are decorated.
    invalidation.release(); ownerProof.release();
  } else {
    invalidation.release();
    const early = await operation.pending;
    expect(early.outcome).toBe('resolved');
    if (early.outcome !== 'resolved') throw new Error(early.error);
    expect(early.value.active).toBe(true);
    expect(observer.getCurrentResult().data?.active).toBe(true);
    expect(() => store.assertEntitlementSnapshotCurrent(captured)).not.toThrow();
    completedWhileCurrent = true;
    ownerProof.release();
  }
  const outcome = await operation.pending;
  const rawTerminal = observer.getCurrentResult();
  expect((await negativePending).isPro).toBe(false);
  expect(envelope().store.serverProtocolRejected).toBe(true);
  expect(await journal.readStoreTransactionNotice('account-a')).toBeNull();
  expect(Object.fromEntries(ports.journalStorage)).toEqual(journalBytes);
  const rawCurrentAccess = rawTerminal.data?.active === true;
  const rawCurrentStatus = rawTerminal.data?.accessStatus ?? null;
  if (schedule !== 'negative-after') {
    expect.soft(outcome.outcome, 'Invalid current access must reach the actual caller error path').toBe('rejected');
    expect.soft(rawCurrentAccess, 'The actual Core-held mutation data cannot retain paid access').toBe(false);
    if (rawTerminal.data) expect.soft(rawCurrentStatus).toBe('unavailable');
    if (consumer === 'callbacks') {
      expect.soft(operation.callbacks.filter((event) => event.event === 'onSuccess')).toHaveLength(0);
      expect.soft(operation.callbacks.filter((event) => event.event === 'onError')).toHaveLength(1);
      const settled = operation.callbacks.filter((event) => event.event === 'onSettled');
      expect.soft(settled).toHaveLength(1);
      expect.soft(settled[0]?.active).toBe(false);
      expect.soft(typeof settled[0]?.error).toBe('string');
    }
  } else {
    expect(outcome.outcome, 'A valid action completed before rejection remains completed').toBe('resolved');
    expect(completedWhileCurrent).toBe(true);
    if (consumer === 'callbacks') {
      expect(operation.callbacks.filter((event) => event.event === 'onSuccess')).toMatchObject([
        { event: 'onSuccess', active: true },
      ]);
      expect(operation.callbacks.filter((event) => event.event === 'onSuccess')).toHaveLength(1);
      expect(operation.callbacks.filter((event) => event.event === 'onError')).toHaveLength(0);
    }
  }
  for (const publication of publications) {
    expect.soft(publication.active === true && publication.currentAuthority === false,
      'No observer can receive paid data after observed epoch retirement').toBe(false);
  }
  unsubscribe();
  const current = await store.readEntitlementSnapshot(context(), NOW);
  expect(current.status === 'available' && client.stateFromEntitlementSnapshot(current.snapshot).isPro).toBe(false);
  const bytes = Object.fromEntries(ports.privateStorage);
  const providerFacts = structuredClone(envelope().store.serverProjection);
  vi.resetModules(); await loadModules();
  expect(Object.fromEntries(ports.privateStorage)).toEqual(bytes);
  expect(Object.fromEntries(ports.journalStorage)).toEqual(journalBytes);
  const cold = await store.readEntitlementSnapshot(context(), NOW);
  expect(cold.status === 'available' && client.stateFromEntitlementSnapshot(cold.snapshot).isPro).toBe(false);
  respond(wire(EXPIRY, periodType)); expect((await query()).isPro).toBe(true);
  expect(envelope().store.serverProtocolRejected).toBe(false);
  expect(envelope().store.serverProjection).toEqual(providerFacts);
  expect(Object.fromEntries(ports.journalStorage)).toEqual(journalBytes);
  observations.push({ boundary: 'final-Core-publication-and-consumption', name, verification, schedule, consumer,
    periodType, ownerReads, nativeCalls: ports.nativeCalls, outcome: outcome.outcome,
    completedWhileCurrent, rawMutationStatus: rawTerminal.status, rawCurrentAccess, rawCurrentStatus,
    callbacks: operation.callbacks, publications, journalTruthRetained: true,
    exactNegativeBytesRetained: true, currentAndReloadDenied: true, genuineEqualRevisionRecovery: true });
}

describe('R6 actual final Core publication and actual caller consumption', () => {
  for (const name of ACTIONS) for (const verification of VERIFICATIONS)
    for (const schedule of ['negative-before', 'concurrent', 'negative-after'] as const)
      for (const consumer of ['observer', 'no-subscriber', 'callbacks'] as const) {
        it(`${name}/${verification}/${schedule}/${consumer}`, async () => {
          await exerciseFinalBoundary(name, verification, schedule, consumer);
        });
      }

  for (const schedule of ['negative-before', 'concurrent', 'negative-after'] as const)
    for (const consumer of ['no-subscriber', 'callbacks'] as const) {
      it(`downgrade/${schedule}/${consumer}: sibling retained paid result`, async () => {
        await exerciseFinalBoundary('downgrade', 'VERIFIED', schedule, consumer);
      });
    }

  it('startReverseTrial preserves its disabled release gate and ordinary error invalidation', async () => {
    const outcome = await launch('startReverseTrial', 'no-subscriber').pending;
    expect(outcome.outcome).toBe('rejected');
    if (outcome.outcome === 'rejected') expect(outcome.error).toContain('CUSTOM_PRO_GRANT_DISABLED');
    expect(ports.nativeCalls).toBe(0);
    expect(ports.invoke).not.toHaveBeenCalled();
    expect(ports.invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
