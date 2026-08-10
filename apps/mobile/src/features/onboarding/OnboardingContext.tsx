import type { GoalId } from '@layerwell/types';
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
  type ScoredQuizProfileResult,
} from './quiz';
import { setStoredSkinProfileFromExplicitQuiz } from './skinProfileStore';
import { hasCurrentHealthDataCollectionConsent } from './healthConsentStore';

// In-progress onboarding answers, accumulated client-side and persisted at the
// reveal step. Goals are capped at 2 (design spec: "choose up to two").
type OnboardingContextValue = {
  goals: GoalId[];
  toggleGoal: (id: GoalId) => void;
  quizAnswers: QuizAnswers;
  profileResult: ScoredQuizProfileResult | null;
  setAnswer: (questionId: string, value: string | string[]) => void;
  computeResult: () => ScoredQuizProfileResult;
  persistSkinProfile: () => Promise<ScoredQuizProfileResult>;
  reset: () => void;
};

const MAX_GOALS = 2;

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [goals, setGoals] = useState<GoalId[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({});
  const [profileResult, setProfileResult] = useState<ScoredQuizProfileResult | null>(null);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      goals,
      toggleGoal(id) {
        setProfileResult(null);
        setGoals((prev) => {
          if (prev.includes(id)) return prev.filter((g) => g !== id);
          if (prev.length >= MAX_GOALS) return [prev[1]!, id]; // keep most recent two
          return [...prev, id];
        });
      },
      quizAnswers,
      profileResult,
      setAnswer(questionId, val) {
        setProfileResult(null);
        setQuizAnswers((prev) => ({ ...prev, [questionId]: val }));
      },
      computeResult() {
        return profileResult ?? scoreQuiz(quizAnswers, ONBOARDING_QUIZ);
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
          // server write fails or no backend exists yet. The exact v2 contract
          // receipt is the local source of truth; the Supabase insert below is a
          // best-effort mirror that must not throw past this point (a returning
          // user must never be re-onboarded).
          await setStoredSkinProfileFromExplicitQuiz({ result, goals, completedAt });
          // The current receipt is durable. Keep only the scored result needed
          // by the remaining onboarding screens and discard raw answers,
          // including pregnancy and sensitivity responses, from provider memory.
          setProfileResult(result);
          setQuizAnswers({});
          lease.assertCurrent();
          await Promise.allSettled([
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
              dspt: result.dspt,
              oily_dry_basis_points: result.axesBasisPoints.oily_dry,
              sensitive_resistant_basis_points: result.axesBasisPoints.sensitive_resistant,
              pigmented_non_basis_points: result.axesBasisPoints.pigmented_non,
              wrinkled_tight_basis_points: result.axesBasisPoints.wrinkled_tight,
              fitzpatrick: result.fitzpatrick,
              monk_tone: result.monkTone,
              sensitivities: result.sensitivities,
              pregnancy_status: result.pregnancyStatus,
              goals,
              completed_at: completedAt,
              version: 2,
              quiz_contract_id: result.provenance.contractId,
              quiz_content_version: result.provenance.contentVersion,
              quiz_scoring_version: result.provenance.scoringVersion,
              quiz_output_schema_version: result.provenance.outputSchemaVersion,
              quiz_content_sha256: result.provenance.contentSha256,
              quiz_scoring_sha256: result.provenance.scoringSha256,
              quiz_contract_sha256: result.provenance.contractSha256,
              quiz_review_status: result.provenance.reviewStatus,
              quiz_pole_tie_rule: result.provenance.poleTieRule,
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
        setProfileResult(null);
      },
    }),
    [goals, profileResult, queryClient, quizAnswers],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
