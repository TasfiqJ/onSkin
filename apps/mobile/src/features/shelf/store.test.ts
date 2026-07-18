import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acknowledgeProductAdd,
  addProduct as addProductWithOperation,
  clearShelf,
  loadShelf,
  readShelfState,
  reAddProduct,
  removeProduct,
  SHELF_REPLENISHMENT_ALREADY_REPLACED,
  SHELF_ADD_OPERATION_INPUT_MISMATCH,
  SHELF_ADD_OPERATION_OWNER_MISMATCH,
  SHELF_STATE_INVALID,
  SHELF_STATE_UNAVAILABLE,
  SHELF_STATE_UNSUPPORTED_VERSION,
  updateProduct,
  type NewShelfProduct,
  type ShelfAddOwner,
} from './store';

const mocks = vi.hoisted(() => ({
  digestStringAsync: vi.fn(),
  storage: new Map<string, string>(),
  nextId: 0,
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  responseLossAfterCommit: 0,
  readOverride: null as
    | null
    | { status: 'absent' }
    | { status: 'available'; value: string }
    | { status: 'unavailable'; reason: 'storage_unavailable' }
    | { status: 'corrupt'; reason: 'envelope_invalid' }
    | { status: 'unsupported_version' },
  updateCalls: 0,
  transactionCalls: 0,
  writeCalls: 0,
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
  randomUUID: vi.fn(() => `00000000-0000-4000-8000-${String(++mocks.nextId).padStart(12, '0')}`),
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
        if (next !== current && mocks.responseLossAfterCommit > 0) {
          mocks.responseLossAfterCommit -= 1;
          throw new Error('PRIVATE_WRITE_RESPONSE_LOST');
        }
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
  updatePrivateItemsTransactionally: vi.fn(
    async (
      keys: readonly string[],
      updater: (current: ReadonlyMap<string, string | null>) => ReadonlyMap<string, string | null>,
    ) => {
      mocks.transactionCalls += 1;
      const previous = mocks.tails.get('__transaction__') ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set('__transaction__', tail);
      await previous;
      try {
        if (mocks.updateFailure) throw mocks.updateFailure;
        const current = new Map(keys.map((key) => [key, mocks.storage.get(key) ?? null]));
        const next = updater(current);
        for (const key of keys) {
          const value = next.get(key) ?? null;
          if (value === current.get(key)) continue;
          mocks.writeCalls += 1;
          if (value === null) mocks.storage.delete(key);
          else mocks.storage.set(key, value);
        }
      } finally {
        release();
        if (mocks.tails.get('__transaction__') === tail) mocks.tails.delete('__transaction__');
      }
    },
  ),
}));

const KEY = 'onskin.shelf.v1';
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;
let testAddOperationId = 0;

function addProduct(input: NewShelfProduct, owner: Partial<ShelfAddOwner> = {}) {
  const operationId = owner.operationId ?? `test-add-operation-${++testAddOperationId}`;
  return addProductWithOperation(input, { ...owner, operationId });
}

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
    mocks.responseLossAfterCommit = 0;
    mocks.readOverride = null;
    mocks.updateCalls = 0;
    mocks.transactionCalls = 0;
    mocks.writeCalls = 0;
    testAddOperationId = 0;
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('atomically appends an owner-bound encrypted outbox intent with an authenticated add', async () => {
    const product = await addProductWithOperation(
      { name: 'Atomic cleanser', addedVia: 'manual' },
      {
        ownerId: 'owner-a',
        ownerGeneration: 7,
        operationId: 'atomic-add-operation',
      },
    );

    expect(mocks.transactionCalls).toBe(1);
    expect(storedProducts()).toEqual([expect.objectContaining({ id: product.id })]);
    const outboxRaw = mocks.storage.get('onskin.outbox.v1');
    expect(outboxRaw).toBeDefined();
    expect(outboxRaw).not.toContain('owner-a');
    expect(JSON.parse(outboxRaw!) as unknown).toMatchObject({
      version: 4,
      rows: [
        {
          ownerGeneration: 7,
          entityType: 'shelf_product',
          entityId: product.id,
          operationKind: 'upsert',
          clientRevision: 1,
          state: 'ready',
          payload: { manual_name: 'Atomic cleanser' },
        },
      ],
      revisions: [
        {
          ownerHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          entityType: 'shelf_product',
          entityId: product.id,
          revision: 1,
        },
      ],
    });
  });

  it('requires caller-owned operation identity before entering private storage', async () => {
    await expect(
      addProductWithOperation(
        { name: 'No implicit operation', addedVia: 'manual' },
        undefined as never,
      ),
    ).rejects.toThrow(SHELF_STATE_INVALID);
    await expect(
      addProductWithOperation(
        { name: 'Padded operation', addedVia: 'manual' },
        { operationId: ' padded-operation ' },
      ),
    ).rejects.toThrow(SHELF_STATE_INVALID);

    expect(mocks.updateCalls).toBe(0);
    expect(mocks.writeCalls).toBe(0);
    expect(mocks.storage.size).toBe(0);
  });

  it('distinguishes absence from valid empty current and legacy shelves without writing', async () => {
    await expect(readShelfState()).resolves.toEqual({ status: 'absent', products: [] });

    mocks.storage.set(KEY, JSON.stringify({ version: 3, products: [], addOperations: [] }));
    await expect(readShelfState()).resolves.toEqual({
      status: 'available',
      products: [],
      format: 'current',
    });

    mocks.storage.set(KEY, JSON.stringify({ version: 2, products: [], addOperations: [] }));
    await expect(readShelfState()).resolves.toEqual({
      status: 'available',
      products: [],
      format: 'legacy',
    });

    mocks.storage.set(KEY, JSON.stringify({ version: 1, products: [] }));
    await expect(readShelfState()).resolves.toEqual({
      status: 'available',
      products: [],
      format: 'legacy',
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
    const original = JSON.stringify({ version: 2, products: [], addOperations: [] });
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
      version: 3,
      products: [{ id: 'retinol', brand: 'Example', ingredients: ['retinol'] }],
      addOperations: [],
    });
  });

  it('preserves future-version shelf bytes and refuses every mutation', async () => {
    const original = JSON.stringify({ version: 4, products: [], addOperations: [] });
    mocks.storage.set(KEY, original);

    await expect(readShelfState()).resolves.toEqual({
      status: 'unsupported_version',
      products: null,
    });
    await expect(loadShelf()).rejects.toThrow(SHELF_STATE_UNSUPPORTED_VERSION);
    await expect(addProduct({ name: 'Cleanser', addedVia: 'manual' })).rejects.toThrow(
      SHELF_STATE_UNSUPPORTED_VERSION,
    );
    await expect(acknowledgeProductAdd('missing')).rejects.toThrow(SHELF_STATE_UNSUPPORTED_VERSION);
    await expect(updateProduct('missing', { brand: 'Nope' })).rejects.toThrow(
      SHELF_STATE_UNSUPPORTED_VERSION,
    );
    await expect(removeProduct('missing')).rejects.toThrow(SHELF_STATE_UNSUPPORTED_VERSION);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves malformed add-operation bytes and refuses add acknowledgement or retry', async () => {
    const original = JSON.stringify({
      version: 2,
      products: [],
      addOperations: [
        {
          operationId: 'operation-1',
          ownerHash: 'not-a-sha256',
          inputHash: 'b'.repeat(64),
          productId: 'missing-product',
          createdAt: '2026-07-15T12:00:00.000Z',
        },
      ],
    });
    mocks.storage.set(KEY, original);

    await expect(readShelfState()).resolves.toEqual({ status: 'corrupt', products: null });
    await expect(
      addProduct({ name: 'Must not overwrite', addedVia: 'manual' }, { ownerId: 'owner-a' }),
    ).rejects.toThrow(SHELF_STATE_INVALID);
    await expect(acknowledgeProductAdd('missing-product', { ownerId: 'owner-a' })).rejects.toThrow(
      SHELF_STATE_INVALID,
    );
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('reads strict v2 pending mappings without rewriting and upgrades them on acknowledgement', async () => {
    const owner = { ownerId: 'owner-a', operationId: 'installed-v2-operation' };
    const product = await addProduct({ name: 'Installed v2 row', addedVia: 'manual' }, owner);
    const current = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
      products: unknown[];
      addOperations: Record<string, unknown>[];
    };
    const v2 = JSON.stringify({
      version: 2,
      products: current.products,
      addOperations: current.addOperations.map((operation) => ({
        operationId: operation.operationId,
        ownerHash: operation.ownerHash,
        inputHash: operation.inputHash,
        productId: operation.productId,
        createdAt: operation.createdAt,
      })),
    });
    mocks.storage.set(KEY, v2);
    mocks.writeCalls = 0;

    await expect(readShelfState()).resolves.toMatchObject({
      status: 'available',
      format: 'legacy',
    });
    expect(mocks.storage.get(KEY)).toBe(v2);
    expect(mocks.writeCalls).toBe(0);

    await acknowledgeProductAdd(product.id, owner);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 3,
      addOperations: [
        {
          operationId: owner.operationId,
          status: 'acknowledged',
          acknowledgedAt: expect.any(String),
        },
      ],
    });
  });

  it('preserves non-canonical v3 ledger bytes and refuses every relevant mutation', async () => {
    const owner = { ownerId: 'owner-a', operationId: 'strict-v3-operation' };
    const product = await addProduct({ name: 'Strict v3 row', addedVia: 'manual' }, owner);
    const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
      addOperations: Record<string, unknown>[];
    };
    parsed.addOperations[0] = { ...parsed.addOperations[0], unexpected: true };
    const original = JSON.stringify(parsed);
    mocks.storage.set(KEY, original);

    await expect(readShelfState()).resolves.toEqual({ status: 'corrupt', products: null });
    await expect(
      addProduct(
        { name: 'Must not replace strict bytes', addedVia: 'manual' },
        { ownerId: 'owner-a', operationId: 'another-operation' },
      ),
    ).rejects.toThrow(SHELF_STATE_INVALID);
    await expect(acknowledgeProductAdd(product.id, owner)).rejects.toThrow(SHELF_STATE_INVALID);
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

    for (const original of [
      '{not-json',
      JSON.stringify({ version: 4, products: [], addOperations: [] }),
    ]) {
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

  it('converges 100 concurrent retries of one owner operation on one product id', async () => {
    const input = { name: 'One uncertain cleanser add', addedVia: 'manual' as const };
    const owner = { ownerId: 'owner-a', operationId: 'one-cleanser-operation' };

    const results = await Promise.all(Array.from({ length: 100 }, () => addProduct(input, owner)));

    expect(new Set(results.map((product) => product.id))).toEqual(new Set([results[0]!.id]));
    await expect(loadShelf()).resolves.toHaveLength(1);
    expect(mocks.writeCalls).toBe(1);
  });

  it('keeps 100 distinct operation ids with identical payloads distinct', async () => {
    const input = { name: 'Identical units', addedVia: 'manual' as const };
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        addProduct(input, { ownerId: 'owner-a', operationId: `distinct-operation-${index}` }),
      ),
    );

    expect(new Set(results.map((product) => product.id)).size).toBe(100);
    await expect(loadShelf()).resolves.toHaveLength(100);
  });

  it('recovers the same product after a committed add loses its response', async () => {
    const input = { name: 'Commit response loss', addedVia: 'manual' as const };
    const owner = { ownerId: 'owner-a', operationId: 'response-loss-operation' };
    mocks.responseLossAfterCommit = 1;

    await expect(addProduct(input, owner)).rejects.toThrow('PRIVATE_WRITE_RESPONSE_LOST');
    const committedId = (await loadShelf())[0]!.id;
    const writesAfterUncertainCommit = mocks.writeCalls;

    await expect(addProduct(input, owner)).resolves.toMatchObject({ id: committedId });
    expect(mocks.writeCalls).toBe(writesAfterUncertainCommit);
  });

  it('keeps the same frozen operation identity across UTC midnight', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-07-15T23:59:59.900Z'));
      const input = {
        name: 'Time-zone-safe recovery',
        openedAt: '2026-07-16',
        isOpened: true,
        paoMonths: 12,
        paoSource: 'label' as const,
        addedVia: 'manual' as const,
      };
      const owner = { ownerId: 'owner-a', operationId: 'utc-midnight-operation' };
      mocks.responseLossAfterCommit = 1;

      await expect(addProduct(input, owner)).rejects.toThrow('PRIVATE_WRITE_RESPONSE_LOST');
      const committedId = (await loadShelf())[0]!.id;
      const writesAfterUncertainCommit = mocks.writeCalls;

      vi.setSystemTime(new Date('2026-07-16T00:00:00.100Z'));
      await expect(addProduct(input, owner)).resolves.toMatchObject({ id: committedId });
      expect(mocks.writeCalls).toBe(writesAfterUncertainCommit);
      await expect(loadShelf()).resolves.toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not reinterpret persisted local freshness after a clock rollback', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));
      const product = await addProduct({
        name: 'Local-date recovery',
        openedAt: '2026-07-16',
        isOpened: true,
        paoMonths: 12,
        paoSource: 'label',
        addedVia: 'manual',
      });
      expect(product).toMatchObject({ openedAt: '2026-07-16', isOpened: true });
      const original = mocks.storage.get(KEY);

      vi.setSystemTime(new Date('2026-07-15T23:59:59.900Z'));
      await expect(readShelfState()).resolves.toMatchObject({
        status: 'available',
        products: [{ id: product.id, openedAt: '2026-07-16', isOpened: true }],
      });
      expect(mocks.storage.get(KEY)).toBe(original);

      await updateProduct(product.id, { brand: 'Clock-safe edit' });
      await expect(loadShelf()).resolves.toEqual([
        expect.objectContaining({
          id: product.id,
          brand: 'Clock-safe edit',
          openedAt: '2026-07-16',
          isOpened: true,
        }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('matches a retry through normalized defaults and cosmetic whitespace', async () => {
    const owner = { ownerId: 'owner-a', operationId: 'normalized-operation' };
    const first = await addProduct(
      {
        name: '  Retinol serum  ',
        brand: ' Example ',
        ingredients: [' retinol '],
        addedVia: 'manual',
      },
      owner,
    );
    mocks.writeCalls = 0;

    const recovered = await addProduct(
      {
        name: 'Retinol serum',
        brand: 'Example',
        catalogSource: 'user_local',
        catalogMatchQuality: 'manual',
        ingredients: ['retinol'],
        addedVia: 'manual',
      },
      owner,
    );

    expect(recovered.id).toBe(first.id);
    expect(mocks.writeCalls).toBe(0);
  });

  it('rejects the same operation token with a changed semantic payload without touching bytes', async () => {
    const owner = { ownerId: 'owner-a', operationId: 'immutable-input-operation' };
    await addProduct(
      {
        name: 'Retinol serum',
        openedAt: '2026-07-15',
        isOpened: true,
        sourceDisclosureAckAt: '2026-07-15T23:59:59.900Z',
        addedVia: 'manual',
      },
      owner,
    );
    const original = mocks.storage.get(KEY);

    await expect(
      addProduct(
        {
          name: 'Retinol serum',
          openedAt: '2026-07-16',
          isOpened: true,
          sourceDisclosureAckAt: '2026-07-16T00:00:00.100Z',
          addedVia: 'manual',
        },
        owner,
      ),
    ).rejects.toThrow(SHELF_ADD_OPERATION_INPUT_MISMATCH);
    expect(mocks.storage.get(KEY)).toBe(original);
    await expect(loadShelf()).resolves.toHaveLength(1);
  });

  it('retains the durable mapping after acknowledgement and a new token creates a new unit', async () => {
    const input = { name: 'Restart-safe add', addedVia: 'manual' as const };
    const owner = { ownerId: 'owner-a', operationId: 'restart-safe-operation' };
    const committed = await addProduct(input, owner);
    mocks.writeCalls = 0;

    // The store has no module-memory attempt coordinator. Reusing the exact
    // caller-owned token proves durable lookup, not process-death token recovery.
    const recovered = await addProduct(input, owner);
    expect(recovered.id).toBe(committed.id);
    expect(mocks.writeCalls).toBe(0);

    await acknowledgeProductAdd(committed.id, owner);
    const acknowledgedRetry = await addProduct(input, owner);
    expect(acknowledgedRetry.id).toBe(committed.id);

    const intentionalSecondUnit = await addProduct(input, {
      ownerId: 'owner-a',
      operationId: 'intentional-second-unit',
    });
    expect(intentionalSecondUnit.id).not.toBe(committed.id);
    await expect(loadShelf()).resolves.toHaveLength(2);
  });

  it('rejects an owner-B retry of owner-A unacknowledged operation without changing bytes', async () => {
    const input = { name: 'Owner-bound add', addedVia: 'manual' as const };
    const operationId = 'owner-bound-operation';
    await addProduct(input, { ownerId: 'owner-a', operationId });
    const original = mocks.storage.get(KEY);

    await expect(addProduct(input, { ownerId: 'owner-b', operationId })).rejects.toThrow(
      SHELF_ADD_OPERATION_OWNER_MISMATCH,
    );
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('reconciles a committed acknowledgement whose storage response is lost', async () => {
    const input = { name: 'Acknowledgement response loss', addedVia: 'manual' as const };
    const owner = { ownerId: 'owner-a', operationId: 'ack-response-loss-operation' };
    const product = await addProduct(input, owner);
    mocks.responseLossAfterCommit = 1;

    await expect(acknowledgeProductAdd(product.id, owner)).resolves.toBeUndefined();

    const acknowledgedRetry = await addProduct(input, owner);
    expect(acknowledgedRetry.id).toBe(product.id);
    const intentionalSecondUnit = await addProduct(input, {
      ownerId: 'owner-a',
      operationId: 'new-identical-operation',
    });
    expect(intentionalSecondUnit.id).not.toBe(product.id);
  });

  it('keeps the origin tombstone after ack commit, lost response, and unavailable readback', async () => {
    const input = { name: 'Uncertain acknowledged add', addedVia: 'manual' as const };
    const owner = { ownerId: 'owner-a', operationId: 'uncertain-ack-operation' };
    const product = await addProduct(input, owner);
    mocks.responseLossAfterCommit = 1;
    mocks.readOverride = { status: 'unavailable', reason: 'storage_unavailable' };

    await expect(acknowledgeProductAdd(product.id, owner)).rejects.toThrow(
      'PRIVATE_WRITE_RESPONSE_LOST',
    );

    mocks.readOverride = null;
    const sameTokenRetry = await addProduct(input, owner);
    expect(sameTokenRetry.id).toBe(product.id);
    expect(await loadShelf()).toHaveLength(1);

    const newIdenticalIntent = await addProduct(input, {
      ownerId: 'owner-a',
      operationId: 'new-intent-after-uncertain-ack',
    });
    expect(newIdenticalIntent.id).not.toBe(product.id);
    expect(await loadShelf()).toHaveLength(2);
  });

  it('does not treat whole-Shelf absence as proof that acknowledgement committed', async () => {
    const owner = { ownerId: 'owner-a' };
    const product = await addProduct(
      { name: 'Missing Shelf is not an acknowledgement', addedVia: 'manual' },
      owner,
    );
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');
    mocks.readOverride = { status: 'absent' };

    await expect(acknowledgeProductAdd(product.id, owner)).rejects.toThrow('PRIVATE_WRITE_FAILED');
  });

  it('bounds pending add mappings and preserves the full prior envelope at the limit', async () => {
    const owner = { ownerId: 'owner-a' };
    for (let index = 0; index < 128; index += 1) {
      await addProduct({ name: `Unacknowledged ${index}`, addedVia: 'manual' }, owner);
    }
    const original = mocks.storage.get(KEY);

    await expect(
      addProduct({ name: 'One beyond the bounded ledger', addedVia: 'manual' }, owner),
    ).rejects.toThrow('SHELF_ADD_OPERATION_LIMIT_REACHED');
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('prunes only the oldest acknowledged tombstone when the bounded ledger needs room', async () => {
    const products: Awaited<ReturnType<typeof addProduct>>[] = [];
    for (let index = 0; index < 128; index += 1) {
      products.push(
        await addProduct(
          { name: `Bounded mapping ${index}`, addedVia: 'manual' },
          { ownerId: 'owner-a', operationId: `operation-${String(index).padStart(3, '0')}` },
        ),
      );
    }
    await acknowledgeProductAdd(products[0]!.id, { ownerId: 'owner-a' });
    await acknowledgeProductAdd(products[1]!.id, { ownerId: 'owner-a' });

    await addProduct(
      { name: 'Makes room by pruning one tombstone', addedVia: 'manual' },
      { ownerId: 'owner-a', operationId: 'operation-new' },
    );

    const stored = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
      addOperations: { operationId: string; status: string }[];
    };
    expect(stored.addOperations).toHaveLength(128);
    expect(stored.addOperations).toContainEqual(
      expect.objectContaining({ operationId: 'operation-001', status: 'acknowledged' }),
    );
    expect(stored.addOperations.some((row) => row.operationId === 'operation-000')).toBe(false);
    expect(stored.addOperations.filter((row) => row.status === 'pending')).toHaveLength(127);
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
