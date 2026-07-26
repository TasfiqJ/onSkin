import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingProvider, useOnboarding } from './OnboardingContext';
import { ONBOARDING_QUIZ, scoreQuiz, type QuizAnswers } from './quiz';

const mocks = vi.hoisted(() => ({
  assertCurrent: vi.fn(),
  hasConsent: vi.fn(),
  invalidateQueries: vi.fn(),
  insert: vi.fn(),
  setStoredFromQuiz: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  HEALTH_DATA_WRITE_ADMISSION_CLOSED: 'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
  runHealthDataWriteOperation: async (
    _ownerUserId: string,
    operation: (lease: { assertCurrent: () => void; ownerUserId: string }) => Promise<unknown>,
  ) =>
    operation({
      assertCurrent: mocks.assertCurrent,
      ownerUserId: 'user-a',
    }),
}));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingOwnerUserId: () => 'user-a',
}));
vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: vi.fn(async () => ({ data: { user: { id: 'user-a' } } })),
  supabase: {
    from: () => ({ insert: mocks.insert }),
  },
}));
vi.mock('./healthConsentStore', () => ({
  hasCurrentHealthDataCollectionConsent: mocks.hasConsent,
}));
vi.mock('./skinProfileStore', () => ({
  setStoredSkinProfileFromExplicitQuiz: mocks.setStoredFromQuiz,
}));

const COMPLETE_ANSWERS = Object.fromEntries(
  ONBOARDING_QUIZ.map((question) => [
    question.id,
    question.multiSelect === true ? [question.options[0]!.id] : question.options[0]!.id,
  ]),
) as QuizAnswers;

let latestContext: ReturnType<typeof useOnboarding> | null = null;
let renderer: ReactTestRenderer | null = null;

function ContextProbe({
  onContext,
}: {
  onContext: (context: ReturnType<typeof useOnboarding>) => void;
}) {
  const context = useOnboarding();
  useEffect(() => onContext(context), [context, onContext]);
  return null;
}

async function renderProvider(): Promise<void> {
  const captureContext = (context: ReturnType<typeof useOnboarding>) => {
    latestContext = context;
  };
  await act(async () => {
    renderer = create(
      createElement(
        OnboardingProvider,
        null,
        createElement(ContextProbe, { onContext: captureContext }),
      ),
    );
  });
}

async function completeQuiz(): Promise<void> {
  await act(async () => {
    latestContext!.toggleGoal('clear_skin');
    for (const [questionId, answer] of Object.entries(COMPLETE_ANSWERS)) {
      latestContext!.setAnswer(questionId, answer);
    }
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  latestContext = null;
  mocks.assertCurrent.mockReset();
  mocks.hasConsent.mockReset().mockResolvedValue(true);
  mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.setStoredFromQuiz.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('OnboardingProvider profile retention', () => {
  it('keeps raw answers for a failed durable save, then wipes them after a successful retry', async () => {
    await renderProvider();
    await completeQuiz();
    const expectedResult = scoreQuiz(COMPLETE_ANSWERS);
    mocks.setStoredFromQuiz
      .mockRejectedValueOnce(new Error('PRIVATE_WRITE_FAILED'))
      .mockResolvedValueOnce(undefined);

    await expect(latestContext!.persistSkinProfile()).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(latestContext!.quizAnswers).toEqual(COMPLETE_ANSWERS);
    expect(latestContext!.profileResult).toBeNull();

    await act(async () => {
      await latestContext!.persistSkinProfile();
    });

    expect(mocks.setStoredFromQuiz).toHaveBeenCalledTimes(2);
    expect(latestContext!.quizAnswers).toEqual({});
    expect(latestContext!.profileResult).toEqual(expectedResult);
    expect(latestContext!.computeResult()).toEqual(expectedResult);
  });

  it('does not wipe raw answers while the atomic local write is still pending', async () => {
    await renderProvider();
    await completeQuiz();
    let releaseWrite!: () => void;
    const writePending = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    mocks.setStoredFromQuiz.mockReturnValueOnce(writePending);

    const save = latestContext!.persistSkinProfile();
    await Promise.resolve();
    expect(latestContext!.quizAnswers).toEqual(COMPLETE_ANSWERS);
    expect(latestContext!.profileResult).toBeNull();

    await act(async () => {
      releaseWrite();
      await save;
    });

    expect(latestContext!.quizAnswers).toEqual({});
    expect(latestContext!.profileResult).toEqual(scoreQuiz(COMPLETE_ANSWERS));
  });
});
