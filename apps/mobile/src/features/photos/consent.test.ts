import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AccountGenerationLeaseError,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import type { PrivateKVReadResult } from '@/lib/storage/privateKV';

import { PHOTO_CAPTURE_CONSENT } from '../onboarding/consentCopy';
import {
  grantPhotoCaptureConsent,
  hasPhotoCaptureConsent,
  PHOTO_CAPTURE_CONSENT_INVALID,
  PHOTO_CAPTURE_CONSENT_UNAVAILABLE,
  PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION,
  PhotoCaptureConsentStateChangedError,
  PhotoCaptureConsentWriteUncertainError,
  readPhotoCaptureConsent,
} from './consent';

const CAPTURE_KEY = 'onskin.photos.captureConsent';
const CAPTURE_RECORD_KEY = 'onskin.photos.captureConsent.v1';
const CURRENT_HASH = 'a'.repeat(64);
const WRONG_HASH = 'b'.repeat(64);
const RECORDED_AT = '2026-07-14T00:00:00.000Z';

const mocks = vi.hoisted(() => ({
  recordConsent: vi.fn(),
  digestStringAsync: vi.fn(),
  readQueues: new Map<string, PrivateKVReadResult[]>(),
  storage: new Map<string, string>(),
  updateMode: 'normal' as
    | 'normal'
    | 'precommit_failure'
    | 'commit_then_reject'
    | 'commit_then_reject_unreadable'
    | 'commit_then_reject_corrupt'
    | 'commit_then_reject_future',
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
}));

vi.mock('@/lib/consent/consent', () => ({
  recordConsent: mocks.recordConsent,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  readPrivateItem: vi.fn(async (key: string) => {
    const queue = mocks.readQueues.get(key);
    const queued = queue?.shift();
    if (queue?.length === 0) mocks.readQueues.delete(key);
    if (queued) return queued;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      if (mocks.updateMode === 'precommit_failure') throw new Error('PRIVATE_WRITE_FAILED');
      const next = updater(mocks.storage.get(key) ?? null);
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
      if (mocks.updateMode === 'commit_then_reject_unreadable') {
        mocks.readQueues.set(key, [
          { status: 'unavailable', reason: 'content_key_storage_unavailable' },
        ]);
        throw new Error('PRIVATE_WRITE_RESPONSE_LOST');
      }
      if (mocks.updateMode === 'commit_then_reject_corrupt') {
        mocks.readQueues.set(key, [{ status: 'corrupt', reason: 'decryption_failed' }]);
        throw new Error('PRIVATE_WRITE_RESPONSE_LOST');
      }
      if (mocks.updateMode === 'commit_then_reject_future') {
        mocks.readQueues.set(key, [{ status: 'unsupported_version' }]);
        throw new Error('PRIVATE_WRITE_RESPONSE_LOST');
      }
      if (mocks.updateMode === 'commit_then_reject') {
        throw new Error('PRIVATE_WRITE_RESPONSE_LOST');
      }
    },
  ),
}));

const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

function consentRecord(
  overrides: Partial<{
    type: string;
    granted: boolean;
    version: string;
    consentTextHash: string;
    recordedAt: string;
  }> = {},
) {
  return {
    type: 'photo_capture',
    granted: true,
    version: PHOTO_CAPTURE_CONSENT.version,
    consentTextHash: CURRENT_HASH,
    recordedAt: RECORDED_AT,
    ...overrides,
  };
}

function seedPrimary(
  overrides: Parameters<typeof consentRecord>[0] = {},
  format: 'current' | 'legacy' = 'current',
) {
  const consent = consentRecord(overrides);
  mocks.storage.set(
    CAPTURE_RECORD_KEY,
    JSON.stringify(format === 'current' ? { schemaVersion: 1, consent } : consent),
  );
}

function queueRead(key: string, ...results: PrivateKVReadResult[]) {
  mocks.readQueues.set(key, [...results]);
}

describe('photo consent persistence', () => {
  let boundaryActive = false;

  beforeEach(() => {
    mocks.recordConsent.mockReset().mockResolvedValue(undefined);
    mocks.digestStringAsync.mockReset().mockResolvedValue(CURRENT_HASH);
    mocks.readQueues.clear();
    mocks.storage.clear();
    mocks.updateMode = 'normal';
    vi.clearAllMocks();
    delete process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_READ_FAILURE;
    delete process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE;
    delete process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  afterEach(() => {
    if (boundaryActive) {
      endAccountGenerationBoundary();
      boundaryActive = false;
    }
    delete process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_READ_FAILURE;
    delete process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE;
    delete process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('keeps genuine absence distinct from an unreadable or declined choice', async () => {
    await expect(readPhotoCaptureConsent()).resolves.toEqual({ status: 'absent', consent: null });
    await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
  });

  it('accepts only an exact current envelope and never consults legacy state', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    seedPrimary();
    mocks.storage.set(CAPTURE_KEY, ' 1 ');

    await expect(readPhotoCaptureConsent()).resolves.toEqual({
      status: 'available',
      state: 'current',
      source: 'primary',
      format: 'current',
      consent: consentRecord(),
    });
    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);
    expect(mocks.digestStringAsync).toHaveBeenCalledWith('SHA-256', PHOTO_CAPTURE_CONSENT.fullText);
    expect(vi.mocked(privateKV.readPrivateItem)).not.toHaveBeenCalledWith(CAPTURE_KEY);
  });

  it('accepts an exact bare legacy record without rewriting it', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    seedPrimary({}, 'legacy');
    const original = mocks.storage.get(CAPTURE_RECORD_KEY);

    await expect(readPhotoCaptureConsent()).resolves.toMatchObject({
      status: 'available',
      state: 'current',
      source: 'primary',
      format: 'legacy',
    });

    expect(mocks.storage.get(CAPTURE_RECORD_KEY)).toBe(original);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('requires reconsent for a stale version without hashing or reading legacy', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    seedPrimary({ version: 'draft-photo-v1-2026-07-10' });
    mocks.storage.set(CAPTURE_KEY, '1');

    await expect(readPhotoCaptureConsent()).resolves.toMatchObject({
      status: 'available',
      state: 'reconsent_required',
      source: 'primary',
      reason: 'stale_version',
    });

    expect(mocks.digestStringAsync).not.toHaveBeenCalled();
    expect(vi.mocked(privateKV.readPrivateItem)).not.toHaveBeenCalledWith(CAPTURE_KEY);
  });

  it('requires reconsent for a structurally valid but wrong current-copy hash', async () => {
    seedPrimary({ consentTextHash: WRONG_HASH });

    await expect(readPhotoCaptureConsent()).resolves.toMatchObject({
      status: 'available',
      state: 'reconsent_required',
      source: 'primary',
      reason: 'hash_mismatch',
    });
  });

  it.each([
    [' 1 ', 'reconsent_required', 'legacy_unverifiable'],
    ['v1:1', 'reconsent_required', 'legacy_unverifiable'],
    [' 0 ', 'not_granted', undefined],
    ['v1:0', 'not_granted', undefined],
  ] as const)(
    'classifies an available legacy Boolean %s without repairing it',
    async (raw, state, reason) => {
      const privateKV = await import('@/lib/storage/privateKV');
      mocks.storage.set(CAPTURE_KEY, raw);

      await expect(readPhotoCaptureConsent()).resolves.toMatchObject({
        status: 'available',
        state,
        source: 'legacy',
        ...(reason ? { reason } : {}),
      });

      expect(mocks.storage.get(CAPTURE_KEY)).toBe(raw);
      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      { status: 'unavailable', reason: 'content_key_missing' } as const,
      {
        status: 'unavailable',
        source: 'primary',
        reason: 'content_key_missing',
        consent: null,
      },
    ],
    [
      { status: 'corrupt', reason: 'decryption_failed' } as const,
      { status: 'corrupt', source: 'primary', reason: 'decryption_failed', consent: null },
    ],
    [
      { status: 'unsupported_version' } as const,
      { status: 'unsupported_version', source: 'primary', consent: null },
    ],
  ])(
    'preserves primary typed failure %o and never revives legacy true',
    async (stored, expected) => {
      const privateKV = await import('@/lib/storage/privateKV');
      const original = 'encrypted-primary-envelope';
      mocks.storage.set(CAPTURE_RECORD_KEY, original);
      mocks.storage.set(CAPTURE_KEY, '1');
      queueRead(CAPTURE_RECORD_KEY, stored);

      await expect(readPhotoCaptureConsent()).resolves.toEqual(expected);

      expect(mocks.storage.get(CAPTURE_RECORD_KEY)).toBe(original);
      expect(mocks.storage.get(CAPTURE_KEY)).toBe('1');
      expect(vi.mocked(privateKV.readPrivateItem)).not.toHaveBeenCalledWith(CAPTURE_KEY);
      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      { status: 'unavailable', reason: 'storage_unavailable' } as const,
      {
        status: 'unavailable',
        source: 'legacy',
        reason: 'storage_unavailable',
        consent: null,
      },
    ],
    [
      { status: 'corrupt', reason: 'envelope_invalid' } as const,
      { status: 'corrupt', source: 'legacy', reason: 'envelope_invalid', consent: null },
    ],
    [
      { status: 'unsupported_version' } as const,
      { status: 'unsupported_version', source: 'legacy', consent: null },
    ],
  ])('preserves typed legacy failure %o after exact primary absence', async (stored, expected) => {
    queueRead(CAPTURE_KEY, stored);
    await expect(readPhotoCaptureConsent()).resolves.toEqual(expected);
  });

  it('classifies malformed and future primary records without changing either key', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    for (const [raw, status] of [
      ['{not-json', 'corrupt'],
      [JSON.stringify({ schemaVersion: 2, consent: consentRecord() }), 'unsupported_version'],
      [
        JSON.stringify({ schemaVersion: 1, consent: consentRecord({ consentTextHash: 'bad' }) }),
        'corrupt',
      ],
      [
        JSON.stringify({
          schemaVersion: 1,
          consent: consentRecord({ recordedAt: '2026-07-14' }),
        }),
        'corrupt',
      ],
    ] as const) {
      mocks.storage.set(CAPTURE_RECORD_KEY, raw);
      mocks.storage.set(CAPTURE_KEY, '1');

      await expect(readPhotoCaptureConsent()).resolves.toMatchObject({ status, source: 'primary' });
      expect(mocks.storage.get(CAPTURE_RECORD_KEY)).toBe(raw);
      expect(mocks.storage.get(CAPTURE_KEY)).toBe('1');
      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    }
  });

  it('returns typed hash unavailability without treating a proof as absent', async () => {
    seedPrimary();
    mocks.digestStringAsync.mockRejectedValueOnce(new Error('digest unavailable'));

    await expect(readPhotoCaptureConsent()).resolves.toEqual({
      status: 'unavailable',
      source: 'copy_hash',
      reason: 'digest_unavailable',
      consent: null,
    });
  });

  it('rejects a delayed owner-A hash instead of publishing into owner B', async () => {
    seedPrimary();
    let releaseDigest!: () => void;
    mocks.digestStringAsync.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          releaseDigest = () => resolve(CURRENT_HASH);
        }),
    );

    const read = readPhotoCaptureConsent();
    await vi.waitFor(() => expect(mocks.digestStringAsync).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(read).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    releaseDigest();
    await Promise.resolve();
  });

  it('saves the exact current proof before recording the best-effort ledger', async () => {
    const privateKV = await import('@/lib/storage/privateKV');

    const result = await grantPhotoCaptureConsent();

    expect(result).toMatchObject({ status: 'available', state: 'current', format: 'current' });
    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);
    expect(JSON.parse(mocks.storage.get(CAPTURE_RECORD_KEY) ?? '{}')).toEqual({
      schemaVersion: 1,
      consent: {
        type: 'photo_capture',
        granted: true,
        version: PHOTO_CAPTURE_CONSENT.version,
        consentTextHash: CURRENT_HASH,
        recordedAt: expect.any(String),
      },
    });
    expect(mocks.recordConsent).toHaveBeenCalledWith({
      type: 'photo_capture',
      granted: true,
      version: PHOTO_CAPTURE_CONSENT.version,
      consentText: PHOTO_CAPTURE_CONSENT.fullText,
    });
    expect(vi.mocked(privateKV.updatePrivateItem).mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordConsent.mock.invocationCallOrder[0],
    );
  });

  it('keeps a durable local proof when the consent ledger is unavailable', async () => {
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantPhotoCaptureConsent()).resolves.toMatchObject({
      status: 'available',
      state: 'current',
    });
    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);
  });

  it('upgrades a valid stale proof only after explicit grant and retains the legacy key', async () => {
    seedPrimary({ version: 'draft-photo-v1-2026-07-10' });
    mocks.storage.set(CAPTURE_KEY, ' 1 ');

    await expect(grantPhotoCaptureConsent()).resolves.toMatchObject({
      status: 'available',
      state: 'current',
    });

    expect(JSON.parse(mocks.storage.get(CAPTURE_RECORD_KEY) ?? '{}')).toMatchObject({
      schemaVersion: 1,
      consent: { version: PHOTO_CAPTURE_CONSENT.version, consentTextHash: CURRENT_HASH },
    });
    expect(mocks.storage.get(CAPTURE_KEY)).toBe(' 1 ');
  });

  it('fails closed before the ledger when the local proof cannot save', async () => {
    mocks.updateMode = 'precommit_failure';

    await expect(grantPhotoCaptureConsent()).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.has(CAPTURE_RECORD_KEY)).toBe(false);
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it('reconciles commit-response loss only from the exact desired primary proof', async () => {
    mocks.updateMode = 'commit_then_reject';

    await expect(grantPhotoCaptureConsent()).resolves.toMatchObject({
      status: 'available',
      state: 'current',
    });
    expect(mocks.recordConsent).toHaveBeenCalledOnce();
    await expect(hasPhotoCaptureConsent()).resolves.toBe(true);
  });

  it('keeps camera authorization uncertain when commit-loss readback is unreadable', async () => {
    mocks.updateMode = 'commit_then_reject_unreadable';

    await expect(grantPhotoCaptureConsent()).rejects.toBeInstanceOf(
      PhotoCaptureConsentWriteUncertainError,
    );
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it.each([
    [
      'commit_then_reject_corrupt',
      { status: 'corrupt', source: 'primary', reason: 'decryption_failed' },
    ],
    ['commit_then_reject_future', { status: 'unsupported_version', source: 'primary' }],
  ] as const)('surfaces authoritative %s commit-loss readback state', async (mode, expected) => {
    mocks.updateMode = mode;

    let failure: unknown;
    try {
      await grantPhotoCaptureConsent();
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(PhotoCaptureConsentStateChangedError);
    expect((failure as PhotoCaptureConsentStateChangedError).result).toMatchObject(expected);
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it('preserves malformed and future primary bytes and refuses an ordinary grant repair', async () => {
    for (const [raw, code] of [
      ['{not-json', PHOTO_CAPTURE_CONSENT_INVALID],
      [
        JSON.stringify({ schemaVersion: 2, consent: consentRecord() }),
        PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION,
      ],
    ] as const) {
      mocks.storage.set(CAPTURE_RECORD_KEY, raw);

      await expect(grantPhotoCaptureConsent()).rejects.toThrow(code);
      expect(mocks.storage.get(CAPTURE_RECORD_KEY)).toBe(raw);
      expect(mocks.recordConsent).not.toHaveBeenCalled();
    }
  });

  it.each([
    [
      'corrupt',
      () => mocks.storage.set(CAPTURE_RECORD_KEY, '{not-json'),
      { status: 'corrupt', source: 'primary', reason: 'invalid_record' },
    ],
    [
      'future',
      () =>
        mocks.storage.set(
          CAPTURE_RECORD_KEY,
          JSON.stringify({ schemaVersion: 2, consent: consentRecord() }),
        ),
      { status: 'unsupported_version', source: 'primary' },
    ],
    [
      'unavailable',
      () =>
        queueRead(CAPTURE_RECORD_KEY, {
          status: 'unavailable',
          reason: 'content_key_storage_unavailable',
        }),
      {
        status: 'unavailable',
        source: 'primary',
        reason: 'content_key_storage_unavailable',
      },
    ],
  ] as const)(
    'carries the fresh authoritative %s result when state changes after a route read',
    async (_label, arrange, expected) => {
      await expect(readPhotoCaptureConsent()).resolves.toEqual({ status: 'absent', consent: null });
      arrange();

      let failure: unknown;
      try {
        await grantPhotoCaptureConsent();
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(PhotoCaptureConsentStateChangedError);
      expect((failure as PhotoCaptureConsentStateChangedError).result).toMatchObject(expected);
      expect(mocks.recordConsent).not.toHaveBeenCalled();
    },
  );

  it('serializes concurrent grants and records one immutable ledger row', async () => {
    const privateKV = await import('@/lib/storage/privateKV');

    const results = await Promise.all(Array.from({ length: 20 }, () => grantPhotoCaptureConsent()));

    expect(results).toHaveLength(20);
    expect(results.every((result) => result.state === 'current')).toBe(true);
    expect(privateKV.updatePrivateItem).toHaveBeenCalledOnce();
    expect(mocks.recordConsent).toHaveBeenCalledOnce();
  });

  it('rejects a delayed owner-A grant hash before it can write owner B', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    let releaseDigest!: () => void;
    mocks.digestStringAsync.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          releaseDigest = () => resolve(CURRENT_HASH);
        }),
    );

    const grant = grantPhotoCaptureConsent();
    await vi.waitFor(() => expect(mocks.digestStringAsync).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(grant).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.recordConsent).not.toHaveBeenCalled();
    releaseDigest();
    await Promise.resolve();
  });

  it('provides non-destructive persistent and one-shot dev read failures', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_READ_FAILURE = 'always';

    await expect(readPhotoCaptureConsent()).resolves.toMatchObject({
      status: 'unavailable',
      source: 'primary',
      reason: 'storage_unavailable',
    });
    await expect(readPhotoCaptureConsent()).resolves.toMatchObject({ status: 'unavailable' });
    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();

    process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_READ_FAILURE = 'once';
    await expect(readPhotoCaptureConsent()).resolves.toMatchObject({ status: 'unavailable' });
    await expect(readPhotoCaptureConsent()).resolves.toEqual({ status: 'absent', consent: null });
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('keeps a hung dev read lease-bound so an account boundary can detach it', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_READ_FAILURE = 'hang';

    const read = readPhotoCaptureConsent();
    await Promise.resolve();
    await Promise.resolve();
    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(read).rejects.toBeInstanceOf(AccountGenerationLeaseError);
  });

  it('simulates an uncertain commit only after the exact local proof is written', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE = 'uncertain_once';

    await expect(grantPhotoCaptureConsent()).rejects.toBeInstanceOf(
      PhotoCaptureConsentWriteUncertainError,
    );
    expect(JSON.parse(mocks.storage.get(CAPTURE_RECORD_KEY) ?? '{}')).toMatchObject({
      schemaVersion: 1,
      consent: { version: PHOTO_CAPTURE_CONSENT.version, consentTextHash: CURRENT_HASH },
    });
    await expect(readPhotoCaptureConsent()).resolves.toMatchObject({
      status: 'available',
      state: 'current',
    });
  });

  it.each([
    ['stale_version', { status: 'available', state: 'reconsent_required', reason: 'stale_version' }],
    ['wrong_hash', { status: 'available', state: 'reconsent_required', reason: 'hash_mismatch' }],
    [
      'legacy_true',
      { status: 'available', state: 'reconsent_required', reason: 'legacy_unverifiable' },
    ],
    ['malformed', { status: 'corrupt', source: 'primary', reason: 'invalid_record' }],
    ['future', { status: 'unsupported_version', source: 'primary' }],
  ] as const)('provides the non-mutating %s route fixture in development', async (fixture, expected) => {
    const privateKV = await import('@/lib/storage/privateKV');
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE = fixture;

    await expect(readPhotoCaptureConsent()).resolves.toMatchObject(expected);

    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('ignores read fixtures outside development builds', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_READ_FAILURE = 'always';
    process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE = 'future';
    process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE = 'uncertain_once';

    await expect(readPhotoCaptureConsent()).resolves.toEqual({ status: 'absent', consent: null });
    await expect(grantPhotoCaptureConsent()).resolves.toMatchObject({
      status: 'available',
      state: 'current',
    });
    expect(privateKV.readPrivateItem).toHaveBeenCalledWith(CAPTURE_RECORD_KEY);
  });

  it('surfaces a non-storage hash failure as unavailable during an explicit grant', async () => {
    mocks.digestStringAsync.mockRejectedValueOnce(new Error('digest unavailable'));
    await expect(grantPhotoCaptureConsent()).rejects.toThrow(PHOTO_CAPTURE_CONSENT_UNAVAILABLE);
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });
});
