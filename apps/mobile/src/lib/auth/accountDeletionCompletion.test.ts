import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  lookupAccountDeletionCompletion,
  reconcileAccountDeletionCompletionReceipt,
} from './accountDeletionCompletion';

const TOKEN = 'c'.repeat(64);
const TOKEN_HASH = `t_${'d'.repeat(64)}`;
const COMPLETED_ROW = {
  request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  next_step: 'complete',
  apple_result: 'revoked',
  posthog_result: 'deleted',
};

const mocks = vi.hoisted(() => ({
  abortSignal: vi.fn(),
  createClient: vi.fn(),
  digestStringAsync: vi.fn(),
  isSupabaseConfigured: true,
  markBackendDeleted: vi.fn(),
  readCapability: vi.fn(),
  rpc: vi.fn(),
  runRequest: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    mocks.createClient(...args);
    return { rpc: mocks.rpc };
  },
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
}));

vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'publishable-key',
  },
  get isSupabaseConfigured() {
    return mocks.isSupabaseConfigured;
  },
}));

vi.mock('@/lib/network/requestPolicy', () => ({
  runRequest: mocks.runRequest,
}));

vi.mock('./accountDeletionVendorFreeze', () => ({
  markAccountDeletionBackendDeletedFromCompletion: mocks.markBackendDeleted,
  readAccountDeletionRecoveryCapability: mocks.readCapability,
}));

describe('account-deletion completion capability', () => {
  beforeEach(() => {
    mocks.abortSignal.mockReset();
    mocks.digestStringAsync.mockReset().mockResolvedValue('d'.repeat(64));
    mocks.isSupabaseConfigured = true;
    mocks.markBackendDeleted.mockReset().mockResolvedValue(undefined);
    mocks.readCapability.mockReset().mockResolvedValue(null);
    mocks.rpc.mockReset().mockReturnValue({ abortSignal: mocks.abortSignal });
    mocks.runRequest.mockReset().mockImplementation(async (_policy, operation) =>
      operation({ signal: new AbortController().signal }),
    );
  });

  it('hashes the 256-bit capability and performs only the anonymous terminal RPC', async () => {
    mocks.abortSignal.mockResolvedValue({ data: [COMPLETED_ROW], error: null });

    await expect(lookupAccountDeletionCompletion(TOKEN)).resolves.toEqual({
      requestId: COMPLETED_ROW.request_id,
      apple: 'revoked',
      posthog: 'deleted',
    });

    expect(mocks.digestStringAsync).toHaveBeenCalledWith(
      'SHA-256',
      `onskin:account-deletion-completion:${TOKEN}`,
    );
    expect(mocks.rpc).toHaveBeenCalledWith('account_deletion_completion_status', {
      p_completion_token_hash: TOKEN_HASH,
    });
    expect(mocks.createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'publishable-key',
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
          storageKey: 'onskin-account-deletion-completion-anonymous',
        },
      },
    );
    expect(mocks.runRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'account_deletion',
        idempotent: true,
        ownerScoped: false,
      }),
      expect.any(Function),
    );
  });

  it('treats an empty result as not complete and rejects malformed terminal data', async () => {
    mocks.abortSignal.mockResolvedValueOnce({ data: [], error: null });
    await expect(lookupAccountDeletionCompletion(TOKEN)).resolves.toBeNull();

    mocks.abortSignal.mockResolvedValueOnce({
      data: [{ ...COMPLETED_ROW, next_step: 'auth' }],
      error: null,
    });
    await expect(lookupAccountDeletionCompletion(TOKEN)).rejects.toThrow(
      'ACCOUNT_DELETION_COMPLETION_RESPONSE_INVALID',
    );
  });

  it('rejects invalid capabilities before hashing or network access', async () => {
    await expect(lookupAccountDeletionCompletion('not-a-capability')).rejects.toThrow(
      'ACCOUNT_DELETION_COMPLETION_TOKEN_INVALID',
    );
    expect(mocks.digestStringAsync).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('preserves a pending receipt through network uncertainty', async () => {
    mocks.readCapability.mockResolvedValue({
      state: 'pending',
      ownerHash: 'a'.repeat(64),
      completionToken: TOKEN,
    });
    mocks.abortSignal.mockResolvedValue({ data: null, error: new Error('offline') });

    await expect(reconcileAccountDeletionCompletionReceipt()).resolves.toBe(false);
    expect(mocks.markBackendDeleted).not.toHaveBeenCalled();
  });

  it('durably authorizes cleanup only after a strict terminal receipt', async () => {
    mocks.readCapability.mockResolvedValue({
      state: 'pending',
      ownerHash: 'a'.repeat(64),
      completionToken: TOKEN,
    });
    mocks.abortSignal.mockResolvedValue({ data: [COMPLETED_ROW], error: null });

    await expect(reconcileAccountDeletionCompletionReceipt()).resolves.toBe(true);
    expect(mocks.markBackendDeleted).toHaveBeenCalledWith(TOKEN);
  });

  it('accepts an already-authorized local receipt without another network request', async () => {
    mocks.readCapability.mockResolvedValue({
      state: 'backend_deleted',
      ownerHash: 'a'.repeat(64),
      completionToken: TOKEN,
    });

    await expect(reconcileAccountDeletionCompletionReceipt()).resolves.toBe(true);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.markBackendDeleted).not.toHaveBeenCalled();
  });

  it('fails closed when the backend is not configured', async () => {
    mocks.isSupabaseConfigured = false;
    await expect(lookupAccountDeletionCompletion(TOKEN)).rejects.toThrow(
      'DATA_RIGHTS_BACKEND_UNAVAILABLE',
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
