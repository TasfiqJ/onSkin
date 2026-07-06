import type { GoalId } from '@onskin/types';

import type { SensitivityLevel } from '@/features/intelligence/engine';

export type MoistureBalance = 'dry' | 'balanced' | 'oily';

export type RoutinePlanProfileLabelInput = {
  sensitivity: SensitivityLevel;
  moisture: MoistureBalance;
  pregnancy: boolean;
  goals: GoalId[];
};

export function sensitivityFromAxis(score: number | null): SensitivityLevel {
  if (score == null || score === 0) return 'neutral';
  return score > 0 ? 'sensitive' : 'resistant';
}

export function moistureFromAxis(score: number | null): MoistureBalance {
  if (score == null || score === 0) return 'balanced';
  return score > 0 ? 'oily' : 'dry';
}

export function routinePlanProfileLabel(
  profile: RoutinePlanProfileLabelInput | null,
  isExample: boolean,
): string {
  if (isExample) return 'EXAMPLE ROUTINE';
  if (!profile) return 'BUILT FROM YOUR SHELF';

  const traits = [profile.moisture, profile.sensitivity]
    .filter((trait) => trait !== 'balanced' && trait !== 'neutral')
    .map((trait) => trait.toUpperCase());

  if (profile.pregnancy) traits.push('PREGNANCY-AWARE');
  if (traits.length === 0) return 'BUILT FROM YOUR SHELF';
  return `BUILT FOR ${traits.join(', ')} SKIN`;
}
