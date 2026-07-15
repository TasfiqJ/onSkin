import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markMilestoneSeen } from './milestoneStore';

const mocks = vi.hoisted(() => ({
  closeAfterUpdate: false,
  healthGeneration: 1,
  healthOpen: true,
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
}));

vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  runCurrentHealthDataOperation: async (
    operation: (lease: { assertCurrent: () => void }) => unknown,
  ) => {
    if (!mocks.healthOpen) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    const generation = mocks.healthGeneration;
    const assertCurrent = () => {
      if (!mocks.healthOpen || generation !== mocks.healthGeneration) {
        throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
      }
    };
    const result = await operation({ assertCurrent });
    assertCurrent();
    return result;
  },
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
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
        if (mocks.closeAfterUpdate) mocks.healthGeneration += 1;
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'onskin.milestones.v1';

describe('streak milestone store', () => {
  beforeEach(() => {
    mocks.closeAfterUpdate = false;
    mocks.healthGeneration = 1;
    mocks.healthOpen = true;
    mocks.storage.clear();
    mocks.tails.clear();
  });

  it('preserves unreadable milestone bytes and refuses to overwrite them', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(markMilestoneSeen('d7')).resolves.toBe(false);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves unsupported future-version milestone bytes', async () => {
    const original = JSON.stringify({ version: 2, values: ['d7'] });
    mocks.storage.set(KEY, original);

    await expect(markMilestoneSeen('d30')).resolves.toBe(false);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('reads legacy values and migrates only during an explicit mutation', async () => {
    mocks.storage.set(KEY, JSON.stringify([' d7 ', '', 'd7', 7]));

    await expect(markMilestoneSeen('d7')).resolves.toBe(false);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({ version: 1, values: ['d7'] });
  });

  it('serializes simultaneous markers without firing the same milestone twice', async () => {
    const results = await Promise.all(Array.from({ length: 40 }, () => markMilestoneSeen('d7')));

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({ version: 1, values: ['d7'] });
  });

  it('ignores empty milestone keys', async () => {
    await expect(markMilestoneSeen('   ')).resolves.toBe(false);

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('does not publish a marker result across withdrawal and same-session re-grant', async () => {
    mocks.closeAfterUpdate = true;

    await expect(markMilestoneSeen('d7')).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
  });
});
