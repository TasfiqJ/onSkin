import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  clearStoredSkinProfile,
  getStoredSkinProfile,
  isOnboardedLocal,
  readStoredSkinProfile,
  setStoredSkinProfile,
  setStoredSkinProfileFromExplicitQuiz,
  SKIN_PROFILE_CONTRACT_MISMATCH,
  SKIN_PROFILE_INVALID,
  SKIN_PROFILE_UNSUPPORTED_VERSION,
  type StoredSkinProfile,
  updateStoredPregnancyStatus,
} from './skinProfileStore';
import { ONBOARDING_QUIZ, scoreQuiz, type QuizAnswers, type SkinProfileResult } from './quiz';

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  return {
    storage,
    getPrivateItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    getPrivateItemGate: null as Promise<void> | null,
    getPrivateItemStarted: null as (() => void) | null,
    tails: new Map<string, Promise<void>>(),
    updateFailure: null as Error | null,
  };
});

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
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
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'layerwell.skinprofile.v1';
const COMPLETE_ANSWERS = Object.fromEntries(
  ONBOARDING_QUIZ.map((question) => [
    question.id,
    question.multiSelect === true ? [question.options[0]!.id] : question.options[0]!.id,
  ]),
) as QuizAnswers;
const RESULT = scoreQuiz(COMPLETE_ANSWERS);
const PROFILE: StoredSkinProfile = {
  result: RESULT,
  goals: ['clear_skin'],
  completedAt: '2026-07-07T00:00:00.000Z',
};
const LEGACY_RESULT: SkinProfileResult = {
  axes: RESULT.axes,
  axisScores: RESULT.axisScores,
  dspt: RESULT.dspt,
  fitzpatrick: RESULT.fitzpatrick,
  monkTone: RESULT.monkTone,
  sensitivities: RESULT.sensitivities,
  pregnancyStatus: RESULT.pregnancyStatus,
};
const LEGACY_PROFILE = {
  result: LEGACY_RESULT,
  goals: ['clear_skin'],
  completedAt: '2026-07-07T00:00:00.000Z',
};

function currentEnvelope(profile: StoredSkinProfile = PROFILE): {
  version: 2;
  profile: StoredSkinProfile;
} {
  return { version: 2, profile };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('skin profile local onboarding gate store', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.getPrivateItem.mockReset();
    mocks.getPrivateItemGate = null;
    mocks.getPrivateItemStarted = null;
    mocks.getPrivateItem.mockImplementation(async (key: string) => {
      mocks.getPrivateItemStarted?.();
      if (mocks.getPrivateItemGate) await mocks.getPrivateItemGate;
      return mocks.storage.get(key) ?? null;
    });
    mocks.tails.clear();
    mocks.updateFailure = null;
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
  });

  it('saves and returns only an exact v2 current-contract receipt', async () => {
    await setStoredSkinProfile(PROFILE);

    await expect(readStoredSkinProfile()).resolves.toEqual({
      status: 'available',
      profile: PROFILE,
    });
    await expect(getStoredSkinProfile()).resolves.toEqual(PROFILE);
    await expect(isOnboardedLocal()).resolves.toBe(true);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual(currentEnvelope());
  });

  it('stores deterministic provenance without raw quiz answers or an answer hash', async () => {
    await setStoredSkinProfile(PROFILE);

    const stored = mocks.storage.get(KEY) ?? '';
    const parsed = JSON.parse(stored) as {
      version: number;
      profile: { result: Record<string, unknown> };
    };
    expect(parsed.version).toBe(2);
    expect(parsed.profile.result).toMatchObject({
      axesBasisPoints: RESULT.axesBasisPoints,
      provenance: RESULT.provenance,
    });
    expect(Object.keys(parsed.profile.result).sort()).toEqual(
      [
        'axes',
        'axesBasisPoints',
        'axisScores',
        'dspt',
        'fitzpatrick',
        'monkTone',
        'pregnancyStatus',
        'provenance',
        'sensitivities',
      ].sort(),
    );
    expect(stored).not.toContain('q_oil');
    expect(stored).not.toContain('answerHash');
    expect(stored).not.toContain('answers');
  });

  it.each([
    ['unversioned', JSON.stringify(LEGACY_PROFILE)],
    ['v1 envelope', JSON.stringify({ version: 1, profile: LEGACY_PROFILE })],
  ])('preserves %s legacy bytes but never treats them as onboarded', async (_label, raw) => {
    mocks.storage.set(KEY, raw);

    await expect(readStoredSkinProfile()).resolves.toEqual({ status: 'legacy', profile: null });
    await expect(getStoredSkinProfile()).resolves.toBeNull();
    await expect(isOnboardedLocal()).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('allows a fresh explicit current quiz result to atomically replace valid legacy bytes', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 1,
        profile: {
          ...LEGACY_PROFILE,
          // The old decoder admitted any non-empty approved goal list.
          goals: ['clear_skin', 'hydration', 'barrier_repair'],
        },
      }),
    );

    await setStoredSkinProfile(PROFILE);

    await expect(readStoredSkinProfile()).resolves.toEqual({
      status: 'available',
      profile: PROFILE,
    });
  });

  it('classifies exact-shape provenance drift as a contract mismatch and permits rescore recovery', async () => {
    const mismatched = clone(currentEnvelope());
    (mismatched.profile.result.provenance as unknown as Record<string, unknown>).contractSha256 =
      '0'.repeat(64);
    const raw = JSON.stringify(mismatched);
    mocks.storage.set(KEY, raw);

    await expect(readStoredSkinProfile()).resolves.toEqual({
      status: 'contract_mismatch',
      profile: null,
    });
    await expect(getStoredSkinProfile()).resolves.toBeNull();
    await expect(isOnboardedLocal()).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(raw);

    await setStoredSkinProfile(PROFILE);
    await expect(readStoredSkinProfile()).resolves.toMatchObject({ status: 'available' });
  });

  it.each([
    [
      'basis points disagree with the raw score',
      (envelope: ReturnType<typeof currentEnvelope>) => {
        envelope.profile.result.axesBasisPoints.oily_dry += 1;
      },
    ],
    [
      'compatibility float is not derived from basis points',
      (envelope: ReturnType<typeof currentEnvelope>) => {
        envelope.profile.result.axes.oily_dry += 0.01;
      },
    ],
    [
      'DSPT does not match the signed scores and tie rule',
      (envelope: ReturnType<typeof currentEnvelope>) => {
        envelope.profile.result.dspt = 'OSPW';
      },
    ],
    [
      'sensitivity list is not in canonical option order',
      (envelope: ReturnType<typeof currentEnvelope>) => {
        envelope.profile.result.sensitivities = ['essential_oils', 'fragrance'];
      },
    ],
    [
      'provenance shape has an extra field',
      (envelope: ReturnType<typeof currentEnvelope>) => {
        Object.assign(envelope.profile.result.provenance, { answersSha256: 'forbidden' });
      },
    ],
  ])('rejects current-envelope tampering when %s', async (_label, mutate) => {
    const envelope = clone(currentEnvelope());
    mutate(envelope);
    const raw = JSON.stringify(envelope);
    mocks.storage.set(KEY, raw);

    await expect(readStoredSkinProfile()).resolves.toEqual({ status: 'invalid', profile: null });
    await expect(getStoredSkinProfile()).resolves.toBeNull();
    await expect(isOnboardedLocal()).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('rejects malformed JSON and wrong-shaped records without deleting recovery bytes', async () => {
    for (const raw of [
      '{not-json',
      JSON.stringify({ goals: ['clear_skin'], completedAt: '2026-07-07' }),
      JSON.stringify({ version: 2, profile: { ...PROFILE, extra: true } }),
    ]) {
      mocks.storage.set(KEY, raw);
      await expect(readStoredSkinProfile()).resolves.toEqual({ status: 'invalid', profile: null });
      await expect(getStoredSkinProfile()).resolves.toBeNull();
      expect(mocks.storage.get(KEY)).toBe(raw);
    }
  });

  it('rejects invalid new records before touching storage', async () => {
    const invalid = clone(PROFILE);
    invalid.goals = [];

    await expect(setStoredSkinProfile(invalid)).rejects.toThrow('INVALID_SKIN_PROFILE_RECORD');
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('distinguishes a private-storage read failure from an absent profile', async () => {
    mocks.getPrivateItem.mockRejectedValueOnce(new Error('secure storage unavailable'));

    await expect(readStoredSkinProfile()).resolves.toEqual({
      status: 'unavailable',
      profile: null,
    });
    await expect(readStoredSkinProfile()).resolves.toEqual({ status: 'missing', profile: null });
  });

  it('updates pregnancy status without changing the current receipt provenance', async () => {
    await setStoredSkinProfile(PROFILE);

    const next = await updateStoredPregnancyStatus('breastfeeding');
    expect(next).toEqual({
      ...PROFILE,
      result: {
        ...PROFILE.result,
        pregnancyStatus: 'breastfeeding',
      },
    });
    expect(next.result.provenance).toEqual(RESULT.provenance);
    await expect(getStoredSkinProfile()).resolves.toEqual(next);
  });

  it('refuses a pregnancy update when the authoritative local profile is missing', async () => {
    await expect(updateStoredPregnancyStatus('pregnant')).rejects.toThrow(
      'SKIN_PROFILE_UNAVAILABLE',
    );
  });

  it('preserves future-version and malformed current bytes against silent overwrite', async () => {
    for (const [raw, status, code] of [
      [
        JSON.stringify({ version: 3, profile: PROFILE }),
        'unsupported_version',
        SKIN_PROFILE_UNSUPPORTED_VERSION,
      ],
      [
        JSON.stringify({ version: 2, profile: { ...PROFILE, extra: true } }),
        'invalid',
        SKIN_PROFILE_INVALID,
      ],
    ] as const) {
      mocks.storage.set(KEY, raw);

      await expect(readStoredSkinProfile()).resolves.toEqual({ status, profile: null });
      await expect(setStoredSkinProfile(PROFILE)).rejects.toThrow(code);
      await expect(updateStoredPregnancyStatus('pregnant')).rejects.toThrow(code);
      expect(mocks.storage.get(KEY)).toBe(raw);
    }
  });

  it.each([
    ['future-version', JSON.stringify({ version: 3, profile: PROFILE })],
    ['malformed', '{not-json'],
    ['invalid current shape', JSON.stringify({ version: 2, profile: { ...PROFILE, extra: true } })],
  ])(
    'atomically replaces %s bytes only through a freshly completed explicit quiz',
    async (_label, raw) => {
      mocks.storage.set(KEY, raw);

      await setStoredSkinProfileFromExplicitQuiz(PROFILE);

      await expect(readStoredSkinProfile()).resolves.toEqual({
        status: 'available',
        profile: PROFILE,
      });
    },
  );

  it.each([
    ['future-version', JSON.stringify({ version: 3, profile: PROFILE })],
    ['malformed', '{not-json'],
  ])(
    'keeps prior %s bytes intact when explicit-quiz recovery cannot durably write',
    async (_label, raw) => {
      mocks.storage.set(KEY, raw);
      mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

      await expect(setStoredSkinProfileFromExplicitQuiz(PROFILE)).rejects.toThrow(
        'PRIVATE_WRITE_FAILED',
      );
      expect(mocks.storage.get(KEY)).toBe(raw);
    },
  );

  it('preserves contract-mismatched bytes against pregnancy-only mutation', async () => {
    const mismatched = clone(currentEnvelope());
    (mismatched.profile.result.provenance as unknown as Record<string, unknown>).contentVersion =
      'other';
    const raw = JSON.stringify(mismatched);
    mocks.storage.set(KEY, raw);

    await expect(updateStoredPregnancyStatus('pregnant')).rejects.toThrow(
      SKIN_PROFILE_CONTRACT_MISMATCH,
    );
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('serializes a profile replacement and pregnancy edit without stale read overwrite', async () => {
    await setStoredSkinProfile(PROFILE);
    const replacement: StoredSkinProfile = {
      ...PROFILE,
      goals: ['hydration'],
      completedAt: '2026-07-08T00:00:00.000Z',
    };

    await Promise.all([
      setStoredSkinProfile(replacement),
      updateStoredPregnancyStatus('breastfeeding'),
    ]);

    await expect(getStoredSkinProfile()).resolves.toEqual({
      ...replacement,
      result: { ...replacement.result, pregnancyStatus: 'breastfeeding' },
    });
  });

  it('keeps the prior profile intact when an atomic write fails', async () => {
    await setStoredSkinProfile(PROFILE);
    const original = mocks.storage.get(KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(updateStoredPregnancyStatus('pregnant')).rejects.toThrow('PRIVATE_WRITE_FAILED');
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('rejects an A-to-B same-epoch read instead of publishing a fail-soft result', async () => {
    await setStoredSkinProfile(PROFILE);
    let releaseRead!: () => void;
    mocks.getPrivateItemGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      mocks.getPrivateItemStarted = resolve;
    });

    const pending = readStoredSkinProfile();
    await readStarted;
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-b', accountGeneration: 0 });
    const rejection = expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_OWNER_MISMATCH');

    releaseRead();
    await rejection;
  });

  it('clears the stored profile after health processing closes', async () => {
    mocks.storage.set(KEY, 'private-profile-bytes');
    clearActiveHealthProcessingEpoch();

    await clearStoredSkinProfile();

    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
