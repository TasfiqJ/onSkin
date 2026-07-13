import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { BRAND } from '@/lib/brand';

import { deleteAccount, exportData, withdrawHealthDataConsent } from './actions';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const STAGED_EXPORT = {
  operationId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  purpose: 'data_export_json' as const,
  uri: 'file://cache/private-plaintext-staging-v1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json',
};

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  buildMobileDataExportBundle: vi.fn(),
  cleanupPlaintextStaging: vi.fn(),
  collectLocalDeviceExportData: vi.fn(),
  deleteAsync: vi.fn(),
  getAppleAuthorizationCodeForRevocation: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  invoke: vi.fn(),
  isSupabaseConfigured: true,
  markPlaintextStagingState: vi.fn(),
  recordConsent: vi.fn(),
  reservePlaintextStaging: vi.fn(),
  shareAsync: vi.fn(),
  sharingAvailable: vi.fn(),
  signOut: vi.fn(),
  userHasAppleIdentity: vi.fn(),
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

vi.mock('@/lib/storage/plaintextStaging', () => ({
  cleanupPlaintextStaging: mocks.cleanupPlaintextStaging,
  markPlaintextStagingState: mocks.markPlaintextStagingState,
  reservePlaintextStaging: mocks.reservePlaintextStaging,
}));

vi.mock('@/lib/auth/apple', () => ({
  getAppleAuthorizationCodeForRevocation: mocks.getAppleAuthorizationCodeForRevocation,
  userHasAppleIdentity: mocks.userHasAppleIdentity,
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
      getSession: mocks.getSession,
      getUser: mocks.getUser,
    },
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

vi.mock('./localDeviceExport', () => ({
  buildMobileDataExportBundle: mocks.buildMobileDataExportBundle,
  collectLocalDeviceExportData: mocks.collectLocalDeviceExportData,
}));

describe('settings data export', () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_DATA_EXPORT_DELAY_MS;
    mocks.buildMobileDataExportBundle.mockReset();
    mocks.cleanupPlaintextStaging.mockReset();
    mocks.collectLocalDeviceExportData.mockReset();
    mocks.deleteAsync.mockReset();
    mocks.getAppleAuthorizationCodeForRevocation.mockReset();
    mocks.getSession.mockReset();
    mocks.getUser.mockReset();
    mocks.invoke.mockReset();
    mocks.isSupabaseConfigured = true;
    mocks.markPlaintextStagingState.mockReset();
    mocks.recordConsent.mockReset();
    mocks.reservePlaintextStaging.mockReset();
    mocks.shareAsync.mockReset();
    mocks.sharingAvailable.mockReset();
    mocks.signOut.mockReset();
    mocks.userHasAppleIdentity.mockReset();
    mocks.writeAsStringAsync.mockReset();
    mocks.buildMobileDataExportBundle.mockImplementation((params) => ({
      mobile_export_schema_version: 1,
      exported_at: '2026-07-10T12:01:00.000Z',
      server_account_data_status: params.serverAccountDataStatus,
      server_account_data: params.serverAccountData,
      local_device_data: params.localDeviceData,
      local_media_note: 'Progress photo files and thumbnails are not included.',
    }));
    mocks.collectLocalDeviceExportData.mockResolvedValue({
      schema_version: 1,
      collected_at: '2026-07-10T12:00:00.000Z',
      storage_scope: 'encrypted_private_storage_on_this_device',
      sections: {
        account_and_privacy: {},
        profile_and_preferences: {},
        shelf_and_routine: { shelf_products: [{ id: 'local-1' }] },
        activity_and_app_state: {},
        subscription: {},
        progress: {},
      },
      exclusions: [],
    });
    mocks.cleanupPlaintextStaging.mockResolvedValue(undefined);
    mocks.deleteAsync.mockResolvedValue(undefined);
    mocks.getAppleAuthorizationCodeForRevocation.mockResolvedValue('apple-revocation-code');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1', user: { id: 'user-1' } } },
      error: null,
    });
    mocks.invoke.mockResolvedValue({
      data: { export_schema_version: 2, user_id: 'user-1', account: { id: 'user-1' } },
      error: null,
    });
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.reservePlaintextStaging.mockResolvedValue(STAGED_EXPORT);
    mocks.markPlaintextStagingState.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
    mocks.userHasAppleIdentity.mockReturnValue(true);
    mocks.writeAsStringAsync.mockResolvedValue(undefined);
  });

  it('writes, shares, and deletes a one-time export file when sharing is available', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.shareAsync.mockResolvedValueOnce(undefined);

    await expect(exportData()).resolves.toBe(true);

    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.collectLocalDeviceExportData.mock.invocationCallOrder[0]!,
    );
    expect(mocks.invoke).toHaveBeenCalledWith('data-export', {
      headers: { Authorization: 'Bearer token-1' },
      method: 'POST',
      signal: expect.any(AbortSignal),
    });
    expect(mocks.reservePlaintextStaging).toHaveBeenCalledWith('data_export_json');
    expect(mocks.reservePlaintextStaging.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.writeAsStringAsync.mock.invocationCallOrder[0]!,
    );
    expect(mocks.reservePlaintextStaging.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.buildMobileDataExportBundle.mock.invocationCallOrder[0]!,
    );
    expect(mocks.writeAsStringAsync).toHaveBeenCalledWith(STAGED_EXPORT.uri, expect.any(String));
    const written = JSON.parse(mocks.writeAsStringAsync.mock.calls[0]![1] as string) as Record<
      string,
      unknown
    >;
    expect(written).toEqual(
      expect.objectContaining({
        mobile_export_schema_version: 1,
        server_account_data_status: 'included',
        server_account_data: {
          export_schema_version: 2,
          user_id: 'user-1',
          account: { id: 'user-1' },
        },
        local_device_data: expect.objectContaining({
          sections: expect.objectContaining({
            shelf_and_routine: { shelf_products: [{ id: 'local-1' }] },
          }),
        }),
      }),
    );
    expect(mocks.shareAsync).toHaveBeenCalledWith(STAGED_EXPORT.uri, {
      mimeType: 'application/json',
      dialogTitle: `Export your ${BRAND.appName} data`,
    });
    expect(mocks.markPlaintextStagingState).toHaveBeenNthCalledWith(
      1,
      STAGED_EXPORT,
      'plaintext_written',
    );
    expect(mocks.markPlaintextStagingState).toHaveBeenNthCalledWith(2, STAGED_EXPORT, 'sharing');
    expect(mocks.cleanupPlaintextStaging).toHaveBeenCalledWith(STAGED_EXPORT);
  });

  it('returns false and deletes the export file when native sharing is unavailable', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(false);

    await expect(exportData()).resolves.toBe(false);

    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.cleanupPlaintextStaging).toHaveBeenCalledWith(STAGED_EXPORT);
  });

  it('returns false and deletes the export file when availability probing fails', async () => {
    mocks.sharingAvailable.mockRejectedValueOnce(new Error('share unavailable'));

    await expect(exportData()).resolves.toBe(false);

    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.cleanupPlaintextStaging).toHaveBeenCalledWith(STAGED_EXPORT);
  });

  it('returns false and deletes the export file when the native share sheet rejects', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.shareAsync.mockRejectedValueOnce(new Error('share rejected'));

    await expect(exportData()).resolves.toBe(false);

    expect(mocks.shareAsync).toHaveBeenCalledWith(STAGED_EXPORT.uri, {
      mimeType: 'application/json',
      dialogTitle: `Export your ${BRAND.appName} data`,
    });
    expect(mocks.cleanupPlaintextStaging).toHaveBeenCalledWith(STAGED_EXPORT);
  });

  it('fails before constructing or writing plaintext when journal reservation fails', async () => {
    mocks.reservePlaintextStaging.mockRejectedValueOnce(new Error('journal unavailable'));

    await expect(exportData()).rejects.toThrow('journal unavailable');

    expect(mocks.buildMobileDataExportBundle).not.toHaveBeenCalled();
    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('cleans the reserved entry when plaintext writing fails', async () => {
    mocks.writeAsStringAsync.mockRejectedValueOnce(new Error('cache full'));

    await expect(exportData()).rejects.toThrow('cache full');

    expect(mocks.markPlaintextStagingState).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.cleanupPlaintextStaging).toHaveBeenCalledWith(STAGED_EXPORT);
  });

  it('preserves a successful share result when immediate cleanup must retry later', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.shareAsync.mockResolvedValueOnce(undefined);
    mocks.cleanupPlaintextStaging.mockRejectedValueOnce(new Error('cache busy'));

    await expect(exportData()).resolves.toBe(true);

    expect(mocks.cleanupPlaintextStaging).toHaveBeenCalledWith(STAGED_EXPORT);
  });

  it('shares a clearly scoped device-only bundle when the backend is not configured', async () => {
    mocks.isSupabaseConfigured = false;
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.shareAsync.mockResolvedValueOnce(undefined);

    await expect(exportData()).resolves.toBe(true);

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
    const written = JSON.parse(mocks.writeAsStringAsync.mock.calls[0]![1] as string) as Record<
      string,
      unknown
    >;
    expect(written).toEqual(
      expect.objectContaining({
        server_account_data_status: 'backend_not_configured',
        server_account_data: null,
        local_device_data: expect.objectContaining({ schema_version: 1 }),
      }),
    );
  });

  it('fails closed when configured server account data cannot be exported', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error('edge unavailable') });

    await expect(exportData()).rejects.toThrow('NETWORK_REQUEST_UNKNOWN');

    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('fails closed when the configured server returns a malformed export bundle', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: '<html>proxy error</html>', error: null });

    await expect(exportData()).rejects.toThrow('DATA_EXPORT_RESPONSE_INVALID');

    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('fails closed before reading local data when no authenticated export owner is available', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await expect(exportData()).rejects.toThrow('DATA_EXPORT_USER_UNAVAILABLE');

    expect(mocks.collectLocalDeviceExportData).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('rejects a valid server bundle owned by a different account', async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: { export_schema_version: 2, user_id: 'user-2' },
      error: null,
    });

    await expect(exportData()).rejects.toThrow('DATA_EXPORT_RESPONSE_OWNER_MISMATCH');

    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('aborts a delayed server export and settles it before an account boundary continues', async () => {
    mocks.invoke.mockImplementationOnce(
      (_name: string, options: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('request aborted')), {
            once: true,
          });
        }),
    );

    const pendingExport = exportData();
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    try {
      await expect(pendingExport).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('deletes a written cache file without sharing when the account changes after the write', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.writeAsStringAsync.mockImplementationOnce(async () => {
      beginAccountGenerationBoundary();
    });

    try {
      await expect(exportData()).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.sharingAvailable).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.cleanupPlaintextStaging).toHaveBeenCalledWith(STAGED_EXPORT);
  });

  it('accepts a valid JSON-string server bundle without double encoding it', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.shareAsync.mockResolvedValueOnce(undefined);
    mocks.invoke.mockResolvedValueOnce({
      data: JSON.stringify({ export_schema_version: 2, user_id: 'user-1' }),
      error: null,
    });

    await expect(exportData()).resolves.toBe(true);

    expect(mocks.buildMobileDataExportBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        serverAccountData: { export_schema_version: 2, user_id: 'user-1' },
        serverAccountDataStatus: 'included',
      }),
    );
  });

  it('does not request server data when the local encrypted snapshot cannot be read', async () => {
    mocks.collectLocalDeviceExportData.mockRejectedValueOnce(new Error('local export unavailable'));

    await expect(exportData()).rejects.toThrow('local export unavailable');

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('keeps the You tab from treating unavailable sharing as a successful export', () => {
    const source = readSource('app/(tabs)/you.tsx');
    const actions = readSource('features/settings/actions.ts');

    expect(actions).toContain('if (isSupabaseConfigured)');
    expect(actions).toContain('collectLocalDeviceExportData()');
    expect(actions).toContain("serverAccountDataStatus = 'included'");
    expect(source).toContain('onSuccess: (shared)');
    expect(source).toContain('if (!shared)');
    expect(source).toContain('title: EXPORT_UNAVAILABLE_TITLE');
    expect(source).toContain('message: EXPORT_UNAVAILABLE_MESSAGE');
    expect(source).toContain('title: EXPORT_FAILED_TITLE');
    expect(source).toContain('message,');
    expect(source).toContain('function InlineNoticeCard(');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('Export unavailable');
    expect(source).toContain('Includes data saved to your account and on this device:');
    expect(source).toContain('completion history, preferences, and Progress notes.');
    expect(source).toContain('Photo files and thumbnails stay encrypted here;');
    expect(source).toContain('share images individually from Progress.');
    expect(source).toContain(
      'Progress photos stay encrypted here unless you share one. No ads. No data sales.',
    );
    expect(source).not.toContain('Photos stay on your device by default.');
    expect(source).toContain('data_export_success');
    expect(source).not.toContain("Alert.alert('Export unavailable'");
    expect(source).not.toContain("Alert.alert('Export failed'");
  });
});

describe('settings account deletion and consent withdrawal', () => {
  beforeEach(() => {
    mocks.deleteAsync.mockReset();
    mocks.getAppleAuthorizationCodeForRevocation.mockReset();
    mocks.getSession.mockReset();
    mocks.getUser.mockReset();
    mocks.invoke.mockReset();
    mocks.isSupabaseConfigured = true;
    mocks.recordConsent.mockReset();
    mocks.shareAsync.mockReset();
    mocks.sharingAvailable.mockReset();
    mocks.signOut.mockReset();
    mocks.userHasAppleIdentity.mockReset();
    mocks.writeAsStringAsync.mockReset();
    mocks.getAppleAuthorizationCodeForRevocation.mockResolvedValue('apple-revocation-code');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1', user: { id: 'user-1' } } },
      error: null,
    });
    mocks.invoke.mockResolvedValue({ data: null, error: null });
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
    mocks.userHasAppleIdentity.mockReturnValue(true);
  });

  it('deletes through the backend before handing off to the root account boundary', async () => {
    await expect(deleteAccount(mocks.signOut)).resolves.toBeUndefined();

    expect(mocks.getAppleAuthorizationCodeForRevocation).toHaveBeenCalledWith({ id: 'user-1' });
    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: { appleAuthorizationCode: 'apple-revocation-code' },
      headers: { Authorization: 'Bearer token-1' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.invoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]!,
    );
  });

  it('holds the account boundary during local sign-out without drain deadlock', async () => {
    let wrongOwnerStarted = false;
    mocks.signOut.mockImplementationOnce(async () => {
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      await expect(
        runAccountGenerationOperation(async () => {
          wrongOwnerStarted = true;
        }),
      ).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    });

    await expect(deleteAccount(mocks.signOut)).resolves.toBeUndefined();

    expect(wrongOwnerStarted).toBe(false);
    await expect(runAccountGenerationOperation(async () => 'released')).resolves.toBe('released');
  });

  it('does not clear local private data when backend account deletion fails', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error('edge unavailable') });

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('NETWORK_REQUEST_UNKNOWN');

    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('surfaces a root account-boundary failure after backend deletion', async () => {
    mocks.signOut.mockRejectedValueOnce(new Error('sign out unavailable'));

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('sign out unavailable');

    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: { appleAuthorizationCode: 'apple-revocation-code' },
      headers: { Authorization: 'Bearer token-1' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('aborts before invoking deletion when Apple reauthentication fails or is canceled', async () => {
    mocks.getAppleAuthorizationCodeForRevocation.mockRejectedValueOnce(
      new Error('native apple unavailable'),
    );

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('native apple unavailable');

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();

    mocks.getAppleAuthorizationCodeForRevocation.mockResolvedValueOnce(null);
    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('APPLE_REAUTHORIZATION_REQUIRED');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('never sends an owner-A Apple code after an account boundary starts', async () => {
    let releaseAppleCode!: (code: string) => void;
    mocks.getAppleAuthorizationCodeForRevocation.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          releaseAppleCode = resolve;
        }),
    );

    const deletion = deleteAccount(mocks.signOut);
    await vi.waitFor(() =>
      expect(mocks.getAppleAuthorizationCodeForRevocation).toHaveBeenCalledOnce(),
    );
    beginAccountGenerationBoundary();
    try {
      releaseAppleCode('single-use-code-for-a');
      await expect(deletion).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('does not request Apple reauthentication for a non-Apple account', async () => {
    mocks.userHasAppleIdentity.mockReturnValueOnce(false);

    await expect(deleteAccount(mocks.signOut)).resolves.toBeUndefined();

    expect(mocks.getAppleAuthorizationCodeForRevocation).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: {},
      headers: { Authorization: 'Bearer token-1' },
      signal: expect.any(AbortSignal),
    });
  });

  it('obtains a fresh Apple authorization code for each explicit retry', async () => {
    mocks.getAppleAuthorizationCodeForRevocation
      .mockResolvedValueOnce('apple-code-1')
      .mockResolvedValueOnce('apple-code-2');
    mocks.invoke
      .mockResolvedValueOnce({ data: null, error: new Error('retryable pre-Apple failure') })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('NETWORK_REQUEST_UNKNOWN');
    await expect(deleteAccount(mocks.signOut)).resolves.toBeUndefined();

    expect(mocks.getAppleAuthorizationCodeForRevocation).toHaveBeenCalledTimes(2);
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'account-deletion', {
      method: 'POST',
      body: { appleAuthorizationCode: 'apple-code-1' },
      headers: { Authorization: 'Bearer token-1' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'account-deletion', {
      method: 'POST',
      body: { appleAuthorizationCode: 'apple-code-2' },
      headers: { Authorization: 'Bearer token-1' },
      signal: expect.any(AbortSignal),
    });
  });

  it('fails fast without local cleanup when the data-rights backend is unavailable', async () => {
    mocks.isSupabaseConfigured = false;

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('DATA_RIGHTS_BACKEND_UNAVAILABLE');

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('records health-data consent withdrawal before deleting the account', async () => {
    await expect(withdrawHealthDataConsent(mocks.signOut)).resolves.toBeUndefined();

    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'health_data_collection',
        granted: false,
      }),
    );
    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: { appleAuthorizationCode: 'apple-revocation-code' },
      headers: { Authorization: 'Bearer token-1' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.recordConsent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.invoke.mock.invocationCallOrder[0]!,
    );
  });

  it('continues to account deletion when the withdrawal ledger write is unavailable', async () => {
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(withdrawHealthDataConsent(mocks.signOut)).resolves.toBeUndefined();

    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: { appleAuthorizationCode: 'apple-revocation-code' },
      headers: { Authorization: 'Bearer token-1' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('never turns an owner-A withdrawal race into deletion of owner B', async () => {
    let releaseConsent!: () => void;
    mocks.recordConsent.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseConsent = resolve;
        }),
    );

    const withdrawal = withdrawHealthDataConsent(mocks.signOut);
    await vi.waitFor(() => expect(mocks.recordConsent).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    try {
      releaseConsent();
      await expect(withdrawal).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('does not write withdrawal or cleanup locally when the data-rights backend is unavailable', async () => {
    mocks.isSupabaseConfigured = false;

    await expect(withdrawHealthDataConsent(mocks.signOut)).rejects.toThrow(
      'DATA_RIGHTS_BACKEND_UNAVAILABLE',
    );

    expect(mocks.recordConsent).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('keeps You-tab destructive data-rights actions route-owned and retryable', () => {
    const source = readSource('app/(tabs)/you.tsx');

    expect(source).toContain(
      "type PendingDataRightsAction = 'withdraw_health_data' | 'delete_account';",
    );
    expect(source).toContain('const [privacyActionFeedback, setPrivacyActionFeedback]');
    expect(source).toContain('const [dataRightsFeedback, setDataRightsFeedback]');
    expect(source).toContain('const [confirmingDataRightsAction, setConfirmingDataRightsAction]');
    expect(source).toContain('function InlineConfirmCard(');
    expect(source).toContain('const DATA_RIGHTS_CONFIRMATION_SCROLL_NUDGE = 144;');
    expect(source).toContain('const scrollY = useRef(0);');
    expect(source).toContain('function nudgeDataRightsConfirmationIntoView()');
    expect(source).toContain('scrollY.current + DATA_RIGHTS_CONFIRMATION_SCROLL_NUDGE');
    expect(source).toContain('scrollEventThrottle={16}');
    expect(source).toContain('function promptWithdrawHealthData()');
    expect(source).toContain('function promptDeleteAccount()');
    expect(source).toContain('async function runWithdrawHealthData()');
    expect(source).toContain('async function runDeleteAccount()');
    expect(source).toContain('WITHDRAW_HEALTH_DATA_CONFIRM_TITLE');
    expect(source).toContain('WITHDRAW_HEALTH_DATA_FAILED_TITLE');
    expect(source).toContain('DELETE_ACCOUNT_CONFIRM_TITLE');
    expect(source).toContain('DELETE_ACCOUNT_FAILED_TITLE');
    expect(source).toContain('onCancel={cancelDataRightsConfirmation}');
    expect(source).toContain('onConfirm={() => void runWithdrawHealthData()}');
    expect(source).toContain('onConfirm={() => void runDeleteAccount()}');
    expect(source).toContain('setDataRightsFeedback(null);');
    expect(source).toContain('setPrivacyActionFeedback(null);');
    expect(source).not.toContain('Alert.alert');
    expect(source).not.toContain('import { Alert');
  });
});
