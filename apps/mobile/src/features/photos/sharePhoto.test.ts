import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sharePhotoImageOnly } from './sharePhoto';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  createPhotoShareFile: vi.fn(),
  deletePhotoShareFile: vi.fn(),
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: mocks.isAvailableAsync,
  shareAsync: mocks.shareAsync,
}));

vi.mock('./encryptedStorage', () => ({
  createPhotoShareFile: mocks.createPhotoShareFile,
  deletePhotoShareFile: mocks.deletePhotoShareFile,
}));

describe('progress photo sharing', () => {
  beforeEach(() => {
    mocks.createPhotoShareFile.mockReset();
    mocks.deletePhotoShareFile.mockReset();
    mocks.isAvailableAsync.mockReset();
    mocks.shareAsync.mockReset();
    mocks.deletePhotoShareFile.mockResolvedValue(undefined);
    delete process.env.EXPO_PUBLIC_E2E_SHARE_PHOTO_FAILURE;
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
  });

  it('returns false without creating an export when no shareable photo URI exists', async () => {
    await expect(sharePhotoImageOnly({ id: 'photo-1', localUri: null })).resolves.toBe(false);

    expect(mocks.isAvailableAsync).not.toHaveBeenCalled();
    expect(mocks.createPhotoShareFile).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('returns false when native sharing is unavailable', async () => {
    mocks.isAvailableAsync.mockResolvedValueOnce(false);

    await expect(
      sharePhotoImageOnly({ id: 'photo-1', localUri: 'file://photos/photo-1.onskinphoto' }),
    ).resolves.toBe(false);

    expect(mocks.createPhotoShareFile).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('supports a dev-only E2E fixture for failed photo sharing', async () => {
    const globalWithDev = globalThis as typeof globalThis & { __DEV__?: boolean };
    const previousDev = globalWithDev.__DEV__;
    globalWithDev.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_SHARE_PHOTO_FAILURE = '1';

    try {
      await expect(
        sharePhotoImageOnly({ id: 'photo-1', localUri: 'file://photos/photo-1.onskinphoto' }),
      ).resolves.toBe(false);
    } finally {
      if (previousDev === undefined) {
        delete globalWithDev.__DEV__;
      } else {
        globalWithDev.__DEV__ = previousDev;
      }
      delete process.env.EXPO_PUBLIC_E2E_SHARE_PHOTO_FAILURE;
    }

    expect(mocks.isAvailableAsync).not.toHaveBeenCalled();
    expect(mocks.createPhotoShareFile).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('returns false and deletes the temporary export when the share sheet rejects', async () => {
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
  });

  it('returns false when temporary export creation fails', async () => {
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
  });

  it('keeps the photo detail route on the shared failure-handled share helper', () => {
    const source = readSource('app/progress/[id].tsx');

    expect(source).toContain('const [shareConfirmVisible, setShareConfirmVisible] = useState(false);');
    expect(source).toContain('const [shareFeedback, setShareFeedback] = useState<string | null>(null);');
    expect(source).toContain('setShareConfirmVisible(true);');
    expect(source).toContain('setShareConfirmVisible(false);');
    expect(source).toContain('const shared = await sharePhotoImageOnly(photo);');
    expect(source).toContain('if (!shared) {');
    expect(source).toContain('setShareFeedback(PHOTO_COPY.detail.shareUnavailable);');
    expect(source).toContain('nudgeActionFeedbackIntoView();');
    expect(source).toContain('onPress={() => void shareCurrentPhoto()}');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).not.toContain('Alert.alert(PHOTO_COPY.detail.shareTitle');
    expect(source).not.toContain("import * as Sharing from 'expo-sharing'");
    expect(source).not.toContain('createPhotoShareFile');
    expect(source).not.toContain('deletePhotoShareFile');
  });

  it('keeps the share helper UI-free so routes own recovery feedback', () => {
    const source = readSource('features/photos/sharePhoto.ts');

    expect(source).not.toContain('Alert.alert');
    expect(source).not.toContain("import { Alert");
    expect(source).not.toContain('PHOTO_COPY.detail.shareUnavailable');
  });
});
