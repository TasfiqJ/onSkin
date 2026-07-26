import { describe, expect, it, vi } from 'vitest';

import {
  AccountGenerationLeaseError,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { runSerializedConsentWorkflow } from '@/lib/consent/workflow';
import { ONBOARDING_QUIZ, type QuizAnswers } from './quiz';
import { persistSkinProfileWithConsentWorkflow } from './skinProfilePersistence';

vi.mock('./healthConsentStore', () => ({
  hasCurrentHealthDataCollectionConsent: vi.fn(),
}));
vi.mock('./skinProfileMirror', () => ({
  mirrorSkinProfileWithExactConsentInsideWorkflow: vi.fn(),
}));
vi.mock('./skinProfileStore', () => ({
  setStoredSkinProfile: vi.fn(),
}));

const COMPLETE_ANSWERS = Object.fromEntries(
  ONBOARDING_QUIZ.map((question) => [
    question.id,
    question.multiSelect ? [question.options[0]!.id] : question.options[0]!.id,
  ]),
) as QuizAnswers;

function lease(generation = 101): AccountGenerationLease {
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
  overrides: Partial<NonNullable<Parameters<typeof persistSkinProfileWithConsentWorkflow>[2]>> = {},
) {
  return {
    hasCurrentLocalConsent: vi.fn(async () => true),
    setStoredProfile: vi.fn(async () => undefined),
    mirrorInsideWorkflow: vi.fn(async () => true),
    ...overrides,
  };
}

describe('complete onboarding skin-profile consent workflow', () => {
  it('keeps a later decline behind the local consent check and profile commit', async () => {
    let releaseConsentCheck!: () => void;
    const consentCheck = new Promise<boolean>((resolve) => {
      releaseConsentCheck = () => resolve(true);
    });
    const events: string[] = [];
    const currentLease = lease();
    const currentDeps = deps({
      hasCurrentLocalConsent: vi.fn(async () => {
        events.push('profile:consent-check');
        return consentCheck;
      }),
      setStoredProfile: vi.fn(async () => {
        events.push('profile:local-commit');
      }),
      mirrorInsideWorkflow: vi.fn(async () => {
        events.push('profile:mirror');
        return true;
      }),
    });

    const profile = persistSkinProfileWithConsentWorkflow(
      currentLease,
      {
        goals: ['clear_skin'],
        quizAnswers: COMPLETE_ANSWERS,
        onLocalCommit: async () => {
          events.push('profile:cache');
        },
      },
      currentDeps,
    );
    await vi.waitFor(() => expect(events).toEqual(['profile:consent-check']));

    const decline = runSerializedConsentWorkflow(currentLease, async () => {
      events.push('decline:local-false');
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['profile:consent-check']);

    releaseConsentCheck();
    await expect(Promise.all([profile, decline])).resolves.toEqual([expect.any(Object), undefined]);
    expect(events).toEqual([
      'profile:consent-check',
      'profile:local-commit',
      'profile:cache',
      'profile:mirror',
      'decline:local-false',
    ]);
  });

  it('rechecks after an earlier decline and cannot write a profile from stale consent', async () => {
    let releaseDecline!: () => void;
    const declineGate = new Promise<void>((resolve) => {
      releaseDecline = resolve;
    });
    const events: string[] = [];
    const currentLease = lease(102);
    let granted = true;
    const currentDeps = deps({
      hasCurrentLocalConsent: vi.fn(async () => {
        events.push(`profile:consent:${String(granted)}`);
        return granted;
      }),
    });

    const decline = runSerializedConsentWorkflow(currentLease, async () => {
      events.push('decline:started');
      await declineGate;
      granted = false;
      events.push('decline:local-false');
    });
    await vi.waitFor(() => expect(events).toEqual(['decline:started']));

    const profile = persistSkinProfileWithConsentWorkflow(
      currentLease,
      {
        goals: ['clear_skin'],
        quizAnswers: COMPLETE_ANSWERS,
        onLocalCommit: vi.fn(async () => undefined),
      },
      currentDeps,
    );
    await Promise.resolve();
    expect(currentDeps.hasCurrentLocalConsent).not.toHaveBeenCalled();

    releaseDecline();
    await expect(decline).resolves.toBeUndefined();
    await expect(profile).rejects.toThrow('CURRENT_HEALTH_CONSENT_REQUIRED');
    expect(events).toEqual(['decline:started', 'decline:local-false', 'profile:consent:false']);
    expect(currentDeps.setStoredProfile).not.toHaveBeenCalled();
    expect(currentDeps.mirrorInsideWorkflow).not.toHaveBeenCalled();
  });

  it('keeps local onboarding successful when the exact remote mirror skips', async () => {
    const onLocalCommit = vi.fn(async () => undefined);
    const currentDeps = deps({
      mirrorInsideWorkflow: vi.fn(async () => false),
    });

    await expect(
      persistSkinProfileWithConsentWorkflow(
        lease(103),
        {
          goals: ['clear_skin'],
          quizAnswers: COMPLETE_ANSWERS,
          onLocalCommit,
        },
        currentDeps,
      ),
    ).resolves.toEqual(expect.objectContaining({ axisScores: expect.any(Object) }));
    expect(currentDeps.setStoredProfile).toHaveBeenCalledOnce();
    expect(onLocalCommit).toHaveBeenCalledOnce();
  });

  it('propagates an account boundary during a delayed consent check', async () => {
    let current = true;
    let releaseCheck!: () => void;
    const staleLease = {
      ...lease(104),
      assertCurrent: () => {
        if (!current) throw new AccountGenerationLeaseError();
      },
    } satisfies AccountGenerationLease;
    const currentDeps = deps({
      hasCurrentLocalConsent: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            releaseCheck = () => resolve(true);
          }),
      ),
    });

    const profile = persistSkinProfileWithConsentWorkflow(
      staleLease,
      {
        goals: ['clear_skin'],
        quizAnswers: COMPLETE_ANSWERS,
        onLocalCommit: vi.fn(async () => undefined),
      },
      currentDeps,
    );
    await vi.waitFor(() => expect(currentDeps.hasCurrentLocalConsent).toHaveBeenCalledOnce());
    current = false;
    releaseCheck();

    await expect(profile).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    expect(currentDeps.setStoredProfile).not.toHaveBeenCalled();
  });
});
