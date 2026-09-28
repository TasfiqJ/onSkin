import type { GoalId } from '@layerwell/types';

import type { SensitivityLevel } from './engine';

// Compatibility shim for the docs/03 routine generator. The maintained temporal
// engine lives in features/scheduler/*; this file only exposes the legacy cycle
// template shape that generatePlan still returns.

export type CycleSlot = 'exfoliate' | 'retinoid' | 'recover';

export type CycleTemplate = {
  id: 'classic_4' | 'gentle_5' | 'advanced_3';
  label: string;
  /** Ordered slot per night; the cycle repeats. */
  nights: CycleSlot[];
};

export const CYCLE_TEMPLATES: Record<CycleTemplate['id'], CycleTemplate> = {
  // The classic four-night cycle (Bowe): Exfoliate → Retinoid → Recover → Recover.
  classic_4: {
    id: 'classic_4',
    label: 'Classic',
    nights: ['exfoliate', 'retinoid', 'recover', 'recover'],
  },
  // Gentle: extra recovery nights for sensitive / barrier-repair skin.
  gentle_5: {
    id: 'gentle_5',
    label: 'Gentle',
    nights: ['exfoliate', 'recover', 'retinoid', 'recover', 'recover'],
  },
  // Advanced: fewer recovery nights for resistant skin that tolerates more.
  advanced_3: { id: 'advanced_3', label: 'Advanced', nights: ['exfoliate', 'retinoid', 'recover'] },
};

export type SchedulerProfile = {
  sensitivity: SensitivityLevel;
  goals: GoalId[];
  /** Whether the user owns any cycling actives (retinoid / exfoliating acid). */
  hasActives: boolean;
};

/** Pick a cycle for the user, or null when there's nothing to cycle (docs/02 §5). */
export function pickCycle(profile: SchedulerProfile): CycleTemplate | null {
  if (!profile.hasActives) return null;
  if (profile.sensitivity === 'sensitive' || profile.goals.includes('barrier_repair')) {
    return CYCLE_TEMPLATES.gentle_5;
  }
  if (profile.sensitivity === 'resistant') return CYCLE_TEMPLATES.advanced_3;
  return CYCLE_TEMPLATES.classic_4;
}
