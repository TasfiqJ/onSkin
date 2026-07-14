import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MilestoneKey } from './milestones';
import type { PrivateKVReadResult } from '@/lib/storage/privateKV';
import * as privateKV from '@/lib/storage/privateKV';

import {
  markMilestoneSeen,
  MILESTONES_INVALID,
  MILESTONES_UNSUPPORTED_VERSION,
  MILESTONES_WRITE_UNCERTAIN,
  readMilestonesSeen,
} from './milestoneStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  readOverride: null as PrivateKVReadResult | null,
  updateFailure: null as Error | null,
  updateFailureAfterTransform: null as Error | null,
  updateFailureAfterCommit: null as Error | null,
  writes: 0,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    if (mocks.readOverride) return mocks.readOverride;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
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
        if (mocks.updateFailure) throw mocks.updateFailure;
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (mocks.updateFailureAfterTransform) throw mocks.updateFailureAfterTransform;
        if (next !== current) {
          mocks.writes += 1;
          if (next === null) mocks.storage.delete(key);
          else mocks.storage.set(key, next);
        }
        if (mocks.updateFailureAfterCommit) throw mocks.updateFailureAfterCommit;
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
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readOverride = null;
    mocks.updateFailure = null;
    mocks.updateFailureAfterTransform = null;
    mocks.updateFailureAfterCommit = null;
    mocks.writes = 0;
    vi.clearAllMocks();
  });

  it('distinguishes a valid absent set without writing', async () => {
    await expect(readMilestonesSeen()).resolves.toEqual({ status: 'absent', keys: [] });

    expect(privateKV.readPrivateItem).toHaveBeenCalledWith(KEY);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
  });

  it('reads strict current and legacy records without migrating or rewriting either', async () => {
    for (const [raw, expected] of [
      [
        JSON.stringify({ version: 1, values: ['d7', 'd30'] }),
        { status: 'available', keys: ['d7', 'd30'], format: 'current' },
      ],
      [
        JSON.stringify(['d7', 'one_cycle']),
        { status: 'available', keys: ['d7', 'one_cycle'], format: 'legacy' },
      ],
    ] as const) {
      mocks.storage.set(KEY, raw);

      await expect(readMilestonesSeen()).resolves.toEqual(expected);

      expect(mocks.storage.get(KEY)).toBe(raw);
    }

    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
  });

  it.each([
    [
      { status: 'unavailable', reason: 'content_key_missing' } as const,
      { status: 'unavailable', keys: null, reason: 'content_key_missing' },
    ],
    [
      { status: 'corrupt', reason: 'decryption_failed' } as const,
      { status: 'corrupt', keys: null, reason: 'decryption_failed' },
    ],
    [{ status: 'unsupported_version' } as const, { status: 'unsupported_version', keys: null }],
  ])('forwards typed private state %# without writing', async (stored, expected) => {
    mocks.readOverride = stored;

    await expect(readMilestonesSeen()).resolves.toEqual(expected);

    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
  });

  it('classifies an unexpected private read rejection as unavailable', async () => {
    vi.mocked(privateKV.readPrivateItem).mockRejectedValueOnce(new Error('READ_FAILED'));

    await expect(readMilestonesSeen()).resolves.toEqual({
      status: 'unavailable',
      keys: null,
      reason: 'storage_unavailable',
    });
  });

  it.each([
    ['malformed JSON', '{not-json', 'corrupt'],
    ['semantically malformed legacy values', JSON.stringify([' d7 ', '', 'd7', 7]), 'corrupt'],
    ['unknown milestone keys', JSON.stringify({ version: 1, values: ['d7', 'd66'] }), 'corrupt'],
    ['oversized records', `${' '.repeat(4_097)}[]`, 'corrupt'],
    [
      'future schema versions',
      JSON.stringify({ version: 2, values: ['d7'] }),
      'unsupported_version',
    ],
  ])('preserves %s as typed %s state', async (_label, raw, status) => {
    mocks.storage.set(KEY, raw);

    const result = await readMilestonesSeen();

    expect(result.status).toBe(status);
    if (status === 'corrupt') {
      expect(result).toEqual({ status: 'corrupt', keys: null, reason: 'invalid_payload' });
    } else {
      expect(result).toEqual({ status: 'unsupported_version', keys: null });
    }
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
  });

  it('rejects invalid runtime keys before any storage I/O', async () => {
    for (const value of ['', ' d7 ', 'unknown', 7] as const) {
      await expect(markMilestoneSeen(value as unknown as MilestoneKey)).rejects.toThrow(
        MILESTONES_INVALID,
      );
    }

    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
  });

  it('migrates a strict legacy record only while recording a real new crossing', async () => {
    mocks.storage.set(KEY, JSON.stringify(['d7']));

    await expect(markMilestoneSeen('d30')).resolves.toEqual({
      status: 'recorded',
      key: 'd30',
    });

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      values: ['d7', 'd30'],
    });
    expect(mocks.writes).toBe(1);
  });

  it('returns an explicit already-seen result and performs zero equal writes', async () => {
    const original = JSON.stringify({ version: 1, values: ['d7'] });
    mocks.storage.set(KEY, original);

    await expect(markMilestoneSeen('d7')).resolves.toEqual({
      status: 'already_seen',
      key: 'd7',
    });

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it.each([
    ['malformed', '{not-json', MILESTONES_INVALID],
    [
      'future-version',
      JSON.stringify({ version: 2, values: ['d7'] }),
      MILESTONES_UNSUPPORTED_VERSION,
    ],
  ])(
    'rejects rather than collapsing a %s mutation and preserves exact bytes',
    async (_label, raw, code) => {
      mocks.storage.set(KEY, raw);

      await expect(markMilestoneSeen('d30')).rejects.toThrow(code);

      expect(mocks.storage.get(KEY)).toBe(raw);
      expect(mocks.writes).toBe(0);
    },
  );

  it('serializes 100 simultaneous markers with exactly one recorded result', async () => {
    const results = await Promise.all(Array.from({ length: 100 }, () => markMilestoneSeen('d7')));

    expect(results.filter((result) => result.status === 'recorded')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'already_seen')).toHaveLength(99);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({ version: 1, values: ['d7'] });
    expect(mocks.writes).toBe(1);
  });

  it('leaves the prior bytes intact when the atomic write fails', async () => {
    const original = JSON.stringify({ version: 1, values: ['d7'] });
    mocks.storage.set(KEY, original);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(markMilestoneSeen('d30')).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('recovers a recorded result when a lost commit response is confirmed byte-for-byte', async () => {
    const original = JSON.stringify({ version: 1, values: ['d7'] });
    const committed = JSON.stringify({ version: 1, values: ['d7', 'd30'] });
    mocks.storage.set(KEY, original);
    mocks.updateFailureAfterCommit = new Error('COMMIT_RESPONSE_LOST');

    await expect(markMilestoneSeen('d30')).resolves.toEqual({
      status: 'recorded',
      key: 'd30',
    });

    expect(mocks.storage.get(KEY)).toBe(committed);
    expect(privateKV.readPrivateItem).toHaveBeenCalledWith(KEY);
    expect(mocks.writes).toBe(1);
  });

  it('rejects as uncertain when a lost response reads back different bytes', async () => {
    const original = JSON.stringify({ version: 1, values: ['d7'] });
    mocks.storage.set(KEY, original);
    mocks.updateFailureAfterTransform = new Error('WRITE_RESPONSE_LOST');

    await expect(markMilestoneSeen('d30')).rejects.toThrow(MILESTONES_WRITE_UNCERTAIN);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(privateKV.readPrivateItem).toHaveBeenCalledWith(KEY);
    expect(mocks.writes).toBe(0);
  });

  it('rejects as uncertain when commit confirmation is unavailable', async () => {
    mocks.updateFailureAfterCommit = new Error('COMMIT_RESPONSE_LOST');
    mocks.readOverride = { status: 'unavailable', reason: 'content_key_missing' };

    await expect(markMilestoneSeen('d7')).rejects.toThrow(MILESTONES_WRITE_UNCERTAIN);

    expect(privateKV.readPrivateItem).toHaveBeenCalledWith(KEY);
    expect(mocks.writes).toBe(1);
  });

  it('rejects as uncertain when commit confirmation itself rejects', async () => {
    mocks.updateFailureAfterCommit = new Error('COMMIT_RESPONSE_LOST');
    vi.mocked(privateKV.readPrivateItem).mockRejectedValueOnce(new Error('READBACK_FAILED'));

    await expect(markMilestoneSeen('d7')).rejects.toThrow(MILESTONES_WRITE_UNCERTAIN);

    expect(privateKV.readPrivateItem).toHaveBeenCalledWith(KEY);
    expect(mocks.writes).toBe(1);
  });
});
