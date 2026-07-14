import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as privateKV from '@/lib/storage/privateKV';

import {
  COMMUNITY_REACTIONS_INVALID,
  COMMUNITY_REACTIONS_UNAVAILABLE,
  COMMUNITY_REACTIONS_UNSUPPORTED_VERSION,
  isNoteHelpful,
  readCommunityReactions,
  setNoteHelpful,
} from './reactionStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  readStatus: null as null | 'unavailable' | 'corrupt' | 'unsupported_version',
  updateFailure: null as Error | null,
  updateFailureAfterCommit: null as Error | null,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    if (mocks.readStatus === 'unavailable') {
      return { status: 'unavailable', reason: 'storage_unavailable' };
    }
    if (mocks.readStatus === 'corrupt') {
      return { status: 'corrupt', reason: 'decryption_failed' };
    }
    if (mocks.readStatus === 'unsupported_version') return { status: 'unsupported_version' };
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
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
        if (mocks.updateFailureAfterCommit) throw mocks.updateFailureAfterCommit;
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'onskin.community.reactions.v1';
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

describe('community reaction store', () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_REACTION_STORAGE_FAILURE;
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readStatus = null;
    mocks.updateFailure = null;
    mocks.updateFailureAfterCommit = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_REACTION_STORAGE_FAILURE;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('exposes the dev-only unavailable fixture without consulting or changing storage', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_REACTION_STORAGE_FAILURE = 'always';

    await expect(readCommunityReactions()).resolves.toEqual({
      status: 'unavailable',
      noteIds: null,
    });

    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.size).toBe(0);
  });

  it('ignores the unavailable fixture outside development builds', async () => {
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_REACTION_STORAGE_FAILURE = 'always';

    await expect(readCommunityReactions()).resolves.toEqual({ status: 'absent', noteIds: [] });

    expect(privateKV.readPrivateItem).toHaveBeenCalledWith(KEY);
  });

  it('returns typed corruption and preserves malformed reaction bytes', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(readCommunityReactions()).resolves.toEqual({ status: 'corrupt', noteIds: null });
    await expect(isNoteHelpful('note-a')).rejects.toThrow(COMMUNITY_REACTIONS_INVALID);
    await expect(setNoteHelpful('note-a', true)).rejects.toThrow('PRIVATE_STRING_SET_INVALID');

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves unsupported future-version reaction bytes', async () => {
    const original = JSON.stringify({ version: 2, values: ['note-a'] });
    mocks.storage.set(KEY, original);

    await expect(readCommunityReactions()).resolves.toEqual({
      status: 'unsupported_version',
      noteIds: null,
    });
    await expect(isNoteHelpful('note-a')).rejects.toThrow(COMMUNITY_REACTIONS_UNSUPPORTED_VERSION);
    await expect(setNoteHelpful('note-a', true)).rejects.toThrow(
      'PRIVATE_STRING_SET_UNSUPPORTED_VERSION',
    );

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('distinguishes unavailable private storage from an absent reaction set', async () => {
    await expect(readCommunityReactions()).resolves.toEqual({ status: 'absent', noteIds: [] });
    await expect(isNoteHelpful('note-a')).resolves.toBe(false);

    mocks.readStatus = 'unavailable';
    await expect(readCommunityReactions()).resolves.toEqual({
      status: 'unavailable',
      noteIds: null,
    });
    await expect(isNoteHelpful('note-a')).rejects.toThrow(COMMUNITY_REACTIONS_UNAVAILABLE);
  });

  it('forwards private envelope corruption and future-version status', async () => {
    mocks.readStatus = 'corrupt';
    await expect(readCommunityReactions()).resolves.toEqual({ status: 'corrupt', noteIds: null });

    mocks.readStatus = 'unsupported_version';
    await expect(readCommunityReactions()).resolves.toEqual({
      status: 'unsupported_version',
      noteIds: null,
    });
  });

  it('reads a strict legacy note-id set without rewriting an ordinary read', async () => {
    const original = JSON.stringify(['note-a', 'note-b']);
    mocks.storage.set(KEY, original);

    await expect(isNoteHelpful('note-a')).resolves.toBe(true);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves semantically malformed legacy note ids as corruption', async () => {
    const original = JSON.stringify([' note-a ', '', 'note-a', 7, 'note-b']);
    mocks.storage.set(KEY, original);

    await expect(readCommunityReactions()).resolves.toEqual({ status: 'corrupt', noteIds: null });
    await expect(setNoteHelpful('note-c', true)).rejects.toThrow('PRIVATE_STRING_SET_INVALID');

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('trims desired ids and ignores empty ids', async () => {
    await expect(setNoteHelpful(' note-a ', true)).resolves.toBe(true);
    await expect(setNoteHelpful('   ', true)).resolves.toBe(false);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      values: ['note-a'],
    });
  });

  it('serializes simultaneous desired-state writes without losing an update', async () => {
    const results = await Promise.all([
      setNoteHelpful('note-a', true),
      setNoteHelpful('note-b', true),
      setNoteHelpful('note-c', true),
    ]);

    expect(results).toEqual([true, true, true]);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      values: ['note-a', 'note-b', 'note-c'],
    });
  });

  it('rejects a failed desired-state write without publishing the opposite durable state', async () => {
    mocks.storage.set(KEY, JSON.stringify({ version: 1, values: ['note-a'] }));
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(setNoteHelpful('note-a', false)).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      values: ['note-a'],
    });
  });

  it('retries an ambiguously committed write idempotently', async () => {
    mocks.updateFailureAfterCommit = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');

    await expect(setNoteHelpful('note-a', true)).rejects.toThrow('PRIVATE_WRITE_RESULT_UNKNOWN');
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      values: ['note-a'],
    });

    mocks.updateFailureAfterCommit = null;
    await expect(setNoteHelpful('note-a', true)).resolves.toBe(true);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      values: ['note-a'],
    });
  });
});
