import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';

import { HEALTH_DEPENDENT_CONSENT_COPY } from './dependentConsentContract';
import { CONSENT_WITHDRAWAL_OWNER_CHANGED, withdrawConsent } from './withdrawal';

const OPERATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const mocks = vi.hoisted(() => ({
  appEnvironment: 'development' as 'development' | 'staging' | 'production',
  configured: true,
  digest: vi.fn(),
  getUser: vi.fn(),
  invoke: vi.fn(),
  readCandidate: vi.fn(),
}));
vi.mock('@/lib/env', () => ({
  env: {
    get appEnvironment() {
      return mocks.appEnvironment;
    },
  },
  get isSupabaseConfigured() { return mocks.configured; },
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digest,
  getRandomBytesAsync: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  readPersistedSupabaseSessionCandidate: mocks.readCandidate,
  supabase: { auth: { getUser: mocks.getUser }, functions: { invoke: mocks.invoke } },
}));

function jwt(subject: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ sub: subject, session_id: `s-${subject}`, exp: 4_102_444_800 })}.sig`;
}
function candidate(subject: string) {
  return { access_token: jwt(subject), refresh_token: 'r', expires_at: 4_102_444_800, user: { id: subject } };
}

describe('consent withdrawal transport guard', () => {
  let boundaryOpen = false;
  beforeEach(() => {
    mocks.appEnvironment = 'development';
    mocks.configured = true;
    mocks.digest.mockReset();
    mocks.digest.mockImplementation(async (_algorithm: string, text: string) =>
      createHash('sha256').update(text).digest('hex'),
    );
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue({ data: { withdrawn: true }, error: null });
    mocks.readCandidate.mockReset();
    mocks.readCandidate.mockResolvedValue(candidate('user-a'));
  });
  afterEach(() => {
    if (boundaryOpen) endAccountGenerationBoundary();
    boundaryOpen = false;
  });

  it('sends the exact dependent CAS body and authenticated initiating owner', async () => {
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.data_sharing.withdrawal;
    mocks.invoke.mockResolvedValueOnce({
      data: {
        withdrawn: true,
        pending: false,
        retry_required: false,
        operation_id: OPERATION_ID,
        consent_type: 'data_sharing',
        state: 'withdrawn',
        processing_epoch: 7,
        consent_generation: 15,
        cleanup: {
          order_attributions_detached: 1,
          commerce_click_events_deleted: 1,
          more_pending: false,
        },
        replayed: false,
      },
      error: null,
    });
    await expect(withdrawConsent({
      type: 'data_sharing',
      version: copy.version,
      consentText: copy.text,
      expectedUserId: 'user-a',
      expectedProcessingEpoch: 7,
      expectedConsentGeneration: 14,
      idempotencyKey: 'ab'.repeat(32),
    })).resolves.toEqual({
      operationId: OPERATION_ID,
      consentType: 'data_sharing',
      processingEpoch: 7,
      consentGeneration: 15,
      replayed: false,
    });
    expect(mocks.invoke).toHaveBeenCalledWith('consent-withdrawal', expect.objectContaining({
      body: {
        consentType: 'data_sharing',
        version: copy.version,
        consentTextHash: copy.sha256,
        idempotencyKey: 'ab'.repeat(32),
        expectedProcessingEpoch: 7,
        expectedConsentGeneration: 14,
      },
      headers: { Authorization: `Bearer ${jwt('user-a')}` },
      signal: expect.any(AbortSignal),
    }));
  });

  it('allows an exact terminal withdrawal replay in production', async () => {
    mocks.appEnvironment = 'production';
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.ask_onskin.withdrawal;
    mocks.invoke.mockResolvedValueOnce({
      data: {
        withdrawn: true,
        pending: false,
        retry_required: false,
        operation_id: OPERATION_ID,
        consent_type: 'ask_onskin',
        state: 'withdrawn',
        processing_epoch: 7,
        consent_generation: 3,
        replayed: true,
      },
      error: null,
    });

    await expect(
      withdrawConsent({
        type: 'ask_onskin',
        version: copy.version,
        consentText: copy.text,
        expectedUserId: 'user-a',
        expectedProcessingEpoch: 7,
        expectedConsentGeneration: 2,
        idempotencyKey: 'ac'.repeat(32),
      }),
    ).resolves.toMatchObject({
      consentType: 'ask_onskin',
      consentGeneration: 3,
      replayed: true,
    });
  });

  it('rejects missing dependent CAS fields before auth or network', async () => {
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.ask_onskin.withdrawal;
    await expect(withdrawConsent({
      type: 'ask_onskin', version: copy.version, consentText: copy.text, expectedUserId: 'user-a',
    })).rejects.toThrow('HEALTH_DEPENDENT_WITHDRAWAL_CONTRACT_INVALID');
    expect(mocks.readCandidate).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('treats an HTTP-202-shaped body as pending, never terminal success', async () => {
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.ask_onskin.withdrawal;
    mocks.invoke.mockResolvedValueOnce({
      data: {
        withdrawn: false,
        pending: true,
        retry_required: true,
        operation_id: OPERATION_ID,
        consent_type: 'ask_onskin',
        state: 'withdrawing',
        processing_epoch: 7,
        consent_generation: 3,
        stage: 'cleanup',
        error: 'CONSENT_WITHDRAWAL_RETRY_REQUIRED',
      },
      error: null,
    });
    await expect(
      withdrawConsent({
        type: 'ask_onskin',
        version: copy.version,
        consentText: copy.text,
        expectedUserId: 'user-a',
        expectedProcessingEpoch: 7,
        expectedConsentGeneration: 2,
        idempotencyKey: '12'.repeat(32),
      }),
    ).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING');
  });

  it('rejects a terminal body that does not attest the exact generation', async () => {
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.ask_onskin.withdrawal;
    mocks.invoke.mockResolvedValueOnce({
      data: {
        withdrawn: true,
        pending: false,
        retry_required: false,
        operation_id: OPERATION_ID,
        consent_type: 'ask_onskin',
        state: 'withdrawn',
        processing_epoch: 7,
        consent_generation: 99,
        replayed: true,
      },
      error: null,
    });
    await expect(
      withdrawConsent({
        type: 'ask_onskin',
        version: copy.version,
        consentText: copy.text,
        expectedUserId: 'user-a',
        expectedProcessingEpoch: 7,
        expectedConsentGeneration: 2,
        idempotencyKey: '13'.repeat(32),
      }),
    ).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID');
  });

  it('rejects a terminal response with an invalid UUID or any undeclared key', async () => {
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.ask_onskin.withdrawal;
    const invoke = (operationId: string, extra: Record<string, unknown> = {}) => ({
      data: {
        withdrawn: true,
        pending: false,
        retry_required: false,
        operation_id: operationId,
        consent_type: 'ask_onskin',
        state: 'withdrawn',
        processing_epoch: 7,
        consent_generation: 3,
        replayed: true,
        ...extra,
      },
      error: null,
    });
    const request = () => withdrawConsent({
      type: 'ask_onskin',
      version: copy.version,
      consentText: copy.text,
      expectedUserId: 'user-a',
      expectedProcessingEpoch: 7,
      expectedConsentGeneration: 2,
      idempotencyKey: '14'.repeat(32),
    });

    mocks.invoke.mockResolvedValueOnce(invoke('not-a-uuid'));
    await expect(request()).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID',
    );
    mocks.invoke.mockResolvedValueOnce(invoke(OPERATION_ID, { unexpected: 'field' }));
    await expect(request()).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID',
    );
  });

  it('rejects a pending response with an invalid UUID or any undeclared key', async () => {
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.ask_onskin.withdrawal;
    const pending = (operationId: string, extra: Record<string, unknown> = {}) => ({
      data: {
        withdrawn: false,
        pending: true,
        retry_required: true,
        operation_id: operationId,
        consent_type: 'ask_onskin',
        state: 'withdrawing',
        processing_epoch: 7,
        consent_generation: 3,
        stage: 'cleanup',
        error: 'CONSENT_WITHDRAWAL_RETRY_REQUIRED',
        ...extra,
      },
      error: null,
    });
    const request = () => withdrawConsent({
      type: 'ask_onskin',
      version: copy.version,
      consentText: copy.text,
      expectedUserId: 'user-a',
      expectedProcessingEpoch: 7,
      expectedConsentGeneration: 2,
      idempotencyKey: '15'.repeat(32),
    });

    mocks.invoke.mockResolvedValueOnce(pending('bad-id'));
    await expect(request()).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID',
    );
    mocks.invoke.mockResolvedValueOnce(pending(OPERATION_ID, { unexpected: true }));
    await expect(request()).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID',
    );
    mocks.invoke.mockResolvedValueOnce(pending(OPERATION_ID, { consent_generation: 4 }));
    await expect(request()).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID',
    );
  });

  it('validates every terminal cleanup field by its exact type and invariant', async () => {
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.photo_capture.withdrawal;
    const request = () => withdrawConsent({
      type: 'photo_capture',
      version: copy.version,
      consentText: copy.text,
      expectedUserId: 'user-a',
      expectedProcessingEpoch: 7,
      expectedConsentGeneration: 2,
      idempotencyKey: '16'.repeat(32),
    });
    const response = (cleanup: Record<string, unknown>) => ({
      data: {
        withdrawn: true,
        pending: false,
        retry_required: false,
        operation_id: OPERATION_ID,
        consent_type: 'photo_capture',
        state: 'withdrawn',
        processing_epoch: 7,
        consent_generation: 3,
        cleanup,
        replayed: false,
      },
      error: null,
    });
    const valid = {
      remote_photo_rows_deleted: 1,
      storage_objects_removed: 1,
      skipped_storage_paths: 0,
      local_device_cleanup_claimed: false,
      photo_trend_deleted: 1,
    };

    mocks.invoke.mockResolvedValueOnce(
      response({ ...valid, remote_photo_rows_deleted: false }),
    );
    await expect(request()).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID',
    );
    mocks.invoke.mockResolvedValueOnce(
      response({ ...valid, local_device_cleanup_claimed: true }),
    );
    await expect(request()).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID',
    );
    mocks.invoke.mockResolvedValueOnce(response({ ...valid, skipped_storage_paths: 1 }));
    await expect(request()).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID',
    );
  });

  it('rejects a foreign persisted JWT subject before mutation', async () => {
    mocks.readCandidate.mockResolvedValueOnce(candidate('user-b'));
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.ask_onskin.withdrawal;
    await expect(withdrawConsent({
      type: 'ask_onskin',
      version: copy.version,
      consentText: copy.text,
      expectedUserId: 'user-a',
      expectedProcessingEpoch: 7,
      expectedConsentGeneration: 2,
      idempotencyKey: 'cd'.repeat(32),
    })).rejects.toThrow(CONSENT_WITHDRAWAL_OWNER_CHANGED);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('aborts an in-flight invocation across an A→B account boundary', async () => {
    let started!: () => void;
    let release!: () => void;
    const didStart = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let signal: AbortSignal | null = null;
    mocks.invoke.mockImplementationOnce(async (_name: string, options: { signal: AbortSignal }) => {
      signal = options.signal;
      started();
      await gate;
      return { data: {}, error: null };
    });
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.ask_onskin.withdrawal;
    const pending = withdrawConsent({
      type: 'ask_onskin',
      version: copy.version,
      consentText: copy.text,
      expectedUserId: 'user-a',
      expectedProcessingEpoch: 7,
      expectedConsentGeneration: 2,
      idempotencyKey: 'ef'.repeat(32),
    });
    await didStart;
    beginAccountGenerationBoundary();
    boundaryOpen = true;
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
    await expect(pending).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
    endAccountGenerationBoundary();
    boundaryOpen = false;
    release();
  });
});
