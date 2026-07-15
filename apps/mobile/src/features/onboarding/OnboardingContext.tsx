import type { GoalId } from '@onskin/types';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { getPersistedSupabaseUser, supabase } from '@/lib/supabase/client';

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
        const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
        if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
        return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
          if (!(await hasCurrentHealthDataCollectionConsent())) {
            throw new Error('CURRENT_HEALTH_CONSENT_REQUIRED');
          }
          lease.assertCurrent();
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
          lease.assertCurrent();
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['skinProfileBits'] }),
            queryClient.invalidateQueries({ queryKey: ['shelf'] }),
            queryClient.invalidateQueries({ queryKey: ['ramp'] }),
          ]);
          lease.assertCurrent();
          try {
            const { data: userData } = await getPersistedSupabaseUser();
            lease.assertCurrent();
            if (userData.user?.id !== lease.ownerUserId) {
              throw new Error('SUPABASE_SESSION_OWNER_MISMATCH');
            }
            // Axis scores are stored as the raw signed sums (docs/01 §3 axis ints).
            const { error } = await supabase.from('skin_profiles').insert({
              user_id: lease.ownerUserId,
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
            });
            lease.assertCurrent();
            if (error) throw error;
          } catch {
            // Best-effort server mirror until the backend is configured. A
            // stale lease must still escape instead of becoming offline success.
            lease.assertCurrent();
          }
          lease.assertCurrent();
          return result;
        });
      },
      reset() {
        setGoals([]);
        setQuizAnswers({});
      },
    }),
    [goals, queryClient, quizAnswers],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
