import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HEALTH_DATA_CONSENT } from './consentCopy';
import {
  clearHealthDataCollectionConsentLocal,
  getHealthDataCollectionConsentLocal,
  hasCurrentHealthDataCollectionConsent,
  HEALTH_CONSENT_INVALID,
  HEALTH_CONSENT_UNSUPPORTED_VERSION,
  setHealthDataCollectionConsentLocal,
} from './healthConsentStore';

const HEALTH_DATA_CONSENT_KEY = 'onskin.healthDataCollectionConsent.v1';

const mocks = vi.hoisted(() => ({
  privateStore: new Map<string, string>(),
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) => `sha256:${value}`),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.privateStore.get(key) ?? null),
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
  beforeEach(() => {
    mocks.privateStore.clear();
    mocks.digestStringAsync.mockClear();
    mocks.tails.clear();
    mocks.updateFailure = null;
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
    await expect(hasCurrentHealthDataCollectionConsent()).resolves.toBe(false);
    expect(mocks.digestStringAsync).not.toHaveBeenCalled();
  });

  it('ignores and preserves malformed local consent records', async () => {
    const malformed = JSON.stringify({ granted: true });
    mocks.privateStore.set(HEALTH_DATA_CONSENT_KEY, malformed);

    await expect(getHealthDataCollectionConsentLocal()).resolves.toBeNull();
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

    await expect(getHealthDataCollectionConsentLocal()).resolves.toBeNull();
    expect(mocks.privateStore.get(HEALTH_DATA_CONSENT_KEY)).toBe('{not-json');
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

      await expect(getHealthDataCollectionConsentLocal()).resolves.toBeNull();
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
});
