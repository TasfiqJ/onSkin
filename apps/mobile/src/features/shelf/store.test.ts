import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addProduct, loadShelf } from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => 'shelf-product-id'),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
}));

const KEY = 'onskin.shelf.v1';

describe('shelf local store recovery', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('removes malformed persisted shelf JSON', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(loadShelf()).resolves.toEqual([]);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('removes wrong-shaped persisted shelf state', async () => {
    mocks.storage.set(KEY, JSON.stringify({ id: 'not-an-array' }));

    await expect(loadShelf()).resolves.toEqual([]);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('keeps valid legacy shelf rows and drops malformed rows', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
        {
          id: 'retinol',
          name: 'Retinol Serum',
          addedVia: 'manual',
          ingredients: ['retinol', '', false],
          paoMonths: -1,
          status: 'unknown',
        },
        { id: '', name: 'No id', addedVia: 'manual' },
        'bad-row',
      ]),
    );

    const shelf = await loadShelf();

    expect(shelf).toHaveLength(1);
    expect(shelf[0]).toMatchObject({
      id: 'retinol',
      name: 'Retinol Serum',
      catalogSource: 'user_local',
      catalogMatchQuality: 'manual',
      ingredients: ['retinol'],
      isOpened: true,
      paoMonths: null,
      paoSource: 'unknown',
      expirySource: 'unknown',
      status: 'active',
      repurchaseCount: 1,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toHaveLength(1);
  });

  it('writes a clean shelf after malformed state', async () => {
    mocks.storage.set(KEY, JSON.stringify({ stale: true }));

    await addProduct({
      name: 'Mineral SPF 50',
      category: 'spf',
      addedVia: 'manual',
    });

    const shelf = JSON.parse(mocks.storage.get(KEY) ?? '[]') as { name: string }[];
    expect(shelf).toHaveLength(1);
    expect(shelf[0]?.name).toBe('Mineral SPF 50');
  });
});
