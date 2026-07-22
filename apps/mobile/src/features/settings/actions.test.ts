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
const VALID_ACCOUNT_DELETION_RESPONSE = {
  deleted: true,
  request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  apple: 'revoked',
  posthog: 'deleted',
};
const ACCOUNT_DELETION_COMPLETION_TOKEN = 'c'.repeat(64);
const VALID_ACCOUNT_DELETION_COMPLETION = {
  requestId: VALID_ACCOUNT_DELETION_RESPONSE.request_id,
  apple: VALID_ACCOUNT_DELETION_RESPONSE.apple,
  posthog: VALID_ACCOUNT_DELETION_RESPONSE.posthog,
};

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  armAccountDeletionVendorFreeze: vi.fn(),
  buildMobileDataExportBundle: vi.fn(),
  cleanupPlaintextStaging: vi.fn(),
  collectLocalDeviceExportData: vi.fn(),
  freezeAnalyticsIdentityForAccountDeletion: vi.fn(),
  freezeRevenueCatIdentityForAccountDeletion: vi.fn(),
  getAppleAuthorizationCodeForRevocation: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  invoke: vi.fn(),
  isSupabaseConfigured: true,
  lookupAccountDeletionCompletion: vi.fn(),
  markAccountDeletionBackendDeleted: vi.fn(),
  markAccountDeletionBackendDeletedFromCompletion: vi.fn(),
  markPlaintextStagingState: vi.fn(),
  recordConsent: vi.fn(),
  reservePlaintextStaging: vi.fn(),
  readAccountDeletionRecoveryCapability: vi.fn(),
  shareAsync: vi.fn(),
  sharingAvailable: vi.fn(),
  signOut: vi.fn(),
  userHasAppleIdentity: vi.fn(),
  waitForRevenueCatOperationsToSettle: vi.fn(),
  writeMobileDataExportFile: vi.fn(),
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

vi.mock('@/lib/auth/accountDeletionVendorFreeze', () => ({
  armAccountDeletionVendorFreeze: mocks.armAccountDeletionVendorFreeze,
  markAccountDeletionBackendDeleted: mocks.markAccountDeletionBackendDeleted,
  markAccountDeletionBackendDeletedFromCompletion:
    mocks.markAccountDeletionBackendDeletedFromCompletion,
  readAccountDeletionRecoveryCapability: mocks.readAccountDeletionRecoveryCapability,
}));

vi.mock('@/lib/auth/accountDeletionCompletion', () => ({
  lookupAccountDeletionCompletion: mocks.lookupAccountDeletionCompletion,
}));

vi.mock('@/lib/analytics/track', () => ({
  freezeAnalyticsIdentityForAccountDeletion: mocks.freezeAnalyticsIdentityForAccountDeletion,
}));

vi.mock('@/lib/iap/revenuecat', () => ({
  freezeRevenueCatIdentityForAccountDeletion: mocks.freezeRevenueCatIdentityForAccountDeletion,
  waitForRevenueCatOperationsToSettle: mocks.waitForRevenueCatOperationsToSettle,
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

vi.mock('./mobileDataExportWriter', () => ({
  writeMobileDataExportFile: mocks.writeMobileDataExportFile,
}));

describe('settings data export', () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_DATA_EXPORT_DELAY_MS;
    mocks.buildMobileDataExportBundle.mockReset();
    mocks.armAccountDeletionVendorFreeze.mockReset();
    mocks.cleanupPlaintextStaging.mockReset();
    mocks.collectLocalDeviceExportData.mockReset();
    mocks.freezeAnalyticsIdentityForAccountDeletion.mockReset();
    mocks.freezeRevenueCatIdentityForAccountDeletion.mockReset();
    mocks.getAppleAuthorizationCodeForRevocation.mockReset();
    mocks.getSession.mockReset();
    mocks.getUser.mockReset();
    mocks.invoke.mockReset();
    mocks.isSupabaseConfigured = true;
    mocks.markPlaintextStagingState.mockReset();
    mocks.markAccountDeletionBackendDeleted.mockReset();
    mocks.recordConsent.mockReset();
    mocks.reservePlaintextStaging.mockReset();
    mocks.shareAsync.mockReset();
    mocks.sharingAvailable.mockReset();
    mocks.signOut.mockReset();
    mocks.userHasAppleIdentity.mockReset();
    mocks.waitForRevenueCatOperationsToSettle.mockReset();
    mocks.writeMobileDataExportFile.mockReset();
    mocks.buildMobileDataExportBundle.mockImplementation((params) => ({
      mobile_export_schema_version: 1,
      exported_at: '2026-07-10T12:01:00.000Z',
      server_account_data_status: params.serverAccountDataStatus,
      server_account_data: params.serverAccountData,
      local_device_data: params.localDeviceData,
      local_media_note: 'Progress photo files and thumbnails are not included.',
    }));
    mocks.armAccountDeletionVendorFreeze.mockResolvedValue(undefined);
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
    mocks.freezeAnalyticsIdentityForAccountDeletion.mockResolvedValue(undefined);
    mocks.freezeRevenueCatIdentityForAccountDeletion.mockResolvedValue(undefined);
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
    mocks.markAccountDeletionBackendDeleted.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
    mocks.waitForRevenueCatOperationsToSettle.mockResolvedValue(undefined);
    mocks.userHasAppleIdentity.mockReturnValue(true);
    mocks.writeMobileDataExportFile.mockResolvedValue({ chunksWritten: 2, bytesWritten: 512 });
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
      mocks.buildMobileDataExportBundle.mock.invocationCallOrder[0]!,
    );
    expect(mocks.buildMobileDataExportBundle.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.writeMobileDataExportFile.mock.invocationCallOrder[0]!,
    );
    expect(mocks.buildMobileDataExportBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        serverAccountDataStatus: 'included',
        serverAccountData: {
          export_schema_version: 2,
          user_id: 'user-1',
          account: { id: 'user-1' },
        },
        localDeviceData: expect.objectContaining({
          sections: expect.objectContaining({
            shelf_and_routine: { shelf_products: [{ id: 'local-1' }] },
          }),
        }),
      }),
    );
    const builtBundle = mocks.buildMobileDataExportBundle.mock.results[0]!.value;
    expect(mocks.writeMobileDataExportFile).toHaveBeenCalledWith(
      STAGED_EXPORT.uri,
      builtBundle,
      expect.objectContaining({ assertCurrent: expect.any(Function) }),
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
    expect(mocks.writeMobileDataExportFile.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.markPlaintextStagingState.mock.invocationCallOrder[0]!,
    );
    expect(mocks.markPlaintextStagingState.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sharingAvailable.mock.invocationCallOrder[0]!,
    );
    expect(mocks.markPlaintextStagingState.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.shareAsync.mock.invocationCallOrder[0]!,
    );
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
    expect(mocks.writeMobileDataExportFile).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('cleans the reserved entry when plaintext writing fails', async () => {
    mocks.writeMobileDataExportFile.mockRejectedValueOnce(new Error('cache full'));

    await expect(exportData()).rejects.toThrow('cache full');

    expect(mocks.markPlaintextStagingState).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.cleanupPlaintextStaging).toHaveBeenCalledWith(STAGED_EXPORT);
  });

  it('does not mark or share the staging file before incremental writing finishes', async () => {
    let finishWriting!: () => void;
    mocks.writeMobileDataExportFile.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishWriting = () => resolve({ chunksWritten: 3, bytesWritten: 768 });
        }),
    );
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.shareAsync.mockResolvedValueOnce(undefined);

    const pendingExport = exportData();
    await vi.waitFor(() => expect(mocks.writeMobileDataExportFile).toHaveBeenCalledOnce());

    expect(mocks.markPlaintextStagingState).not.toHaveBeenCalled();
    expect(mocks.sharingAvailable).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();

    finishWriting();
    await expect(pendingExport).resolves.toBe(true);
    expect(mocks.markPlaintextStagingState).toHaveBeenNthCalledWith(
      1,
      STAGED_EXPORT,
      'plaintext_written',
    );
  });

  it('cleans a completed file without probing sharing when its written marker cannot persist', async () => {
    mocks.markPlaintextStagingState.mockRejectedValueOnce(new Error('journal unavailable'));

    await expect(exportData()).rejects.toThrow('journal unavailable');

    expect(mocks.writeMobileDataExportFile).toHaveBeenCalledOnce();
    expect(mocks.sharingAvailable).not.toHaveBeenCalled();
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
    expect(mocks.buildMobileDataExportBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        serverAccountDataStatus: 'backend_not_configured',
        serverAccountData: null,
        localDeviceData: expect.objectContaining({ schema_version: 1 }),
      }),
    );
    expect(mocks.writeMobileDataExportFile).toHaveBeenCalledWith(
      STAGED_EXPORT.uri,
      expect.objectContaining({
        server_account_data_status: 'backend_not_configured',
        server_account_data: null,
        local_device_data: expect.objectContaining({ schema_version: 1 }),
      }),
      expect.objectContaining({ assertCurrent: expect.any(Function) }),
    );
  });

  it('fails closed when configured server account data cannot be exported', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error('edge unavailable') });

    await expect(exportData()).rejects.toThrow('NETWORK_REQUEST_UNKNOWN');

    expect(mocks.writeMobileDataExportFile).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('fails closed when the configured server returns a malformed export bundle', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: '<html>proxy error</html>', error: null });

    await expect(exportData()).rejects.toThrow('DATA_EXPORT_RESPONSE_INVALID');

    expect(mocks.writeMobileDataExportFile).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('fails closed before reading local data when no authenticated export owner is available', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await expect(exportData()).rejects.toThrow('DATA_EXPORT_USER_UNAVAILABLE');

    expect(mocks.collectLocalDeviceExportData).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.writeMobileDataExportFile).not.toHaveBeenCalled();
  });

  it('rejects a valid server bundle owned by a different account', async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: { export_schema_version: 2, user_id: 'user-2' },
      error: null,
    });

    await expect(exportData()).rejects.toThrow('DATA_EXPORT_RESPONSE_OWNER_MISMATCH');

    expect(mocks.writeMobileDataExportFile).not.toHaveBeenCalled();
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

    expect(mocks.writeMobileDataExportFile).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('deletes a written cache file without sharing when the account changes after the write', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.writeMobileDataExportFile.mockImplementationOnce(async () => {
      beginAccountGenerationBoundary();
      return { chunksWritten: 1, bytesWritten: 128 };
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

  it('cleans a partial reserved file when the incremental writer observes an account change', async () => {
    mocks.writeMobileDataExportFile.mockImplementationOnce(async () => {
      beginAccountGenerationBoundary();
      throw new Error(ACCOUNT_GENERATION_CHANGED);
    });

    try {
      await expect(exportData()).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.markPlaintextStagingState).not.toHaveBeenCalled();
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
    expect(mocks.writeMobileDataExportFile).not.toHaveBeenCalled();
  });

  it('keeps the You tab from treating unavailable sharing as a successful export', () => {
    const source = readSource('app/(tabs)/you.tsx');
    const actions = readSource('features/settings/actions.ts');
    const staticImports = source.slice(0, source.indexOf('const POLICY_ROWS'));
    const exportOwner = source.slice(
      source.indexOf('const startExport = useCallback('),
      source.indexOf('const runAction = useCallback('),
    );

    expect(actions).toContain('if (isSupabaseConfigured)');
    expect(actions).toContain('collectLocalDeviceExportData()');
    expect(actions).toContain("serverAccountDataStatus = 'included'");
    expect(actions).toContain('writeMobileDataExportFile(staging.uri, bundle, lease)');
    expect(actions).not.toContain('writeAsStringAsync');
    expect(actions).not.toContain('JSON.stringify(bundle');
    const exportAction = actions.slice(actions.indexOf('export async function exportData()'));
    expect(exportAction.indexOf('await waitForExportE2EDelay(lease.signal);')).toBeLessThan(
      exportAction.indexOf('await collectLocalDeviceExportData();'),
    );
    expect(source).toContain("const { exportData } = await import('@/features/settings/actions');");
    expect(source).toContain('const shared = await exportData();');
    expect(staticImports).not.toContain('@/features/settings/actions');
    expect(exportOwner.indexOf("beginDataRightsOperation(stateRef.current, 'export'")).toBeLessThan(
      exportOwner.indexOf('stateRef.current = next;'),
    );
    expect(exportOwner.indexOf('stateRef.current = next;')).toBeLessThan(
      exportOwner.indexOf('recordYouExportStart();'),
    );
    expect(exportOwner.indexOf('recordYouExportStart();')).toBeLessThan(
      exportOwner.indexOf("await import('@/features/settings/actions')"),
    );
    expect(exportOwner.indexOf("await import('@/features/settings/actions')")).toBeLessThan(
      exportOwner.indexOf('!isOwnerQueryScopeCurrent(ownerScope)'),
    );
    expect(exportOwner.indexOf('!isOwnerQueryScopeCurrent(ownerScope)')).toBeLessThan(
      exportOwner.indexOf('const shared = await exportData();'),
    );
    expect(exportOwner.indexOf('await waitForDuplicateActivationFrame();')).toBeLessThan(
      exportOwner.indexOf('settleOperation(operationId);'),
    );
    expect(source).toContain('if (!shared)');
    expect(source).toContain('title: EXPORT_UNAVAILABLE_TITLE');
    expect(source).toContain('message: EXPORT_UNAVAILABLE_MESSAGE');
    expect(source).toContain('title: EXPORT_FAILED_TITLE');
    expect(source).toContain('message: dataRightsUserMessage()');
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
    mocks.armAccountDeletionVendorFreeze.mockReset();
    mocks.freezeAnalyticsIdentityForAccountDeletion.mockReset();
    mocks.freezeRevenueCatIdentityForAccountDeletion.mockReset();
    mocks.getAppleAuthorizationCodeForRevocation.mockReset();
    mocks.getSession.mockReset();
    mocks.getUser.mockReset();
    mocks.invoke.mockReset();
    mocks.isSupabaseConfigured = true;
    mocks.lookupAccountDeletionCompletion.mockReset();
    mocks.recordConsent.mockReset();
    mocks.markAccountDeletionBackendDeleted.mockReset();
    mocks.markAccountDeletionBackendDeletedFromCompletion.mockReset();
    mocks.readAccountDeletionRecoveryCapability.mockReset();
    mocks.shareAsync.mockReset();
    mocks.sharingAvailable.mockReset();
    mocks.signOut.mockReset();
    mocks.userHasAppleIdentity.mockReset();
    mocks.waitForRevenueCatOperationsToSettle.mockReset();
    mocks.getAppleAuthorizationCodeForRevocation.mockResolvedValue('apple-revocation-code');
    mocks.armAccountDeletionVendorFreeze.mockResolvedValue(ACCOUNT_DELETION_COMPLETION_TOKEN);
    mocks.freezeAnalyticsIdentityForAccountDeletion.mockResolvedValue(undefined);
    mocks.freezeRevenueCatIdentityForAccountDeletion.mockResolvedValue(undefined);
    mocks.markAccountDeletionBackendDeleted.mockResolvedValue(undefined);
    mocks.markAccountDeletionBackendDeletedFromCompletion.mockResolvedValue(undefined);
    mocks.lookupAccountDeletionCompletion.mockResolvedValue(null);
    mocks.readAccountDeletionRecoveryCapability.mockResolvedValue(null);
    mocks.waitForRevenueCatOperationsToSettle.mockResolvedValue(undefined);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1', user: { id: 'user-1' } } },
      error: null,
    });
    mocks.invoke.mockResolvedValue({ data: VALID_ACCOUNT_DELETION_RESPONSE, error: null });
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
    mocks.userHasAppleIdentity.mockReturnValue(true);
  });

  it('deletes through the backend before handing off to the root account boundary', async () => {
    await expect(deleteAccount(mocks.signOut)).resolves.toBeUndefined();

    expect(mocks.getAppleAuthorizationCodeForRevocation).toHaveBeenCalledWith({ id: 'user-1' });
    expect(mocks.armAccountDeletionVendorFreeze).toHaveBeenCalledWith('user-1');
    expect(mocks.waitForRevenueCatOperationsToSettle).toHaveBeenCalledTimes(1);
    expect(mocks.freezeAnalyticsIdentityForAccountDeletion).toHaveBeenCalledTimes(1);
    expect(mocks.freezeRevenueCatIdentityForAccountDeletion).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: {
        appleAuthorizationCode: 'apple-revocation-code',
        completionToken: ACCOUNT_DELETION_COMPLETION_TOKEN,
      },
      headers: { Authorization: 'Bearer token-1' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.markAccountDeletionBackendDeleted).toHaveBeenCalledWith('user-1');
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.invoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.markAccountDeletionBackendDeleted.mock.invocationCallOrder[0]!,
    );
    expect(mocks.markAccountDeletionBackendDeleted.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]!,
    );
    expect(mocks.armAccountDeletionVendorFreeze.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.freezeAnalyticsIdentityForAccountDeletion.mock.invocationCallOrder[0]!,
    );
    expect(
      mocks.freezeAnalyticsIdentityForAccountDeletion.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.invoke.mock.invocationCallOrder[0]!);
    expect(
      mocks.freezeRevenueCatIdentityForAccountDeletion.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.invoke.mock.invocationCallOrder[0]!);
  });

  it('fails before Edge when the RevenueCat native identity fence rejects', async () => {
    mocks.freezeRevenueCatIdentityForAccountDeletion.mockRejectedValueOnce(
      new Error('revenuecat reset unavailable'),
    );

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('revenuecat reset unavailable');

    expect(mocks.freezeAnalyticsIdentityForAccountDeletion).toHaveBeenCalledTimes(1);
    expect(mocks.freezeRevenueCatIdentityForAccountDeletion).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('fails before Edge when the PostHog deletion freeze cannot be verified', async () => {
    mocks.freezeAnalyticsIdentityForAccountDeletion.mockRejectedValueOnce(
      new Error('ACCOUNT_DELETION_ANALYTICS_FREEZE_TIMEOUT'),
    );

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'ACCOUNT_DELETION_ANALYTICS_FREEZE_TIMEOUT',
    );

    expect(mocks.armAccountDeletionVendorFreeze).toHaveBeenCalledTimes(1);
    expect(mocks.freezeRevenueCatIdentityForAccountDeletion).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionBackendDeleted).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('fails before provider resets or Edge when the durable freeze cannot persist', async () => {
    mocks.armAccountDeletionVendorFreeze.mockRejectedValueOnce(
      new Error('ACCOUNT_DELETION_VENDOR_FREEZE_WRITE_FAILED'),
    );

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'ACCOUNT_DELETION_VENDOR_FREEZE_WRITE_FAILED',
    );

    expect(mocks.freezeAnalyticsIdentityForAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.freezeRevenueCatIdentityForAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('bounds a wedged provider reset and fails closed before Edge', async () => {
    vi.useFakeTimers();
    try {
      mocks.freezeRevenueCatIdentityForAccountDeletion.mockReturnValueOnce(
        new Promise<void>(() => undefined),
      );

      const deletion = expect(deleteAccount(mocks.signOut)).rejects.toThrow(
        'ACCOUNT_DELETION_VENDOR_RESET_TIMEOUT',
      );
      await vi.waitFor(() =>
        expect(mocks.freezeRevenueCatIdentityForAccountDeletion).toHaveBeenCalledOnce(),
      );
      await vi.advanceTimersByTimeAsync(8_001);
      await deletion;

      expect(mocks.invoke).not.toHaveBeenCalled();
      expect(mocks.signOut).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses backend deletion while a subscriber-touching RevenueCat operation is unsettled', async () => {
    vi.useFakeTimers();
    try {
      mocks.waitForRevenueCatOperationsToSettle.mockReturnValueOnce(
        new Promise<void>(() => undefined),
      );

      const deletion = expect(deleteAccount(mocks.signOut)).rejects.toThrow(
        'ACCOUNT_DELETION_VENDOR_ACTIVITY_IN_FLIGHT',
      );
      await vi.waitFor(() =>
        expect(mocks.waitForRevenueCatOperationsToSettle).toHaveBeenCalledOnce(),
      );
      await vi.advanceTimersByTimeAsync(1_501);

      await deletion;
      expect(mocks.armAccountDeletionVendorFreeze).toHaveBeenCalledTimes(1);
      expect(mocks.freezeAnalyticsIdentityForAccountDeletion).not.toHaveBeenCalled();
      expect(mocks.freezeRevenueCatIdentityForAccountDeletion).not.toHaveBeenCalled();
      expect(mocks.invoke).not.toHaveBeenCalled();
      expect(mocks.markAccountDeletionBackendDeleted).not.toHaveBeenCalled();
      expect(mocks.signOut).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not sign out until backend completion is durably authorized for local cleanup', async () => {
    mocks.markAccountDeletionBackendDeleted.mockRejectedValueOnce(
      new Error('ACCOUNT_DELETION_VENDOR_FREEZE_COMPLETION_UNVERIFIED'),
    );

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'ACCOUNT_DELETION_VENDOR_FREEZE_COMPLETION_UNVERIFIED',
    );

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.markAccountDeletionBackendDeleted).toHaveBeenCalledWith('user-1');
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...VALID_ACCOUNT_DELETION_RESPONSE, deleted: false },
    { ...VALID_ACCOUNT_DELETION_RESPONSE, request_id: 'not-a-uuid' },
    { ...VALID_ACCOUNT_DELETION_RESPONSE, apple: 'unknown' },
    { ...VALID_ACCOUNT_DELETION_RESPONSE, posthog: 'unknown' },
  ])('fails closed without signing out for a malformed 2xx response: %j', async (response) => {
    mocks.invoke.mockResolvedValueOnce({ data: response, error: null });

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('ACCOUNT_DELETION_RESPONSE_INVALID');

    expect(mocks.armAccountDeletionVendorFreeze).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).not.toHaveBeenCalled();
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

    expect(mocks.lookupAccountDeletionCompletion).toHaveBeenCalledWith(
      ACCOUNT_DELETION_COMPLETION_TOKEN,
      expect.any(AbortSignal),
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('converges after a lost final response without replaying deletion or the Apple code', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error('response lost') });
    mocks.lookupAccountDeletionCompletion.mockResolvedValueOnce(VALID_ACCOUNT_DELETION_COMPLETION);

    await expect(deleteAccount(mocks.signOut)).resolves.toBeUndefined();

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.getAppleAuthorizationCodeForRevocation).toHaveBeenCalledTimes(1);
    expect(mocks.lookupAccountDeletionCompletion).toHaveBeenCalledWith(
      ACCOUNT_DELETION_COMPLETION_TOKEN,
      expect.any(AbortSignal),
    );
    expect(mocks.markAccountDeletionBackendDeleted).toHaveBeenCalledWith('user-1');
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('finishes a prior committed deletion after auth is already absent', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('user not found'),
    });
    mocks.readAccountDeletionRecoveryCapability.mockResolvedValueOnce({
      state: 'pending',
      ownerHash: 'a'.repeat(64),
      completionToken: ACCOUNT_DELETION_COMPLETION_TOKEN,
    });
    mocks.lookupAccountDeletionCompletion.mockResolvedValueOnce(VALID_ACCOUNT_DELETION_COMPLETION);

    await expect(deleteAccount(mocks.signOut)).resolves.toBeUndefined();

    expect(mocks.getAppleAuthorizationCodeForRevocation).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionBackendDeletedFromCompletion).toHaveBeenCalledWith(
      ACCOUNT_DELETION_COMPLETION_TOKEN,
    );
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('surfaces a root account-boundary failure after backend deletion', async () => {
    mocks.signOut.mockRejectedValueOnce(new Error('sign out unavailable'));

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('sign out unavailable');

    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: {
        appleAuthorizationCode: 'apple-revocation-code',
        completionToken: ACCOUNT_DELETION_COMPLETION_TOKEN,
      },
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
    expect(mocks.freezeAnalyticsIdentityForAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.freezeRevenueCatIdentityForAccountDeletion).not.toHaveBeenCalled();

    mocks.getAppleAuthorizationCodeForRevocation.mockResolvedValueOnce(null);
    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('APPLE_REAUTHORIZATION_REQUIRED');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)(
    'detaches a never-settling owner-A Apple prompt and contains its late %s',
    async (lateOutcome) => {
      let resolveAppleCode!: (code: string) => void;
      let rejectAppleCode!: (error: Error) => void;
      mocks.getAppleAuthorizationCodeForRevocation.mockImplementationOnce(
        () =>
          new Promise<string>((resolve, reject) => {
            resolveAppleCode = resolve;
            rejectAppleCode = reject;
          }),
      );

      const deletion = deleteAccount(mocks.signOut);
      const rejected = expect(deletion).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
      await vi.waitFor(() =>
        expect(mocks.getAppleAuthorizationCodeForRevocation).toHaveBeenCalledOnce(),
      );
      beginAccountGenerationBoundary();
      try {
        await waitForAccountGenerationOperationsToSettle();
        await rejected;
        expect(mocks.armAccountDeletionVendorFreeze).not.toHaveBeenCalled();
        expect(mocks.invoke).not.toHaveBeenCalled();
        expect(mocks.signOut).not.toHaveBeenCalled();

        if (lateOutcome === 'resolve') resolveAppleCode('single-use-code-for-a');
        else rejectAppleCode(new Error('late Apple reauthorization failure'));
        await Promise.resolve();
      } finally {
        endAccountGenerationBoundary();
      }

      expect(mocks.armAccountDeletionVendorFreeze).not.toHaveBeenCalled();
      expect(mocks.invoke).not.toHaveBeenCalled();
      expect(mocks.signOut).not.toHaveBeenCalled();
    },
  );

  it('drains an in-flight owner-A freeze write before account-boundary cleanup', async () => {
    let releaseFreeze!: () => void;
    mocks.armAccountDeletionVendorFreeze.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFreeze = resolve;
        }),
    );

    const deletion = deleteAccount(mocks.signOut);
    await vi.waitFor(() => expect(mocks.armAccountDeletionVendorFreeze).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    let drained = false;
    const drain = waitForAccountGenerationOperationsToSettle().then(() => {
      drained = true;
    });
    try {
      await Promise.resolve();
      expect(drained).toBe(false);
      releaseFreeze();
      await expect(deletion).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
      await drain;
      expect(drained).toBe(true);
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
      body: { completionToken: ACCOUNT_DELETION_COMPLETION_TOKEN },
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
      .mockResolvedValueOnce({ data: VALID_ACCOUNT_DELETION_RESPONSE, error: null });

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('NETWORK_REQUEST_UNKNOWN');
    await expect(deleteAccount(mocks.signOut)).resolves.toBeUndefined();

    expect(mocks.getAppleAuthorizationCodeForRevocation).toHaveBeenCalledTimes(2);
    expect(mocks.freezeAnalyticsIdentityForAccountDeletion).toHaveBeenCalledTimes(2);
    expect(mocks.freezeRevenueCatIdentityForAccountDeletion).toHaveBeenCalledTimes(2);
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'account-deletion', {
      method: 'POST',
      body: {
        appleAuthorizationCode: 'apple-code-1',
        completionToken: ACCOUNT_DELETION_COMPLETION_TOKEN,
      },
      headers: { Authorization: 'Bearer token-1' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'account-deletion', {
      method: 'POST',
      body: {
        appleAuthorizationCode: 'apple-code-2',
        completionToken: ACCOUNT_DELETION_COMPLETION_TOKEN,
      },
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
      body: {
        appleAuthorizationCode: 'apple-revocation-code',
        completionToken: ACCOUNT_DELETION_COMPLETION_TOKEN,
      },
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
      body: {
        appleAuthorizationCode: 'apple-revocation-code',
        completionToken: ACCOUNT_DELETION_COMPLETION_TOKEN,
      },
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

  it('keeps You-tab destructive data-rights actions section-owned, exclusive, and retryable', () => {
    const source = readSource('app/(tabs)/you.tsx');
    const stateMachine = readSource('features/settings/youDataRightsState.ts');
    const staticImports = source.slice(0, source.indexOf('const POLICY_ROWS'));
    const destructiveOwner = source.slice(
      source.indexOf('const runAction = useCallback('),
      source.indexOf('const context = useMemo<DataRightsContextValue>'),
    );

    expect(stateMachine).toContain(
      "type PendingDataRightsAction = 'withdraw_health_data' | 'delete_account';",
    );
    expect(source).toContain('const YouDataRightsCoordinator = memo(');
    expect(source).toContain('const [privacyActionFeedback, setPrivacyActionFeedback]');
    expect(source).toContain('const [dataRightsFeedback, setDataRightsFeedback]');
    expect(source).toContain('const stateRef = useRef<DataRightsState>(IDLE_DATA_RIGHTS_STATE);');
    expect(source).toContain('beginDataRightsConfirmation(stateRef.current, action)');
    expect(source).toContain("beginDataRightsOperation(stateRef.current, 'export', operationId)");
    expect(source).toContain('beginDataRightsOperation(stateRef.current, action, operationId)');
    expect(source).toContain('recordYouDestructiveStart();');
    expect(
      destructiveOwner.indexOf('beginDataRightsOperation(stateRef.current, action'),
    ).toBeLessThan(destructiveOwner.indexOf('stateRef.current = next;'));
    expect(destructiveOwner.indexOf('stateRef.current = next;')).toBeLessThan(
      destructiveOwner.indexOf('recordYouDestructiveStart();'),
    );
    expect(destructiveOwner.indexOf('recordYouDestructiveStart();')).toBeLessThan(
      destructiveOwner.indexOf("await import('@/features/settings/actions')"),
    );
    expect(destructiveOwner.indexOf("await import('@/features/settings/actions')")).toBeLessThan(
      destructiveOwner.indexOf('!isOwnerQueryScopeCurrent(ownerScope)'),
    );
    expect(destructiveOwner.indexOf('!isOwnerQueryScopeCurrent(ownerScope)')).toBeLessThan(
      destructiveOwner.indexOf('await actions.withdrawHealthDataConsent(signOut)'),
    );
    expect(source).toContain('function InlineConfirmCard(');
    expect(source).toContain('const DATA_RIGHTS_CONFIRMATION_SCROLL_NUDGE = 144;');
    expect(source).toContain('const scrollY = useRef(0);');
    expect(source).toContain('const nudgeDataRightsConfirmationIntoView = useCallback(');
    expect(source).toContain('scrollY.current + DATA_RIGHTS_CONFIRMATION_SCROLL_NUDGE');
    expect(source).toContain('scrollEventThrottle={16}');
    expect(source).toContain("promptAction('withdraw_health_data')");
    expect(source).toContain("promptAction('delete_account')");
    expect(source).toContain("runAction('withdraw_health_data')");
    expect(source).toContain("runAction('delete_account')");
    expect(source).toContain('{confirmingWithdraw || withdrawing ? (');
    expect(source).toContain("confirmLabel={withdrawing ? 'Working...' : 'Withdraw & delete'}");
    expect(source).toContain('disabled={withdrawing}');
    expect(source).toContain('{confirmingDelete || deleting ? (');
    expect(source).toContain("confirmLabel={deleting ? 'Working...' : 'Delete'}");
    expect(source).toContain('disabled={deleting}');
    expect(source).toContain('WITHDRAW_HEALTH_DATA_CONFIRM_TITLE');
    expect(source).toContain('WITHDRAW_HEALTH_DATA_FAILED_TITLE');
    expect(source).toContain('DELETE_ACCOUNT_CONFIRM_TITLE');
    expect(source).toContain('DELETE_ACCOUNT_FAILED_TITLE');
    expect(source).toContain('onCancel={cancelConfirmation}');
    expect(source).toContain("onConfirm={() => runAction('withdraw_health_data')}");
    expect(source).toContain("onConfirm={() => runAction('delete_account')}");
    expect(source).toContain('clearFeedback();');
    expect(source).toContain('onConfirmationDismissed={cancelDataRightsConfirmationScroll}');
    expect(source).toContain('cancelAnimationFrame(confirmationScrollFrameRef.current);');
    expect(source).toContain('clearTimeout(confirmationScrollRetryRef.current);');
    expect(staticImports).not.toContain('@/features/settings/actions');
    expect(source).not.toContain('Alert.alert');
    expect(source).not.toContain('import { Alert');
  });
});
