import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  AsyncStorage,
  beforeRaw28,
  cleanup28,
  CONTENT_KEY28,
  holdRead28,
  holdWrite28,
  KEY28,
  ports26,
  setup28,
  settle28,
  waitEntered28,
} from '@/features/shelf/destructiveCommit28TestPorts';
import { getPrivateItem, updatePrivateItem } from './privateKV';
import { clearActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';

const crypto28 = vi.hoisted(() => ({ failEncrypt: false }));
vi.mock('@noble/ciphers/chacha.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@noble/ciphers/chacha.js')>();
  return {
    ...actual,
    xchacha20poly1305: (key: Uint8Array, nonce: Uint8Array, aad?: Uint8Array) => {
      const cipher = actual.xchacha20poly1305(key, nonce, aad);
      if (!crypto28.failEncrypt) return cipher;
      return {
        ...cipher,
        encrypt: () => {
          throw new Error('SYNTHETIC_ENCRYPTION_REJECT_28');
        },
      };
    },
  };
});

beforeEach(setup28);
afterEach(async () => {
  crypto28.failEncrypt = false;
  await cleanup28();
});
function changed(raw: string | null) {
  const state = JSON.parse(raw!);
  state.products[0].name = 'Synthetic changed precommit probe';
  return JSON.stringify(state);
}

it('denies an already retired admission before private plaintext is transformed', async () => {
  const transform = vi.fn(changed);
  const writes = vi.spyOn(AsyncStorage, 'setItem');
  await expect(
    updatePrivateItem(KEY28, transform, undefined, () => {
      throw new Error('UI_RETIRED_28');
    }),
  ).rejects.toThrow('UI_RETIRED_28');
  expect(transform).not.toHaveBeenCalled();
  expect(writes).not.toHaveBeenCalled();
  expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
});

it.each(['private-read', 'conflict-read', 'content-key'])(
  'denies UI retirement during %s with exact encrypted bytes and no native write',
  async (stage) => {
    let current = true;
    const gate =
      stage === 'content-key'
        ? holdRead28(CONTENT_KEY28)
        : holdRead28(KEY28, stage === 'conflict-read' ? 2 : 1);
    const writes = vi.spyOn(AsyncStorage, 'setItem');
    const result = updatePrivateItem(KEY28, changed, undefined, () => {
      if (!current) throw new Error('UI_RETIRED_28');
    }).then(
      () => 'fulfilled',
      (error: Error) => error.message,
    );
    await waitEntered28(gate);
    current = false;
    gate.release();
    expect(await result).toBe('UI_RETIRED_28');
    expect(writes).not.toHaveBeenCalled();
    expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
  },
);

it('rechecks admission after encrypted-envelope serialization immediately before native invocation', async () => {
  let current = true;
  let encrypted = false;
  const original = JSON.stringify;
  vi.spyOn(JSON, 'stringify').mockImplementation((value, replacer, space) => {
    const raw = original(value, replacer as never, space);
    if (value && typeof value === 'object' && value.version === 'xchacha20poly1305:v1') {
      encrypted = true;
      current = false;
    }
    return raw;
  });
  const writes = vi.spyOn(AsyncStorage, 'setItem');
  await expect(
    updatePrivateItem(KEY28, changed, undefined, () => {
      if (!current) throw new Error('UI_RETIRED_28');
    }),
  ).rejects.toThrow('UI_RETIRED_28');
  expect(encrypted).toBe(true);
  expect(writes).not.toHaveBeenCalled();
  expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
});

it.each([false, true])(
  'does not compensate UI retirement after native invocation (bytes already visible=%s)',
  async (stored) => {
    let current = true;
    const gate = holdWrite28(stored);
    const result = updatePrivateItem(KEY28, changed, undefined, () => {
      if (!current) throw new Error('UI_RETIRED_28');
    }).then(
      () => 'fulfilled',
      (error: Error) => error.message,
    );
    await waitEntered28(gate);
    expect(ports26.bytes.get(KEY28) === beforeRaw28).toBe(!stored);
    current = false;
    gate.release();
    expect(await result).toBe('fulfilled');
    expect(JSON.parse((await getPrivateItem(KEY28))!).products[0].name).toBe(
      'Synthetic changed precommit probe',
    );
    expect(gate.spy.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(1);
  },
);

it('does not retroactively cancel an already fulfilled write', async () => {
  let current = true;
  const writes = vi.spyOn(AsyncStorage, 'setItem');
  await updatePrivateItem(KEY28, changed, undefined, () => {
    if (!current) throw new Error('UI_RETIRED_28');
  });
  const committed = ports26.bytes.get(KEY28);
  current = false;
  await settle28();
  expect(ports26.bytes.get(KEY28)).toBe(committed);
  expect(writes).toHaveBeenCalledTimes(1);
});

it('preserves the original post-native additional guard and exact compensation semantics', async () => {
  let current = true;
  const gate = holdWrite28(true);
  const result = updatePrivateItem(
    KEY28,
    changed,
    () => {
      if (!current) throw new Error('ORIGINAL_GUARD_RETIRED_28');
    },
    () => undefined,
  ).then(
    () => 'fulfilled',
    (error: Error) => error.message,
  );
  await waitEntered28(gate);
  current = false;
  gate.release();
  expect(await result).toBe('ORIGINAL_GUARD_RETIRED_28');
  expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
  expect(gate.spy.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(2);
});

it('preserves original health-authority compensation after native invocation', async () => {
  const gate = holdWrite28(true);
  const result = updatePrivateItem(KEY28, changed, undefined, () => undefined).then(
    () => 'fulfilled',
    (error: Error) => error.message,
  );
  await waitEntered28(gate);
  clearActiveHealthProcessingEpoch();
  gate.release();
  expect(await result).toMatch(/HEALTH_DATA_WRITE_ADMISSION_CLOSED/);
  expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
  expect(gate.spy.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(2);
});

it.each(['missing-key', 'invalid-key', 'tampered-ciphertext', 'partial-envelope', 'read-failure'])(
  'preserves %s without a native mutation',
  async (failure) => {
    if (failure === 'missing-key') ports26.bytes.delete(CONTENT_KEY28);
    if (failure === 'invalid-key') ports26.bytes.set(CONTENT_KEY28, 'invalid');
    if (failure === 'tampered-ciphertext') {
      const envelope = JSON.parse(beforeRaw28);
      envelope.ciphertextHex =
        (envelope.ciphertextHex[0] === '0' ? '1' : '0') + envelope.ciphertextHex.slice(1);
      ports26.bytes.set(KEY28, JSON.stringify(envelope));
    }
    if (failure === 'partial-envelope')
      ports26.bytes.set(KEY28, '{"version":"xchacha20poly1305:v1"}');
    if (failure === 'read-failure') ports26.failRead = KEY28;
    const before = ports26.bytes.get(KEY28);
    const writes = vi.spyOn(AsyncStorage, 'setItem');
    await expect(updatePrivateItem(KEY28, changed, undefined, () => undefined)).rejects.toThrow();
    expect(ports26.bytes.get(KEY28)).toBe(before);
    expect(writes).not.toHaveBeenCalled();
  },
);

it('never overwrites a conflicting raw value found by the serialized conflict reread', async () => {
  const original = AsyncStorage.getItem;
  const foreign = 'synthetic-external-writer-conflict';
  let count = 0;
  vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
    if (key === KEY28 && ++count === 2) ports26.bytes.set(key, foreign);
    return original(key);
  });
  const writes = vi.spyOn(AsyncStorage, 'setItem');
  await expect(updatePrivateItem(KEY28, changed, undefined, () => undefined)).rejects.toThrow(
    'PRIVATE_KV_WRITE_CONFLICT',
  );
  expect(writes).not.toHaveBeenCalled();
  expect(ports26.bytes.get(KEY28)).toBe(foreign);
});

it('preserves exact prior encrypted bytes when encryption preparation fails', async () => {
  crypto28.failEncrypt = true;
  const writes = vi.spyOn(AsyncStorage, 'setItem');
  await expect(updatePrivateItem(KEY28, changed, undefined, () => undefined)).rejects.toThrow(
    'SYNTHETIC_ENCRYPTION_REJECT_28',
  );
  expect(writes).not.toHaveBeenCalled();
  expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
});

it.each(['reject-before-store', 'store-then-reject', 'readback-uncertain'])(
  'keeps original ambiguous native failure behavior for %s',
  async (mode) => {
    const original = AsyncStorage.setItem;
    let first = true;
    vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      if (key !== KEY28 || !first) return original(key, raw);
      first = false;
      if (mode !== 'reject-before-store') await original(key, raw);
      if (mode === 'readback-uncertain') ports26.failRead = KEY28;
      throw new Error('SYNTHETIC_NATIVE_REJECT_28');
    });
    await expect(updatePrivateItem(KEY28, changed, undefined, () => undefined)).rejects.toThrow(
      mode === 'readback-uncertain'
        ? 'PRIVATE_KV_WRITE_ROLLBACK_FAILED'
        : 'SYNTHETIC_NATIVE_REJECT_28',
    );
    if (mode === 'readback-uncertain') expect(ports26.bytes.get(KEY28)).not.toBe(beforeRaw28);
    else expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
  },
);
