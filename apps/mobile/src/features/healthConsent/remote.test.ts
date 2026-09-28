import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginRemoteHealthDataWithdrawal,
  declineRemoteInitialHealthDataConsent,
  fetchRemoteHealthDataLifecycle,
  grantRemoteHealthDataConsent,
  HEALTH_DATA_LIFECYCLE_REQUEST_TIMEOUT_MS,
  healthLifecycleResponseParserForTests,
} from './remote';

const mocks = vi.hoisted(() => ({
  digest: vi.fn(),
  getUser: vi.fn(),
  invoke: vi.fn(),
  readCandidate: vi.fn(),
  runAccountGenerationOperation: vi.fn(),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digest,
  getRandomBytesAsync: vi.fn(),
}));
vi.mock('@/lib/auth/accountGeneration', () => ({
  runAccountGenerationOperation: mocks.runAccountGenerationOperation,
}));
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: true }));
vi.mock('@/lib/supabase/client', () => ({
  readPersistedSupabaseSessionCandidate: mocks.readCandidate,
  supabase: { auth: { getUser: mocks.getUser }, functions: { invoke: mocks.invoke } },
}));

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_OWNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VALID = {
  state: 'withdrawing',
  processing_epoch: 2,
  operation_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  operation_state: 'storage_pending',
  result_code: null,
  server_verified_at: '2026-07-15T12:00:00.000Z',
  consent_version: null,
  consent_text_hash: null,
  withdrawn: false,
  retry_required: true,
  error: 'HEALTH_WITHDRAWAL_RETRY_REQUIRED',
};

describe('health lifecycle Edge response parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runAccountGenerationOperation.mockImplementation(
      (operation: (lease: { signal: AbortSignal; assertCurrent: () => void }) => unknown) =>
        operation({ signal: new AbortController().signal, assertCurrent: vi.fn() }),
    );
  });

  afterEach(() => vi.useRealTimers());

  it('accepts the bounded public lifecycle contract', () => {
    expect(healthLifecycleResponseParserForTests(VALID, OWNER)).toMatchObject({
      ownerUserId: OWNER,
      state: 'withdrawing',
      processingEpoch: 2,
      withdrawn: false,
      retryRequired: true,
      consentVersion: null,
      consentTextHash: null,
    });
  });

  it('requires consent metadata only for active status', () => {
    const active = {
      ...VALID,
      state: 'active',
      operation_id: null,
      operation_state: null,
      consent_version: 'draft-v1-2026-07-10',
      consent_text_hash: '79'.repeat(32),
      withdrawn: null,
      retry_required: null,
    };
    expect(healthLifecycleResponseParserForTests(active, OWNER)).toMatchObject({
      state: 'active',
      consentVersion: 'draft-v1-2026-07-10',
      consentTextHash: '79'.repeat(32),
    });
    expect(() =>
      healthLifecycleResponseParserForTests({ ...VALID, consent_version: 'stale' }, OWNER),
    ).toThrow('HEALTH_DATA_LIFECYCLE_RESPONSE_INVALID');
    expect(() =>
      healthLifecycleResponseParserForTests(
        { ...active, consent_text_hash: null },
        OWNER,
      ),
    ).toThrow('HEALTH_DATA_LIFECYCLE_RESPONSE_INVALID');
  });

  it.each([
    { ...VALID, processing_epoch: -1 },
    { ...VALID, processing_epoch: 0 },
    { ...VALID, state: 'unconsented', processing_epoch: 2 },
    { ...VALID, state: 'complete' },
    { ...VALID, server_verified_at: 'not-a-date' },
    { ...VALID, unexpected_private_field: 'secret' },
  ])('rejects malformed or expanded payload %#', (payload) => {
    expect(() => healthLifecycleResponseParserForTests(payload, OWNER)).toThrow(
      'HEALTH_DATA_LIFECYCLE_RESPONSE_INVALID',
    );
  });

  it('rejects a switched persisted owner before Auth verification or mutation', async () => {
    mocks.readCandidate.mockResolvedValue({
      access_token: 'token-b',
      user: { id: OTHER_OWNER },
    });

    await expect(fetchRemoteHealthDataLifecycle(OWNER)).rejects.toThrow(
      'HEALTH_DATA_LIFECYCLE_AUTH_UNAVAILABLE',
    );
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('bounds session verification even if the SDK never settles', async () => {
    vi.useFakeTimers();
    mocks.readCandidate.mockReturnValue(new Promise(() => {}));

    const pending = fetchRemoteHealthDataLifecycle(OWNER);
    const rejected = expect(pending).rejects.toThrow(
      'HEALTH_DATA_LIFECYCLE_BACKEND_UNAVAILABLE',
    );
    await vi.advanceTimersByTimeAsync(HEALTH_DATA_LIFECYCLE_REQUEST_TIMEOUT_MS);
    await rejected;
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('uses verified synchronous disclosure hashes before remote mutations', async () => {
    mocks.readCandidate.mockResolvedValue({ access_token: 'token-a', user: { id: OWNER } });
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER } }, error: null });
    mocks.invoke.mockImplementation(async (_name: string, options: { body: { action: string } }) => {
      const action = options.body.action;
      if (action === 'reconsent') {
        return {
          data: {
            ...VALID,
            state: 'active',
            processing_epoch: 3,
            operation_id: null,
            operation_state: null,
            consent_version: 'draft-v1-2026-07-10',
            consent_text_hash:
              '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
            withdrawn: null,
            retry_required: null,
          },
          error: null,
        };
      }
      if (action === 'decline') {
        return {
          data: {
            ...VALID,
            state: 'unconsented',
            processing_epoch: 0,
            operation_id: null,
            operation_state: null,
            consent_version: null,
            consent_text_hash: null,
            withdrawn: null,
            retry_required: null,
          },
          error: null,
        };
      }
      return { data: VALID, error: null };
    });

    await grantRemoteHealthDataConsent(OWNER, 2);
    await beginRemoteHealthDataWithdrawal({
      ownerUserId: OWNER,
      expectedProcessingEpoch: 2,
      idempotencyKey: 'ab'.repeat(32),
    });
    await declineRemoteInitialHealthDataConsent(OWNER);

    expect(mocks.digest).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalledTimes(3);
  });
});
