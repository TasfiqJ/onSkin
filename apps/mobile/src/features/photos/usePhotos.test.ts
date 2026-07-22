import { QueryClient } from '@tanstack/react-query';
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
import type { LocalDateBoundaryIdentity } from '@/lib/query/localDateBoundaryStore';

import { derivePhotosQueryData, usePhotoActions } from './usePhotos';
import type { NewPhoto, PhotoMutationCommit, PhotoRecord } from './store';

const mocks = vi.hoisted(() => ({
  addPhoto: vi.fn(),
  loadPhotos: vi.fn(),
  ownerScope: { generation: 0 },
  queryClient: null as unknown,
  recoverPhotoStoreMutations: vi.fn(),
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
  loadPhotos: mocks.loadPhotos,
  recoverPhotoStoreMutations: mocks.recoverPhotoStoreMutations,
  removePhoto: mocks.removePhoto,
  setReference: mocks.setReference,
  updatePhoto: mocks.updatePhoto,
}));

type CapturedMutation<TInput, TResult> = {
  mutationFn: (input: TInput) => Promise<TResult>;
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

function photo(
  id: string,
  series: PhotoRecord['series'],
  takenLocalDate: string,
  isReference = false,
): PhotoRecord {
  return {
    id,
    series,
    takenLocalDate,
    takenAt: `${takenLocalDate}T12:00:00.000Z`,
    timeOfDay: 'morning',
    alignmentScore: null,
    lightingScore: null,
    headRoll: null,
    headYaw: null,
    headPitch: null,
    qualitySource: null,
    isReference,
    referencePhotoId: null,
    captureSessionId: null,
    localUri: null,
    notes: null,
    localOnly: true,
    storagePath: null,
    faceRegionRedacted: false,
    isEncrypted: false,
    encryptedLocalUri: null,
    thumbnailLocalUri: null,
    encryptionVersion: 'none',
    keyId: null,
  };
}

const boundary = {
  localDate: '2026-07-14',
  timeZone: 'America/Toronto',
} as const;
const earlierBoundary = {
  localDate: '2026-06-10',
  timeZone: 'America/Vancouver',
} as const;
const newPhoto: NewPhoto = { takenLocalDate: '2026-07-14' };
const noteInput: NoteInput = { id: 'front-new', notes: 'owner A note' };
const committedPhotos = [
  photo('front-new', 'front', '2026-07-14'),
  photo('left-only', 'left', '2026-06-01', true),
  photo('front-old', 'front', '2026-05-01', true),
];
const addedPhoto = committedPhotos[0]!;

const actionCases = [
  ['add', newPhoto, mocks.addPhoto, [newPhoto], addedPhoto],
  ['reference', 'front-new', mocks.setReference, ['front-new'], undefined],
  ['remove', 'front-new', mocks.removePhoto, ['front-new'], undefined],
  [
    'note',
    noteInput,
    mocks.updatePhoto,
    ['front-new', { notes: 'owner A note' }],
    undefined,
  ],
] as const;

function nextOwnerScope(owner: OwnerQueryScope): OwnerQueryScope {
  return Object.freeze({ generation: owner.generation + 1 });
}

function photoQueryKey(
  owner: OwnerQueryScope,
  dateBoundary: LocalDateBoundaryIdentity = boundary,
  series: PhotoRecord['series'] = 'front',
) {
  return queryKeys.photos(owner, dateBoundary, series);
}

function seedOwnerCaches(client: QueryClient, ownerA: OwnerQueryScope, ownerB: OwnerQueryScope) {
  const oldPhotos = [photo('cached-old', 'front', '2026-01-01', true)];
  client.setQueryData(
    photoQueryKey(ownerA),
    derivePhotosQueryData(oldPhotos, 'front', boundary.localDate),
  );
  client.setQueryData(
    photoQueryKey(ownerA, earlierBoundary, 'left'),
    derivePhotosQueryData(oldPhotos, 'left', earlierBoundary.localDate),
  );
  client.setQueryData(photoQueryKey(ownerB), 'owner-b-photos');
}

describe('owner-bound photo actions', () => {
  let client: QueryClient;
  let ownerA: OwnerQueryScope;

  beforeEach(() => {
    for (let index = 0; index < 4; index += 1) endAccountGenerationBoundary();

    client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    mocks.queryClient = client;
    mocks.addPhoto.mockReset().mockResolvedValue({ result: addedPhoto, photos: committedPhotos });
    mocks.loadPhotos.mockReset();
    mocks.recoverPhotoStoreMutations.mockReset();
    mocks.removePhoto.mockReset().mockResolvedValue({ result: undefined, photos: committedPhotos });
    mocks.setReference
      .mockReset()
      .mockResolvedValue({ result: undefined, photos: committedPhotos });
    mocks.updatePhoto.mockReset().mockResolvedValue({ result: undefined, photos: committedPhotos });
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
    'publishes the exact committed snapshot after owner-A %s without invalidation or reread',
    async (actionName, input, storeCall, expectedStoreArgs, expectedResult) => {
      const ownerB = nextOwnerScope(ownerA);
      seedOwnerCaches(client, ownerA, ownerB);
      const malformedOwnerKey = [...ownerQueryPrefixes.photos(ownerA), 'not-local-day'] as const;
      client.setQueryData(malformedOwnerKey, 'leave-me-alone');
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const setQueryData = vi.spyOn(client, 'setQueryData');
      const actions = useCapturedPhotoActions();
      const mutation = actions[actionName] as unknown as CapturedMutation<typeof input, unknown>;

      await expect(mutation.mutationFn(input)).resolves.toEqual(expectedResult);

      expect(storeCall).toHaveBeenCalledExactlyOnceWith(...expectedStoreArgs);
      expect(invalidate).not.toHaveBeenCalled();
      expect(mocks.loadPhotos).not.toHaveBeenCalled();
      expect(mocks.recoverPhotoStoreMutations).not.toHaveBeenCalled();
      expect(setQueryData).toHaveBeenCalledTimes(2);
      expect(client.getQueryData(photoQueryKey(ownerA))).toEqual(
        derivePhotosQueryData(committedPhotos, 'front', boundary.localDate),
      );
      expect(client.getQueryData(photoQueryKey(ownerA, earlierBoundary, 'left'))).toEqual(
        derivePhotosQueryData(committedPhotos, 'left', earlierBoundary.localDate),
      );
      expect(client.getQueryData(photoQueryKey(ownerB))).toBe('owner-b-photos');
      expect(client.getQueryData(malformedOwnerKey)).toBe('leave-me-alone');
      expect(client.getQueryState(photoQueryKey(ownerA))?.isInvalidated).toBe(false);
      expect(client.getQueryState(photoQueryKey(ownerB))?.isInvalidated).toBe(false);
    },
  );

  it.each(actionCases)(
    'keeps every cache byte-stable and performs no reread when owner-A %s fails',
    async (actionName, input, storeCall) => {
      const ownerB = nextOwnerScope(ownerA);
      seedOwnerCaches(client, ownerA, ownerB);
      const ownerAFrontBefore = client.getQueryData(photoQueryKey(ownerA));
      const ownerALeftBefore = client.getQueryData(
        photoQueryKey(ownerA, earlierBoundary, 'left'),
      );
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const setQueryData = vi.spyOn(client, 'setQueryData');
      storeCall.mockRejectedValueOnce(new Error('PRIVATE_STORE_UNAVAILABLE'));
      const actions = useCapturedPhotoActions();
      const mutation = actions[actionName] as unknown as CapturedMutation<typeof input, unknown>;

      await expect(mutation.mutationFn(input)).rejects.toThrow('PRIVATE_STORE_UNAVAILABLE');

      expect(invalidate).not.toHaveBeenCalled();
      expect(setQueryData).not.toHaveBeenCalled();
      expect(mocks.loadPhotos).not.toHaveBeenCalled();
      expect(mocks.recoverPhotoStoreMutations).not.toHaveBeenCalled();
      expect(client.getQueryData(photoQueryKey(ownerA))).toBe(ownerAFrontBefore);
      expect(client.getQueryData(photoQueryKey(ownerA, earlierBoundary, 'left'))).toBe(
        ownerALeftBefore,
      );
      expect(client.getQueryData(photoQueryKey(ownerB))).toBe('owner-b-photos');
    },
  );

  it.each(actionCases)(
    'rejects stale owner-A %s before store entry or cache publication',
    async (actionName, input, storeCall) => {
      const ownerB = nextOwnerScope(ownerA);
      seedOwnerCaches(client, ownerA, ownerB);
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const setQueryData = vi.spyOn(client, 'setQueryData');
      const actions = useCapturedPhotoActions();
      const mutation = actions[actionName] as unknown as CapturedMutation<typeof input, unknown>;

      beginAccountGenerationBoundary();
      endAccountGenerationBoundary();
      expect(createOwnerQueryScope()).toEqual(ownerB);

      await expect(mutation.mutationFn(input)).rejects.toMatchObject({
        code: ACCOUNT_GENERATION_CHANGED,
      });

      expect(storeCall).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(setQueryData).not.toHaveBeenCalled();
      expect(client.getQueryData(photoQueryKey(ownerB))).toBe('owner-b-photos');
    },
  );

  it('drains a started write and suppresses publication when its owner becomes stale', async () => {
    const ownerB = nextOwnerScope(ownerA);
    seedOwnerCaches(client, ownerA, ownerB);
    const setQueryData = vi.spyOn(client, 'setQueryData');
    const pendingWrite = deferred<PhotoMutationCommit<PhotoRecord>>();
    mocks.addPhoto.mockReturnValueOnce(pendingWrite.promise);
    const actions = useCapturedPhotoActions();
    const outcome = actions.add.mutationFn(newPhoto).then(
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

    pendingWrite.resolve({ result: addedPhoto, photos: committedPhotos });
    await expect(outcome).resolves.toMatchObject({
      status: 'rejected',
      error: { message: ACCOUNT_GENERATION_CHANGED },
    });
    await expect(drain).resolves.toBeUndefined();
    endAccountGenerationBoundary();

    expect(setQueryData).not.toHaveBeenCalled();
    expect(client.getQueryData(photoQueryKey(ownerB))).toBe('owner-b-photos');
  });

  it('drains a started note write without publishing owner-A text after an account boundary', async () => {
    const ownerB = nextOwnerScope(ownerA);
    seedOwnerCaches(client, ownerA, ownerB);
    const setQueryData = vi.spyOn(client, 'setQueryData');
    const pendingWrite = deferred<PhotoMutationCommit<void>>();
    mocks.updatePhoto.mockReturnValueOnce(pendingWrite.promise);
    const actions = useCapturedPhotoActions();
    const outcome = actions.note.mutationFn(noteInput).then(
      (value) => ({ status: 'resolved' as const, value }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await vi.waitFor(() =>
      expect(mocks.updatePhoto).toHaveBeenCalledWith('front-new', { notes: 'owner A note' }),
    );

    beginAccountGenerationBoundary();
    let drained = false;
    const drain = waitForAccountGenerationOperationsToSettle().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);

    pendingWrite.resolve({ result: undefined, photos: committedPhotos });
    await expect(outcome).resolves.toMatchObject({
      status: 'rejected',
      error: { message: ACCOUNT_GENERATION_CHANGED },
    });
    await expect(drain).resolves.toBeUndefined();
    endAccountGenerationBoundary();

    expect(setQueryData).not.toHaveBeenCalled();
    expect(client.getQueryData(photoQueryKey(ownerB))).toBe('owner-b-photos');
  });
});
