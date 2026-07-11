import { conflictKey } from './conflictIdentity';
import type { DetectedConflict } from './engine';

export type ConflictUserChoice = 'accept_suggested_timing' | 'use_together';

export type ConflictChoiceRecord = {
  choice: ConflictUserChoice;
  ruleId: string;
  ruleVersion: number;
  productIds: [string, string];
};

export type ConflictChoices = Record<string, ConflictChoiceRecord>;

export function isConflictChoiceEligible(conflict: DetectedConflict): boolean {
  return Boolean(
    conflict.productAId &&
      conflict.productBId &&
      conflict.rule.interactionType !== 'safety' &&
      conflict.rule.interactionType !== 'myth' &&
      conflict.rule.interactionType !== 'synergy',
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
