import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPrivateBoolean, setPrivateBoolean } from './privateBoolean';

const mocks = vi.hoisted(() => ({
  getPrivateItem: vi.fn(),
  setPrivateItem: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  setPrivateItem: mocks.setPrivateItem,
}));

describe('private boolean storage', () => {
  beforeEach(() => {
    mocks.getPrivateItem.mockReset();
    mocks.setPrivateItem.mockReset();
    mocks.storage.clear();
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.setPrivateItem.mockImplementation(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    });
  });

  it('writes compact canonical flags', async () => {
    await setPrivateBoolean('flag-a', true);
    await setPrivateBoolean('flag-b', false);

    expect(mocks.storage.get('flag-a')).toBe('1');
    expect(mocks.storage.get('flag-b')).toBe('0');
  });

  it('accepts legacy true/false values and repairs them to canonical flags', async () => {
    mocks.storage.set('legacy-true', ' true ');
    mocks.storage.set('legacy-false', 'FALSE');

    await expect(getPrivateBoolean('legacy-true')).resolves.toBe(true);
    await expect(getPrivateBoolean('legacy-false')).resolves.toBe(false);

    expect(mocks.storage.get('legacy-true')).toBe('1');
    expect(mocks.storage.get('legacy-false')).toBe('0');
  });

  it('fails closed and repairs noncanonical values', async () => {
    mocks.storage.set('bad-flag', 'enabled');

    await expect(getPrivateBoolean('bad-flag')).resolves.toBe(false);

    expect(mocks.storage.get('bad-flag')).toBe('0');
  });

  it('keeps an already-granted canonical decision active if repair fails', async () => {
    mocks.storage.set('padded-grant', ' 1 ');
    mocks.setPrivateItem.mockRejectedValueOnce(new Error('repair unavailable'));

    await expect(getPrivateBoolean('padded-grant')).resolves.toBe(true);

    expect(mocks.storage.get('padded-grant')).toBe(' 1 ');
  });

  it('fails closed when encrypted storage cannot be read', async () => {
    mocks.getPrivateItem.mockRejectedValueOnce(new Error('private storage unavailable'));

    await expect(getPrivateBoolean('flag')).resolves.toBe(false);
  });
});
