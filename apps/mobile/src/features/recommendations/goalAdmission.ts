import type { GoalId } from '@layerwell/types';

import { phase7Flags } from '@/lib/launch/phase7';

import { isCurrentGoalRecommendationProvenance } from './goalProvenance';

export type GoalActiveAdmissionReasonCode =
  | 'phase7_goal_flag_closed'
  | 'health_consent_not_current'
  | 'goal_provenance_invalid'
  | 'goal_review_clearance_closed';

export type GoalActiveReviewerRole =
  | 'board_certified_dermatologist'
  | 'cosmetic_chemist'
  | 'regulatory_counsel';

export const CURRENT_GOAL_ACTIVE_REVIEW_CLEARANCE = Object.freeze({
  status: 'closed' as const,
  corpusSha256: null,
  admittedTypeCount: 0,
  receiptIds: Object.freeze([] as string[]),
  reviewerRoles: Object.freeze([] as GoalActiveReviewerRole[]),
});

export type GoalActiveAdmissionResult = {
  admitted: boolean;
  reasonCodes: readonly GoalActiveAdmissionReasonCode[];
};

const REQUIRED_REVIEWER_ROLES: readonly GoalActiveReviewerRole[] = [
  'board_certified_dermatologist',
  'cosmetic_chemist',
  'regulatory_counsel',
];

export function isCurrentGoalActiveReviewClearanceOpen(): boolean {
  const clearance: {
    status: string;
    corpusSha256: string | null;
    admittedTypeCount: number;
    receiptIds: readonly string[];
    reviewerRoles: readonly string[];
  } = CURRENT_GOAL_ACTIVE_REVIEW_CLEARANCE;
  return (
    clearance.status === 'approved' &&
    typeof clearance.corpusSha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(clearance.corpusSha256) &&
    Number.isSafeInteger(clearance.admittedTypeCount) &&
    clearance.admittedTypeCount > 0 &&
    clearance.receiptIds.length >= REQUIRED_REVIEWER_ROLES.length &&
    new Set(clearance.receiptIds).size === clearance.receiptIds.length &&
    REQUIRED_REVIEWER_ROLES.every((role) => clearance.reviewerRoles.includes(role))
  );
}

/**
 * Goal-active authority is conjunctive. Environment flags, profile consent,
 * current goal provenance, and professional clearance are independent gates.
 * No caller-provided review marker is accepted.
 */
export function goalActiveRecommendationAdmission(input: {
  consentCurrent: boolean;
  goals: readonly GoalId[];
  provenance: unknown;
}): GoalActiveAdmissionResult {
  const reasonCodes: GoalActiveAdmissionReasonCode[] = [];
  if (!phase7Flags.goalActiveRecommendations) reasonCodes.push('phase7_goal_flag_closed');
  if (!input.consentCurrent) reasonCodes.push('health_consent_not_current');
  if (!isCurrentGoalRecommendationProvenance(input.provenance, input.goals)) {
    reasonCodes.push('goal_provenance_invalid');
  }
  if (!isCurrentGoalActiveReviewClearanceOpen()) {
    reasonCodes.push('goal_review_clearance_closed');
  }
  return { admitted: reasonCodes.length === 0, reasonCodes };
}
