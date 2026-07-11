import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addProduct, loadShelf, reAddProduct, updateProduct } from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  nextId: 0,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `shelf-product-${++mocks.nextId}`),
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
    mocks.nextId = 0;
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
      isOpened: false,
      openedAt: null,
      paoMonths: null,
      paoSource: 'unknown',
      expirySource: 'estimated',
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
    expect(shelf[0]).toMatchObject({ isOpened: false, openedAt: null, expirySource: 'estimated' });
  });

  it('normalizes direct updates before persistence', async () => {
    const product = await addProduct({
      name: 'Vitamin C Serum',
      category: 'serum',
      addedVia: 'manual',
      openedAt: '2026-07-01',
      paoMonths: 6,
    });

    const malformedPatch = {
      status: 'unknown',
      finishedAt: '2026-07-02',
      paoMonths: -3,
      openedAt: 'not-a-date',
      ingredients: [' ascorbic acid ', '', 'water'],
    } as unknown as Parameters<typeof updateProduct>[1];

    await updateProduct(product.id, malformedPatch);

    const raw = JSON.parse(mocks.storage.get(KEY) ?? '[]') as {
      status: string;
      finishedAt: string | null;
      paoMonths: number | null;
      openedAt: string | null;
      ingredients: string[];
    }[];

    expect(raw[0]).toMatchObject({
      status: 'active',
      finishedAt: null,
      paoMonths: null,
      openedAt: null,
      ingredients: ['ascorbic acid', 'water'],
    });
  });

  it('clears opened date when a direct update marks a product unopened', async () => {
    const product = await addProduct({
      name: 'Ceramide Cream',
      category: 'moisturiser',
      addedVia: 'manual',
      openedAt: '2026-07-01',
      isOpened: true,
      paoMonths: 12,
    });

    await updateProduct(product.id, {
      isOpened: false,
      openedAt: '2026-07-01',
    });

    const shelf = await loadShelf();

    expect(shelf[0]).toMatchObject({
      name: 'Ceramide Cream',
      isOpened: false,
      openedAt: null,
      paoMonths: 12,
      expirySource: 'estimated',
    });
  });

  it('recomputes winning expiry provenance after direct freshness edits', async () => {
    const product = await addProduct({
      name: 'Vitamin C Serum',
      category: 'serum',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-01-31',
      paoMonths: 3,
      paoSource: 'catalog',
      expiryDate: '2026-06-01',
      expirySource: 'printed',
    });

    expect(product.expirySource).toBe('pao_computed');

    await updateProduct(product.id, { paoMonths: 12, paoSource: 'label' });

    expect((await loadShelf())[0]).toMatchObject({
      paoMonths: 12,
      paoSource: 'label',
      expiryDate: '2026-06-01',
      expirySource: 'printed',
    });
  });

  it('archives replacement history while clearing the old package printed expiry', async () => {
    const previous = await addProduct({
      name: 'Mineral SPF 50',
      brand: 'Test Brand',
      category: 'spf',
      catalogProductId: 'catalog-product-id',
      addedVia: 'search',
      isOpened: true,
      openedAt: '2026-01-01',
      paoMonths: 12,
      paoSource: 'catalog',
      expiryDate: '2026-07-01',
      expirySource: 'printed',
    });

    const fresh = await reAddProduct(previous.id);
    const shelf = await loadShelf();
    const archived = shelf.find((product) => product.id === previous.id);

    expect(fresh).toMatchObject({
      id: 'shelf-product-2',
      name: 'Mineral SPF 50',
      brand: 'Test Brand',
      catalogProductId: 'catalog-product-id',
      status: 'active',
      isOpened: true,
      paoMonths: 12,
      paoSource: 'catalog',
      expiryDate: null,
      expirySource: 'pao_computed',
      repurchaseCount: 2,
    });
    expect(fresh?.openedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(archived).toMatchObject({
      status: 'finished',
      openedAt: '2026-01-01',
      expiryDate: '2026-07-01',
      expirySource: 'printed',
      repurchaseCount: 1,
    });
  });

  it('does not rewrite a discarded unit as finished when it is re-added', async () => {
    const previous = await addProduct({
      name: 'Eye Cream',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-01-01',
    });
    await updateProduct(previous.id, { status: 'discarded', finishedAt: '2026-06-30' });

    await reAddProduct(previous.id);

    const archived = (await loadShelf()).find((product) => product.id === previous.id);
    expect(archived).toMatchObject({ status: 'discarded', finishedAt: '2026-06-30' });
  });

  it('preserves the current row when a direct update blanks product identity', async () => {
    const product = await addProduct({
      name: 'Mineral SPF 50',
      category: 'spf',
      addedVia: 'manual',
    });

    await updateProduct(product.id, { name: '' });

    const shelf = await loadShelf();

    expect(shelf).toHaveLength(1);
    expect(shelf[0]?.name).toBe('Mineral SPF 50');
  });
});
