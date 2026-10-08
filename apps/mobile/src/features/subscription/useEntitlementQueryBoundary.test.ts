import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';

import type { StoredEntitlement, SubscriptionState } from '@/features/subscription/entitlement';

const OWNER_A = 'a'.repeat(64);
const STREAM_A = '11111111-1111-4111-8111-111111111111';
const KEY = 'layerwell.entitlement.v2';
const NOW = '2026-10-07T12:00:00.000Z';
const PROVIDER_AT = '2026-10-07T11:00:00.000Z';
const EXPIRY = '2026-11-07T12:00:00.000Z';

const ports = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  mutationTails: new Map<string, Promise<void>>(),
  ownerBinding: 'a'.repeat(64) as string | null,
  userId: 'account-a',
  queryFn: null as (() => Promise<SubscriptionState>) | null,
  queryClient: null as import('@tanstack/query-core').QueryClient | null,
  rpc: vi.fn(),
  invoke: vi.fn(),
  nextMutationReadError: null as Error | null,
  nextMutationWriteError: null as Error | null,
  nextReadGate: null as { entered: () => void; wait: Promise<void> } | null,
  nextCommitGate: null as { entered: () => void; wait: Promise<void> } | null,
  nextOwnerReadGate: null as { entered: () => void; wait: Promise<void> } | null,
  onMutationQueued: null as (() => void) | null,
  onTransform: null as (() => void) | null,
  onCommit: null as (() => void) | null,
  setQueryData: vi.fn(), cancelQueries: vi.fn(), invalidateQueries: vi.fn(),
  scheduleReminder: vi.fn(), cancelReminder: vi.fn(),
  assertRcCurrent: vi.fn(), runRcWrite: vi.fn(),
  purchasePackage: vi.fn(), purchaseWinBackPackage: vi.fn(), restorePurchases: vi.fn(),
  runOwnedTransaction: vi.fn(), markProviderResultPersisted: vi.fn(),
  parsedEntitlement: null as StoredEntitlement | null,
}));

// These are the I/O and hook-registration seams only. In particular, the real
// account-generation lease, DTO parser, owner checks, merge and cache codec run.
vi.mock('react', () => ({
  useEffect: vi.fn(),
  useState: (initial: unknown) => [
    typeof initial === 'function' ? Date.now() : {
      userId: ports.userId, status: 'ready',
      context: ports.ownerBinding === null ? null : { ownerBinding: ports.ownerBinding }, error: null,
    },
    vi.fn(),
  ],
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() } }));
vi.mock('@tanstack/react-query', async () => {
  const { QueryClient } = await import('@tanstack/query-core');
  ports.queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return {
    useQuery: (options: { queryKey: readonly string[]; queryFn: () => Promise<SubscriptionState> }) => {
      ports.queryFn = options.queryFn;
      return { refetch: vi.fn(), data: ports.queryClient!.getQueryData(options.queryKey) };
    },
    useQueryClient: () => ({ cancelQueries: ports.cancelQueries,
      setQueryData: ports.setQueryData, invalidateQueries: ports.invalidateQueries }),
    useMutation: (options: { mutationFn: (...args: any[]) => Promise<unknown> }) => ({ mutateAsync: options.mutationFn }),
  };
});
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: ports.userId } }) }));
vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: async (id: string) =>
    id === 'account-a' || id === '11111111-1111-4111-8111-111111111111' ? 'a'.repeat(64) : 'b'.repeat(64),
  readLocalDataOwnerProofBinding: async () => {
    const gate = ports.nextOwnerReadGate;
    ports.nextOwnerReadGate = null;
    if (gate) { gate.entered(); await gate.wait; }
    return ports.ownerBinding;
  },
}));
vi.mock('@/lib/env', () => ({
  env: { appEnvironment: 'production', customProGrantEnabled: false, revenueCatEntitlementId: 'pro' },
  isSupabaseConfigured: true,
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: { rpc: ports.rpc, functions: { invoke: ports.invoke } } }));
vi.mock('@/lib/storage/privateKV', () => ({
  PRIVATE_KV_DECRYPTION_FAILED: 'PRIVATE_KV_DECRYPTION_FAILED',
  PRIVATE_KV_ENVELOPE_INVALID: 'PRIVATE_KV_ENVELOPE_INVALID',
  PRIVATE_KV_ENVELOPE_UNSUPPORTED: 'PRIVATE_KV_ENVELOPE_UNSUPPORTED',
  getPrivateItem: async (key: string) => {
    const raw = ports.storage.get(key) ?? null;
    const gate = ports.nextReadGate;
    ports.nextReadGate = null;
    if (gate) { gate.entered(); await gate.wait; }
    return raw;
  },
  multiRemovePrivateItems: async (keys: readonly string[]) => {
    for (const key of keys) ports.storage.delete(key);
  },
  updatePrivateItem: (
    key: string,
    updater: (raw: string | null) => string | null,
    assertAdditionalMutationCurrent?: () => void,
  ) => {
    const previous = ports.mutationTails.get(key) ?? Promise.resolve();
    const queued = ports.onMutationQueued;
    ports.onMutationQueued = null;
    queued?.();
    const operation = previous.catch(() => undefined).then(async () => {
      if (ports.nextMutationReadError) {
        const error = ports.nextMutationReadError;
        ports.nextMutationReadError = null;
        throw error;
      }
      const current = ports.storage.get(key) ?? null;
      assertAdditionalMutationCurrent?.();
      const next = updater(current);
      assertAdditionalMutationCurrent?.();
      const transformed = ports.onTransform;
      ports.onTransform = null;
      transformed?.();
      if (next === current) return;
      const gate = ports.nextCommitGate;
      ports.nextCommitGate = null;
      // Mirror privateKV's guard before the asynchronous native write and its
      // post-write exact-prior rollback. The gate represents the native promise.
      assertAdditionalMutationCurrent?.();
      if (gate) { gate.entered(); await gate.wait; }
      if (ports.nextMutationWriteError) {
        const error = ports.nextMutationWriteError;
        ports.nextMutationWriteError = null;
        throw error;
      }
      if (next === null) ports.storage.delete(key); else ports.storage.set(key, next);
      const committed = ports.onCommit;
      ports.onCommit = null;
      try {
        assertAdditionalMutationCurrent?.();
      } catch (error) {
        if (current === null) ports.storage.delete(key); else ports.storage.set(key, current);
        throw error;
      }
      committed?.();
    });
    const settled = operation.then(() => undefined, () => undefined);
    ports.mutationTails.set(key, settled);
    void settled.finally(() => {
      if (ports.mutationTails.get(key) === settled) ports.mutationTails.delete(key);
    });
    return operation;
  },
}));
vi.mock('@/features/notifications/deliver', () => ({ cancelTrialReminder: ports.cancelReminder, scheduleTrialReminder: ports.scheduleReminder }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/iap/revenuecat', () => ({
  assertRevenueCatResultCurrent: ports.assertRcCurrent,
  customerInfoToStoredEntitlement: () => ports.parsedEntitlement,
  purchasePackage: ports.purchasePackage, purchaseWinBackPackage: ports.purchaseWinBackPackage,
  restorePurchases: ports.restorePurchases, runRevenueCatResultWrite: ports.runRcWrite,
}));
vi.mock('@/lib/iap/storeTransactionNotice', () => ({ runOwnedStoreTransaction: ports.runOwnedTransaction }));

let store: typeof import('@/features/subscription/store');
let hook: typeof import('@/features/subscription/useEntitlement');
let account: typeof import('@/lib/auth/accountGeneration');
let client: typeof import('@/features/subscription/clientEntitlement');
type Caller = 'query' | 'compatibility';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function gate() {
  const entered = deferred<void>();
  const release = deferred<void>();
  return { entered: entered.promise, release: () => release.resolve(),
    port: { entered: () => entered.resolve(), wait: release.promise } };
}

function wire(revision = '60', active = true, stream = STREAM_A) {
  return {
    schema_version: 2,
    store_projection: { state: active ? 'active' : 'inactive', row: {
      tier: 'pro', is_active: active, product_id: 'layerwell_pro_monthly', expires_at: EXPIRY,
      store: 'app_store', period_type: 'normal', will_renew: false,
      granted_at: '2026-10-01T12:00:00.000Z', source: 'revenuecat', environment: 'production',
      management_url: null, verified_at: PROVIDER_AT, offering_id: null, package_id: null,
      cursor: { kind: 'server_projection', version: 1, stream_id: stream, revision,
        provider: { kind: 'rc_webhook', at: PROVIDER_AT, priority: 60, event_id: 'publication-provider-event' } },
    } },
    app_grant_projection: { state: 'absent', row: null },
  };
}

function malformed(kind: 'missing-revision' | 'unknown-version' = 'missing-revision') {
  const response = wire('62', false);
  if (kind === 'missing-revision') Reflect.deleteProperty(response.store_projection.row.cursor, 'revision');
  else response.store_projection.row.cursor.version = 999;
  return response;
}

function respond(data: unknown) {
  ports.rpc.mockImplementationOnce(() => ({ abortSignal: async () => ({ data, error: null }) }));
}

function offline() {
  ports.rpc.mockImplementationOnce(() => ({ abortSignal: async () => ({ data: null, error: new Error('OFFLINE') }) }));
}

function holdResponse() {
  const started = deferred<void>();
  const result = deferred<{ data: unknown; error: null }>();
  ports.rpc.mockImplementationOnce(() => ({ abortSignal: () => { started.resolve(); return result.promise; } }));
  return { started: started.promise, release: (data: unknown) => result.resolve({ data, error: null }),
    fail: (error: unknown) => result.reject(error) };
}

async function loadModules() {
  store = await import('@/features/subscription/store');
  hook = await import('@/features/subscription/useEntitlement');
  account = await import('@/lib/auth/accountGeneration');
  client = await import('@/features/subscription/clientEntitlement');
}

async function readUsing(caller: Caller): Promise<boolean> {
  if (caller === 'compatibility') return (await store.fetchServerEntitlement())?.isActive === true;
  hook.useEntitlement();
  if (!ports.queryFn) throw new Error('The actual useEntitlement query callback was not registered');
  return (await ports.queryClient!.fetchQuery({ queryKey: ['entitlement', ports.ownerBinding], queryFn: ports.queryFn, staleTime: 0 })).isPro;
}

const context = () => ({ ownerBinding: ports.ownerBinding! });
const envelope = () => JSON.parse(ports.storage.get(KEY)!);

async function cachedPaid() {
  const read = await store.readEntitlementSnapshot(context(), NOW);
  expect(read.status).toBe('available');
  return read.status === 'available' && client.stateFromEntitlementSnapshot(read.snapshot).isPro;
}

async function restart() {
  const bytes = Object.fromEntries(ports.storage);
  vi.resetModules();
  await loadModules();
  expect(Object.fromEntries(ports.storage), 'Module restart must retain exact private-KV bytes').toEqual(bytes);
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  ports.storage.clear(); ports.mutationTails.clear(); ports.rpc.mockReset(); ports.invoke.mockReset();
  ports.ownerBinding = OWNER_A; ports.userId = 'account-a'; ports.queryFn = null;
  ports.nextMutationReadError = null; ports.nextMutationWriteError = null;
  ports.nextReadGate = null; ports.nextCommitGate = null; ports.nextOwnerReadGate = null;
  ports.onMutationQueued = null; ports.onTransform = null; ports.onCommit = null;
  await loadModules();
  ports.queryClient!.clear();
  ports.setQueryData.mockReset().mockImplementation((key, data) => ports.queryClient!.setQueryData(key, data));
  ports.cancelQueries.mockReset().mockImplementation((filters) => ports.queryClient!.cancelQueries(filters));
  ports.invalidateQueries.mockReset().mockResolvedValue(undefined);
  ports.scheduleReminder.mockReset().mockResolvedValue(undefined);
  ports.cancelReminder.mockReset().mockResolvedValue(undefined);
  ports.purchasePackage.mockReset(); ports.purchaseWinBackPackage.mockReset(); ports.restorePurchases.mockReset();
  ports.markProviderResultPersisted.mockReset(); ports.parsedEntitlement = null;
  const identityGeneration = account.captureAccountIdentityGeneration();
  // Existing native/provider boundaries are controlled, while real account
  // generation validation remains live. No account transition is induced.
  ports.assertRcCurrent.mockReset().mockImplementation(() => {
    account.assertAccountIdentityGeneration(identityGeneration);
    if (ports.ownerBinding !== OWNER_A || ports.userId !== 'account-a') throw new Error('STALE_PROVIDER_OWNER');
  });
  ports.runRcWrite.mockReset().mockImplementation(async (_input, operation) =>
    account.runAccountGenerationOperation(async (lease) => {
      lease.assertCurrent(); ports.assertRcCurrent();
      const result = await operation();
      lease.assertCurrent(); ports.assertRcCurrent();
      return result;
    }));
  ports.runOwnedTransaction.mockReset().mockImplementation(async ({ operation }) =>
    operation({ markProviderResultPersisted: ports.markProviderResultPersisted,
      markDefinitiveCancellation: vi.fn() }));
});
afterEach(() => vi.useRealTimers());


type Verification = 'VERIFIED' | 'VERIFIED_ON_DEVICE';
const findings: Record<string, unknown>[] = [];
afterAll(() => {
  if (!process.env.R6_QUERY_OBSERVATIONS) return;
  writeFileSync(process.env.R6_QUERY_OBSERVATIONS, JSON.stringify({
    source: process.env.R6_REPOSITORY,
    fidelity: 'Actual focused subscription store/parser/reducer, real Query Core QueryClient query execution/cache, actual useEntitlement query callback and displayed-state advanceSubscriptionState path, account generation. Controlled transport/owner/serialized private-KV/React registration/native interfaces. React effects and physical SDK/device storage are not executed.',
    findings,
  }, null, 2) + '\n');
});

function sdkInput(verification: Verification, periodType: 'normal' | 'trial' = 'normal') {
  const entitlement: StoredEntitlement = {
    tier: 'pro', isActive: true, periodType, store: 'app_store',
    productId: 'layerwell_pro_monthly', expiresAt: EXPIRY, willRenew: false,
    grantedAt: '2026-10-01T12:00:00.000Z', source: 'revenuecat', environment: 'production',
    verifiedAt: NOW, managementUrl: null, offeringId: null, packageId: null,
  };
  const customerInfo = {
    requestDate: NOW, entitlements: { verification,
      active: { pro: { verification, isActive: true, productIdentifier: 'layerwell_pro_monthly' } }, all: {} },
  } as unknown as Parameters<typeof store.customerInfoToEvidence>[0];
  return { entitlement, customerInfo };
}

async function seedActive() {
  respond(wire()); expect(await readUsing('query')).toBe(true);
  expect(envelope().store.serverProtocolRejected).toBe(false);
}


const at = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString();
const cachedQuery = () => ports.queryClient!.getQueryData<SubscriptionState>(['entitlement', OWNER_A])!;


async function seedSdk(verification: Verification, expiry = EXPIRY) {
  const initial = wire(); initial.store_projection.row.expires_at = expiry;
  respond(initial); expect(await readUsing('query')).toBe(true);
  const sdk = sdkInput(verification); sdk.entitlement.expiresAt = expiry;
  const result = await store.publishCustomerInfoEvidence({ context: context(), ...sdk,
    observedAtISO: NOW, queryClient: { cancelQueries: ports.cancelQueries, setQueryData: ports.setQueryData } });
  expect(result.status === 'committed' || result.status === 'unchanged').toBe(true);
  expect(cachedQuery().isPro).toBe(true);
  return sdk;
}

async function fetchAndMerge(response: ReturnType<typeof wire>) {
  respond(response);
  const fetched = await store.fetchServerEvidence(context(), new AbortController().signal);
  if (fetched.status !== 'evidence') throw new Error('Expected authenticated evidence: ' + fetched.status);
  return store.mergeEntitlementEvidenceBatch(context(), fetched.evidence);
}

async function acceptProtocolRejection() {
  respond(malformed());
  const fetched = await store.fetchServerEvidence(context(), new AbortController().signal);
  expect(fetched.status).toBe('rejected');
  expect(envelope().store.serverProtocolRejected).toBe(true);
  return fetched;
}

describe('R6 query capability through actual Core and retained state consumers', () => {
  for (const transport of ['online', 'offline'] as const)
    for (const schedule of ['negative-before', 'concurrent', 'negative-after'] as const) {
      it(`${transport}/${schedule}: final actual query continuation`, async () => {
        await seedActive();
        const read = await store.readEntitlementSnapshot(context(), NOW);
        if (read.status !== 'available') throw new Error('paid seed required');
        const events: Record<string, unknown>[] = [];
        const unsubscribe = ports.queryClient!.getQueryCache().subscribe((event) => {
          if (event.type !== 'updated' || event.action.type !== 'success') return;
          const data = event.query.state.data as SubscriptionState;
          let authorityCurrent = true;
          try { store.assertEntitlementSnapshotCurrent(read.snapshot); } catch { authorityCurrent = false; }
          events.push({ event: 'Core-query-success', isPro: data.isPro, expiresAt: data.expiresAt,
            evidenceStatus: data.evidenceStatus, authorityCurrent,
            durableRejection: envelope().store.serverProtocolRejected });
        });
        const oldFinalOwner = gate();
        ports.onTransform = () => { ports.nextOwnerReadGate = oldFinalOwner.port; };
        if (transport === 'online') respond(wire()); else offline();
        const oldPending = readUsing('query').then((value) => ({ outcome: 'resolved' as const, value }),
          (error: unknown) => ({ outcome: 'rejected' as const, error: String(error) }));
        await oldFinalOwner.entered;
        const response = holdResponse();
        const negativePending = store.fetchServerEvidence(context(), new AbortController().signal);
        await response.started;
        const rejectionOwner = gate();
        ports.nextOwnerReadGate = rejectionOwner.port;
        response.release(malformed());
        await rejectionOwner.entered;
        let completedBeforeRejection = false;
        if (schedule === 'negative-before') {
          rejectionOwner.release(); expect((await negativePending).status).toBe('rejected');
          oldFinalOwner.release();
        } else if (schedule === 'concurrent') {
          // Only two existing owner-proof I/O promises resume. Core itself
          // performs query publication; there are no custom query callbacks.
          oldFinalOwner.release(); rejectionOwner.release();
        } else {
          oldFinalOwner.release();
          expect(await oldPending).toEqual({ outcome: 'resolved', value: true });
          expect(cachedQuery().isPro).toBe(true);
          completedBeforeRejection = true;
          rejectionOwner.release();
        }
        const oldResult = await oldPending;
        expect((await negativePending).status).toBe('rejected');
        expect(envelope().store.serverProtocolRejected).toBe(true);
        for (const event of events) {
          expect.soft(event.isPro === true && event.authorityCurrent === false,
            'Actual Core query publication cannot expose paid after rejection observation').toBe(false);
        }
        if (schedule !== 'negative-after') {
          expect.soft(oldResult.outcome === 'resolved' && oldResult.value,
            'Actual query caller cannot receive retained paid state after its authority is retired').toBe(false);
        } else {
          expect(oldResult).toEqual({ outcome: 'resolved', value: true });
          expect(completedBeforeRejection).toBe(true);
        }
        expect.soft(cachedQuery().isPro, 'Retained actual Core data carries current validity').toBe(false);
        expect.soft(client.confirmedFreePlan({ data: cachedQuery() }),
          'Retired access is unavailable, not a confirmed empty/Free subscription').toBe(false);
        const negativeBytes = ports.storage.get(KEY)!;
        const facts = structuredClone(envelope().store.serverProjection);
        await restart();
        expect(ports.storage.get(KEY)).toBe(negativeBytes);
        expect(await cachedPaid()).toBe(false);
        respond(wire()); expect(await readUsing('query')).toBe(true);
        expect(envelope().store.serverProjection).toEqual(facts);
        unsubscribe();
        findings.push({ boundary: 'actual-Core-query-final-continuation', transport, schedule,
          oldResult, completedBeforeRejection, events, negativeAndReloadDenied: true,
          genuineEqualRevisionRecovery: true, providerFactsUnchanged: true });
      });
    }

  for (const verification of ['VERIFIED', 'VERIFIED_ON_DEVICE'] as const)
    for (const invalidation of ['protocol-rejection', 'active-shorter-expiry', 'equal-conflict'] as const) {
      it(`${verification}/${invalidation}: actual query, display, and offline state remain current`, async () => {
        await seedSdk(verification);
        const retainedQuery = cachedQuery();
        const retainedDisplay = client.advanceSubscriptionState(retainedQuery, Date.parse(NOW));
        const read = await store.readEntitlementSnapshot(context(), NOW);
        if (read.status !== 'available') throw new Error('Expected available paid snapshot');
        const retainedOffline = client.stateWithoutServerEvidence({ local: read.snapshot, localStatus: 'available',
          serverStatus: 'transport_error', nowISO: NOW, development: false });
        expect(retainedQuery.isPro).toBe(true); expect(retainedDisplay.isPro).toBe(true); expect(retainedOffline.isPro).toBe(true);
        const providerBefore = structuredClone(envelope().store.serverProjection);
        const retainedFacts = [retainedQuery, retainedDisplay, retainedOffline].map((value) => ({
          verifiedAt: value.verifiedAt, store: value.store,
        }));
        vi.setSystemTime(new Date(at(200)));
        if (invalidation === 'protocol-rejection') {
          await acceptProtocolRejection();
        } else {
          const current = wire(invalidation === 'active-shorter-expiry' ? '61' : '60', invalidation === 'active-shorter-expiry');
          if (invalidation === 'active-shorter-expiry') {
            current.store_projection.row.expires_at = at(1000);
            current.store_projection.row.verified_at = at(100);
            current.store_projection.row.cursor.provider.at = at(100);
          }
          const merged = await fetchAndMerge(current);
          expect(merged.status).toBe(invalidation === 'equal-conflict' ? 'conflict' : 'committed');
        }
        const bytes = ports.storage.get(KEY)!;
        const values = [retainedQuery, retainedDisplay, retainedOffline];
        for (const [index, retained] of values.entries()) {
          expect.soft(retained.isPro, 'Converted retained states cannot detach current publication validity').toBe(false);
          expect.soft(retained.evidenceStatus).toBe('unavailable');
          expect.soft(client.confirmedFreePlan({ data: retained })).toBe(false);
          expect({ verifiedAt: retained.verifiedAt, store: retained.store }).toEqual(retainedFacts[index]);
        }
        expect(ports.storage.get(KEY), 'Accessor checks never rewrite durable provider facts').toBe(bytes);
        if (invalidation === 'active-shorter-expiry') {
          // The original R5 admission guard deliberately still permits an old
          // snapshot while both subscriptions are paid. Serialization has the
          // stronger obligation to preserve the current admission limits.
          expect(() => store.assertEntitlementSnapshotCurrent(read.snapshot)).not.toThrow();
          const current = wire('61', true);
          current.store_projection.row.expires_at = at(1000);
          current.store_projection.row.verified_at = at(100);
          current.store_projection.row.cursor.provider.at = at(100);
          respond(current); expect(await readUsing('query')).toBe(true);
          expect(cachedQuery().expiresAt).toBe(at(1000));
        }
        const recovery = wire(invalidation === 'protocol-rejection' ? '60' : '62', true);
        if (invalidation !== 'protocol-rejection') {
          recovery.store_projection.row.verified_at = at(300);
          recovery.store_projection.row.cursor.provider.at = at(300);
        }
        vi.setSystemTime(new Date(at(400)));
        respond(recovery); expect(await readUsing('query')).toBe(true);
        expect(cachedQuery().expiresAt).toBe(EXPIRY);
        expect(envelope().store.serverProtocolRejected).toBe(false);
        expect(envelope().store.serverConflict).toBeNull();
        if (invalidation === 'protocol-rejection') expect(envelope().store.serverProjection).toEqual(providerBefore);
        findings.push({ boundary: 'retained-query-display-offline', verification, invalidation,
          allRetainedDeniedWithoutFalseFree: true, durableBytesUntouchedByAccess: true,
          authenticCurrentLimitsPreserved: true, freshRecovery: true });
      });
    }

  for (const verification of ['VERIFIED', 'VERIFIED_ON_DEVICE'] as const) {
    it(`${verification}: equal-value fresh state retains its own capability under default structural sharing`, async () => {
      const sdk = await seedSdk(verification);
      const first = cachedQuery();
      const firstFields = JSON.parse(JSON.stringify(first));
      // Publish equal values again through the actual SDK helper and QueryClient
      // default replaceEqualDeep path. No structuralSharing option is injected.
      const same = await store.publishCustomerInfoEvidence({ context: context(), ...sdk,
        observedAtISO: NOW, queryClient: { cancelQueries: ports.cancelQueries, setQueryData: ports.setQueryData } });
      expect(same.status === 'committed' || same.status === 'unchanged').toBe(true);
      const equal = cachedQuery();
      expect(JSON.parse(JSON.stringify(equal))).toEqual(firstFields);
      await acceptProtocolRejection();
      const negativeBytes = ports.storage.get(KEY)!;
      expect.soft(first.isPro).toBe(false);
      expect.soft(equal.isPro, 'Equal-value structural sharing cannot flatten the live publication check').toBe(false);
      expect.soft(cachedQuery().isPro).toBe(false);
      // A fresh equal-revision request returns the exact original provider
      // fields, with a new authenticated capability. Old capabilities stay dead.
      respond(wire()); expect(await readUsing('query')).toBe(true);
      expect(JSON.parse(JSON.stringify(cachedQuery()))).toEqual(firstFields);
      expect.soft(first.isPro).toBe(false); expect.soft(equal.isPro).toBe(false);
      expect(envelope().store.serverProtocolRejected).toBe(false);
      expect(envelope().store.serverProjection.entitlement.verifiedAt).toBe(PROVIDER_AT);
      expect(envelope().store.serverProjection.entitlement.expiresAt).toBe(EXPIRY);
      findings.push({ boundary: 'default-Core-structural-sharing', verification,
        identicalValuesBeforeRejection: true, retiredCapabilitiesDeny: true,
        freshEqualRevisionPaid: true, originalProviderTimeAndExpiry: true,
        negativeBytes });
    });

    it(`${verification}: retained raw, displayed, and offline state obey expiry and observed-clock rollback`, async () => {
      await seedSdk(verification, at(1000));
      const retained = cachedQuery();
      const displayed = client.advanceSubscriptionState(retained, Date.parse(NOW));
      const read = await store.readEntitlementSnapshot(context(), NOW);
      if (read.status !== 'available') throw new Error('Expected short paid subscription');
      const offline = client.stateWithoutServerEvidence({ local: read.snapshot, localStatus: 'available',
        serverStatus: 'transport_error', nowISO: NOW, development: false });
      const bytes = ports.storage.get(KEY)!;
      vi.setSystemTime(new Date(at(1500)));
      for (const value of [retained, displayed, offline]) expect.soft(value.isPro).toBe(false);
      vi.setSystemTime(new Date(at(500)));
      for (const value of [retained, displayed, offline]) expect.soft(value.isPro,
        'A retained value that observed expiry cannot revive after wall-clock rollback').toBe(false);
      expect(ports.storage.get(KEY)).toBe(bytes);
      const durable = await store.readEntitlementSnapshot(context(), at(1500));
      expect(durable.status === 'available' && client.stateFromEntitlementSnapshot(durable.snapshot).isPro).toBe(false);
      const persisted = ports.storage.get(KEY)!;
      await restart();
      const cold = await store.readEntitlementSnapshot(context(), at(500));
      expect(cold.status === 'available' && client.stateFromEntitlementSnapshot(cold.snapshot).isPro).toBe(false);
      expect(ports.storage.get(KEY)).toBe(persisted);
      expect(envelope().store.serverProjection.entitlement.verifiedAt).toBe(PROVIDER_AT);
      expect(envelope().store.serverProjection.entitlement.expiresAt).toBe(at(1000));
      findings.push({ boundary: 'retained-state-expiry-and-clock', verification,
        rawDisplayOfflineDeny: true, noRollbackRevival: true, exactBytesPreserved: true,
        persistedClockReloadDenied: true, providerFactsUnchanged: true });
    });
  }
});
