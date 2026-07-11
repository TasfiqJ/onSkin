import type { RampClass, ToleranceState } from '@onskin/types';

import type { SensitivityLevel } from '@/features/intelligence/engine';

// Retinoid/active ramp-up (docs/03 §4): "start low and slow." Offer-only step-ups,
// automatic de-escalation on self-reported irritation. Numbers are starting
// positions for B-DERM-REVIEW. Pure + testable.

export type RampState = {
  freqPerWeek: number;
  targetPerWeek: number;
  toleranceState: ToleranceState;
};

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}
function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseLocal(toISO).getTime() - parseLocal(fromISO).getTime()) / 86_400_000);
}

/** Initialise the ramp (docs/03 §4): sensitive/barrier start gentler than resistant. */
export function initRamp(rampClass: RampClass, sensitivity: SensitivityLevel): RampState {
  // Only exfoliating/retinoid actives ramp; everything else is daily/steady.
  if (rampClass === 'other_active') {
    return { freqPerWeek: 7, targetPerWeek: 7, toleranceState: 'steady' };
  }
  if (sensitivity === 'resistant') {
    return { freqPerWeek: 3, targetPerWeek: 4, toleranceState: 'building' };
  }
  return { freqPerWeek: 2, targetPerWeek: 3, toleranceState: 'building' };
}

/** Offer a step-up only on a positive signal. Never silently escalate (docs/03 §4).
 *  ~21 days steady at the current cadence, no reported irritation, below target. */
export function shouldOfferStepUp(opts: {
  startedAt: string;
  lastStepUp: string | null;
  freqPerWeek: number;
  targetPerWeek: number;
  toleranceState: ToleranceState;
  today: string;
}): boolean {
  if (opts.toleranceState === 'paused_irritation') return false;
  if (opts.freqPerWeek >= opts.targetPerWeek) return false;
  const anchor = opts.lastStepUp ?? opts.startedAt;
  return daysBetween(anchor, opts.today) >= 21;
}

/** De-escalate on reported irritation: pause + drop a night (claim-safe, §4). */
export function deEscalate(state: RampState): RampState {
  if (state.toleranceState === 'paused_irritation') return state;
  return {
    freqPerWeek: Math.max(1, state.freqPerWeek - 1),
    targetPerWeek: state.targetPerWeek,
    toleranceState: 'paused_irritation',
  };
}

/** Apply the optional weekly tolerance check-in answer (docs/03 §4). */
export function applyTolerance(
  state: RampState,
  answer: 'comfortable' | 'a_bit_dry' | 'irritated',
): RampState {
  if (answer === 'irritated') return deEscalate(state);
  if (answer === 'comfortable') return { ...state, toleranceState: 'steady' };
  return state; // "a bit dry". Hold the current cadence
}
