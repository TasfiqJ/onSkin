import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingProvider, useOnboarding } from './OnboardingContext';
import { setHealthDataCollectionConsentLocal } from '@/features/onboarding/healthConsentStore';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { ONBOARDING_QUIZ, scoreQuiz, type QuizAnswers } from './quiz';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  invalidateQueries: vi.fn(),
  insert: vi.fn(),
  setStoredFromQuiz: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(),
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => mocks.storage.get(key) ?? null,
  removePrivateItem: async (key: string) => {
    mocks.storage.delete(key);
  },
  updatePrivateItem: async (key: string, update: (raw: string | null) => string | null) => {
    const next = update(mocks.storage.get(key) ?? null);
    if (next === null) mocks.storage.delete(key);
    else mocks.storage.set(key, next);
  },
}));
vi.mock('expo-router/build/react-navigation/core/NavigationContext', async () => ({
  NavigationContext: (await import('react')).createContext(undefined),
}));
vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: vi.fn(async () => ({ data: { user: { id: 'user-a' } } })),
  supabase: {
    from: () => ({ insert: mocks.insert }),
  },
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

beforeEach(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  latestContext = null;
  mocks.storage.clear();
  await setHealthDataCollectionConsentLocal({
    granted: true,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.fullText,
  });
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(19, { ownerUserId: 'user-a', accountGeneration });
  mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.setStoredFromQuiz.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
  clearActiveHealthProcessingEpoch();
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
