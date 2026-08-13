import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isSensitiveImageDiskCacheMigrationComplete,
  prepareSensitiveImageDiskCacheMigration,
} from './sensitiveImageDiskCache';

const mocks = vi.hoisted(() => ({
  clearDiskCache: vi.fn<() => Promise<boolean>>(),
}));

vi.mock('expo-image', () => ({
  Image: { clearDiskCache: mocks.clearDiskCache },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('sensitive image legacy disk-cache migration', () => {
  beforeEach(() => {
    mocks.clearDiskCache.mockReset();
  });

  it('fails closed, retries a false clear, and runs only once after success', async () => {
    mocks.clearDiskCache.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    expect(isSensitiveImageDiskCacheMigrationComplete()).toBe(false);
    await expect(prepareSensitiveImageDiskCacheMigration()).resolves.toBe(false);
    expect(isSensitiveImageDiskCacheMigrationComplete()).toBe(false);
    await expect(prepareSensitiveImageDiskCacheMigration()).resolves.toBe(true);
    await expect(prepareSensitiveImageDiskCacheMigration()).resolves.toBe(true);

    expect(isSensitiveImageDiskCacheMigrationComplete()).toBe(true);
    expect(mocks.clearDiskCache).toHaveBeenCalledTimes(2);
  });
});
