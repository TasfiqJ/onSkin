import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { BRAND } from '@/lib/brand';

import {
  deleteAccount,
  exportData,
  isAcceptedAccountDeletionLocalSignOutIncomplete,
  isAccountDeletionAuthSessionUnavailable,
  withdrawHealthDataConsent,
} from './actions';
import {
  consumeAccountDeletionNotice,
  resetAccountDeletionNoticeForTests,
} from './accountDeletionNotice';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const STAGED_EXPORT = {
  operationId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  purpose: 'data_export_json' as const,
  uri: 'file://cache/private-plaintext-staging-v1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json',
};
const COMPLETE_ACCOUNT_DELETION_RESPONSE = {
  status: 'accepted',
  phase: 'queued',
  nextPollAfterSeconds: 2,
};
const OWNER_A = 'a1'.repeat(32);
const OWNER_B = 'b2'.repeat(32);
const DELETION_TOKENS = {
  version: 2 as const,
  ownerBinding: OWNER_A,
  state: 'prepared' as const,
  createdAt: '2026-07-13T20:00:00.000Z',
  idempotencyKey: '01'.repeat(32),
  statusCapability: '02'.repeat(32),
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  beginAccountDeletionIntakeHold: vi.fn(),
  beginHealthDataConsentWithdrawal: vi.fn(),
  beginSupabaseRemoteDeletionBoundary: vi.fn(),
  buildMobileDataExportBundle: vi.fn(),
  cleanupPlaintextStaging: vi.fn(),
  collectLocalDeviceExportData: vi.fn(),
  closeSupabaseRemoteRequestBoundary: vi.fn(),
  deleteAsync: vi.fn(),
  assertStoreTransactionDeletionJournalReadable: vi.fn(),
  createAccountDeletionOwnerBinding: vi.fn(),
  fetch: vi.fn(),
  getAppleAuthorizationCodeForRevocation: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  invoke: vi.fn(),
  isSupabaseConfigured: true,
  markPlaintextStagingState: vi.fn(),
  markAccountDeletionIntakeState: vi.fn(),
  preparePendingAccountDeletion: vi.fn(),
  quarantineLocalAccount: vi.fn(),
  readLocalDataOwnership: vi.fn(),
  recordConsent: vi.fn(),
  requestAccountDeletionRecovery: vi.fn(),
  requireSupabaseRemoteSessionBinding: vi.fn(),
  releaseAccountDeletionIntakeHold: vi.fn(),
  reservePlaintextStaging: vi.fn(),
  shareAsync: vi.fn(),
  sharingAvailable: vi.fn(),
  signOut: vi.fn(),
  startRevenueCatDeletionQuiesce: vi.fn(),
  runWithSupabaseAccountDeletionRequestPermit: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));

vi.mock('@/features/settings/accountDeletionBarrier', () => ({
  beginAccountDeletionIntakeHold: mocks.beginAccountDeletionIntakeHold,
}));

vi.mock('@/features/healthConsent/lifecycle', () => ({
  beginHealthDataConsentWithdrawal: mocks.beginHealthDataConsentWithdrawal,
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
}));

vi.mock('@/lib/auth/sessionOwner', () => ({
  readLocalDataOwnership: mocks.readLocalDataOwnership,
}));

vi.mock('@/lib/iap/revenuecat', () => ({
  startRevenueCatDeletionQuiesce: mocks.startRevenueCatDeletionQuiesce,
}));

vi.mock('@/lib/iap/storeTransactionNotice', () => ({
  assertStoreTransactionDeletionJournalReadable:
    mocks.assertStoreTransactionDeletionJournalReadable,
}));

vi.mock('@/lib/consent/consent', () => ({
  recordConsent: mocks.recordConsent,
}));

vi.mock('./accountDeletionRecovery', () => ({
  quarantineAccountDeletionSession: mocks.quarantineLocalAccount,
}));

vi.mock('./accountDeletionClientState', () => ({
  accountDeletionRecordMatchesOwner: (
    record: { version: number; ownerBinding?: string },
    ownerBinding: string,
  ) => record.version === 2 && record.ownerBinding === ownerBinding,
  createAccountDeletionOwnerBinding: mocks.createAccountDeletionOwnerBinding,
  markAccountDeletionIntakeState: mocks.markAccountDeletionIntakeState,
  preparePendingAccountDeletion: mocks.preparePendingAccountDeletion,
  requestAccountDeletionRecovery: mocks.requestAccountDeletionRecovery,
}));

vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://project.supabase.co',
    supabasePublishableKey: 'sb_publishable_test',
  },
  get isSupabaseConfigured() {
    return mocks.isSupabaseConfigured;
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  readPersistedSupabaseSessionCandidate: async () => {
    const result = await mocks.getSession();
    if (result.error) throw result.error;
    return result.data.session;
  },
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

vi.mock('@/lib/supabase/remoteRequestGate', () => ({
  beginSupabaseRemoteDeletionBoundary: mocks.beginSupabaseRemoteDeletionBoundary,
  closeSupabaseRemoteRequestBoundary: mocks.closeSupabaseRemoteRequestBoundary,
  requireSupabaseRemoteSessionBinding: mocks.requireSupabaseRemoteSessionBinding,
  runWithSupabaseAccountDeletionRequestPermit: mocks.runWithSupabaseAccountDeletionRequestPermit,
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
    mocks.readLocalDataOwnership.mockReset();
    mocks.recordConsent.mockReset();
    mocks.reservePlaintextStaging.mockReset();
    mocks.shareAsync.mockReset();
    mocks.sharingAvailable.mockReset();
    mocks.signOut.mockReset();
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
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'export-token-a',
          user: { id: 'user-1' },
        },
      },
      error: null,
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.invoke.mockResolvedValue({
      data: { export_schema_version: 2, user_id: 'user-1', account: { id: 'user-1' } },
      error: null,
    });
    mocks.readLocalDataOwnership.mockImplementation(async (userId: string | null) =>
      userId === null ? 'unclaimed' : 'match',
    );
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.reservePlaintextStaging.mockResolvedValue(STAGED_EXPORT);
    mocks.markPlaintextStagingState.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
    mocks.writeAsStringAsync.mockResolvedValue(undefined);
  });

  it('writes, shares, and deletes a one-time export file when sharing is available', async () => {
    mocks.sharingAvailable.mockResolvedValueOnce(true);
    mocks.shareAsync.mockResolvedValueOnce(undefined);

    await expect(exportData()).resolves.toBe(true);

    expect(mocks.getUser).toHaveBeenCalledWith('export-token-a');
    expect(mocks.readLocalDataOwnership).toHaveBeenCalledWith('user-1');
    expect(mocks.collectLocalDeviceExportData).toHaveBeenCalledWith(
      expect.objectContaining({
        generation: expect.any(Number),
        signal: expect.any(AbortSignal),
        assertCurrent: expect.any(Function),
      }),
      'user-1',
    );
    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.collectLocalDeviceExportData.mock.invocationCallOrder[0]!,
    );
    expect(mocks.invoke).toHaveBeenCalledWith('data-export', {
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

    expect(mocks.collectLocalDeviceExportData).toHaveBeenCalledWith(
      expect.objectContaining({ assertCurrent: expect.any(Function) }),
      null,
    );

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

    await expect(exportData()).rejects.toThrow('edge unavailable');

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

  it('fails closed before reading local data when its durable owner does not match', async () => {
    mocks.readLocalDataOwnership.mockResolvedValueOnce('mismatch');

    await expect(exportData()).rejects.toThrow('DATA_EXPORT_LOCAL_OWNER_MISMATCH');

    expect(mocks.collectLocalDeviceExportData).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.reservePlaintextStaging).not.toHaveBeenCalled();
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

  it('rejects an A-to-B-to-A boundary during the local snapshot before staging plaintext', async () => {
    const localSnapshot = deferred<unknown>();
    mocks.collectLocalDeviceExportData.mockReturnValueOnce(localSnapshot.promise);

    const pendingExport = exportData();
    await vi.waitFor(() => expect(mocks.collectLocalDeviceExportData).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    localSnapshot.resolve({
      schema_version: 1,
      collected_at: '2026-07-10T12:00:00.000Z',
      storage_scope: 'encrypted_private_storage_on_this_device',
      sections: {
        account_and_privacy: {},
        profile_and_preferences: {},
        shelf_and_routine: {},
        activity_and_app_state: {},
        subscription: {},
        progress: {},
      },
      exclusions: [],
    });

    await expect(pendingExport).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.reservePlaintextStaging).not.toHaveBeenCalled();
    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
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
    expect(actions).toContain('collectLocalDeviceExportData(lease, expectedUserId)');
    expect(actions).toContain('readLocalDataOwnership(expectedUserId)');
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
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.assertStoreTransactionDeletionJournalReadable.mockReset();
    mocks.beginAccountDeletionIntakeHold.mockReset();
    mocks.beginHealthDataConsentWithdrawal.mockReset();
    mocks.beginSupabaseRemoteDeletionBoundary.mockReset();
    mocks.closeSupabaseRemoteRequestBoundary.mockReset();
    mocks.deleteAsync.mockReset();
    mocks.createAccountDeletionOwnerBinding.mockReset();
    mocks.fetch.mockReset();
    mocks.getAppleAuthorizationCodeForRevocation.mockReset();
    mocks.getSession.mockReset();
    mocks.getUser.mockReset();
    mocks.invoke.mockReset();
    mocks.isSupabaseConfigured = true;
    mocks.markAccountDeletionIntakeState.mockReset();
    mocks.quarantineLocalAccount.mockReset();
    mocks.preparePendingAccountDeletion.mockReset();
    mocks.recordConsent.mockReset();
    mocks.requestAccountDeletionRecovery.mockReset();
    mocks.requireSupabaseRemoteSessionBinding.mockReset();
    mocks.releaseAccountDeletionIntakeHold.mockReset();
    mocks.shareAsync.mockReset();
    mocks.sharingAvailable.mockReset();
    mocks.signOut.mockReset();
    mocks.startRevenueCatDeletionQuiesce.mockReset();
    mocks.runWithSupabaseAccountDeletionRequestPermit.mockReset();
    mocks.writeAsStringAsync.mockReset();
    mocks.getAppleAuthorizationCodeForRevocation.mockResolvedValue('apple-revocation-code');
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'captured-token-a',
          user: { id: 'user-1' },
        },
      },
      error: null,
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.createAccountDeletionOwnerBinding.mockResolvedValue(OWNER_A);
    mocks.assertStoreTransactionDeletionJournalReadable.mockResolvedValue(undefined);
    mocks.beginAccountDeletionIntakeHold.mockReturnValue(mocks.releaseAccountDeletionIntakeHold);
    mocks.requireSupabaseRemoteSessionBinding.mockReturnValue({
      accessToken: 'captured-token-a',
      sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      subject: 'user-1',
    });
    mocks.beginSupabaseRemoteDeletionBoundary.mockImplementation(async (binding) => binding);
    mocks.closeSupabaseRemoteRequestBoundary.mockResolvedValue(undefined);
    mocks.runWithSupabaseAccountDeletionRequestPermit.mockImplementation(
      async (_permit, transport, operation) => operation(transport),
    );
    mocks.startRevenueCatDeletionQuiesce.mockResolvedValue(undefined);
    resetAccountDeletionNoticeForTests();
    mocks.invoke.mockResolvedValue({
      data: COMPLETE_ACCOUNT_DELETION_RESPONSE,
      error: null,
      response: { status: 202 },
    });
    mocks.fetch.mockImplementation(async (_input: string, init?: RequestInit) => {
      const result = await mocks.invoke('account-deletion', {
        method: init?.method,
        body: JSON.parse(String(init?.body)) as unknown,
        signal: init?.signal,
      });
      if (result.error && !result.response) throw result.error;
      return new Response(JSON.stringify(result.data), {
        status: result.response?.status ?? (result.error ? 500 : 202),
        headers: { 'Content-Type': 'application/json' },
      });
    });
    mocks.markAccountDeletionIntakeState.mockResolvedValue({
      ...DELETION_TOKENS,
      state: 'accepted',
    });
    mocks.preparePendingAccountDeletion.mockResolvedValue(DELETION_TOKENS);
    mocks.quarantineLocalAccount.mockResolvedValue(undefined);
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.beginHealthDataConsentWithdrawal.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
  });

  it('persists both tokens, accepts only HTTP 202, then hands off to the root boundary', async () => {
    await expect(deleteAccount(mocks.signOut)).resolves.toEqual({
      status: 'accepted_or_ambiguous',
      phase: 'queued',
      nextPollAfterSeconds: 2,
    });

    expect(mocks.getSession).toHaveBeenCalledOnce();
    expect(mocks.getUser).toHaveBeenCalledWith('captured-token-a');
    expect(mocks.requireSupabaseRemoteSessionBinding).toHaveBeenCalledWith(
      'captured-token-a',
      'user-1',
    );
    expect(mocks.createAccountDeletionOwnerBinding).toHaveBeenCalledWith('user-1');
    expect(mocks.getAppleAuthorizationCodeForRevocation).toHaveBeenCalledWith({ id: 'user-1' });
    expect(mocks.assertStoreTransactionDeletionJournalReadable).toHaveBeenCalledWith(OWNER_A);
    expect(mocks.beginAccountDeletionIntakeHold).toHaveBeenCalledOnce();
    expect(mocks.beginSupabaseRemoteDeletionBoundary).toHaveBeenCalledWith({
      accessToken: 'captured-token-a',
      sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      subject: 'user-1',
    });
    expect(mocks.startRevenueCatDeletionQuiesce).toHaveBeenCalledWith('user-1');
    expect(mocks.preparePendingAccountDeletion).toHaveBeenCalledWith(OWNER_A);
    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: {
        action: 'begin',
        idempotencyKey: DELETION_TOKENS.idempotencyKey,
        statusCapability: DELETION_TOKENS.statusCapability,
        appleAuthorizationCode: 'apple-revocation-code',
      },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/account-deletion',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          apikey: 'sb_publishable_test',
          Authorization: 'Bearer captured-token-a',
          'Content-Type': 'application/json',
        },
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
      }),
    );
    expect(mocks.runWithSupabaseAccountDeletionRequestPermit).toHaveBeenCalledWith(
      {
        action: 'begin',
        timeoutMs: 15_000,
        binding: {
          accessToken: 'captured-token-a',
          sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          subject: 'user-1',
        },
      },
      expect.any(Function),
      expect.any(Function),
    );
    expect(mocks.getAppleAuthorizationCodeForRevocation.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.assertStoreTransactionDeletionJournalReadable.mock.invocationCallOrder[0]!,
    );
    expect(
      mocks.assertStoreTransactionDeletionJournalReadable.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.beginSupabaseRemoteDeletionBoundary.mock.invocationCallOrder[0]!);
    expect(mocks.beginSupabaseRemoteDeletionBoundary.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.beginAccountDeletionIntakeHold.mock.invocationCallOrder[0]!,
    );
    expect(mocks.beginAccountDeletionIntakeHold.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.startRevenueCatDeletionQuiesce.mock.invocationCallOrder[0]!,
    );
    expect(mocks.startRevenueCatDeletionQuiesce.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.preparePendingAccountDeletion.mock.invocationCallOrder[0]!,
    );
    expect(mocks.preparePendingAccountDeletion.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.releaseAccountDeletionIntakeHold.mock.invocationCallOrder[0]!,
    );
    expect(mocks.releaseAccountDeletionIntakeHold.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.invoke.mock.invocationCallOrder[0]!,
    );
    expect(mocks.invoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.closeSupabaseRemoteRequestBoundary.mock.invocationCallOrder[0]!,
    );
    expect(mocks.closeSupabaseRemoteRequestBoundary).toHaveBeenCalledOnce();
    expect(mocks.markAccountDeletionIntakeState).toHaveBeenCalledWith('accepted', OWNER_A);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
    expect(mocks.quarantineLocalAccount).not.toHaveBeenCalled();
    expect(readSource('features/settings/actions.ts')).not.toContain('supabase.auth.getSession');
  });

  it('does not create deletion authority when the exact-owner commerce journal is unreadable', async () => {
    mocks.assertStoreTransactionDeletionJournalReadable.mockRejectedValueOnce(
      new Error('STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE'),
    );

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE',
    );

    expect(mocks.assertStoreTransactionDeletionJournalReadable).toHaveBeenCalledWith(OWNER_A);
    expect(mocks.startRevenueCatDeletionQuiesce).not.toHaveBeenCalled();
    expect(mocks.beginAccountDeletionIntakeHold).not.toHaveBeenCalled();
    expect(mocks.releaseAccountDeletionIntakeHold).not.toHaveBeenCalled();
    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
    expect(mocks.beginSupabaseRemoteDeletionBoundary).not.toHaveBeenCalled();
    expect(mocks.closeSupabaseRemoteRequestBoundary).not.toHaveBeenCalled();
  });

  it('enters exact remote deletion state before the intake-hold notification runs', async () => {
    mocks.beginAccountDeletionIntakeHold.mockImplementationOnce(() => {
      expect(mocks.beginSupabaseRemoteDeletionBoundary).toHaveBeenCalledOnce();
      return mocks.releaseAccountDeletionIntakeHold;
    });

    await expect(deleteAccount(mocks.signOut)).resolves.toMatchObject({ phase: 'queued' });

    expect(mocks.beginSupabaseRemoteDeletionBoundary.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.beginAccountDeletionIntakeHold.mock.invocationCallOrder[0]!,
    );
  });

  it('does not treat a readable unresolved commerce journal as a deletion blocker', async () => {
    // The journal API intentionally resolves for a structurally valid pending
    // transaction. Its own tests cover that state; this test guards the
    // deletion caller from adding a transaction-resolution wait afterward.
    mocks.assertStoreTransactionDeletionJournalReadable.mockResolvedValueOnce(undefined);

    await expect(deleteAccount(mocks.signOut)).resolves.toMatchObject({ phase: 'queued' });

    expect(mocks.assertStoreTransactionDeletionJournalReadable).toHaveBeenCalledWith(OWNER_A);
    expect(mocks.startRevenueCatDeletionQuiesce).toHaveBeenCalledWith('user-1');
    expect(mocks.beginAccountDeletionIntakeHold).toHaveBeenCalledOnce();
    expect(mocks.releaseAccountDeletionIntakeHold).toHaveBeenCalledOnce();
    expect(mocks.preparePendingAccountDeletion).toHaveBeenCalledWith(OWNER_A);
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it('keeps durable preparation and transport closed while commerce quiescence is pending', async () => {
    const quiescence = deferred<void>();
    mocks.startRevenueCatDeletionQuiesce.mockReturnValueOnce(quiescence.promise);

    const deletion = deleteAccount(mocks.signOut);
    await vi.waitFor(() => expect(mocks.startRevenueCatDeletionQuiesce).toHaveBeenCalledOnce());

    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
    expect(mocks.releaseAccountDeletionIntakeHold).not.toHaveBeenCalled();

    quiescence.resolve(undefined);
    await expect(deletion).resolves.toMatchObject({ phase: 'queued' });
    expect(mocks.preparePendingAccountDeletion).toHaveBeenCalledOnce();
    expect(mocks.releaseAccountDeletionIntakeHold).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it('leaves no durable deletion record when commerce quiescence times out or remains quarantined', async () => {
    const quiescence = deferred<void>();
    mocks.startRevenueCatDeletionQuiesce.mockReturnValueOnce(quiescence.promise);

    const deletion = deleteAccount(mocks.signOut);
    await vi.waitFor(() => expect(mocks.startRevenueCatDeletionQuiesce).toHaveBeenCalledOnce());
    quiescence.reject(new Error('ACCOUNT_PUBLICATION_OPERATION_QUARANTINED'));

    await expect(deletion).rejects.toThrow('ACCOUNT_PUBLICATION_OPERATION_QUARANTINED');
    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
    expect(mocks.releaseAccountDeletionIntakeHold).toHaveBeenCalledOnce();
    expect(mocks.closeSupabaseRemoteRequestBoundary.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.releaseAccountDeletionIntakeHold.mock.invocationCallOrder[0]!,
    );
  });

  it('leaves no durable deletion record when subject-bound quiescence rejects synchronously', async () => {
    mocks.startRevenueCatDeletionQuiesce.mockImplementationOnce(() => {
      throw new Error('ACCOUNT_PUBLICATION_BINDING_REJECTED');
    });

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'ACCOUNT_PUBLICATION_BINDING_REJECTED',
    );

    expect(mocks.assertStoreTransactionDeletionJournalReadable).toHaveBeenCalledWith(OWNER_A);
    expect(mocks.startRevenueCatDeletionQuiesce).toHaveBeenCalledWith('user-1');
    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
    expect(mocks.releaseAccountDeletionIntakeHold).toHaveBeenCalledOnce();
    expect(mocks.closeSupabaseRemoteRequestBoundary.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.releaseAccountDeletionIntakeHold.mock.invocationCallOrder[0]!,
    );
  });

  it('allows a later explicit quiescence retry before preparing or dispatching once', async () => {
    mocks.startRevenueCatDeletionQuiesce
      .mockRejectedValueOnce(new Error('ACCOUNT_PUBLICATION_OPERATION_QUARANTINED'))
      .mockResolvedValueOnce(undefined);

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'ACCOUNT_PUBLICATION_OPERATION_QUARANTINED',
    );
    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.releaseAccountDeletionIntakeHold).toHaveBeenCalledOnce();

    await expect(deleteAccount(mocks.signOut)).resolves.toMatchObject({ phase: 'queued' });
    expect(mocks.startRevenueCatDeletionQuiesce).toHaveBeenCalledTimes(2);
    expect(mocks.preparePendingAccountDeletion).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.releaseAccountDeletionIntakeHold).toHaveBeenCalledTimes(2);
  });

  it('returns pending quiescence across the intentional boundary abort, then uses a fresh signal', async () => {
    const quiescence = deferred<void>();
    mocks.beginAccountDeletionIntakeHold.mockImplementationOnce(() => {
      beginAccountGenerationBoundary();
      return mocks.releaseAccountDeletionIntakeHold;
    });
    mocks.startRevenueCatDeletionQuiesce.mockReturnValueOnce(quiescence.promise);

    const deletion = deleteAccount(mocks.signOut);
    try {
      await vi.waitFor(() => expect(mocks.startRevenueCatDeletionQuiesce).toHaveBeenCalledOnce());

      let generationOperationSettled = false;
      void waitForAccountGenerationOperationsToSettle().then(() => {
        generationOperationSettled = true;
      });
      await vi.waitFor(() => expect(generationOperationSettled).toBe(true));

      expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(mocks.releaseAccountDeletionIntakeHold).not.toHaveBeenCalled();

      quiescence.resolve(undefined);
      await expect(deletion).resolves.toMatchObject({ phase: 'queued' });

      const requestSignal = mocks.invoke.mock.calls[0]?.[1].signal as AbortSignal | undefined;
      expect(requestSignal).toBeInstanceOf(AbortSignal);
      expect(requestSignal?.aborted).toBe(false);
      expect(mocks.preparePendingAccountDeletion).toHaveBeenCalledOnce();
      expect(mocks.releaseAccountDeletionIntakeHold).toHaveBeenCalledOnce();
      expect(mocks.fetch).toHaveBeenCalledOnce();
    } finally {
      quiescence.resolve(undefined);
      endAccountGenerationBoundary();
      await deletion.catch(() => undefined);
    }
  });

  it('keeps prepared evidence and does not sign out after an explicit HTTP rejection', async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: null,
      error: new Error('rate limited'),
      response: { status: 429 },
    });

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('ACCOUNT_DELETION_RESPONSE_INVALID');

    expect(mocks.preparePendingAccountDeletion).toHaveBeenCalledOnce();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
  });

  it.each(['returned fetch error', 'thrown fetch error'])(
    'treats a %s as transport-ambiguous, preserves retry auth, and quarantines locally',
    async (mode) => {
      const fetchError = Object.assign(new Error('network lost'), {
        name: 'FunctionsFetchError',
      });
      if (mode === 'returned fetch error') {
        mocks.invoke.mockResolvedValueOnce({ data: null, error: fetchError });
      } else {
        mocks.invoke.mockRejectedValueOnce(fetchError);
      }

      await expect(deleteAccount(mocks.signOut)).resolves.toEqual({
        status: 'accepted_or_ambiguous',
        phase: 'unknown',
        nextPollAfterSeconds: null,
      });

      expect(mocks.markAccountDeletionIntakeState).toHaveBeenCalledWith('ambiguous', OWNER_A);
      expect(mocks.signOut).not.toHaveBeenCalled();
      expect(mocks.quarantineLocalAccount).not.toHaveBeenCalled();
      expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
    },
  );

  it('reuses the original authenticated token pair after lost-before-send then 404 recovery', async () => {
    const lostBeforeSend = Object.assign(new Error('network lost before send'), {
      name: 'FunctionsFetchError',
    });
    const retryable404Record = { ...DELETION_TOKENS, state: 'invalid_retryable' as const };
    mocks.preparePendingAccountDeletion
      .mockResolvedValueOnce(DELETION_TOKENS)
      .mockResolvedValueOnce(retryable404Record);
    mocks.invoke.mockRejectedValueOnce(lostBeforeSend).mockResolvedValueOnce({
      data: COMPLETE_ACCOUNT_DELETION_RESPONSE,
      error: null,
      response: { status: 202 },
    });

    await expect(deleteAccount(mocks.signOut)).resolves.toMatchObject({ phase: 'unknown' });
    // Capability polling's exact 404 transitions the same durable record to
    // invalid_retryable; accountDeletionClientState.test.ts covers that commit.
    await expect(deleteAccount(mocks.signOut)).resolves.toMatchObject({ phase: 'queued' });

    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    const firstBody = mocks.invoke.mock.calls[0]![1].body;
    const retryBody = mocks.invoke.mock.calls[1]![1].body;
    expect(retryBody).toEqual(firstBody);
    expect(retryBody).toMatchObject({
      idempotencyKey: DELETION_TOKENS.idempotencyKey,
      statusCapability: DELETION_TOKENS.statusCapability,
    });
    expect(mocks.markAccountDeletionIntakeState).toHaveBeenNthCalledWith(1, 'ambiguous', OWNER_A);
    expect(mocks.markAccountDeletionIntakeState).toHaveBeenNthCalledWith(2, 'accepted', OWNER_A);
    expect(mocks.quarantineLocalAccount).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('aborts intake at 15 seconds and treats the response-lost result as ambiguous', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    try {
      mocks.invoke.mockImplementationOnce(
        (_name: string, options: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            requestSignal = options.signal;
            options.signal?.addEventListener(
              'abort',
              () => {
                const error = new Error('request aborted');
                error.name = 'AbortError';
                reject(error);
              },
              { once: true },
            );
          }),
      );

      const deletion = deleteAccount(mocks.signOut);
      await vi.advanceTimersByTimeAsync(0);
      expect(requestSignal).toBeInstanceOf(AbortSignal);
      expect(requestSignal?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(14_999);
      expect(mocks.signOut).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      await expect(deletion).resolves.toEqual({
        status: 'accepted_or_ambiguous',
        phase: 'unknown',
        nextPollAfterSeconds: null,
      });

      expect(requestSignal?.aborted).toBe(true);
      expect(mocks.markAccountDeletionIntakeState).toHaveBeenCalledWith('ambiguous', OWNER_A);
      expect(mocks.signOut).not.toHaveBeenCalled();
      expect(mocks.quarantineLocalAccount).not.toHaveBeenCalled();
      expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the intake deadline after an early response without later aborting its signal', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    try {
      mocks.invoke.mockImplementationOnce((_name: string, options: { signal?: AbortSignal }) => {
        requestSignal = options.signal;
        return Promise.resolve({
          data: COMPLETE_ACCOUNT_DELETION_RESPONSE,
          error: null,
          response: { status: 202 },
        });
      });

      await expect(deleteAccount(mocks.signOut)).resolves.toEqual({
        status: 'accepted_or_ambiguous',
        phase: 'queued',
        nextPollAfterSeconds: 2,
      });

      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(requestSignal?.aborted).toBe(false);
      expect(mocks.signOut).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a transport completion that arrives after the intake deadline', async () => {
    vi.useFakeTimers();
    let completeTransport:
      | ((value: {
          data: typeof COMPLETE_ACCOUNT_DELETION_RESPONSE;
          error: null;
          response: { status: number };
        }) => void)
      | undefined;
    try {
      mocks.invoke.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            completeTransport = resolve;
          }),
      );

      const deletion = deleteAccount(mocks.signOut);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(15_000);
      await expect(deletion).resolves.toEqual({
        status: 'accepted_or_ambiguous',
        phase: 'unknown',
        nextPollAfterSeconds: null,
      });

      completeTransport?.({
        data: COMPLETE_ACCOUNT_DELETION_RESPONSE,
        error: null,
        response: { status: 202 },
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(mocks.markAccountDeletionIntakeState).toHaveBeenCalledWith('ambiguous', OWNER_A);
      expect(mocks.signOut).not.toHaveBeenCalled();
      expect(mocks.quarantineLocalAccount).not.toHaveBeenCalled();
      expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not misclassify a response parse failure as transport ambiguity', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response('<html>', { status: 202 }));

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('ACCOUNT_DELETION_RESPONSE_INVALID');

    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
  });

  it('does not invoke the backend when token persistence fails', async () => {
    mocks.preparePendingAccountDeletion.mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('keychain unavailable');

    expect(mocks.getUser).toHaveBeenCalledWith('captured-token-a');
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
  });

  it('keeps the startup barrier closed when Auth lookup fails after token persistence', async () => {
    mocks.getUser.mockRejectedValueOnce(new Error('auth transport unavailable'));

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE',
    );

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
    expect(
      isAccountDeletionAuthSessionUnavailable(
        new Error('ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE'),
      ),
    ).toBe(true);
  });

  it('never sends an unauthenticated retry when the quarantined session is missing', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE',
    );

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.quarantineLocalAccount).not.toHaveBeenCalled();
    expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
  });

  it('rejects a server-verified foreign user before deriving or entering deletion authority', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-b' } }, error: null });

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE',
    );

    expect(mocks.requireSupabaseRemoteSessionBinding).not.toHaveBeenCalled();
    expect(mocks.beginSupabaseRemoteDeletionBoundary).not.toHaveBeenCalled();
    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('treats a stale exact-bound begin permit as ambiguous without dispatching a foreign request', async () => {
    mocks.runWithSupabaseAccountDeletionRequestPermit.mockRejectedValueOnce(
      new Error('SUPABASE_REMOTE_REQUEST_RESULT_STALE'),
    );

    await expect(deleteAccount(mocks.signOut)).resolves.toEqual({
      status: 'accepted_or_ambiguous',
      phase: 'unknown',
      nextPollAfterSeconds: null,
    });

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).toHaveBeenCalledWith('ambiguous', OWNER_A);
    expect(mocks.closeSupabaseRemoteRequestBoundary).toHaveBeenCalledOnce();
  });

  it('aborts an A-to-B boundary before durable evidence can be persisted', async () => {
    let resolveSession:
      | ((value: {
          data: {
            session: { access_token: string; user: { id: string } };
          };
          error: null;
        }) => void)
      | undefined;
    mocks.getSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    const observed = deleteAccount(mocks.signOut).then(
      () => null,
      (error: unknown) => error,
    );
    await vi.waitFor(() => expect(mocks.getSession).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    try {
      resolveSession?.({
        data: { session: { access_token: 'token-b', user: { id: 'user-b' } } },
        error: null,
      });
      await expect(observed).resolves.toMatchObject({ message: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
  });

  it('aborts an A-to-B boundary while Apple revocation-code lookup is pending', async () => {
    let resolveAppleCode: ((value: string) => void) | undefined;
    mocks.getAppleAuthorizationCodeForRevocation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAppleCode = resolve;
        }),
    );
    const observed = deleteAccount(mocks.signOut).then(
      () => null,
      (error: unknown) => error,
    );
    await vi.waitFor(() =>
      expect(mocks.getAppleAuthorizationCodeForRevocation).toHaveBeenCalledWith({ id: 'user-1' }),
    );

    beginAccountGenerationBoundary();
    try {
      resolveAppleCode?.('apple-code-for-a');
      await expect(observed).resolves.toMatchObject({ message: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
    expect(mocks.assertStoreTransactionDeletionJournalReadable).not.toHaveBeenCalled();
    expect(mocks.startRevenueCatDeletionQuiesce).not.toHaveBeenCalled();
    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
  });

  it('aborts an A-to-B boundary while commerce-journal validation is pending', async () => {
    const journalRead = deferred<void>();
    mocks.assertStoreTransactionDeletionJournalReadable.mockReturnValueOnce(journalRead.promise);
    const observed = deleteAccount(mocks.signOut).then(
      () => null,
      (error: unknown) => error,
    );
    await vi.waitFor(() =>
      expect(mocks.assertStoreTransactionDeletionJournalReadable).toHaveBeenCalledWith(OWNER_A),
    );

    beginAccountGenerationBoundary();
    try {
      journalRead.resolve(undefined);
      await expect(observed).resolves.toMatchObject({ message: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.startRevenueCatDeletionQuiesce).not.toHaveBeenCalled();
    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
  });

  it('rejects a lease invalidated immediately after Apple evidence capture', async () => {
    mocks.getAppleAuthorizationCodeForRevocation.mockImplementationOnce(async () => {
      beginAccountGenerationBoundary();
      return 'apple-code-for-a';
    });
    const observed = deleteAccount(mocks.signOut).then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await expect(observed).resolves.toMatchObject({ message: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.assertStoreTransactionDeletionJournalReadable).not.toHaveBeenCalled();
    expect(mocks.startRevenueCatDeletionQuiesce).not.toHaveBeenCalled();
    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
  });

  it('makes a cold A-record retry with B support-only and never overwrites or dispatches', async () => {
    mocks.getSession.mockResolvedValueOnce({
      data: { session: { access_token: 'captured-token-b', user: { id: 'user-b' } } },
      error: null,
    });
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-b' } }, error: null });
    mocks.createAccountDeletionOwnerBinding.mockResolvedValueOnce(OWNER_B);
    mocks.preparePendingAccountDeletion.mockRejectedValueOnce(
      new Error('ACCOUNT_DELETION_OWNER_MISMATCH'),
    );

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'ACCOUNT_DELETION_AUTH_SESSION_UNAVAILABLE',
    );

    expect(mocks.getUser).toHaveBeenCalledWith('captured-token-b');
    expect(mocks.preparePendingAccountDeletion).toHaveBeenCalledWith(OWNER_B);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
    expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
  });

  it('surfaces an acceptance-state failure but still wakes durable recovery', async () => {
    mocks.markAccountDeletionIntakeState.mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow(
      'ACCOUNT_DELETION_ACCEPTED_LOCAL_SIGN_OUT_INCOMPLETE',
    );

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
    expect(
      isAcceptedAccountDeletionLocalSignOutIncomplete(
        new Error('ACCOUNT_DELETION_ACCEPTED_LOCAL_SIGN_OUT_INCOMPLETE'),
      ),
    ).toBe(true);
  });

  it('omits only the Apple field when revocation-code refresh fails locally', async () => {
    mocks.getAppleAuthorizationCodeForRevocation.mockRejectedValueOnce(
      new Error('native apple unavailable'),
    );

    await expect(deleteAccount(mocks.signOut)).resolves.toEqual({
      status: 'accepted_or_ambiguous',
      phase: 'queued',
      nextPollAfterSeconds: 2,
    });

    expect(mocks.invoke).toHaveBeenCalledWith('account-deletion', {
      method: 'POST',
      body: {
        action: 'begin',
        idempotencyKey: DELETION_TOKENS.idempotencyKey,
        statusCapability: DELETION_TOKENS.statusCapability,
      },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(consumeAccountDeletionNotice()).toBeNull();
  });

  it('does not finalize an HTTP 200 even when its JSON looks accepted', async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: COMPLETE_ACCOUNT_DELETION_RESPONSE,
      error: null,
      response: { status: 200 },
    });

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('ACCOUNT_DELETION_RESPONSE_INVALID');

    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    { status: 'accepted', phase: 'queued' },
    { status: 'completed', phase: 'queued', nextPollAfterSeconds: 2 },
    { status: 'accepted', phase: 'processing', nextPollAfterSeconds: 2 },
    { status: 'accepted', phase: 'queued', nextPollAfterSeconds: 1 },
    { ...COMPLETE_ACCOUNT_DELETION_RESPONSE, extra: true },
  ])('rejects malformed account-deletion success payload %#', async (response) => {
    mocks.invoke.mockResolvedValueOnce({ data: response, error: null, response: { status: 202 } });

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('ACCOUNT_DELETION_RESPONSE_INVALID');

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.requestAccountDeletionRecovery).toHaveBeenCalledOnce();
  });

  it('fails fast without local cleanup when the data-rights backend is unavailable', async () => {
    mocks.isSupabaseConfigured = false;

    await expect(deleteAccount(mocks.signOut)).rejects.toThrow('DATA_RIGHTS_BACKEND_UNAVAILABLE');

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('delegates health withdrawal to the purpose-limited lifecycle', async () => {
    await expect(withdrawHealthDataConsent('user-1')).resolves.toBeUndefined();

    expect(mocks.beginHealthDataConsentWithdrawal).toHaveBeenCalledExactlyOnceWith('user-1');
    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.beginSupabaseRemoteDeletionBoundary).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('propagates a lifecycle failure without falling back to account deletion', async () => {
    mocks.beginHealthDataConsentWithdrawal.mockRejectedValueOnce(new Error('withdrawal pending'));

    await expect(withdrawHealthDataConsent('user-1')).rejects.toThrow('withdrawal pending');
    expect(mocks.preparePendingAccountDeletion).not.toHaveBeenCalled();
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

  it('keeps the Apple fallback completion surface explicit, scrollable, and accessible', () => {
    const source = readSource('app/index.tsx');

    expect(source).toContain('useState(peekAccountDeletionNotice)');
    expect(source).toContain('acknowledgeAccountDeletionNotice(accountDeletionNotice)');
    expect(source).toMatch(
      /if \(!accountDeletionNotice \|\| deciding \|\| onboarded\.data === true\) return;/,
    );
    expect(source.indexOf('const deciding =')).toBeLessThan(
      source.indexOf('acknowledgeAccountDeletionNotice(accountDeletionNotice);'),
    );
    expect(source).toContain('contentContainerStyle={{ flexGrow: 1 }}');
    expect(source).toContain('accessibilityLiveRegion="assertive"');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('label="Open Apple instructions"');
    expect(source).toContain('Apple Support could not open. Use the iPhone Settings steps above.');
    expect(source).toContain('min-h-[44px]');
    expect(source).not.toContain('useState(consumeAccountDeletionNotice)');
  });
});
