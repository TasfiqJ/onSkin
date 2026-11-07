import { beforeEach, describe, expect, it, vi } from 'vitest';

// Actual first-party stores, C46/account primitives and UI gates; native ports
// and unrelated domain/rendering shells are controlled. No native-cause claim.
const native = vi.hoisted(() => {
  const bytes = new Map<string, string>();
  return { bytes,
    getAllKeys: vi.fn(async () => [...bytes.keys()]),
    multiRemove: vi.fn(async (keys: readonly string[]) => { for (const key of keys) bytes.delete(key); }),
    getItem: vi.fn(async (key: string) => bytes.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { bytes.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { bytes.delete(key); }),
    multiGet: vi.fn(async (keys: readonly string[]) => keys.map(key => [key, bytes.get(key) ?? null])),
  };
});
const secure = vi.hoisted(() => new Map<string, string>());
const cleanupPorts = vi.hoisted(() => ({ begun: () => {}, fail: false, reminder: async () => {}, encryptedDrain: async () => {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: native }));
vi.mock('expo-secure-store', () => ({
  isAvailableAsync: async () => true,
  getItemAsync: async (key: string) => secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { secure.set(key, value); },
  deleteItemAsync: async (key: string) => { secure.delete(key); },
}));
vi.mock('expo-crypto', async () => {
  const crypto = await import('node:crypto');
  return { randomUUID: crypto.randomUUID, CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    digestStringAsync: async (_: string, value: string) => crypto.createHash('sha256').update(value).digest('hex') };
});
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@/lib/query/queryClient', () => ({ queryClient: { cancelQueries: vi.fn(async () => {}), clear: vi.fn() } }));
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: false, env: { appEnvironment: 'staging' } }));
vi.mock('@/lib/supabase/client', () => ({ supabase: {}, readPersistedSupabaseSessionCandidate: vi.fn() }));
vi.mock('@/features/photos/store', () => ({ clearPhotos: vi.fn() }));
vi.mock('@/lib/consent/dependentConsentLifecycle', () => ({ grantHealthDependentConsent: vi.fn(), isHealthDependentConsentActive: vi.fn() }));

const MARKER = 'layerwell.localDataCleanupRequired.v1';
const UNRELATED = 'layerwell.completions.v1';

beforeEach(() => {
  vi.resetModules(); native.bytes.clear(); secure.clear(); vi.clearAllMocks(); cleanupPorts.begun = () => {}; cleanupPorts.fail = false; cleanupPorts.reminder = async () => {}; cleanupPorts.encryptedDrain = async () => {};
  native.getAllKeys.mockImplementation(async () => [...native.bytes.keys()]);
  native.getItem.mockImplementation(async key => native.bytes.get(key) ?? null);
  native.setItem.mockImplementation(async (key, value) => { native.bytes.set(key, value); });
  native.removeItem.mockImplementation(async key => { native.bytes.delete(key); });
  native.multiGet.mockImplementation(async keys => keys.map(key => [key, native.bytes.get(key) ?? null]));
  native.multiRemove.mockImplementation(async keys => { if (cleanupPorts.fail) throw new Error('SYNTHETIC_CLEANUP_FAILED'); for (const key of keys) native.bytes.delete(key); });
});

async function runtime() {
  const kv = await import('@/lib/storage/privateKV');
  const marker = await import('@/lib/auth/localAccountIsolation');
  const account = await import('@/lib/auth/accountGeneration');
  const age = await import('@/features/onboarding/ageGateStore');
  const { AGE_POLICY_RECEIPT_KEY } = await import('@/features/onboarding/ageGate');
  const epoch = await import('@/lib/consent/healthProcessingEpoch');
  const arm = () => account.runAccountGenerationOperation(lease => marker.armPrivateMutation46(UNRELATED, lease.assertCurrent, 'synthetic-owner05'));
  return { kv, marker, account, age, key: AGE_POLICY_RECEIPT_KEY, epoch, arm };
}
type Runtime = Awaited<ReturnType<typeof runtime>>;
type Consumer = 'outer' | 'age';
const seed = async (r: Runtime) => { await r.age.setAgeVerified(true); expect(await r.age.getAgePolicyReceiptStatus()).toBe('current'); };

function holdNativeRead(r: Runtime, kind: Consumer) {
  let entered!: () => void; let release!: () => void; let once = false;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  if (kind === 'outer') native.getAllKeys.mockImplementationOnce(async () => {
    const captured = [...native.bytes.keys()]; entered(); await held; return captured;
  });
  else native.getItem.mockImplementation(async key => {
    const captured = native.bytes.get(key) ?? null;
    if (key === r.key && !once) { once = true; entered(); await held; }
    return captured;
  });
  return { ready, release };
}

vi.mock('@/features/notifications/deliver', () => ({ scheduleTrialReminder: vi.fn(async () => { await cleanupPorts.reminder(); }), waitForHealthNotificationOperationsToSettle: vi.fn(async () => {}) }));
vi.mock('@/features/notifications/nativeMutation', () => ({ clearNativeNotificationsForAccountIsolation: vi.fn(async () => {}) }));
vi.mock('@/features/photos/encryptedStorage', () => ({ beginEncryptedPhotoAccountBoundary: () => cleanupPorts.begun(), endEncryptedPhotoAccountBoundary: vi.fn(), waitForEncryptedPhotoWritesToSettle: vi.fn(async () => { await cleanupPorts.encryptedDrain(); }), clearEncryptedPhotoStorage: vi.fn(async () => {}) }));
vi.mock('@/features/photos/sensitiveImageMemory', () => ({ purgeSensitiveImageMemory: vi.fn(async () => {}) }));
vi.mock('@/features/settings/localPrivateData', () => ({ clearGeneratedPrivateCacheFiles: vi.fn(async () => {}) }));
vi.mock('@/features/widgets/lifecycleCoordinator', () => ({ clearRoutineWidgetLifecycleForPrivacy: vi.fn(async () => {}) }));
vi.mock('@/lib/analytics/track', () => ({ resetAnalyticsIdentity: vi.fn(async () => {}) }));
vi.mock('@/lib/storage/plaintextStaging', () => ({ scavengePlaintextStaging: vi.fn(async () => {}) }));
vi.mock('@/features/photos/photoDeleteRemoteCleanup', () => ({ erasePhotoDeleteRemoteCleanupForOwner: vi.fn(async () => {}) }));

async function realCleanupOverlap(r: Runtime, failed = false) {
  const before = native.bytes.get(r.key);
  let entered!: () => void;
  const boundaryEntered = new Promise<void>(resolve => { entered = resolve; });
  cleanupPorts.begun = entered;
  cleanupPorts.fail = failed;
  const held = holdNativeRead(r, 'age');
  const status = r.age.getAgePolicyReceiptStatus();
  await held.ready;
  const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
  void cleanup.catch(() => {});
  await boundaryEntered;
  held.release();
  return { status, cleanup, before };
}

async function verifyPendingReminderEntry39(kind: Consumer, failed: boolean) {
  const r = await runtime(); await seed(r);
  let reminder!: () => void; let releaseReminder!: () => void; let reads = 0; let inventories = 0;
  const reminderReady = new Promise<void>(resolve => { reminder = resolve; });
  const reminderHeld = new Promise<void>(resolve => { releaseReminder = resolve; });
  cleanupPorts.reminder = async () => { reminder(); await reminderHeld; if (failed) throw new Error('SYNTHETIC_LATE_REMINDER_FAILURE'); };
  native.getItem.mockImplementation(async key => { if (key === r.key) reads += 1; return native.bytes.get(key) ?? null; });
  native.getAllKeys.mockImplementation(async () => { inventories += 1; return [...native.bytes.keys()]; });
  const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
  void cleanup.catch(() => {});
  await reminderReady;
  let settled = false;
  const gate = kind === 'age' ? r.age.getAgePolicyReceiptStatus() : r.kv.verifyPrivateKVWhenReady();
  void gate.then(() => { settled = true; }, () => { settled = true; });
  // One host turn drains the controlled Promise-only native ports; no timed wait.
  await new Promise<void>(resolve => setImmediate(resolve));
  const beforeSettlement = { settled, reads, inventories };
  releaseReminder();
  if (failed) await expect(cleanup).rejects.toThrow('HEALTH_PURPOSE_LOCAL_CLEAR_FAILED');
  else await cleanup;
  if (kind === 'age') expect(await gate).toBe(failed ? 'unavailable' : 'current');
  else if (failed) await expect(gate).rejects.toThrow('PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY');
  else await expect(gate).resolves.toBeUndefined();
  expect(beforeSettlement).toEqual({ settled: false, reads: 0, inventories: 0 });
  expect(reads).toBe(kind === 'age' && !failed ? 1 : 0);
  expect(inventories).toBe(kind === 'outer' && !failed ? 1 : 0);
  // A settled historical ticket is not a permanent storage admission lock.
  if (kind === 'age') expect(await r.age.getAgePolicyReceiptStatus()).toBe('current');
  else await expect(r.kv.verifyPrivateKVWhenReady()).resolves.toBeUndefined();
  expect(reads).toBe(kind === 'age' ? (failed ? 1 : 2) : 0);
  expect(inventories).toBe(kind === 'outer' ? (failed ? 1 : 2) : 0);
}

describe('Native39 real account-boundary age-read schedule; holder attribution remains separate', () => {
  it('ENTRY V4: a same-identity nested boundary makes both fresh gates refuse through the pending reminder', async () => {
    const r = await runtime(); await seed(r);
    let reminder!: () => void; let releaseReminder!: () => void; let reads = 0; let inventories = 0;
    const reminderReady = new Promise<void>(resolve => { reminder = resolve; });
    const reminderHeld = new Promise<void>(resolve => { releaseReminder = resolve; });
    cleanupPorts.begun = () => { r.kv.beginPrivateKVAccountBoundary(); r.kv.endPrivateKVAccountBoundary(); };
    cleanupPorts.reminder = async () => { reminder(); await reminderHeld; };
    native.getItem.mockImplementation(async key => { if (key === r.key) reads += 1; return native.bytes.get(key) ?? null; });
    native.getAllKeys.mockImplementation(async () => { inventories += 1; return [...native.bytes.keys()]; });
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    void cleanup.catch(() => {}); await reminderReady;
    const age = r.age.getAgePolicyReceiptStatus();
    const whole = r.kv.verifyPrivateKVWhenReady(); void whole.catch(() => {});
    let wholeRefused = false;
    try { await whole; } catch (error) { wholeRefused = error instanceof Error && error.message === 'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY'; }
    const ageStatus = await age;
    const whilePending = { reads, inventories };
    releaseReminder(); await cleanup;
    expect(ageStatus).toBe('unavailable'); expect(wholeRefused).toBe(true);
    expect(whilePending).toEqual({ reads: 0, inventories: 0 });
    expect(await r.age.getAgePolicyReceiptStatus()).toBe('current');
    await expect(r.kv.verifyPrivateKVWhenReady()).resolves.toBeUndefined();
  });
  it('ENTRY V3: an age gate waits through the reopened reminder interval before a successful owned cleanup', async () => {
    await verifyPendingReminderEntry39('age', false);
  });
  it('ENTRY V3: an age gate remains unavailable when that pending owned cleanup later fails', async () => {
    await verifyPendingReminderEntry39('age', true);
  });
  it('ENTRY V3: a whole-envelope gate waits for successful full owned cleanup before its first inventory', async () => {
    await verifyPendingReminderEntry39('outer', false);
  });
  it('ENTRY V3: a whole-envelope gate cannot pass before pending owned cleanup fails', async () => {
    await verifyPendingReminderEntry39('outer', true);
  });
  it('REVIEW NEGATIVE: a generic transition before the owned cleanup cannot be crossed', async () => {
    const r = await runtime(); await seed(r);
    let boundary!: () => void; const boundaryReady = new Promise<void>(resolve => { boundary = resolve; }); cleanupPorts.begun = boundary;
    const held = holdNativeRead(r, 'age'); const status = r.age.getAgePolicyReceiptStatus(); await held.ready;
    r.kv.beginPrivateKVAccountBoundary(); r.kv.endPrivateKVAccountBoundary();
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    await boundaryReady; held.release(); await cleanup; expect(await status).toBe('unavailable');
  });

  it('REVIEW NEGATIVE: a prior owned operation still awaiting its reminder cannot be replaced', async () => {
    const r = await runtime(); await seed(r);
    let reminder!: () => void; let releaseReminder!: () => void; let secondBoundary!: () => void; let calls = 0; let begins = 0;
    const reminderReady = new Promise<void>(resolve => { reminder = resolve; }); const reminderHeld = new Promise<void>(resolve => { releaseReminder = resolve; });
    const secondReady = new Promise<void>(resolve => { secondBoundary = resolve; });
    cleanupPorts.reminder = async () => { if (++calls === 1) { reminder(); await reminderHeld; } };
    cleanupPorts.begun = () => { if (++begins === 2) secondBoundary(); };
    const clear = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData;
    const first = clear('synthetic-owner39'); void first.catch(() => {}); await reminderReady;
    let reads = 0;
    native.getItem.mockImplementation(async key => { if (key === r.key) reads += 1; return native.bytes.get(key) ?? null; });
    const status = r.age.getAgePolicyReceiptStatus();
    const second = clear('synthetic-owner39'); void second.catch(() => {}); await secondReady;
    releaseReminder(); await first.catch(() => {}); await second;
    expect(await status).toBe('unavailable'); expect(reads).toBe(0);
  });

  it('REVIEW NEGATIVE: an Auth ABA microtask after settlement cannot start a renewed native age read', async () => {
    const r = await runtime(); await seed(r);
    let entered!: () => void; let release!: () => void; let boundary!: () => void; let reads = 0;
    const ready = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    const boundaryReady = new Promise<void>(resolve => { boundary = resolve; }); cleanupPorts.begun = boundary;
    native.getItem.mockImplementation(async key => { const raw = native.bytes.get(key) ?? null; if (key === r.key) { reads += 1; if (reads === 1) { entered(); await held; } } return raw; });
    const status = r.age.getAgePolicyReceiptStatus(); await ready;
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    const rotated = cleanup.then(() => { r.account.beginAccountGenerationBoundary(); r.account.endAccountGenerationBoundary(); });
    await boundaryReady; release(); await rotated;
    expect(await status).toBe('unavailable'); expect(reads).toBe(1);
  });

  it('a failed actual cleanup cannot reopen the whole-envelope verifier', async () => {
    const r = await runtime(); await seed(r); cleanupPorts.fail = true;
    let entered!: () => void; let release!: () => void; let boundary!: () => void; let inventories = 0;
    const ready = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    const boundaryReady = new Promise<void>(resolve => { boundary = resolve; }); cleanupPorts.begun = boundary;
    native.getAllKeys.mockImplementation(async () => { const keys = [...native.bytes.keys()]; inventories += 1; if (inventories === 1) { entered(); await held; } return keys; });
    const pending = r.kv.verifyPrivateKVWhenReady(); void pending.catch(() => {}); await ready;
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39'); void cleanup.catch(() => {});
    await boundaryReady; release(); await expect(cleanup).rejects.toThrow('HEALTH_PURPOSE_LOCAL_CLEAR_FAILED');
    await expect(pending).rejects.toThrow('ACCOUNT_GENERATION_CHANGED'); expect(inventories).toBe(1);
  });

  it('a native counterfeit lease-class error is not first-party guard provenance', async () => {
    const r = await runtime(); await seed(r); const failure = new r.account.AccountGenerationLeaseError();
    let entered!: () => void; let release!: () => void; let boundary!: () => void; let inventories = 0;
    const ready = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    const boundaryReady = new Promise<void>(resolve => { boundary = resolve; }); cleanupPorts.begun = boundary;
    native.getAllKeys.mockImplementation(async () => { inventories += 1; if (inventories === 1) { entered(); await held; throw failure; } return [...native.bytes.keys()]; });
    const pending = r.kv.verifyPrivateKVWhenReady(); void pending.catch(() => {}); await ready;
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    await boundaryReady; release(); await cleanup; await expect(pending).rejects.toBe(failure); expect(inventories).toBe(1);
  });

  it('ordinary unowned private boundaries do not reopen a held full inventory', async () => {
    const r = await runtime(); await seed(r);
    let entered!: () => void; let release!: () => void; let inventories = 0;
    const ready = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    native.getAllKeys.mockImplementation(async () => { const keys = [...native.bytes.keys()]; inventories += 1; if (inventories === 1) { entered(); await held; } return keys; });
    const pending = r.kv.verifyPrivateKVWhenReady(); void pending.catch(() => {}); await ready;
    r.kv.beginPrivateKVAccountBoundary(); release();
    try { await expect(pending).rejects.toThrow('PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY'); expect(inventories).toBe(1); }
    finally { r.kv.endPrivateKVAccountBoundary(); }
  });

  it('C46 retirement of the fresh full inventory cannot cause a third scan', async () => {
    const r = await runtime(); await seed(r);
    let first!: () => void; let second!: () => void; let releaseFirst!: () => void; let releaseSecond!: () => void; let boundary!: () => void; let inventories = 0;
    const one = new Promise<void>(resolve => { first = resolve; }); const two = new Promise<void>(resolve => { second = resolve; });
    const heldOne = new Promise<void>(resolve => { releaseFirst = resolve; }); const heldTwo = new Promise<void>(resolve => { releaseSecond = resolve; });
    const boundaryReady = new Promise<void>(resolve => { boundary = resolve; }); cleanupPorts.begun = boundary;
    native.getAllKeys.mockImplementation(async () => { const keys = [...native.bytes.keys()]; inventories += 1; if (inventories === 1) { first(); await heldOne; } else if (inventories === 2) { second(); await heldTwo; } return keys; });
    const pending = r.kv.verifyPrivateKVWhenReady(); void pending.catch(() => {}); await one;
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    await boundaryReady; releaseFirst(); await cleanup; await two;
    const token = await r.arm(); await r.marker.finishPrivateMutation46(token); releaseSecond();
    await expect(pending).rejects.toThrow('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED'); expect(inventories).toBe(2);
  });
  it('WHOLE RED: actual owned cleanup retires a held full inventory and permits only a fresh complete verification', async () => {
    const r = await runtime(); await seed(r);
    let entered!: () => void; let release!: () => void; let boundary!: () => void; let inventories = 0;
    const ready = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    const boundaryReady = new Promise<void>(resolve => { boundary = resolve; }); cleanupPorts.begun = boundary;
    native.getAllKeys.mockImplementation(async () => { const keys = [...native.bytes.keys()]; inventories += 1; if (inventories === 1) { entered(); await held; } return keys; });
    const pending = r.kv.verifyPrivateKVWhenReady(); void pending.catch(() => {}); await ready;
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    await boundaryReady; release(); await cleanup;
    await expect(pending).resolves.toBeUndefined(); expect(inventories).toBe(2);
  });
  it('preserves the exact raw guard while a native age read spans an active private boundary', async () => {
    const r = await runtime(); await seed(r); const before = native.bytes.get(r.key);
    const held = holdNativeRead(r, 'age'); const read = r.kv.getPrivateItem(r.key); void read.catch(() => {});
    await held.ready; r.kv.beginPrivateKVAccountBoundary(); held.release();
    try { await expect(read).rejects.toThrow('PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY'); }
    finally { r.kv.endPrivateKVAccountBoundary(); }
    expect(native.bytes.get(r.key)).toBe(before);
    expect(await r.age.getAgePolicyReceiptStatus()).toBe('current');
  });

  it('keeps an unknown ordinary begin/end boundary unavailable and does not reinterpret it as absence', async () => {
    const r = await runtime(); await seed(r); const before = native.bytes.get(r.key);
    const held = holdNativeRead(r, 'age'); const status = r.age.getAgePolicyReceiptStatus();
    await held.ready; r.kv.beginPrivateKVAccountBoundary(); held.release();
    try { expect(await status).toBe('unavailable'); }
    finally { r.kv.endPrivateKVAccountBoundary(); }
    expect(native.bytes.get(r.key)).toBe(before);
  });

  it('RED: a successful actual owned health cleanup settles outside both registries before one fresh age read', async () => {
    const r = await runtime(); await seed(r);
    const overlap = await realCleanupOverlap(r);
    await expect(overlap.cleanup).resolves.toBeUndefined();
    expect(await overlap.status).toBe('current');
    expect(native.bytes.get(r.key)).toBe(overlap.before);
    expect(r.epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  it('failed actual health cleanup remains unavailable with the age ciphertext retained', async () => {
    const r = await runtime(); await seed(r);
    const overlap = await realCleanupOverlap(r, true);
    await expect(overlap.cleanup).rejects.toThrow('HEALTH_PURPOSE_LOCAL_CLEAR_FAILED');
    expect(await overlap.status).toBe('unavailable');
    expect(native.bytes.get(r.key)).toBe(overlap.before);
  });

  it('Auth identity advancement during actual cleanup cannot borrow a fresh age read', async () => {
    const r = await runtime(); await seed(r);
    const beforeIdentity = r.account.captureAccountIdentityGeneration();
    const prior = cleanupPorts.begun;
    const held = holdNativeRead(r, 'age'); const status = r.age.getAgePolicyReceiptStatus();
    await held.ready;
    let entered!: () => void; const ready = new Promise<void>(resolve => { entered = resolve; });
    cleanupPorts.begun = () => { r.account.beginAccountGenerationBoundary(); entered(); };
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    void cleanup.catch(() => {}); await ready; held.release();
    await cleanup.catch(() => {}); r.account.endAccountGenerationBoundary(); cleanupPorts.begun = prior;
    expect(r.account.captureAccountIdentityGeneration()).toBeGreaterThan(beforeIdentity);
    expect(await status).toBe('unavailable');
  });

  it('waits through the real post-boundary reminder before declaring cleanup successful', async () => {
    const r = await runtime(); await seed(r);
    let entered!: () => void; let release!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    cleanupPorts.reminder = async () => { entered(); await held; };
    const overlap = await realCleanupOverlap(r); await ready;
    let settled = false; void overlap.status.then(() => { settled = true; });
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    expect(settled).toBe(false);
    release(); await overlap.cleanup;
    expect(await overlap.status).toBe('current');
  });

  it('a post-boundary reminder failure never makes the owned cleanup eligible', async () => {
    const r = await runtime(); await seed(r);
    cleanupPorts.reminder = async () => { throw new Error('SYNTHETIC_REMINDER_FAILURE'); };
    const overlap = await realCleanupOverlap(r);
    await expect(overlap.cleanup).rejects.toThrow('HEALTH_PURPOSE_LOCAL_CLEAR_FAILED');
    expect(await overlap.status).toBe('unavailable');
    expect(native.bytes.get(r.key)).toBe(overlap.before);
  });

  it('a generic nested boundary remains ineligible after actual cleanup reports success', async () => {
    const r = await runtime(); await seed(r);
    let entered!: () => void; const ready = new Promise<void>(resolve => { entered = resolve; });
    cleanupPorts.begun = () => {
      r.kv.beginPrivateKVAccountBoundary();
      r.kv.endPrivateKVAccountBoundary();
      entered();
    };
    const held = holdNativeRead(r, 'age'); const status = r.age.getAgePolicyReceiptStatus(); await held.ready;
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    await ready; held.release(); await cleanup;
    expect(await status).toBe('unavailable');
  });

  it('a new age check during an explicitly owned cleanup starts no private operation until settlement', async () => {
    const r = await runtime(); await seed(r);
    let entered!: () => void; let release!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    cleanupPorts.encryptedDrain = async () => { entered(); await held; };
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    await ready; let reads = 0;
    native.getItem.mockImplementation(async key => { if (key === r.key) reads += 1; return native.bytes.get(key) ?? null; });
    const status = r.age.getAgePolicyReceiptStatus();
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    expect(reads).toBe(0);
    release(); await cleanup; expect(await status).toBe('current'); expect(reads).toBe(1);
  });

  it('does not launder a counterfeit native boundary error through a genuine owned generation change', async () => {
    const r = await runtime(); await seed(r); const failure = new Error('PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY');
    let entered!: () => void; let release!: () => void; let boundary!: () => void; let reads = 0;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const boundaryReady = new Promise<void>(resolve => { boundary = resolve; }); cleanupPorts.begun = boundary;
    native.getItem.mockImplementation(async key => {
      if (key === r.key) { reads += 1; if (reads === 1) { entered(); await held; throw failure; } }
      return native.bytes.get(key) ?? null;
    });
    const getter = (r.kv as typeof r.kv & { getPrivateItemWhenReady?: typeof r.kv.getPrivateItem }).getPrivateItemWhenReady ?? r.kv.getPrivateItem;
    const pending = getter(r.key); void pending.catch(() => {}); await ready;
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    await boundaryReady; release();
    await expect(pending).rejects.toBe(failure); await cleanup; expect(reads).toBe(1);
  });

  it('a second boundary during the one fresh read stays closed without a third native age read', async () => {
    const r = await runtime(); await seed(r);
    let first!: () => void; let second!: () => void; let releaseFirst!: () => void; let releaseSecond!: () => void; let boundary!: () => void; let reads = 0;
    const one = new Promise<void>(resolve => { first = resolve; }); const two = new Promise<void>(resolve => { second = resolve; });
    const heldOne = new Promise<void>(resolve => { releaseFirst = resolve; }); const heldTwo = new Promise<void>(resolve => { releaseSecond = resolve; });
    const boundaryReady = new Promise<void>(resolve => { boundary = resolve; }); cleanupPorts.begun = boundary;
    native.getItem.mockImplementation(async key => {
      const raw = native.bytes.get(key) ?? null;
      if (key === r.key) { reads += 1; if (reads === 1) { first(); await heldOne; } else if (reads === 2) { second(); await heldTwo; } }
      return raw;
    });
    const status = r.age.getAgePolicyReceiptStatus(); await one;
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    await boundaryReady; releaseFirst(); await cleanup; await two;
    r.kv.beginPrivateKVAccountBoundary(); releaseSecond();
    try { expect(await status).toBe('unavailable'); expect(reads).toBe(2); }
    finally { r.kv.endPrivateKVAccountBoundary(); }
  });

  it('a failed real C46 marker created after reopening prevents the fresh read', async () => {
    const r = await runtime(); await seed(r);
    let entered!: () => void; let release!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    cleanupPorts.reminder = async () => { entered(); await held; };
    const overlap = await realCleanupOverlap(r); await ready;
    const token = await r.arm(); r.marker.abandonPrivateMutation46(token); const marker = native.bytes.get(MARKER);
    release(); await overlap.cleanup; expect(await overlap.status).toBe('unavailable'); expect(native.bytes.get(MARKER)).toBe(marker);
  });

  it('C46 retirement during the one post-cleanup fresh read cannot consume a third read', async () => {
    const r = await runtime(); await seed(r);
    let first!: () => void; let second!: () => void; let releaseFirst!: () => void; let releaseSecond!: () => void; let boundary!: () => void; let reads = 0;
    const one = new Promise<void>(resolve => { first = resolve; }); const two = new Promise<void>(resolve => { second = resolve; });
    const heldOne = new Promise<void>(resolve => { releaseFirst = resolve; }); const heldTwo = new Promise<void>(resolve => { releaseSecond = resolve; });
    const boundaryReady = new Promise<void>(resolve => { boundary = resolve; }); cleanupPorts.begun = boundary;
    native.getItem.mockImplementation(async key => {
      const raw = native.bytes.get(key) ?? null;
      if (key === r.key) { reads += 1; if (reads === 1) { first(); await heldOne; } else if (reads === 2) { second(); await heldTwo; } }
      return raw;
    });
    const status = r.age.getAgePolicyReceiptStatus(); await one;
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    await boundaryReady; releaseFirst(); await cleanup; await two;
    const token = await r.arm(); await r.marker.finishPrivateMutation46(token); releaseSecond();
    expect(await status).toBe('unavailable'); expect(reads).toBe(2);
  });

  it.each(['revoke', 'regrant'] as const)('the original health lease remains closed through successful cleanup and %s', async mode => {
    const r = await runtime(); const owner = await import('@/lib/auth/sessionOwner');
    await owner.claimLocalDataOwnership('synthetic-owner39'); const binding = await owner.localDataOwnerBinding('synthetic-owner39');
    const options = await r.account.runAccountGenerationOperation(lease => ({ownerUserId:'synthetic-owner39',ownerBinding:binding,accountGeneration:lease.generation,identityGeneration:r.account.captureAccountIdentityGeneration()}));
    r.epoch.setActiveHealthProcessingEpoch(1, options); await r.kv.setPrivateItem(UNRELATED, 'synthetic retained facts');
    let entered!: () => void; let release!: () => void; let boundary!: () => void; let reminder!: () => void; let releaseReminder!: () => void; let reads = 0;
    const ready = new Promise<void>(resolve => { entered = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    const boundaryReady = new Promise<void>(resolve => { boundary = resolve; }); const reminderReady = new Promise<void>(resolve => { reminder = resolve; }); const reminderHeld = new Promise<void>(resolve => { releaseReminder = resolve; });
    cleanupPorts.begun = boundary; cleanupPorts.reminder = async () => { reminder(); await reminderHeld; };
    native.getItem.mockImplementation(async key => { const raw = native.bytes.get(key) ?? null; if (key === UNRELATED) { reads += 1; if (reads === 1) { entered(); await held; } } return raw; });
    const getter = (r.kv as typeof r.kv & { getPrivateItemWhenReady?: typeof r.kv.getPrivateItem }).getPrivateItemWhenReady ?? r.kv.getPrivateItem;
    const pending = getter(UNRELATED); void pending.catch(() => {}); await ready;
    const cleanup = (await import('@/features/healthConsent/selectiveCleanup')).clearHealthPurposeLocalData('synthetic-owner39');
    await boundaryReady; release(); await reminderReady;
    if (mode === 'regrant') {
      const current = await r.account.runAccountGenerationOperation(lease => ({...options,accountGeneration:lease.generation}));
      r.epoch.setActiveHealthProcessingEpoch(1, current);
    }
    releaseReminder(); await cleanup; await expect(pending).rejects.toThrow(); expect(reads).toBe(1);
  });
});

