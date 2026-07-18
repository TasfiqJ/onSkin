import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  addProduct,
  applyCatalogRecoveryProductUpdate,
  clearShelf,
  loadShelf,
  reAddProduct,
  removeProduct,
  SHELF_STATE_INVALID,
  SHELF_STATE_UNSUPPORTED_VERSION,
  updateProduct,
  type CatalogRecoveryProductUpdate,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  nextId: 0,
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  updateGate: null as Promise<void> | null,
  updateStarted: null as (() => void) | null,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `shelf-product-${++mocks.nextId}`),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, tail);
      await previous;
      try {
        if (mocks.updateFailure) throw mocks.updateFailure;
        mocks.updateStarted?.();
        if (mocks.updateGate) await mocks.updateGate;
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'onskin.shelf.v1';

function storedProducts(): unknown[] {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    products?: unknown[];
  };
  return parsed.products ?? [];
}

function catalogRecoveryInput(
  id: string,
  expectedUpdatedAt: string,
  useCatalogIdentity = false,
): CatalogRecoveryProductUpdate {
  return {
    id,
    expectedUpdatedAt,
    useCatalogIdentity,
    catalogProductId: '00000000-0000-4000-8000-000000000044',
    catalogSourceId: '00000000-0000-4000-8000-000000000043',
    catalogSource: 'routinekind_reviewed',
    catalogSourceName: 'RoutineKind reviewed catalog',
    catalogSourceRef: 'catalog-row-44',
    catalogSourceUrl: 'https://example.invalid/catalog-row-44',
    catalogSourceSnapshotDate: '2026-07-17',
    catalogMatchQuality: 'usable',
    dataQualityScore: 91,
    sourceDisclosureAckAt: '2026-07-18T12:00:00.000Z',
    catalogName: 'Catalog Mineral SPF 50',
    catalogBrand: 'Catalog Brand',
    catalogCategory: 'sunscreen',
  };
}

describe('shelf local store recovery', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.nextId = 0;
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.updateGate = null;
    mocks.updateStarted = null;
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
  });

  it('preserves malformed persisted shelf JSON', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(loadShelf()).resolves.toEqual([]);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves wrong-shaped persisted shelf state', async () => {
    const original = JSON.stringify({ id: 'not-an-array' });
    mocks.storage.set(KEY, original);

    await expect(loadShelf()).resolves.toEqual([]);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('rejects a whole legacy shelf containing malformed rows without dropping bytes', async () => {
    const original = JSON.stringify([
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
    ]);
    mocks.storage.set(KEY, original);

    const shelf = await loadShelf();

    expect(shelf).toEqual([]);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('refuses to overwrite malformed shelf state during a write', async () => {
    const original = JSON.stringify({ stale: true });
    mocks.storage.set(KEY, original);

    await expect(
      addProduct({
        name: 'Mineral SPF 50',
        category: 'spf',
        addedVia: 'manual',
      }),
    ).rejects.toThrow(SHELF_STATE_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
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

    const raw = storedProducts() as {
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

  it('attaches revalidated catalog metadata without silently replacing user fields', async () => {
    const product = await addProduct({
      name: 'My handwritten sunscreen',
      brand: 'My brand spelling',
      category: 'spf',
      ingredients: ['zinc oxide', 'water'],
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-07-01',
      paoMonths: 6,
      paoSource: 'label',
      expiryDate: '2027-01-01',
      expirySource: 'printed',
    });

    const result = await applyCatalogRecoveryProductUpdate(
      catalogRecoveryInput(product.id, product.updatedAt),
    );

    expect(result).toMatchObject({ status: 'updated' });
    const updated = (await loadShelf())[0];
    expect(updated).toMatchObject({
      name: 'My handwritten sunscreen',
      brand: 'My brand spelling',
      category: 'spf',
      ingredients: ['zinc oxide', 'water'],
      isOpened: true,
      openedAt: '2026-07-01',
      paoMonths: 6,
      paoSource: 'label',
      expiryDate: '2027-01-01',
      expirySource: 'printed',
      catalogProductId: '00000000-0000-4000-8000-000000000044',
      catalogSourceId: '00000000-0000-4000-8000-000000000043',
      catalogSource: 'routinekind_reviewed',
    });
  });

  it('changes catalog identity only after the explicit identity choice', async () => {
    const product = await addProduct({
      name: 'My sunscreen',
      brand: 'My label',
      category: 'spf',
      ingredients: ['zinc oxide'],
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-07-01',
      paoMonths: 6,
      paoSource: 'label',
    });

    const result = await applyCatalogRecoveryProductUpdate(
      catalogRecoveryInput(product.id, product.updatedAt, true),
    );

    expect(result.status).toBe('updated');
    expect((await loadShelf())[0]).toMatchObject({
      name: 'Catalog Mineral SPF 50',
      brand: 'Catalog Brand',
      category: 'sunscreen',
      ingredients: ['zinc oxide'],
      openedAt: '2026-07-01',
      paoMonths: 6,
      paoSource: 'label',
    });
  });

  it('leaves the Shelf bytes unchanged when a recovery review is stale or missing', async () => {
    const product = await addProduct({ name: 'Current name', addedVia: 'manual' });
    const original = mocks.storage.get(KEY);

    await expect(
      applyCatalogRecoveryProductUpdate(
        catalogRecoveryInput(product.id, '2000-01-01T00:00:00.000Z', true),
      ),
    ).resolves.toEqual({ status: 'stale' });
    expect(mocks.storage.get(KEY)).toBe(original);

    await expect(
      applyCatalogRecoveryProductUpdate(
        catalogRecoveryInput('missing-product', product.updatedAt, true),
      ),
    ).resolves.toEqual({ status: 'missing' });
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('keeps a valid legacy shelf readable without rewriting until mutation', async () => {
    const original = JSON.stringify([
      {
        id: 'retinol',
        name: 'Retinol Serum',
        addedVia: 'manual',
        ingredients: [' retinol ', '', false],
      },
    ]);
    mocks.storage.set(KEY, original);

    await expect(loadShelf()).resolves.toMatchObject([
      { id: 'retinol', ingredients: ['retinol'], status: 'active' },
    ]);
    expect(mocks.storage.get(KEY)).toBe(original);

    await updateProduct('retinol', { brand: 'Example' });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 1,
      products: [{ id: 'retinol', brand: 'Example', ingredients: ['retinol'] }],
    });
  });

  it('preserves future-version shelf bytes and refuses every mutation', async () => {
    const original = JSON.stringify({ version: 2, products: [] });
    mocks.storage.set(KEY, original);

    await expect(loadShelf()).resolves.toEqual([]);
    await expect(addProduct({ name: 'Cleanser', addedVia: 'manual' })).rejects.toThrow(
      SHELF_STATE_UNSUPPORTED_VERSION,
    );
    await expect(updateProduct('missing', { brand: 'Nope' })).rejects.toThrow(
      SHELF_STATE_UNSUPPORTED_VERSION,
    );
    await expect(removeProduct('missing')).rejects.toThrow(SHELF_STATE_UNSUPPORTED_VERSION);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('serializes simultaneous additions without losing a product', async () => {
    const names = Array.from({ length: 30 }, (_, index) => `Product ${index}`);

    await Promise.all(names.map((name) => addProduct({ name, addedVia: 'manual' })));

    const shelf = await loadShelf();
    expect(shelf).toHaveLength(names.length);
    expect(new Set(shelf.map((product) => product.name))).toEqual(new Set(names));
  });

  it('deduplicates an uncertain intake retry by its stable operation id', async () => {
    const operationId = '00000000-0000-4000-8000-000000000099';
    const first = await addProduct({ operationId, name: 'Offline serum', addedVia: 'manual' });
    const retried = await addProduct({ operationId, name: 'Offline serum', addedVia: 'manual' });

    expect(retried).toEqual(first);
    expect(await loadShelf()).toHaveLength(1);
  });

  it('rejects a malformed caller-supplied operation id before writing', async () => {
    await expect(
      addProduct({ operationId: 'not-a-uuid', name: 'Cleanser', addedVia: 'manual' }),
    ).rejects.toThrow(SHELF_STATE_INVALID);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('keeps the prior shelf intact when an atomic write fails', async () => {
    const product = await addProduct({ name: 'Cleanser', addedVia: 'manual' });
    const original = mocks.storage.get(KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(updateProduct(product.id, { brand: 'Example' })).rejects.toThrow(
      'PRIVATE_WRITE_FAILED',
    );

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('rejects a queued write after close and same-epoch regrant without changing shelf bytes', async () => {
    const product = await addProduct({ name: 'Cleanser', addedVia: 'manual' });
    const original = mocks.storage.get(KEY);
    let releaseUpdate!: () => void;
    mocks.updateGate = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });
    const updateStarted = new Promise<void>((resolve) => {
      mocks.updateStarted = resolve;
    });

    const pending = updateProduct(product.id, { brand: 'Stale brand' });
    await updateStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
    const rejection = expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');

    releaseUpdate();
    await rejection;

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('clears shelf bytes after health processing closes', async () => {
    await addProduct({ name: 'Cleanser', addedVia: 'manual' });
    clearActiveHealthProcessingEpoch();

    await clearShelf();

    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
