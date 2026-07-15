import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import {
  CYCLE_ANCHOR_INVALID,
  CYCLE_ANCHOR_UNAVAILABLE,
  CYCLE_ANCHOR_UNSUPPORTED_VERSION,
  getCycleAnchor,
  readCycleAnchor,
  setCycleAnchor,
  useCycleAnchor,
} from './cycleAnchor';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  getPrivateItem: vi.fn(),
  ownerScope: { generation: 0 },
  updatePrivateItem: vi.fn(),
  useQuery: vi.fn((options: unknown) => options),
  writes: 0,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@/lib/query/localDateBoundaryStore', () => ({
  reconcileLocalDateBoundarySnapshot: vi.fn(),
  useLocalDateBoundary: () => ({
    localDate: '2026-07-10',
    timeZone: 'America/Toronto',
  }),
}));

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => mocks.ownerScope,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

const KEY = 'onskin.cycleAnchor';
const TODAY = '2026-07-10';

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

function useCapturedCycleAnchorQuery(): {
  queryFn: () => Promise<string>;
  queryKey: readonly unknown[];
} {
  return useCycleAnchor() as unknown as {
    queryFn: () => Promise<string>;
    queryKey: readonly unknown[];
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 10, 12, 0, 0));
  mocks.storage.clear();
  mocks.writes = 0;
  mocks.getPrivateItem.mockReset();
  mocks.ownerScope = createOwnerQueryScope();
  mocks.updatePrivateItem.mockReset();
  mocks.useQuery.mockClear();
  mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
  mocks.updatePrivateItem.mockImplementation(
    async (key: string, updater: (current: string | null) => string | null) => {
      const current = mocks.storage.get(key) ?? null;
      const next = updater(current);
      if (next === current) return;
      mocks.writes += 1;
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cycle anchor store', () => {
  it('distinguishes missing state and derives today without persisting it', async () => {
    await expect(readCycleAnchor()).resolves.toEqual({ status: 'missing', anchorISO: null });
    await expect(getCycleAnchor()).resolves.toBe(TODAY);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('returns and preserves a strict current local-date anchor', async () => {
    const raw = JSON.stringify({ schemaVersion: 1, anchorISO: '2026-07-07' });
    mocks.storage.set(KEY, raw);

    await expect(readCycleAnchor()).resolves.toEqual({
      status: 'available',
      format: 'current',
      anchorISO: '2026-07-07',
    });
    await expect(getCycleAnchor()).resolves.toBe('2026-07-07');
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('normalizes a padded legacy anchor in memory without repairing it', async () => {
    const raw = ' 2026-07-07 ';
    mocks.storage.set(KEY, raw);

    await expect(readCycleAnchor()).resolves.toEqual({
      status: 'available',
      format: 'legacy',
      anchorISO: '2026-07-07',
    });
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('classifies impossible calendar dates as corrupt and preserves the bytes', async () => {
    const raw = '2026-02-31';
    mocks.storage.set(KEY, raw);

    await expect(readCycleAnchor()).resolves.toEqual({ status: 'corrupt', anchorISO: null });
    await expect(getCycleAnchor()).rejects.toThrow(CYCLE_ANCHOR_INVALID);
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('classifies and preserves future current schemas', async () => {
    const raw = JSON.stringify({ schemaVersion: 2, anchorISO: '2026-07-07' });
    mocks.storage.set(KEY, raw);

    await expect(readCycleAnchor()).resolves.toEqual({
      status: 'unsupported_version',
      anchorISO: null,
    });
    await expect(getCycleAnchor()).rejects.toThrow(CYCLE_ANCHOR_UNSUPPORTED_VERSION);
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('returns typed unavailable and does not invent an anchor after read failure', async () => {
    mocks.getPrivateItem.mockRejectedValue(new Error('private storage unavailable'));

    await expect(readCycleAnchor()).resolves.toEqual({ status: 'unavailable', anchorISO: null });
    await expect(getCycleAnchor()).rejects.toThrow(CYCLE_ANCHOR_UNAVAILABLE);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('writes a strict versioned envelope on an explicit mutation', async () => {
    await setCycleAnchor('2026-07-08');

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      schemaVersion: 1,
      anchorISO: '2026-07-08',
    });
  });

  it('upgrades a valid legacy anchor only on explicit mutation', async () => {
    mocks.storage.set(KEY, ' 2026-07-07 ');

    await setCycleAnchor('2026-07-08');

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      schemaVersion: 1,
      anchorISO: '2026-07-08',
    });
  });

  it('rejects invalid requested anchors without touching existing bytes', async () => {
    const raw = JSON.stringify({ schemaVersion: 1, anchorISO: '2026-07-07' });
    mocks.storage.set(KEY, raw);

    await expect(setCycleAnchor('tomorrow')).rejects.toThrow(CYCLE_ANCHOR_INVALID);
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('refuses to overwrite corrupt or future bytes during an explicit mutation', async () => {
    for (const raw of [
      '{not-json',
      JSON.stringify({ schemaVersion: 2, anchorISO: '2026-07-07' }),
    ]) {
      mocks.storage.set(KEY, raw);
      await expect(setCycleAnchor('2026-07-08')).rejects.toThrow();
      expect(mocks.storage.get(KEY)).toBe(raw);
    }
  });

  it('does zero writes when the requested current anchor is unchanged', async () => {
    mocks.storage.set(KEY, JSON.stringify({ schemaVersion: 1, anchorISO: '2026-07-07' }));

    await setCycleAnchor('2026-07-07');

    expect(mocks.writes).toBe(0);
  });

  it('keeps a valid versioned record through 100 simultaneous explicit sets', async () => {
    const anchors = Array.from(
      { length: 100 },
      (_, index) => `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
    );

    await Promise.all(anchors.map((anchorISO) => setCycleAnchor(anchorISO)));

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      schemaVersion: 1,
      anchorISO: anchors.at(-1),
    });
  });
});

describe('cycle anchor owner-bound query', () => {
  it('uses the owner/day key and keeps a delayed same-generation read valid', async () => {
    const delayed = deferred<string | null>();
    mocks.getPrivateItem.mockReturnValueOnce(delayed.promise);
    const query = useCapturedCycleAnchorQuery();

    expect(query.queryKey).toEqual(
      queryKeys.cycleAnchor(mocks.ownerScope, {
        localDate: TODAY,
        timeZone: 'America/Toronto',
      }),
    );
    const pending = query.queryFn();
    await Promise.resolve();
    expect(mocks.getPrivateItem).toHaveBeenCalledOnce();

    delayed.resolve(JSON.stringify({ schemaVersion: 1, anchorISO: '2026-07-08' }));
    await expect(pending).resolves.toBe('2026-07-08');
  });

  it('detaches a hung owner-A private read and permits a fresh owner-B query', async () => {
    const ownerARead = deferred<string | null>();
    mocks.getPrivateItem.mockReturnValueOnce(ownerARead.promise);
    const pendingA = useCapturedCycleAnchorQuery().queryFn();
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    ownerARead.resolve(JSON.stringify({ schemaVersion: 1, anchorISO: '2026-07-07' }));
    await Promise.resolve();

    mocks.ownerScope = createOwnerQueryScope();
    mocks.getPrivateItem.mockResolvedValueOnce(
      JSON.stringify({ schemaVersion: 1, anchorISO: '2026-07-09' }),
    );
    await expect(useCapturedCycleAnchorQuery().queryFn()).resolves.toBe('2026-07-09');
  });

  it('owner-bounds direct store reads instead of translating a boundary into unavailable', async () => {
    const ownerARead = deferred<string | null>();
    mocks.getPrivateItem.mockReturnValueOnce(ownerARead.promise);
    const pending = readCycleAnchor();
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pending).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    ownerARead.resolve(null);
    await Promise.resolve();
  });
});
