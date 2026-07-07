import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteAccount, exportData, withdrawHealthDataConsent } from './actions';
import { BRAND } from '@/lib/brand';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  clearLocalPrivateData: vi.fn(),
  deleteAsync: vi.fn(),
  getAppleAuthorizationCodeForRevocation: vi.fn(),
  getUser: vi.fn(),
  invoke: vi.fn(),
  isSupabaseConfigured: true,
  recordConsent: vi.fn(),
  shareAsync: vi.fn(),
  sharingAvailable: vi.fn(),
  signOut: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  deleteAsync: mocks.deleteAsync,
  writeAsStringAsync: mocks.writeAsStringAsync,
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: mocks.sharingAvailable,
  shareAsync: mocks.shareAsync,
}));

vi.mock('@/lib/auth/apple', () => ({
  getAppleAuthorizationCodeForRevocation: mocks.getAppleAuthorizationCodeForRevocation,
}));

vi.mock('@/lib/consent/consent', () => ({
  recordConsent: mocks.recordConsent,
}));

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.isSupabaseConfigured;
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

vi.mock('./localPrivateData', () => ({
  clearLocalPrivateData: mocks.clearLocalPrivateData,
}));

describe('settings data export', () => {
  beforeEach(() => {
    mocks.clearLocalPrivateData.mockReset();
    mocks.deleteAsync.mockReset();
    mocks.getAppleAuthorizationCodeForRevocation.mockReset();
    mocks.getUser.mockReset();
    mocks.invoke.mockReset();
    mocks.isSupabaseConfigured = true;
    mocks.recordConsent.mockReset();
    mocks.shareAsync.mockReset();
    mocks.sharingAvailable.mockReset();
    mocks.signOut.mockReset();
    mocks.writeAsStringAsync.mockReset();
    mocks.clearLocalPrivateData.mockResolvedValue(undefined);
    mocks.deleteAsync.mockResolvedValue(undefined);
    mocks.getAppleAuthorizationCodeForRevocation.mockResolvedValue('apple-revocation-code');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.invoke.mockResolvedValue({ data: { account: { id: 'user-1' } }, error: null });
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
    mocks.writeAsStringAsync.mockResolvedValue(undefined);
  });

  it('writes, shares, and deletes a one-time export file when sharing is available', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.shareAsync.mockResolvedValueOnce(undefined);

    await expect(exportData()).resolves.toBe(true);

    expect(mocks.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/cache\/routinekind-export-\d+\.json$/),
      JSON.stringify({ account: { id: 'user-1' } }, null, 2),
    );
    expect(mocks.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/cache\/routinekind-export-\d+\.json$/),
      {
        mimeType: 'application/json',
        dialogTitle: `Export your ${BRAND.appName} data`,
      },
    );
    expect(mocks.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/cache\/routinekind-export-\d+\.json$/),
      {
        idempotent: true,
      },
    );
  });

  it('returns false and deletes the export file when native sharing is unavailable', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(false);

    await expect(exportData()).resolves.toBe(false);

    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/cache\/routinekind-export-\d+\.json$/),
      {
        idempotent: true,
      },
    );
  });

  it('returns false and deletes the export file when availability probing fails', async () => {
    mocks.sharingAvailable.mockRejectedValueOnce(new Error('share unavailable'));

    await expect(exportData()).resolves.toBe(false);

    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/cache\/routinekind-export-\d+\.json$/),
      {
        idempotent: true,
      },
    );
  });

  it('returns false and deletes the export file when the native share sheet rejects', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.shareAsync.mockRejectedValueOnce(new Error('share rejected'));

    await expect(exportData()).resolves.toBe(false);

    expect(mocks.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/cache\/routinekind-export-\d+\.json$/),
      {
        mimeType: 'application/json',
        dialogTitle: `Export your ${BRAND.appName} data`,
      },
    );
    expect(mocks.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/cache\/routinekind-export-\d+\.json$/),
      {
        idempotent: true,
      },
    );
  });

  it('keeps the You tab from treating unavailable sharing as a successful export', () => {
    const source = readSource('app/(tabs)/you.tsx');
    const actions = readSource('features/settings/actions.ts');

    expect(actions).toContain('if (!isSupabaseConfigured)');
    expect(actions).toContain('DATA_EXPORT_BACKEND_UNAVAILABLE');
    expect(source).toContain('onSuccess: (shared)');
    expect(source).toContain('if (!shared)');
    expect(source).toContain('setExportFeedback(EXPORT_UNAVAILABLE_MESSAGE)');
    expect(source).toContain('setExportFeedback(message)');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('Export unavailable');
    expect(source).toContain('data_export_success');
  });
});

describe('settings account deletion and consent withdrawal', () => {
  beforeEach(() => {
    mocks.clearLocalPrivateData.mockReset();
    mocks.deleteAsync.mockReset();
    mocks.getAppleAuthorizationCodeForRevocation.mockReset();
    mocks.getUser.mockReset();
    mocks.invoke.mockReset();
    mocks.isSupabaseConfigured = true;
    mocks.recordConsent.mockReset();
    mocks.shareAsync.mockReset();
    mocks.sharingAvailable.mockReset();
    mocks.signOut.mockReset();
    mocks.writeAsStringAsync.mockReset();
    mocks.clearLocalPrivateData.mockResolvedValue(undefined);
    mocks.getAppleAuthorizationCodeForRevocation.mockResolvedValue('apple-revocation-code');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.invoke.mockResolvedValue({ data: null, error: null });
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
  });

  it('deletes through the backend before signing out and clearing local private data', async () => {
    await expect(deleteAccount()).resolves.toBeUndefined();

    expect(mocks.getAppleAuthorizationCodeForRevocation).toHaveBeenCalledWith({ id: 'user-1' });
    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: { appleAuthorizationCode: 'apple-revocation-code' },
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.clearLocalPrivateData).toHaveBeenCalledTimes(1);
    expect(mocks.invoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]!,
    );
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearLocalPrivateData.mock.invocationCallOrder[0]!,
    );
  });

  it('does not clear local private data when backend account deletion fails', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error('edge unavailable') });

    await expect(deleteAccount()).rejects.toThrow('edge unavailable');

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalPrivateData).not.toHaveBeenCalled();
  });

  it('still attempts local private data cleanup when auth sign-out fails after deletion', async () => {
    mocks.signOut.mockRejectedValueOnce(new Error('sign out unavailable'));

    await expect(deleteAccount()).rejects.toThrow('sign out unavailable');

    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: { appleAuthorizationCode: 'apple-revocation-code' },
    });
    expect(mocks.clearLocalPrivateData).toHaveBeenCalledTimes(1);
  });

  it('does not block backend deletion when Apple revocation-code refresh fails locally', async () => {
    mocks.getAppleAuthorizationCodeForRevocation.mockRejectedValueOnce(
      new Error('native apple unavailable'),
    );

    await expect(deleteAccount()).resolves.toBeUndefined();

    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: {},
    });
    expect(mocks.clearLocalPrivateData).toHaveBeenCalledTimes(1);
  });

  it('fails fast without local cleanup when the data-rights backend is unavailable', async () => {
    mocks.isSupabaseConfigured = false;

    await expect(deleteAccount()).rejects.toThrow('DATA_RIGHTS_BACKEND_UNAVAILABLE');

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.clearLocalPrivateData).not.toHaveBeenCalled();
  });

  it('records health-data consent withdrawal before deleting the account', async () => {
    await expect(withdrawHealthDataConsent()).resolves.toBeUndefined();

    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'health_data_collection',
        granted: false,
      }),
    );
    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: { appleAuthorizationCode: 'apple-revocation-code' },
    });
    expect(mocks.recordConsent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.invoke.mock.invocationCallOrder[0]!,
    );
  });

  it('continues to account deletion when the withdrawal ledger write is unavailable', async () => {
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(withdrawHealthDataConsent()).resolves.toBeUndefined();

    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: { appleAuthorizationCode: 'apple-revocation-code' },
    });
    expect(mocks.clearLocalPrivateData).toHaveBeenCalledTimes(1);
  });

  it('does not write withdrawal or cleanup locally when the data-rights backend is unavailable', async () => {
    mocks.isSupabaseConfigured = false;

    await expect(withdrawHealthDataConsent()).rejects.toThrow('DATA_RIGHTS_BACKEND_UNAVAILABLE');

    expect(mocks.recordConsent).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.clearLocalPrivateData).not.toHaveBeenCalled();
  });
});
