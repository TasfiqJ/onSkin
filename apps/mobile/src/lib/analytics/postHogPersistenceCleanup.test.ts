import { describe, expect, it, vi } from 'vitest';

import {
  LEGACY_POSTHOG_STORAGE_KEYS,
  purgePostHogPersistenceWithDeps,
} from './postHogPersistenceCleanup';

describe('legacy PostHog persistence cleanup', () => {
  it('removes event and log files plus the AsyncStorage fallback', async () => {
    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const fileExists = vi.fn().mockResolvedValue(false);
    const removeStorageKeys = vi.fn().mockResolvedValue(undefined);
    const readStorageKeys = vi
      .fn()
      .mockResolvedValue(LEGACY_POSTHOG_STORAGE_KEYS.map((key) => [key, null] as const));

    await expect(
      purgePostHogPersistenceWithDeps({
        documentDirectory: 'file://documents/',
        deleteFile,
        fileExists,
        removeStorageKeys,
        readStorageKeys,
      }),
    ).resolves.toBeUndefined();

    expect(deleteFile.mock.calls).toEqual([
      ['file://documents/.posthog-rn.json'],
      ['file://documents/.posthog-rn-logs.json'],
    ]);
    expect(removeStorageKeys).toHaveBeenCalledWith(LEGACY_POSTHOG_STORAGE_KEYS);
    expect(fileExists.mock.calls).toEqual([
      ['file://documents/.posthog-rn.json'],
      ['file://documents/.posthog-rn-logs.json'],
    ]);
    expect(readStorageKeys).toHaveBeenCalledWith(LEGACY_POSTHOG_STORAGE_KEYS);
  });

  it('still removes AsyncStorage keys when file persistence is unavailable', async () => {
    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const fileExists = vi.fn().mockResolvedValue(false);
    const removeStorageKeys = vi.fn().mockResolvedValue(undefined);
    const readStorageKeys = vi
      .fn()
      .mockResolvedValue(LEGACY_POSTHOG_STORAGE_KEYS.map((key) => [key, null] as const));

    await purgePostHogPersistenceWithDeps({
      documentDirectory: null,
      deleteFile,
      fileExists,
      removeStorageKeys,
      readStorageKeys,
    });

    expect(deleteFile).not.toHaveBeenCalled();
    expect(fileExists).not.toHaveBeenCalled();
    expect(removeStorageKeys).toHaveBeenCalledWith(LEGACY_POSTHOG_STORAGE_KEYS);
  });

  it('attempts every backend and reports stable failure labels', async () => {
    const deleteFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('private path'))
      .mockResolvedValueOnce(undefined);
    const removeStorageKeys = vi.fn().mockRejectedValueOnce(new Error('private storage'));
    const fileExists = vi.fn().mockResolvedValue(false);
    const readStorageKeys = vi
      .fn()
      .mockResolvedValue(LEGACY_POSTHOG_STORAGE_KEYS.map((key) => [key, null] as const));

    await expect(
      purgePostHogPersistenceWithDeps({
        documentDirectory: 'file://documents/',
        deleteFile,
        fileExists,
        removeStorageKeys,
        readStorageKeys,
      }),
    ).rejects.toThrow('POSTHOG_LOCAL_PURGE_FAILED:events_file,async_storage');

    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(removeStorageKeys).toHaveBeenCalledTimes(1);
  });

  it('fails closed when either backend still contains PostHog data', async () => {
    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const fileExists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const removeStorageKeys = vi.fn().mockResolvedValue(undefined);
    const readStorageKeys = vi.fn().mockResolvedValue([
      ['.posthog-rn.json', '{"content":{"queue":["sentinel"]}}'],
      ['.posthog-rn-logs.json', null],
    ]);

    await expect(
      purgePostHogPersistenceWithDeps({
        documentDirectory: 'file://documents/',
        deleteFile,
        fileExists,
        removeStorageKeys,
        readStorageKeys,
      }),
    ).rejects.toThrow('POSTHOG_LOCAL_PURGE_FAILED:events_file_verify,async_storage_verify');
  });
});
