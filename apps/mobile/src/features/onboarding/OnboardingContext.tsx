import type { GoalId } from '@onskin/types';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { ownerQueryPrefixes, queryKeys, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { scoreQuiz, type QuizAnswers, type SkinProfileResult } from './quiz';
import { persistSkinProfileWithConsentWorkflow } from './skinProfilePersistence';

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
        return scoreQuiz(quizAnswers);
      },
      async persistSkinProfile() {
        return runOwnerQueryOperation(ownerScope, (ownerLease) =>
          persistSkinProfileWithConsentWorkflow(ownerLease, {
            goals,
            quizAnswers,
            async onLocalCommit() {
              queryClient.setQueryData(queryKeys.onboarded(ownerScope), true);
              await Promise.all([
                queryClient.invalidateQueries({
                  queryKey: ownerQueryPrefixes.skinProfile(ownerScope),
                }),
                queryClient.invalidateQueries({ queryKey: ownerQueryPrefixes.shelf(ownerScope) }),
                queryClient.invalidateQueries({ queryKey: ownerQueryPrefixes.ramp(ownerScope) }),
              ]);
            },
          }),
        );
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
