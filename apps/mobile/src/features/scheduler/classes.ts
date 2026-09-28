import type { FunctionalTag } from '@layerwell/types';

import type { SensitivityLevel } from '@/features/intelligence/engine';
import { shippableRoutineCadencePolicy } from '@/features/routine/sequencing';

// Active classification + the cadence rules the scheduler orchestrates (docs/05
// §4/§5). Pure + data-driven. The frequency caps + AM/PM placement are SORT-grade-C
// dermatologist consensus and are B-DERM-REVIEW starting positions; the
// retinoid×exfoliant separation is the harm-relevant FIRM rule, enforced by
// construction (one potent active per night → they can never share a night).

export type ActiveClass =
  | 'retinoid'
  | 'aha'
  | 'bha'
  | 'vitamin_c'
  | 'niacinamide'
  | 'benzoyl_peroxide'
  | 'other';

/** A product's scheduler class. The most potent tag wins (docs/05 §4). */
export function classifyActiveClass(tags: FunctionalTag[], category?: string | null): ActiveClass {
  const t = new Set(tags);
  if (t.has('retinoid')) return 'retinoid';
  if (t.has('aha')) return 'aha';
  if (t.has('bha')) return 'bha';
  if (t.has('benzoyl_peroxide')) return 'benzoyl_peroxide';
  if (t.has('vitamin_c')) return 'vitamin_c';
  if (t.has('niacinamide')) return 'niacinamide';
  if (category === 'retinoid_serum') return 'retinoid';
  if (category === 'benzoyl_peroxide') return 'benzoyl_peroxide';
  return 'other';
}

/** The potent night-cycled actives. One per night, never colliding (docs/05 §4). */
export const POTENT_CLASSES: ActiveClass[] = ['aha', 'bha', 'retinoid'];
export function isPotent(cls: ActiveClass): boolean {
  return POTENT_CLASSES.includes(cls);
}

export type Phase = 'am' | 'pm' | 'flexible';

/** Default AM/PM placement by class (docs/05 §5 table). */
export function defaultPhase(cls: ActiveClass): Phase {
  switch (cls) {
    case 'vitamin_c':
      return 'am'; // morning antioxidant + SPF
    case 'benzoyl_peroxide':
      return 'am'; // AM (kept off simple-retinol nights. Docs/02 stability rule)
    case 'retinoid':
    case 'aha':
    case 'bha':
      return 'pm';
    case 'niacinamide':
    default:
      return 'flexible'; // barrier-supportive, low-conflict
  }
}

// Conservative exfoliation/active frequency caps by skin type (docs/05 §4 table).
// BHA tolerated more often than AHA; the retinoid cap is a ceiling. The ramp
// (docs/03 §4) governs the real number. B-DERM-REVIEW.
/** The per-week frequency cap for a class, personalised by sensitivity (docs/05 §4). */
export function frequencyCap(cls: ActiveClass, sensitivity: SensitivityLevel): number | null {
  const policy = shippableRoutineCadencePolicy();
  if (!policy) return null;
  const caps =
    cls === 'aha' || cls === 'bha' || cls === 'retinoid' ? policy.frequencyCapsPerWeek[cls] : null;
  if (!caps) return policy.ramp.otherActivePerWeek;
  if (sensitivity === 'sensitive') return caps.sensitive;
  if (sensitivity === 'resistant') return caps.resistant;
  return caps.normal;
}

/** The exact-corpus-gated cap used by the scheduler. No numeric fallback is
 *  exposed when cadence admission is closed; a conservative-looking number is
 *  still an unreviewed health-guidance claim. */
export function reviewedFrequencyCap(
  cls: ActiveClass,
  sensitivity: SensitivityLevel,
): number | null {
  return frequencyCap(cls, sensitivity);
}

const CLASS_LABEL: Record<ActiveClass, string> = {
  retinoid: 'Retinoid',
  aha: 'AHA',
  bha: 'BHA',
  vitamin_c: 'Vitamin C',
  niacinamide: 'Niacinamide',
  benzoyl_peroxide: 'Benzoyl peroxide',
  other: 'Supportive',
};
export const classLabel = (cls: ActiveClass) => CLASS_LABEL[cls];
