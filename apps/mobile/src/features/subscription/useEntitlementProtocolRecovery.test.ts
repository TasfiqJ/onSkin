import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoredEntitlement, SubscriptionState } from '@/features/subscription/entitlement';

const OWNER_A = 'a'.repeat(64);
const OWNER_B = 'b'.repeat(64);
const STREAM_A = '11111111-1111-4111-8111-111111111111';
const STREAM_B = '22222222-2222-4222-8222-222222222222';
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
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: () => Promise<SubscriptionState> }) => {
    ports.queryFn = options.queryFn;
    return { refetch: vi.fn(), data: undefined };
  },
  useQueryClient: vi.fn(), useMutation: vi.fn(),
}));
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
vi.mock('@/features/notifications/deliver', () => ({ cancelTrialReminder: vi.fn(), scheduleTrialReminder: vi.fn() }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/iap/revenuecat', () => ({
  assertRevenueCatResultCurrent: vi.fn(), customerInfoToStoredEntitlement: vi.fn(),
  purchasePackage: vi.fn(), purchaseWinBackPackage: vi.fn(), restorePurchases: vi.fn(),
  runRevenueCatResultWrite: vi.fn(),
}));
vi.mock('@/lib/iap/storeTransactionNotice', () => ({ runOwnedStoreTransaction: vi.fn() }));

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
  return (await ports.queryFn()).isPro;
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
});
afterEach(() => vi.useRealTimers());

describe.each(['query', 'compatibility'] as const)('actual %s caller protocol recovery', (caller) => {
  it.each(['missing-revision', 'unknown-version'] as const)(
    'two outstanding paid reads cannot clear a later %s rejection', async (kind) => {
      respond(wire()); expect(await readUsing(caller)).toBe(true);
      const older = holdResponse(); const first = readUsing(caller); await older.started;
      const higher = holdResponse(); const second = readUsing(caller); await higher.started;
      respond(malformed(kind)); expect(await readUsing(caller)).toBe(false);
      expect(envelope().store.serverProtocolRejected).toBe(true);
      higher.release(wire('61')); older.release(wire());
      expect.soft(await second, 'A higher revision captured before rejection is not recovery').toBe(false);
      expect.soft(await first, 'The other outstanding request must also stay denied').toBe(false);
      await restart();
      expect.soft(await cachedPaid(), 'Neither stale response may erase durable denial').toBe(false);
      respond(wire('61')); expect(await readUsing(caller)).toBe(true);
      expect(envelope().store.serverProjection.cursor.revision).toBe('61');
      expect(envelope().store.serverProtocolRejected).toBe(false);
    },
  );

  it('a repeated rejection invalidates recovery already pending while the marker is true', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    const recovery = holdResponse(); const pending = readUsing(caller); await recovery.started;
    respond(malformed('unknown-version')); expect(await readUsing(caller)).toBe(false);
    recovery.release(wire());
    expect.soft(await pending, 'The recovery predates the second accepted rejection').toBe(false);
    expect.soft(envelope().store.serverProtocolRejected).toBe(true);
    await restart(); expect.soft(await cachedPaid()).toBe(false);
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    expect(envelope().store.serverProjection.cursor.revision).toBe('60');
  });

  it('a failed first negative write fails closed and supports an honest durable retry', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    const before = ports.storage.get(KEY);
    ports.nextMutationWriteError = new Error('PRIVATE_KV_WRITE_FAILED');
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    expect(ports.storage.get(KEY), 'Failed persistence does not claim durable negative bytes').toBe(before);
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    expect(envelope().store.serverProtocolRejected).toBe(true);
    await restart(); offline(); expect(await readUsing(caller)).toBe(false);
    respond(wire()); expect(await readUsing(caller)).toBe(true);
  });

  it('a stale rejected transport promise cannot fall back to paid cache after a failed negative write', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    const before = ports.storage.get(KEY);
    const held = holdResponse(); const pending = readUsing(caller); await held.started;
    ports.nextMutationWriteError = new Error('PRIVATE_KV_WRITE_FAILED');
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    expect(ports.storage.get(KEY), 'The failed negative write did not establish durable rejection').toBe(before);
    held.fail(new Error('NETWORK_PROMISE_REJECTED'));
    expect.soft(await pending, 'A stale thrown transport result cannot inherit ordinary offline fallback').toBe(false);
    respond(wire()); expect(await readUsing(caller), 'An honest new valid read can recover').toBe(true);
    const freshOffline = holdResponse(); const freshPending = readUsing(caller); await freshOffline.started;
    freshOffline.fail(new Error('GENUINE_CURRENT_NETWORK_FAILURE'));
    expect(await freshPending, 'Current transport failure still admits finite current cache').toBe(true);
  });

  it('a stale legacy-read reconciliation failure cannot fall back after a failed negative write', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    const invoked = deferred<void>();
    const reconciliation = deferred<{ data: null; error: Error }>();
    ports.invoke.mockImplementationOnce(() => { invoked.resolve(); return reconciliation.promise; });
    respond({ ...wire(), schema_version: 1, store_projection: {
      state: 'legacy_unknown', row: { ...wire('60', false).store_projection.row, cursor: null },
    } });
    const pending = readUsing(caller); await invoked.promise;
    const before = ports.storage.get(KEY);
    ports.nextMutationWriteError = new Error('PRIVATE_KV_WRITE_FAILED');
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    expect(ports.storage.get(KEY)).toBe(before);
    reconciliation.resolve({ data: null, error: new Error('RECONCILIATION_OFFLINE') });
    expect.soft(await pending, 'A retained first read cannot gain fresh fallback authority from reconciliation failure').toBe(false);
    expect(ports.rpc).toHaveBeenCalledTimes(3);
    respond(wire()); expect(await readUsing(caller)).toBe(true);
  });

  it('accepted legacy reconciliation can recover through a genuinely fresh second authenticated read', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    const invoked = deferred<void>();
    const reconciliation = deferred<{ data: { outcome: string }; error: null }>();
    ports.invoke.mockImplementationOnce(() => { invoked.resolve(); return reconciliation.promise; });
    respond({ ...wire(), schema_version: 1, store_projection: {
      state: 'legacy_unknown', row: { ...wire('60', false).store_projection.row, cursor: null },
    } });
    const pending = readUsing(caller); await invoked.promise;
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    expect(envelope().store.serverProtocolRejected).toBe(true);
    respond(wire());
    reconciliation.resolve({ data: { outcome: 'already_current' }, error: null });
    expect(await pending, 'The second real RPC starts after rejection and owns fresh recovery authority').toBe(true);
    expect(ports.rpc).toHaveBeenCalledTimes(4);
    expect(ports.invoke).toHaveBeenCalledWith('subscription-reconciliation', { body: {}, signal: expect.any(AbortSignal) });
    expect(envelope().store.serverProtocolRejected).toBe(false);
    expect(envelope().store.serverProjection.cursor.revision).toBe('60');
    expect(envelope().store.serverProjection.entitlement.expiresAt).toBe(EXPIRY);
  });

  it('a failed repeated rejection operation still invalidates a pending recovery', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    const before = ports.storage.get(KEY);
    const recovery = holdResponse(); const pending = readUsing(caller); await recovery.started;
    ports.nextMutationReadError = new Error('PRIVATE_KV_READ_FAILED');
    respond(malformed('unknown-version')); expect(await readUsing(caller)).toBe(false);
    expect(ports.storage.get(KEY)).toBe(before);
    recovery.release(wire());
    expect.soft(await pending, 'The later rejected response invalidates recovery before storage succeeds').toBe(false);
    expect.soft(envelope().store.serverProtocolRejected).toBe(true);
    await restart(); expect.soft(await cachedPaid()).toBe(false);
    respond(wire()); expect(await readUsing(caller)).toBe(true);
  });

  it('transport fallback after module restart preserves rejection but permits a fresh identical read', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    offline(); expect(await readUsing(caller), 'Ordinary finite cached proof remains useful offline').toBe(true);
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    await restart(); offline(); expect(await readUsing(caller)).toBe(false);
    expect(envelope().store.serverProtocolRejected).toBe(true);
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    expect(envelope().store.serverProjection.cursor.revision).toBe('60');
    expect(envelope().store.serverProjection.entitlement.expiresAt).toBe(EXPIRY);
    expect(envelope().store.serverProjection.entitlement.verifiedAt).toBe(PROVIDER_AT);
  });

  it('a fallback snapshot captured before rejection cannot publish paid access after its owner check resumes', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    const afterRead = gate();
    ports.onTransform = () => { ports.nextOwnerReadGate = afterRead.port; };
    offline(); const pending = readUsing(caller); await afterRead.entered;
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    expect(envelope().store.serverProtocolRejected).toBe(true);
    afterRead.release();
    expect.soft(await pending, 'The read-only fallback snapshot predates the accepted durable rejection').toBe(false);
    expect(envelope().store.serverProtocolRejected, 'Snapshot publication must leave the new negative marker intact').toBe(true);
    await restart(); expect(await cachedPaid()).toBe(false);
    respond(wire()); expect(await readUsing(caller), 'A genuinely fresh read can still recover').toBe(true);
  });

  it('a snapshot captured after rejection observation still closes when that negative is atomically accepted', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    const beforeNegativeUpdate = gate(); ports.nextReadGate = beforeNegativeUpdate.port;
    respond(malformed()); const negative = readUsing(caller); await beforeNegativeUpdate.entered;
    const afterSnapshotRead = gate();
    ports.onTransform = () => { ports.nextOwnerReadGate = afterSnapshotRead.port; };
    offline(); const pending = readUsing(caller); await afterSnapshotRead.entered;
    beforeNegativeUpdate.release();
    expect(await negative).toBe(false);
    expect(envelope().store.serverProtocolRejected).toBe(true);
    afterSnapshotRead.release();
    expect.soft(await pending, 'Observing the rejection does not make pre-acceptance paid cache current after its negative commit').toBe(false);
    expect(envelope().store.serverProtocolRejected).toBe(true);
    await restart(); expect(await cachedPaid()).toBe(false);
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    expect(envelope().store.serverProjection.cursor.revision).toBe('60');
  });

  it('an exact-owner replacement aborts an outstanding recovery without touching the new owner cache', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    const held = holdResponse(); const pending = readUsing(caller); await held.started;
    const settlement = pending.then((isPro) => ({ isPro }), (error: unknown) => ({ error }));
    account.beginAccountGenerationBoundary();
    ports.ownerBinding = OWNER_B; ports.userId = 'account-b'; ports.storage.clear();
    account.endAccountGenerationBoundary();
    respond(wire('100', false, STREAM_B)); expect(await readUsing(caller)).toBe(false);
    const replacement = ports.storage.get(KEY);
    held.release(wire());
    const result = await settlement;
    if (caller === 'query') expect(result).toHaveProperty('error.code', 'ACCOUNT_GENERATION_CHANGED');
    else expect(result).toEqual({ isPro: false });
    expect(ports.storage.get(KEY)).toBe(replacement);
    expect(envelope().ownerBinding).toBe(OWNER_B);
    expect(envelope().store.serverProjection.cursor.streamId).toBe(STREAM_B);
  });

  it('an A to B to A identity boundary does not revive a recovery from the first A session', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    const before = ports.storage.get(KEY);
    const held = holdResponse(); const pending = readUsing(caller); await held.started;
    const settlement = pending.then((isPro) => ({ isPro }), (error: unknown) => ({ error }));
    account.beginAccountGenerationBoundary();
    ports.ownerBinding = OWNER_B; ports.userId = 'account-b';
    account.endAccountGenerationBoundary();
    account.beginAccountGenerationBoundary();
    ports.ownerBinding = OWNER_A; ports.userId = 'account-a';
    account.endAccountGenerationBoundary();
    held.release(wire());
    const result = await settlement;
    if (caller === 'query') expect(result).toHaveProperty('error.code', 'ACCOUNT_GENERATION_CHANGED');
    else expect(result).toEqual({ isPro: false });
    expect(ports.storage.get(KEY), 'The same owner binding cannot renew the retired account-generation lease').toBe(before);
    expect(await cachedPaid()).toBe(false);
    respond(wire()); expect(await readUsing(caller)).toBe(true);
  });

  it('a later rejection committed while a recovery write settles cannot publish its captured paid snapshot', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    const commit = gate(); ports.nextCommitGate = commit.port;
    respond(wire()); const pending = readUsing(caller); await commit.entered;
    const secondQueued = deferred<void>(); ports.onMutationQueued = () => secondQueued.resolve();
    respond(malformed('unknown-version')); const rejected = readUsing(caller); await secondQueued.promise;
    const afterWrite = gate(); ports.onCommit = () => { ports.nextOwnerReadGate = afterWrite.port; };
    commit.release();
    // A revoked native write may be rolled back before the owner's post-write
    // read occurs. Otherwise hold that real read until the rejection commits.
    await Promise.race([afterWrite.entered, pending.then(() => undefined)]);
    expect(await rejected).toBe(false);
    expect(envelope().store.serverProtocolRejected).toBe(true);
    afterWrite.release();
    expect.soft(await pending, 'A stale snapshot must not escape after the newer negative commit').toBe(false);
    await restart(); expect(await cachedPaid()).toBe(false);
  });

  it('a stale recovery write cannot erase an existing durable quarantine when the later negative operation fails', async () => {
    respond(wire()); expect(await readUsing(caller)).toBe(true);
    respond(malformed()); expect(await readUsing(caller)).toBe(false);
    expect(envelope().store.serverProtocolRejected).toBe(true);
    const commit = gate(); ports.nextCommitGate = commit.port;
    respond(wire()); const pending = readUsing(caller); await commit.entered;
    const secondQueued = deferred<void>(); ports.onMutationQueued = () => secondQueued.resolve();
    ports.nextMutationReadError = new Error('PRIVATE_KV_READ_FAILED');
    respond(malformed('unknown-version')); const rejected = readUsing(caller); await secondQueued.promise;
    commit.release();
    expect(await rejected).toBe(false);
    expect.soft(await pending, 'Recovery authority was revoked before its pending storage write committed').toBe(false);
    expect.soft(envelope().store.serverProtocolRejected,
      'A stale clear must not erase the previously durable rejection when the later write fails').toBe(true);
    await restart();
    expect.soft(await cachedPaid(), 'The prior successful negative write must remain effective across restart').toBe(false);
    respond(wire()); expect(await readUsing(caller)).toBe(true);
  });
});

describe('atomic merge and SDK protocol-recovery boundaries', () => {
  it('decoded evidence remains stale when rejection lands during the merge pre-read', async () => {
    respond(wire()); expect(await readUsing('query')).toBe(true);
    respond(wire());
    const captured = await store.fetchServerEvidence(context(), new AbortController().signal);
    expect(captured.status).toBe('evidence');
    if (captured.status !== 'evidence') throw new Error('Expected actual parsed evidence');
    const read = gate(); ports.nextReadGate = read.port;
    const merging = store.mergeEntitlementEvidenceBatch(context(), captured.evidence, NOW);
    await read.entered;
    respond(malformed()); expect(await readUsing('query')).toBe(false);
    read.release();
    const merged = await merging;
    expect.soft(merged.snapshot?.activeStoreEntitlement ?? null).toBeNull();
    expect.soft(envelope().store.serverProtocolRejected).toBe(true);
    await restart(); expect.soft(await cachedPaid()).toBe(false);
  });

  it.each(['VERIFIED', 'VERIFIED_ON_DEVICE'] as const)(
    '%s SDK callbacks cannot clear protocol rejection or its newer repeated boundary', async (verification) => {
      respond(wire()); expect(await readUsing('query')).toBe(true);
      respond(malformed()); expect(await readUsing('query')).toBe(false);
      const recovery = holdResponse(); const pending = readUsing('query'); await recovery.started;
      respond(malformed('unknown-version')); expect(await readUsing('query')).toBe(false);
      const entitlement: StoredEntitlement = {
        tier: 'pro', isActive: true, periodType: 'normal', store: 'app_store',
        productId: 'layerwell_pro_monthly', expiresAt: EXPIRY, willRenew: false,
        grantedAt: '2026-10-01T12:00:00.000Z', source: 'revenuecat', environment: 'production',
        verifiedAt: NOW, managementUrl: null, offeringId: null, packageId: null,
      };
      const customerInfo = {
        requestDate: NOW, entitlements: { verification,
          active: { pro: { verification, isActive: true, productIdentifier: 'layerwell_pro_monthly' } }, all: {} },
      } as unknown as Parameters<typeof store.customerInfoToEvidence>[0];
      const setQueryData = vi.fn();
      const sdk = await store.publishCustomerInfoEvidence({ context: context(), customerInfo, entitlement,
        queryClient: { cancelQueries: vi.fn().mockResolvedValue(undefined), setQueryData }, observedAtISO: NOW });
      expect(sdk.snapshot?.activeStoreEntitlement ?? null).toBeNull();
      expect(setQueryData).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ isPro: false }));
      expect(envelope().store.serverProtocolRejected).toBe(true);
      recovery.release(wire());
      expect.soft(await pending).toBe(false);
      await restart(); offline(); expect.soft(await readUsing('compatibility')).toBe(false);
      respond(wire()); expect(await readUsing('query')).toBe(true);
      if (verification === 'VERIFIED') {
        expect(envelope().store.definitive.entitlement.verifiedAt).toBe(NOW);
        expect(envelope().store.serverProjection.cursor.revision).toBe('60');
      }
    },
  );
});
