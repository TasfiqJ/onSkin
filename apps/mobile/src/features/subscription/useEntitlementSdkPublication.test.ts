import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';

import type { StoreTransactionNativeCall } from '@/lib/iap/storeTransactionNotice';
import type { StoredEntitlement, SubscriptionState } from './entitlement';
import type { EntitlementActionResult } from './useEntitlement';

const OWNER = 'a'.repeat(64);
const KEY = 'layerwell.entitlement.v2';
const JOURNAL = 'layerwell.store_transaction_notice.v2';
const NOW = '2026-10-07T12:00:00.000Z';
const PROVIDER_AT = '2026-10-07T11:00:00.000Z';
const EXPIRY = '2026-11-07T12:00:00.000Z';
type GatePort = { entered: () => void; wait: Promise<void> };
type Verification = 'VERIFIED' | 'VERIFIED_ON_DEVICE';
type NativeAction = 'startTrial' | 'purchasePlan' | 'purchase' | 'restore' | 'winback';
const ACTIONS: readonly NativeAction[] = ['startTrial', 'purchasePlan', 'purchase', 'restore', 'winback'];
const VERIFICATIONS: readonly Verification[] = ['VERIFIED', 'VERIFIED_ON_DEVICE'];

const ports = vi.hoisted(() => ({
  privateStorage: new Map<string, string>(),
  journalStorage: new Map<string, string>(),
  mutationTails: new Map<string, Promise<void>>(),
  ownerBinding: 'a'.repeat(64),
  queryFn: null as (() => Promise<SubscriptionState>) | null,
  rpc: vi.fn(), invoke: vi.fn(), track: vi.fn(),
  nextOwnerGate: null as GatePort | null,
  nextJournalCompletionGate: null as GatePort | null,
  nextProviderWriteCompletionGate: null as GatePort | null,
  nextPrivateCommitGate: null as GatePort | null,
  onMutationQueued: null as (() => void) | null,
  onTransform: null as (() => void) | null,
  setQueryData: vi.fn(), cancelQueries: vi.fn(), invalidateQueries: vi.fn(),
  scheduleReminder: vi.fn(), cancelReminder: vi.fn(),
  assertRcCurrent: vi.fn(), runRcWrite: vi.fn(),
  purchasePackage: vi.fn(), purchaseWinBackPackage: vi.fn(), restorePurchases: vi.fn(),
  parsedEntitlement: null as StoredEntitlement | null,
  customProGrantEnabled: false,
  nativeCalls: 0,
  journalEvents: [] as { kind: 'write' | 'pending-completion'; raw: string }[],
}));

// These ports register the actual hook callbacks without mounting React Native.
// Subscription/parser/merger/account-generation and the real transaction journal run.
vi.mock('react', () => ({
  useEffect: vi.fn(),
  useState: (initial: unknown) => [typeof initial === 'function' ? Date.now() : {
    userId: 'account-a', status: 'ready', context: { ownerBinding: ports.ownerBinding }, error: null,
  }, vi.fn()],
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: () => Promise<SubscriptionState> }) => {
    ports.queryFn = options.queryFn;
    return { refetch: vi.fn(), data: undefined };
  },
  useQueryClient: () => ({ cancelQueries: ports.cancelQueries,
    setQueryData: ports.setQueryData, invalidateQueries: ports.invalidateQueries }),
  useMutation: (options: { mutationFn: (...args: never[]) => Promise<unknown> }) => ({ mutateAsync: options.mutationFn }),
}));
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'account-a' } }) }));
vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: async () => 'a'.repeat(64),
  readLocalDataOwnerProofBinding: async () => {
    const pending = ports.nextOwnerGate;
    ports.nextOwnerGate = null;
    if (pending) { pending.entered(); await pending.wait; }
    return ports.ownerBinding;
  },
}));
vi.mock('@/lib/env', () => ({
  env: { appEnvironment: 'production', revenueCatEntitlementId: 'pro',
    get customProGrantEnabled() { return ports.customProGrantEnabled; } },
  isSupabaseConfigured: true,
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: { rpc: ports.rpc, functions: { invoke: ports.invoke } } }));
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
    const queued = ports.onMutationQueued;
    ports.onMutationQueued = null;
    queued?.();
    const operation = previous.catch(() => undefined).then(async () => {
      const current = ports.privateStorage.get(key) ?? null;
      assertAdditionalMutationCurrent?.();
      const next = updater(current);
      assertAdditionalMutationCurrent?.();
      ports.onTransform?.();
      if (next === current) return;
      const pending = ports.nextPrivateCommitGate;
      ports.nextPrivateCommitGate = null;
      assertAdditionalMutationCurrent?.();
      if (pending) { pending.entered(); await pending.wait; }
      if (next === null) ports.privateStorage.delete(key); else ports.privateStorage.set(key, next);
      try { assertAdditionalMutationCurrent?.(); } catch (error) {
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
// Only AsyncStorage I/O is controlled. runOwnedStoreTransaction, its write-ahead
// record, verified resolution, read-back and uncertain-outcome paths are real.
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => ports.journalStorage.get(key) ?? null,
  setItem: async (key: string, raw: string) => {
    const envelope = JSON.parse(raw) as { notices: unknown[] };
    const pending = envelope.notices.length === 0 ? ports.nextJournalCompletionGate : null;
    if (pending) {
      ports.nextJournalCompletionGate = null;
      ports.journalEvents.push({ kind: 'pending-completion', raw });
      pending.entered(); await pending.wait;
    }
    ports.journalStorage.set(key, raw);
    ports.journalEvents.push({ kind: 'write', raw });
  },
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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function gate() {
  const entered = deferred();
  const release = deferred();
  return { entered: entered.promise, release: release.resolve,
    port: { entered: entered.resolve, wait: release.promise } };
}

function wire() {
  return {
    schema_version: 2,
    store_projection: { state: 'active', row: {
      tier: 'pro', is_active: true, product_id: 'layerwell_pro_monthly', expires_at: EXPIRY,
      store: 'app_store', period_type: 'normal', will_renew: false,
      granted_at: '2026-10-01T12:00:00.000Z', source: 'revenuecat', environment: 'production',
      management_url: null, verified_at: PROVIDER_AT, offering_id: null, package_id: null,
      cursor: { kind: 'server_projection', version: 1,
        stream_id: '11111111-1111-4111-8111-111111111111', revision: '60',
        provider: { kind: 'rc_webhook', at: PROVIDER_AT, priority: 60, event_id: 'publication-provider-event' } },
    } },
    app_grant_projection: { state: 'absent', row: null },
  };
}

function respond(data: unknown) {
  ports.rpc.mockImplementationOnce(() => ({ abortSignal: async () => ({ data, error: null }) }));
}

async function loadModules() {
  store = await import('@/features/subscription/store'); hook = await import('@/features/subscription/useEntitlement');
  account = await import('@/lib/auth/accountGeneration'); client = await import('@/features/subscription/clientEntitlement');
  journal = await import('@/lib/iap/storeTransactionNotice');
}

const context = () => ({ ownerBinding: ports.ownerBinding });
const envelope = () => JSON.parse(ports.privateStorage.get(KEY)!);
const journalEnvelope = () => JSON.parse(ports.journalStorage.get(JOURNAL)!);

async function query() {
  hook.useEntitlement();
  if (!ports.queryFn) throw new Error('Actual useEntitlement query callback was not registered');
  return ports.queryFn();
}

async function seed() {
  respond(wire()); expect((await query()).isPro).toBe(true);
}

async function rejectCurrent() {
  const invalid = wire(); Reflect.deleteProperty(invalid.store_projection.row.cursor, 'revision');
  respond(invalid); expect((await query()).isPro).toBe(false);
  expect(envelope().store.serverProtocolRejected).toBe(true);
  return ports.privateStorage.get(KEY)!;
}

function sdkInput(verification: Verification, periodType: 'normal' | 'trial' = 'normal') {
  const entitlement: StoredEntitlement = {
    tier: 'pro', isActive: true, periodType, store: 'app_store', productId: 'layerwell_pro_monthly',
    expiresAt: EXPIRY, willRenew: false, grantedAt: '2026-10-01T12:00:00.000Z',
    source: 'revenuecat', environment: 'production', verifiedAt: NOW, managementUrl: null,
    offeringId: null, packageId: null,
  };
  const customerInfo = { requestDate: NOW, entitlements: { verification,
    active: { pro: { verification, isActive: true, productIdentifier: 'layerwell_pro_monthly' } }, all: {} },
  } as unknown as Parameters<typeof store.customerInfoToEvidence>[0];
  return { customerInfo, entitlement };
}

function configureNativeResult(verification: Verification, periodType: 'normal' | 'trial' = 'normal') {
  const sdk = sdkInput(verification, periodType);
  ports.parsedEntitlement = sdk.entitlement;
  const nativeResult = async (nativeCall: StoreTransactionNativeCall) => {
    await nativeCall.beforeNativeStoreCall();
    nativeCall.markNativeCallStarted();
    ports.nativeCalls += 1;
    return { customerInfo: sdk.customerInfo, productId: sdk.entitlement.productId };
  };
  ports.purchasePackage.mockImplementation((_plan: unknown, _owner: unknown, nativeCall: StoreTransactionNativeCall) => nativeResult(nativeCall));
  ports.restorePurchases.mockImplementation((_owner: unknown, nativeCall: StoreTransactionNativeCall) => nativeResult(nativeCall));
  ports.purchaseWinBackPackage.mockImplementation((_owner: unknown, nativeCall: StoreTransactionNativeCall) => nativeResult(nativeCall));
}

function action(name: NativeAction): Promise<EntitlementActionResult> {
  const actions = hook.useEntitlementActions();
  return name === 'purchasePlan' ? actions.purchasePlan.mutateAsync('monthly') : actions[name].mutateAsync();
}

function settlement(promise: Promise<EntitlementActionResult>) {
  return promise.then((value) => ({ outcome: 'resolved' as const, value }),
    (error: unknown) => ({ outcome: 'rejected' as const, error: String(error) }));
}

async function verifyQuarantineAndFreshRecovery(rejectedBytes: string) {
  expect(ports.privateStorage.get(KEY), 'The newer exact rejection bytes must survive').toBe(rejectedBytes);
  expect(envelope().store.serverProtocolRejected).toBe(true);
  const local = await store.readEntitlementSnapshot(context(), NOW);
  expect(local.status).toBe('available');
  expect(local.status === 'available' && client.stateFromEntitlementSnapshot(local.snapshot).isPro).toBe(false);
  const retainedPrivate = Object.fromEntries(ports.privateStorage);
  const retainedJournal = Object.fromEntries(ports.journalStorage);
  vi.resetModules(); await loadModules();
  expect(Object.fromEntries(ports.privateStorage)).toEqual(retainedPrivate);
  expect(Object.fromEntries(ports.journalStorage)).toEqual(retainedJournal);
  const cold = await store.readEntitlementSnapshot(context(), NOW);
  expect(cold.status === 'available' && client.stateFromEntitlementSnapshot(cold.snapshot).isPro).toBe(false);
  const projection = structuredClone(envelope().store.serverProjection);
  respond(wire()); expect((await query()).isPro).toBe(true);
  expect(envelope().store.serverProtocolRejected).toBe(false);
  expect(envelope().store.serverProjection).toEqual(projection);
  expect(projection.cursor.revision).toBe('60');
  expect(projection.entitlement.verifiedAt).toBe(PROVIDER_AT);
  expect(projection.entitlement.expiresAt).toBe(EXPIRY);
  return { exactRejectionBytesRetained: true, rejectedBytes, retainedServerProjection: projection,
    recoveredServerProjection: structuredClone(envelope().store.serverProjection), localPaid: false, restartedPaid: false,
    freshRecoveryPaid: true, recoveredRevision: '60', providerVerifiedAt: PROVIDER_AT, expiresAt: EXPIRY };
}

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date(NOW));
  ports.privateStorage.clear(); ports.journalStorage.clear(); ports.mutationTails.clear();
  ports.ownerBinding = OWNER; ports.queryFn = null; ports.nativeCalls = 0; ports.journalEvents = [];
  ports.nextOwnerGate = null; ports.nextJournalCompletionGate = null;
  ports.nextProviderWriteCompletionGate = null; ports.onTransform = null;
  ports.nextPrivateCommitGate = null; ports.onMutationQueued = null;
  ports.customProGrantEnabled = false; ports.parsedEntitlement = null;
  ports.rpc.mockReset(); ports.invoke.mockReset(); ports.track.mockReset();
  ports.setQueryData.mockReset(); ports.cancelQueries.mockReset().mockResolvedValue(undefined);
  ports.invalidateQueries.mockReset().mockResolvedValue(undefined);
  ports.scheduleReminder.mockReset().mockResolvedValue(undefined);
  ports.cancelReminder.mockReset().mockResolvedValue(undefined);
  ports.purchasePackage.mockReset(); ports.purchaseWinBackPackage.mockReset(); ports.restorePurchases.mockReset();
  await loadModules();
  const generation = account.captureAccountIdentityGeneration();
  ports.assertRcCurrent.mockReset().mockImplementation(() => {
    account.assertAccountIdentityGeneration(generation);
    if (ports.ownerBinding !== OWNER) throw new Error('STALE_PROVIDER_OWNER');
  });
  ports.runRcWrite.mockReset().mockImplementation(async (_input: unknown, operation: () => Promise<unknown>) =>
    account.runAccountGenerationOperation(async (lease) => {
      lease.assertCurrent(); ports.assertRcCurrent();
      const result = await operation();
      const pending = ports.nextProviderWriteCompletionGate;
      ports.nextProviderWriteCompletionGate = null;
      if (pending) { pending.entered(); await pending.wait; }
      lease.assertCurrent(); ports.assertRcCurrent();
      return result;
    }));
});
afterEach(() => vi.useRealTimers());
afterAll(() => {
  if (process.env.R4_CALLER_OBSERVATIONS) writeFileSync(process.env.R4_CALLER_OBSERVATIONS,
    JSON.stringify({ source: process.env.R4_REPOSITORY,
      fidelity: 'Actual subscription query/mutation/store/codec/reducer/account-generation and real storeTransactionNotice journal over controlled native provider, reminder, owner, serialized plaintext private-KV and AsyncStorage ports; no physical SDK, native encryption or process-kill claim.',
      observations }, null, 2) + '\n');
});

describe('R4 sibling actions retain current publication authority across reminder I/O', () => {
  for (const name of ACTIONS.filter((value) => value !== 'purchasePlan')) {
    for (const verification of VERIFICATIONS) {
      for (const periodType of ['normal', 'trial'] as const) {
        it(`${name}/${verification}/${periodType}: newer rejection invalidates the retained reminder result`, async () => {
          await seed(); configureNativeResult(verification, periodType);
          const pendingReminder = gate();
          const reminderPort = periodType === 'trial' ? ports.scheduleReminder : ports.cancelReminder;
          reminderPort.mockImplementationOnce(async () => { pendingReminder.port.entered(); await pendingReminder.port.wait; });
          const initialGeneration = account.captureAccountIdentityGeneration();
          const pending = settlement(action(name));
          await pendingReminder.entered;
          expect(ports.setQueryData).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ isPro: true }));
          expect(journalEnvelope().notices[0].status).toBe('in_flight');
          const bytes = await rejectCurrent();
          const beforeResumePublications = ports.setQueryData.mock.calls.length;
          pendingReminder.release(); const result = await pending;
          const returnedActive = result.outcome === 'resolved' && result.value.active;
          expect.soft(returnedActive, 'A reminder continuation cannot authorize stale paid access').toBe(false);
          expect(ports.setQueryData.mock.calls.slice(beforeResumePublications).some(([, value]) => value?.isPro === true)).toBe(false);
          expect(account.captureAccountIdentityGeneration()).toBe(initialGeneration);
          expect(ports.nativeCalls).toBe(1);
          const notice = await journal.readStoreTransactionNotice('account-a');
          if (result.outcome === 'rejected') {
            expect(notice).toEqual({ kind: 'owner_pending', reason: 'completion_unconfirmed' });
          }
          const preserved = await verifyQuarantineAndFreshRecovery(bytes);
          observations.push({ boundary: 'reminder', name, verification, periodType,
            outcome: result.outcome, returnedActive, journalNotice: notice, ...preserved });
        });

        it(`${name}/${verification}/${periodType}: uninterrupted reminder and native journal settle normally`, async () => {
          await seed(); configureNativeResult(verification, periodType);
          const result = await action(name);
          expect(result.active).toBe(true); expect(result.entitlement?.isActive).toBe(true);
          expect(periodType === 'trial' ? ports.scheduleReminder : ports.cancelReminder).toHaveBeenCalledTimes(1);
          expect(ports.nativeCalls).toBe(1);
          expect(await journal.readStoreTransactionNotice('account-a')).toBeNull();
          expect(envelope().store.serverProtocolRejected).toBe(false);
          observations.push({ boundary: 'reminder-control', name, verification, periodType, active: true, journalResolved: true });
        });
      }
    }
  }
});

describe('R4 actual native action completion checks the last retained-result boundaries', () => {
  for (const name of ACTIONS) {
    for (const verification of VERIFICATIONS) {
      for (const boundary of ['provider-write-completion', 'journal-resolution-write'] as const) {
        it(`${name}/${verification}: rejection during ${boundary} cannot escape as active`, async () => {
          await seed(); configureNativeResult(verification);
          const completion = gate();
          if (boundary === 'journal-resolution-write') ports.nextJournalCompletionGate = completion.port;
          else ports.nextProviderWriteCompletionGate = completion.port;
          const initialGeneration = account.captureAccountIdentityGeneration();
          const pending = settlement(action(name)); await completion.entered;
          expect(ports.cancelReminder).toHaveBeenCalledTimes(1);
          expect(ports.setQueryData).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ isPro: true }));
          if (boundary === 'journal-resolution-write') {
            expect(ports.journalEvents.at(-1)?.kind).toBe('pending-completion');
            expect(journalEnvelope().notices[0].status).toBe('in_flight');
          }
          const bytes = await rejectCurrent();
          const publicationsBeforeResume = ports.setQueryData.mock.calls.length;
          completion.release(); const result = await pending;
          const returnedActive = result.outcome === 'resolved' && result.value.active;
          expect.soft(returnedActive, 'The actual mutation return follows every shared-wrapper await').toBe(false);
          expect(ports.setQueryData.mock.calls.slice(publicationsBeforeResume).some(([, value]) => value?.isPro === true)).toBe(false);
          expect(ports.nativeCalls).toBe(1);
          expect(account.captureAccountIdentityGeneration()).toBe(initialGeneration);
          const notice = await journal.readStoreTransactionNotice('account-a');
          // A verified provider result resolved before this final await remains
          // a genuine provider fact even though current paid publication is stale.
          if (boundary === 'journal-resolution-write') expect(notice).toBeNull();
          else if (result.outcome === 'rejected') {
            expect(notice).toEqual({ kind: 'owner_pending', reason: 'completion_unconfirmed' });
          }
          const preserved = await verifyQuarantineAndFreshRecovery(bytes);
          observations.push({ boundary, name, verification, outcome: result.outcome,
            returnedActive, journalNotice: notice, ...preserved });
        });
      }

      it(`${name}/${verification}: uninterrupted provider write and real journal return active`, async () => {
        await seed(); configureNativeResult(verification);
        const result = await action(name);
        expect(result.active).toBe(true);
        expect(ports.nativeCalls).toBe(1);
        expect(ports.journalEvents.filter((event) => event.kind === 'write')).toHaveLength(2);
        expect(await journal.readStoreTransactionNotice('account-a')).toBeNull();
        observations.push({ boundary: 'wrapper-control', name, verification, active: true, journalResolved: true });
      });
    }
  }
});

describe('R4 local action publication siblings', () => {
  for (const name of ['startReverseTrial', 'downgrade'] as const) {
    function configureGrant() {
      if (name !== 'startReverseTrial') return;
      // Exercise the retained compatibility path without enabling a product feature.
      ports.customProGrantEnabled = true;
      ports.invoke.mockResolvedValue({ data: { entitlement: {
        entitlement: 'pro', is_active: true, period_type: 'reverse_trial', store: 'app_granted',
        product_id: null, expires_at: EXPIRY, will_renew: false, original_purchase_at: NOW,
        source: 'app_granted', verified_at: NOW,
      } }, error: null });
    }

    it(`${name}: a rejected current snapshot cannot fall back to prior active metadata`, async () => {
      await seed(); configureGrant();
      const pendingOwner = gate(); let transforms = 0;
      ports.onTransform = () => {
        transforms += 1;
        if (transforms === 2) { ports.onTransform = null; ports.nextOwnerGate = pendingOwner.port; }
      };
      const pending = settlement(hook.useEntitlementActions()[name].mutateAsync());
      await pendingOwner.entered;
      const bytes = await rejectCurrent(); pendingOwner.release();
      const result = await pending;
      const returnedActive = result.outcome === 'resolved' && result.value.active;
      expect.soft(returnedActive, 'The caller must use the current snapshot, not retained grant metadata').toBe(false);
      expect(ports.setQueryData.mock.calls.some(([, value]) => value?.isPro === true)).toBe(false);
      expect(ports.nativeCalls).toBe(0);
      const preserved = await verifyQuarantineAndFreshRecovery(bytes);
      observations.push({ boundary: 'local-action-current-snapshot', name,
        outcome: result.outcome, returnedActive, ...preserved });
    });

    it(`${name}: uninterrupted current paid snapshot remains available`, async () => {
      await seed(); configureGrant();
      const result = await hook.useEntitlementActions()[name].mutateAsync();
      expect(result.active).toBe(true); expect(ports.nativeCalls).toBe(0);
      expect(ports.setQueryData).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ isPro: true }));
      observations.push({ boundary: 'local-action-control', name, active: true });
    });
  }

  it('the custom reverse-trial product feature remains disabled by default', async () => {
    await seed();
    await expect(hook.useEntitlementActions().startReverseTrial.mutateAsync()).rejects.toThrow('CUSTOM_PRO_GRANT_DISABLED');
    expect(ports.invoke).not.toHaveBeenCalled();
    observations.push({ boundary: 'disabled-custom-grant-control', customProGrantEnabled: false, serverInvoked: false });
  });
});

describe('R4 SDK publication retains authority through the serialized native write', () => {
  for (const verification of VERIFICATIONS) {
    it(`${verification}: rejection while the SDK native write waits blocks its earlier paid snapshot`, async () => {
      await seed();
      const nativeWrite = gate(); ports.nextPrivateCommitGate = nativeWrite.port;
      const sdk = sdkInput(verification);
      const pendingSdk = store.publishCustomerInfoEvidence({ context: context(), ...sdk,
        observedAtISO: NOW, queryClient: { cancelQueries: ports.cancelQueries, setQueryData: ports.setQueryData } });
      await nativeWrite.entered;
      const negativeQueued = deferred(); ports.onMutationQueued = negativeQueued.resolve;
      const pendingNegative = rejectCurrent(); await negativeQueued.promise;
      nativeWrite.release();
      const [result, bytes] = await Promise.all([pendingSdk, pendingNegative]);
      const returnedPaid = !!result.snapshot && client.stateFromEntitlementSnapshot(result.snapshot).isPro;
      const publishedPaid = ports.setQueryData.mock.calls.some(([, value]) => value?.isPro === true);
      expect.soft(returnedPaid, 'SDK settlement cannot reuse its pre-rejection merge result').toBe(false);
      expect.soft(publishedPaid, 'SDK-only evidence must use the native mutation publication guard').toBe(false);
      const preserved = await verifyQuarantineAndFreshRecovery(bytes);
      observations.push({ boundary: 'sdk-serialized-native-write', verification,
        resultStatus: result.status, returnedPaid, publishedPaid, ...preserved });
    });
  }
});
