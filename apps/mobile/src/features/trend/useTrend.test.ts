import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CURRENT_SERVER_SKIN_PROFILE_PROVENANCE } from '@/features/onboarding/serverSkinProfile';

import { readMonkBand } from './useTrend';

const mocks = vi.hoisted(() => ({
  ownerUserId: 'user-1' as string | null,
  localRead: { status: 'missing', profile: null } as unknown,
  supabaseConfigured: true,
  serverData: null as Record<string, unknown> | null,
  serverError: null as { message: string } | null,
  from: vi.fn(),
  leaseOpen: true,
}));

vi.mock('@/features/onboarding/skinProfileStore', () => ({
  readStoredSkinProfile: vi.fn(async () => mocks.localRead),
}));

vi.mock('@/features/photos/usePhotos', () => ({
  usePhotos: vi.fn(),
}));

vi.mock('./consent', () => ({
  isTrendInsightsConsented: vi.fn(),
}));

vi.mock('./copy', () => ({
  trendNarrative: vi.fn(),
}));

vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingOwnerUserId: () => mocks.ownerUserId,
}));

vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  runHealthDataWriteOperation: async (
    ownerUserId: string,
    operation: (lease: { ownerUserId: string; assertCurrent: () => void }) => unknown,
  ) => {
    const assertCurrent = () => {
      if (!mocks.leaseOpen) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    };
    assertCurrent();
    const result = await operation({ ownerUserId, assertCurrent });
    assertCurrent();
    return result;
  },
}));

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.supabaseConfigured;
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: mocks.from },
}));

function currentServerProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    oily_dry: 2,
    sensitive_resistant: -2,
    pigmented_non: 0,
    wrinkled_tight: 0,
    dspt: 'ORPW',
    oily_dry_basis_points: 7500,
    sensitive_resistant_basis_points: 2500,
    pigmented_non_basis_points: 5000,
    wrinkled_tight_basis_points: 5000,
    fitzpatrick: 3,
    monk_tone: 8,
    sensitivities: [],
    pregnancy_status: 'none',
    goals: ['hydration'],
    completed_at: '2026-07-26T00:00:00+00:00',
    ...CURRENT_SERVER_SKIN_PROFILE_PROVENANCE,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.ownerUserId = 'user-1';
  mocks.localRead = { status: 'missing', profile: null };
  mocks.supabaseConfigured = true;
  mocks.serverData = null;
  mocks.serverError = null;
  mocks.leaseOpen = true;
  mocks.from.mockReset();
  mocks.from.mockImplementation(() => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({
        data: mocks.serverData,
        error: mocks.serverError,
      })),
    };
    return query;
  });
});

describe('Trend Monk-band profile reader', () => {
  it('uses the current local profile as authority without consulting the server', async () => {
    mocks.localRead = {
      status: 'available',
      profile: { result: { monkTone: 7 } },
    };

    await expect(readMonkBand()).resolves.toBe(7);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each(['invalid', 'unavailable', 'legacy', 'contract_mismatch', 'unsupported_version'])(
    'does not bypass a %s local record with the server mirror',
    async (status) => {
      mocks.localRead = { status, profile: null };
      mocks.serverData = currentServerProfile();

      await expect(readMonkBand()).resolves.toBeNull();
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it('does not consult the server when the backend is not configured', async () => {
    mocks.supabaseConfigured = false;
    mocks.serverData = currentServerProfile();

    await expect(readMonkBand()).resolves.toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('accepts the Monk tone only from a complete exact current server profile', async () => {
    mocks.serverData = currentServerProfile();
    await expect(readMonkBand()).resolves.toBe(8);
  });

  it.each([
    ['legacy row', currentServerProfile({ version: 1 })],
    ['hash mismatch', currentServerProfile({ quiz_scoring_sha256: '0'.repeat(64) })],
    ['invalid basis points', currentServerProfile({ wrinkled_tight_basis_points: 7500 })],
    [
      'missing column',
      (() => {
        const row = currentServerProfile();
        delete row.quiz_review_status;
        return row;
      })(),
    ],
  ])('fails closed for a %s', async (_label, row) => {
    mocks.serverData = row;
    await expect(readMonkBand()).resolves.toBeNull();
  });

  it('fails closed for an absent row or a reported query error', async () => {
    await expect(readMonkBand()).resolves.toBeNull();

    mocks.serverData = currentServerProfile();
    mocks.serverError = { message: 'schema cache is stale' };
    await expect(readMonkBand()).resolves.toBeNull();
  });

  it('does not swallow an owner-generation boundary during the server request', async () => {
    mocks.serverData = currentServerProfile();
    mocks.from.mockImplementationOnce(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn(async () => {
          mocks.leaseOpen = false;
          return { data: mocks.serverData, error: null };
        }),
      };
      return query;
    });

    await expect(readMonkBand()).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
  });

  it('returns no private profile data without an active health-processing owner', async () => {
    mocks.ownerUserId = null;
    mocks.localRead = {
      status: 'available',
      profile: { result: { monkTone: 7 } },
    };

    await expect(readMonkBand()).resolves.toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
