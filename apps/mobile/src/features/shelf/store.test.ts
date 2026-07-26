import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  acknowledgeShelfMirrorOperation,
  addProduct,
  applyCatalogRecoveryProductUpdate,
  clearShelf,
  getPendingShelfMirrorOperations,
  getShelfMirrorIncompatibilities,
  hasUnresolvedTerminalShelfMirrorOperationForProduct,
  loadShelf,
  reAddProduct,
  rejectShelfMirrorOperation,
  removeProduct,
  SHELF_PRODUCT_BRAND_MAX_LENGTH,
  SHELF_PRODUCT_NAME_MAX_LENGTH,
  SHELF_PRODUCT_TEXT_MAX_BYTES,
  SHELF_STATE_INVALID,
  SHELF_STATE_UNSUPPORTED_VERSION,
  subscribeShelfMirrorOutboxChanges,
  updateProduct,
  type CatalogRecoveryProductUpdate,
  type ShelfMirrorOperation,
  type ShelfMirrorTerminal,
  type ShelfProduct,
} from './store';
import { normalizeShelfFreshnessV1 } from './freshness';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  nextId: 0,
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  updateGate: null as Promise<void> | null,
  updateStarted: null as (() => void) | null,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `10000000-0000-4000-8000-${String(++mocks.nextId).padStart(12, '0')}`),
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

function operationId(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

function v1Product(
  product: ShelfProduct,
): Omit<
  ShelfProduct,
  | 'replacementRootId'
  | 'replacesProductId'
  | 'replacementLineageAmbiguous'
  | 'legacyUnverifiedExpiryDate'
> {
  const {
    replacementRootId: _root,
    replacesProductId: _predecessor,
    replacementLineageAmbiguous: _ambiguous,
    legacyUnverifiedExpiryDate: _legacyUnverifiedExpiryDate,
    ...historical
  } = product;
  return { ...historical, ...normalizeShelfFreshnessV1(historical, '2026-07-19') };
}

function storedProducts(): unknown[] {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    products?: unknown[];
  };
  return parsed.products ?? [];
}

function storedMirrorOutbox(): ShelfMirrorOperation[] {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    mirrorOutbox?: ShelfMirrorOperation[];
  };
  return parsed.mirrorOutbox ?? [];
}

function storedMirrorTerminal(): ShelfMirrorTerminal[] {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    terminal?: ShelfMirrorTerminal[];
  };
  return parsed.terminal ?? [];
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

  afterEach(() => {
    vi.useRealTimers();
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

  it('keeps canonical opened-date bytes readable across a westward date-line change', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
    const product = await addProduct({
      name: 'Travel cleanser',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-07-19',
      paoMonths: 6,
      paoSource: 'label',
    });
    const original = mocks.storage.get(KEY);

    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
    await expect(loadShelf()).resolves.toMatchObject([
      { id: product.id, isOpened: true, openedAt: '2026-07-19' },
    ]);
    expect(mocks.storage.get(KEY)).toBe(original);

    await expect(updateProduct(product.id, { brand: 'Still intact' })).resolves.toMatchObject({
      id: product.id,
      brand: 'Still intact',
      isOpened: true,
      openedAt: '2026-07-19',
    });
    await expect(loadShelf()).resolves.toMatchObject([
      { id: product.id, brand: 'Still intact', isOpened: true, openedAt: '2026-07-19' },
    ]);
  });

  it('still rejects a newly submitted opened date after the current local date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
    const product = await addProduct({ name: 'Date guard serum', addedVia: 'manual' });

    await expect(
      updateProduct(product.id, { isOpened: true, openedAt: '2026-07-19' }),
    ).resolves.toMatchObject({ isOpened: false, openedAt: null, expirySource: 'unknown' });
  });

  it('clears opened date when a direct update marks a product unopened', async () => {
    const product = await addProduct({
      name: 'Ceramide Cream',
      category: 'moisturiser',
      addedVia: 'manual',
      openedAt: '2026-07-01',
      isOpened: true,
      paoMonths: 12,
      paoSource: 'label',
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
      expirySource: 'unknown',
    });
  });

  it('recomputes winning expiry provenance after direct freshness edits', async () => {
    const product = await addProduct({
      name: 'Vitamin C Serum',
      category: 'serum',
      addedVia: 'search',
      catalogProductId: operationId(601),
      catalogSourceId: operationId(602),
      catalogSource: 'routinekind_reviewed',
      catalogMatchQuality: 'usable',
      sourceDisclosureAckAt: '2026-07-18T12:00:00.000Z',
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

  it('fails unlinked catalog PAO closed on add and update while retaining reviewed provenance', async () => {
    const unlinked = await addProduct({
      name: 'Unlinked catalog claim',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-07-01',
      paoMonths: 36,
      paoSource: 'catalog',
    });
    expect(unlinked).toMatchObject({
      paoMonths: null,
      paoSource: 'unknown',
      expirySource: 'unknown',
    });

    await expect(
      updateProduct(unlinked.id, { paoMonths: 36, paoSource: 'catalog' }),
    ).resolves.toMatchObject({
      paoMonths: null,
      paoSource: 'unknown',
      expirySource: 'unknown',
    });

    await expect(
      addProduct({
        name: 'Reviewed catalog claim',
        addedVia: 'search',
        catalogProductId: operationId(605),
        catalogSourceId: operationId(606),
        catalogSource: 'routinekind_reviewed',
        catalogMatchQuality: 'usable',
        sourceDisclosureAckAt: '2026-07-18T12:00:00.000Z',
        isOpened: true,
        openedAt: '2026-07-01',
        paoMonths: 36,
        paoSource: 'catalog',
      }),
    ).resolves.toMatchObject({
      paoMonths: 36,
      paoSource: 'catalog',
      expirySource: 'pao_computed',
    });
  });

  it('retains an uncommon label PAO across unrelated edits', async () => {
    const product = await addProduct({
      name: '36M label serum',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-07-01',
      paoMonths: 36,
      paoSource: 'label',
    });

    await expect(updateProduct(product.id, { brand: 'Label unchanged' })).resolves.toMatchObject({
      brand: 'Label unchanged',
      paoMonths: 36,
      paoSource: 'label',
      expirySource: 'pao_computed',
    });
  });

  it('archives replacement history while clearing the old physical package date', async () => {
    const previous = await addProduct({
      name: 'Mineral SPF 50',
      brand: 'Test Brand',
      category: 'spf',
      catalogProductId: operationId(603),
      catalogSourceId: operationId(604),
      catalogSource: 'routinekind_reviewed',
      catalogMatchQuality: 'verified',
      sourceDisclosureAckAt: '2026-07-18T12:00:00.000Z',
      addedVia: 'search',
      isOpened: true,
      openedAt: '2026-01-01',
      paoMonths: 12,
      paoSource: 'catalog',
      expiryDate: '2026-07-01',
      expirySource: 'printed',
    });

    const replacementOpenedAt = '2026-07-01';
    const fresh = await reAddProduct(
      previous.id,
      {
        isOpened: true,
        openedAt: replacementOpenedAt,
      },
      operationId(1),
    );
    const shelf = await loadShelf();
    const archived = shelf.find((product) => product.id === previous.id);

    expect(fresh).toMatchObject({
      id: operationId(1),
      name: 'Mineral SPF 50',
      brand: 'Test Brand',
      catalogProductId: operationId(603),
      status: 'active',
      isOpened: true,
      paoMonths: 12,
      paoSource: 'catalog',
      expiryDate: null,
      expirySource: 'pao_computed',
      repurchaseCount: 2,
    });
    expect(fresh?.openedAt).toBe(replacementOpenedAt);
    expect(archived).toMatchObject({
      status: 'finished',
      openedAt: '2026-01-01',
      expiryDate: '2026-07-01',
      expirySource: 'printed',
      repurchaseCount: 1,
    });
  });

  it('does not carry a quarantined historical package date into a replacement unit', async () => {
    const previous = await addProduct({
      name: 'Legacy package-date serum',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-07-01',
      paoMonths: 36,
      paoSource: 'label',
    });
    const envelope = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
      version: 3;
      products: ShelfProduct[];
    };
    envelope.products[0]!.legacyUnverifiedExpiryDate = '2028-01-01';
    mocks.storage.set(KEY, JSON.stringify(envelope));

    const replacement = await reAddProduct(
      previous.id,
      { isOpened: false, openedAt: null },
      operationId(7),
    );
    expect(replacement).toMatchObject({
      expiryDate: null,
      expirySource: 'unknown',
      legacyUnverifiedExpiryDate: null,
    });
    expect((await loadShelf()).find((product) => product.id === previous.id)).toMatchObject({
      legacyUnverifiedExpiryDate: '2028-01-01',
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

    await reAddProduct(previous.id, { isOpened: false, openedAt: null }, operationId(2));

    const archived = (await loadShelf()).find((product) => product.id === previous.id);
    expect(archived).toMatchObject({ status: 'discarded', finishedAt: '2026-06-30' });
  });

  it('does not start a replacement PAO clock from repurchase alone', async () => {
    const previous = await addProduct({
      name: 'Labelled serum',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-01-01',
      paoMonths: 12,
      paoSource: 'label',
      expiryDate: '2027-01-01',
      expirySource: 'printed',
    });

    const replacement = await reAddProduct(
      previous.id,
      { isOpened: false, openedAt: null },
      operationId(3),
    );

    expect(replacement).toMatchObject({
      isOpened: false,
      openedAt: null,
      paoMonths: 12,
      paoSource: 'label',
      expiryDate: null,
      expirySource: 'unknown',
    });
  });

  it('rejects a replacement without an explicit opening state before writing', async () => {
    const previous = await addProduct({ name: 'Cleanser', addedVia: 'manual' });
    const original = mocks.storage.get(KEY);

    await expect(reAddProduct(previous.id, undefined as never, operationId(4))).rejects.toThrow(
      SHELF_STATE_INVALID,
    );
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('deduplicates concurrent and retried replacements from the same source unit', async () => {
    const previous = await addProduct({ name: 'Barrier cream', addedVia: 'manual' });
    const opening = { isOpened: false, openedAt: null } as const;

    const [first, retry, competing] = await Promise.all([
      reAddProduct(previous.id, opening, operationId(10)),
      reAddProduct(previous.id, opening, operationId(10)),
      reAddProduct(previous.id, opening, operationId(11)),
    ]);
    const shelf = await loadShelf();

    expect(first?.id).toBe(operationId(10));
    expect(retry?.id).toBe(operationId(10));
    expect(competing?.id).toBe(operationId(10));
    expect(shelf.filter((product) => product.status === 'active')).toHaveLength(1);
    expect(shelf).toHaveLength(2);
  });

  it('requires later repurchases to replace the newest unit rather than an ancestor', async () => {
    const original = await addProduct({ name: 'Cleanser', addedVia: 'manual' });
    const first = await reAddProduct(
      original.id,
      { isOpened: false, openedAt: null },
      operationId(20),
    );
    expect(first).not.toBeNull();
    await updateProduct(first!.id, { status: 'finished', finishedAt: '2026-07-01' });
    const latest = await reAddProduct(
      first!.id,
      { isOpened: true, openedAt: '2026-07-01' },
      operationId(21),
    );

    await expect(
      reAddProduct(original.id, { isOpened: false, openedAt: null }, operationId(22)),
    ).resolves.toMatchObject({ id: latest!.id, repurchaseCount: 3 });
    expect((await loadShelf()).filter((product) => product.status === 'active')).toHaveLength(1);
  });

  it('keeps ancestor retry protection after the successor identity is edited', async () => {
    const original = await addProduct({ name: 'Handwritten cream', addedVia: 'manual' });
    const successor = await reAddProduct(
      original.id,
      { isOpened: false, openedAt: null },
      operationId(30),
    );
    await updateProduct(successor!.id, {
      name: 'Reviewed Barrier Cream',
      brand: 'Catalog Brand',
      catalogProductId: operationId(300),
    });

    const retry = await reAddProduct(
      original.id,
      { isOpened: false, openedAt: null },
      operationId(31),
    );

    expect(retry?.id).toBe(successor!.id);
    expect((await loadShelf()).filter((product) => product.status === 'active')).toHaveLength(1);
  });

  it('rejects a direct update that blanks product identity without changing bytes', async () => {
    const product = await addProduct({
      name: 'Mineral SPF 50',
      category: 'spf',
      addedVia: 'manual',
    });
    const original = mocks.storage.get(KEY);

    await expect(updateProduct(product.id, { name: '' })).rejects.toThrow(SHELF_STATE_INVALID);
    expect(mocks.storage.get(KEY)).toBe(original);
    await expect(loadShelf()).resolves.toMatchObject([{ name: 'Mineral SPF 50' }]);
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
      version: 3,
      products: [{ id: 'retinol', brand: 'Example', ingredients: ['retinol'] }],
    });
  });

  it('quarantines catalog dates from the oldest array shape without rewriting before success', async () => {
    const original = JSON.stringify([
      {
        id: 'legacy-array-catalog',
        name: 'Old catalog serum',
        addedVia: 'search',
        catalogProductId: operationId(620),
        expiryDate: '2027-06-01',
      },
    ]);
    mocks.storage.set(KEY, original);

    await expect(loadShelf()).resolves.toMatchObject([
      {
        id: 'legacy-array-catalog',
        expiryDate: null,
        expirySource: 'unknown',
        legacyUnverifiedExpiryDate: '2027-06-01',
      },
    ]);
    expect(mocks.storage.get(KEY)).toBe(original);

    mocks.updateFailure = new Error('storage unavailable');
    await expect(updateProduct('legacy-array-catalog', { brand: 'Not committed' })).rejects.toThrow(
      'storage unavailable',
    );
    expect(mocks.storage.get(KEY)).toBe(original);

    mocks.updateFailure = null;
    await expect(
      updateProduct('legacy-array-catalog', { brand: 'Migrated' }),
    ).resolves.toMatchObject({
      brand: 'Migrated',
      expiryDate: null,
      expirySource: 'unknown',
      legacyUnverifiedExpiryDate: '2027-06-01',
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({ version: 3 });
  });

  it('normalizes a mixed canonical v1 envelope in memory and upgrades on mutation', async () => {
    const unopened = await addProduct({
      name: 'Unopened cleanser',
      addedVia: 'manual',
      isOpened: false,
      paoMonths: 12,
      paoSource: 'label',
    });
    const categoryEstimate = await addProduct({
      name: 'Category serum',
      category: 'serum',
      addedVia: 'search',
      catalogProductId: operationId(501),
      catalogSourceId: operationId(502),
      catalogSource: 'routinekind_reviewed',
      catalogMatchQuality: 'usable',
      sourceDisclosureAckAt: '2026-07-18T12:00:00.000Z',
      isOpened: true,
      openedAt: '2026-07-01',
      paoMonths: 9,
      paoSource: 'category_default',
    });
    const sunscreen = await addProduct({
      name: 'Legacy sunscreen',
      category: 'spf',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-07-01',
      paoMonths: 12,
      paoSource: 'label',
    });
    const printed = await addProduct({
      name: 'Printed package',
      addedVia: 'manual',
      isOpened: false,
      expiryDate: '2027-06-01',
    });
    const v1Products = [
      { ...v1Product(unopened), expirySource: 'estimated' },
      {
        ...v1Product(categoryEstimate),
        paoMonths: 9,
        paoSource: 'category_default' as const,
        expirySource: 'pao_computed' as const,
      },
      {
        ...v1Product(sunscreen),
        paoMonths: 12,
        paoSource: 'category_default',
        expirySource: 'pao_computed',
      },
      v1Product(printed),
    ];
    const original = JSON.stringify({ version: 1, products: v1Products });
    mocks.storage.set(KEY, original);

    await expect(loadShelf()).resolves.toMatchObject([
      { id: unopened.id, expirySource: 'unknown' },
      {
        id: categoryEstimate.id,
        paoMonths: null,
        paoSource: 'unknown',
        expirySource: 'unknown',
      },
      {
        id: sunscreen.id,
        paoMonths: null,
        paoSource: 'unknown',
        expirySource: 'unknown',
      },
      { id: printed.id, expirySource: 'printed', expiryDate: '2027-06-01' },
    ]);
    expect(mocks.storage.get(KEY)).toBe(original);

    await updateProduct(categoryEstimate.id, { brand: 'Still present' });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 3,
      products: [
        { id: unopened.id, expirySource: 'unknown' },
        {
          id: categoryEstimate.id,
          brand: 'Still present',
          paoMonths: null,
          paoSource: 'unknown',
          expirySource: 'unknown',
        },
        { id: sunscreen.id, expirySource: 'unknown' },
        { id: printed.id, expirySource: 'printed' },
      ],
    });
    await expect(loadShelf()).resolves.toHaveLength(4);
  });

  it('infers an unambiguous v1 replacement lineage before an archived-source retry', async () => {
    const original = await addProduct({ name: 'Legacy cleanser', addedVia: 'manual' });
    const successor = await reAddProduct(
      original.id,
      { isOpened: false, openedAt: null },
      operationId(40),
    );
    const history = (await loadShelf()).map(v1Product);
    const v1Bytes = JSON.stringify({ version: 1, products: history });
    mocks.storage.set(KEY, v1Bytes);

    const loaded = await loadShelf();
    expect(mocks.storage.get(KEY)).toBe(v1Bytes);
    expect(loaded.find((product) => product.id === successor!.id)).toMatchObject({
      replacementRootId: original.id,
      replacesProductId: original.id,
      replacementLineageAmbiguous: false,
    });

    await expect(
      reAddProduct(original.id, { isOpened: false, openedAt: null }, operationId(41)),
    ).resolves.toMatchObject({ id: successor!.id });
    expect((await loadShelf()).filter((product) => product.status === 'active')).toHaveLength(1);
  });

  it('keeps a v1 replacement chain joined after the successor gains catalog identity', async () => {
    const original = await addProduct({ name: 'Handwritten legacy cream', addedVia: 'manual' });
    const successor = await reAddProduct(
      original.id,
      { isOpened: false, openedAt: null },
      operationId(42),
    );
    const enriched = await applyCatalogRecoveryProductUpdate(
      catalogRecoveryInput(successor!.id, successor!.updatedAt, true),
    );
    expect(enriched.status).toBe('updated');

    const v1Bytes = JSON.stringify({
      version: 1,
      products: (await loadShelf()).map(v1Product),
    });
    mocks.storage.set(KEY, v1Bytes);

    const loaded = await loadShelf();
    expect(mocks.storage.get(KEY)).toBe(v1Bytes);
    expect(loaded.find((product) => product.id === successor!.id)).toMatchObject({
      replacementRootId: original.id,
      replacesProductId: original.id,
      replacementLineageAmbiguous: false,
    });
    await expect(
      reAddProduct(original.id, { isOpened: false, openedAt: null }, operationId(43)),
    ).resolves.toMatchObject({ id: successor!.id });
    expect((await loadShelf()).filter((product) => product.status === 'active')).toHaveLength(1);
  });

  it('conservatively groups ambiguous v1 identity collisions without duplicating an active unit', async () => {
    const archived = await addProduct({ name: 'Same cleanser', addedVia: 'manual' });
    const active = await addProduct({ name: 'Same cleanser', addedVia: 'manual' });
    await updateProduct(archived.id, { status: 'finished', finishedAt: '2026-07-10' });
    const v1Bytes = JSON.stringify({
      version: 1,
      products: (await loadShelf()).map(v1Product),
    });
    mocks.storage.set(KEY, v1Bytes);

    const loaded = await loadShelf();
    expect(loaded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: archived.id,
          replacementLineageAmbiguous: true,
          replacesProductId: null,
        }),
        expect.objectContaining({
          id: active.id,
          replacementLineageAmbiguous: true,
          replacesProductId: null,
        }),
      ]),
    );
    await expect(
      reAddProduct(archived.id, { isOpened: false, openedAt: null }, operationId(44)),
    ).resolves.toMatchObject({ id: active.id });
    expect(mocks.storage.get(KEY)).toBe(v1Bytes);
    expect((await loadShelf()).filter((product) => product.status === 'active')).toHaveLength(1);
  });

  it('keeps canonical v1 opened dates stable across westward travel and mutation outcomes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
    const product = await addProduct({
      name: 'Legacy travel serum',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-07-19',
      paoMonths: 6,
      paoSource: 'label',
    });
    const historical = {
      ...v1Product(product),
      ...normalizeShelfFreshnessV1(
        { ...product, isOpened: true, openedAt: '2026-07-20' },
        '2026-07-20',
      ),
    };
    const v1Bytes = JSON.stringify({ version: 1, products: [historical] });
    mocks.storage.set(KEY, v1Bytes);

    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
    await expect(loadShelf()).resolves.toMatchObject([
      { id: product.id, isOpened: true, openedAt: '2026-07-20' },
    ]);
    expect(mocks.storage.get(KEY)).toBe(v1Bytes);

    mocks.updateFailure = new Error('storage unavailable');
    await expect(updateProduct(product.id, { brand: 'Not committed' })).rejects.toThrow(
      'storage unavailable',
    );
    expect(mocks.storage.get(KEY)).toBe(v1Bytes);

    mocks.updateFailure = null;
    await expect(updateProduct(product.id, { brand: 'Preserved' })).resolves.toMatchObject({
      brand: 'Preserved',
      isOpened: true,
      openedAt: '2026-07-20',
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({ version: 3 });
  });

  it('authenticates historically unbounded v1 PAO before upgrading it fail-closed', async () => {
    const product = await addProduct({
      name: 'Legacy long PAO',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-07-01',
      paoMonths: 12,
      paoSource: 'label',
    });
    const historical = {
      ...v1Product(product),
      ...normalizeShelfFreshnessV1({ ...product, paoMonths: 121 }, '2026-07-19'),
    };
    const v1Bytes = JSON.stringify({ version: 1, products: [historical] });
    mocks.storage.set(KEY, v1Bytes);

    await expect(loadShelf()).resolves.toMatchObject([
      { id: product.id, paoMonths: null, paoSource: 'unknown', expirySource: 'unknown' },
    ]);
    expect(mocks.storage.get(KEY)).toBe(v1Bytes);

    await expect(updateProduct(product.id, { brand: 'Upgraded safely' })).resolves.toMatchObject({
      brand: 'Upgraded safely',
      paoMonths: null,
      paoSource: 'unknown',
      expirySource: 'unknown',
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 3,
      products: [
        { id: product.id, paoMonths: null, paoSource: 'unknown', expirySource: 'unknown' },
      ],
    });
  });

  it('quarantines a catalog-linked v1 package date until the user reconfirms it', async () => {
    const product = await addProduct({
      name: 'Legacy catalog serum',
      addedVia: 'search',
      catalogProductId: operationId(610),
      catalogSourceId: operationId(611),
      catalogSource: 'routinekind_reviewed',
      catalogMatchQuality: 'usable',
      sourceDisclosureAckAt: '2026-07-18T12:00:00.000Z',
      isOpened: true,
      openedAt: '2026-01-01',
      paoMonths: 36,
      paoSource: 'catalog',
      expiryDate: '2027-01-01',
    });
    const v1Bytes = JSON.stringify({ version: 1, products: [v1Product(product)] });
    mocks.storage.set(KEY, v1Bytes);

    await expect(loadShelf()).resolves.toMatchObject([
      {
        id: product.id,
        expiryDate: null,
        expirySource: 'pao_computed',
        legacyUnverifiedExpiryDate: '2027-01-01',
      },
    ]);
    expect(mocks.storage.get(KEY)).toBe(v1Bytes);

    mocks.updateFailure = new Error('storage unavailable');
    await expect(updateProduct(product.id, { brand: 'Not committed' })).rejects.toThrow(
      'storage unavailable',
    );
    expect(mocks.storage.get(KEY)).toBe(v1Bytes);

    mocks.updateFailure = null;
    await expect(updateProduct(product.id, { brand: 'Migrated' })).resolves.toMatchObject({
      brand: 'Migrated',
      expiryDate: null,
      expirySource: 'pao_computed',
      legacyUnverifiedExpiryDate: '2027-01-01',
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({ version: 3 });

    await expect(updateProduct(product.id, { expiryDate: '2028-01-01' })).resolves.toMatchObject({
      expiryDate: '2028-01-01',
      expirySource: 'printed',
      legacyUnverifiedExpiryDate: null,
    });
  });

  it('keeps canonical v1 bytes when the first real mutation write fails', async () => {
    const product = await addProduct({
      name: 'Unopened package',
      addedVia: 'manual',
      isOpened: false,
    });
    const original = JSON.stringify({
      version: 1,
      products: [{ ...v1Product(product), expirySource: 'estimated' }],
    });
    mocks.storage.set(KEY, original);
    await expect(loadShelf()).resolves.toMatchObject([{ id: product.id, expirySource: 'unknown' }]);
    expect(mocks.storage.get(KEY)).toBe(original);

    mocks.updateFailure = new Error('storage unavailable');
    await expect(updateProduct(product.id, { brand: 'Not committed' })).rejects.toThrow(
      'storage unavailable',
    );
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves and rejects a noncanonical v1 envelope', async () => {
    const product = await addProduct({
      name: 'Unopened package',
      addedVia: 'manual',
      isOpened: false,
    });
    const original = JSON.stringify({
      version: 1,
      products: [{ ...v1Product(product), expirySource: 'unknown' }],
    });
    mocks.storage.set(KEY, original);

    await expect(loadShelf()).resolves.toEqual([]);
    await expect(addProduct({ name: 'Must not overwrite', addedVia: 'manual' })).rejects.toThrow(
      SHELF_STATE_INVALID,
    );
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('rejects noncanonical raw serialization for every versioned envelope', async () => {
    const product = await addProduct({ name: 'Canonical cleanser', addedVia: 'manual' });
    const canonicalV3 = mocks.storage.get(KEY)!;
    const parsedV3 = JSON.parse(canonicalV3) as {
      version: 3;
      products: ShelfProduct[];
      mirrorOutbox: unknown[];
      terminal: unknown[];
    };
    const canonicalV2 = JSON.stringify({ version: 2, products: parsedV3.products });
    const parsedV2 = JSON.parse(canonicalV2) as { version: 2; products: ShelfProduct[] };
    const canonicalV1 = JSON.stringify({ version: 1, products: [v1Product(product)] });
    const parsedV1 = JSON.parse(canonicalV1) as {
      version: 1;
      products: ReturnType<typeof v1Product>[];
    };
    const noncanonical = [
      JSON.stringify(parsedV1, null, 2),
      JSON.stringify({ products: parsedV1.products, version: 1 }),
      canonicalV1.replace('{"version":1,', '{"version":1,"version":1,'),
      JSON.stringify(parsedV2, null, 2),
      JSON.stringify({ products: parsedV2.products, version: 2 }),
      canonicalV2.replace('{"version":2,', '{"version":2,"version":2,'),
      JSON.stringify(parsedV3, null, 2),
      JSON.stringify({
        terminal: parsedV3.terminal,
        mirrorOutbox: parsedV3.mirrorOutbox,
        products: parsedV3.products,
        version: 3,
      }),
      canonicalV3.replace('{"version":3,', '{"version":3,"version":3,'),
    ];

    for (const raw of noncanonical) {
      mocks.storage.set(KEY, raw);
      await expect(loadShelf()).resolves.toEqual([]);
      await expect(updateProduct(product.id, { brand: 'Must not write' })).rejects.toThrow(
        SHELF_STATE_INVALID,
      );
      expect(mocks.storage.get(KEY)).toBe(raw);
    }
  });

  it('preserves future-version shelf bytes and refuses every mutation', async () => {
    const original = JSON.stringify({ version: 4, products: [] });
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

  it('atomically stores a complete owner-free upsert with stable IDs and timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T18:30:00.123Z'));
    const productId = operationId(700);

    const product = await addProduct({
      operationId: productId,
      name: 'Offline cleanser',
      brand: 'Example',
      barcode: '0123456789012',
      addedVia: 'manual',
      isOpened: true,
      openedAt: '2026-07-26',
      paoMonths: 12,
      paoSource: 'label',
    });

    expect(product.id).toBe(productId);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({ version: 3 });
    const pending = await getPendingShelfMirrorOperations();
    expect(pending).toEqual([
      {
        operationId: '10000000-0000-4000-8000-000000000001',
        enqueuedAt: '2026-07-26T18:30:00.123Z',
        kind: 'upsert',
        payload: {
          id: productId,
          catalog_product_id: null,
          catalog_source_id: null,
          catalog_match_quality: 'manual',
          catalog_source_snapshot_date: null,
          manual_name: 'Offline cleanser',
          manual_brand: 'Example',
          barcode: '0123456789012',
          opened_at: '2026-07-26',
          pao_months: 12,
          expiry_date: null,
          is_opened: true,
          pao_source: 'label',
          expiry_source: 'pao_computed',
          added_via: 'manual',
          source_disclosure_ack_at: null,
          status: 'active',
          finished_at: null,
        },
      },
    ]);
    expect(mocks.storage.get(KEY)).not.toContain('user-a');
    expect(mocks.storage.get(KEY)).not.toContain('user_id');
  });

  it('bounds mirror identity text and barcode fields before any local commit', async () => {
    expect(SHELF_PRODUCT_NAME_MAX_LENGTH).toBe(120);
    expect(SHELF_PRODUCT_BRAND_MAX_LENGTH).toBe(120);
    expect(SHELF_PRODUCT_TEXT_MAX_BYTES).toBe(512);
    for (const input of [
      { name: ' leading', addedVia: 'manual' as const },
      { name: 'trailing ', addedVia: 'manual' as const },
      { name: 'control\u0000name', addedVia: 'manual' as const },
      { name: 'n'.repeat(121), addedVia: 'manual' as const },
      { name: '😀'.repeat(61), addedVia: 'manual' as const },
      { name: 'Valid', brand: ' brand', addedVia: 'manual' as const },
      { name: 'Valid', brand: 'b'.repeat(121), addedVia: 'manual' as const },
      { name: 'Valid', barcode: '123456789', addedVia: 'manual' as const },
      { name: 'Valid', barcode: '1234 5678', addedVia: 'manual' as const },
    ]) {
      await expect(addProduct(input)).rejects.toThrow(SHELF_STATE_INVALID);
      expect(mocks.storage.has(KEY)).toBe(false);
    }

    await expect(
      addProduct({
        name: 'n'.repeat(120),
        brand: 'b'.repeat(120),
        barcode: '12345678',
        addedVia: 'manual',
      }),
    ).resolves.toMatchObject({
      name: 'n'.repeat(120),
      brand: 'b'.repeat(120),
      barcode: '12345678',
    });
  });

  it('rejects invalid identity edits and noncanonical mirror payload bytes without data loss', async () => {
    const product = await addProduct({
      operationId: operationId(705),
      name: 'Canonical identity',
      brand: 'Canonical brand',
      barcode: '123456789012',
      addedVia: 'manual',
    });
    const canonical = mocks.storage.get(KEY)!;

    for (const patch of [
      { name: ' edited' },
      { name: 'x'.repeat(121) },
      { brand: 'bad\nbrand' },
      { brand: '' },
      { barcode: 'not-a-barcode' },
    ]) {
      await expect(updateProduct(product.id, patch)).rejects.toThrow(SHELF_STATE_INVALID);
      expect(mocks.storage.get(KEY)).toBe(canonical);
    }

    for (const payloadPatch of [
      { manual_name: ' untrimmed' },
      { manual_name: 'x'.repeat(121) },
      { manual_brand: 'bad\u007fbrand' },
      { barcode: '123456789' },
    ]) {
      const parsed = JSON.parse(canonical) as {
        mirrorOutbox: { payload: Record<string, unknown> }[];
      };
      Object.assign(parsed.mirrorOutbox[0]!.payload, payloadPatch);
      const malformed = JSON.stringify(parsed);
      mocks.storage.set(KEY, malformed);
      await expect(getPendingShelfMirrorOperations()).rejects.toThrow(SHELF_STATE_INVALID);
      expect(mocks.storage.get(KEY)).toBe(malformed);
    }
  });

  it('keeps mutation replay FIFO and only acknowledges the exact head', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T19:00:00.000Z'));
    const notifications: number[] = [];
    const unsubscribe = subscribeShelfMirrorOutboxChanges(() => {
      notifications.push(storedMirrorOutbox().length);
    });
    const product = await addProduct({
      operationId: operationId(710),
      name: 'FIFO serum',
      addedVia: 'manual',
    });
    vi.setSystemTime(new Date('2026-07-26T19:01:00.000Z'));
    await updateProduct(product.id, {
      status: 'finished',
      finishedAt: '2026-07-26',
    });
    vi.setSystemTime(new Date('2026-07-26T19:02:00.000Z'));
    await removeProduct(product.id);

    const pending = await getPendingShelfMirrorOperations();
    expect(pending.map((operation) => operation.kind)).toEqual(['upsert', 'upsert', 'delete']);
    expect(pending.map((operation) => operation.enqueuedAt)).toEqual([
      '2026-07-26T19:00:00.000Z',
      '2026-07-26T19:01:00.000Z',
      '2026-07-26T19:02:00.000Z',
    ]);
    expect(
      pending.map((operation) =>
        operation.kind === 'delete' ? operation.productId : operation.payload.id,
      ),
    ).toEqual([product.id, product.id, product.id]);

    const bytesBeforeOutOfOrderAck = mocks.storage.get(KEY);
    await expect(acknowledgeShelfMirrorOperation(pending[1]!.operationId)).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(bytesBeforeOutOfOrderAck);

    await expect(acknowledgeShelfMirrorOperation(pending[0]!.operationId)).resolves.toBe(true);
    await expect(getPendingShelfMirrorOperations()).resolves.toEqual(pending.slice(1));
    unsubscribe();
    await acknowledgeShelfMirrorOperation(pending[1]!.operationId);
    expect(notifications).toEqual([1, 2, 3, 2]);
  });

  it('atomically quarantines only a terminal FIFO head and preserves its complete operation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T19:30:00.000Z'));
    const first = await addProduct({
      operationId: operationId(712),
      name: 'Terminal serum',
      brand: 'Exact bytes',
      addedVia: 'manual',
    });
    await addProduct({
      operationId: operationId(713),
      name: 'Later cleanser',
      addedVia: 'manual',
    });
    const pending = await getPendingShelfMirrorOperations();
    const exactOperationBytes = JSON.stringify(pending[0]);
    const bytesBeforeOutOfOrderReject = mocks.storage.get(KEY);

    await expect(
      rejectShelfMirrorOperation(pending[1]!.operationId, 'SHELF_PRODUCT_PAYLOAD_INVALID'),
    ).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(bytesBeforeOutOfOrderReject);

    await expect(
      rejectShelfMirrorOperation(pending[0]!.operationId, 'SHELF_PRODUCT_PAYLOAD_INVALID'),
    ).resolves.toBe(true);
    expect(await getPendingShelfMirrorOperations()).toEqual(pending.slice(1));
    expect(storedMirrorTerminal()).toEqual([
      {
        operation: pending[0],
        code: 'SHELF_PRODUCT_PAYLOAD_INVALID',
      },
    ]);
    expect(JSON.stringify(storedMirrorTerminal()[0]!.operation)).toBe(exactOperationBytes);
    expect(storedMirrorTerminal()[0]!.operation).toMatchObject({
      kind: 'upsert',
      payload: { id: first.id, manual_brand: 'Exact bytes' },
    });
  });

  it('exposes an unresolved terminal product only while no corrective Shelf work is pending', async () => {
    const product = await addProduct({
      operationId: operationId(714),
      name: 'Never mirrored serum',
      addedVia: 'manual',
    });
    const [upsert] = await getPendingShelfMirrorOperations();
    await expect(
      rejectShelfMirrorOperation(upsert!.operationId, 'SHELF_PRODUCT_PROVENANCE_INVALID'),
    ).resolves.toBe(true);
    await expect(hasUnresolvedTerminalShelfMirrorOperationForProduct(product.id)).resolves.toBe(
      true,
    );
    await updateProduct(product.id, { brand: 'Corrective edit' });
    await expect(hasUnresolvedTerminalShelfMirrorOperationForProduct(product.id)).resolves.toBe(
      false,
    );
  });

  it('fails closed for unknown terminal codes, duplicate lane IDs, and malformed quarantine bytes', async () => {
    await addProduct({
      operationId: operationId(714),
      name: 'Strict terminal serum',
      addedVia: 'manual',
    });
    const [head] = await getPendingShelfMirrorOperations();
    const canonical = mocks.storage.get(KEY)!;

    await expect(
      rejectShelfMirrorOperation(head!.operationId, 'SHELF_NEW_UNKNOWN_CODE' as never),
    ).rejects.toThrow(SHELF_STATE_INVALID);
    expect(mocks.storage.get(KEY)).toBe(canonical);

    const parsed = JSON.parse(canonical) as {
      terminal: unknown[];
      mirrorOutbox: ShelfMirrorOperation[];
    };
    for (const terminal of [
      [{ operation: parsed.mirrorOutbox[0], code: 'SHELF_PRODUCT_PAYLOAD_INVALID' }],
      [{ operation: parsed.mirrorOutbox[0], code: 'SHELF_NEW_UNKNOWN_CODE' }],
      [{ code: 'SHELF_PRODUCT_PAYLOAD_INVALID' }],
    ]) {
      const malformed = JSON.stringify({ ...parsed, terminal });
      mocks.storage.set(KEY, malformed);
      await expect(loadShelf()).resolves.toEqual([]);
      await expect(getPendingShelfMirrorOperations()).rejects.toThrow(SHELF_STATE_INVALID);
      expect(mocks.storage.get(KEY)).toBe(malformed);
    }
  });

  it('records replenishment archive and replacement upserts in the same private commit', async () => {
    const product = await addProduct({
      operationId: operationId(720),
      name: 'Replacement cream',
      addedVia: 'manual',
    });
    const [initial] = await getPendingShelfMirrorOperations();
    await acknowledgeShelfMirrorOperation(initial!.operationId);
    const before = mocks.storage.get(KEY);

    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');
    await expect(
      reAddProduct(product.id, { isOpened: false, openedAt: null }, operationId(721)),
    ).rejects.toThrow('PRIVATE_WRITE_FAILED');
    expect(mocks.storage.get(KEY)).toBe(before);

    mocks.updateFailure = null;
    await expect(
      reAddProduct(product.id, { isOpened: false, openedAt: null }, operationId(721)),
    ).resolves.toMatchObject({ id: operationId(721), status: 'active' });

    const pending = await getPendingShelfMirrorOperations();
    expect(pending).toHaveLength(2);
    expect(pending).toEqual([
      expect.objectContaining({
        kind: 'upsert',
        payload: expect.objectContaining({ id: product.id, status: 'finished' }),
      }),
      expect.objectContaining({
        kind: 'upsert',
        payload: expect.objectContaining({ id: operationId(721), status: 'active' }),
      }),
    ]);
  });

  it('migrates canonical v2 rows to safe upserts without inventing deletes or an owner', async () => {
    const first = await addProduct({
      operationId: operationId(730),
      name: 'Migrated cleanser',
      addedVia: 'manual',
    });
    const second = await addProduct({
      operationId: operationId(731),
      name: 'Migrated sunscreen',
      addedVia: 'manual',
    });
    const products = [...storedProducts()];
    const v2Bytes = JSON.stringify({ version: 2, products });
    mocks.storage.set(KEY, v2Bytes);

    const pending = await getPendingShelfMirrorOperations();

    expect(pending).toHaveLength(2);
    expect(pending.every((operation) => operation.kind === 'upsert')).toBe(true);
    expect(
      pending.map((operation) => (operation.kind === 'upsert' ? operation.payload.id : '')),
    ).toEqual([second.id, first.id]);
    expect(mocks.storage.get(KEY)).not.toBe(v2Bytes);
    expect(mocks.storage.get(KEY)).not.toContain('user-a');
    expect(mocks.storage.get(KEY)).not.toContain('user_id');
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 3,
      products,
    });
  });

  it('keeps mirror-incompatible v2 rows visible and queues them only after deterministic repair', async () => {
    const product = await addProduct({
      operationId: operationId(735),
      name: 'Legacy repair product',
      addedVia: 'manual',
    });
    const legacyProduct = {
      ...storedProducts()[0]!,
      name: 'n'.repeat(140),
      barcode: 'legacy-barcode',
    };
    const v2Bytes = JSON.stringify({ version: 2, products: [legacyProduct] });
    mocks.storage.set(KEY, v2Bytes);

    await expect(loadShelf()).resolves.toMatchObject([
      { id: product.id, name: 'n'.repeat(140), barcode: 'legacy-barcode' },
    ]);
    await expect(getShelfMirrorIncompatibilities()).resolves.toEqual([
      {
        productId: product.id,
        codes: ['SHELF_MIRROR_NAME_REPAIR_REQUIRED', 'SHELF_MIRROR_BARCODE_REPAIR_REQUIRED'],
      },
    ]);
    await expect(getPendingShelfMirrorOperations()).resolves.toEqual([]);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 3,
      mirrorIncompatibilities: [
        {
          productId: product.id,
          codes: ['SHELF_MIRROR_NAME_REPAIR_REQUIRED', 'SHELF_MIRROR_BARCODE_REPAIR_REQUIRED'],
        },
      ],
    });

    await expect(
      updateProduct(product.id, { name: 'Repaired product', barcode: null }),
    ).resolves.toMatchObject({ name: 'Repaired product', barcode: null });
    await expect(getShelfMirrorIncompatibilities()).resolves.toEqual([]);
    await expect(getPendingShelfMirrorOperations()).resolves.toHaveLength(1);
  });

  it('keeps a legacy non-v4 product visible but never emits an invalid mirror operation', async () => {
    const product = await addProduct({
      operationId: operationId(736),
      name: 'Legacy identity product',
      addedVia: 'manual',
    });
    const legacyId = '11111111-1111-1111-8111-111111111111';
    const legacyProduct = {
      ...storedProducts()[0]!,
      id: legacyId,
      replacementRootId: legacyId,
    };
    mocks.storage.set(KEY, JSON.stringify({ version: 2, products: [legacyProduct] }));

    await expect(loadShelf()).resolves.toMatchObject([{ id: legacyId }]);
    await expect(getShelfMirrorIncompatibilities()).resolves.toEqual([
      {
        productId: legacyId,
        codes: ['SHELF_MIRROR_PRODUCT_ID_REPAIR_REQUIRED'],
      },
    ]);
    await expect(getPendingShelfMirrorOperations()).resolves.toEqual([]);
    await expect(
      addProduct({
        operationId: legacyId,
        name: product.name,
        addedVia: 'manual',
      }),
    ).rejects.toThrow(SHELF_STATE_INVALID);
  });

  it('does not infer mirror work from pre-v2 history', async () => {
    const product = await addProduct({
      operationId: operationId(740),
      name: 'Historical cleanser',
      addedVia: 'manual',
    });
    const v1Bytes = JSON.stringify({ version: 1, products: [v1Product(product)] });
    mocks.storage.set(KEY, v1Bytes);

    await expect(getPendingShelfMirrorOperations()).resolves.toEqual([]);
    expect(mocks.storage.get(KEY)).toBe(v1Bytes);
  });

  it('fails the pending API closed for noncanonical outbox bytes', async () => {
    await addProduct({
      operationId: operationId(750),
      name: 'Strict cleanser',
      addedVia: 'manual',
    });
    const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
      mirrorOutbox: Record<string, unknown>[];
    };
    parsed.mirrorOutbox[0]!.ownerUserId = 'user-a';
    const malformed = JSON.stringify(parsed);
    mocks.storage.set(KEY, malformed);

    await expect(loadShelf()).resolves.toEqual([]);
    await expect(getPendingShelfMirrorOperations()).rejects.toThrow(SHELF_STATE_INVALID);
    await expect(updateProduct(operationId(750), { brand: 'Must not overwrite' })).rejects.toThrow(
      SHELF_STATE_INVALID,
    );
    expect(mocks.storage.get(KEY)).toBe(malformed);
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
