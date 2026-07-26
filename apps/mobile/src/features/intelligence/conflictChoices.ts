import { conflictKey } from './conflictIdentity';
import type { DetectedConflict } from './engine';
import { isReviewedRule } from './rules';

export type ConflictUserChoice = 'accept_suggested_timing' | 'use_together';

export type ConflictChoiceRecord = {
  choice: ConflictUserChoice;
  ruleId: string;
  ruleVersion: number;
  productIds: [string, string];
  corpusSha256: string | null;
  ruleContentSha256: string | null;
};

export type ConflictChoices = Record<string, ConflictChoiceRecord>;

export function isConflictChoiceEligible(conflict: DetectedConflict): boolean {
  return Boolean(
    conflict.productAId &&
    conflict.productBId &&
    conflict.rule.interactionType !== 'safety' &&
    conflict.rule.interactionType !== 'myth' &&
    conflict.rule.interactionType !== 'synergy' &&
    conflict.rule.copy.overrideActionLabel !== null &&
    isReviewedRule(conflict.rule) &&
    /^[a-f0-9]{64}$/u.test(conflict.rule.corpusSha256) &&
    /^[a-f0-9]{64}$/u.test(conflict.rule.ruleContentSha256),
  );
}

export function choiceForConflict(
  choices: ConflictChoices,
  conflict: DetectedConflict,
): ConflictUserChoice | null {
  if (!isConflictChoiceEligible(conflict)) return null;
  const record = choices[conflictKey(conflict)];
  const productIds = [conflict.productAId!, conflict.productBId!].sort();
  return record?.ruleId === conflict.rule.id &&
    record.ruleVersion === conflict.rule.ruleVersion &&
    record.corpusSha256 === conflict.rule.corpusSha256 &&
    record.ruleContentSha256 === conflict.rule.ruleContentSha256 &&
    record.productIds[0] === productIds[0] &&
    record.productIds[1] === productIds[1]
    ? record.choice
    : null;
}

export function unresolvedConflicts(
  conflicts: readonly DetectedConflict[],
  choices: ConflictChoices,
): DetectedConflict[] {
  return conflicts.filter((conflict) => choiceForConflict(choices, conflict) == null);
}
