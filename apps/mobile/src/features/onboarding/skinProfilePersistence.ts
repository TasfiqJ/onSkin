import type { GoalId } from '@onskin/types';

import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';
import { runSerializedConsentWorkflow } from '@/lib/consent/workflow';

import {
  getQuizCompletionState,
  ONBOARDING_QUIZ,
  scoreQuiz,
  type QuizAnswers,
  type SkinProfileResult,
} from './quiz';
import { setStoredSkinProfile } from './skinProfileStore';
import { hasCurrentHealthDataCollectionConsent } from './healthConsentStore';
import { mirrorSkinProfileWithExactConsentInsideWorkflow } from './skinProfileMirror';

type SkinProfilePersistenceDeps = Readonly<{
  hasCurrentLocalConsent: typeof hasCurrentHealthDataCollectionConsent;
  setStoredProfile: typeof setStoredSkinProfile;
  mirrorInsideWorkflow: typeof mirrorSkinProfileWithExactConsentInsideWorkflow;
}>;

const defaultDeps: SkinProfilePersistenceDeps = {
  hasCurrentLocalConsent: hasCurrentHealthDataCollectionConsent,
  setStoredProfile: setStoredSkinProfile,
  mirrorInsideWorkflow: mirrorSkinProfileWithExactConsentInsideWorkflow,
};

/**
 * Complete onboarding profile workflow under one generation-scoped consent
 * queue. A later decline cannot write local false between the consent check
 * and the device-authoritative profile commit.
 */
export async function persistSkinProfileWithConsentWorkflow(
  lease: AccountGenerationLease,
  input: Readonly<{
    goals: readonly GoalId[];
    quizAnswers: QuizAnswers;
    onLocalCommit: () => Promise<void>;
  }>,
  deps: SkinProfilePersistenceDeps = defaultDeps,
): Promise<SkinProfileResult> {
  return runSerializedConsentWorkflow(lease, async () => {
    if (!(await deps.hasCurrentLocalConsent())) {
      lease.assertCurrent();
      throw new Error('CURRENT_HEALTH_CONSENT_REQUIRED');
    }
    lease.assertCurrent();

    const completion = getQuizCompletionState(input.quizAnswers, ONBOARDING_QUIZ);
    if (!completion.complete) {
      throw new Error(
        `Cannot persist incomplete onboarding quiz: ${completion.missingQuestionIds.join(', ')}`,
      );
    }

    const result = scoreQuiz(input.quizAnswers, ONBOARDING_QUIZ);
    const completedAt = new Date().toISOString();
    await deps.setStoredProfile({ result, goals: [...input.goals], completedAt });
    lease.assertCurrent();
    await input.onLocalCommit();
    lease.assertCurrent();

    await deps.mirrorInsideWorkflow(lease, {
      result,
      goals: input.goals,
      completedAt,
    });
    lease.assertCurrent();
    return result;
  });
}
