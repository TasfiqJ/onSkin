import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  HEALTH_PROCESSING_STATUS_LEASE_MS,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  assertPrivateKVReadable,
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  getPrivateItem,
  getPrivateItems,
  getPrivateItemsForPurposeLimitedExport,
  PRIVATE_KV_CONTENT_KEY_INVALID,
  PRIVATE_KV_CONTENT_KEY_MISSING,
  PRIVATE_KV_DECRYPTION_FAILED,
  PRIVATE_KV_ENVELOPE_FOREIGN,
  PRIVATE_KV_ENVELOPE_INVALID,
  PRIVATE_KV_ENVELOPE_UNSUPPORTED,
  PRIVATE_KV_RESERVED_KEY,
  PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE,
  PRIVATE_KV_WRITE_CONFLICT,
  PRIVATE_KV_WRITE_ROLLBACK_FAILED,
  removePrivateItem,
  multiRemovePrivateItems,
  privateKVEncryptionInfo,
  setPrivateItem,
  updateCatalogLookupQueueForPurposeLimitedExport,
  updatePrivateItem,
  waitForPrivateKVWritesToSettle,
} from './privateKV';

const mocks = vi.hoisted(() => ({
  asyncStorage: new Map<string, string>(),
  getItemGate: null as Promise<void> | null,
  getItemStarted: null as (() => void) | null,
  multiGetGate: null as Promise<void> | null,
  multiGetStarted: null as (() => void) | null,
  platformOS: 'ios',
  removeItemCommitted: null as ((key: string) => void) | null,
  removeItemGate: null as Promise<void> | null,
  removeItemGateKey: null as string | null,
  removeItemOutcomeKey: null as string | null,
  removeItemOutcomes: [] as ('resolve' | 'reject-before' | 'reject-after')[],
  removeItemStartedKey: null as string | null,
  removeItemStarted: null as (() => void) | null,
  secureGetThrows: false,
  secureGetGate: null as Promise<void> | null,
  secureGetStarted: null as (() => void) | null,
  secureStorage: new Map<string, string>(),
  setItemCommitted: null as ((key: string, value: string) => void) | null,
  setItemGate: null as Promise<void> | null,
  setItemOutcomeKey: null as string | null,
  setItemOutcomes: [] as ('resolve' | 'reject-before' | 'reject-after')[],
  setItemStarted: null as (() => void) | null,
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platformOS;
    },
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => {
      mocks.getItemStarted?.();
      if (mocks.getItemGate) await mocks.getItemGate;
      return mocks.asyncStorage.get(key) ?? null;
    }),
    getAllKeys: vi.fn(async () => [...mocks.asyncStorage.keys()]),
    multiGet: vi.fn(async (keys: string[]) => {
      mocks.multiGetStarted?.();
      if (mocks.multiGetGate) await mocks.multiGetGate;
      return keys.map(
        (key) => [key, mocks.asyncStorage.get(key) ?? null] as [string, string | null],
      );
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.setItemStarted?.();
      if (mocks.setItemGate) await mocks.setItemGate;
      const outcome =
        mocks.setItemOutcomeKey === key ? (mocks.setItemOutcomes.shift() ?? 'resolve') : 'resolve';
      if (outcome === 'reject-before') {
        throw new Error('ASYNC_STORAGE_SET_REJECTED_BEFORE_COMMIT');
      }
      mocks.asyncStorage.set(key, value);
      mocks.setItemCommitted?.(key, value);
      if (outcome === 'reject-after') {
        throw new Error('ASYNC_STORAGE_SET_REJECTED_AFTER_COMMIT');
      }
    }),
    removeItem: vi.fn(async (key: string) => {
      if (mocks.removeItemStartedKey === null || mocks.removeItemStartedKey === key) {
        mocks.removeItemStarted?.();
      }
      if (
        mocks.removeItemGate &&
        (mocks.removeItemGateKey === null || mocks.removeItemGateKey === key)
      ) {
        await mocks.removeItemGate;
      }
      const outcome =
        mocks.removeItemOutcomeKey === key
          ? (mocks.removeItemOutcomes.shift() ?? 'resolve')
          : 'resolve';
      if (outcome === 'reject-before') {
        throw new Error('ASYNC_STORAGE_REMOVE_REJECTED_BEFORE_COMMIT');
      }
      mocks.asyncStorage.delete(key);
      mocks.removeItemCommitted?.(key);
      if (outcome === 'reject-after') {
        throw new Error('ASYNC_STORAGE_REMOVE_REJECTED_AFTER_COMMIT');
      }
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      mocks.removeItemStarted?.();
      if (mocks.removeItemGate) await mocks.removeItemGate;
      for (const key of keys) mocks.asyncStorage.delete(key);
    }),
  },
}));

vi.mock('react-native-get-random-values', () => ({}));

vi.mock('expo-secure-store', () => ({
  isAvailableAsync: vi.fn(async () => true),
  getItemAsync: vi.fn(async (key: string) => {
    mocks.secureGetStarted?.();
    if (mocks.secureGetGate) await mocks.secureGetGate;
    if (mocks.secureGetThrows) throw new Error('secure read failed');
    return mocks.secureStorage.get(key) ?? null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    mocks.secureStorage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mocks.secureStorage.delete(key);
  }),
}));

describe('private KV encrypted storage', () => {
  beforeEach(() => {
    mocks.asyncStorage.clear();
    mocks.getItemGate = null;
    mocks.getItemStarted = null;
    mocks.multiGetGate = null;
    mocks.multiGetStarted = null;
    mocks.platformOS = 'ios';
    mocks.removeItemCommitted = null;
    mocks.removeItemGate = null;
    mocks.removeItemGateKey = null;
    mocks.removeItemOutcomeKey = null;
    mocks.removeItemOutcomes.length = 0;
    mocks.removeItemStartedKey = null;
    mocks.removeItemStarted = null;
    mocks.secureGetThrows = false;
    mocks.secureGetGate = null;
    mocks.secureGetStarted = null;
    mocks.secureStorage.clear();
    mocks.setItemCommitted = null;
    mocks.setItemGate = null;
    mocks.setItemOutcomeKey = null;
    mocks.setItemOutcomes.length = 0;
    mocks.setItemStarted = null;
    endPrivateKVAccountBoundary();
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'test-owner',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps legacy plaintext values readable', async () => {
    mocks.asyncStorage.set('legacy-key', 'legacy-value');

    await expect(getPrivateItem('legacy-key')).resolves.toBe('legacy-value');
  });

  it('roundtrips encrypted values through AsyncStorage', async () => {
    await setPrivateItem('routine-key', 'routine-value');

    const raw = mocks.asyncStorage.get('routine-key');
    expect(raw).toContain(privateKVEncryptionInfo.version);
    expect(raw).not.toContain('routine-value');
    await expect(getPrivateItem('routine-key')).resolves.toBe('routine-value');
  });

  it('preserves prior quarantine when an additional recovery guard expires after the transform but before native write', async () => {
    const key = 'layerwell.entitlement.v2';
    const prior = JSON.stringify({ store: { serverProtocolRejected: true } });
    await setPrivateItem(key, prior);
    const priorRaw = mocks.asyncStorage.get(key);
    let current = true;
    let release!: () => void;
    let readStarted!: () => void;
    const nextRead = new Promise<void>((resolve) => { readStarted = resolve; });
    const held = new Promise<void>((resolve) => { release = resolve; });
    const write = updatePrivateItem(key, () => {
      // The real writer awaits a final native read after its sync transform.
      mocks.getItemGate = held;
      mocks.getItemStarted = readStarted;
      return JSON.stringify({ store: { serverProtocolRejected: false } });
    }, () => {
      if (!current) throw new Error('ENTITLEMENT_SERVER_READ_INVALIDATED');
    });
    const denied = expect(write).rejects.toThrow('ENTITLEMENT_SERVER_READ_INVALIDATED');
    await nextRead;
    current = false;
    mocks.getItemGate = null;
    mocks.getItemStarted = null;
    release();
    await denied;
    expect(mocks.asyncStorage.get(key)).toBe(priorRaw);
    await expect(getPrivateItem(key)).resolves.toBe(prior);
  });

  it('rolls a stale recovery write back to exact quarantined ciphertext even if the queued negative operation fails', async () => {
    const key = 'layerwell.entitlement.v2';
    const prior = JSON.stringify({ store: { serverProtocolRejected: true } });
    await setPrivateItem(key, prior);
    const priorRaw = mocks.asyncStorage.get(key);
    let current = true;
    let release!: () => void;
    let writeStarted!: () => void;
    mocks.setItemGate = new Promise<void>((resolve) => { release = resolve; });
    const writing = new Promise<void>((resolve) => { writeStarted = resolve; });
    mocks.setItemStarted = writeStarted;
    const commits: string[] = [];
    mocks.setItemCommitted = (storedKey, raw) => { if (storedKey === key) commits.push(raw); };
    const recovery = updatePrivateItem(key,
      () => JSON.stringify({ store: { serverProtocolRejected: false } }),
      () => { if (!current) throw new Error('ENTITLEMENT_SERVER_READ_INVALIDATED'); });
    const recoveryDenied = expect(recovery).rejects.toThrow('ENTITLEMENT_SERVER_READ_INVALIDATED');
    await writing;
    current = false;
    // Its plaintext/key have already been read. This later native key failure
    // applies to the queued negative operation, after the first writer rolls back.
    mocks.secureGetThrows = true;
    const negative = updatePrivateItem(key, () => prior);
    const negativeFailed = expect(negative).rejects.toThrow('PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE');
    release();
    await Promise.all([recoveryDenied, negativeFailed]);
    expect(commits).toHaveLength(2);
    expect(commits[0]).not.toBe(priorRaw);
    expect(commits[1]).toBe(priorRaw);
    expect(mocks.asyncStorage.get(key)).toBe(priorRaw);
    mocks.secureGetThrows = false;
    await expect(getPrivateItem(key)).resolves.toBe(prior);
  });

  it('does not let an additional permissive guard bypass the existing health authority', async () => {
    await setPrivateItem('layerwell.skinprofile.v1', 'prior-profile');
    const priorRaw = mocks.asyncStorage.get('layerwell.skinprofile.v1');
    clearActiveHealthProcessingEpoch();
    await expect(updatePrivateItem('layerwell.skinprofile.v1', () => 'changed', () => undefined))
      .rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(mocks.asyncStorage.get('layerwell.skinprofile.v1')).toBe(priorRaw);
  });

  it('blocks a classified health record when local processing is closed', async () => {
    clearActiveHealthProcessingEpoch();

    await expect(setPrivateItem('layerwell.skinprofile.v1', 'stale-profile')).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
    expect(mocks.asyncStorage.has('layerwell.skinprofile.v1')).toBe(false);
  });

  it('does not return a classified pre-withdrawal read after same-value re-grant', async () => {
    await setPrivateItem('layerwell.skinprofile.v1', 'prior-profile');
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    mocks.getItemGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.getItemStarted = markReadStarted;

    const staleRead = getPrivateItem('layerwell.skinprofile.v1');
    await readStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'test-owner',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
    releaseRead();

    await expect(staleRead).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
  });

  it('removes a new classified commit when its status lease expires during storage I/O', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T16:00:00.000Z'));
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(7, {
      ownerUserId: 'test-owner',
      accountGeneration: 0,
      serverVerifiedAt: new Date(Date.now()).toISOString(),
    });

    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    mocks.setItemGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    mocks.setItemStarted = markWriteStarted;

    const write = setPrivateItem('layerwell.skinprofile.v1', 'lease-bound-profile');
    await writeStarted;
    const rejection = expect(write).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    releaseWrite();

    await rejection;
    expect(mocks.asyncStorage.has('layerwell.skinprofile.v1')).toBe(false);
  });

  it('restores the exact prior ciphertext when a classified update outlives its status lease', async () => {
    await setPrivateItem('layerwell.skinprofile.v1', 'prior-profile');
    const priorRaw = mocks.asyncStorage.get('layerwell.skinprofile.v1');

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T16:00:00.000Z'));
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(8, {
      ownerUserId: 'test-owner',
      accountGeneration: 0,
      serverVerifiedAt: new Date(Date.now()).toISOString(),
    });
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    mocks.setItemGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    mocks.setItemStarted = markWriteStarted;

    const write = setPrivateItem('layerwell.skinprofile.v1', 'expired-update');
    await writeStarted;
    const rejection = expect(write).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    releaseWrite();

    await rejection;
    expect(mocks.asyncStorage.get('layerwell.skinprofile.v1')).toBe(priorRaw);
    setActiveHealthProcessingEpoch(8, {
      ownerUserId: 'test-owner',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
    await expect(getPrivateItem('layerwell.skinprofile.v1')).resolves.toBe('prior-profile');
  });

  it('restores exact prior ciphertext when setItem commits and then rejects', async () => {
    const key = 'layerwell.set-commit-reject-existing';
    await setPrivateItem(key, 'prior-value');
    const priorRaw = mocks.asyncStorage.get(key);
    mocks.setItemOutcomeKey = key;
    mocks.setItemOutcomes.push('reject-after');

    await expect(setPrivateItem(key, 'rejected-value')).rejects.toThrow(
      'ASYNC_STORAGE_SET_REJECTED_AFTER_COMMIT',
    );

    expect(mocks.asyncStorage.get(key)).toBe(priorRaw);
    await expect(getPrivateItem(key)).resolves.toBe('prior-value');
  });

  it('restores exact prior absence when first setItem commits and then rejects', async () => {
    const key = 'layerwell.set-commit-reject-new';
    mocks.setItemOutcomeKey = key;
    mocks.setItemOutcomes.push('reject-after');

    await expect(setPrivateItem(key, 'rejected-value')).rejects.toThrow(
      'ASYNC_STORAGE_SET_REJECTED_AFTER_COMMIT',
    );

    expect(mocks.asyncStorage.has(key)).toBe(false);
  });

  it('preserves exact prior ciphertext when setItem rejects before committing', async () => {
    const key = 'layerwell.set-reject-before-commit';
    await setPrivateItem(key, 'prior-value');
    const priorRaw = mocks.asyncStorage.get(key);
    mocks.setItemOutcomeKey = key;
    mocks.setItemOutcomes.push('reject-before');

    await expect(setPrivateItem(key, 'rejected-value')).rejects.toThrow(
      'ASYNC_STORAGE_SET_REJECTED_BEFORE_COMMIT',
    );

    expect(mocks.asyncStorage.get(key)).toBe(priorRaw);
  });

  it('fails closed when committed setItem bytes cannot be rolled back', async () => {
    const key = 'layerwell.set-rollback-failure';
    await setPrivateItem(key, 'prior-value');
    const priorRaw = mocks.asyncStorage.get(key);
    mocks.setItemOutcomeKey = key;
    mocks.setItemOutcomes.push('reject-after', 'reject-before');

    await expect(setPrivateItem(key, 'ambiguous-value')).rejects.toThrow(
      PRIVATE_KV_WRITE_ROLLBACK_FAILED,
    );

    expect(mocks.asyncStorage.get(key)).not.toBe(priorRaw);
  });

  it('fails closed without overwriting conflicting bytes after setItem rejection', async () => {
    const key = 'layerwell.set-rollback-conflict';
    await setPrivateItem(key, 'prior-value');
    const replacement = 'concurrent-authoritative-replacement';
    const priorRaw = mocks.asyncStorage.get(key);
    mocks.setItemOutcomeKey = key;
    mocks.setItemOutcomes.push('reject-after');
    mocks.setItemCommitted = (committedKey, committedValue) => {
      if (committedKey === key && committedValue !== priorRaw) {
        mocks.asyncStorage.set(key, replacement);
      }
    };

    await expect(setPrivateItem(key, 'ambiguous-value')).rejects.toThrow(
      PRIVATE_KV_WRITE_ROLLBACK_FAILED,
    );

    expect(mocks.asyncStorage.get(key)).toBe(replacement);
  });

  it('restores exact prior ciphertext when a delayed guarded removal loses health authority', async () => {
    const key = 'layerwell.skinprofile.v1';
    await setPrivateItem(key, 'prior-profile');
    const priorRaw = mocks.asyncStorage.get(key);
    let releaseRemoval!: () => void;
    let markRemovalStarted!: () => void;
    mocks.removeItemGate = new Promise<void>((resolve) => {
      releaseRemoval = resolve;
    });
    mocks.removeItemGateKey = key;
    mocks.removeItemStartedKey = key;
    const removalStarted = new Promise<void>((resolve) => {
      markRemovalStarted = resolve;
    });
    mocks.removeItemStarted = markRemovalStarted;

    const removal = updatePrivateItem(key, () => null);
    await removalStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'test-owner',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
    releaseRemoval();

    await expect(removal).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(mocks.asyncStorage.get(key)).toBe(priorRaw);
    await expect(getPrivateItem(key)).resolves.toBe('prior-profile');
  });

  it('restores exact prior ciphertext when a delayed guarded removal loses account authority', async () => {
    const key = 'layerwell.catalog.lookupQueue.v1';
    await setPrivateItem(key, 'prior-catalog-queue');
    const priorRaw = mocks.asyncStorage.get(key);
    clearActiveHealthProcessingEpoch();
    let releaseRemoval!: () => void;
    let markRemovalStarted!: () => void;
    mocks.removeItemGate = new Promise<void>((resolve) => {
      releaseRemoval = resolve;
    });
    mocks.removeItemGateKey = key;
    mocks.removeItemStartedKey = key;
    const removalStarted = new Promise<void>((resolve) => {
      markRemovalStarted = resolve;
    });
    mocks.removeItemStarted = markRemovalStarted;

    const removal = runAccountGenerationOperation((accountLease) =>
      updateCatalogLookupQueueForPurposeLimitedExport(accountLease, () => null),
    );
    await removalStarted;
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    releaseRemoval();

    await expect(removal).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    expect(mocks.asyncStorage.get(key)).toBe(priorRaw);
    await expect(
      runAccountGenerationOperation((accountLease) =>
        getPrivateItemsForPurposeLimitedExport([key], accountLease),
      ),
    ).resolves.toEqual(new Map([[key, 'prior-catalog-queue']]));
  });

  it('restores exact prior ciphertext when guarded remove commits and then rejects', async () => {
    const key = 'layerwell.remove-commit-reject';
    await setPrivateItem(key, 'prior-value');
    const priorRaw = mocks.asyncStorage.get(key);
    mocks.removeItemOutcomeKey = key;
    mocks.removeItemOutcomes.push('reject-after');

    await expect(updatePrivateItem(key, () => null)).rejects.toThrow(
      'ASYNC_STORAGE_REMOVE_REJECTED_AFTER_COMMIT',
    );

    expect(mocks.asyncStorage.get(key)).toBe(priorRaw);
    await expect(getPrivateItem(key)).resolves.toBe('prior-value');
  });

  it('fails closed when guarded removal rollback cannot restore prior ciphertext', async () => {
    const key = 'layerwell.skinprofile.v1';
    await setPrivateItem(key, 'prior-value');
    const priorRaw = mocks.asyncStorage.get(key);
    mocks.setItemOutcomeKey = key;
    mocks.setItemOutcomes.push('reject-before');
    let releaseRemoval!: () => void;
    let markRemovalStarted!: () => void;
    mocks.removeItemGate = new Promise<void>((resolve) => {
      releaseRemoval = resolve;
    });
    mocks.removeItemGateKey = key;
    mocks.removeItemStartedKey = key;
    const removalStarted = new Promise<void>((resolve) => {
      markRemovalStarted = resolve;
    });
    mocks.removeItemStarted = markRemovalStarted;

    const removal = updatePrivateItem(key, () => null);
    await removalStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'test-owner',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
    releaseRemoval();

    await expect(removal).rejects.toThrow(PRIVATE_KV_WRITE_ROLLBACK_FAILED);
    expect(mocks.asyncStorage.get(key)).not.toBe(priorRaw);
  });

  it('fails closed without overwriting a conflicting guarded-removal replacement', async () => {
    const key = 'layerwell.skinprofile.v1';
    await setPrivateItem(key, 'prior-profile');
    const replacement = 'concurrent-authoritative-replacement';
    mocks.removeItemCommitted = (committedKey) => {
      if (committedKey === key) mocks.asyncStorage.set(key, replacement);
    };
    let releaseRemoval!: () => void;
    let markRemovalStarted!: () => void;
    mocks.removeItemGate = new Promise<void>((resolve) => {
      releaseRemoval = resolve;
    });
    mocks.removeItemGateKey = key;
    mocks.removeItemStartedKey = key;
    const removalStarted = new Promise<void>((resolve) => {
      markRemovalStarted = resolve;
    });
    mocks.removeItemStarted = markRemovalStarted;

    const removal = updatePrivateItem(key, () => null);
    await removalStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'test-owner',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
    releaseRemoval();

    await expect(removal).rejects.toThrow(PRIVATE_KV_WRITE_ROLLBACK_FAILED);
    expect(mocks.asyncStorage.get(key)).toBe(replacement);
  });

  it('keeps classified deletion and nonclassified account state available after withdrawal', async () => {
    await Promise.all([
      setPrivateItem('layerwell.skinprofile.v1', 'profile'),
      setPrivateItem('layerwell.shelf.v1', 'shelf'),
      setPrivateItem('layerwell.notifPrefs.v1', 'notifications'),
    ]);
    clearActiveHealthProcessingEpoch();

    const genericUpdater = vi.fn(() => null);
    await expect(updatePrivateItem('layerwell.skinprofile.v1', genericUpdater)).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
    expect(genericUpdater).not.toHaveBeenCalled();
    await removePrivateItem('layerwell.skinprofile.v1');
    await removePrivateItem('layerwell.shelf.v1');
    await multiRemovePrivateItems(['layerwell.notifPrefs.v1']);
    await setPrivateItem('layerwell.account-control.v1', 'retained-control');

    expect(mocks.asyncStorage.has('layerwell.skinprofile.v1')).toBe(false);
    expect(mocks.asyncStorage.has('layerwell.shelf.v1')).toBe(false);
    expect(mocks.asyncStorage.has('layerwell.notifPrefs.v1')).toBe(false);
    await expect(getPrivateItem('layerwell.account-control.v1')).resolves.toBe('retained-control');
  });

  it('never exposes decrypted classified bytes to an updater after withdrawal during key read', async () => {
    await setPrivateItem('layerwell.skinprofile.v1', 'prior-profile');
    let releaseKeyRead!: () => void;
    let markKeyReadStarted!: () => void;
    mocks.secureGetGate = new Promise<void>((resolve) => {
      releaseKeyRead = resolve;
    });
    const keyReadStarted = new Promise<void>((resolve) => {
      markKeyReadStarted = resolve;
    });
    mocks.secureGetStarted = markKeyReadStarted;
    const updater = vi.fn(() => 'resurrected-profile');

    const staleUpdate = updatePrivateItem('layerwell.skinprofile.v1', updater);
    await keyReadStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(2, {
      ownerUserId: 'test-owner',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
    releaseKeyRead();

    await expect(staleUpdate).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(updater).not.toHaveBeenCalled();
  });

  it('preserves structurally invalid encrypted envelopes and blocks replacement', async () => {
    await setPrivateItem('layerwell.seed', 'seed');
    const raw = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      nonceHex: 'not-hex',
      ciphertextHex: 'also-not-hex',
    });
    const key = 'layerwell.corrupt-key';
    mocks.asyncStorage.set(key, raw);

    await expect(getPrivateItem(key)).rejects.toThrow(PRIVATE_KV_ENVELOPE_INVALID);
    await expect(setPrivateItem(key, 'replacement')).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE,
    );
    expect(mocks.asyncStorage.get(key)).toBe(raw);
  });

  it.each([
    ['truncated JSON', `{"version":"${privateKVEncryptionInfo.version}","nonceHex":"00"`],
    [
      'missing ciphertext',
      JSON.stringify({ version: privateKVEncryptionInfo.version, nonceHex: '00'.repeat(24) }),
    ],
    [
      'wrong field type',
      JSON.stringify({
        version: privateKVEncryptionInfo.version,
        nonceHex: ['00'],
        ciphertextHex: '00'.repeat(16),
      }),
    ],
  ])('fails the full audit without changing a %s envelope', async (_label, raw) => {
    mocks.asyncStorage.set('layerwell.corrupt', raw);

    await expect(assertPrivateKVReadable()).rejects.toThrow(PRIVATE_KV_ENVELOPE_INVALID);
    expect(mocks.asyncStorage.get('layerwell.corrupt')).toBe(raw);
  });

  it('preserves unsupported private envelope versions', async () => {
    const raw = JSON.stringify({
      version: 'xchacha20poly1305:v2',
      nonceHex: '00'.repeat(24),
      ciphertextHex: '00'.repeat(16),
    });
    mocks.asyncStorage.set('layerwell.future', raw);

    await expect(assertPrivateKVReadable()).rejects.toThrow(PRIVATE_KV_ENVELOPE_UNSUPPORTED);
    expect(mocks.asyncStorage.get('layerwell.future')).toBe(raw);
  });

  it('rejects a direct overwrite of malformed ciphertext before creating a key', async () => {
    const raw = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      nonceHex: '00'.repeat(24),
      ciphertextHex: '00',
    });
    mocks.asyncStorage.set('layerwell.corrupt', raw);

    await expect(setPrivateItem('layerwell.corrupt', 'replacement')).rejects.toThrow(
      PRIVATE_KV_ENVELOPE_INVALID,
    );
    expect(mocks.asyncStorage.get('layerwell.corrupt')).toBe(raw);
    expect(mocks.secureStorage.size).toBe(0);
  });

  it('treats malformed private envelopes as orphaned ciphertext before key creation', async () => {
    const raw = `{"version":"${privateKVEncryptionInfo.version}","nonceHex":"00"`;
    mocks.asyncStorage.set('layerwell.orphaned', raw);

    await expect(setPrivateItem('layerwell.new-record', 'new-value')).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_MISSING,
    );
    expect(mocks.asyncStorage.get('layerwell.orphaned')).toBe(raw);
    expect(mocks.asyncStorage.has('layerwell.new-record')).toBe(false);
    expect(mocks.secureStorage.size).toBe(0);
  });

  it('batch-reads encrypted and legacy values with one complete result map', async () => {
    await setPrivateItem('encrypted-a', 'value-a');
    await setPrivateItem('encrypted-b', JSON.stringify({ value: 'b' }));
    mocks.asyncStorage.set('legacy', 'legacy-value');

    await expect(
      getPrivateItems(['encrypted-a', 'encrypted-b', 'legacy', 'missing']),
    ).resolves.toEqual(
      new Map([
        ['legacy', 'legacy-value'],
        ['missing', null],
        ['encrypted-a', 'value-a'],
        ['encrypted-b', JSON.stringify({ value: 'b' })],
      ]),
    );
  });

  it('keeps ordinary health reads closed while a verified data export can read them', async () => {
    await setPrivateItem('layerwell.skinprofile.v1', 'exportable-profile');
    clearActiveHealthProcessingEpoch();

    await expect(getPrivateItems(['layerwell.skinprofile.v1'])).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
    await expect(
      runAccountGenerationOperation((accountLease) =>
        getPrivateItemsForPurposeLimitedExport(['layerwell.skinprofile.v1'], accountLease),
      ),
    ).resolves.toEqual(new Map([['layerwell.skinprofile.v1', 'exportable-profile']]));
  });

  it('allows only account-bound catalog queue TTL reduction after health processing closes', async () => {
    const key = 'layerwell.catalog.lookupQueue.v1';
    await setPrivateItem(key, 'expired-catalog-queue');
    clearActiveHealthProcessingEpoch();

    await runAccountGenerationOperation((accountLease) =>
      updateCatalogLookupQueueForPurposeLimitedExport(accountLease, () => null),
    );

    await expect(
      runAccountGenerationOperation((accountLease) =>
        getPrivateItemsForPurposeLimitedExport([key], accountLease),
      ),
    ).resolves.toEqual(new Map([[key, null]]));
  });

  it('rejects a purpose-limited export read after an A-to-B-to-A account boundary', async () => {
    await setPrivateItem('layerwell.skinprofile.v1', 'account-a-profile');
    clearActiveHealthProcessingEpoch();
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    mocks.multiGetGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.multiGetStarted = markReadStarted;

    const pending = runAccountGenerationOperation((accountLease) =>
      getPrivateItemsForPurposeLimitedExport(['layerwell.skinprofile.v1'], accountLease),
    );
    await readStarted;
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    releaseRead();

    await expect(pending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
  });

  it('audits every private envelope without treating other encrypted formats as private KV', async () => {
    await setPrivateItem('layerwell.profile', 'profile-value');
    mocks.asyncStorage.set('legacy', 'legacy-value');
    const foreignRaw = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      keyId: 'supabase-session-key-v1',
      nonceHex: 'not-private-kv',
      ciphertextHex: 'not-private-kv',
    });
    const foreignKey = 'sb-placeholder-auth-token';
    mocks.asyncStorage.set(foreignKey, foreignRaw);

    await expect(assertPrivateKVReadable()).resolves.toBeUndefined();
    await expect(getPrivateItem('layerwell.profile')).resolves.toBe('profile-value');
    await expect(getPrivateItem(foreignKey)).rejects.toThrow(PRIVATE_KV_ENVELOPE_FOREIGN);
    await expect(getPrivateItems([foreignKey])).rejects.toThrow(PRIVATE_KV_ENVELOPE_FOREIGN);
    await expect(setPrivateItem(foreignKey, 'replacement')).rejects.toThrow(
      PRIVATE_KV_ENVELOPE_FOREIGN,
    );
    expect(mocks.asyncStorage.get(foreignKey)).toBe(foreignRaw);
  });

  it('authenticates availability without retaining decrypted byte buffers', async () => {
    await setPrivateItem('layerwell.profile', 'sensitive-profile');
    const fillSpy = vi.spyOn(Uint8Array.prototype, 'fill');
    try {
      await expect(assertPrivateKVReadable()).resolves.toBeUndefined();
      expect(fillSpy.mock.calls.some(([value]) => value === 0)).toBe(true);
    } finally {
      fillSpy.mockRestore();
    }
  });

  it('invalidates availability authentication at an account boundary', async () => {
    await setPrivateItem('layerwell.profile', 'account-a-profile');
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    mocks.multiGetGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.multiGetStarted = markReadStarted;

    const pending = assertPrivateKVReadable();
    await readStarted;
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    releaseRead();

    await expect(pending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
  });

  it('rejects reads, writes, and removals against reserved storage authorities', async () => {
    const foreignKey = 'sb-placeholder-auth-token';
    const contentKey = privateKVEncryptionInfo.secureStoreKey;
    mocks.asyncStorage.set(foreignKey, 'foreign-session');
    mocks.asyncStorage.set(contentKey, 'legacy-content-key');

    await expect(removePrivateItem(foreignKey)).rejects.toThrow(PRIVATE_KV_ENVELOPE_FOREIGN);
    await expect(multiRemovePrivateItems(['layerwell.profile', foreignKey])).rejects.toThrow(
      PRIVATE_KV_ENVELOPE_FOREIGN,
    );
    await expect(getPrivateItem(contentKey)).rejects.toThrow(PRIVATE_KV_RESERVED_KEY);
    await expect(getPrivateItems([contentKey])).rejects.toThrow(PRIVATE_KV_RESERVED_KEY);
    await expect(setPrivateItem(contentKey, 'replacement')).rejects.toThrow(
      PRIVATE_KV_RESERVED_KEY,
    );
    await expect(removePrivateItem(contentKey)).rejects.toThrow(PRIVATE_KV_RESERVED_KEY);
    await expect(multiRemovePrivateItems(['layerwell.profile', contentKey])).rejects.toThrow(
      PRIVATE_KV_RESERVED_KEY,
    );

    expect(mocks.asyncStorage.get(foreignKey)).toBe('foreign-session');
    expect(mocks.asyncStorage.get(contentKey)).toBe('legacy-content-key');
  });

  it('rejects an arbitrary keyId on an app-owned private envelope', async () => {
    const raw = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      keyId: 'not-a-known-authority',
      nonceHex: '00'.repeat(24),
      ciphertextHex: '00'.repeat(16),
    });
    mocks.asyncStorage.set('layerwell.profile', raw);

    await expect(assertPrivateKVReadable()).rejects.toThrow(PRIVATE_KV_ENVELOPE_INVALID);
    expect(mocks.asyncStorage.get('layerwell.profile')).toBe(raw);
  });

  it('keeps unrelated legacy nonce/ciphertext payloads outside private-KV ownership', async () => {
    const raw = JSON.stringify({ nonceHex: 'aa', ciphertextHex: 'bb' });
    mocks.asyncStorage.set('third-party-cache', raw);

    await expect(assertPrivateKVReadable()).resolves.toBeUndefined();
    await expect(getPrivateItem('third-party-cache')).resolves.toBe(raw);
  });

  it('preserves every private envelope when the shared content key is unavailable', async () => {
    await setPrivateItem('layerwell.profile', 'profile-value');
    await setPrivateItem('layerwell.shelf', 'shelf-value');
    const profileCiphertext = mocks.asyncStorage.get('layerwell.profile');
    const shelfCiphertext = mocks.asyncStorage.get('layerwell.shelf');
    mocks.secureGetThrows = true;

    await expect(assertPrivateKVReadable()).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
    );

    expect(mocks.asyncStorage.get('layerwell.profile')).toBe(profileCiphertext);
    expect(mocks.asyncStorage.get('layerwell.shelf')).toBe(shelfCiphertext);
    expect(mocks.secureStorage.size).toBe(1);
  });

  it('shares one content key across concurrent first writes', async () => {
    await Promise.all([
      setPrivateItem('layerwell.concurrent-a', 'value-a'),
      setPrivateItem('layerwell.concurrent-b', 'value-b'),
    ]);

    await expect(getPrivateItems(['layerwell.concurrent-a', 'layerwell.concurrent-b'])).resolves.toEqual(
      new Map([
        ['layerwell.concurrent-a', 'value-a'],
        ['layerwell.concurrent-b', 'value-b'],
      ]),
    );
  });

  it('serializes concurrent writes to the same private key', async () => {
    let releaseFirstWrite!: () => void;
    let markFirstWriteStarted!: () => void;
    let writeStarts = 0;
    mocks.setItemGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });
    mocks.setItemStarted = () => {
      writeStarts += 1;
      if (writeStarts === 1) markFirstWriteStarted();
    };

    const first = setPrivateItem('layerwell.serialized', 'first');
    await firstWriteStarted;
    const second = setPrivateItem('layerwell.serialized', 'second');
    await Promise.resolve();
    expect(writeStarts).toBe(1);

    releaseFirstWrite();
    await first;
    await second;

    expect(writeStarts).toBe(2);
    await expect(getPrivateItem('layerwell.serialized')).resolves.toBe('second');
  });

  it('preserves a concurrent replacement detected before the final write', async () => {
    await setPrivateItem('layerwell.race', 'original');
    const replacement = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      keyId: 'unexpected-authority',
      nonceHex: '00'.repeat(24),
      ciphertextHex: '00'.repeat(16),
    });
    let releaseSecureRead!: () => void;
    let markSecureReadStarted!: () => void;
    mocks.secureGetGate = new Promise<void>((resolve) => {
      releaseSecureRead = resolve;
    });
    const secureReadStarted = new Promise<void>((resolve) => {
      markSecureReadStarted = resolve;
    });
    mocks.secureGetStarted = markSecureReadStarted;

    const write = setPrivateItem('layerwell.race', 'updated');
    await secureReadStarted;
    mocks.asyncStorage.set('layerwell.race', replacement);
    releaseSecureRead();

    await expect(write).rejects.toThrow(PRIVATE_KV_WRITE_CONFLICT);
    expect(mocks.asyncStorage.get('layerwell.race')).toBe(replacement);
  });

  it('blocks private writes while an account boundary is active', async () => {
    beginPrivateKVAccountBoundary();

    await expect(setPrivateItem('layerwell.account-b', 'value-b')).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    expect(mocks.asyncStorage.has('layerwell.account-b')).toBe(false);
  });

  it('rejects a write that had not reached storage before the boundary began', async () => {
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    mocks.getItemGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.getItemStarted = markReadStarted;

    const write = setPrivateItem('layerwell.account-a', 'late-value');
    await readStarted;
    beginPrivateKVAccountBoundary();
    releaseRead();

    await expect(write).rejects.toThrow(PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
    expect(mocks.asyncStorage.has('layerwell.account-a')).toBe(false);
  });

  it('restores a guarded removal that commits across a private account boundary', async () => {
    const key = 'layerwell.account-a';
    await setPrivateItem(key, 'prior-account-value');
    const priorRaw = mocks.asyncStorage.get(key);
    let releaseRemoval!: () => void;
    let markRemovalStarted!: () => void;
    mocks.removeItemGate = new Promise<void>((resolve) => {
      releaseRemoval = resolve;
    });
    mocks.removeItemGateKey = key;
    mocks.removeItemStartedKey = key;
    const removalStarted = new Promise<void>((resolve) => {
      markRemovalStarted = resolve;
    });
    mocks.removeItemStarted = markRemovalStarted;

    const removal = updatePrivateItem(key, () => null);
    await removalStarted;
    beginPrivateKVAccountBoundary();
    releaseRemoval();
    try {
      await expect(removal).rejects.toThrow(PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
      expect(mocks.asyncStorage.get(key)).toBe(priorRaw);
    } finally {
      endPrivateKVAccountBoundary();
    }
    await expect(getPrivateItem(key)).resolves.toBe('prior-account-value');
  });

  it('waits for a storage write already in progress before account cleanup continues', async () => {
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    mocks.setItemGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    mocks.setItemStarted = markWriteStarted;

    const write = setPrivateItem('layerwell.account-a', 'committed-before-clear');
    await writeStarted;
    beginPrivateKVAccountBoundary();
    let drainFinished = false;
    const drain = waitForPrivateKVWritesToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    releaseWrite();
    await write;
    await drain;
    expect(drainFinished).toBe(true);
    expect(mocks.asyncStorage.has('layerwell.account-a')).toBe(true);
  });

  it('tracks a queued same-key mutation until the account boundary rejects it', async () => {
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    mocks.setItemGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    mocks.setItemStarted = markWriteStarted;

    const first = setPrivateItem('layerwell.account-a', 'first');
    await writeStarted;
    const queued = setPrivateItem('layerwell.account-a', 'second');
    beginPrivateKVAccountBoundary();
    const queuedRejection = expect(queued).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    let drainFinished = false;
    const drain = waitForPrivateKVWritesToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    releaseWrite();
    await first;
    await queuedRejection;
    await drain;
    expect(drainFinished).toBe(true);
    endPrivateKVAccountBoundary();
    await expect(getPrivateItem('layerwell.account-a')).resolves.toBe('first');
  });

  it('blocks new removals and drains a removal already in progress', async () => {
    mocks.asyncStorage.set('layerwell.account-a', 'account-a-value');
    let releaseRemoval!: () => void;
    let markRemovalStarted!: () => void;
    mocks.removeItemGate = new Promise<void>((resolve) => {
      releaseRemoval = resolve;
    });
    const removalStarted = new Promise<void>((resolve) => {
      markRemovalStarted = resolve;
    });
    mocks.removeItemStarted = markRemovalStarted;

    const removal = removePrivateItem('layerwell.account-a');
    await removalStarted;
    beginPrivateKVAccountBoundary();
    await expect(multiRemovePrivateItems(['layerwell.account-b'])).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    let drainFinished = false;
    const drain = waitForPrivateKVWritesToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    releaseRemoval();
    await removal;
    await drain;
    expect(drainFinished).toBe(true);
    expect(mocks.asyncStorage.has('layerwell.account-a')).toBe(false);
  });

  it('preserves keyless ciphertext and refuses replacement key material', async () => {
    await setPrivateItem('custom.encrypted-a', 'value-a');
    mocks.secureStorage.clear();

    await expect(getPrivateItems(['custom.encrypted-a'])).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_MISSING,
    );
    await expect(setPrivateItem('layerwell.new-record', 'new-value')).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_MISSING,
    );

    expect(mocks.secureStorage.size).toBe(0);
    expect(mocks.asyncStorage.has('custom.encrypted-a')).toBe(true);
    expect(mocks.asyncStorage.has('layerwell.new-record')).toBe(false);
  });

  it('preserves ciphertext and rejects a malformed existing content key', async () => {
    await setPrivateItem('layerwell.encrypted-a', 'value-a');
    mocks.secureStorage.set(privateKVEncryptionInfo.secureStoreKey, 'malformed-key');

    await expect(getPrivateItem('layerwell.encrypted-a')).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_INVALID,
    );

    expect(mocks.secureStorage.get(privateKVEncryptionInfo.secureStoreKey)).toBe('malformed-key');
    expect(mocks.asyncStorage.has('layerwell.encrypted-a')).toBe(true);
  });

  it('preserves ciphertext when a different valid content key cannot authenticate it', async () => {
    await setPrivateItem('layerwell.encrypted-a', 'value-a');
    const originalCiphertext = mocks.asyncStorage.get('layerwell.encrypted-a');
    mocks.secureStorage.set(privateKVEncryptionInfo.secureStoreKey, 'a'.repeat(64));

    await expect(setPrivateItem('layerwell.encrypted-a', 'replacement')).rejects.toThrow(
      PRIVATE_KV_DECRYPTION_FAILED,
    );
    await expect(getPrivateItem('layerwell.encrypted-a')).rejects.toThrow(
      PRIVATE_KV_DECRYPTION_FAILED,
    );

    expect(mocks.asyncStorage.get('layerwell.encrypted-a')).toBe(originalCiphertext);
  });

  it('blocks a fallback rewrite until the failed encrypted read succeeds', async () => {
    await setPrivateItem('layerwell.profile', 'original-value');
    const originalCiphertext = mocks.asyncStorage.get('layerwell.profile');
    mocks.secureGetThrows = true;

    await expect(getPrivateItem('layerwell.profile')).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
    );
    mocks.secureGetThrows = false;

    await expect(setPrivateItem('layerwell.profile', 'fallback-value')).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE,
    );
    expect(mocks.asyncStorage.get('layerwell.profile')).toBe(originalCiphertext);

    await expect(getPrivateItem('layerwell.profile')).resolves.toBe('original-value');
    await expect(setPrivateItem('layerwell.profile', 'updated-value')).resolves.toBeUndefined();
    await expect(getPrivateItem('layerwell.profile')).resolves.toBe('updated-value');
  });

  it('serializes complete read-modify-write transforms for one private key', async () => {
    await setPrivateItem('layerwell.conflict.overrides', JSON.stringify({ first: true }));

    await Promise.all([
      updatePrivateItem('layerwell.conflict.overrides', (raw) =>
        JSON.stringify({ ...(JSON.parse(raw ?? '{}') as object), second: true }),
      ),
      updatePrivateItem('layerwell.conflict.overrides', (raw) =>
        JSON.stringify({ ...(JSON.parse(raw ?? '{}') as object), third: true }),
      ),
    ]);

    const stored = await getPrivateItem('layerwell.conflict.overrides');
    expect(JSON.parse(stored ?? '{}')).toEqual({ first: true, second: true, third: true });
  });
});
