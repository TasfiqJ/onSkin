import type { GoalId } from '@onskin/types';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { ownerQueryPrefixes, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { supabase } from '@/lib/supabase/client';

import {
  getQuizCompletionState,
  ONBOARDING_QUIZ,
  scoreQuiz,
  type QuizAnswers,
  type SkinProfileResult,
} from './quiz';
import { setStoredSkinProfile } from './skinProfileStore';
import { hasCurrentHealthDataCollectionConsent } from './healthConsentStore';

// In-progress onboarding answers, accumulated client-side and persisted at the
// reveal step. Goals are capped at 2 (design spec: "choose up to two").
type OnboardingContextValue = {
  goals: GoalId[];
  toggleGoal: (id: GoalId) => void;
  quizAnswers: QuizAnswers;
  setAnswer: (questionId: string, value: string | string[]) => void;
  computeResult: () => SkinProfileResult;
  persistSkinProfile: () => Promise<SkinProfileResult>;
  reset: () => void;
};

const MAX_GOALS = 2;

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const [goals, setGoals] = useState<GoalId[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({});

  const value = useMemo<OnboardingContextValue>(
    () => ({
      goals,
      toggleGoal(id) {
        setGoals((prev) => {
          if (prev.includes(id)) return prev.filter((g) => g !== id);
          if (prev.length >= MAX_GOALS) return [prev[1]!, id]; // keep most recent two
          return [...prev, id];
        });
      },
      quizAnswers,
      setAnswer(questionId, val) {
        setQuizAnswers((prev) => ({ ...prev, [questionId]: val }));
      },
      computeResult() {
        return scoreQuiz(quizAnswers, ONBOARDING_QUIZ);
      },
      async persistSkinProfile() {
        return runOwnerQueryOperation(ownerScope, async (ownerLease) => {
          if (!(await hasCurrentHealthDataCollectionConsent())) {
            ownerLease.assertCurrent();
            throw new Error('CURRENT_HEALTH_CONSENT_REQUIRED');
          }
          ownerLease.assertCurrent();
          const completion = getQuizCompletionState(quizAnswers, ONBOARDING_QUIZ);
          if (!completion.complete) {
            throw new Error(
              `Cannot persist incomplete onboarding quiz: ${completion.missingQuestionIds.join(', ')}`,
            );
          }
          const result = scoreQuiz(quizAnswers, ONBOARDING_QUIZ);
          const completedAt = new Date().toISOString();
          // Local-first (D-029): record completion on-device FIRST so the entry
          // gate (app/index.tsx) recognizes this user as onboarded even if the
          // server write fails or no backend exists yet. This is the v1 source of
          // truth; the Supabase insert below is a best-effort mirror that must not
          // throw past this point (a returning user must never be re-onboarded).
          await setStoredSkinProfile({ result, goals, completedAt });
          ownerLease.assertCurrent();
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ownerQueryPrefixes.skinProfile(ownerScope),
            }),
            queryClient.invalidateQueries({ queryKey: ownerQueryPrefixes.shelf(ownerScope) }),
            queryClient.invalidateQueries({ queryKey: ownerQueryPrefixes.ramp(ownerScope) }),
          ]);
          ownerLease.assertCurrent();

          let userId: string | undefined;
          try {
            userId = (await captureAuthenticatedAccountOwner(ownerLease))?.userId;
          } catch {
            ownerLease.assertCurrent();
            // Best-effort mirror; the local record is the durable v1 signal.
          }
          ownerLease.assertCurrent();
          if (userId) {
            try {
              // Axis scores are stored as the raw signed sums (docs/01 §3 axis ints).
              await supabase
                .from('skin_profiles')
                .insert({
                  user_id: userId,
                  oily_dry: result.axisScores.oily_dry,
                  sensitive_resistant: result.axisScores.sensitive_resistant,
                  pigmented_non: result.axisScores.pigmented_non,
                  wrinkled_tight: result.axisScores.wrinkled_tight,
                  fitzpatrick: result.fitzpatrick,
                  monk_tone: result.monkTone,
                  sensitivities: result.sensitivities,
                  pregnancy_status: result.pregnancyStatus,
                  goals,
                  completed_at: completedAt,
                  version: 1,
                })
                .abortSignal(ownerLease.signal);
              ownerLease.assertCurrent();
            } catch {
              ownerLease.assertCurrent();
              // Server mirroring remains best-effort until the backend is available.
            }
          }
          ownerLease.assertCurrent();
          return result;
        });
      },
      reset() {
        setGoals([]);
        setQuizAnswers({});
      },
    }),
    [goals, ownerScope, queryClient, quizAnswers],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
