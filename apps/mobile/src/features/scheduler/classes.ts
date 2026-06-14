import type { FunctionalTag } from '@onskin/types';

import type { SensitivityLevel } from '@/features/intelligence/engine';

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
export function classifyActiveClass(tags: FunctionalTag[]): ActiveClass {
  const t = new Set(tags);
  if (t.has('retinoid')) return 'retinoid';
  if (t.has('aha')) return 'aha';
  if (t.has('bha')) return 'bha';
  if (t.has('benzoyl_peroxide')) return 'benzoyl_peroxide';
  if (t.has('vitamin_c')) return 'vitamin_c';
  if (t.has('niacinamide')) return 'niacinamide';
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

type Caps = { sensitive: number; normal: number; resistant: number };

// Conservative exfoliation/active frequency caps by skin type (docs/05 §4 table).
// BHA tolerated more often than AHA; the retinoid cap is a ceiling. The ramp
// (docs/03 §4) governs the real number. B-DERM-REVIEW.
const FREQUENCY_CAPS: Partial<Record<ActiveClass, Caps>> = {
  aha: { sensitive: 1, normal: 3, resistant: 4 },
  bha: { sensitive: 2, normal: 3, resistant: 7 },
  retinoid: { sensitive: 2, normal: 4, resistant: 7 },
};

/** The per-week frequency cap for a class, personalised by sensitivity (docs/05 §4). */
export function frequencyCap(cls: ActiveClass, sensitivity: SensitivityLevel): number {
  const caps = FREQUENCY_CAPS[cls];
  if (!caps) return 7;
  if (sensitivity === 'sensitive') return caps.sensitive;
  if (sensitivity === 'resistant') return caps.resistant;
  return caps.normal;
}

// *** BLOCKED: B-DERM-REVIEW. FREQUENCY_CAPS (and the orchestration recovery
// *** densities) are UNREVIEWED grade-C consensus starting positions (docs/05 §8).
// *** Mirrors pao.ts PAO_DEFAULTS_REVIEWED / rules.ts shippableRules: until a
// *** board-certified dermatologist + cosmetic chemist sign off, PRODUCTION falls
// *** back to the most conservative cap (the sensitive column) rather than
// *** surfacing the per-type numbers as authoritative cadence. Flip after sign-off.
export const CAPS_REVIEWED = false;

/** The launch-gated cap used by the scheduler: the reviewed/dev numbers in
 *  development, the most conservative (sensitive) cap in production until
 *  B-DERM-REVIEW sign-off. The harm-relevant retinoid×exfoliant separation does
 *  NOT depend on this. It is enforced by construction regardless. */
export function reviewedFrequencyCap(cls: ActiveClass, sensitivity: SensitivityLevel): number {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isDev || CAPS_REVIEWED) return frequencyCap(cls, sensitivity);
  return frequencyCap(cls, 'sensitive');
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
