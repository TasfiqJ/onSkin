import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportData } from './actions';

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
  isSupabaseConfigured: true,
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
    mocks.recordConsent.mockReset();
    mocks.shareAsync.mockReset();
    mocks.sharingAvailable.mockReset();
    mocks.signOut.mockReset();
    mocks.writeAsStringAsync.mockReset();
    mocks.deleteAsync.mockResolvedValue(undefined);
    mocks.invoke.mockResolvedValue({ data: { account: { id: 'user-1' } }, error: null });
    mocks.writeAsStringAsync.mockResolvedValue(undefined);
  });

  it('writes, shares, and deletes a one-time export file when sharing is available', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.shareAsync.mockResolvedValueOnce(undefined);

    await expect(exportData()).resolves.toBe(true);

    expect(mocks.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/cache\/onskin-export-\d+\.json$/),
      JSON.stringify({ account: { id: 'user-1' } }, null, 2),
    );
    expect(mocks.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/cache\/onskin-export-\d+\.json$/),
      {
        mimeType: 'application/json',
        dialogTitle: 'Export your OnSkin data',
      },
    );
    expect(mocks.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/cache\/onskin-export-\d+\.json$/),
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
      expect.stringMatching(/^file:\/\/cache\/onskin-export-\d+\.json$/),
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
      expect.stringMatching(/^file:\/\/cache\/onskin-export-\d+\.json$/),
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
