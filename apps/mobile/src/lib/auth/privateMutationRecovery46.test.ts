import { beforeEach, describe, expect, it, vi } from 'vitest';

// Native ports only. Owner proofs, account/health authority, marker decoder,
// capabilities and destructive-cleanup ownership are the real implementations.
const native = vi.hoisted(() => {
  const bytes = new Map<string, string>();
  return {
    bytes,
    getAllKeys: vi.fn(async () => [...bytes.keys()]),
    getItem: vi.fn(async (key: string) => bytes.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { bytes.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { bytes.delete(key); }),
    multiGet: vi.fn(async (keys: readonly string[]) => keys.map((key) => [key, bytes.get(key) ?? null])),
  };
});
vi.mock('@react-native-async-storage/async-storage', () => ({ default: native }));
vi.mock('expo-crypto', async () => {
  const crypto = await import('node:crypto');
  return {
    randomUUID: crypto.randomUUID,
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    digestStringAsync: async (_algorithm: string, value: string) =>
      crypto.createHash('sha256').update(value).digest('hex'),
  };
});

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('react-native-get-random-values', () => ({}));
const secure04 = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({
  isAvailableAsync: async () => true,
  getItemAsync: async (key: string) => secure04.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { secure04.set(key, value); },
  deleteItemAsync: async (key: string) => { secure04.delete(key); },
}));

const MARKER = 'layerwell.localDataCleanupRequired.v1';
const OWNER = 'layerwell.localDataOwnerHash.v1';
const SHELF = 'layerwell.shelf.v1';
const COMPLETIONS = 'layerwell.completions.v1';
const RECOVERY = 'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED';

async function runtime() {
  const marker = await import('./localAccountIsolation');
  const owner = await import('./sessionOwner');
  const account = await import('./accountGeneration');
  const arm = (key: string, expectedOwnerUserId = 'synthetic-owner46') =>
    account.runAccountGenerationOperation((lease) =>
      marker.armPrivateMutation46(key, lease.assertCurrent, expectedOwnerUserId));
  return { marker, owner, account, arm };
}

async function lifecycleRuntime04() {
  const cleanup = vi.fn(async () => {});
  vi.doMock('@/lib/env', () => ({ isSupabaseConfigured: false, env: { appEnvironment: 'staging' } }));
  vi.doMock('@/lib/supabase/client', () => ({ supabase: {}, readPersistedSupabaseSessionCandidate: vi.fn() }));
  vi.doMock('@/features/healthConsent/selectiveCleanup', () => ({ clearHealthPurposeLocalData: cleanup }));
  vi.doMock('@/lib/consent/dependentConsentLifecycle', () => ({ grantHealthDependentConsent: vi.fn(), isHealthDependentConsentActive: vi.fn() }));
  vi.doMock('@/features/photos/store', () => ({ clearPhotos: vi.fn() }));
  const lifecycle = await import('@/features/healthConsent/lifecycle');
  const store = await import('@/features/healthConsent/lifecycleStore');
  const epoch = await import('@/lib/consent/healthProcessingEpoch');
  return { lifecycle, store, epoch, cleanup };
}

beforeEach(() => {
  vi.resetModules();
  native.bytes.clear();
  secure04.clear();
  native.getItem.mockImplementation(async (key) => native.bytes.get(key) ?? null);
  native.setItem.mockImplementation(async (key, value) => { native.bytes.set(key, value); });
  native.removeItem.mockImplementation(async (key) => { native.bytes.delete(key); });
  native.multiGet.mockImplementation(async (keys) => keys.map((key) => [key, native.bytes.get(key) ?? null]));
  vi.clearAllMocks();
});

describe('C46 durable nondestructive private mutation control state', () => {
  it('supports genuine unclaimed bootstrap without manufacturing ownership or cleanup consent', async () => {
    const { marker, owner, arm } = await runtime();
    expect(await owner.readLocalDataOwnerProof()).toEqual({ kind: 'unclaimed' });
    const token = await arm(COMPLETIONS);
    expect(marker.decodePrivateMutationMarker46(native.bytes.get(MARKER)!)).toMatchObject({ ownerBinding: null });
    expect(await owner.readLocalDataOwnerProof()).toEqual({ kind: 'mutation_recovery', ownerBinding: null });
    expect(native.bytes.has(OWNER)).toBe(false);
    await expect(owner.claimLocalDataOwnership('synthetic-owner46')).rejects.toThrow(RECOVERY);
    await expect(owner.readLocalDataOwnership('synthetic-owner46')).rejects.toThrow(RECOVERY);
    expect(await owner.preserveLocalDataForForcedSignOut()).toBe('mutation-recovery');
    expect(native.bytes.size).toBe(1);
    await marker.finishPrivateMutation46(token);
    expect(await owner.readLocalDataOwnerProof()).toEqual({ kind: 'unclaimed' });
    expect(native.bytes.size).toBe(0);
  });

  it('tracks concurrent disjoint original capabilities and never clears another key claim', async () => {
    const { marker, owner, arm } = await runtime();
    await owner.claimLocalDataOwnership('synthetic-owner46');
    const originalOwner = native.bytes.get(OWNER);
    const [shelf, completions] = await Promise.all([arm(SHELF), arm(COMPLETIONS)]);
    const pending = marker.decodePrivateMutationMarker46(native.bytes.get(MARKER)!);
    expect(pending.claims.map(({ key }) => key)).toEqual([COMPLETIONS, SHELF]);
    expect(pending.ownerBinding).toBe(originalOwner);
    await expect(marker.assertPrivateMutationWritable46('layerwell.routineOrder.v1')).resolves.toBeUndefined();
    await expect(marker.assertPrivateMutationWritable46(SHELF)).rejects.toThrow(RECOVERY);
    await expect(marker.assertPrivateMutationReadable46(['layerwell.appLock.enabled'])).rejects.toThrow(RECOVERY);
    await expect(marker.finishPrivateMutation46({ ...shelf })).rejects.toThrow(RECOVERY);
    await marker.finishPrivateMutation46(shelf);
    expect(marker.decodePrivateMutationMarker46(native.bytes.get(MARKER)!).claims.map(({ key }) => key)).toEqual([COMPLETIONS]);
    await expect(marker.assertPrivateMutationReadable46([SHELF])).rejects.toThrow(RECOVERY);
    await marker.finishPrivateMutation46(completions);
    await expect(marker.assertPrivateMutationReadable46()).resolves.toBeUndefined();
    await expect(marker.finishPrivateMutation46(completions)).rejects.toThrow(RECOVERY);
    expect(native.bytes.get(OWNER)).toBe(originalOwner);
  });

  it('refuses a different expected owner without modifying the existing owner proof', async () => {
    const { marker, owner, arm } = await runtime();
    await owner.claimLocalDataOwnership('synthetic-owner46');
    const before = [...native.bytes];
    await expect(arm(SHELF, 'different-owner46')).rejects.toThrow(RECOVERY);
    expect([...native.bytes]).toEqual(before);
    await expect(marker.assertPrivateMutationReadable46()).resolves.toBeUndefined();
  });

  it('retires an earlier read generation across a complete arm-clear ABA', async () => {
    const { marker, arm } = await runtime();
    const generation = marker.privateMutationReadGeneration46();
    await marker.assertPrivateMutationReadable46();
    const token = await arm(COMPLETIONS);
    await marker.finishPrivateMutation46(token);
    expect(native.bytes.has(MARKER)).toBe(false);
    expect(() => marker.assertPrivateMutationReadGeneration46(generation)).toThrow(RECOVERY);
    expect(() => marker.assertPrivateMutationReadGeneration46(marker.privateMutationReadGeneration46())).not.toThrow();
  });

  it('rejects an actual held native marker read spanning a complete arm-clear ABA', async () => {
    const { marker, arm } = await runtime();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    native.getItem.mockImplementationOnce(async (key) => {
      const captured = native.bytes.get(key) ?? null;
      await held;
      return captured;
    });
    const reading = marker.assertPrivateMutationReadable46();
    void reading.catch(() => undefined);
    const token = await arm(COMPLETIONS);
    await marker.finishPrivateMutation46(token);
    release();
    await expect(reading).rejects.toThrow(RECOVERY);
  });

  it('refuses durable orphan reads, writes and adoption after genuine module reinitialization', async () => {
    const first = await runtime();
    await first.owner.claimLocalDataOwnership('synthetic-owner46');
    const token = await first.arm(COMPLETIONS);
    const before = [...native.bytes];
    vi.resetModules();
    const restarted = await runtime();
    await expect(restarted.marker.assertPrivateMutationReadable46()).rejects.toThrow(RECOVERY);
    await expect(restarted.marker.assertPrivateMutationWritable46(SHELF)).rejects.toThrow(RECOVERY);
    await expect(restarted.marker.finishPrivateMutation46(token)).rejects.toThrow(RECOVERY);
    await expect(restarted.owner.claimLocalDataOwnership('synthetic-owner46')).rejects.toThrow(RECOVERY);
    expect(await restarted.owner.readLocalDataOwnerProof()).toMatchObject({ kind: 'mutation_recovery' });
    expect([...native.bytes]).toEqual(before);
  });

  it('never treats omitted native marker writes as permission to dispatch a destination', async () => {
    const { marker, arm } = await runtime();
    native.setItem.mockImplementationOnce(async () => undefined);
    await expect(arm(COMPLETIONS)).rejects.toThrow(RECOVERY);
    expect(native.bytes.size).toBe(0);
    await expect(marker.assertPrivateMutationReadable46()).resolves.toBeUndefined();
  });

  it('retains ambiguous committed prearm bytes across restart when its own compensation also fails', async () => {
    const first = await runtime();
    native.setItem.mockImplementationOnce(async (key, value) => {
      native.bytes.set(key, value);
      throw new Error('native-marker-committed-then-rejected');
    });
    native.removeItem.mockImplementationOnce(async () => { throw new Error('native-marker-restore-failed'); });
    await expect(first.arm(COMPLETIONS)).rejects.toThrow('native-marker-committed-then-rejected');
    expect(native.bytes.get(MARKER)).toBeDefined();
    expect(native.bytes.has(OWNER)).toBe(false);
    vi.resetModules();
    const restarted = await runtime();
    await expect(restarted.marker.assertPrivateMutationReadable46()).rejects.toThrow(RECOVERY);
    expect(await restarted.owner.readLocalDataOwnerProof()).toEqual({ kind: 'mutation_recovery', ownerBinding: null });
    expect(native.bytes.get(MARKER)).not.toBe('1');
  });

  it('preserves confirmed history and independent photo key bytes through failed release', async () => {
    const { marker, arm } = await runtime();
    native.bytes.set('layerwell.routinePlanHistory.v1', 'confirmed opaque history bytes');
    native.bytes.set('layerwell.photo.content_key.v1', 'independent opaque photo-key port');
    const confirmed = [...native.bytes];
    const token = await arm(COMPLETIONS);
    native.removeItem.mockImplementationOnce(async () => { throw new Error('native-control-remove-failed'); });
    await expect(marker.finishPrivateMutation46(token)).rejects.toThrow('native-control-remove-failed');
    await expect(marker.assertPrivateMutationReadable46()).rejects.toThrow(RECOVERY);
    for (const [key, value] of confirmed) expect(native.bytes.get(key)).toBe(value);
    expect(native.bytes.get(MARKER)).not.toBe('1');
  });

  it('lets explicit destructive cleanup supersede the intent and invalidates every old capability/read', async () => {
    const { marker, arm } = await runtime();
    const token = await arm(COMPLETIONS);
    const generation = marker.privateMutationReadGeneration46();
    const request: import('./localAccountIsolation').LocalDataCleanupMarkerRequest = {};
    await marker.markLocalDataCleanupRequired(request);
    expect(native.bytes.get(MARKER)).toBe('1');
    await expect(marker.finishPrivateMutation46(token)).rejects.toThrow(RECOVERY);
    await expect(marker.clearLocalDataCleanupRequired(request.scope!)).resolves.toBe(true);
    expect(() => marker.assertPrivateMutationReadGeneration46(generation)).toThrow(RECOVERY);
    await expect(marker.finishPrivateMutation46(token)).rejects.toThrow(RECOVERY);
    await expect(marker.assertPrivateMutationReadable46()).resolves.toBeUndefined();
  });

  it('retains a failed wider destructive claim when a later private-only cleanup finishes', async () => {
    const { marker, arm } = await runtime();
    await arm(COMPLETIONS);
    const wider: import('./localAccountIsolation').LocalDataCleanupMarkerRequest = {};
    await marker.markLocalDataCleanupRequired(wider);
    wider.scope!.abandon();
    const partial: import('./localAccountIsolation').LocalDataCleanupMarkerRequest = { preserveExisting: true };
    await marker.markLocalDataCleanupRequired(partial);
    await expect(marker.clearLocalDataCleanupRequired(partial.scope!)).resolves.toBe(false);
    expect(native.bytes.get(MARKER)).toBe('1');
    const retry: import('./localAccountIsolation').LocalDataCleanupMarkerRequest = {};
    await marker.markLocalDataCleanupRequired(retry);
    await expect(marker.clearLocalDataCleanupRequired(retry.scope!)).resolves.toBe(true);
    await expect(marker.assertPrivateMutationReadable46()).resolves.toBeUndefined();
  });

  it('discharges explicitly removed keys after restart without erasing another key or confirmed photo data', async () => {
    const first = await runtime();
    const oldShelf = await first.arm(SHELF);
    await first.arm(COMPLETIONS);
    native.bytes.set(SHELF, 'uncertain encrypted target');
    native.bytes.set(COMPLETIONS, 'other uncertain encrypted target');
    native.bytes.set('layerwell.photo.content_key.v1', 'confirmed independent photo-key port');
    vi.resetModules();
    const restarted = await runtime();
    await expect(restarted.marker.clearPrivateMutationAfterRemoval46([SHELF])).rejects.toThrow(RECOVERY);
    native.bytes.delete(SHELF);
    await restarted.marker.clearPrivateMutationAfterRemoval46([SHELF]);
    expect(restarted.marker.decodePrivateMutationMarker46(native.bytes.get(MARKER)!).claims.map(({ key }) => key)).toEqual([COMPLETIONS]);
    expect(native.bytes.get(COMPLETIONS)).toBe('other uncertain encrypted target');
    expect(native.bytes.get('layerwell.photo.content_key.v1')).toBe('confirmed independent photo-key port');
    await expect(restarted.marker.assertPrivateMutationReadable46()).rejects.toThrow(RECOVERY);
    native.bytes.delete(COMPLETIONS);
    await restarted.marker.clearPrivateMutationAfterRemoval46([COMPLETIONS]);
    expect(native.bytes.has(MARKER)).toBe(false);
    await expect(restarted.marker.assertPrivateMutationReadable46()).resolves.toBeUndefined();
    await expect(restarted.marker.finishPrivateMutation46(oldShelf)).rejects.toThrow(RECOVERY);
  });

  it('rejects noncanonical, duplicate, foreign-owner and unknown registry shapes', async () => {
    const { marker, owner, arm } = await runtime();
    const token = await arm(COMPLETIONS);
    const raw = native.bytes.get(MARKER)!;
    const decoded = marker.decodePrivateMutationMarker46(raw);
    for (const invalid of [raw + ' ', raw.replace('"v":2', '"v":3'),
      JSON.stringify({ ...decoded, claims: [...decoded.claims, ...decoded.claims] }),
      JSON.stringify({ ...decoded, ownerBinding: 'a'.repeat(64) }),
      JSON.stringify({ ...decoded, extra: true })]) {
      if (invalid.includes('"ownerBinding":"')) {
        native.bytes.set(MARKER, invalid);
        await expect(owner.readLocalDataOwnerProof()).rejects.toThrow('LOCAL_DATA_OWNER_PROOF_INVALID');
      } else expect(() => marker.decodePrivateMutationMarker46(invalid)).toThrow(RECOVERY);
    }
    native.bytes.set(MARKER, raw);
    await marker.finishPrivateMutation46(token);
  });

  it('preserves v1 read-only preparation and original malformed-history refusal without replacing its marker', async () => {
    const { marker, owner, arm } = await runtime();
    await owner.claimLocalDataOwnership('synthetic-owner46');
    const { randomUUID } = await import('node:crypto');
    const raw = JSON.stringify({ v: 1, kind: 'routine-plan-history',
      ownerBinding: native.bytes.get(OWNER)!, nonce: randomUUID() });
    native.bytes.set(MARKER, raw);
    await expect(marker.assertPrivateMutationReadable46()).resolves.toBeUndefined();
    await expect(marker.assertPrivateMutationWritable46('layerwell.catalog.lookupQueue.v1')).resolves.toBeUndefined();
    await expect(arm('layerwell.catalog.lookupQueue.v1')).rejects.toThrow(RECOVERY);
    expect(native.bytes.get(MARKER)).toBe(raw);
    for (const malformed of ['{malformed', raw + ' ', raw.replace('"v":1', '"v":99')]) {
      native.bytes.set(MARKER, malformed);
      await expect(marker.assertPrivateMutationReadable46()).rejects.toThrow('LOCAL_DATA_HISTORY_RECOVERY_REQUIRED');
      expect(native.bytes.get(MARKER)).toBe(malformed);
    }
  });

  it('waits for all known live raw-only writers while keeping public plaintext refused', async () => {
    const { marker, arm, account } = await runtime();
    const [one, two] = await Promise.all([arm(SHELF), arm(COMPLETIONS)]);
    let completed = false;
    const preparing = account.runAccountGenerationOperation((lease) =>
      marker.waitForPrivateMutationReadWindow46(lease.assertCurrent)).then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    await expect(marker.assertPrivateMutationReadable46()).rejects.toThrow(RECOVERY);
    await marker.finishPrivateMutation46(one);
    expect(completed).toBe(false);
    await marker.finishPrivateMutation46(two);
    await preparing;
    expect(completed).toBe(true);
    await expect(marker.assertPrivateMutationReadable46()).resolves.toBeUndefined();
  });

  it('rejects failed and orphan windows instead of waiting forever or resuming uncertain bytes', async () => {
    const { marker, arm, account } = await runtime();
    const token = await arm(COMPLETIONS);
    const preparing = account.runAccountGenerationOperation((lease) =>
      marker.waitForPrivateMutationReadWindow46(lease.assertCurrent));
    void preparing.catch(() => undefined);
    marker.abandonPrivateMutation46(token);
    await expect(preparing).rejects.toThrow(RECOVERY);
    await expect(marker.finishPrivateMutation46(token)).rejects.toThrow(RECOVERY);
    expect(native.bytes.get(MARKER)).toBeDefined();
    vi.resetModules();
    const restarted = await runtime();
    await expect(restarted.account.runAccountGenerationOperation((lease) =>
      restarted.marker.waitForPrivateMutationReadWindow46(lease.assertCurrent))).rejects.toThrow(RECOVERY);
  });

  it('keeps original account authority while a legitimate writer settles', async () => {
    const { marker, arm, account } = await runtime();
    const token = await arm(COMPLETIONS);
    const preparing = account.runAccountGenerationOperation((lease) =>
      marker.waitForPrivateMutationReadWindow46(lease.assertCurrent));
    void preparing.catch(() => undefined);
    account.beginAccountGenerationBoundary();
    account.endAccountGenerationBoundary();
    await marker.finishPrivateMutation46(token);
    await expect(preparing).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
    expect(native.bytes.has(MARKER)).toBe(false);
  });
  it('C04 waits for an actual live C46 writer before reading a fresh lifecycle', async () => {
    const { marker, arm } = await runtime();
    const { lifecycle, store, epoch, cleanup } = await lifecycleRuntime04();
    const token = await arm(SHELF);
    // Actual production getPrivateItem/store read refuses plaintext during the claim.
    await expect(store.readHealthDataLifecycle('local-device-unclaimed')).rejects.toThrow(RECOVERY);
    const pending = lifecycle.reconcileHealthDataLifecycle('local-device-unclaimed');
    await Promise.resolve();
    expect(cleanup).not.toHaveBeenCalled();
    expect(epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
    await marker.finishPrivateMutation46(token);
    const result = await pending;
    expect(result).toMatchObject({ state: 'unconsented', processingEpoch: 0, localCleanupComplete: true });
    expect(await store.readHealthDataLifecycle('local-device-unclaimed')).toEqual(result);
    expect(cleanup).toHaveBeenCalledExactlyOnceWith('local-device-unclaimed');
    expect(epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  it('C04 retries one actual lifecycle read retired by a completed C46 arm-clear ABA', async () => {
    const { marker, arm } = await runtime();
    const { lifecycle, store, epoch } = await lifecycleRuntime04();
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const firstRead = new Promise<void>((resolve) => { entered = resolve; });
    let intercepted = false;
    native.getItem.mockImplementation(async (key) => {
      const value = native.bytes.get(key) ?? null;
      if (key === store.HEALTH_DATA_LIFECYCLE_KEY && !intercepted) {
        intercepted = true;
        entered();
        await held;
      }
      return value;
    });
    const pending = lifecycle.reconcileHealthDataLifecycle('local-device-unclaimed');
    await firstRead;
    const token = await arm(SHELF);
    await marker.finishPrivateMutation46(token);
    release();
    await expect(pending).resolves.toMatchObject({ state: 'unconsented', processingEpoch: 0, localCleanupComplete: true });
    expect(epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  it.each(['failed', 'orphan'] as const)('C04 preserves %s C46 recovery instead of clearing or granting', async (mode) => {
    const { marker, arm } = await runtime();
    const token = await arm(SHELF);
    if (mode === 'failed') marker.abandonPrivateMutation46(token);
    else vi.resetModules();
    const { lifecycle, epoch, cleanup } = await lifecycleRuntime04();
    const before = [...native.bytes];
    await expect(lifecycle.reconcileHealthDataLifecycle('local-device-unclaimed')).resolves.toMatchObject({
      state: 'verification_required', verificationReason: 'status_unavailable', verificationResumeState: null,
      processingEpoch: 0, localCleanupComplete: false,
    });
    expect([...native.bytes]).toEqual(before);
    expect(cleanup).not.toHaveBeenCalled();
    expect(epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  it('C04 preserves fresh onboarding when the real startup cloud-backup removal retires its first read', async () => {
    const { lifecycle, store, epoch, cleanup } = await lifecycleRuntime04();
    const { clearUnavailableCloudBackupPreference } = await import('@/features/photos/consent');
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const firstRead = new Promise<void>((resolve) => { entered = resolve; });
    let intercepted = false;
    native.getItem.mockImplementation(async (key) => {
      const value = native.bytes.get(key) ?? null;
      if (key === store.HEALTH_DATA_LIFECYCLE_KEY && !intercepted) {
        intercepted = true;
        entered();
        await held;
      }
      return value;
    });
    const pending = lifecycle.reconcileHealthDataLifecycle('local-device-unclaimed');
    await firstRead;
    await clearUnavailableCloudBackupPreference();
    expect(native.bytes.has('layerwell.photos.cloudBackup')).toBe(false);
    release();
    await expect(pending).resolves.toMatchObject({ state: 'unconsented', processingEpoch: 0, localCleanupComplete: true });
    expect(cleanup).toHaveBeenCalledExactlyOnceWith('local-device-unclaimed');
    expect(epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  it('C04 preserves an unknown lifecycle native read failure as verification, never initial consent', async () => {
    const { lifecycle, store, epoch, cleanup } = await lifecycleRuntime04();
    let failed = false;
    native.getItem.mockImplementation(async (key) => {
      if (key === store.HEALTH_DATA_LIFECYCLE_KEY && !failed) {
        failed = true;
        throw new Error('C04_UNCLASSIFIED_NATIVE_READ');
      }
      return native.bytes.get(key) ?? null;
    });
    await expect(lifecycle.reconcileHealthDataLifecycle('local-device-unclaimed')).resolves.toMatchObject({
      state: 'verification_required', verificationReason: 'status_unavailable', verificationResumeState: null,
      processingEpoch: 0, localCleanupComplete: false,
    });
    expect(cleanup).not.toHaveBeenCalled();
    expect(epoch.activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

});
