import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { runCurrentHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { endPrivateKVAccountBoundary } from '@/lib/storage/privateKV';
import {
  PHOTO_DELETE_JOURNAL_KEY,
  readPhotoDeleteJournal,
  writePhotoDeleteJournal,
  type PhotoDeleteCommand,
} from './photoDeleteJournal';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  keys: new Map<string, string>(),
}));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => mocks.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mocks.storage.set(key, value);
    },
    removeItem: async (key: string) => {
      mocks.storage.delete(key);
    },
    getAllKeys: async () => [...mocks.storage.keys()],
    multiGet: async (keys: string[]) => keys.map((key) => [key, mocks.storage.get(key) ?? null]),
    multiRemove: async (keys: string[]) => {
      for (const key of keys) mocks.storage.delete(key);
    },
  },
}));
vi.mock('expo-secure-store', () => ({
  isAvailableAsync: async () => true,
  getItemAsync: async (key: string) => mocks.keys.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mocks.keys.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mocks.keys.delete(key);
  },
}));
const command: PhotoDeleteCommand = {
  operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  photoId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ownerUserId: 'owner-a',
  epoch: 1,
  phase: 'prepared',
  remotePending: true,
  needsAttention: false,
  files: ['file://document/photos/v1/private-original.layerwellphoto'],
};
async function grant(ownerUserId = 'owner-a') {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId, accountGeneration });
}
beforeEach(async () => {
  mocks.storage.clear();
  mocks.keys.clear();
  endPrivateKVAccountBoundary();
  clearActiveHealthProcessingEpoch();
  await grant();
});
afterEach(() => clearActiveHealthProcessingEpoch());

describe.sequential('C-08B2 journal uses the real encrypted private KV protocol', () => {
  it('encrypts owner, operation, photo and native paths at rest and reads the exact command back', async () => {
    await runCurrentHealthDataOperation((lease) => writePhotoDeleteJournal([command], lease));
    const raw = mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY)!;
    expect(raw).not.toContain(command.operationId);
    expect(raw).not.toContain(command.photoId);
    expect(raw).not.toContain(command.ownerUserId);
    expect(raw).not.toContain('file:');
    expect(raw).not.toContain('private-original');
    expect(JSON.parse(raw)).not.toHaveProperty('commands');
    expect(await runCurrentHealthDataOperation((lease) => readPhotoDeleteJournal(lease))).toEqual([
      command,
    ]);
  });

  it('preserves unreadable encrypted intent when the content key is unavailable', async () => {
    await runCurrentHealthDataOperation((lease) => writePhotoDeleteJournal([command], lease));
    const raw = mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY);
    const savedKeys = new Map(mocks.keys);
    mocks.keys.clear();
    await expect(
      runCurrentHealthDataOperation((lease) => readPhotoDeleteJournal(lease)),
    ).rejects.toThrow();
    expect(mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY)).toBe(raw);
    expect(mocks.keys.size).toBe(0);
    for (const [key, value] of savedKeys) mocks.keys.set(key, value);
    expect(await runCurrentHealthDataOperation((lease) => readPhotoDeleteJournal(lease))).toEqual([
      command,
    ]);
  });

  it('rejects and preserves a foreign owner journal rather than adopting or overwriting it', async () => {
    await runCurrentHealthDataOperation((lease) => writePhotoDeleteJournal([command], lease));
    const raw = mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY);
    await grant('owner-b');
    await expect(
      runCurrentHealthDataOperation((lease) => readPhotoDeleteJournal(lease)),
    ).rejects.toThrow('PHOTO_DELETE_JOURNAL_AUTHORITY_MISMATCH');
    expect(mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY)).toBe(raw);
  });

  it('refuses closed health authority before reading or writing the durable journal', async () => {
    await runCurrentHealthDataOperation((lease) => writePhotoDeleteJournal([command], lease));
    const raw = mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY);
    clearActiveHealthProcessingEpoch();
    await expect(
      runCurrentHealthDataOperation((lease) => readPhotoDeleteJournal(lease)),
    ).rejects.toThrow();
    await expect(
      runCurrentHealthDataOperation((lease) => writePhotoDeleteJournal([], lease)),
    ).rejects.toThrow();
    expect(mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY)).toBe(raw);
  });
});
