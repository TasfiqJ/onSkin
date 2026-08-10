import type { GoalId } from '@layerwell/types';
import { GOALS } from '@layerwell/types';

import { QUIZ_SCORING_PROVENANCE } from '@/features/onboarding/quizContract';

export type GoalRecommendationProvenance = {
  schemaVersion: 1;
  source: 'local_current_quiz' | 'server_current_quiz';
  quizContractId: string;
  quizContentVersion: string;
  quizScoringVersion: string;
  quizOutputSchemaVersion: number;
  quizContentSha256: string;
  quizScoringSha256: string;
  quizContractSha256: string;
  quizReviewStatus: string;
  quizPoleTieRule: string;
  profileCompletedAt: string;
  goals: GoalId[];
};

const GOAL_IDS = new Set<GoalId>(GOALS.map((goal) => goal.id));
const PROVENANCE_KEYS = [
  'schemaVersion',
  'source',
  'quizContractId',
  'quizContentVersion',
  'quizScoringVersion',
  'quizOutputSchemaVersion',
  'quizContentSha256',
  'quizScoringSha256',
  'quizContractSha256',
  'quizReviewStatus',
  'quizPoleTieRule',
  'profileCompletedAt',
  'goals',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function isValidRecommendationGoals(value: unknown): value is GoalId[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 2 &&
    value.every(
      (goal): goal is GoalId => typeof goal === 'string' && GOAL_IDS.has(goal as GoalId),
    ) &&
    new Set(value).size === value.length
  );
}

function isValidProfileTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
  ) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

function exactGoalsMatch(actual: readonly GoalId[], expected: readonly GoalId[]): boolean {
  return (
    actual.length === expected.length && actual.every((goal, index) => goal === expected[index])
  );
}

export function isCurrentGoalRecommendationProvenance(
  value: unknown,
  expectedGoals: readonly GoalId[],
): value is GoalRecommendationProvenance {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, PROVENANCE_KEYS) ||
    value.schemaVersion !== 1 ||
    (value.source !== 'local_current_quiz' && value.source !== 'server_current_quiz') ||
    value.quizContractId !== QUIZ_SCORING_PROVENANCE.contractId ||
    value.quizContentVersion !== QUIZ_SCORING_PROVENANCE.contentVersion ||
    value.quizScoringVersion !== QUIZ_SCORING_PROVENANCE.scoringVersion ||
    value.quizOutputSchemaVersion !== QUIZ_SCORING_PROVENANCE.outputSchemaVersion ||
    value.quizContentSha256 !== QUIZ_SCORING_PROVENANCE.contentSha256 ||
    value.quizScoringSha256 !== QUIZ_SCORING_PROVENANCE.scoringSha256 ||
    value.quizContractSha256 !== QUIZ_SCORING_PROVENANCE.contractSha256 ||
    value.quizReviewStatus !== QUIZ_SCORING_PROVENANCE.reviewStatus ||
    value.quizPoleTieRule !== QUIZ_SCORING_PROVENANCE.poleTieRule ||
    !isValidProfileTimestamp(value.profileCompletedAt) ||
    !isValidRecommendationGoals(value.goals) ||
    !exactGoalsMatch(value.goals, expectedGoals)
  ) {
    return false;
  }
  return true;
}

export function currentGoalRecommendationProvenance(input: {
  source: GoalRecommendationProvenance['source'];
  profileCompletedAt: string;
  goals: GoalId[];
}): GoalRecommendationProvenance | null {
  const value: GoalRecommendationProvenance = {
    schemaVersion: 1,
    source: input.source,
    quizContractId: QUIZ_SCORING_PROVENANCE.contractId,
    quizContentVersion: QUIZ_SCORING_PROVENANCE.contentVersion,
    quizScoringVersion: QUIZ_SCORING_PROVENANCE.scoringVersion,
    quizOutputSchemaVersion: QUIZ_SCORING_PROVENANCE.outputSchemaVersion,
    quizContentSha256: QUIZ_SCORING_PROVENANCE.contentSha256,
    quizScoringSha256: QUIZ_SCORING_PROVENANCE.scoringSha256,
    quizContractSha256: QUIZ_SCORING_PROVENANCE.contractSha256,
    quizReviewStatus: QUIZ_SCORING_PROVENANCE.reviewStatus,
    quizPoleTieRule: QUIZ_SCORING_PROVENANCE.poleTieRule,
    profileCompletedAt: input.profileCompletedAt,
    goals: [...input.goals],
  };
  return isCurrentGoalRecommendationProvenance(value, input.goals) ? value : null;
}
