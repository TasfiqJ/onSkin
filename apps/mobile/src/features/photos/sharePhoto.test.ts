import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PHOTO_COPY } from './copy';
import { sharePhotoImageOnly } from './sharePhoto';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  alerts: [] as unknown[][],
  createPhotoShareFile: vi.fn(),
  deletePhotoShareFile: vi.fn(),
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: mocks.isAvailableAsync,
  shareAsync: mocks.shareAsync,
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: (...args: unknown[]) => {
      mocks.alerts.push(args);
    },
  },
}));

vi.mock('./encryptedStorage', () => ({
  createPhotoShareFile: mocks.createPhotoShareFile,
  deletePhotoShareFile: mocks.deletePhotoShareFile,
}));

describe('progress photo sharing', () => {
  beforeEach(() => {
    mocks.alerts = [];
    mocks.createPhotoShareFile.mockReset();
    mocks.deletePhotoShareFile.mockReset();
    mocks.isAvailableAsync.mockReset();
    mocks.shareAsync.mockReset();
    mocks.deletePhotoShareFile.mockResolvedValue(undefined);
  });

  it('opens the native share sheet with a temporary export and deletes it afterwards', async () => {
    mocks.isAvailableAsync.mockResolvedValueOnce(true);
    mocks.createPhotoShareFile.mockResolvedValueOnce('file://cache/onskin-share-photo-1.jpg');
    mocks.shareAsync.mockResolvedValueOnce(undefined);

    await expect(
      sharePhotoImageOnly({ id: 'photo-1', localUri: 'file://photos/photo-1.onskinphoto' }),
    ).resolves.toBe(true);

    expect(mocks.createPhotoShareFile).toHaveBeenCalledWith(
      'file://photos/photo-1.onskinphoto',
      'photo-1',
    );
    expect(mocks.shareAsync).toHaveBeenCalledWith('file://cache/onskin-share-photo-1.jpg');
    expect(mocks.deletePhotoShareFile).toHaveBeenCalledWith(
      'file://cache/onskin-share-photo-1.jpg',
      'file://photos/photo-1.onskinphoto',
    );
    expect(mocks.alerts).toEqual([]);
  });

  it('alerts without creating an export when no shareable photo URI exists', async () => {
    await expect(sharePhotoImageOnly({ id: 'photo-1', localUri: null })).resolves.toBe(false);

    expect(mocks.isAvailableAsync).not.toHaveBeenCalled();
    expect(mocks.createPhotoShareFile).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.alerts[0]).toEqual([
      PHOTO_COPY.detail.shareTitle,
      PHOTO_COPY.detail.shareUnavailable,
    ]);
  });

  it('alerts when native sharing is unavailable', async () => {
    mocks.isAvailableAsync.mockResolvedValueOnce(false);

    await expect(
      sharePhotoImageOnly({ id: 'photo-1', localUri: 'file://photos/photo-1.onskinphoto' }),
    ).resolves.toBe(false);

    expect(mocks.createPhotoShareFile).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.alerts[0]).toEqual([
      PHOTO_COPY.detail.shareTitle,
      PHOTO_COPY.detail.shareUnavailable,
    ]);
  });

  it('alerts and deletes the temporary export when the share sheet rejects', async () => {
    mocks.isAvailableAsync.mockResolvedValueOnce(true);
    mocks.createPhotoShareFile.mockResolvedValueOnce('file://cache/onskin-share-photo-1.jpg');
    mocks.shareAsync.mockRejectedValueOnce(new Error('share unavailable'));

    await expect(
      sharePhotoImageOnly({ id: 'photo-1', localUri: 'file://photos/photo-1.onskinphoto' }),
    ).resolves.toBe(false);

    expect(mocks.deletePhotoShareFile).toHaveBeenCalledWith(
      'file://cache/onskin-share-photo-1.jpg',
      'file://photos/photo-1.onskinphoto',
    );
    expect(mocks.alerts[0]).toEqual([
      PHOTO_COPY.detail.shareTitle,
      PHOTO_COPY.detail.shareUnavailable,
    ]);
  });

  it('alerts when temporary export creation fails', async () => {
    mocks.isAvailableAsync.mockResolvedValueOnce(true);
    mocks.createPhotoShareFile.mockRejectedValueOnce(new Error('cache unavailable'));

    await expect(
      sharePhotoImageOnly({ id: 'photo-1', localUri: 'file://photos/photo-1.onskinphoto' }),
    ).resolves.toBe(false);

    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.deletePhotoShareFile).toHaveBeenCalledWith(
      null,
      'file://photos/photo-1.onskinphoto',
    );
    expect(mocks.alerts[0]).toEqual([
      PHOTO_COPY.detail.shareTitle,
      PHOTO_COPY.detail.shareUnavailable,
    ]);
  });

  it('keeps the photo detail route on the shared failure-handled share helper', () => {
    const source = readSource('app/progress/[id].tsx');

    expect(source).toContain('sharePhotoImageOnly(photo)');
    expect(source).not.toContain("import * as Sharing from 'expo-sharing'");
    expect(source).not.toContain('createPhotoShareFile');
    expect(source).not.toContain('deletePhotoShareFile');
  });
});
