import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordConsent: vi.fn(),
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) => `sha256:${value}`),
  getPrivateItem: vi.fn(),
  removePrivateItem: vi.fn(),
  setPrivateItem: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
}));

vi.mock('@/lib/consent/consent', () => ({
  recordConsent: mocks.recordConsent,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  removePrivateItem: mocks.removePrivateItem,
  setPrivateItem: mocks.setPrivateItem,
}));

const CAPTURE_KEY = 'onskin.photos.captureConsent';
const CAPTURE_RECORD_KEY = 'onskin.photos.captureConsent.v1';
const CLOUD_KEY = 'onskin.photos.cloudBackup';

describe('photo consent persistence', () => {
  beforeEach(() => {
    mocks.recordConsent.mockReset();
    mocks.digestStringAsync.mockClear();
    mocks.getPrivateItem.mockReset();
    mocks.removePrivateItem.mockReset();
    mocks.setPrivateItem.mockReset();
    mocks.storage.clear();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.removePrivateItem.mockImplementation(async (key: string) => {
      mocks.storage.delete(key);
    });
    mocks.setPrivateItem.mockImplementation(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    });
  });

  it('keeps photo capture enabled after the local proof saves and records the ledger', async () => {
    const { grantPhotoCaptureConsent, hasPhotoCaptureConsent } = await import('./consent');

    await expect(grantPhotoCaptureConsent()).resolves.toBeUndefined();

    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);
    expect(JSON.parse(mocks.storage.get(CAPTURE_RECORD_KEY) ?? '{}')).toMatchObject({
      type: 'photo_capture',
      granted: true,
      consentTextHash: expect.stringMatching(/^sha256:/),
      recordedAt: expect.any(String),
    });
    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo_capture', granted: true }),
    );
    expect(mocks.setPrivateItem.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordConsent.mock.invocationCallOrder[0],
    );
  });

  it('keeps local-only photo capture available when the consent ledger is unavailable', async () => {
    const { grantPhotoCaptureConsent, hasPhotoCaptureConsent } = await import('./consent');
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantPhotoCaptureConsent()).resolves.toBeUndefined();

    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);
    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo_capture', granted: true }),
    );
    expect(mocks.setPrivateItem).toHaveBeenCalledTimes(1);
    expect(mocks.setPrivateItem).toHaveBeenCalledWith(CAPTURE_RECORD_KEY, expect.any(String));
  });

  it('fails closed before camera access when the local photo consent proof cannot save', async () => {
    const { grantPhotoCaptureConsent, hasPhotoCaptureConsent } = await import('./consent');
    mocks.setPrivateItem.mockRejectedValueOnce(new Error('encrypted proof unavailable'));

    await expect(grantPhotoCaptureConsent()).rejects.toThrow('encrypted proof unavailable');

    await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it('hard-disables cloud backup and clears stale enabled preferences', async () => {
    const { clearUnavailableCloudBackupPreference, PHOTO_CLOUD_BACKUP_AVAILABLE } =
      await import('./consent');
    mocks.storage.set(CLOUD_KEY, '1');

    expect(PHOTO_CLOUD_BACKUP_AVAILABLE).toBe(false);
    await expect(clearUnavailableCloudBackupPreference()).resolves.toBeUndefined();

    expect(mocks.removePrivateItem).toHaveBeenCalledWith(CLOUD_KEY);
    expect(mocks.storage.has(CLOUD_KEY)).toBe(false);
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it('does not create a backup preference when no legacy value exists', async () => {
    const { clearUnavailableCloudBackupPreference } = await import('./consent');

    await expect(clearUnavailableCloudBackupPreference()).resolves.toBeUndefined();

    expect(mocks.getPrivateItem).toHaveBeenCalledWith(CLOUD_KEY);
    expect(mocks.removePrivateItem).not.toHaveBeenCalled();
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('stays disabled when stale preference cleanup is unavailable', async () => {
    const { clearUnavailableCloudBackupPreference, PHOTO_CLOUD_BACKUP_AVAILABLE } =
      await import('./consent');
    mocks.storage.set(CLOUD_KEY, '1');
    mocks.removePrivateItem.mockRejectedValueOnce(new Error('private storage unavailable'));

    await expect(clearUnavailableCloudBackupPreference()).resolves.toBeUndefined();

    expect(PHOTO_CLOUD_BACKUP_AVAILABLE).toBe(false);
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it('normalizes padded canonical flags and fails closed for noncanonical consent values', async () => {
    const { hasPhotoCaptureConsent } = await import('./consent');
    mocks.storage.set(CAPTURE_KEY, ' 1 ');

    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);

    expect(mocks.setPrivateItem).toHaveBeenCalledWith(CAPTURE_KEY, '1');
  });

  it('removes malformed local photo proof before falling back to the legacy flag', async () => {
    const { hasPhotoCaptureConsent } = await import('./consent');
    mocks.storage.set(CAPTURE_RECORD_KEY, '{not-json');
    mocks.storage.set(CAPTURE_KEY, ' 1 ');

    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);

    expect(mocks.removePrivateItem).toHaveBeenCalledWith(CAPTURE_RECORD_KEY);
    expect(mocks.setPrivateItem).toHaveBeenCalledWith(CAPTURE_KEY, '1');
  });

  it('keeps canonical granted consent active if repair fails', async () => {
    const { hasPhotoCaptureConsent } = await import('./consent');
    mocks.storage.set(CAPTURE_KEY, ' 1 ');
    mocks.setPrivateItem.mockRejectedValueOnce(new Error('encrypted flag repair unavailable'));

    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);
    expect(mocks.storage.get(CAPTURE_KEY)).toBe(' 1 ');
  });
});
