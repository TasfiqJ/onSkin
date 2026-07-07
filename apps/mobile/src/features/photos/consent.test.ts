import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordConsent: vi.fn(),
  withdrawConsent: vi.fn(),
  getPrivateItem: vi.fn(),
  setPrivateItem: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock('@/lib/consent/consent', () => ({
  recordConsent: mocks.recordConsent,
}));

vi.mock('@/lib/consent/withdrawal', () => ({
  withdrawConsent: mocks.withdrawConsent,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  setPrivateItem: mocks.setPrivateItem,
}));

const CAPTURE_KEY = 'onskin.photos.captureConsent';
const CLOUD_KEY = 'onskin.photos.cloudBackup';

describe('photo consent persistence', () => {
  beforeEach(() => {
    mocks.recordConsent.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.getPrivateItem.mockReset();
    mocks.setPrivateItem.mockReset();
    mocks.storage.clear();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.setPrivateItem.mockImplementation(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    });
  });

  it('keeps photo capture enabled only after the consent ledger saves', async () => {
    const { grantPhotoCaptureConsent, hasPhotoCaptureConsent } = await import('./consent');

    await expect(grantPhotoCaptureConsent()).resolves.toBeUndefined();

    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);
    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo_capture', granted: true }),
    );
    expect(mocks.setPrivateItem.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordConsent.mock.invocationCallOrder[0],
    );
  });

  it('fails closed and relocks photo capture when the consent ledger fails', async () => {
    const { grantPhotoCaptureConsent, hasPhotoCaptureConsent } = await import('./consent');
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantPhotoCaptureConsent()).rejects.toThrow('ledger unavailable');

    await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
    const captureKey = mocks.setPrivateItem.mock.calls[0][0];
    expect(mocks.setPrivateItem).toHaveBeenNthCalledWith(1, captureKey, '1');
    expect(mocks.setPrivateItem).toHaveBeenNthCalledWith(2, captureKey, '0');
  });

  it('keeps cloud backup enabled only after the consent ledger saves', async () => {
    const { getCloudBackupEnabled, setCloudBackupEnabled } = await import('./consent');

    await expect(setCloudBackupEnabled(true)).resolves.toBeUndefined();

    await expect(getCloudBackupEnabled()).resolves.toBe(true);
    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo_cloud_backup', granted: true }),
    );
    expect(mocks.setPrivateItem.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordConsent.mock.invocationCallOrder[0],
    );
  });

  it('fails closed and relocks cloud backup when the consent ledger fails', async () => {
    const { getCloudBackupEnabled, setCloudBackupEnabled } = await import('./consent');
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(setCloudBackupEnabled(true)).rejects.toThrow('ledger unavailable');

    await expect(getCloudBackupEnabled()).resolves.toBe(false);
    const cloudKey = mocks.setPrivateItem.mock.calls[0][0];
    expect(mocks.setPrivateItem).toHaveBeenNthCalledWith(1, cloudKey, '1');
    expect(mocks.setPrivateItem).toHaveBeenNthCalledWith(2, cloudKey, '0');
  });

  it('turns cloud backup off locally before recording withdrawal', async () => {
    const { getCloudBackupEnabled, setCloudBackupEnabled } = await import('./consent');

    await setCloudBackupEnabled(true);
    mocks.setPrivateItem.mockClear();
    await expect(setCloudBackupEnabled(false)).resolves.toBeUndefined();

    await expect(getCloudBackupEnabled()).resolves.toBe(false);
    expect(mocks.withdrawConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo_cloud_backup' }),
    );
    expect(mocks.setPrivateItem.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.withdrawConsent.mock.invocationCallOrder[0],
    );
  });

  it('normalizes padded canonical flags and fails closed for noncanonical consent values', async () => {
    const { getCloudBackupEnabled, hasPhotoCaptureConsent } = await import('./consent');
    mocks.storage.set(CAPTURE_KEY, ' 1 ');
    mocks.storage.set(CLOUD_KEY, 'true');

    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);
    await expect(getCloudBackupEnabled()).resolves.toBe(false);

    expect(mocks.setPrivateItem).toHaveBeenCalledWith(CAPTURE_KEY, '1');
    expect(mocks.setPrivateItem).toHaveBeenCalledWith(CLOUD_KEY, '0');
  });

  it('keeps canonical granted consent active if repair fails', async () => {
    const { hasPhotoCaptureConsent } = await import('./consent');
    mocks.storage.set(CAPTURE_KEY, ' 1 ');
    mocks.setPrivateItem.mockRejectedValueOnce(new Error('encrypted flag repair unavailable'));

    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);
    expect(mocks.storage.get(CAPTURE_KEY)).toBe(' 1 ');
  });
});
