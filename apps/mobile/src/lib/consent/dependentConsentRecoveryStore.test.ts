import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearOwnerDependentConsentRecoveryRaw,
  clearOwnerDependentConsentRecoveryRawByBinding,
  readDependentConsentRecoveryRaw,
  resetDependentConsentRecoverySerializationForTests,
  writeDependentConsentRecoveryRaw,
} from './dependentConsentRecoveryStore';

const mocks = vi.hoisted(() => ({
  secure: new Map<string, string>(),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  isAvailableAsync: vi.fn(async () => true),
  getItemAsync: vi.fn(async (key: string) => mocks.secure.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    mocks.secure.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mocks.secure.delete(key);
  }),
}));
vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: vi.fn(async (owner: string) => {
    if (owner === 'owner-a') return 'a'.repeat(64);
    if (owner === 'owner-b') return 'b'.repeat(64);
    const suffix = owner.match(/^owner-([0-9])$/u)?.[1];
    return suffix ? suffix.repeat(64) : 'f'.repeat(64);
  }),
}));

describe('owner-scoped dependent consent recovery store', () => {
  beforeEach(() => {
    mocks.secure.clear();
    resetDependentConsentRecoverySerializationForTests();
  });

  it('preserves A across sign-out while B operates independently and A later resumes', async () => {
    await writeDependentConsentRecoveryRaw('owner-a', 'data_sharing', 'pending-a');

    // Ordinary sign-out intentionally performs no recovery-store deletion.
    resetDependentConsentRecoverySerializationForTests();
    await expect(
      readDependentConsentRecoveryRaw('owner-b', 'data_sharing'),
    ).resolves.toBeNull();
    await writeDependentConsentRecoveryRaw('owner-b', 'data_sharing', 'pending-b');
    await expect(
      readDependentConsentRecoveryRaw('owner-b', 'data_sharing'),
    ).resolves.toBe('pending-b');

    resetDependentConsentRecoverySerializationForTests();
    await expect(
      readDependentConsentRecoveryRaw('owner-a', 'data_sharing'),
    ).resolves.toBe('pending-a');
  });

  it('clears only the exact terminal owner and preserves every foreign capability', async () => {
    await writeDependentConsentRecoveryRaw('owner-a', 'ask_onskin', 'pending-a');
    await writeDependentConsentRecoveryRaw('owner-b', 'ask_onskin', 'pending-b');

    await clearOwnerDependentConsentRecoveryRaw('owner-b');

    await expect(
      readDependentConsentRecoveryRaw('owner-b', 'ask_onskin'),
    ).resolves.toBeNull();
    await expect(
      readDependentConsentRecoveryRaw('owner-a', 'ask_onskin'),
    ).resolves.toBe('pending-a');
  });

  it('accepts the exact durable owner binding after terminal account deletion', async () => {
    await writeDependentConsentRecoveryRaw('owner-a', 'ask_onskin', 'pending-a');
    await writeDependentConsentRecoveryRaw('owner-b', 'ask_onskin', 'pending-b');

    await clearOwnerDependentConsentRecoveryRawByBinding('a'.repeat(64));

    await expect(
      readDependentConsentRecoveryRaw('owner-a', 'ask_onskin'),
    ).resolves.toBeNull();
    await expect(
      readDependentConsentRecoveryRaw('owner-b', 'ask_onskin'),
    ).resolves.toBe('pending-b');
  });

  it('has no owner index or capacity ceiling that can strand a ninth user', async () => {
    for (let index = 0; index < 10; index += 1) {
      await expect(
        writeDependentConsentRecoveryRaw(
          `owner-${index}`,
          'data_sharing',
          `pending-${index}`,
        ),
      ).resolves.toBeUndefined();
    }

    for (let index = 0; index < 10; index += 1) {
      await expect(
        readDependentConsentRecoveryRaw(`owner-${index}`, 'data_sharing'),
      ).resolves.toBe(`pending-${index}`);
    }
  });
});
