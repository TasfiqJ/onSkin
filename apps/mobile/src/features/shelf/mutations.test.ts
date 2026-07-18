import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import { resetShelfMutationStateForTests, useShelfMutations } from './mutations';
import type { NewShelfProduct, ShelfProduct } from './store';

const mocks = vi.hoisted(() => ({
  acknowledgeProductAdd: vi.fn(),
  addProduct: vi.fn(),
  invalidateQueries: vi.fn(),
  ownerScope: { generation: 0 },
  reAddProduct: vi.fn(),
  removeProduct: vi.fn(),
  resetQueries: vi.fn(),
  scheduleOutboxFlush: vi.fn(),
  track: vi.fn(),
  updateProduct: vi.fn(),
  user: { id: 'owner-a' } as { id: string } | null,
}));

vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/lib/offline/outbox', () => ({ scheduleOutboxFlush: mocks.scheduleOutboxFlush }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    resetQueries: mocks.resetQueries,
  }),
}));
vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => mocks.ownerScope,
}));
vi.mock('./store', () => ({
  acknowledgeProductAdd: mocks.acknowledgeProductAdd,
  addProduct: mocks.addProduct,
  reAddProduct: mocks.reAddProduct,
  removeProduct: mocks.removeProduct,
  updateProduct: mocks.updateProduct,
}));

let boundaryActive = false;

const PRODUCT: ShelfProduct = {
  id: '00000000-0000-4000-8000-000000000101',
  name: 'Owner A cleanser',
  brand: 'Example',
  category: 'cleanser',
  barcode: null,
  catalogProductId: null,
  catalogSourceId: null,
  catalogSource: null,
  catalogSourceName: null,
  catalogSourceRef: null,
  catalogSourceUrl: null,
  catalogSourceSnapshotDate: null,
  catalogMatchQuality: 'manual',
  dataQualityScore: null,
  ingredientParseStatus: null,
  ingredientParseConfidence: null,
  parserVersion: null,
  sourceDisclosureAckAt: null,
  ingredients: [],
  openedAt: null,
  isOpened: false,
  paoMonths: null,
  paoSource: 'unknown',
  expiryDate: null,
  expirySource: 'unknown',
  status: 'active',
  finishedAt: null,
  addedVia: 'manual',
  repurchaseCount: 0,
  thumbnailPath: null,
  createdAt: '2026-07-13T12:00:00.000Z',
  updatedAt: '2026-07-13T12:00:00.000Z',
};

const NEW_PRODUCT: NewShelfProduct = {
  name: PRODUCT.name,
  brand: PRODUCT.brand,
  category: PRODUCT.category,
  addedVia: 'manual',
};

afterEach(() => {
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('Shelf transactional outbox mutations', () => {
  beforeEach(() => {
    mocks.acknowledgeProductAdd.mockReset();
    mocks.addProduct.mockReset();
    mocks.invalidateQueries.mockReset();
    mocks.ownerScope = createOwnerQueryScope();
    mocks.reAddProduct.mockReset();
    mocks.removeProduct.mockReset();
    mocks.resetQueries.mockReset();
    mocks.scheduleOutboxFlush.mockReset();
    mocks.track.mockReset();
    mocks.updateProduct.mockReset();
    mocks.user = { id: 'owner-a' };
    mocks.addProduct.mockResolvedValue(PRODUCT);
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.reAddProduct.mockResolvedValue({
      fresh: PRODUCT,
      archived: { ...PRODUCT, status: 'finished' },
    });
    mocks.removeProduct.mockResolvedValue(PRODUCT);
    mocks.resetQueries.mockResolvedValue(undefined);
    mocks.updateProduct.mockResolvedValue(PRODUCT);
    resetShelfMutationStateForTests();
  });

  it('binds an add to the owner generation and schedules its durable outbox row', async () => {
    const actions = useShelfMutations();

    await actions.add(NEW_PRODUCT, 'owner-a-add-operation');

    expect(mocks.addProduct).toHaveBeenCalledWith(
      NEW_PRODUCT,
      expect.objectContaining({
        ownerId: 'owner-a',
        ownerGeneration: mocks.ownerScope.generation,
        operationId: 'owner-a-add-operation',
        assertCurrent: expect.any(Function),
      }),
    );
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledOnce();
  });

  it('acknowledges an add receipt in the owner generation without scheduling a sync', async () => {
    await useShelfMutations().acknowledgeAdd(PRODUCT.id);

    expect(mocks.acknowledgeProductAdd).toHaveBeenCalledWith(
      PRODUCT.id,
      expect.objectContaining({
        ownerId: 'owner-a',
        ownerGeneration: mocks.ownerScope.generation,
        assertCurrent: expect.any(Function),
      }),
    );
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
  });

  it('passes the captured owner to updates and schedules only persisted changes', async () => {
    const actions = useShelfMutations();

    await actions.edit(PRODUCT.id, { name: 'Updated cleanser' });
    mocks.updateProduct.mockResolvedValueOnce(null);
    await actions.edit('missing-product', { name: 'No row' });

    expect(mocks.updateProduct).toHaveBeenNthCalledWith(
      1,
      PRODUCT.id,
      { name: 'Updated cleanser' },
      expect.objectContaining({
        ownerId: 'owner-a',
        ownerGeneration: mocks.ownerScope.generation,
        assertCurrent: expect.any(Function),
      }),
    );
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledOnce();
  });

  it('passes the captured owner to deletes and schedules only persisted changes', async () => {
    const actions = useShelfMutations();

    await actions.remove(PRODUCT.id);
    mocks.removeProduct.mockResolvedValueOnce(null);
    await actions.remove('missing-product');

    expect(mocks.removeProduct).toHaveBeenNthCalledWith(
      1,
      PRODUCT.id,
      expect.objectContaining({
        ownerId: 'owner-a',
        ownerGeneration: mocks.ownerScope.generation,
        assertCurrent: expect.any(Function),
      }),
    );
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledOnce();
  });

  it('passes the captured owner to replacements and schedules the atomic pair', async () => {
    const replaced = await useShelfMutations().replace(PRODUCT.id);

    expect(replaced).toEqual(PRODUCT);
    expect(mocks.reAddProduct).toHaveBeenCalledWith(
      PRODUCT.id,
      expect.objectContaining({
        ownerId: 'owner-a',
        ownerGeneration: mocks.ownerScope.generation,
        assertCurrent: expect.any(Function),
      }),
    );
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledOnce();
  });

  it('stops a delayed add before analytics, scheduling, or cache publication', async () => {
    let releaseAdd!: (product: ShelfProduct) => void;
    let markAddStarted!: () => void;
    const addStarted = new Promise<void>((resolve) => {
      markAddStarted = resolve;
    });
    mocks.addProduct.mockImplementationOnce(() => {
      markAddStarted();
      return new Promise((resolve) => {
        releaseAdd = resolve;
      });
    });
    const adding = useShelfMutations().add(NEW_PRODUCT, 'boundary-add-operation');
    await addStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseAdd(PRODUCT);

    await expect(adding).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });

  it('stops a delayed edit before scheduling or cache publication', async () => {
    let releaseEdit!: (product: ShelfProduct) => void;
    let markEditStarted!: () => void;
    const editStarted = new Promise<void>((resolve) => {
      markEditStarted = resolve;
    });
    mocks.updateProduct.mockImplementationOnce(() => {
      markEditStarted();
      return new Promise((resolve) => {
        releaseEdit = resolve;
      });
    });
    const editing = useShelfMutations().edit(PRODUCT.id, { name: 'Owner A edit' });
    await editStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseEdit({ ...PRODUCT, name: 'Owner A edit' });

    await expect(editing).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });

  it('stops a delayed delete before scheduling or cache publication', async () => {
    let releaseDelete!: (product: ShelfProduct) => void;
    let markDeleteStarted!: () => void;
    const deleteStarted = new Promise<void>((resolve) => {
      markDeleteStarted = resolve;
    });
    mocks.removeProduct.mockImplementationOnce(() => {
      markDeleteStarted();
      return new Promise((resolve) => {
        releaseDelete = resolve;
      });
    });
    const deleting = useShelfMutations().remove(PRODUCT.id);
    await deleteStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseDelete(PRODUCT);

    await expect(deleting).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });

  it('shares one in-flight replacement across routes and revalidates later retries', async () => {
    const fresh = { ...PRODUCT, id: '00000000-0000-4000-8000-000000000202' };
    mocks.reAddProduct.mockResolvedValue({
      fresh,
      archived: { ...PRODUCT, status: 'finished' },
    });
    const firstRouteActions = useShelfMutations();
    const secondRouteActions = useShelfMutations();

    const [first, second] = await Promise.all([
      firstRouteActions.replace(PRODUCT.id),
      secondRouteActions.replace(PRODUCT.id),
    ]);
    const repeated = await useShelfMutations().replace(PRODUCT.id);

    expect(first).toEqual(fresh);
    expect(second).toEqual(fresh);
    expect(repeated).toEqual(fresh);
    expect(mocks.reAddProduct).toHaveBeenCalledTimes(2);
    expect(mocks.reAddProduct).toHaveBeenNthCalledWith(
      1,
      PRODUCT.id,
      expect.objectContaining({ ownerGeneration: mocks.ownerScope.generation }),
    );
    expect(mocks.reAddProduct).toHaveBeenNthCalledWith(
      2,
      PRODUCT.id,
      expect.objectContaining({ ownerGeneration: mocks.ownerScope.generation }),
    );
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledTimes(2);
    expect(mocks.track).toHaveBeenCalledTimes(2);
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it('resets the active Shelf query when strict local state is unreadable', async () => {
    const mutationError = new Error('SHELF_STATE_INVALID');
    mocks.updateProduct.mockRejectedValueOnce(mutationError);

    await expect(useShelfMutations().edit(PRODUCT.id, { name: 'Unsafe stale edit' })).rejects.toBe(
      mutationError,
    );

    expect(mocks.resetQueries).toHaveBeenCalledWith({
      queryKey: ['shelf', 'account-generation', mocks.ownerScope.generation],
    });
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
  });
});
