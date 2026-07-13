import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CYCLE_ANCHOR_INVALID,
  CYCLE_ANCHOR_UNAVAILABLE,
  CYCLE_ANCHOR_UNSUPPORTED_VERSION,
  getCycleAnchor,
  readCycleAnchor,
  setCycleAnchor,
} from './cycleAnchor';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  getPrivateItem: vi.fn(),
  updatePrivateItem: vi.fn(),
  writes: 0,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

const KEY = 'onskin.cycleAnchor';
const TODAY = '2026-07-10';

describe('cycle anchor store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 10, 12, 0, 0));
    mocks.storage.clear();
    mocks.writes = 0;
    mocks.getPrivateItem.mockReset();
    mocks.updatePrivateItem.mockReset();
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
