import { QueryClient, QueryClientProvider, onlineManager, useQuery } from '@tanstack/react-query';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useShelfMutations } from './mutations';
import type { ShelfProduct } from './store';

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  edit: vi.fn(),
  remove: vi.fn(),
  assertCurrent: vi.fn(),
}));
vi.mock('./store', () => ({
  addProduct: mocks.add,
  updateProduct: mocks.edit,
  removeProduct: mocks.remove,
  reAddProduct: vi.fn(),
  applyCatalogRecoveryProductUpdate: vi.fn(),
}));
vi.mock('@/features/today/useToday', () => ({ localDateString: () => '2026-10-23' }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingOwnerUserId: () => 'synthetic-owner-a',
}));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  HEALTH_DATA_WRITE_ADMISSION_CLOSED: 'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
  captureHealthDataWriteLease: () => ({ ownerUserId: 'synthetic-owner-a' }),
  assertHealthDataWriteLease: () => mocks.assertCurrent(),
  runHealthDataWriteOperation: async (_owner: string, operation: (lease: unknown) => unknown) =>
    operation({ assertCurrent: mocks.assertCurrent }),
}));

let client: QueryClient;
let screen: ReactTestRenderer;
let mutations: ReturnType<typeof useShelfMutations>;
let durable: string[];
let visible: string[] | undefined;
let releaseOld: () => void;
let reads: number;
let readUnavailable: boolean;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.assertCurrent.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  durable = [];
  visible = undefined;
  reads = 0;
  readUnavailable = false;
  onlineManager.setOnline(false);
  mocks.add.mockImplementation(async () => {
    durable = ['Synthetic balm'];
    return { id: 'synthetic-product', name: durable[0] } as ShelfProduct;
  });
  mocks.edit.mockImplementation(async () => {
    durable = ['Edited synthetic balm'];
  });
  mocks.remove.mockImplementation(async () => {
    durable = [];
  });
});
afterEach(async () => {
  releaseOld?.();
  if (screen) await act(async () => screen.unmount());
  client.clear();
  onlineManager.setOnline(true);
});

async function mountWithDelayedRead(initial: string[]) {
  durable = initial;
  function Surface() {
    mutations = useShelfMutations();
    visible = useQuery({
      queryKey: ['shelf'],
      networkMode: 'always',
      queryFn: () => {
        reads++;
        const snapshot = [...durable];
        return reads === 1
          ? new Promise<string[]>((resolve) => {
              releaseOld = () => resolve(snapshot);
            })
          : readUnavailable
            ? Promise.reject(new Error('SYNTHETIC_PRIVATE_READ_UNAVAILABLE'))
            : Promise.resolve(snapshot);
      },
    }).data;
    return null;
  }
  await act(async () => {
    screen = create(createElement(QueryClientProvider, { client }, createElement(Surface)));
  });
  expect(reads).toBe(1);
}

describe('committed Shelf changes versus an older initial query', () => {
  it('does not invalidate successor data if the owner/consent lease ends during cancellation', async () => {
    await mountWithDelayedRead([]);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const originalCancel = client.cancelQueries.bind(client);
    vi.spyOn(client, 'cancelQueries').mockImplementationOnce(async (...args) => {
      await originalCancel(...args);
      mocks.assertCurrent.mockImplementation(() => {
        throw new Error('ENDED_HEALTH_LEASE');
      });
    });
    await act(async () => {
      await expect(mutations.add({ name: 'Synthetic balm', addedVia: 'manual' })).rejects.toThrow(
        'ENDED_HEALTH_LEASE',
      );
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect(reads).toBe(1);
  });

  it('keeps a failed post-commit read unavailable and recovers the durable product on retry', async () => {
    await mountWithDelayedRead([]);
    readUnavailable = true;
    await act(async () => {
      const saving = mutations.add({ name: 'Synthetic balm', addedVia: 'manual' });
      await new Promise((resolve) => setTimeout(resolve, 20));
      releaseOld();
      await saving;
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(client.getQueryState(['shelf'])?.status).toBe('error');
    expect(durable).toEqual(['Synthetic balm']);
    readUnavailable = false;
    await act(async () => {
      await client.refetchQueries({ queryKey: ['shelf'] });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(visible).toEqual(durable);
  });

  it.each(['add', 'edit', 'archive', 'remove'] as const)(
    'publishes the durable %s result instead of joining the pre-write read, including offline',
    async (action) => {
      await mountWithDelayedRead(action === 'add' ? [] : ['Original synthetic balm']);
      await act(async () => {
        const saving =
          action === 'add'
            ? mutations.add({ name: 'Synthetic balm', addedVia: 'manual' })
            : action === 'edit'
              ? mutations.edit('synthetic-product', { name: 'Edited synthetic balm' })
              : action === 'archive'
                ? mutations.markFinished('synthetic-product')
                : mutations.remove('synthetic-product');
        // Resolve the old snapshot after the commit/invalidation starts.
        await new Promise((resolve) => setTimeout(resolve, 20));
        releaseOld();
        await saving;
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(visible).toEqual(durable);
      expect(reads).toBeGreaterThanOrEqual(2);
    },
  );
});
