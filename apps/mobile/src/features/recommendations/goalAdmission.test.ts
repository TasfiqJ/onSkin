import { describe, expect, it, vi } from 'vitest';

import {
  CURRENT_GOAL_ACTIVE_REVIEW_CLEARANCE,
  goalActiveRecommendationAdmission,
  isCurrentGoalActiveReviewClearanceOpen,
} from './goalAdmission';
import {
  currentGoalRecommendationProvenance,
  isCurrentGoalRecommendationProvenance,
  isValidRecommendationGoals,
} from './goalProvenance';

vi.mock('@/lib/launch/phase7', () => ({
  phase7Flags: { goalActiveRecommendations: false },
}));

const goals = ['hydration'] as const;
const current = currentGoalRecommendationProvenance({
  source: 'server_current_quiz',
  profileCompletedAt: '2026-07-26T12:00:00.000Z',
  goals: [...goals],
})!;

describe('CORE-06A goal-active admission', () => {
  it('starts with zero reviewed types and no review receipts', () => {
    expect(CURRENT_GOAL_ACTIVE_REVIEW_CLEARANCE).toEqual({
      status: 'closed',
      corpusSha256: null,
      admittedTypeCount: 0,
      receiptIds: [],
      reviewerRoles: [],
    });
    expect(isCurrentGoalActiveReviewClearanceOpen()).toBe(false);
  });

  it('requires the current Phase 7 flag, consent, exact goal provenance, and review clearance', () => {
    const result = goalActiveRecommendationAdmission({
      consentCurrent: true,
      goals,
      provenance: current,
    });
    expect(result.admitted).toBe(false);
    expect(result.reasonCodes).toContain('phase7_goal_flag_closed');
    expect(result.reasonCodes).toContain('goal_review_clearance_closed');
  });

  it('reports consent and provenance failures independently of review clearance', () => {
    const result = goalActiveRecommendationAdmission({
      consentCurrent: false,
      goals,
      provenance: { ...current, quizContractSha256: '0'.repeat(64) },
    });
    expect(result.admitted).toBe(false);
    expect(result.reasonCodes).toContain('health_consent_not_current');
    expect(result.reasonCodes).toContain('goal_provenance_invalid');
    expect(result.reasonCodes).toContain('goal_review_clearance_closed');
  });

  it.each([
    [],
    ['hydration', 'hydration'],
    ['hydration', 'barrier_repair', 'anti_aging'],
    ['not_a_goal'],
    'hydration',
  ])('runtime-rejects malformed or forged goal sets: %j', (candidate) => {
    expect(isValidRecommendationGoals(candidate)).toBe(false);
  });

  it('binds the exact ordered goals to the current quiz tuple', () => {
    expect(isCurrentGoalRecommendationProvenance(current, goals)).toBe(true);
    expect(isCurrentGoalRecommendationProvenance(current, ['anti_aging'])).toBe(false);
    expect(
      isCurrentGoalRecommendationProvenance({ ...current, goals: ['not_a_goal'] }, goals),
    ).toBe(false);
    expect(isCurrentGoalRecommendationProvenance({ ...current, extra: true }, goals)).toBe(false);
  });
});
