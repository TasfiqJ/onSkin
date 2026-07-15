import {
  MutationObserver,
  QueryClient,
  type MutationObserverOptions,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import {
  createOwnerQueryScope,
  ownerQueryPrefixes,
  queryKeys,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';

import { usePhotoActions } from './usePhotos';
import type { NewPhoto, PhotoRecord } from './store';

const mocks = vi.hoisted(() => ({
  addPhoto: vi.fn(),
  ownerScope: { generation: 0 },
  queryClient: null as unknown,
  removePhoto: vi.fn(),
  setReference: vi.fn(),
  updatePhoto: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: mocks.useMutation,
    useQueryClient: () => mocks.queryClient,
  };
});

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => mocks.ownerScope,
}));

vi.mock('./store', () => ({
  addPhoto: mocks.addPhoto,
  loadPhotos: vi.fn(),
  recoverPhotoStoreMutations: vi.fn(),
  removePhoto: mocks.removePhoto,
  setReference: mocks.setReference,
  updatePhoto: mocks.updatePhoto,
}));

type CapturedMutation<TInput, TResult> = MutationObserverOptions<
  TResult,
  Error,
  TInput,
  unknown
> & {
  mutationFn: (input: TInput) => Promise<TResult>;
  onSettled: NonNullable<
    MutationObserverOptions<TResult, Error, TInput, unknown>['onSettled']
  >;
};

type NoteInput = { id: string; notes: string };

type CapturedPhotoActions = {
  add: CapturedMutation<NewPhoto, PhotoRecord>;
  reference: CapturedMutation<string, void>;
  remove: CapturedMutation<string, void>;
  note: CapturedMutation<NoteInput, void>;
};

function useCapturedPhotoActions(): CapturedPhotoActions {
  return usePhotoActions() as unknown as CapturedPhotoActions;
}

function mutationExecutor<TInput, TResult>(
  client: QueryClient,
  mutation: CapturedMutation<TInput, TResult>,
) {
  const onSettled = vi.fn(mutation.onSettled);
  const observer = new MutationObserver<TResult, Error, TInput, unknown>(client, {
    ...mutation,
    onSettled,
  });
  return {
    mutate: (input: TInput) => observer.mutate(input),
    onSettled,
  };
}

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}>;

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const boundary = {
  localDate: '2026-07-14',
  timeZone: 'America/Toronto',
} as const;
const newPhoto: NewPhoto = { takenLocalDate: '2026-07-14' };
const noteInput: NoteInput = { id: 'photo-a', notes: 'owner A note' };
const photoRecord = { id: 'photo-a' } as PhotoRecord;
const actionCases = [
  ['add', newPhoto, mocks.addPhoto, [newPhoto]],
  ['reference', 'photo-a', mocks.setReference, ['photo-a']],
  ['remove', 'photo-a', mocks.removePhoto, ['photo-a']],
  ['note', noteInput, mocks.updatePhoto, ['photo-a', { notes: 'owner A note' }]],
] as const;

function nextOwnerScope(owner: OwnerQueryScope): OwnerQueryScope {
  return Object.freeze({ generation: owner.generation + 1 });
}

function photoQueryKey(owner: OwnerQueryScope) {
  return queryKeys.photos(owner, boundary, 'front');
}

function seedOwnerCaches(client: QueryClient, ownerA: OwnerQueryScope, ownerB: OwnerQueryScope) {
  client.setQueryData(photoQueryKey(ownerA), 'owner-a-photos');
  client.setQueryData(photoQueryKey(ownerB), 'owner-b-photos');
}

describe('owner-bound photo actions', () => {
  let client: QueryClient;
  let ownerA: OwnerQueryScope;

  beforeEach(() => {
    for (let index = 0; index < 4; index += 1) endAccountGenerationBoundary();

    client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    mocks.queryClient = client;
    mocks.addPhoto.mockReset();
    mocks.addPhoto.mockResolvedValue(photoRecord);
    mocks.removePhoto.mockReset();
    mocks.removePhoto.mockResolvedValue(undefined);
    mocks.setReference.mockReset();
    mocks.setReference.mockResolvedValue(undefined);
    mocks.updatePhoto.mockReset();
    mocks.updatePhoto.mockResolvedValue(undefined);
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options: Record<string, unknown>) => options);

    ownerA = createOwnerQueryScope();
    mocks.ownerScope = ownerA;
  });

  afterEach(() => {
    for (let index = 0; index < 4; index += 1) endAccountGenerationBoundary();
    client.clear();
    vi.restoreAllMocks();
  });

  it.each(actionCases)(
    'runs rejected stale owner-A %s through onSettled without store entry or invalidation',
    async (actionName, input, storeCall) => {
      const ownerB = nextOwnerScope(ownerA);
      seedOwnerCaches(client, ownerA, ownerB);
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const actions = useCapturedPhotoActions();
      const mutation = actions[actionName] as unknown as CapturedMutation<typeof input, unknown>;
      const executor = mutationExecutor(client, mutation);

      beginAccountGenerationBoundary();
      endAccountGenerationBoundary();
      expect(createOwnerQueryScope()).toEqual(ownerB);

      await expect(executor.mutate(input)).rejects.toMatchObject({
        code: ACCOUNT_GENERATION_CHANGED,
      });

      expect(executor.onSettled).toHaveBeenCalledOnce();
      expect(storeCall).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(client.getQueryState(photoQueryKey(ownerA))?.isInvalidated).toBe(false);
      expect(client.getQueryState(photoQueryKey(ownerB))?.isInvalidated).toBe(false);
      expect(client.getQueryData(photoQueryKey(ownerB))).toBe('owner-b-photos');
    },
  );

  it.each(actionCases)(
    'invalidates exactly owner A after a successful same-owner %s action',
    async (actionName, input, storeCall, expectedStoreArgs) => {
      const ownerB = nextOwnerScope(ownerA);
      seedOwnerCaches(client, ownerA, ownerB);
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const actions = useCapturedPhotoActions();
      const mutation = actions[actionName] as unknown as CapturedMutation<typeof input, unknown>;
      const executor = mutationExecutor(client, mutation);

      await expect(executor.mutate(input)).resolves.not.toThrow();

      expect(executor.onSettled).toHaveBeenCalledOnce();
      expect(storeCall).toHaveBeenCalledExactlyOnceWith(...expectedStoreArgs);
      expect(invalidate).toHaveBeenCalledExactlyOnceWith({
        queryKey: ownerQueryPrefixes.photos(ownerA),
      });
      expect(client.getQueryState(photoQueryKey(ownerA))?.isInvalidated).toBe(true);
      expect(client.getQueryState(photoQueryKey(ownerB))?.isInvalidated).toBe(false);
      expect(client.getQueryData(photoQueryKey(ownerB))).toBe('owner-b-photos');
    },
  );

  it('keeps an in-scope write drain-held and suppresses invalidation when it settles in a boundary', async () => {
    const ownerB = nextOwnerScope(ownerA);
    seedOwnerCaches(client, ownerA, ownerB);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const pendingWrite = deferred<PhotoRecord>();
    mocks.addPhoto.mockReturnValueOnce(pendingWrite.promise);
    const actions = useCapturedPhotoActions();
    const executor = mutationExecutor(client, actions.add);
    const outcome = executor.mutate(newPhoto).then(
      (value) => ({ status: 'resolved' as const, value }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await vi.waitFor(() => expect(mocks.addPhoto).toHaveBeenCalledWith(newPhoto));

    beginAccountGenerationBoundary();
    let drained = false;
    const drain = waitForAccountGenerationOperationsToSettle().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);

    pendingWrite.resolve(photoRecord);
    await expect(outcome).resolves.toMatchObject({
      status: 'rejected',
      error: { message: ACCOUNT_GENERATION_CHANGED },
    });
    await expect(drain).resolves.toBeUndefined();

    expect(executor.onSettled).toHaveBeenCalledOnce();
    expect(invalidate).not.toHaveBeenCalled();
    expect(client.getQueryState(photoQueryKey(ownerA))?.isInvalidated).toBe(false);
    expect(client.getQueryState(photoQueryKey(ownerB))?.isInvalidated).toBe(false);
    expect(client.getQueryData(photoQueryKey(ownerB))).toBe('owner-b-photos');
  });

  it('keeps a hung owner-A prefix invalidation outside the drain and isolated from owner B', async () => {
    const ownerB = nextOwnerScope(ownerA);
    seedOwnerCaches(client, ownerA, ownerB);
    const releaseInvalidation = deferred<void>();
    const originalInvalidate = client.invalidateQueries.bind(client);
    const invalidate = vi
      .spyOn(client, 'invalidateQueries')
      .mockImplementationOnce(async (filters) => {
        await originalInvalidate(filters);
        await releaseInvalidation.promise;
      });
    const actions = useCapturedPhotoActions();
    const executor = mutationExecutor(client, actions.add);
    let mutationSettled = false;
    const mutation = executor.mutate(newPhoto).then(() => {
      mutationSettled = true;
    });
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    try {
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      expect(mutationSettled).toBe(false);
      expect(client.getQueryState(photoQueryKey(ownerA))?.isInvalidated).toBe(true);
      expect(client.getQueryState(photoQueryKey(ownerB))?.isInvalidated).toBe(false);
      expect(client.getQueryData(photoQueryKey(ownerB))).toBe('owner-b-photos');
    } finally {
      endAccountGenerationBoundary();
      releaseInvalidation.resolve();
    }

    await expect(mutation).resolves.toBeUndefined();
    expect(executor.onSettled).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: ownerQueryPrefixes.photos(ownerA),
    });
  });
});
