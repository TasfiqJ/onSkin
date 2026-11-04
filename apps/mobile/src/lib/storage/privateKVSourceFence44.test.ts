// Register synthetic platform ports before importing the native storage module.
import { close26, grant26, ports26, reset26 } from '@/features/shelf/firstValue26TestPorts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Synthetic native platform ports only. Encryption, queues and authority are real.
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { clearActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import {
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  getPrivateItem,
  multiRemovePrivateItems,
  PRIVATE_KV_SOURCE_TRANSFORM_INVALID,
  PRIVATE_KV_SOURCE_UNAUTHENTICATED,
  PRIVATE_KV_WRITE_CONFLICT,
  PRIVATE_KV_WRITE_ROLLBACK_FAILED,
  setPrivateItem,
  updatePrivateItem,
  updatePrivateItemWithSources,
  waitForPrivateKVWritesToSettle,
} from './privateKV';

const SHELF = 'layerwell.shelf.v1';
const PROFILE = 'layerwell.skinprofile.v1';
const ORDER = 'layerwell.routineOrder.v1';
const SOURCES = [SHELF, PROFILE] as const;
let client: QueryClient;
let releases: (() => void)[];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function fence(next = 'order1', source = 'shelf0') {
  const lease = captureHealthDataWriteLease();
  return updatePrivateItemWithSources(ORDER, SOURCES, (values) => {
    if (values.get(SHELF) !== source || values.get(PROFILE) !== 'profile0') {
      throw new Error('STALE_SOURCE');
    }
    return next;
  }, () => assertHealthDataWriteLease(lease));
}

function holdRead(key: string, occurrence = 1) {
  const native = AsyncStorage.getItem.bind(AsyncStorage);
  const entered = deferred();
  const gate = deferred();
  releases.push(gate.resolve);
  let count = 0;
  vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (candidate) => {
    const raw = await native(candidate);
    if (candidate === key && ++count === occurrence) {
      entered.resolve();
      await gate.promise;
    }
    return raw;
  });
  return { entered: entered.promise, release: gate.resolve };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  releases = [];
  client = await reset26();
  await setPrivateItem(SHELF, 'shelf0');
  await setPrivateItem(PROFILE, 'profile0');
  await setPrivateItem(ORDER, 'order0');
});

afterEach(async () => {
  releases.forEach((release) => release());
  await waitForPrivateKVWritesToSettle();
  vi.restoreAllMocks();
  ports26.failRead = null;
  ports26.failWrite = null;
  ports26.holdRead = null;
  // A deliberately failed compensation now leaves a durable recovery intent.
  // Teardown uses the real explicit deletion lane before the next fixture.
  await multiRemovePrivateItems([ORDER, ...SOURCES]);
  await close26(client);
});

describe('Campaign44 real encrypted opt-in source reservation', () => {
  it('commits authenticated source values and exact encrypted destination readback', async () => {
    await fence();
    expect(await getPrivateItem(ORDER)).toBe('order1');
    expect(ports26.bytes.get(ORDER)).toContain('xchacha20poly1305:v1');
    expect(ports26.bytes.get(ORDER)).not.toContain('order1');
    expect(ports26.track).not.toHaveBeenCalled();
  });

  it('supports a read-only snapshot without changing any encrypted bytes', async () => {
    const before = new Map(ports26.bytes);
    const set = vi.spyOn(AsyncStorage, 'setItem');
    const lease = captureHealthDataWriteLease();
    await updatePrivateItemWithSources(ORDER, SOURCES, (values) => values.get(ORDER)!,
      () => assertHealthDataWriteLease(lease), async (values) => {
        expect(values.get(SHELF)).toBe(await getPrivateItem(SHELF));
        expect(values.get(PROFILE)).toBe(await getPrivateItem(PROFILE));
      });
    expect(set).not.toHaveBeenCalled();
    expect(ports26.bytes).toEqual(before);
  });

  it('detects a source mutation completed before acquisition before destination invocation', async () => {
    const before = ports26.bytes.get(ORDER);
    await setPrivateItem(SHELF, 'shelf1');
    const set = vi.spyOn(AsyncStorage, 'setItem');
    await expect(fence()).rejects.toThrow('STALE_SOURCE');
    expect(set).not.toHaveBeenCalled();
    expect(ports26.bytes.get(ORDER)).toBe(before);
  });

  it('drains a preexisting source mutation before validating the stale capture', async () => {
    const gate = holdRead(SHELF);
    const mutation = setPrivateItem(SHELF, 'shelf1');
    await gate.entered;
    const result = fence().catch((error: Error) => error);
    gate.release();
    await mutation;
    expect(await result).toEqual(new Error('STALE_SOURCE'));
    expect(await getPrivateItem(ORDER)).toBe('order0');
  });

  it('keeps a source mutation queued behind a native conflict read until commit', async () => {
    const gate = holdRead(ORDER, 2);
    const events: string[] = [];
    const writing = fence().then(() => { events.push('snapshot'); });
    await gate.entered;
    const mutation = setPrivateItem(SHELF, 'shelf1').then(() => { events.push('source'); });
    expect(await getPrivateItem(SHELF)).toBe('shelf0');
    gate.release();
    await Promise.all([writing, mutation]);
    expect(events).toEqual(['snapshot', 'source']);
    expect(await getPrivateItem(ORDER)).toBe('order1');
  });

  it('holds all source locks through async domain preparation and final readback', async () => {
    const entered = deferred();
    const gate = deferred();
    releases.push(gate.resolve);
    const lease = captureHealthDataWriteLease();
    const operation = updatePrivateItemWithSources(ORDER, SOURCES, () => 'order1',
      () => assertHealthDataWriteLease(lease), async () => {
        entered.resolve();
        await gate.promise;
      });
    await entered.promise;
    const mutation = setPrivateItem(PROFILE, 'profile1');
    expect(await getPrivateItem(PROFILE)).toBe('profile0');
    gate.resolve();
    await Promise.all([operation, mutation]);
    expect(await getPrivateItem(ORDER)).toBe('order1');
    expect(await getPrivateItem(PROFILE)).toBe('profile1');
  });

  it('sorts reversed overlapping lock sets and deduplicates the destination key', async () => {
    const lease = captureHealthDataWriteLease();
    await Promise.all(Array.from({ length: 8 }, (_, index) =>
      updatePrivateItemWithSources(ORDER,
        index % 2 ? [PROFILE, ORDER, SHELF] : [SHELF, PROFILE, ORDER, SHELF],
        (values) => `${values.get(ORDER)!}+`, () => assertHealthDataWriteLease(lease))));
    expect(await getPrivateItem(ORDER)).toBe('order0++++++++');
  });

  it('retains source reservations until actual final native readback completes', async () => {
    const gate = holdRead(ORDER, 3);
    const events: string[] = [];
    const writing = fence().then(() => { events.push('snapshot'); });
    await gate.entered;
    const mutation = setPrivateItem(PROFILE, 'profile1').then(() => { events.push('source'); });
    await expect(getPrivateItem(PROFILE)).rejects.toThrow('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');
    expect(events).toEqual([]);
    gate.release();
    await Promise.all([writing, mutation]);
    expect(events).toEqual(['snapshot', 'source']);
    expect(await getPrivateItem(ORDER)).toBe('order1');
    expect(await getPrivateItem(PROFILE)).toBe('profile1');
  });

  it('refuses a deletion completed before validation and leaves destination exact', async () => {
    const before = ports26.bytes.get(ORDER);
    await multiRemovePrivateItems([SHELF, PROFILE]);
    await expect(fence()).rejects.toThrow('STALE_SOURCE');
    expect(ports26.bytes.get(ORDER)).toBe(before);
  });

  it('detects an uncoordinated native source change during asynchronous preparation', async () => {
    const before = ports26.bytes.get(ORDER);
    const lease = captureHealthDataWriteLease();
    await expect(updatePrivateItemWithSources(ORDER, SOURCES, () => 'order1',
      () => assertHealthDataWriteLease(lease), async () => {
        // Hostile native adapter; ordinary source stores cannot enter here.
        ports26.bytes.delete(SHELF);
      })).rejects.toThrow(PRIVATE_KV_WRITE_CONFLICT);
    expect(ports26.bytes.get(ORDER)).toBe(before);
  });

  it('rejects an asynchronous/reentrant destination transform instead of awaiting its own slot', async () => {
    const lease = captureHealthDataWriteLease();
    let queued: Promise<void> | undefined;
    const before = ports26.bytes.get(ORDER);
    const asyncTransform = () => {
      queued = updatePrivateItem(ORDER, (raw) => raw);
      return queued;
    };
    await expect(updatePrivateItemWithSources(ORDER, SOURCES,
      asyncTransform as unknown as () => string,
      () => assertHealthDataWriteLease(lease))).rejects.toThrow(PRIVATE_KV_SOURCE_TRANSFORM_INVALID);
    await queued;
    expect(ports26.bytes.get(ORDER)).toBe(before);
    await fence();
  });

  it.each(['legacy', 'malformed', 'future', 'authentication'])('refuses %s source without destination write', async (kind) => {
    const before = ports26.bytes.get(ORDER);
    const raw = JSON.parse(ports26.bytes.get(SHELF)!);
    if (kind === 'legacy') ports26.bytes.set(SHELF, 'plaintext');
    if (kind === 'malformed') ports26.bytes.set(SHELF, '{"version":"xchacha20poly1305:v1"}');
    if (kind === 'future') ports26.bytes.set(SHELF, JSON.stringify({ ...raw, version: 'xchacha20poly1305:v99' }));
    if (kind === 'authentication') ports26.bytes.set(SHELF, JSON.stringify({ ...raw, ciphertextHex: '00'.repeat(16) }));
    const set = vi.spyOn(AsyncStorage, 'setItem');
    await expect(fence()).rejects.toThrow(kind === 'legacy' ? PRIVATE_KV_SOURCE_UNAUTHENTICATED : undefined);
    expect(set).not.toHaveBeenCalled();
    expect(ports26.bytes.get(ORDER)).toBe(before);
  });

  it('does not convert source read refusal to an empty successful snapshot', async () => {
    ports26.failRead = SHELF;
    const before = ports26.bytes.get(ORDER);
    await expect(fence()).rejects.toThrow('SYNTHETIC_PLATFORM_READ_REFUSED');
    expect(ports26.bytes.get(ORDER)).toBe(before);
  });

  it.each(['reject-before', 'commit-then-reject', 'omit'])('refuses native %s and preserves exact prior ciphertext', async (outcome) => {
    const before = ports26.bytes.get(ORDER);
    const native = AsyncStorage.setItem.bind(AsyncStorage);
    let first = true;
    vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      if (key === ORDER && first) {
        first = false;
        if (outcome === 'reject-before') throw new Error('NATIVE_REFUSAL');
        if (outcome === 'omit') return;
        await native(key, raw);
        throw new Error('NATIVE_AMBIGUOUS');
      }
      await native(key, raw);
    });
    await expect(fence()).rejects.toThrow(outcome === 'omit' ? PRIVATE_KV_WRITE_CONFLICT : /NATIVE_/);
    expect(ports26.bytes.get(ORDER)).toBe(before);
  });

  it('preserves foreign readback divergence and reports explicit rollback failure', async () => {
    vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      ports26.bytes.set(key, key === ORDER ? 'FOREIGN_NATIVE_BYTES' : raw);
    });
    await expect(fence()).rejects.toThrow(PRIVATE_KV_WRITE_ROLLBACK_FAILED);
    expect(ports26.bytes.get(ORDER)).toBe('FOREIGN_NATIVE_BYTES');
  });

  it('waits through stale-authority rollback before allowing a queued deletion', async () => {
    const native = AsyncStorage.setItem.bind(AsyncStorage);
    const committed = deferred();
    const gate = deferred();
    releases.push(gate.resolve);
    let first = true;
    vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      await native(key, raw);
      if (key === ORDER && first) {
        first = false;
        committed.resolve();
        await gate.promise;
      }
    });
    const result = fence().catch((error: Error) => error);
    await committed.promise;
    clearActiveHealthProcessingEpoch();
    const deletion = multiRemovePrivateItems([ORDER, SHELF, PROFILE]);
    gate.resolve();
    expect(await result).toBeInstanceOf(Error);
    await deletion;
    expect(ports26.bytes.has(ORDER)).toBe(false);
  });

  it('rejects the same owner regrant rather than borrowing the fresh lease', async () => {
    const gate = holdRead(ORDER, 2);
    const before = ports26.bytes.get(ORDER);
    const result = fence().catch((error: Error) => error);
    await gate.entered;
    await grant26();
    gate.release();
    expect(await result).toBeInstanceOf(Error);
    expect(ports26.bytes.get(ORDER)).toBe(before);
  });

  it('reports rollback refusal honestly and deletion then removes the remaining ciphertext', async () => {
    const before = ports26.bytes.get(ORDER)!;
    const native = AsyncStorage.setItem.bind(AsyncStorage);
    vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      if (key === ORDER && raw === before) throw new Error('NATIVE_ROLLBACK_REFUSED');
      await native(key, raw);
      if (key === ORDER) clearActiveHealthProcessingEpoch();
    });
    await expect(fence()).rejects.toThrow(PRIVATE_KV_WRITE_ROLLBACK_FAILED);
    expect(ports26.bytes.get(ORDER)).not.toBe(before);
    await multiRemovePrivateItems([ORDER, ...SOURCES]);
    expect(ports26.bytes.has(ORDER)).toBe(false);
  });

  it('invalidates a queued fence when account/private reset closes and drains', async () => {
    const gate = holdRead(SHELF);
    const mutation = setPrivateItem(SHELF, 'shelf1').catch((error: Error) => error);
    await gate.entered;
    const result = fence().catch((error: Error) => error);
    beginPrivateKVAccountBoundary();
    try {
      gate.release();
      await waitForPrivateKVWritesToSettle();
      expect(await result).toBeInstanceOf(Error);
      expect(await mutation).toBeInstanceOf(Error);
      await AsyncStorage.multiRemove([ORDER, SHELF, PROFILE]);
    } finally {
      endPrivateKVAccountBoundary();
    }
    expect(ports26.bytes.has(ORDER)).toBe(false);
  });
});
