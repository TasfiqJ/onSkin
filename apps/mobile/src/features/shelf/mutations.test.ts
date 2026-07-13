import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  mirrorShelfDeleteForOwner,
  mirrorShelfUpsertForOwner,
  useShelfMutations,
} from './mutations';
import type { NewShelfProduct, ShelfProduct } from './store';

const mocks = vi.hoisted(() => {
  const upsertAbortSignal = vi.fn(async () => ({ error: null }));
  const deleteAbortSignal = vi.fn(async () => ({ error: null }));
  const upsert = vi.fn(() => ({ abortSignal: upsertAbortSignal }));
  const eqUser = vi.fn(() => ({ abortSignal: deleteAbortSignal }));
  const eqId = vi.fn(() => ({ eq: eqUser }));
  const remove = vi.fn(() => ({ eq: eqId }));
  return {
    addProduct: vi.fn(),
    devWarn: vi.fn(),
    deleteAbortSignal,
    eqId,
    eqUser,
    from: vi.fn(() => ({ delete: remove, upsert })),
    getUser: vi.fn(),
    invalidateQueries: vi.fn(),
    loadShelf: vi.fn(),
    ownerScope: { generation: 0 },
    reAddProduct: vi.fn(),
    remove,
    removeProduct: vi.fn(),
    track: vi.fn(),
    updateProduct: vi.fn(),
    upsert,
    upsertAbortSignal,
  };
});

vi.mock('@/lib/observability/safeLog', () => ({ devWarn: mocks.devWarn }));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => mocks.ownerScope,
}));
vi.mock('./store', () => ({
  addProduct: mocks.addProduct,
  loadShelf: mocks.loadShelf,
  reAddProduct: mocks.reAddProduct,
  removeProduct: mocks.removeProduct,
  updateProduct: mocks.updateProduct,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
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

describe('shelf owner-bound mirrors', () => {
  beforeEach(() => {
    mocks.addProduct.mockReset();
    mocks.devWarn.mockClear();
    mocks.deleteAbortSignal.mockClear();
    mocks.deleteAbortSignal.mockResolvedValue({ error: null });
    mocks.eqId.mockClear();
    mocks.eqUser.mockClear();
    mocks.from.mockClear();
    mocks.getUser.mockReset();
    mocks.invalidateQueries.mockReset();
    mocks.loadShelf.mockReset();
    mocks.ownerScope = createOwnerQueryScope();
    mocks.reAddProduct.mockReset();
    mocks.remove.mockClear();
    mocks.removeProduct.mockReset();
    mocks.track.mockReset();
    mocks.updateProduct.mockReset();
    mocks.upsert.mockClear();
    mocks.upsertAbortSignal.mockClear();
    mocks.upsertAbortSignal.mockResolvedValue({ error: null });
    mocks.addProduct.mockResolvedValue(PRODUCT);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-a' } },
      error: null,
    });
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.loadShelf.mockResolvedValue([PRODUCT]);
    mocks.reAddProduct.mockResolvedValue(PRODUCT);
    mocks.removeProduct.mockResolvedValue(undefined);
    mocks.updateProduct.mockResolvedValue(PRODUCT);
  });

  it('writes an explicit captured owner on a current-generation upsert', async () => {
    const ownerScope = createOwnerQueryScope();

    await mirrorShelfUpsertForOwner(ownerScope, PRODUCT);

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: PRODUCT.id, user_id: 'owner-a' }),
      { onConflict: 'id' },
    );
    expect(mocks.upsertAbortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('aborts the owner-scoped delete through the generation lease signal', async () => {
    await mirrorShelfDeleteForOwner(createOwnerQueryScope(), PRODUCT.id);

    expect(mocks.eqUser).toHaveBeenCalledWith('user_id', 'owner-a');
    expect(mocks.deleteAbortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('drops a delayed owner-A upsert before it can publish under owner B', async () => {
    let releaseUser!: (value: { data: { user: { id: string } }; error: null }) => void;
    const ownerLookup = new Promise<{
      data: { user: { id: string } };
      error: null;
    }>((resolve) => {
      releaseUser = resolve;
    });
    mocks.getUser.mockReturnValueOnce(ownerLookup);
    const ownerScope = createOwnerQueryScope();
    const mirror = mirrorShelfUpsertForOwner(ownerScope, PRODUCT);
    await vi.waitFor(() => expect(mocks.getUser).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseUser({ data: { user: { id: 'owner-a' } }, error: null });

    await expect(mirror).resolves.toBeUndefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('drops a delayed owner-A delete before any owner-B delete chain starts', async () => {
    let releaseUser!: (value: { data: { user: { id: string } }; error: null }) => void;
    const ownerLookup = new Promise<{
      data: { user: { id: string } };
      error: null;
    }>((resolve) => {
      releaseUser = resolve;
    });
    mocks.getUser.mockReturnValueOnce(ownerLookup);
    const ownerScope = createOwnerQueryScope();
    const mirror = mirrorShelfDeleteForOwner(ownerScope, PRODUCT.id);
    await vi.waitFor(() => expect(mocks.getUser).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseUser({ data: { user: { id: 'owner-a' } }, error: null });

    await expect(mirror).resolves.toBeUndefined();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('stops a delayed owner-A shelf add before analytics, mirror, or cache publication', async () => {
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
    const actions = useShelfMutations();

    const adding = actions.add(NEW_PRODUCT);
    await addStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseAdd(PRODUCT);

    await expect(adding).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });

  it('stops a delayed owner-A shelf edit before its mirror or cache publication', async () => {
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
    const actions = useShelfMutations();

    const editing = actions.edit(PRODUCT.id, { name: 'Owner A edited cleanser' });
    await editStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseEdit({ ...PRODUCT, name: 'Owner A edited cleanser' });

    await expect(editing).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });

  it('stops a delayed owner-A shelf delete before its server mirror', async () => {
    let releaseDelete!: () => void;
    let markDeleteStarted!: () => void;
    const deleteStarted = new Promise<void>((resolve) => {
      markDeleteStarted = resolve;
    });
    mocks.removeProduct.mockImplementationOnce(() => {
      markDeleteStarted();
      return new Promise<void>((resolve) => {
        releaseDelete = resolve;
      });
    });
    const actions = useShelfMutations();

    const deleting = actions.remove(PRODUCT.id);
    await deleteStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseDelete();

    await expect(deleting).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });

  it('stops a delayed owner-A replenishment before reading or mirroring follow-up rows', async () => {
    let releaseReplenishment!: (product: ShelfProduct) => void;
    let markReplenishmentStarted!: () => void;
    const replenishmentStarted = new Promise<void>((resolve) => {
      markReplenishmentStarted = resolve;
    });
    mocks.reAddProduct.mockImplementationOnce(() => {
      markReplenishmentStarted();
      return new Promise((resolve) => {
        releaseReplenishment = resolve;
      });
    });
    const actions = useShelfMutations();

    const replacing = actions.replace(PRODUCT.id);
    await replenishmentStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseReplenishment(PRODUCT);

    await expect(replacing).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.loadShelf).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });
});
