import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AccountGenerationLeaseError,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';

import type {
  StoredSkinProfile,
  StoredSkinProfileRead,
} from '@/features/onboarding/skinProfileStore';

import { readProfileBits, savePregnancyStatus } from './profile';
import { moistureFromAxis, sensitivityFromAxis } from './profileMapping';

const mocks = vi.hoisted(() => ({
  storedProfile: null as StoredSkinProfile | null,
  localStatus: 'missing' as StoredSkinProfileRead['status'],
  consentCurrent: true,
  supabaseConfigured: false,
  serverData: null as Record<string, unknown> | null,
  from: vi.fn(),
  hasCurrentHealthDataCollectionConsent: vi.fn(),
  updateStoredPregnancyStatus: vi.fn(),
}));

vi.mock('@/features/onboarding/skinProfileStore', () => ({
  readStoredSkinProfile: vi.fn(
    async (): Promise<StoredSkinProfileRead> =>
      mocks.storedProfile
        ? { status: 'available', profile: mocks.storedProfile }
        : { status: mocks.localStatus as 'missing' | 'unavailable' | 'invalid', profile: null },
  ),
  updateStoredPregnancyStatus: mocks.updateStoredPregnancyStatus,
}));

vi.mock('@/features/onboarding/healthConsentStore', () => ({
  hasCurrentHealthDataCollectionConsent: mocks.hasCurrentHealthDataCollectionConsent,
}));

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.supabaseConfigured;
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: mocks.from },
}));

const storedProfile = (input: {
  oilyDry: number;
  sensitiveResistant: number;
  pregnancyStatus?: StoredSkinProfile['result']['pregnancyStatus'];
  goals?: StoredSkinProfile['goals'];
}): StoredSkinProfile => ({
  result: {
    axes: {
      oily_dry: 0.5,
      sensitive_resistant: 0.5,
      pigmented_non: 0.5,
      wrinkled_tight: 0.5,
    },
    axisScores: {
      oily_dry: input.oilyDry,
      sensitive_resistant: input.sensitiveResistant,
      pigmented_non: 0,
      wrinkled_tight: 0,
    },
    dspt: 'OSNT',
    fitzpatrick: null,
    monkTone: null,
    sensitivities: [],
    pregnancyStatus: input.pregnancyStatus ?? 'none',
  },
  goals: input.goals ?? ['hydration'],
  completedAt: '2026-07-08T00:00:00.000Z',
});

let boundaryActive = false;

beforeEach(() => {
  mocks.storedProfile = null;
  mocks.localStatus = 'missing';
  mocks.consentCurrent = true;
  mocks.supabaseConfigured = false;
  mocks.serverData = null;
  mocks.from.mockReset();
  mocks.from.mockImplementation(() => {
    const query = {
      select: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({ data: mocks.serverData })),
    };
    return query;
  });
  mocks.hasCurrentHealthDataCollectionConsent
    .mockReset()
    .mockImplementation(async () => mocks.consentCurrent);
  mocks.updateStoredPregnancyStatus.mockReset();
  mocks.updateStoredPregnancyStatus.mockImplementation(async (status) =>
    storedProfile({
      oilyDry: 0,
      sensitiveResistant: 0,
      pregnancyStatus: status,
    }),
  );
});

afterEach(() => {
  if (!boundaryActive) return;
  endAccountGenerationBoundary();
  boundaryActive = false;
});

describe('skin profile axis mapping', () => {
  it('maps sensitivity axis scores into coarse planner buckets', () => {
    expect(sensitivityFromAxis(null)).toBe('neutral');
    expect(sensitivityFromAxis(0)).toBe('neutral');
    expect(sensitivityFromAxis(2)).toBe('sensitive');
    expect(sensitivityFromAxis(-2)).toBe('resistant');
  });

  it('maps oil/moisture axis scores into coarse routine labels', () => {
    expect(moistureFromAxis(null)).toBe('balanced');
    expect(moistureFromAxis(0)).toBe('balanced');
    expect(moistureFromAxis(2)).toBe('oily');
    expect(moistureFromAxis(-2)).toBe('dry');
  });

  it('uses the local onboarding profile before falling back to neutral', async () => {
    mocks.storedProfile = storedProfile({
      oilyDry: 2,
      sensitiveResistant: -2,
      pregnancyStatus: 'breastfeeding',
      goals: ['barrier_repair'],
    });

    await expect(readProfileBits()).resolves.toEqual({
      source: 'local',
      sensitivity: 'resistant',
      moisture: 'oily',
      pregnancyStatus: 'breastfeeding',
      pregnancySafety: 'caution',
      pregnancy: true,
      consentCurrent: true,
      goals: ['barrier_repair'],
    });
  });

  it('keeps unavailable status distinct and takes the cautious safety branch', async () => {
    await expect(readProfileBits()).resolves.toEqual({
      source: 'unavailable',
      sensitivity: 'neutral',
      moisture: 'balanced',
      pregnancyStatus: 'unknown',
      pregnancySafety: 'caution',
      pregnancy: false,
      consentCurrent: true,
      goals: [],
    });
  });

  it('does not infer pregnancy from prefer-not while keeping safety cautious', async () => {
    mocks.storedProfile = storedProfile({
      oilyDry: 0,
      sensitiveResistant: 0,
      pregnancyStatus: 'prefer_not',
    });

    await expect(readProfileBits()).resolves.toMatchObject({
      pregnancyStatus: 'prefer_not',
      pregnancySafety: 'caution',
      pregnancy: false,
    });
  });

  it('does not consult a stale server mirror after an unreadable local profile', async () => {
    mocks.localStatus = 'unavailable';
    mocks.supabaseConfigured = true;
    mocks.serverData = {
      oily_dry: 2,
      sensitive_resistant: -2,
      pregnancy_status: 'none',
      goals: ['anti_aging'],
    };

    await expect(readProfileBits()).resolves.toMatchObject({
      source: 'unavailable',
      pregnancyStatus: 'unknown',
      pregnancySafety: 'caution',
      consentCurrent: true,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('treats a server-only status as unknown so a stale none cannot clear caution', async () => {
    mocks.supabaseConfigured = true;
    mocks.serverData = {
      oily_dry: 2,
      sensitive_resistant: -2,
      pregnancy_status: 'none',
      goals: ['anti_aging'],
    };

    await expect(readProfileBits()).resolves.toEqual({
      source: 'server',
      sensitivity: 'resistant',
      moisture: 'oily',
      pregnancyStatus: 'unknown',
      pregnancySafety: 'caution',
      pregnancy: false,
      consentCurrent: true,
      goals: ['anti_aging'],
    });
  });

  it('withholds personal profile bits until the current consent text is granted', async () => {
    mocks.consentCurrent = false;
    mocks.storedProfile = storedProfile({
      oilyDry: 0,
      sensitiveResistant: 0,
      pregnancyStatus: 'none',
    });

    await expect(readProfileBits()).resolves.toMatchObject({
      source: 'unavailable',
      pregnancyStatus: 'unknown',
      pregnancySafety: 'caution',
      consentCurrent: false,
    });
  });

  it('rejects a sensitive status write without current consent', async () => {
    mocks.consentCurrent = false;

    await expect(savePregnancyStatus('pregnant')).rejects.toThrow(
      'CURRENT_HEALTH_CONSENT_REQUIRED',
    );
    expect(mocks.updateStoredPregnancyStatus).not.toHaveBeenCalled();
  });

  it('commits same-owner pregnancy choices in invocation order', async () => {
    let releaseFirstConsentCheck!: () => void;
    mocks.hasCurrentHealthDataCollectionConsent.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          releaseFirstConsentCheck = () => resolve(true);
        }),
    );

    const earlierNone = savePregnancyStatus('none');
    await vi.waitFor(() =>
      expect(mocks.hasCurrentHealthDataCollectionConsent).toHaveBeenCalledOnce(),
    );
    const laterPregnant = savePregnancyStatus('pregnant');

    await Promise.resolve();
    expect(mocks.hasCurrentHealthDataCollectionConsent).toHaveBeenCalledTimes(1);
    expect(mocks.updateStoredPregnancyStatus).not.toHaveBeenCalled();

    releaseFirstConsentCheck();
    await expect(earlierNone).resolves.toMatchObject({ pregnancyStatus: 'none' });
    await expect(laterPregnant).resolves.toMatchObject({ pregnancyStatus: 'pregnant' });
    expect(mocks.updateStoredPregnancyStatus.mock.calls.map(([status]) => status)).toEqual([
      'none',
      'pregnant',
    ]);
  });

  it('rejects owner-A status after a boundary interrupts its consent check', async () => {
    let releaseConsentCheck!: () => void;
    mocks.hasCurrentHealthDataCollectionConsent.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          releaseConsentCheck = () => resolve(true);
        }),
    );

    const save = savePregnancyStatus('pregnant');
    await vi.waitFor(() =>
      expect(mocks.hasCurrentHealthDataCollectionConsent).toHaveBeenCalledOnce(),
    );

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(save).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    expect(mocks.updateStoredPregnancyStatus).not.toHaveBeenCalled();

    releaseConsentCheck();
    await Promise.resolve();
  });
});
