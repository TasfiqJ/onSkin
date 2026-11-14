import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ElementType, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// Actual first-party stores, C46/account primitives and UI gates; native ports
// and unrelated domain/rendering shells are controlled. No native-cause claim.
const native = vi.hoisted(() => {
  const bytes = new Map<string, string>();
  return { bytes,
    getAllKeys: vi.fn(async () => [...bytes.keys()]),
    getItem: vi.fn(async (key: string) => bytes.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { bytes.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { bytes.delete(key); }),
    multiGet: vi.fn(async (keys: readonly string[]) => keys.map(key => [key, bytes.get(key) ?? null])),
  };
});
const secure = vi.hoisted(() => new Map<string, string>());
const ui = vi.hoisted(() => ({ listeners: new Set<(value: string) => void>(), replace: vi.fn(), setQueryData: vi.fn() }));
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
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' }, View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable',
  AppState: { currentState: 'active', addEventListener: (_: string, listener: (value: string) => void) => {
    ui.listeners.add(listener); return { remove: () => { ui.listeners.delete(listener); } };
  } },
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
vi.mock('expo-router', () => ({ router: { replace: ui.replace }, useUnstableGlobalHref: () => '/onboarding/consent', useSegments: () => ['onboarding', 'consent'] }));
vi.mock('@/components/ui', () => ({ Button: 'Button', StateLoading: 'StateLoading', StateNotice: 'StateNotice', Screen: 'Screen', Text: 'Text' }));
vi.mock('@/lib/applock/AppLockProvider', () => ({ useAppLock: () => ({ appUnlocked: true }) }));
vi.mock('@/lib/query/queryClient', () => ({ queryClient: { setQueryData: ui.setQueryData, getQueryCache: () => ({ subscribe: () => () => {} }) } }));
vi.mock('@/theme/tokens', () => ({ colors: { paper: '#fff', ink: '#111' } }));
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: false, env: { appEnvironment: 'staging' } }));
vi.mock('@/lib/supabase/client', () => ({ supabase: {}, readPersistedSupabaseSessionCandidate: vi.fn() }));
vi.mock('@/features/photos/store', () => ({ clearPhotos: vi.fn() }));
vi.mock('@/lib/consent/dependentConsentLifecycle', () => ({ grantHealthDependentConsent: vi.fn(), isHealthDependentConsentActive: vi.fn() }));

const RECOVERY = 'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED';
const MARKER = 'layerwell.localDataCleanupRequired.v1';
const UNRELATED = 'layerwell.completions.v1';
const hostType = (name: string) => name as ElementType;
function gateElement<P extends { children: ReactNode }>(
  Gate: (props: P) => ReactNode, props: Omit<P, 'children'>, child: ReactNode,
) {
  // React supplies the required children through its standard variadic argument.
  return createElement(Gate, props as P, child);
}
let renderer: ReactTestRenderer | null = null;

beforeEach(() => {
  vi.resetModules(); native.bytes.clear(); secure.clear(); vi.clearAllMocks();
  native.getAllKeys.mockImplementation(async () => [...native.bytes.keys()]);
  native.getItem.mockImplementation(async key => native.bytes.get(key) ?? null);
  native.setItem.mockImplementation(async (key, value) => { native.bytes.set(key, value); });
  native.removeItem.mockImplementation(async key => { native.bytes.delete(key); });
  native.multiGet.mockImplementation(async keys => keys.map(key => [key, native.bytes.get(key) ?? null]));
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (renderer) await act(async () => { renderer!.unmount(); });
  renderer = null; ui.listeners.clear(); vi.useRealTimers();
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
const consume = (r: Runtime, kind: Consumer) => kind === 'outer' ? r.kv.assertPrivateKVReadable() : r.kv.getPrivateItem(r.key);
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

describe('C05 actual outer/age consumers — source reproduction, not native diagnosis', () => {
  it('distinguishes genuine missing receipt from a stable encrypted current receipt', async () => {
    const r = await runtime();
    await expect(r.kv.assertPrivateKVReadable()).resolves.toBeUndefined();
    expect(await r.age.getAgePolicyReceiptStatus()).toBe('missing');
    expect(secure.size).toBe(0);
    await seed(r);
    const before = [...native.bytes];
    await expect(r.kv.assertPrivateKVReadable()).resolves.toBeUndefined();
    expect([...native.bytes]).toEqual(before);
    expect(r.epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  it.each(['outer', 'age'] as const)('%s rejects a real known-live unrelated claim, then a fresh read succeeds after finish', async kind => {
    const r = await runtime(); await seed(r);
    const token = await r.arm();
    await expect(consume(r, kind)).rejects.toThrow(RECOVERY);
    expect(native.bytes.has(MARKER)).toBe(true);
    await r.marker.finishPrivateMutation46(token);
    await expect(consume(r, kind)).resolves.not.toBeNull();
    expect(r.epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  it.each(['outer', 'age'] as const)('%s rejects its captured native snapshot after a complete real arm/finish ABA', async kind => {
    const r = await runtime(); await seed(r);
    const h = holdNativeRead(r, kind); const pending = consume(r, kind); void pending.catch(() => {});
    await h.ready; const generation = r.marker.privateMutationReadGeneration46();
    const token = await r.arm(); await r.marker.finishPrivateMutation46(token);
    expect(r.marker.privateMutationReadGeneration46()).toBeGreaterThan(generation);
    expect(native.bytes.has(MARKER)).toBe(false); h.release();
    await expect(pending).rejects.toThrow(RECOVERY);
    await expect(consume(r, kind)).resolves.not.toBeNull();
  });

  it.each(['outer', 'age'] as const)('%s is retired by the actual absent-cloud-preference startup callback without changed receipt bytes', async kind => {
    const r = await runtime(); await seed(r);
    const { clearUnavailableCloudBackupPreference } = await import('@/features/photos/consent');
    const before = [...native.bytes]; const generation = r.marker.privateMutationReadGeneration46();
    const h = holdNativeRead(r, kind); const pending = consume(r, kind); void pending.catch(() => {});
    await h.ready; await clearUnavailableCloudBackupPreference();
    expect(native.bytes.has('layerwell.photos.cloudBackup')).toBe(false);
    expect([...native.bytes]).toEqual(before);
    expect(r.marker.privateMutationReadGeneration46()).toBe(generation + 2);
    h.release(); await expect(pending).rejects.toThrow(RECOVERY);
    await expect(consume(r, kind)).resolves.not.toBeNull();
  });

  it('CONSUMER age read waits for known writer settlement without inventing missing data', async () => {
    const r = await runtime(); await seed(r); const before = native.bytes.get(r.key); const token = await r.arm();
    let settled = false; const pending = r.age.getAgePolicyReceiptStatus().then(value => { settled = true; return value; });
    for (let index = 0; index < 24; index++) await Promise.resolve();
    try { expect(settled).toBe(false); } finally { await r.marker.finishPrivateMutation46(token); }
    expect(await pending).toBe('current');
    expect(native.bytes.get(r.key)).toBe(before);
    expect(r.epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  it.each(['outer', 'age'] as const)('%s preserves an original native-style rejection object instead of making absence', async kind => {
    const r = await runtime(); await seed(r); const before = [...native.bytes];
    const failure = { code: 'E_NATIVE_TEST05', nativeErrorCode: -34018, message: 'synthetic private text must not enter a trace', cause: { code: 'E_INNER_TEST05' } };
    if (kind === 'outer') native.getAllKeys.mockRejectedValueOnce(failure);
    else native.getItem.mockImplementation(async key => { if (key === r.key) throw failure; return native.bytes.get(key) ?? null; });
    await expect(consume(r, kind)).rejects.toBe(failure);
    if (kind === 'age') expect(await r.age.getAgePolicyReceiptStatus()).toBe('unavailable');
    expect([...native.bytes]).toEqual(before);
  });

  it('content-key loss is unavailable, distinct from missing receipt, with ciphertext retained', async () => {
    const r = await runtime(); await seed(r); const before = [...native.bytes]; secure.clear();
    await expect(r.kv.getPrivateItem(r.key)).rejects.toThrow('PRIVATE_KV_CONTENT_KEY_MISSING');
    await expect(r.kv.assertPrivateKVReadable()).rejects.toThrow('PRIVATE_KV_CONTENT_KEY_MISSING');
    expect(await r.age.getAgePolicyReceiptStatus()).toBe('unavailable');
    expect([...native.bytes]).toEqual(before);
  });

  it.each(['malformed', 'unsupported', 'authentication'] as const)('preserves %s envelope failure as closed data, never missing', async mode => {
    const r = await runtime(); await seed(r); const envelope = JSON.parse(native.bytes.get(r.key)!);
    const code = mode === 'malformed' ? 'PRIVATE_KV_ENVELOPE_INVALID' : mode === 'unsupported' ? 'PRIVATE_KV_ENVELOPE_UNSUPPORTED' : 'PRIVATE_KV_DECRYPTION_FAILED';
    if (mode === 'malformed') envelope.nonceHex = '00';
    if (mode === 'unsupported') envelope.version = 'xchacha20poly1305:v99';
    if (mode === 'authentication') envelope.ciphertextHex = (envelope.ciphertextHex.startsWith('00') ? '01' : '00') + envelope.ciphertextHex.slice(2);
    const bytes = JSON.stringify(envelope); native.bytes.set(r.key, bytes);
    await expect(r.kv.getPrivateItem(r.key)).rejects.toThrow(code);
    await expect(r.kv.assertPrivateKVReadable()).rejects.toThrow(code);
    expect(await r.age.getAgePolicyReceiptStatus()).toBe('unavailable');
    expect(native.bytes.get(r.key)).toBe(bytes);
  });

  it.each(['failed', 'orphan'] as const)('retains %s real mutation marker and keeps both readers closed', async mode => {
    let r = await runtime(); await seed(r); const token = await r.arm();
    if (mode === 'failed') r.marker.abandonPrivateMutation46(token);
    else { vi.resetModules(); r = await runtime(); }
    const before = [...native.bytes];
    await expect(r.kv.assertPrivateKVReadable()).rejects.toThrow(RECOVERY);
    await expect(r.kv.getPrivateItem(r.key)).rejects.toThrow(RECOVERY);
    expect(await r.age.getAgePolicyReceiptStatus()).toBe('unavailable');
    expect([...native.bytes]).toEqual(before);
  });

  it.each(['outer', 'age'] as const)('%s refuses its original account boundary after a held native read', async kind => {
    const r = await runtime(); await seed(r); const before = [...native.bytes];
    const h = holdNativeRead(r, kind); const pending = consume(r, kind); void pending.catch(() => {}); await h.ready;
    if (kind === 'outer') { r.account.beginAccountGenerationBoundary(); r.account.endAccountGenerationBoundary(); }
    else { r.kv.beginPrivateKVAccountBoundary(); r.kv.endPrivateKVAccountBoundary(); }
    h.release(); await expect(pending).rejects.toThrow(kind === 'outer' ? 'ACCOUNT_GENERATION_CHANGED' : 'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY');
    expect([...native.bytes]).toEqual(before);
  });

  it('CONSUMER mounted outer gate waits safely for a known writer and then opens', async () => {
    const r = await runtime(); await seed(r); const token = await r.arm();
    const { PrivateDataAvailabilityGate } = await import('@/lib/storage/PrivateDataAvailabilityGate');
    vi.useFakeTimers();
    await act(async () => { renderer = create(gateElement(PrivateDataAvailabilityGate, {}, createElement('AllowedChild'))); });
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    try {
      expect(renderer!.root.findAllByType(hostType('StateNotice'))).toHaveLength(0);
      expect(renderer!.root.findAllByType(hostType('AllowedChild'))).toHaveLength(0);
    } finally { await act(async () => { await r.marker.finishPrivateMutation46(token); }); }
    expect(renderer!.root.findAllByType(hostType('AllowedChild'))).toHaveLength(1);
  });

  it('CONSUMER mounted age gate waits without replacing current receipt by unavailable', async () => {
    const r = await runtime(); await seed(r); const before = native.bytes.get(r.key); const token = await r.arm();
    const { AgePolicyGate } = await import('@/features/onboarding/AgePolicyGate');
    await act(async () => { renderer = create(gateElement(AgePolicyGate, { bootstrap: createElement('Bootstrap') }, createElement('AllowedChild'))); });
    try {
      expect(JSON.stringify(renderer!.toJSON())).not.toContain('Your age confirmation could not open.');
      expect(renderer!.root.findAllByType(hostType('AllowedChild'))).toHaveLength(0);
    } finally { await act(async () => { await r.marker.finishPrivateMutation46(token); }); }
    expect(renderer!.root.findAllByType(hostType('AllowedChild'))).toHaveLength(1);
    expect(native.bytes.get(r.key)).toBe(before);
    expect(r.epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  const prepared = (r: Runtime, kind: Consumer) => kind === 'outer'
    ? r.kv.verifyPrivateKVWhenReady() : r.kv.getPrivateItemWhenReady(r.key);

  it.each(['outer', 'age'] as const)('prepared %s admits no result while a real known writer is live', async kind => {
    const r = await runtime(); await seed(r); const token = await r.arm();
    let settled = false; const pending = prepared(r,kind).then(value => { settled = true; return value; });
    for (let index=0;index<24;index++) await Promise.resolve();
    try { expect(settled).toBe(false); } finally { await r.marker.finishPrivateMutation46(token); }
    await expect(pending).resolves.not.toBeNull();
    expect(r.epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  it.each(['outer', 'age'] as const)('prepared %s performs a fresh complete read after a real ABA', async kind => {
    const r = await runtime(); await seed(r); const h = holdNativeRead(r,kind);
    const beforeCalls = kind === 'outer' ? native.getAllKeys.mock.calls.length : native.getItem.mock.calls.filter(([key]) => key===r.key).length;
    const pending = prepared(r,kind); await h.ready;
    const token = await r.arm(); await r.marker.finishPrivateMutation46(token);
    await r.age.setAgeVerified(false); const current = await r.kv.getPrivateItem(r.key);
    h.release(); const result = await pending;
    if(kind==='age') expect(result).toBe(current);
    const afterCalls = kind === 'outer' ? native.getAllKeys.mock.calls.length : native.getItem.mock.calls.filter(([key]) => key===r.key).length;
    expect(afterCalls-beforeCalls).toBeGreaterThanOrEqual(2);
    expect(await r.age.getAgePolicyReceiptStatus()).toBe('reverification_required');
  });

  it.each(['outer', 'age'] as const)('prepared %s retries the actual absent-cloud retirement with exact retained receipt bytes', async kind => {
    const r = await runtime(); await seed(r); const before = [...native.bytes];
    const { clearUnavailableCloudBackupPreference } = await import('@/features/photos/consent');
    const h = holdNativeRead(r,kind); const pending = prepared(r,kind); await h.ready;
    await clearUnavailableCloudBackupPreference(); expect([...native.bytes]).toEqual(before);
    h.release(); await expect(pending).resolves.not.toBeNull();
    expect([...native.bytes]).toEqual(before);
  });

  it.each(['outer', 'age'] as const)('prepared %s allows exactly one fresh retry and refuses a second retired read', async kind => {
    const r = await runtime(); await seed(r); let count=0;
    const entered: (()=>void)[] = []; const released: (()=>void)[] = [];
    const ready = [0,1].map(index => new Promise<void>(resolve => { entered[index]=resolve; }));
    const holds = [0,1].map(index => new Promise<void>(resolve => { released[index]=resolve; }));
    if(kind==='outer') native.getAllKeys.mockImplementation(async () => {
      const value=[...native.bytes.keys()]; const n=count++; if(n<2){entered[n]();await holds[n];} return value;
    });
    else native.getItem.mockImplementation(async key => {
      const value=native.bytes.get(key)??null;
      if(key===r.key){const n=count++;if(n<2){entered[n]();await holds[n];}} return value;
    });
    const pending=prepared(r,kind); void pending.catch(()=>{});
    for(let n=0;n<2;n++) { await ready[n]; const token=await r.arm(); await r.marker.finishPrivateMutation46(token); released[n](); }
    await expect(pending).rejects.toThrow(RECOVERY);
    expect(count).toBe(2);
  });

  it('prepared age read retains a failed claim instead of retrying through quarantine', async () => {
    const r=await runtime();await seed(r);const token=await r.arm();
    const before=native.bytes.get(r.key);const pending=r.kv.getPrivateItemWhenReady(r.key);void pending.catch(()=>{});
    for(let n=0;n<24;n++)await Promise.resolve();
    r.marker.abandonPrivateMutation46(token);
    await expect(pending).rejects.toThrow(RECOVERY);
    expect(native.bytes.get(r.key)).toBe(before);expect(native.bytes.has(MARKER)).toBe(true);
  });

  it('prepared read never retries an unknown native rejection even when mutation revision changed', async () => {
    const r=await runtime();await seed(r);
    const failure={code:'E_NATIVE_CONDITIONAL05'};let reads=0;let entered!:()=>void;let release!:()=>void;
    const ready=new Promise<void>(resolve=>{entered=resolve;});const held=new Promise<void>(resolve=>{release=resolve;});
    native.getItem.mockImplementation(async key => {
      if(key===r.key){reads++;entered();await held;throw failure;}return native.bytes.get(key)??null;
    });
    // A native read rejection is independent of the revision signal. Its exact
    // original object remains the result; no second read is admitted.
    const pending=r.kv.getPrivateItemWhenReady(r.key);void pending.catch(()=>{});await ready;
    const token=await r.arm();await r.marker.finishPrivateMutation46(token);release();
    await expect(pending).rejects.toBe(failure);expect(reads).toBe(1);
  });

  it.each(['revoke','regrant','owner'] as const)('prepared health read keeps original authority across %s while waiting', async mode => {
    const r=await runtime();const owner=await import('@/lib/auth/sessionOwner');
    await owner.claimLocalDataOwnership('synthetic-owner05');
    const binding=await owner.localDataOwnerBinding('synthetic-owner05');
    const options=await r.account.runAccountGenerationOperation(lease=>({ownerUserId:'synthetic-owner05',ownerBinding:binding,accountGeneration:lease.generation,identityGeneration:r.account.captureAccountIdentityGeneration()}));
    r.epoch.setActiveHealthProcessingEpoch(1,options);
    await r.kv.setPrivateItem(UNRELATED,'controlled synthetic retained facts');
    const before=native.bytes.get(UNRELATED);const token=await r.arm();
    const pending=r.kv.getPrivateItemWhenReady(UNRELATED);void pending.catch(()=>{});
    for(let n=0;n<24;n++)await Promise.resolve();
    r.epoch.clearActiveHealthProcessingEpoch();
    if(mode!=='revoke')r.epoch.setActiveHealthProcessingEpoch(1,mode==='owner'?{...options,ownerUserId:'different-synthetic-owner05',ownerBinding:'b'.repeat(64)}:options);
    await r.marker.finishPrivateMutation46(token);
    await expect(pending).rejects.toThrow(mode==='owner'?'HEALTH_DATA_WRITE_OWNER_MISMATCH':'HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(native.bytes.get(UNRELATED)).toBe(before);
  });

  it('actual cleanup barriers drain after raw-only writer settlement without a reader self-deadlock', async () => {
    const r=await runtime();await seed(r);const token=await r.arm();
    const pending=r.kv.getPrivateItemWhenReady(r.key);void pending.catch(()=>{});
    for(let n=0;n<24;n++)await Promise.resolve();
    const release=r.account.beginPrivateDataCleanupAccountBoundary();r.kv.beginPrivateKVAccountBoundary();
    let drained=false;const draining=r.kv.waitForPrivateKVWritesToSettle().then(()=>{drained=true;});
    try {
      for(let n=0;n<24;n++)await Promise.resolve();expect(drained).toBe(false);
      await r.marker.finishPrivateMutation46(token);
      await expect(pending).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');await draining;
    } finally {r.kv.endPrivateKVAccountBoundary();release();}
    expect(drained).toBe(true);
  });

  it.each(['outer','age'] as const)('prepared %s retains each original account fence while waiting', async kind => {
    for(const boundary of ['private','account'] as const) {
      const r=await runtime();await seed(r);const token=await r.arm();
      const pending=prepared(r,kind);void pending.catch(()=>{});
      for(let n=0;n<24;n++)await Promise.resolve();
      if(boundary==='private'){r.kv.beginPrivateKVAccountBoundary();r.kv.endPrivateKVAccountBoundary();}
      else {r.account.beginAccountGenerationBoundary();r.account.endAccountGenerationBoundary();}
      await r.marker.finishPrivateMutation46(token);
      await expect(pending).rejects.toThrow(boundary==='private'?'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY':'ACCOUNT_GENERATION_CHANGED');
    }
  });

  it('known recovery message without a changed revision is never retried into a success', async () => {
    const r=await runtime();await seed(r);const failure=new Error(RECOVERY);let count=0;
    native.getItem.mockImplementation(async key=>{if(key===r.key){count++;throw failure;}return native.bytes.get(key)??null;});
    await expect(r.kv.getPrivateItemWhenReady(r.key)).rejects.toBe(failure);
    expect(count).toBe(1);
  });

  it('unknown outer storage error remains closed until an explicit user Retry', async () => {
    const r=await runtime();await seed(r);native.getAllKeys.mockRejectedValueOnce(new Error('UNKNOWN_NATIVE_CONDITIONAL05'));
    const {PrivateDataAvailabilityGate}=await import('@/lib/storage/PrivateDataAvailabilityGate');vi.useFakeTimers();
    await act(async()=>{renderer=create(gateElement(PrivateDataAvailabilityGate, {}, createElement('AllowedChild')));});
    await act(async()=>{await vi.runOnlyPendingTimersAsync();});
    expect(renderer!.root.findByType(hostType('StateNotice')).props.title).toBe('Your private data could not open.');
    expect(renderer!.root.findAllByType(hostType('AllowedChild'))).toHaveLength(0);
    const retry=renderer!.root.findAllByType(hostType('Button')).find(x=>x.props.accessibilityLabel==='Retry opening private storage')!;
    await act(async()=>{retry.props.onPress();});expect(renderer!.root.findAllByType(hostType('AllowedChild'))).toHaveLength(1);
  });

  it('unknown age storage error remains unavailable until an explicit user Retry', async () => {
    const r=await runtime();await seed(r);let failed=false;
    native.getItem.mockImplementation(async key=>{if(key===r.key&&!failed){failed=true;throw new Error('UNKNOWN_NATIVE_CONDITIONAL05');}return native.bytes.get(key)??null;});
    const {AgePolicyGate}=await import('@/features/onboarding/AgePolicyGate');
    await act(async()=>{renderer=create(gateElement(AgePolicyGate, { bootstrap: createElement('Bootstrap') }, createElement('AllowedChild')));});
    expect(JSON.stringify(renderer!.toJSON())).toContain('Your age confirmation could not open.');
    expect(renderer!.root.findAllByType(hostType('AllowedChild'))).toHaveLength(0);
    await act(async()=>{renderer!.root.findByType(hostType('Pressable')).props.onPress();});
    expect(renderer!.root.findAllByType(hostType('AllowedChild'))).toHaveLength(1);
  });

});
