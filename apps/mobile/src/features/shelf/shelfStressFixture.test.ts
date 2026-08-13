import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_SHELF_E2E_STRESS_ITEMS,
  buildShelfE2EActiveRows,
  buildShelfE2EArchiveRows,
  parseShelfE2EStressCount,
  readShelfE2EStressFixture,
} from './shelfStressFixture';

const mocks = vi.hoisted(() => ({ platformOS: 'web' }));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platformOS;
    },
  },
}));

describe('Shelf collection stress fixture', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', true);
    mocks.platformOS = 'web';
    delete process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ACTIVE_COUNT;
    delete process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ARCHIVE_COUNT;
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ACTIVE_COUNT;
    delete process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ARCHIVE_COUNT;
    vi.unstubAllGlobals();
  });

  it('parses only explicit bounded cardinalities', () => {
    expect(parseShelfE2EStressCount(undefined)).toBeNull();
    expect(parseShelfE2EStressCount('')).toBeNull();
    expect(parseShelfE2EStressCount('-1')).toBeNull();
    expect(parseShelfE2EStressCount('1.5')).toBeNull();
    expect(
      [0, 1, 2, 10, 50, 100, 250].map((count) => parseShelfE2EStressCount(`${count}`)),
    ).toEqual([0, 1, 2, 10, 50, 100, 250]);
    expect(parseShelfE2EStressCount('251')).toBeNull();
    expect(parseShelfE2EStressCount('999')).toBeNull();
  });

  it('builds deterministic unique mixed-height active rows through the ceiling', () => {
    for (const count of [0, 1, 2, 10, 50, 100, MAX_SHELF_E2E_STRESS_ITEMS]) {
      const first = buildShelfE2EActiveRows(count);
      expect(first).toEqual(buildShelfE2EActiveRows(count));
      expect(first).toHaveLength(count);
      expect(new Set(first.map((row) => row.id)).size).toBe(count);
      expect(first.every((row) => row.name.endsWith(row.id.slice(-4)))).toBe(true);
      expect(first.filter((row) => row.active)).toHaveLength(
        count === 0 ? 0 : Math.ceil(count / 3),
      );
      expect(first.filter((row) => row.expiring)).toHaveLength(
        first.filter((row) => ['countdown', 'expired'].includes(row.badge.kind)).length,
      );
    }
  });

  it('builds deterministic unique chronological archive projections through the ceiling', () => {
    for (const count of [0, 1, 2, 10, 50, 100, MAX_SHELF_E2E_STRESS_ITEMS]) {
      const first = buildShelfE2EArchiveRows(count);
      expect(first).toEqual(buildShelfE2EArchiveRows(count));
      expect(first).toHaveLength(count);
      expect(new Set(first.map((row) => row.id)).size).toBe(count);
      expect(
        first.every(
          (row) =>
            row.finishedAt !== null && Date.parse(row.createdAt) <= Date.parse(row.finishedAt),
        ),
      ).toBe(true);
      expect(first.map((row) => row.status)).toEqual(
        Array.from({ length: count }, (_, index) => (index % 2 === 0 ? 'finished' : 'discarded')),
      );
    }
  });

  it('exposes exact independent active/archive counts only in development web', () => {
    process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ACTIVE_COUNT = '100';
    process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ARCHIVE_COUNT = '50';

    expect(readShelfE2EStressFixture()).toMatchObject({
      activeRows: { length: 100 },
      archiveRows: { length: 50 },
    });

    mocks.platformOS = 'ios';
    expect(readShelfE2EStressFixture()).toBeNull();
    mocks.platformOS = 'web';
    vi.stubGlobal('__DEV__', false);
    expect(readShelfE2EStressFixture()).toBeNull();
  });

  it('fails closed to production data when either supplied count is invalid', () => {
    process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ACTIVE_COUNT = '100';
    process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ARCHIVE_COUNT = '251';
    expect(readShelfE2EStressFixture()).toBeNull();

    process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ARCHIVE_COUNT = '50';
    process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ACTIVE_COUNT = 'many';
    expect(readShelfE2EStressFixture()).toBeNull();
  });
});
