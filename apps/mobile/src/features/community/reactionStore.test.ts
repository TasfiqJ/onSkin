import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isNoteHelpful, toggleNoteHelpful } from './reactionStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
}));

const KEY = 'onskin.community.reactions.v1';

describe('community reaction store', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('removes unreadable local reaction JSON and treats the note as unreacted', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(isNoteHelpful('note-a')).resolves.toBe(false);

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('removes wrong-shaped local reaction records', async () => {
    mocks.storage.set(KEY, JSON.stringify({ id: 'note-a' }));

    await expect(isNoteHelpful('note-a')).resolves.toBe(false);

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('normalizes duplicate and padded note ids before reading reactions', async () => {
    mocks.storage.set(KEY, JSON.stringify([' note-a ', '', 'note-a', 7, 'note-b']));

    await expect(isNoteHelpful('note-a')).resolves.toBe(true);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual(['note-a', 'note-b']);
  });

  it('trims toggled ids and ignores empty ids', async () => {
    await expect(toggleNoteHelpful(' note-a ')).resolves.toBe(true);
    await expect(toggleNoteHelpful('   ')).resolves.toBe(false);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual(['note-a']);
  });
});
