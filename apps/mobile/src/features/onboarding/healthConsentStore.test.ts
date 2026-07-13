import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AccountGenerationLeaseError,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import * as privateKV from '@/lib/storage/privateKV';
import type { PrivateKVReadResult } from '@/lib/storage/privateKV';

import { HEALTH_DATA_CONSENT } from './consentCopy';
import {
  clearHealthDataCollectionConsentLocal,
  getHealthDataCollectionConsentLocal,
  hasCurrentHealthDataCollectionConsent,
  HEALTH_CONSENT_INVALID,
  HEALTH_CONSENT_UNAVAILABLE,
  HEALTH_CONSENT_UNSUPPORTED_VERSION,
  readHealthDataCollectionConsentLocal,
  setHealthDataCollectionConsentLocal,
} from './healthConsentStore';

const HEALTH_DATA_CONSENT_KEY = 'onskin.healthDataCollectionConsent.v1';

const mocks = vi.hoisted(() => ({
  privateStore: new Map<string, string>(),
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) => `sha256:${value}`),
  privateReadOverride: null as PrivateKVReadResult | null,
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    if (mocks.privateReadOverride) return mocks.privateReadOverride;
    const value = mocks.privateStore.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.privateStore.delete(key);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, tail);
      await previous;
      try {
        if (mocks.updateFailure) throw mocks.updateFailure;
        const next = updater(mocks.privateStore.get(key) ?? null);
        if (next === null) mocks.privateStore.delete(key);
        else mocks.privateStore.set(key, next);
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

function seedConsent(
  overrides: Partial<{
    type: string;
    granted: boolean;
    version: string;
    consentTextHash: string;
    recordedAt: string;
  }> = {},
) {
  mocks.privateStore.set(
    HEALTH_DATA_CONSENT_KEY,
    JSON.stringify({
      type: 'health_data_collection',
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentTextHash: `sha256:${HEALTH_DATA_CONSENT.fullText}`,
      recordedAt: '2026-07-10T00:00:00.000Z',
      ...overrides,
    }),
  );
}

describe('health-data local consent store', () => {
  let boundaryActive = false;

  beforeEach(() => {
    mocks.privateStore.clear();
    mocks.digestStringAsync
      .mockReset()
      .mockImplementation(async (_algorithm: string, value: string) => `sha256:${value}`);
    mocks.privateReadOverride = null;
    mocks.tails.clear();
    mocks.updateFailure = null;
    vi.mocked(privateKV.readPrivateItem).mockClear();
    vi.mocked(privateKV.updatePrivateItem).mockClear();
  });

  afterEach(() => {
    if (!boundaryActive) return;
    endAccountGenerationBoundary();
    boundaryActive = false;
  });

  it('stores the explicit choice with version and consent-text hash', async () => {
    await setHealthDataCollectionConsentLocal({
      granted: true,
      version: 'draft-v1',
      consentText: 'shown consent text',
    });

    const record = await getHealthDataCollectionConsentLocal();

    expect(record).toMatchObject({
      type: 'health_data_collection',
      granted: true,
      version: 'draft-v1',
      consentTextHash: 'sha256:shown consent text',
    });
    expect(record?.recordedAt).toEqual(expect.any(String));
    expect(JSON.parse(mocks.privateStore.get(HEALTH_DATA_CONSENT_KEY) ?? '{}')).toMatchObject({
      schemaVersion: 1,
      consent: { type: 'health_data_collection', granted: true },
    });
  });

  it('accepts a granted consent record for the exact current copy', async () => {
    seedConsent();

    await expect(hasCurrentHealthDataCollectionConsent()).resolves.toBe(true);
    expect(mocks.digestStringAsync).toHaveBeenCalledWith('SHA-256', HEALTH_DATA_CONSENT.fullText);
  });

  it('rejects a granted consent record with a stale version', async () => {
    seedConsent({ version: 'draft-stale' });

    await expect(hasCurrentHealthDataCollectionConsent()).resolves.toBe(false);
    expect(mocks.digestStringAsync).not.toHaveBeenCalled();
  });

  it('rejects a granted consent record with the wrong current-text hash', async () => {
    seedConsent({ consentTextHash: 'sha256:wrong-copy' });

    await expect(hasCurrentHealthDataCollectionConsent()).resolves.toBe(false);
  });

  it('rejects a declined consent record even when its version and hash are current', async () => {
    seedConsent({ granted: false });

    await expect(hasCurrentHealthDataCollectionConsent()).resolves.toBe(false);
    expect(mocks.digestStringAsync).not.toHaveBeenCalled();
  });

  it('rejects a missing local consent record', async () => {
    await expect(readHealthDataCollectionConsentLocal()).resolves.toEqual({
      status: 'absent',
      consent: null,
    });
    await expect(getHealthDataCollectionConsentLocal()).resolves.toBeNull();
    await expect(hasCurrentHealthDataCollectionConsent()).resolves.toBe(false);
    expect(mocks.digestStringAsync).not.toHaveBeenCalled();
  });

  it('classifies and preserves malformed local consent records', async () => {
    const malformed = JSON.stringify({ granted: true });
    mocks.privateStore.set(HEALTH_DATA_CONSENT_KEY, malformed);

    await expect(readHealthDataCollectionConsentLocal()).resolves.toEqual({
      status: 'corrupt',
      consent: null,
      reason: 'invalid_record',
    });
    await expect(getHealthDataCollectionConsentLocal()).rejects.toThrow(HEALTH_CONSENT_INVALID);
    await expect(hasCurrentHealthDataCollectionConsent()).resolves.toBe(false);
    expect(mocks.privateStore.get(HEALTH_DATA_CONSENT_KEY)).toBe(malformed);
  });

  it('trims local consent fields before returning a persisted choice', async () => {
    mocks.privateStore.set(
      HEALTH_DATA_CONSENT_KEY,
      JSON.stringify({
        type: ' health_data_collection ',
        granted: false,
        version: ' draft-v1 ',
        consentTextHash: ' hash ',
        recordedAt: ' 2026-07-07T00:00:00.000Z ',
      }),
    );

    await expect(getHealthDataCollectionConsentLocal()).resolves.toMatchObject({
      type: 'health_data_collection',
      granted: false,
      version: 'draft-v1',
      consentTextHash: 'hash',
      recordedAt: '2026-07-07T00:00:00.000Z',
    });
    expect(JSON.parse(mocks.privateStore.get(HEALTH_DATA_CONSENT_KEY) ?? '{}')).toMatchObject({
      version: ' draft-v1 ',
      consentTextHash: ' hash ',
    });
  });

  it('preserves unreadable local consent JSON', async () => {
    mocks.privateStore.set(HEALTH_DATA_CONSENT_KEY, '{not-json');

    await expect(readHealthDataCollectionConsentLocal()).resolves.toEqual({
      status: 'corrupt',
      consent: null,
      reason: 'invalid_record',
    });
    await expect(getHealthDataCollectionConsentLocal()).rejects.toThrow(HEALTH_CONSENT_INVALID);
    expect(mocks.privateStore.get(HEALTH_DATA_CONSENT_KEY)).toBe('{not-json');
  });

  it.each([
    [
      { status: 'unavailable', reason: 'content_key_missing' } as const,
      {
        status: 'unavailable',
        consent: null,
        reason: 'content_key_missing',
      },
      HEALTH_CONSENT_UNAVAILABLE,
    ],
    [
      { status: 'corrupt', reason: 'decryption_failed' } as const,
      { status: 'corrupt', consent: null, reason: 'decryption_failed' },
      HEALTH_CONSENT_INVALID,
    ],
    [
      { status: 'unsupported_version' } as const,
      { status: 'unsupported_version', consent: null },
      HEALTH_CONSENT_UNSUPPORTED_VERSION,
    ],
  ])('preserves typed private-storage failure %o', async (stored, expected, compatibilityCode) => {
    const original = 'encrypted-private-envelope';
    mocks.privateStore.set(HEALTH_DATA_CONSENT_KEY, original);
    mocks.privateReadOverride = stored;

    await expect(readHealthDataCollectionConsentLocal()).resolves.toEqual(expected);
    await expect(getHealthDataCollectionConsentLocal()).rejects.toThrow(compatibilityCode);
    await expect(hasCurrentHealthDataCollectionConsent()).resolves.toBe(false);
    expect(mocks.privateStore.get(HEALTH_DATA_CONSENT_KEY)).toBe(original);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('clears the local consent record for test and reset flows', async () => {
    await setHealthDataCollectionConsentLocal({
      granted: false,
      version: 'draft-v1',
      consentText: 'decline text',
    });

    await clearHealthDataCollectionConsentLocal();

    await expect(getHealthDataCollectionConsentLocal()).resolves.toBeNull();
  });

  it('preserves future and malformed current consent envelopes', async () => {
    const validConsent = {
      type: 'health_data_collection',
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentTextHash: `sha256:${HEALTH_DATA_CONSENT.fullText}`,
      recordedAt: '2026-07-10T00:00:00.000Z',
    };
    for (const [raw, code] of [
      [
        JSON.stringify({ schemaVersion: 2, consent: validConsent }),
        HEALTH_CONSENT_UNSUPPORTED_VERSION,
      ],
      [
        JSON.stringify({ schemaVersion: 1, consent: { ...validConsent, extra: true } }),
        HEALTH_CONSENT_INVALID,
      ],
    ] as const) {
      mocks.privateStore.set(HEALTH_DATA_CONSENT_KEY, raw);

      await expect(readHealthDataCollectionConsentLocal()).resolves.toMatchObject({
        status:
          code === HEALTH_CONSENT_UNSUPPORTED_VERSION ? 'unsupported_version' : 'corrupt',
        consent: null,
      });
      await expect(getHealthDataCollectionConsentLocal()).rejects.toThrow(code);
      await expect(
        setHealthDataCollectionConsentLocal({
          granted: true,
          version: HEALTH_DATA_CONSENT.version,
          consentText: HEALTH_DATA_CONSENT.fullText,
        }),
      ).rejects.toThrow(code);
      expect(mocks.privateStore.get(HEALTH_DATA_CONSENT_KEY)).toBe(raw);
    }
  });

  it('keeps the prior consent proof intact on atomic write failure', async () => {
    await setHealthDataCollectionConsentLocal({
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
    const original = mocks.privateStore.get(HEALTH_DATA_CONSENT_KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(
      setHealthDataCollectionConsentLocal({
        granted: false,
        version: HEALTH_DATA_CONSENT.version,
        consentText: HEALTH_DATA_CONSENT.fullText,
      }),
    ).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.privateStore.get(HEALTH_DATA_CONSENT_KEY)).toBe(original);
  });

  it('rejects a delayed owner-A consent hash after an account boundary with zero writes', async () => {
    let releaseDigest!: () => void;
    mocks.digestStringAsync.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          releaseDigest = () => resolve('owner-a-hash');
        }),
    );

    const write = setHealthDataCollectionConsentLocal({
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
    await vi.waitFor(() => expect(mocks.digestStringAsync).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(write).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.privateStore.has(HEALTH_DATA_CONSENT_KEY)).toBe(false);

    releaseDigest();
    await Promise.resolve();
  });
});
