import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearUnavailableCloudBackupPreference,
  grantPhotoCaptureConsent,
  hasPhotoCaptureConsent,
  PHOTO_CLOUD_BACKUP_AVAILABLE,
} from './consent';

const mocks = vi.hoisted(() => ({
  active: vi.fn(),
  grant: vi.fn(),
  remove: vi.fn(),
  clearPhotos: vi.fn(),
}));
vi.mock('@/lib/consent/dependentConsentLifecycle', () => ({
  isHealthDependentConsentActive: mocks.active,
  grantHealthDependentConsent: mocks.grant,
}));
vi.mock('@/lib/storage/privateKV', () => ({ removePrivateItem: mocks.remove }));
vi.mock('./store', () => ({ clearPhotos: mocks.clearPhotos }));

describe('photo capture consent facade', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.active.mockResolvedValue(false);
    mocks.grant.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
  });

  it('allows an exact local receipt only when the backend is unconfigured', async () => {
    await hasPhotoCaptureConsent();
    expect(mocks.active).toHaveBeenCalledWith('photo_capture', {
      allowExactLocalReceiptWhenUnconfigured: true,
      deleteLocalOnAuthoritativeClose: mocks.clearPhotos,
    });
    expect(mocks.active.mock.calls[0]?.[1]).not.toHaveProperty(
      'allowExactLocalReceiptOnConfiguredFailure',
    );
  });

  it('grants through the exact status/CAS lifecycle with no configured-outage bypass', async () => {
    await grantPhotoCaptureConsent();
    expect(mocks.grant).toHaveBeenCalledWith('photo_capture', {
      allowExactLocalReceiptWhenUnconfigured: true,
    });
  });

  it('keeps cloud backup unavailable and removes legacy preference bytes', async () => {
    expect(PHOTO_CLOUD_BACKUP_AVAILABLE).toBe(false);
    await clearUnavailableCloudBackupPreference();
    expect(mocks.remove).toHaveBeenCalledWith('onskin.photos.cloudBackup');
  });
});
