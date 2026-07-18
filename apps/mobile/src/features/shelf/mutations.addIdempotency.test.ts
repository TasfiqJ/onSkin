import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import { resetShelfMutationStateForTests, useShelfMutations } from './mutations';
import { loadShelf, SHELF_ADD_OPERATION_OWNER_MISMATCH } from './store';

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  return {
    digestStringAsync: vi.fn(),
    invalidateQueries: vi.fn(),
    nextId: 0,
    ownerScope: { generation: 0 },
    privateTail: Promise.resolve(),
    resetQueries: vi.fn(),
    responseLossAfterCommit: 0,
    scheduleOutboxFlush: vi.fn(),
    storage,
    track: vi.fn(),
    user: { id: 'owner-a' } as { id: string } | null,
    writeCalls: 0,
  };
});

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
  randomUUID: vi.fn(() => `00000000-0000-4000-8000-${String(++mocks.nextId).padStart(12, '0')}`),
}));

vi.mock('@/lib/storage/privateKV', () => {
  async function serialized<T>(operation: () => Promise<T> | T): Promise<T> {
    const previous = mocks.privateTail;
    let release!: () => void;
    const tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.privateTail = previous.then(() => tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  function loseResponseAfterCommit(): void {
    if (mocks.responseLossAfterCommit > 0) {
      mocks.responseLossAfterCommit -= 1;
      throw new Error('PRIVATE_WRITE_RESPONSE_LOST');
    }
  }

  return {
    readPrivateItem: vi.fn(async (key: string) => {
      const value = mocks.storage.get(key);
      return value === undefined ? { status: 'absent' } : { status: 'available', value };
    }),
    updatePrivateItem: vi.fn(
      async (key: string, updater: (current: string | null) => string | null) =>
        serialized(() => {
          const current = mocks.storage.get(key) ?? null;
          const next = updater(current);
          if (next !== current) {
            mocks.writeCalls += 1;
            if (next === null) mocks.storage.delete(key);
            else mocks.storage.set(key, next);
            loseResponseAfterCommit();
          }
        }),
    ),
    updatePrivateItemsTransactionally: vi.fn(
      async (
        keys: readonly string[],
        updater: (
          current: ReadonlyMap<string, string | null>,
        ) => ReadonlyMap<string, string | null>,
      ) =>
        serialized(() => {
          const current = new Map(
            keys.map((key) => [key, mocks.storage.get(key) ?? null] as const),
          );
          const next = updater(current);
          const changed = keys.some((key) => next.get(key) !== current.get(key));
          if (!changed) return;
          for (const key of keys) {
            const value = next.get(key) ?? null;
            if (value === null) mocks.storage.delete(key);
            else mocks.storage.set(key, value);
          }
          mocks.writeCalls += 1;
          loseResponseAfterCommit();
        }),
    ),
  };
});

vi.mock('@/lib/offline/outbox', () => ({
  hashOutboxOwner: vi.fn(async (ownerId: string) =>
    mocks.digestStringAsync('SHA-256', `onskin:outbox-owner:v1:${ownerId.trim()}`),
  ),
  scheduleOutboxFlush: mocks.scheduleOutboxFlush,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    resetQueries: mocks.resetQueries,
  }),
}));
vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => mocks.ownerScope,
}));
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));

const INPUT = {
  name: 'Public flow cleanser',
  brand: 'Example',
  category: 'cleanser',
  addedVia: 'manual' as const,
};

function fakeDigest(value: string): string {
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
}

describe('public Shelf add idempotency lifecycle', () => {
  beforeEach(() => {
    mocks.digestStringAsync.mockReset();
    mocks.digestStringAsync.mockImplementation(async (_algorithm: string, value: string) =>
      fakeDigest(value),
    );
    mocks.invalidateQueries.mockReset();
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.nextId = 0;
    mocks.ownerScope = createOwnerQueryScope();
    mocks.privateTail = Promise.resolve();
    mocks.resetQueries.mockReset();
    mocks.resetQueries.mockResolvedValue(undefined);
    mocks.responseLossAfterCommit = 0;
    mocks.scheduleOutboxFlush.mockReset();
    mocks.storage.clear();
    mocks.track.mockReset();
    mocks.user = { id: 'owner-a' };
    mocks.writeCalls = 0;
    resetShelfMutationStateForTests();
  });

  it('converges 100 same-operation hook calls and keeps distinct operations distinct', async () => {
    const actions = useShelfMutations();
    const sameOperation = await Promise.all(
      Array.from({ length: 100 }, () => actions.add(INPUT, 'same-public-operation')),
    );

    expect(new Set(sameOperation.map((product) => product.id)).size).toBe(1);
    expect(await loadShelf()).toHaveLength(1);

    const distinct = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        actions.add(INPUT, `distinct-public-operation-${index}`),
      ),
    );
    expect(new Set(distinct.map((product) => product.id)).size).toBe(100);
    expect(await loadShelf()).toHaveLength(101);
  });

  it('recovers a lost commit response after hook recreation with the same caller token', async () => {
    const firstHook = useShelfMutations();
    mocks.responseLossAfterCommit = 1;
    const operationId = 'caller-retained-operation';

    await expect(firstHook.add(INPUT, operationId)).rejects.toThrow('PRIVATE_WRITE_RESPONSE_LOST');
    const committedId = (await loadShelf())[0]!.id;

    // Recreate the hook while retaining the mounted intake's caller-owned token.
    // Process-death token recovery is a separate, unclaimed device requirement.
    resetShelfMutationStateForTests();
    const recreatedHook = useShelfMutations();
    const recovered = await recreatedHook.add(INPUT, operationId);
    expect(recovered.id).toBe(committedId);

    await recreatedHook.acknowledgeAdd(recovered.id);
    const laterIntentionalUnit = await useShelfMutations().add(INPUT, 'later-identical-unit');
    expect(laterIntentionalUnit.id).not.toBe(recovered.id);
    expect(await loadShelf()).toHaveLength(2);
  });

  it('rejects an owner-A unacknowledged retry after the account generation advances to B', async () => {
    const ownerA = useShelfMutations();
    await ownerA.add(INPUT, 'owner-bound-public-operation');
    await waitForAccountGenerationOperationsToSettle();

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    mocks.user = { id: 'owner-b' };
    mocks.ownerScope = createOwnerQueryScope();
    const ownerB = useShelfMutations();
    const original = mocks.storage.get('onskin.shelf.v1');

    await expect(ownerB.add(INPUT, 'owner-bound-public-operation')).rejects.toThrow(
      SHELF_ADD_OPERATION_OWNER_MISMATCH,
    );
    expect(mocks.storage.get('onskin.shelf.v1')).toBe(original);
  });

  it('rejects a delayed owner-A digest after a fully completed boundary and allows same-user refresh', async () => {
    let releaseDigests!: () => void;
    const digestGate = new Promise<void>((resolve) => {
      releaseDigests = resolve;
    });
    mocks.digestStringAsync.mockImplementation(async (_algorithm: string, value: string) => {
      await digestGate;
      return fakeDigest(value);
    });
    const staleOwnerA = useShelfMutations();
    const adding = staleOwnerA.add(INPUT, 'delayed-digest-operation');
    await vi.waitFor(() => expect(mocks.digestStringAsync).toHaveBeenCalledTimes(2));

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    releaseDigests();

    await expect(adding).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.writeCalls).toBe(0);
    expect(mocks.storage.size).toBe(0);

    mocks.ownerScope = createOwnerQueryScope();
    const refreshedOwnerA = useShelfMutations();
    await expect(
      refreshedOwnerA.add(INPUT, 'same-user-refreshed-operation'),
    ).resolves.toMatchObject({ name: INPUT.name });
    expect(mocks.writeCalls).toBe(1);
  });

  it('rejects a delayed acknowledgement digest before it can clear a refreshed owner receipt', async () => {
    const ownerA = useShelfMutations();
    const product = await ownerA.add(INPUT, 'delayed-ack-operation');
    await waitForAccountGenerationOperationsToSettle();
    const original = mocks.storage.get('onskin.shelf.v1');
    mocks.writeCalls = 0;
    mocks.digestStringAsync.mockClear();
    let releaseDigest!: () => void;
    const digestGate = new Promise<void>((resolve) => {
      releaseDigest = resolve;
    });
    mocks.digestStringAsync.mockImplementation(async (_algorithm: string, value: string) => {
      await digestGate;
      return fakeDigest(value);
    });

    const acknowledging = ownerA.acknowledgeAdd(product.id);
    await vi.waitFor(() => expect(mocks.digestStringAsync).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    releaseDigest();

    await expect(acknowledging).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.writeCalls).toBe(0);
    expect(mocks.storage.get('onskin.shelf.v1')).toBe(original);

    mocks.ownerScope = createOwnerQueryScope();
    await expect(useShelfMutations().acknowledgeAdd(product.id)).resolves.toBeUndefined();
    expect(mocks.writeCalls).toBe(1);
  });
});
