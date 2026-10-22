import { beforeEach, expect, it, vi } from 'vitest';
import {
  erasePhotoDeleteRemoteCleanupForBinding,
  PHOTO_DELETE_CLEANUP_VAULT_KEY_PREFIX,
} from './photoDeleteRemoteCleanup';

const native = vi.hoisted(() => ({
  platform: 'web',
  bytes: new Map<string, string>(),
  remove: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return native.platform;
    },
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async (key: string) => native.bytes.get(key) ?? null },
}));
vi.mock('@/lib/supabase/largeSecureStore', () => ({
  LargeSecureStore: class {
    removeItem = native.remove;
  },
}));
vi.mock('@/lib/auth/sessionOwner', () => ({ localDataOwnerBinding: vi.fn() }));
vi.mock('./photoDeleteJournal', () => ({ notifyPhotoDeleteChanges: vi.fn() }));
const binding = 'a'.repeat(64);
beforeEach(() => {
  native.platform = 'web';
  native.bytes.clear();
  native.remove.mockReset();
});

it('proves an absent native-only photo vault on web without an unavailable SecureStore call', async () => {
  native.remove.mockRejectedValue(new Error('SecureStore unavailable'));
  await expect(erasePhotoDeleteRemoteCleanupForBinding(binding)).resolves.toBeUndefined();
  expect(native.remove).not.toHaveBeenCalled();
});
it('preserves unexpected web vault bytes and reports a blocked cleanup', async () => {
  const key = PHOTO_DELETE_CLEANUP_VAULT_KEY_PREFIX + binding;
  native.bytes.set(key, 'retained unsupported ciphertext');
  await expect(erasePhotoDeleteRemoteCleanupForBinding(binding)).rejects.toThrow(
    'PHOTO_DELETE_CLEANUP_WEB_STORAGE_UNSUPPORTED',
  );
  expect(native.bytes.get(key)).toBe('retained unsupported ciphertext');
  expect(native.remove).not.toHaveBeenCalled();
});
it('propagates native erasure failures for the exact binding', async () => {
  native.platform = 'ios';
  native.remove.mockRejectedValue(new Error('native unavailable'));
  await expect(erasePhotoDeleteRemoteCleanupForBinding(binding)).rejects.toThrow(
    'native unavailable',
  );
  expect(native.remove).toHaveBeenCalledExactlyOnceWith(
    PHOTO_DELETE_CLEANUP_VAULT_KEY_PREFIX + binding,
  );
});
