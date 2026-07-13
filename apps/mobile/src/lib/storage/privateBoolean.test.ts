import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrivateKVReadResult } from './privateKV';
import {
  getPrivateBoolean,
  getPrivateBooleanFailClosed,
  PRIVATE_BOOLEAN_INVALID,
  PRIVATE_BOOLEAN_UNAVAILABLE,
  PRIVATE_BOOLEAN_UNSUPPORTED_VERSION,
  PrivateBooleanReadError,
  readPrivateBoolean,
  requirePrivateBoolean,
  setPrivateBoolean,
} from './privateBoolean';

const mocks = vi.hoisted(() => ({
  getPrivateItem: vi.fn(),
  readPrivateItem: vi.fn(),
  updatePrivateItem: vi.fn(),
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  typedResults: new Map<string, PrivateKVReadResult>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  readPrivateItem: mocks.readPrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

describe('private boolean storage', () => {
  beforeEach(() => {
    mocks.getPrivateItem.mockReset();
    mocks.readPrivateItem.mockReset();
    mocks.updatePrivateItem.mockReset();
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.typedResults.clear();
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.readPrivateItem.mockImplementation(async (key: string) => {
      const result = mocks.typedResults.get(key);
      if (result) return result;
      const value = mocks.storage.get(key);
      return value === undefined ? { status: 'absent' } : { status: 'available', value };
    });
    mocks.updatePrivateItem.mockImplementation(
      async (key: string, updater: (current: string | null) => string | null) => {
        const previous = mocks.tails.get(key) ?? Promise.resolve();
        let release!: () => void;
        const ownTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        mocks.tails.set(key, ownTail);
        await previous;
        try {
          const next = updater(mocks.storage.get(key) ?? null);
          if (next === null) mocks.storage.delete(key);
          else mocks.storage.set(key, next);
        } finally {
          release();
          if (mocks.tails.get(key) === ownTail) mocks.tails.delete(key);
        }
      },
    );
  });

  it('serializes same-key writes through the private-KV atomic mutation primitive', async () => {
    await Promise.all([setPrivateBoolean('flag', true), setPrivateBoolean('flag', false)]);

    expect(mocks.storage.get('flag')).toBe('v1:0');
    expect(mocks.updatePrivateItem).toHaveBeenNthCalledWith(1, 'flag', expect.any(Function));
    expect(mocks.updatePrivateItem).toHaveBeenNthCalledWith(2, 'flag', expect.any(Function));
    expect(mocks.getPrivateItem).not.toHaveBeenCalled();
    expect(mocks.readPrivateItem).not.toHaveBeenCalled();
  });

  it('canonically upgrades valid legacy state only during an explicit write', async () => {
    mocks.storage.set('legacy', ' TRUE ');

    await setPrivateBoolean('legacy', true);

    expect(mocks.storage.get('legacy')).toBe('v1:1');
  });

  it.each(['', 'enabled', 'v1:true', 'v2:1'])(
    'preserves corrupt or future value %j during a write',
    async (raw) => {
      mocks.storage.set('protected', raw);

      await expect(setPrivateBoolean('protected', false)).rejects.toBeInstanceOf(
        PrivateBooleanReadError,
      );

      expect(mocks.storage.get('protected')).toBe(raw);
    },
  );

  it.each([
    ['v1:1', true],
    ['v1:0', false],
  ] as const)('classifies canonical %s as a current value', async (raw, value) => {
    mocks.storage.set('flag', raw);

    await expect(readPrivateBoolean('flag')).resolves.toEqual({
      status: 'available',
      value,
      format: 'current',
    });

    expect(mocks.storage.get('flag')).toBe(raw);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it.each([
    [' true ', true],
    ['FALSE', false],
    [' 1 ', true],
    [' 0 ', false],
  ] as const)('classifies legacy %j without repairing bytes', async (raw, value) => {
    mocks.storage.set('legacy', raw);

    await expect(readPrivateBoolean('legacy')).resolves.toEqual({
      status: 'available',
      value,
      format: 'legacy',
    });

    expect(mocks.storage.get('legacy')).toBe(raw);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('keeps absence distinct from an available empty value', async () => {
    mocks.storage.set('empty', '');

    await expect(readPrivateBoolean('absent')).resolves.toEqual({ status: 'absent' });
    await expect(readPrivateBoolean('empty')).resolves.toEqual({
      status: 'corrupt',
      reason: 'invalid_value',
    });

    expect(mocks.storage.get('empty')).toBe('');
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it.each(['enabled', ' ', 'v1:true', 'v0:1', 'V1:1'])(
    'classifies noncanonical value %j as corrupt without changing it',
    async (raw) => {
      mocks.storage.set('bad-flag', raw);

      await expect(readPrivateBoolean('bad-flag')).resolves.toEqual({
        status: 'corrupt',
        reason: 'invalid_value',
      });

      expect(mocks.storage.get('bad-flag')).toBe(raw);
      expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    },
  );

  it.each(['v2:1', 'v999999999999999999999999:0'])(
    'classifies future application schema %s without changing it',
    async (raw) => {
      mocks.storage.set('future-flag', raw);

      await expect(readPrivateBoolean('future-flag')).resolves.toEqual({
        status: 'unsupported_version',
      });

      expect(mocks.storage.get('future-flag')).toBe(raw);
      expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      { status: 'unavailable', reason: 'content_key_storage_unavailable' },
      { status: 'unavailable', reason: 'content_key_storage_unavailable' },
    ],
    [
      { status: 'corrupt', reason: 'decryption_failed' },
      { status: 'corrupt', reason: 'decryption_failed' },
    ],
    [{ status: 'unsupported_version' }, { status: 'unsupported_version' }],
  ] as const)('preserves the typed private-KV failure %j', async (source, expected) => {
    mocks.typedResults.set('flag', source);

    await expect(readPrivateBoolean('flag')).resolves.toEqual(expected);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('treats only genuine absence as the strict default-off state', () => {
    expect(requirePrivateBoolean({ status: 'absent' })).toBe(false);
    expect(
      requirePrivateBoolean({ status: 'available', value: true, format: 'legacy' }),
    ).toBe(true);
    expect(
      requirePrivateBoolean({ status: 'available', value: false, format: 'current' }),
    ).toBe(false);
  });

  it.each([
    [{ status: 'corrupt', reason: 'invalid_value' }, PRIVATE_BOOLEAN_INVALID],
    [{ status: 'unsupported_version' }, PRIVATE_BOOLEAN_UNSUPPORTED_VERSION],
    [
      { status: 'unavailable', reason: 'storage_unavailable' },
      PRIVATE_BOOLEAN_UNAVAILABLE,
    ],
  ] as const)('throws a typed strict-read error for %j', (result, code) => {
    try {
      requirePrivateBoolean(result);
      throw new Error('expected requirePrivateBoolean to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PrivateBooleanReadError);
      expect(error).toMatchObject({ message: code, result });
    }
  });

  it('offers an explicitly fail-closed convenience without rewriting failed state', async () => {
    const corrupt = { status: 'corrupt', reason: 'envelope_invalid' } as const;
    mocks.typedResults.set('flag', corrupt);

    await expect(getPrivateBooleanFailClosed('flag')).resolves.toBe(false);

    expect(mocks.typedResults.get('flag')).toEqual(corrupt);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('keeps the legacy photo fallback fail closed and side-effect free', async () => {
    mocks.storage.set('photo-legacy', ' 1 ');
    mocks.storage.set('photo-future', 'v2:1');

    await expect(getPrivateBoolean('photo-legacy')).resolves.toBe(true);
    await expect(getPrivateBoolean('photo-future')).resolves.toBe(false);

    expect(mocks.storage.get('photo-legacy')).toBe(' 1 ');
    expect(mocks.storage.get('photo-future')).toBe('v2:1');
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });
});
