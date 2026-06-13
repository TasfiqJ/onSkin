import type { GoalId } from '@onskin/types';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase/client';

import { PLACEHOLDER_QUIZ, scoreQuiz, type QuizAnswers, type SkinProfileResult } from './quiz';

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
        return scoreQuiz(quizAnswers, PLACEHOLDER_QUIZ);
      },
      async persistSkinProfile() {
        const result = scoreQuiz(quizAnswers, PLACEHOLDER_QUIZ);
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error('persistSkinProfile requires a session');
        // Axis scores are stored as the raw signed sums (docs/01 §3 axis ints).
        const { error } = await supabase.from('skin_profiles').insert({
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
          completed_at: new Date().toISOString(),
          version: 1,
        });
        if (error) throw error;
        return result;
      },
      reset() {
        setGoals([]);
        setQuizAnswers({});
      },
    }),
    [goals, quizAnswers],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
