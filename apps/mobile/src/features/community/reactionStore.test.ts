import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isNoteHelpful, toggleNoteHelpful } from './reactionStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
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
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'onskin.community.reactions.v1';

describe('community reaction store', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.tails.clear();
  });

  it('preserves unreadable reaction bytes and refuses to overwrite them', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(isNoteHelpful('note-a')).resolves.toBe(false);
    await expect(toggleNoteHelpful('note-a')).resolves.toBe(false);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves unsupported future-version reaction bytes', async () => {
    const original = JSON.stringify({ version: 2, values: ['note-a'] });
    mocks.storage.set(KEY, original);

    await expect(isNoteHelpful('note-a')).resolves.toBe(false);
    await expect(toggleNoteHelpful('note-a')).resolves.toBe(false);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('normalizes legacy note ids in memory without rewriting an ordinary read', async () => {
    const original = JSON.stringify([' note-a ', '', 'note-a', 7, 'note-b']);
    mocks.storage.set(KEY, original);

    await expect(isNoteHelpful('note-a')).resolves.toBe(true);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('trims toggled ids and ignores empty ids', async () => {
    await expect(toggleNoteHelpful(' note-a ')).resolves.toBe(true);
    await expect(toggleNoteHelpful('   ')).resolves.toBe(false);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      values: ['note-a'],
    });
  });

  it('serializes simultaneous toggles without losing an update', async () => {
    const results = await Promise.all([
      toggleNoteHelpful('note-a'),
      toggleNoteHelpful('note-b'),
      toggleNoteHelpful('note-c'),
    ]);

    expect(results).toEqual([true, true, true]);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      values: ['note-a', 'note-b', 'note-c'],
    });
  });
});
