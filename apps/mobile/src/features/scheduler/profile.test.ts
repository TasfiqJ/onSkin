import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoredSkinProfile } from '@/features/onboarding/skinProfileStore';

import { readProfileBits } from './profile';
import { moistureFromAxis, sensitivityFromAxis } from './profileMapping';

const mocks = vi.hoisted(() => ({
  storedProfile: null as StoredSkinProfile | null,
}));

vi.mock('@/features/onboarding/skinProfileStore', () => ({
  getStoredSkinProfile: vi.fn(async () => mocks.storedProfile),
}));

vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: false,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {},
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

beforeEach(() => {
  mocks.storedProfile = null;
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
      sensitivity: 'resistant',
      moisture: 'oily',
      pregnancy: true,
      goals: ['barrier_repair'],
    });
  });

  it('keeps the neutral fallback when no local or server profile is available', async () => {
    await expect(readProfileBits()).resolves.toEqual({
      sensitivity: 'neutral',
      moisture: 'balanced',
      pregnancy: false,
      goals: [],
    });
  });
});
