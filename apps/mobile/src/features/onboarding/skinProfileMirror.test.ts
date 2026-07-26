import { describe, expect, it, vi } from 'vitest';

import {
  AccountGenerationLeaseError,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { HEALTH_DATA_CONSENT } from './consentCopy';
import {
  mirrorSkinProfileWithExactConsent,
  type SkinProfileMirrorInput,
} from './skinProfileMirror';

vi.mock('@/lib/consent/consent', () => ({
  hasLatestExactConsentGrantWithLease: vi.fn(),
}));
vi.mock('@/lib/network/requestPolicy', () => ({
  runRequestWithLease: vi.fn(),
  supabaseRequestFailure: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

const INPUT: SkinProfileMirrorInput = {
  result: {
    axes: {
      oily_dry: 0.25,
      sensitive_resistant: 0.5,
      pigmented_non: 0.75,
      wrinkled_tight: 1,
    },
    axisScores: {
      oily_dry: -2,
      sensitive_resistant: 0,
      pigmented_non: 2,
      wrinkled_tight: 4,
    },
    dspt: 'DRPT',
    fitzpatrick: 3,
    monkTone: 5,
    sensitivities: ['fragrance'],
    pregnancyStatus: 'none',
  },
  goals: ['clear_skin'],
  completedAt: '2026-07-26T12:00:00.000Z',
};

function lease(generation = 91): AccountGenerationLease {
  const signal = new AbortController().signal;
  return Object.freeze({
    generation,
    signal,
    assertCurrent: vi.fn(),
    beginBoundaryHandoff: () => {
      throw new Error('not used');
    },
  });
}

function deps(
  overrides: Partial<NonNullable<Parameters<typeof mirrorSkinProfileWithExactConsent>[2]>> = {},
) {
  return {
    captureOwner: vi.fn(async () => ({ userId: 'owner-a' })),
    hasExactGrant: vi.fn(async () => true),
    publish: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('onboarding skin-profile consent gate', () => {
  it('publishes only after proving the exact current ledger grant', async () => {
    const currentLease = lease();
    const currentDeps = deps();

    await expect(mirrorSkinProfileWithExactConsent(currentLease, INPUT, currentDeps)).resolves.toBe(
      true,
    );

    expect(currentDeps.hasExactGrant).toHaveBeenCalledWith(currentLease, {
      type: 'health_data_collection',
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
    expect(currentDeps.publish).toHaveBeenCalledWith(currentLease, { userId: 'owner-a' }, INPUT);
    expect(vi.mocked(currentDeps.hasExactGrant).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(currentDeps.publish).mock.invocationCallOrder[0]!,
    );
  });

  it.each([
    {
      label: 'missing owner',
      override: { captureOwner: vi.fn(async () => null) },
    },
    {
      label: 'missing, false, stale, or revoked exact proof',
      override: { hasExactGrant: vi.fn(async () => false) },
    },
    {
      label: 'ledger failure',
      override: {
        hasExactGrant: vi.fn(async () => {
          throw new Error('ledger unavailable');
        }),
      },
    },
  ])('skips the remote mirror on $label', async ({ override }) => {
    const currentDeps = deps(override);

    await expect(mirrorSkinProfileWithExactConsent(lease(), INPUT, currentDeps)).resolves.toBe(
      false,
    );
    expect(currentDeps.publish).not.toHaveBeenCalled();
  });

  it('keeps an ordinary mirror rejection best-effort after exact proof', async () => {
    const currentDeps = deps({
      publish: vi.fn(async () => {
        throw new Error('RLS rejected');
      }),
    });

    await expect(mirrorSkinProfileWithExactConsent(lease(), INPUT, currentDeps)).resolves.toBe(
      false,
    );
  });

  it('serializes the full proof-and-insert workflow on the shared consent queue', async () => {
    let releaseFirst!: () => void;
    const firstProof = new Promise<boolean>((resolve) => {
      releaseFirst = () => resolve(true);
    });
    const events: string[] = [];
    const firstDeps = deps({
      hasExactGrant: vi.fn(async () => {
        events.push('first:proof-started');
        const granted = await firstProof;
        events.push('first:proof-finished');
        return granted;
      }),
      publish: vi.fn(async () => {
        events.push('first:insert');
      }),
    });
    const secondDeps = deps({
      captureOwner: vi.fn(async () => {
        events.push('second:capture');
        return { userId: 'owner-a' };
      }),
      publish: vi.fn(async () => {
        events.push('second:insert');
      }),
    });
    const sharedLease = lease(92);

    const first = mirrorSkinProfileWithExactConsent(sharedLease, INPUT, firstDeps);
    await vi.waitFor(() => expect(events).toEqual(['first:proof-started']));
    const second = mirrorSkinProfileWithExactConsent(sharedLease, INPUT, secondDeps);
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['first:proof-started']);

    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(events).toEqual([
      'first:proof-started',
      'first:proof-finished',
      'first:insert',
      'second:capture',
      'second:insert',
    ]);
  });

  it('propagates an account boundary instead of flattening it into a skip', async () => {
    let current = true;
    let releaseProof!: () => void;
    const staleLease = {
      ...lease(93),
      assertCurrent: () => {
        if (!current) throw new AccountGenerationLeaseError();
      },
    } satisfies AccountGenerationLease;
    const currentDeps = deps({
      hasExactGrant: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            releaseProof = () => resolve(true);
          }),
      ),
    });

    const publication = mirrorSkinProfileWithExactConsent(staleLease, INPUT, currentDeps);
    await vi.waitFor(() => expect(currentDeps.hasExactGrant).toHaveBeenCalledOnce());
    current = false;
    releaseProof();

    await expect(publication).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    expect(currentDeps.publish).not.toHaveBeenCalled();
  });
});
