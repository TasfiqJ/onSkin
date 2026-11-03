import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginEncryptedPhotoAccountBoundary,
  clearEncryptedPhotoStorage,
  endEncryptedPhotoAccountBoundary,
  encryptPhotoNote,
  waitForEncryptedPhotoWritesToSettle,
} from '@/features/photos/encryptedStorage';
import { setHealthDataCollectionConsentLocal } from '@/features/onboarding/healthConsentStore';
import { saveRoutineOrderOverrides } from '@/features/routine/orderStore';
import {
  AccountGenerationLeaseError,
  beginAccountGenerationBoundary,
  captureAccountIdentityGeneration,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import {
  clearLocalDataCleanupRequired,
  readLocalDataOwnership,
} from '@/lib/auth/sessionOwner';
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import {
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  getPrivateItem,
  multiRemovePrivateItems,
  setPrivateItem,
  updatePrivateItem,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';
import { PRIVATE_KV_CONTENT_KEY_NAME } from '@/lib/storage/privateKVContentKey';

import { clearLocalPrivateData, clearLocalPrivateDataForDevReset } from './localPrivateData';
import { LOCAL_PRIVATE_DATA_KEYS } from './localPrivateDataKeys';

// The cleanup, key registry, widget coordinator, photo store, XChaCha20-Poly1305,
// privateKV, content-key adapter, domain order store and authority are real.
// Only synthetic native storage/files/widget/notification and vendor ports are
// supplied. No user data, device, telemetry service or remote transport is used.
const native = vi.hoisted(() => ({
  bytes: new Map<string, string>(),
  secure: new Map<string, string>(),
  events: [] as string[],
  failures: new Set<string>(),
  digestHook: null as (() => Promise<void>) | null,
  markerDeliveryHook: null as (() => Promise<void>) | null,
  purgeHook: null as ((stage: string) => void) | null,
  configuredForSelective: false,
  queryCancellations: 0,
  queryCancelHook: null as (() => Promise<void>) | null,
  stagingFailure: false,
  stagingCalls: 0,
  getHook: null as ((key: string, raw: string | null) => Promise<void>) | null,
  setHook: null as ((key: string, raw: string) => Promise<void>) | null,
  secureSetHook: null as ((key: string) => Promise<void>) | null,
  secureDeleteHook: null as ((key: string) => Promise<void>) | null,
}));

vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-crypto', () => ({
  randomUUID,
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, text: string) => {
    await native.digestHook?.();
    return createHash('sha256').update(text).digest('hex');
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => {
    const raw = native.bytes.get(key) ?? null;
    await native.getHook?.(key, raw);
    return raw;
  },
  getAllKeys: async () => [...native.bytes.keys()],
  multiGet: async (keys: string[]) => keys.map((key) => [key, native.bytes.get(key) ?? null]),
  setItem: async (key: string, raw: string) => {
    native.events.push(`set-enter:${key}`);
    await native.setHook?.(key, raw);
    if (key === 'layerwell.localDataCleanupRequired.v1' && native.failures.has('cleanup_mark')) {
      throw new Error('SYNTHETIC_CLEANUP_MARK');
    }
    native.bytes.set(key, raw);
    native.events.push(`set:${key}`);
    if (key === 'layerwell.localDataCleanupRequired.v1') await native.markerDeliveryHook?.();
  },
  removeItem: async (key: string) => {
    native.bytes.delete(key);
    native.events.push(`remove:${key}`);
  },
  multiRemove: async (keys: string[]) => {
    const ownerProofOnly = keys.length === 3 && [
      'layerwell.localDataOwnerHash.v1',
      'layerwell.localDataRetainedOwnerHash.v1',
      'layerwell.localDataUnclaimedQuarantine.v1',
    ].every((key) => keys.includes(key));
    const stage = keys.includes('layerwell.routineOrder.v1')
      ? 'registered_records'
      : ownerProofOnly ? 'owner_proof' : 'dev_controls';
    native.events.push(`purge:${stage}`);
    native.purgeHook?.(stage);
    if (native.failures.has(stage)) throw new Error(`SYNTHETIC_${stage}`);
    for (const key of keys) native.bytes.delete(key);
  },
} }));
vi.mock('expo-secure-store', () => ({
  isAvailableAsync: async () => true,
  getItemAsync: async (key: string) => native.secure.get(key) ?? null,
  setItemAsync: async (key: string, raw: string) => {
    await native.secureSetHook?.(key);
    native.secure.set(key, raw);
    native.events.push(`secure-set:${key}`);
  },
  deleteItemAsync: async (key: string) => {
    native.events.push(`secure-delete-enter:${key}`);
    await native.secureDeleteHook?.(key);
    if (key === 'layerwell.private_kv.content_key.v1' && native.failures.has('private_kv_key')) {
      throw new Error('SYNTHETIC_KEY_DELETION');
    }
    native.secure.delete(key);
    native.events.push(`secure-delete:${key}`);
  },
}));
vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://synthetic44-document/',
  cacheDirectory: 'file://synthetic44-cache/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  makeDirectoryAsync: async () => undefined,
  getInfoAsync: async () => ({ exists: false }),
  readDirectoryAsync: async () => {
    native.events.push('cache:enumerate');
    if (native.failures.has('generated_cache')) throw new Error('SYNTHETIC_CACHE');
    return [];
  },
  deleteAsync: async (uri: string) => {
    native.events.push(`file-delete:${uri}`);
    if (uri.includes('photos/v1/') && native.failures.has('encrypted_photos')) {
      throw new Error('SYNTHETIC_PHOTO_DELETION');
    }
  },
}));
vi.mock('@/features/widgets/nativeLifecycle', () => ({
  closeRoutineWidgetNativeAdmission: () => {
    native.events.push('widget:close');
    return { status: 'not_configured' as const };
  },
  clearRoutineWidgetNativeState: async () => {
    native.events.push('widget:clear');
    if (native.failures.has('routine_widget_native_state')) throw new Error('SYNTHETIC_WIDGET');
    return { status: 'not_configured' as const, authority: null, endedActivities: 0 };
  },
}));
vi.mock('@/features/notifications/nativeMutation', () => ({
  clearNativeNotificationsForAccountIsolation: async () => {
    native.events.push('notifications:clear');
    if (native.failures.has('scheduled_notifications')) throw new Error('SYNTHETIC_NOTIFICATIONS');
  },
}));
vi.mock('@/lib/analytics/track', () => ({
  resetAnalyticsIdentity: async () => {
    native.events.push('analytics:reset');
    if (native.failures.has('analytics_identity')) throw new Error('SYNTHETIC_ANALYTICS');
  },
}));
vi.mock('@/lib/iap/revenuecat', () => ({
  resetRevenueCatIdentity: async () => {
    native.events.push('vendor:reset');
    if (native.failures.has('revenuecat_identity')) throw new Error('SYNTHETIC_VENDOR');
  },
}));

const OWNER = 'synthetic44-owner';
const ORDER_KEY = 'layerwell.routineOrder.v1';
const PHOTO_KEY = 'layerwell.photo.content_key.v1';
const PROOFS = [
  'layerwell.localDataOwnerHash.v1',
  'layerwell.localDataRetainedOwnerHash.v1',
  'layerwell.localDataUnclaimedQuarantine.v1',
] as const;
const PRIOR = '{"schemaVersion":1,"am":["prior"],"pm":[]}';
const NEXT = '{"schemaVersion":1,"am":["next"],"pm":[]}';
const releases = new Set<() => void>();
const pending = new Set<Promise<unknown>>();

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  releases.add(resolve);
  return { promise, resolve };
}

function observe<T>(promise: Promise<T>) {
  const result = promise.then(
    (value) => ({ status: 'fulfilled' as const, value }),
    (error: unknown) => ({ status: 'rejected' as const, error }),
  );
  pending.add(result);
  return result;
}

async function grant() {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(44, { ownerUserId: OWNER, accountGeneration, serverVerifiedAt: null });
}

function holdOrderConflictRead() {
  const entered = deferred();
  const release = deferred();
  let reads = 0;
  native.getHook = async (key) => {
    if (key === ORDER_KEY && ++reads === 2) {
      native.events.push('order:final-conflict-read');
      entered.resolve();
      await release.promise;
    }
  };
  return { entered: entered.promise, release: release.resolve };
}

async function fencedWrite() {
  const lease = captureHealthDataWriteLease(OWNER);
  const { updatePrivateItemWithSources } = await import('@/lib/storage/privateKV');
  return updatePrivateItemWithSources(ORDER_KEY, [
    'layerwell.shelf.v1', 'layerwell.skinprofile.v1', 'layerwell.conflict.overrides',
    'layerwell.healthDataCollectionConsent.v1',
  ], (values) => {
    expect(values.get(ORDER_KEY)).toBe(PRIOR);
    return NEXT;
  }, () => assertHealthDataWriteLease(lease));
}

beforeEach(async () => {
  native.bytes.clear();
  native.secure.clear();
  native.events.length = 0;
  native.failures.clear();
  native.digestHook = null;
  native.markerDeliveryHook = null;
  native.purgeHook = null;
  native.configuredForSelective = false;
  native.queryCancellations = 0;
  native.queryCancelHook = null;
  native.stagingFailure = false;
  native.stagingCalls = 0;
  native.getHook = null;
  native.setHook = null;
  native.secureSetHook = null;
  native.secureDeleteHook = null;
  await clearLocalDataCleanupRequired();
  await grant();
  await setPrivateItem(ORDER_KEY, PRIOR);
  for (const key of PROOFS) native.bytes.set(key, `synthetic-proof:${key}`);
  native.bytes.set('layerwell.localDataCleanupRequired.v1', '1');
  expect(JSON.parse(native.bytes.get(ORDER_KEY)!).version).toBe('xchacha20poly1305:v1');
  expect(native.bytes.get(ORDER_KEY)).not.toContain('prior');
  expect(await getPrivateItem(ORDER_KEY)).toBe(PRIOR);
  native.events.length = 0;
});

afterEach(async () => {
  for (const release of releases) release();
  releases.clear();
  await Promise.allSettled([...pending]);
  pending.clear();
  await waitForPrivateKVWritesToSettle();
  await waitForEncryptedPhotoWritesToSettle();
  await waitForAccountGenerationOperationsToSettle();
  clearActiveHealthProcessingEpoch();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Campaign44 full-path direct reset ordering with actual encrypted storage', () => {
  it('CONTROL: queued private multi-remove still follows an entered writer', async () => {
    const gate = holdOrderConflictRead();
    const writing = observe(updatePrivateItem(ORDER_KEY, () => NEXT));
    await gate.entered;
    const deleting = observe(multiRemovePrivateItems([ORDER_KEY]));
    expect(native.events).not.toContain('purge:registered_records');
    gate.release();
    expect(await writing).toMatchObject({ status: 'fulfilled' });
    expect(await deleting).toMatchObject({ status: 'fulfilled' });
    expect(native.events.indexOf(`set:${ORDER_KEY}`)).toBeLessThan(
      native.events.indexOf('purge:registered_records'),
    );
    expect(await getPrivateItem(ORDER_KEY)).toBeNull();
  });

  it('CONTROL: existing account/private/photo closure stays closed through nested cleanup', async () => {
    const gate = holdOrderConflictRead();
    const writing = observe(updatePrivateItem(ORDER_KEY, () => NEXT));
    await gate.entered;
    beginAccountGenerationBoundary();
    beginPrivateKVAccountBoundary();
    beginEncryptedPhotoAccountBoundary();
    const identity = captureAccountIdentityGeneration();
    try {
      gate.release();
      expect(await writing).toMatchObject({ status: 'rejected' });
      await waitForPrivateKVWritesToSettle();
      await clearLocalPrivateData();
      expect(captureAccountIdentityGeneration()).toBe(identity);
      await expect(runAccountGenerationOperation(() => undefined)).rejects.toThrow();
      await expect(setPrivateItem('layerwell.appLock.enabled', 'true')).rejects.toThrow();
      expect(native.bytes.has(ORDER_KEY)).toBe(false);
      expect(native.secure.has(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(false);
    } finally {
      endEncryptedPhotoAccountBoundary();
      endPrivateKVAccountBoundary();
      endAccountGenerationBoundary();
    }
  });

  it.each(['ordinary', 'source-fenced'] as const)(
    '%s writer: closes direct cleanup before a held final conflict read and drains before key destruction', async (writer) => {
    const gate = holdOrderConflictRead();
    const writing = observe(writer === 'ordinary' ? updatePrivateItem(ORDER_KEY, () => NEXT) : fencedWrite());
    await gate.entered;
    const keyEntered = deferred();
    const keyRelease = deferred();
    native.secureDeleteHook = async (key) => {
      if (key === PRIVATE_KV_CONTENT_KEY_NAME) {
        keyEntered.resolve();
        await keyRelease.promise;
      }
    };
    const cleanup = observe(clearLocalPrivateData());
    expect(native.events).not.toContain('purge:registered_records');
    expect(native.events).not.toContain(`secure-delete-enter:${PRIVATE_KV_CONTENT_KEY_NAME}`);
    gate.release();
    expect(await writing).toMatchObject({ status: 'rejected' });
    await keyEntered.promise;
    expect(native.events).toContain('purge:registered_records');
    expect(native.events).not.toContain(`set:${ORDER_KEY}`);
    expect(native.bytes.has(ORDER_KEY)).toBe(false);
    expect(native.secure.has(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(true);
    await expect(runAccountGenerationOperation(() => undefined)).rejects.toThrow();
    await expect(getPrivateItem(ORDER_KEY)).rejects.toThrow();
    keyRelease.resolve();
    expect(await cleanup).toMatchObject({ status: 'fulfilled' });
    expect(native.secure.has(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(false);
    expect(native.bytes.has(ORDER_KEY)).toBe(false);
  });

  it.each(['ordinary', 'source-fenced'] as const)(
    '%s writer: drains a held native commit and its exact rollback before direct purge', async (writer) => {
    const entered = deferred();
    const release = deferred();
    const priorCiphertext = native.bytes.get(ORDER_KEY);
    let held = false;
    native.setHook = async (key) => {
      if (key === ORDER_KEY && !held) {
        held = true;
        entered.resolve();
        await release.promise;
      }
    };
    const writing = observe(writer === 'ordinary' ? updatePrivateItem(ORDER_KEY, () => NEXT) : fencedWrite());
    await entered.promise;
    const cleanup = observe(clearLocalPrivateData());
    expect(native.events).not.toContain('purge:registered_records');
    expect(native.bytes.get(ORDER_KEY)).toBe(priorCiphertext);
    release.resolve();
    expect(await writing).toMatchObject({ status: 'rejected' });
    expect(await cleanup).toMatchObject({ status: 'fulfilled' });
    const writes = native.events.flatMap((event, index) => event === `set:${ORDER_KEY}` ? [index] : []);
    expect(writes).toHaveLength(2);
    expect(writes[1]).toBeLessThan(native.events.indexOf('purge:registered_records'));
    expect(native.bytes.has(ORDER_KEY)).toBe(false);
    expect(native.secure.has(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(false);
  });

  it.each([PRIVATE_KV_CONTENT_KEY_NAME, PHOTO_KEY])(
    'drains in-flight native creation of %s before destroying the key', async (key) => {
      // A missing content key and empty destination are valid creation inputs.
      if (key === PRIVATE_KV_CONTENT_KEY_NAME) {
        native.bytes.delete(ORDER_KEY);
        native.secure.delete(PRIVATE_KV_CONTENT_KEY_NAME);
      }
      const entered = deferred();
      const release = deferred();
      native.secureSetHook = async (candidate) => {
        if (candidate === key) {
          entered.resolve();
          await release.promise;
        }
      };
      const writing = observe<unknown>(key === PRIVATE_KV_CONTENT_KEY_NAME
        ? setPrivateItem(ORDER_KEY, NEXT)
        : encryptPhotoNote('Synthetic private photo note'));
      await entered.promise;
      const cleanup = observe(clearLocalPrivateData());
      expect(native.events).not.toContain('purge:registered_records');
      release.resolve();
      expect(await writing).toMatchObject({ status: 'rejected' });
      expect(await cleanup).toMatchObject({ status: 'fulfilled' });
      expect(native.events.indexOf(`secure-set:${key}`)).toBeLessThan(
        native.events.indexOf(`secure-delete:${key}`),
      );
      expect(native.secure.has(key)).toBe(false);
      expect(native.bytes.has('layerwell.photo.content_key_created.v1')).toBe(false);
      expect(native.bytes.has(ORDER_KEY)).toBe(false);
    },
  );

  it('drains source-fenced authenticated readback and rollback before native purge', async () => {
    const entered = deferred();
    const release = deferred();
    let reads = 0;
    native.getHook = async (key) => {
      if (key === ORDER_KEY && ++reads === 3) {
        entered.resolve();
        await release.promise;
      }
    };
    const writing = observe(fencedWrite());
    await entered.promise;
    const cleanup = observe(clearLocalPrivateData());
    expect(native.events).not.toContain('purge:registered_records');
    release.resolve();
    expect(await writing).toMatchObject({ status: 'rejected' });
    expect(await cleanup).toMatchObject({ status: 'fulfilled' });
    const writes = native.events.flatMap((event, index) => event === `set:${ORDER_KEY}` ? [index] : []);
    expect(writes).toHaveLength(2);
    expect(writes[1]).toBeLessThan(native.events.indexOf('purge:registered_records'));
    expect(native.bytes.has(ORDER_KEY)).toBe(false);
  });

  it('retires a real domain callback captured before privateKV even after same-owner regrant', async () => {
    const oldLease = captureHealthDataWriteLease(OWNER);
    const release = deferred();
    const writing = observe((async () => {
      await release.promise;
      return saveRoutineOrderOverrides({
        previous: { schemaVersion: 1, am: ['prior'], pm: [] },
        next: { schemaVersion: 1, am: ['next'], pm: [] },
      }, oldLease);
    })());
    const identity = captureAccountIdentityGeneration();
    await clearLocalPrivateData();
    expect(captureAccountIdentityGeneration()).toBe(identity);
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
    await grant();
    release.resolve();
    expect(await writing).toMatchObject({ status: 'rejected' });
    expect(native.bytes.has(ORDER_KEY)).toBe(false);
    expect(native.events).not.toContain(`set:${ORDER_KEY}`);
  });

  it('retires local-consent hashing begun before privateKV so it cannot resurrect a purged source', async () => {
    const entered = deferred();
    const release = deferred();
    native.digestHook = async () => {
      entered.resolve();
      await release.promise;
    };
    const writing = observe(setHealthDataCollectionConsentLocal({
      granted: false,
      version: 'synthetic44-unreviewed-copy',
      consentText: 'Synthetic local-consent decline text used only for this native schedule.',
    }));
    await entered.promise;
    await clearLocalPrivateData();
    const consentKey = 'layerwell.healthDataCollectionConsent.v1';
    expect(native.bytes.has(consentKey)).toBe(false);
    expect(native.secure.has(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(false);
    release.resolve();
    expect({
      outcome: await writing,
      consentCiphertextSurvived: native.bytes.has(consentKey),
      contentKeyRecreated: native.secure.has(PRIVATE_KV_CONTENT_KEY_NAME),
    }).toMatchObject({
      outcome: { status: 'rejected' },
      consentCiphertextSurvived: false,
      contentKeyRecreated: false,
    });
  });

  it('does not wait on a tracked caller that awaits its own cleanup', async () => {
    await runAccountGenerationOperation(async (lease) => {
      await clearLocalPrivateData();
      expect(() => lease.assertCurrent()).toThrow();
    });
    await expect(runAccountGenerationOperation(() => 'released')).resolves.toBe('released');
  });

  it.each([
    'routine_widget_native_state', 'registered_records', 'encrypted_photos', 'private_kv_key',
    'generated_cache', 'scheduled_notifications', 'analytics_identity', 'revenuecat_identity',
    'owner_proof',
  ])('retains proofs and cleanup quarantine on partial %s failure', async (failure) => {
    native.failures.add(failure);
    await expect(clearLocalPrivateData()).rejects.toThrow(`LOCAL_PRIVATE_DATA_CLEAR_FAILED:${failure}`);
    for (const key of PROOFS) expect(native.bytes.get(key)).toBe(`synthetic-proof:${key}`);
    expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
    expect(native.events).toContain('widget:clear');
    expect(native.events).toContain('purge:registered_records');
    expect(native.events).toContain(`secure-delete-enter:${PRIVATE_KV_CONTENT_KEY_NAME}`);
    expect(native.events).toContain('cache:enumerate');
    expect(native.events).toContain('notifications:clear');
    expect(native.events).toContain('analytics:reset');
    expect(native.events).toContain('vendor:reset');
    if (failure !== 'owner_proof') expect(native.events).not.toContain('purge:owner_proof');
    expect(native.events.indexOf('widget:clear')).toBeLessThan(
      native.events.indexOf('purge:registered_records'),
    );
    // Failed cleanup releases its own exclusion but never republishes health.
    await expect(runAccountGenerationOperation(() => undefined)).resolves.toBeUndefined();
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
  });

  it('durably quarantines a same-owner failed direct purge that began without a cleanup marker', async () => {
    native.bytes.delete('layerwell.localDataCleanupRequired.v1');
    native.bytes.set(PROOFS[0], createHash('sha256').update(`layerwell:local-data-owner:v1:${OWNER}`).digest('hex'));
    native.bytes.delete(PROOFS[1]);
    native.bytes.delete(PROOFS[2]);
    await expect(readLocalDataOwnership(OWNER)).resolves.toBe('match');
    native.failures.add('registered_records');
    native.failures.add('private_kv_key');
    await expect(clearLocalPrivateData()).rejects.toThrow(
      'LOCAL_PRIVATE_DATA_CLEAR_FAILED:registered_records,private_kv_key',
    );
    expect(native.bytes.has(ORDER_KEY)).toBe(true);
    expect(native.secure.has(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(true);
    expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
    await expect(readLocalDataOwnership(OWNER)).resolves.toBe('cleanup_required');
  });

  it('aborts before native destruction if the direct cleanup retry marker cannot be stored', async () => {
    native.bytes.delete('layerwell.localDataCleanupRequired.v1');
    native.failures.add('cleanup_mark');
    await expect(clearLocalPrivateData()).rejects.toThrow('SYNTHETIC_CLEANUP_MARK');
    expect(native.events).not.toContain('widget:clear');
    expect(native.events).not.toContain('purge:registered_records');
    expect(native.events).not.toContain(`secure-delete-enter:${PRIVATE_KV_CONTENT_KEY_NAME}`);
    expect(native.bytes.has(ORDER_KEY)).toBe(true);
    expect(native.secure.has(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(true);
    for (const key of PROOFS) expect(native.bytes.has(key)).toBe(true);
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
    await expect(runAccountGenerationOperation(() => undefined)).resolves.toBeUndefined();
  });

  it('removes exactly registered private data and owner proofs, with no private data emission', async () => {
    const transport = vi.spyOn(globalThis, 'fetch');
    const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    try {
      for (const key of LOCAL_PRIVATE_DATA_KEYS) {
        if (key !== ORDER_KEY) native.bytes.set(key, 'synthetic-private-record');
      }
      native.bytes.set('unrelated-public-cache', 'keep');
      await clearLocalPrivateData();
      for (const key of LOCAL_PRIVATE_DATA_KEYS) expect(native.bytes.has(key)).toBe(false);
      for (const key of PROOFS) expect(native.bytes.has(key)).toBe(false);
      expect(native.bytes.get('unrelated-public-cache')).toBe('keep');
      expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
      expect(native.events.at(-1)).toBe('purge:owner_proof');
      await expect(readLocalDataOwnership(OWNER)).resolves.toBe('cleanup_required');
      expect(transport).not.toHaveBeenCalled();
      for (const log of logs) expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-record');
    } finally {
      transport.mockRestore();
      logs.forEach((log) => log.mockRestore());
    }
  });

  it('clears only its own newly created retry marker after a fully successful direct cleanup', async () => {
    native.bytes.delete('layerwell.localDataCleanupRequired.v1');
    await clearLocalPrivateData();
    expect(native.bytes.has('layerwell.localDataCleanupRequired.v1')).toBe(false);
    expect(native.events.indexOf('purge:owner_proof')).toBeLessThan(
      native.events.indexOf('remove:layerwell.localDataCleanupRequired.v1'),
    );
    await expect(readLocalDataOwnership(OWNER)).resolves.toBe('unclaimed');
  });
});

describe('Campaign44 development Welcome reset continuity', () => {
  it('refuses the special finalizer outside the original dev/environment gate', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.stubEnv('EXPO_PUBLIC_E2E_LOCAL_RESET', '1');
    const finish = vi.fn(async () => undefined);
    await expect(clearLocalPrivateDataForDevReset(finish)).rejects.toThrow('DEV_LOCAL_RESET_DISABLED');
    expect(finish).not.toHaveBeenCalled();
    expect(native.bytes.has(ORDER_KEY)).toBe(true);
    expect(native.events).toEqual([]);
  });

  it('holds account/private exclusion through control clearance and removes proofs last', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.stubEnv('EXPO_PUBLIC_E2E_LOCAL_RESET', '1');
    const entered = deferred();
    const release = deferred();
    const cleanup = observe(clearLocalPrivateDataForDevReset(async () => {
      native.events.push('dev-controls:enter');
      entered.resolve();
      await release.promise;
      native.events.push('dev-controls:cleared');
    }));
    await entered.promise;
    for (const key of PROOFS) expect(native.bytes.has(key)).toBe(true);
    expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
    await expect(runAccountGenerationOperation(() => undefined)).rejects.toThrow();
    await expect(setPrivateItem('layerwell.appLock.enabled', 'true')).rejects.toThrow();
    release.resolve();
    expect(await cleanup).toMatchObject({ status: 'fulfilled' });
    expect(native.events.indexOf('dev-controls:cleared')).toBeLessThan(native.events.indexOf('purge:owner_proof'));
    expect(native.bytes.has('layerwell.localDataCleanupRequired.v1')).toBe(false);
  });

  it('serializes overlapping direct resets without reopening the later account/photo boundary', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.stubEnv('EXPO_PUBLIC_E2E_LOCAL_RESET', '1');
    const firstEntered = deferred();
    const firstRelease = deferred();
    const secondEntered = deferred();
    const secondRelease = deferred();
    let held = false;
    native.secureDeleteHook = async (key) => {
      if (key === PRIVATE_KV_CONTENT_KEY_NAME && !held) {
        held = true;
        firstEntered.resolve();
        await firstRelease.promise;
      }
    };
    const first = observe(clearLocalPrivateData());
    await firstEntered.promise;
    const second = observe(clearLocalPrivateDataForDevReset(async () => {
      secondEntered.resolve();
      await secondRelease.promise;
    }));
    firstRelease.resolve();
    expect(await first).toMatchObject({ status: 'fulfilled' });
    await secondEntered.promise;
    await expect(runAccountGenerationOperation(() => undefined)).rejects.toThrow();
    await expect(encryptPhotoNote('synthetic late note')).rejects.toThrow('PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY');
    await expect(setPrivateItem('layerwell.appLock.enabled', 'true')).rejects.toThrow();
    secondRelease.resolve();
    expect(await second).toMatchObject({ status: 'fulfilled' });
    expect(native.secure.has(PHOTO_KEY)).toBe(false);
    await expect(runAccountGenerationOperation(() => 'released')).resolves.toBe('released');
  });

  it('never clears recovery controls after failed private cleanup or discards proofs after failed controls', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.stubEnv('EXPO_PUBLIC_E2E_LOCAL_RESET', '1');
    const finish = vi.fn(async () => { throw new Error('SYNTHETIC_CONTROL_FAILURE'); });
    native.failures.add('private_kv_key');
    await expect(clearLocalPrivateDataForDevReset(finish)).rejects.toThrow('private_kv_key');
    expect(finish).not.toHaveBeenCalled();
    native.failures.clear();
    await expect(clearLocalPrivateDataForDevReset(finish)).rejects.toThrow('dev_control_state');
    expect(finish).toHaveBeenCalledOnce();
    for (const key of PROOFS) expect(native.bytes.has(key)).toBe(true);
    expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
  });
});
vi.mock('@/lib/query/queryClient', () => ({
  queryClient: {
    cancelQueries: async () => {
      native.queryCancellations += 1;
      await native.queryCancelHook?.();
    },
    clear: () => undefined,
  },
}));
// Only independent native/vendor effects are synthetic for the selective
// overlap proof. Its owner check, account/photo/privateKV boundaries and raw
// erasure remain the real source implementation.
vi.mock('@/features/notifications/deliver', () => ({
  waitForHealthNotificationOperationsToSettle: async () => undefined,
  scheduleTrialReminder: async () => undefined,
}));
vi.mock('@/features/photos/sensitiveImageMemory', () => ({ purgeSensitiveImageMemory: async () => true }));
vi.mock('@/lib/storage/plaintextStaging', () => ({ scavengePlaintextStaging: async () => {
  native.stagingCalls += 1;
  if (native.stagingFailure) throw new Error('SYNTHETIC_STAGING_RETAINED');
  return 0;
} }));
vi.mock('@/features/photos/photoDeleteRemoteCleanup', () => ({ erasePhotoDeleteRemoteCleanupForOwner: async () => undefined }));
vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env')>()),
  get isSupabaseConfigured() { return native.configuredForSelective; },
}));

it('AUDIT: failed wider account cleanup retains its marker across an overlapping direct purge', async () => {
  const { clearAccountIsolatedState } = await import('@/lib/auth/localAccountIsolation');
  const { markLocalDataCleanupRequired, clearLocalDataCleanupRequired } = await import('@/lib/auth/sessionOwner');
  native.bytes.delete('layerwell.localDataCleanupRequired.v1');
  const firstEntered = deferred();
  const firstRelease = deferred();
  const outerEntered = deferred();
  let held = false;
  native.secureDeleteHook = async (key) => {
    if (key === PRIVATE_KV_CONTENT_KEY_NAME && !held) {
      held = true;
      firstEntered.resolve();
      await firstRelease.promise;
    }
  };
  const first = observe(clearLocalPrivateData());
  await firstEntered.promise;
  const outer = observe(clearAccountIsolatedState({
    markCleanupRequired: markLocalDataCleanupRequired,
    clearCleanupRequired: clearLocalDataCleanupRequired,
    clearPersistedPrivateData: clearLocalPrivateData,
    clearPlaintextStaging: async () => { outerEntered.resolve(); throw new Error('SYNTHETIC_STAGING_RETAINED'); },
    queryCache: { cancelQueries: async () => undefined, clear: () => undefined },
  }));
  await outerEntered.promise;
  expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
  firstRelease.resolve();
  expect(await first).toMatchObject({ status: 'fulfilled' });
  expect(await outer).toMatchObject({ status: 'rejected' });
  expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
  await expect(readLocalDataOwnership(OWNER)).resolves.toBe('cleanup_required');
});

it('AUDIT: independent direct cleanup cannot inherit an unrelated outer scope that ends while its native purge is held', async () => {
  const { clearAccountIsolatedState } = await import('@/lib/auth/localAccountIsolation');
  const { markLocalDataCleanupRequired, clearLocalDataCleanupRequired } = await import('@/lib/auth/sessionOwner');
  const postCleanupEntered = deferred();
  const postCleanupRelease = deferred();
  const directPurgeEntered = deferred();
  const directPurgeRelease = deferred();
  let cancellations = 0;
  let keyDeletions = 0;
  native.secureDeleteHook = async (key) => {
    if (key === PRIVATE_KV_CONTENT_KEY_NAME && ++keyDeletions === 2) {
      directPurgeEntered.resolve();
      await directPurgeRelease.promise;
    }
  };
  const outer = observe(clearAccountIsolatedState({
    markCleanupRequired: markLocalDataCleanupRequired,
    clearCleanupRequired: clearLocalDataCleanupRequired,
    clearPersistedPrivateData: clearLocalPrivateData,
    queryCache: {
      cancelQueries: async () => {
        if (++cancellations === 2) {
          postCleanupEntered.resolve();
          await postCleanupRelease.promise;
        }
      },
      clear: () => undefined,
    },
  }));
  await postCleanupEntered.promise;
  const direct = observe(clearLocalPrivateData());
  await directPurgeEntered.promise;
  expect(native.secure.has(PHOTO_KEY)).toBe(false);
  postCleanupRelease.resolve();
  expect(await outer).toMatchObject({ status: 'fulfilled' });
  const accountAdmission = await observe(runAccountGenerationOperation((lease) => lease.generation));
  if (accountAdmission.status === 'fulfilled') {
    setActiveHealthProcessingEpoch(44, {
      ownerUserId: OWNER, accountGeneration: accountAdmission.value, serverVerifiedAt: null,
    });
  }
  const photo = await observe(encryptPhotoNote('synthetic late owner note'));
  directPurgeRelease.resolve();
  expect(await direct).toMatchObject({ status: 'fulfilled' });
  expect({
    accountReopenedDuringDirectPurge: accountAdmission.status === 'fulfilled',
    photoAcceptedAfterPhotoPurge: photo.status === 'fulfilled',
    photoKeySurvivedSuccessfulDirectPurge: native.secure.has(PHOTO_KEY),
  }).toEqual({
    accountReopenedDuringDirectPurge: false,
    photoAcceptedAfterPhotoPurge: false,
    photoKeySurvivedSuccessfulDirectPurge: false,
  });
});

it('AUDIT: dev reset cannot clear a wider cleanup mark held after native commit but before account begin', async () => {
  const { clearAccountIsolatedState } = await import('@/lib/auth/localAccountIsolation');
  const { markLocalDataCleanupRequired, clearLocalDataCleanupRequired } = await import('@/lib/auth/sessionOwner');
  const { LOCAL_PRIVATE_CONTROL_KEYS, LOCAL_PRIVATE_SECURE_CONTROL_KEYS, LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES } = await import('@/features/settings/localPrivateDataKeys');
  const { default: storage } = await import('@react-native-async-storage/async-storage');
  vi.stubGlobal('__DEV__', true);
  vi.stubEnv('EXPO_PUBLIC_E2E_LOCAL_RESET', '1');
  native.bytes.delete('layerwell.localDataCleanupRequired.v1');
  const firstEntered = deferred();
  const firstRelease = deferred();
  const outerMarkEntered = deferred();
  const outerMarkRelease = deferred();
  const firstProofPurge = deferred();
  let firstCompleted = false;
  native.purgeHook = (stage) => {
    if (stage === 'owner_proof') firstProofPurge.resolve();
  };
  let identity = captureAccountIdentityGeneration();
  let held = false;
  native.secureDeleteHook = async (key) => {
    if (key === PRIVATE_KV_CONTENT_KEY_NAME && !held) {
      held = true;
      firstEntered.resolve();
      await firstRelease.promise;
    }
  };
  const first = observe(clearLocalPrivateDataForDevReset(async () => {
    // Exact registered control-key algorithm used by Welcome. Its required
    // cleanup marker is deferred to the real shared helper's final stage.
    const storedKeys = await storage.getAllKeys();
    const prefixed = storedKeys.filter((key) => LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)));
    await storage.multiRemove([
      ...LOCAL_PRIVATE_CONTROL_KEYS.filter((key) => key !== 'layerwell.localDataCleanupRequired.v1'),
      ...LOCAL_PRIVATE_SECURE_CONTROL_KEYS,
      ...prefixed,
    ]);
  }));
  void first.then(() => { firstCompleted = true; });
  await firstEntered.promise;
  // A full dev reset may itself establish its account boundary once. The
  // following assertion concerns B's still-undelivered native marker only.
  identity = captureAccountIdentityGeneration();
  let markerHeld = false;
  native.markerDeliveryHook = async () => {
    if (!markerHeld) {
      markerHeld = true;
      outerMarkEntered.resolve();
      await outerMarkRelease.promise;
    }
  };
  const outer = observe(clearAccountIsolatedState({
    markCleanupRequired: markLocalDataCleanupRequired,
    clearCleanupRequired: clearLocalDataCleanupRequired,
    clearPersistedPrivateData: clearLocalPrivateData,
    clearPlaintextStaging: async () => { throw new Error('SYNTHETIC_STAGING_RETAINED'); },
    queryCache: { cancelQueries: async () => undefined, clear: () => undefined },
  }));
  await outerMarkEntered.promise;
  expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
  expect(captureAccountIdentityGeneration()).toBe(identity);
  firstRelease.resolve();
  // Successor scheduling: an earlier native marker IO remains held, so a
  // correctly serialized final marker release must wait for it. The original
  // diagnostic80 body/log remains immutable historical evidence.
  await firstProofPurge.promise;
  expect(firstCompleted).toBe(false);
  expect(native.events).not.toContain('remove:layerwell.localDataCleanupRequired.v1');
  expect(captureAccountIdentityGeneration()).toBe(identity);
  const markerAfterDevBeforeOuterBegin = native.bytes.get('layerwell.localDataCleanupRequired.v1') ?? null;
  outerMarkRelease.resolve();
  expect(await first).toMatchObject({ status: 'fulfilled' });
  expect(await outer).toMatchObject({ status: 'rejected' });
  expect({
    markerAfterDevBeforeOuterBegin,
    markerAfterFailedOuter: native.bytes.get('layerwell.localDataCleanupRequired.v1') ?? null,
  }).toEqual({ markerAfterDevBeforeOuterBegin: '1', markerAfterFailedOuter: '1' });
});

it('AUDIT_RESUME: direct purge cannot inherit actual selective-consent account/photo lifetime', async () => {
  const { clearHealthPurposeLocalData } = await import('@/features/healthConsent/selectiveCleanup');
  native.configuredForSelective = true;
  native.bytes.delete('layerwell.localDataCleanupRequired.v1');
  native.bytes.set(PROOFS[0], createHash('sha256').update(`layerwell:local-data-owner:v1:${OWNER}`).digest('hex'));
  native.bytes.delete(PROOFS[1]);
  native.bytes.delete(PROOFS[2]);
  await expect(readLocalDataOwnership(OWNER)).resolves.toBe('match');
  const postPhotoEntered = deferred();
  const postPhotoRelease = deferred();
  const directPurgeEntered = deferred();
  const directPurgeRelease = deferred();
  native.queryCancelHook = async () => {
    if (native.queryCancellations === 2) {
      postPhotoEntered.resolve();
      await postPhotoRelease.promise;
    }
  };
  let heldPrivateKey = false;
  native.secureDeleteHook = async (key) => {
    if (key === PRIVATE_KV_CONTENT_KEY_NAME && !heldPrivateKey) {
      heldPrivateKey = true;
      directPurgeEntered.resolve();
      await directPurgeRelease.promise;
    }
  };
  const selective = observe(clearHealthPurposeLocalData(OWNER));
  await postPhotoEntered.promise;
  expect(native.secure.has(PHOTO_KEY)).toBe(false);
  const direct = observe(clearLocalPrivateData());
  await directPurgeEntered.promise;
  postPhotoRelease.resolve();
  // Read-only selective cleanup attempts its billing reminder only after its
  // own purge. The independent full reset still owns account exclusion, so
  // that callback must refuse with the exact account-lease error.
  const selectiveResult = await selective;
  expect(selectiveResult.status).toBe('rejected');
  if (selectiveResult.status === 'rejected') {
    expect(selectiveResult.error).toBeInstanceOf(AccountGenerationLeaseError);
  }
  const accountAdmission = await observe(runAccountGenerationOperation((lease) => lease.generation));
  if (accountAdmission.status === 'fulfilled') {
    setActiveHealthProcessingEpoch(44, {
      ownerUserId: OWNER, accountGeneration: accountAdmission.value, serverVerifiedAt: null,
    });
  }
  const photo = await observe(encryptPhotoNote('synthetic selective-overlap late owner note'));
  directPurgeRelease.resolve();
  expect(await direct).toMatchObject({ status: 'fulfilled' });
  expect({
    accountReopenedDuringDirectPurge: accountAdmission.status === 'fulfilled',
    photoAcceptedAfterSelectivePhotoPurge: photo.status === 'fulfilled',
    photoKeySurvivedSuccessfulDirectPurge: native.secure.has(PHOTO_KEY),
  }).toEqual({
    accountReopenedDuringDirectPurge: false,
    photoAcceptedAfterSelectivePhotoPurge: false,
    photoKeySurvivedSuccessfulDirectPurge: false,
  });
});

it('AUDIT_RESUME CONTROL: actual selective cleanup succeeds alone and preserves owner identity', async () => {
  const { clearHealthPurposeLocalData } = await import('@/features/healthConsent/selectiveCleanup');
  native.configuredForSelective = true;
  native.bytes.delete('layerwell.localDataCleanupRequired.v1');
  native.bytes.set(PROOFS[0], createHash('sha256').update(`layerwell:local-data-owner:v1:${OWNER}`).digest('hex'));
  native.bytes.delete(PROOFS[1]);
  native.bytes.delete(PROOFS[2]);
  await expect(readLocalDataOwnership(OWNER)).resolves.toBe('match');
  const identity = captureAccountIdentityGeneration();
  await expect(clearHealthPurposeLocalData(OWNER)).resolves.toBeUndefined();
  expect(captureAccountIdentityGeneration()).toBe(identity);
  expect(native.secure.has(PHOTO_KEY)).toBe(false);
  expect(native.bytes.has(ORDER_KEY)).toBe(false);
  await expect(readLocalDataOwnership(OWNER)).resolves.toBe('match');
  await expect(runAccountGenerationOperation(() => 'released')).resolves.toBe('released');
});

it('AUDIT_RESUME: existing photo clear drains native key creation before deleting its content key', async () => {
  native.secure.delete(PHOTO_KEY);
  const keyCreationEntered = deferred();
  const keyCreationRelease = deferred();
  native.secureSetHook = async (key) => {
    if (key === PHOTO_KEY) {
      keyCreationEntered.resolve();
      await keyCreationRelease.promise;
    }
  };
  const photo = observe(encryptPhotoNote('synthetic pre-clear pending owner note'));
  await keyCreationEntered.promise;
  const clearing = observe(clearEncryptedPhotoStorage());
  // Release directly after the actual clear API invocation: event ordering is
  // determined by its synchronous boundary/drain, without timers or polling.
  keyCreationRelease.resolve();
  const photoResult = await photo;
  expect(await clearing).toMatchObject({ status: 'fulfilled' });
  expect({
    pendingPhotoRejected: photoResult.status === 'rejected',
    keyCreatedBeforeDeletion: native.events.indexOf(`secure-set:${PHOTO_KEY}`) <
      native.events.indexOf(`secure-delete-enter:${PHOTO_KEY}`),
    photoKeySurvivedSuccessfulClear: native.secure.has(PHOTO_KEY),
  }).toEqual({
    pendingPhotoRejected: true,
    keyCreatedBeforeDeletion: true,
    photoKeySurvivedSuccessfulClear: false,
  });
});

it('AUDIT_RESUME: dev reset retries the actual wider cleanup before releasing a failed staging quarantine', async () => {
  const { clearAccountIsolatedState } = await import('@/lib/auth/localAccountIsolation');
  const { markLocalDataCleanupRequired, clearLocalDataCleanupRequired } = await import('@/lib/auth/sessionOwner');
  native.bytes.set(PROOFS[0], createHash('sha256').update(`layerwell:local-data-owner:v1:${OWNER}`).digest('hex'));
  native.bytes.delete(PROOFS[1]);
  native.bytes.delete(PROOFS[2]);
  native.failures.add('registered_records');
  await expect(clearAccountIsolatedState({
    markCleanupRequired: markLocalDataCleanupRequired,
    clearCleanupRequired: clearLocalDataCleanupRequired,
    clearPersistedPrivateData: clearLocalPrivateData,
    clearPlaintextStaging: async () => { throw new Error('SYNTHETIC_STAGING_RETAINED'); },
    queryCache: { cancelQueries: async () => undefined, clear: () => undefined },
  })).rejects.toThrow('SYNTHETIC_STAGING_RETAINED');
  native.failures.delete('registered_records');
  const proofsBeforeRetry = PROOFS.map((key) => native.bytes.get(key));
  expect(proofsBeforeRetry[0]).toMatch(/^[a-f0-9]{64}$/u);
  expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
  vi.stubGlobal('__DEV__', true);
  vi.stubEnv('EXPO_PUBLIC_E2E_LOCAL_RESET', '1');
  const controls = vi.fn(async () => undefined);
  native.stagingFailure = true;
  await expect(clearLocalPrivateDataForDevReset(controls)).rejects.toThrow();
  expect(controls).not.toHaveBeenCalled();
  expect(PROOFS.map((key) => native.bytes.get(key))).toEqual(proofsBeforeRetry);
  expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
  await expect(readLocalDataOwnership(OWNER)).resolves.toBe('cleanup_required');
  native.stagingFailure = false;
  await clearLocalPrivateDataForDevReset(controls);
  expect(native.stagingCalls).toBeGreaterThanOrEqual(2);
  expect(controls).toHaveBeenCalledOnce();
  for (const key of PROOFS) expect(native.bytes.has(key)).toBe(false);
  expect(native.bytes.has('layerwell.localDataCleanupRequired.v1')).toBe(false);
  await expect(readLocalDataOwnership(OWNER)).resolves.toBe('unclaimed');
});

it('AUDIT_RESUME: independent reset drains pending photo creation and retains quarantine after a native partial failure', async () => {
  native.bytes.delete('layerwell.localDataCleanupRequired.v1');
  native.bytes.set(PROOFS[0], createHash('sha256').update(`layerwell:local-data-owner:v1:${OWNER}`).digest('hex'));
  native.bytes.delete(PROOFS[1]);
  native.bytes.delete(PROOFS[2]);
  const ownerProof = native.bytes.get(PROOFS[0]);
  const photoEntered = deferred();
  const photoRelease = deferred();
  const markerEntered = deferred();
  native.secureSetHook = async (key) => {
    if (key === PHOTO_KEY) {
      photoEntered.resolve();
      await photoRelease.promise;
    }
  };
  const photo = observe(encryptPhotoNote('synthetic pending photo before partial reset'));
  await photoEntered.promise;
  native.markerDeliveryHook = async () => { markerEntered.resolve(); };
  native.failures.add('private_kv_key');
  const cleanup = observe(clearLocalPrivateData());
  await markerEntered.promise;
  await expect(runAccountGenerationOperation(() => undefined)).rejects.toBeInstanceOf(AccountGenerationLeaseError);
  photoRelease.resolve();
  expect(await photo).toMatchObject({ status: 'rejected' });
  expect(await cleanup).toMatchObject({ status: 'rejected' });
  expect(native.secure.has(PHOTO_KEY)).toBe(false);
  expect(native.events.indexOf(`secure-set:${PHOTO_KEY}`)).toBeLessThan(
    native.events.indexOf(`secure-delete:${PHOTO_KEY}`),
  );
  expect(native.bytes.get(PROOFS[0])).toBe(ownerProof);
  expect(native.bytes.get('layerwell.localDataCleanupRequired.v1')).toBe('1');
  await expect(readLocalDataOwnership(OWNER)).resolves.toBe('cleanup_required');
  expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
  await expect(runAccountGenerationOperation(() => 'released')).resolves.toBe('released');
});
