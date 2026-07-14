import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addProduct,
  clearShelf,
  loadShelf,
  readShelfState,
  reAddProduct,
  removeProduct,
  SHELF_REPLENISHMENT_ALREADY_REPLACED,
  SHELF_STATE_INVALID,
  SHELF_STATE_UNAVAILABLE,
  SHELF_STATE_UNSUPPORTED_VERSION,
  updateProduct,
} from './store';

const mocks = vi.hoisted(() => ({
  digestStringAsync: vi.fn(),
  storage: new Map<string, string>(),
  nextId: 0,
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  readOverride: null as
    | null
    | { status: 'absent' }
    | { status: 'available'; value: string }
    | { status: 'unavailable'; reason: 'storage_unavailable' }
    | { status: 'corrupt'; reason: 'envelope_invalid' }
    | { status: 'unsupported_version' },
  updateCalls: 0,
  writeCalls: 0,
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
  randomUUID: vi.fn(() => `shelf-product-${++mocks.nextId}`),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    if (mocks.readOverride) return mocks.readOverride;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      mocks.updateCalls += 1;
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, tail);
      await previous;
      try {
        if (mocks.updateFailure) throw mocks.updateFailure;
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (next !== current) mocks.writeCalls += 1;
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
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

function storedProducts(): unknown[] {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    products?: unknown[];
  };
  return parsed.products ?? [];
}

describe('shelf local store recovery', () => {
  beforeEach(() => {
    mocks.digestStringAsync.mockReset();
    mocks.digestStringAsync.mockImplementation(async (_algorithm: string, value: string) => {
      let hash = 2_166_136_261;
      for (const char of value) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16_777_619);
      }
      let digest = '';
      for (let index = 0; index < 8; index += 1) {
        hash = Math.imul(hash ^ index, 16_777_619);
        digest += (hash >>> 0).toString(16).padStart(8, '0');
      }
      return digest;
    });
    mocks.storage.clear();
    mocks.nextId = 0;
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.readOverride = null;
    mocks.updateCalls = 0;
    mocks.writeCalls = 0;
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('distinguishes absence from valid empty current and legacy shelves without writing', async () => {
    await expect(readShelfState()).resolves.toEqual({ status: 'absent', products: [] });

    mocks.storage.set(KEY, JSON.stringify({ version: 1, products: [] }));
    await expect(readShelfState()).resolves.toEqual({
      status: 'available',
      products: [],
      format: 'current',
    });

    mocks.storage.set(KEY, '[]');
    await expect(readShelfState()).resolves.toEqual({
      status: 'available',
      products: [],
      format: 'legacy',
    });
    expect(mocks.updateCalls).toBe(0);
    expect(mocks.writeCalls).toBe(0);
  });

  it('forwards private read failures and makes strict compatibility reads fail closed', async () => {
    mocks.readOverride = { status: 'unavailable', reason: 'storage_unavailable' };
    await expect(readShelfState()).resolves.toEqual({ status: 'unavailable', products: null });
    await expect(loadShelf()).rejects.toThrow(SHELF_STATE_UNAVAILABLE);

    mocks.readOverride = { status: 'corrupt', reason: 'envelope_invalid' };
    await expect(readShelfState()).resolves.toEqual({ status: 'corrupt', products: null });
    await expect(loadShelf()).rejects.toThrow(SHELF_STATE_INVALID);

    mocks.readOverride = { status: 'unsupported_version' };
    await expect(readShelfState()).resolves.toEqual({
      status: 'unsupported_version',
      products: null,
    });
    await expect(loadShelf()).rejects.toThrow(SHELF_STATE_UNSUPPORTED_VERSION);
    expect(mocks.updateCalls).toBe(0);
  });

  it('supports a dev-only unavailable fixture without touching stored bytes', async () => {
    const original = JSON.stringify({ version: 1, products: [] });
    mocks.storage.set(KEY, original);
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE = 'always';

    await expect(readShelfState()).resolves.toEqual({ status: 'unavailable', products: null });
    await expect(loadShelf()).rejects.toThrow(SHELF_STATE_UNAVAILABLE);
    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.updateCalls).toBe(0);
  });

  it('recovers a development one-shot failure on the next explicit read', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE = 'once';

    await expect(readShelfState()).resolves.toEqual({ status: 'unavailable', products: null });
    await expect(readShelfState()).resolves.toEqual({ status: 'absent', products: [] });
  });

  it('ignores the Shelf failure fixture outside development builds', async () => {
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE = 'always';

    await expect(readShelfState()).resolves.toEqual({ status: 'absent', products: [] });
  });

  it('preserves malformed persisted shelf JSON', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(readShelfState()).resolves.toEqual({ status: 'corrupt', products: null });
    await expect(loadShelf()).rejects.toThrow(SHELF_STATE_INVALID);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves wrong-shaped persisted shelf state', async () => {
    const original = JSON.stringify({ id: 'not-an-array' });
    mocks.storage.set(KEY, original);

    await expect(readShelfState()).resolves.toEqual({ status: 'corrupt', products: null });
    await expect(loadShelf()).rejects.toThrow(SHELF_STATE_INVALID);
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

    await expect(readShelfState()).resolves.toEqual({ status: 'corrupt', products: null });
    await expect(loadShelf()).rejects.toThrow(SHELF_STATE_INVALID);
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

    const replaced = await reAddProduct(previous.id);
    const fresh = replaced?.fresh;
    const shelf = await loadShelf();
    const archived = shelf.find((product) => product.id === previous.id);

    expect(fresh).toMatchObject({
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
    expect(fresh?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(fresh?.id).not.toBe(previous.id);
    expect(fresh?.openedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(replaced?.archived.id).toBe(previous.id);
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

  it('performs no physical write for a semantic no-op update', async () => {
    const product = await addProduct({ name: 'Mineral SPF 50', addedVia: 'manual' });
    const original = mocks.storage.get(KEY);
    mocks.writeCalls = 0;

    await expect(updateProduct(product.id, { name: product.name })).resolves.toEqual(product);

    expect(mocks.writeCalls).toBe(0);
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

    await expect(readShelfState()).resolves.toEqual({
      status: 'unsupported_version',
      products: null,
    });
    await expect(loadShelf()).rejects.toThrow(SHELF_STATE_UNSUPPORTED_VERSION);
    await expect(addProduct({ name: 'Cleanser', addedVia: 'manual' })).rejects.toThrow(
      SHELF_STATE_UNSUPPORTED_VERSION,
    );
    await expect(updateProduct('missing', { brand: 'Nope' })).rejects.toThrow(
      SHELF_STATE_UNSUPPORTED_VERSION,
    );
    await expect(removeProduct('missing')).rejects.toThrow(SHELF_STATE_UNSUPPORTED_VERSION);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('makes concurrent replenishment calls converge on one deterministic successor', async () => {
    const previous = await addProduct({ name: 'Cleanser', addedVia: 'manual' });

    const [first, second] = await Promise.all([
      reAddProduct(previous.id),
      reAddProduct(previous.id),
    ]);

    expect(first?.fresh.id).toBe(second?.fresh.id);
    expect((await loadShelf()).filter((product) => product.status === 'active')).toHaveLength(1);
    expect(await loadShelf()).toHaveLength(2);
  });

  it('recovers a committed replenishment after remount without mutable coordinator state', async () => {
    const previous = await addProduct({ name: 'Crash-safe replenishment', addedVia: 'manual' });
    const committed = await reAddProduct(previous.id);

    const recovered = await reAddProduct(previous.id);

    expect(recovered).toEqual(committed);
    expect(await loadShelf()).toHaveLength(2);
  });

  it('keeps immutable lineage after supported edits to the archived source', async () => {
    const previous = await addProduct({ name: 'Editable archived source', addedVia: 'manual' });
    const committed = await reAddProduct(previous.id);
    await updateProduct(previous.id, {
      name: 'Edited archived source',
      openedAt: '2026-02-01',
      paoMonths: 6,
      expiryDate: '2027-01-01',
    });

    const recovered = await reAddProduct(previous.id);

    expect(recovered?.fresh.id).toBe(committed?.fresh.id);
    expect((await loadShelf()).filter((product) => product.status === 'active')).toHaveLength(1);
    expect(await loadShelf()).toHaveLength(2);
  });

  it('refuses to report a consumed descendant as a fresh retry result', async () => {
    const previous = await addProduct({ name: 'Consumed replenishment', addedVia: 'manual' });
    const committed = await reAddProduct(previous.id);
    await updateProduct(committed!.fresh.id, {
      status: 'finished',
      finishedAt: '2026-07-13',
    });

    await expect(reAddProduct(previous.id)).rejects.toThrow(SHELF_REPLENISHMENT_ALREADY_REPLACED);
    expect(await loadShelf()).toHaveLength(2);
  });

  it('refuses an invalid deterministic replacement digest without touching storage', async () => {
    const previous = await addProduct({ name: 'Cleanser', addedVia: 'manual' });
    const original = mocks.storage.get(KEY);
    mocks.digestStringAsync.mockResolvedValueOnce('not-a-sha256-digest');

    await expect(reAddProduct(previous.id)).rejects.toThrow(SHELF_STATE_INVALID);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('clears only valid Shelf state and preserves corrupt or future bytes', async () => {
    await addProduct({ name: 'Cleanser', addedVia: 'manual' });
    await clearShelf();
    expect(mocks.storage.has(KEY)).toBe(false);

    for (const original of ['{not-json', JSON.stringify({ version: 2, products: [] })]) {
      mocks.storage.set(KEY, original);
      await expect(clearShelf()).rejects.toThrow();
      expect(mocks.storage.get(KEY)).toBe(original);
    }
  });

  it('serializes simultaneous additions without losing a product', async () => {
    const names = Array.from({ length: 100 }, (_, index) => `Product ${index}`);

    await Promise.all(names.map((name) => addProduct({ name, addedVia: 'manual' })));

    const shelf = await loadShelf();
    expect(shelf).toHaveLength(names.length);
    expect(new Set(shelf.map((product) => product.name))).toEqual(new Set(names));
  });

  it('serializes 100 distinct simultaneous edits without losing any update', async () => {
    const products = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        addProduct({ name: `Editable ${index}`, addedVia: 'manual' }),
      ),
    );

    await Promise.all(
      products.map((product, index) => updateProduct(product.id, { brand: `Brand ${index}` })),
    );

    const byId = new Map((await loadShelf()).map((product) => [product.id, product]));
    for (const [index, product] of products.entries()) {
      expect(byId.get(product.id)?.brand).toBe(`Brand ${index}`);
    }
  });

  it('turns 100 simultaneous removes of one product into one durable change', async () => {
    const product = await addProduct({ name: 'One package', addedVia: 'manual' });
    mocks.writeCalls = 0;

    const results = await Promise.all(Array.from({ length: 100 }, () => removeProduct(product.id)));

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(mocks.writeCalls).toBe(1);
    await expect(loadShelf()).resolves.toEqual([]);
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
});
