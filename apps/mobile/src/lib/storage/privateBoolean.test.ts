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

    expect(mocks.storage.get('flag-a')).toBe('v1:1');
    expect(mocks.storage.get('flag-b')).toBe('v1:0');
  });

  it('accepts legacy true/false values without repairing bytes', async () => {
    mocks.storage.set('legacy-true', ' true ');
    mocks.storage.set('legacy-false', 'FALSE');

    await expect(getPrivateBoolean('legacy-true')).resolves.toBe(true);
    await expect(getPrivateBoolean('legacy-false')).resolves.toBe(false);

    expect(mocks.storage.get('legacy-true')).toBe(' true ');
    expect(mocks.storage.get('legacy-false')).toBe('FALSE');
  });

  it('fails closed and preserves noncanonical values', async () => {
    mocks.storage.set('bad-flag', 'enabled');

    await expect(getPrivateBoolean('bad-flag')).resolves.toBe(false);

    expect(mocks.storage.get('bad-flag')).toBe('enabled');
  });

  it('keeps a legacy granted decision active without issuing a write', async () => {
    mocks.storage.set('padded-grant', ' 1 ');

    await expect(getPrivateBoolean('padded-grant')).resolves.toBe(true);

    expect(mocks.storage.get('padded-grant')).toBe(' 1 ');
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('fails closed and preserves a future application schema', async () => {
    mocks.storage.set('future-flag', 'v2:1');

    await expect(getPrivateBoolean('future-flag')).resolves.toBe(false);

    expect(mocks.storage.get('future-flag')).toBe('v2:1');
  });

  it('fails closed when encrypted storage cannot be read', async () => {
    mocks.getPrivateItem.mockRejectedValueOnce(new Error('private storage unavailable'));

    await expect(getPrivateBoolean('flag')).resolves.toBe(false);
  });
});
